#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const sourcePath = resolve(repoRoot, 'src', 'data', 'serviceIconMapping.ts');
const iconsRoot = resolve(repoRoot, 'Azure_Public_Service_Icons', 'Icons');
const iconMapPath = resolve(here, '..', 'src', 'iconMap.generated.json');
const iconSvgsPath = resolve(here, '..', 'src', 'iconSvgs.generated.json');
const catalogPath = resolve(here, '..', 'src', 'serviceCatalog.generated.json');
const legacyTypesPath = resolve(here, '..', 'src', 'legacyIconTypes.generated.json');
const webRedirectsPath = resolve(repoRoot, 'src', 'data', 'iconPathRedirects.generated.json');
const sourceMetadataPath = resolve(repoRoot, 'scripts', 'azure-icons-v24.source.json');
const baselinePath = resolve(repoRoot, 'scripts', 'azure-icons-pre-v24-baseline.json');
const manifestPath = resolve(repoRoot, 'scripts', 'azure-icons-v24.manifest.json');
const checkOnly = process.argv.includes('--check');

const REQUIRED_FOUNDRY_SERVICES = [
  'Microsoft Foundry',
  'Foundry Application',
  'Foundry Project',
  'Foundry IQ',
  'Microsoft Foundry Agent Service',
  'Microsoft Foundry Control Plane',
  'Foundry Labs',
  'Foundry Local',
  'Microsoft Foundry Models',
];

function extractString(block, field, required = true) {
  const match = block.match(new RegExp(`${field}:\\s*'([^']*)'`));
  if (!match && required) throw new Error(`Missing ${field}`);
  return match?.[1];
}

function extractBoolean(block, field, defaultValue = false) {
  const match = block.match(new RegExp(`${field}:\\s*(true|false)`));
  return match ? match[1] === 'true' : defaultValue;
}

function extractNumber(block, field, defaultValue = 0) {
  const match = block.match(new RegExp(`${field}:\\s*(\\d+)`));
  return match ? Number(match[1]) : defaultValue;
}

function extractAliases(block) {
  const match = block.match(/aliases:\s*\[([\s\S]*?)\]/);
  return match ? [...match[1].matchAll(/'([^']+)'/g)].map(alias => alias[1]) : [];
}

function extractEntries(text) {
  const entries = [];
  const entryRe = /'([^']+)'\s*:\s*\{/g;
  let match;
  while ((match = entryRe.exec(text)) !== null) {
    const key = match[1];
    let depth = 1;
    let index = entryRe.lastIndex;
    while (index < text.length && depth > 0) {
      if (text[index] === '{') depth++;
      else if (text[index] === '}') depth--;
      index++;
    }
    if (depth !== 0) throw new Error(`Unclosed mapping block for ${key}`);
    const block = text.slice(match.index, index);
    if (!/iconFile:\s*'/.test(block)) continue;
    try {
      entries.push({
        key,
        displayName: extractString(block, 'displayName'),
        aliases: extractAliases(block),
        iconFile: extractString(block, 'iconFile'),
        category: extractString(block, 'category'),
        hasPricingData: extractBoolean(block, 'hasPricingData'),
        pricingServiceName: extractString(block, 'pricingServiceName', false),
        isUsageBased: extractBoolean(block, 'isUsageBased'),
        costRange: extractString(block, 'costRange', false),
        reverseLookupPriority: extractNumber(block, 'reverseLookupPriority'),
      });
    } catch (error) {
      throw new Error(`${key}: ${error.message}`);
    }
  }
  if (entries.length === 0) throw new Error(`No service entries extracted from ${sourcePath}`);
  return entries;
}

function exactFilePath(category, fileName) {
  const categoryEntries = readdirSync(iconsRoot, { withFileTypes: true });
  const exactCategory = categoryEntries.find(entry => entry.isDirectory() && entry.name === category);
  if (!exactCategory) return null;
  const directory = resolve(iconsRoot, exactCategory.name);
  const expectedName = `${fileName}.svg`;
  const exactFile = readdirSync(directory, { withFileTypes: true })
    .find(entry => entry.isFile() && entry.name === expectedName);
  return exactFile ? resolve(directory, exactFile.name) : null;
}

function validateEntries(entries) {
  const errors = [];
  const canonicalOwners = new Map();
  const nameOwners = new Map();
  const iconCategories = new Map();
  const entriesByIconPath = new Map();

  for (const entry of entries) {
    const canonical = entry.key.trim().toLowerCase();
    if (canonicalOwners.has(canonical)) {
      errors.push(`duplicate canonical service "${entry.key}" (also ${canonicalOwners.get(canonical)})`);
    } else {
      canonicalOwners.set(canonical, entry.key);
    }

    for (const name of [entry.key, entry.displayName, ...entry.aliases]) {
      const normalized = name.trim().toLowerCase();
      const owner = nameOwners.get(normalized);
      if (owner && owner !== entry.key) {
        errors.push(`name/alias "${name}" resolves to both "${owner}" and "${entry.key}"`);
      } else {
        nameOwners.set(normalized, entry.key);
      }
    }

    const priorCategory = iconCategories.get(entry.iconFile);
    if (priorCategory && priorCategory !== entry.category) {
      errors.push(`icon stem "${entry.iconFile}" maps to both "${priorCategory}" and "${entry.category}"`);
    } else {
      iconCategories.set(entry.iconFile, entry.category);
    }

    if (!exactFilePath(entry.category, entry.iconFile)) {
      errors.push(`missing or wrongly-cased SVG: ${entry.category}/${entry.iconFile}.svg`);
    }
    const iconPath = `${entry.category}/${entry.iconFile}.svg`;
    const sharing = entriesByIconPath.get(iconPath) ?? [];
    sharing.push(entry);
    entriesByIconPath.set(iconPath, sharing);
  }

  for (const [iconPath, sharing] of entriesByIconPath) {
    if (sharing.length < 2) continue;
    const highestPriority = Math.max(...sharing.map(entry => entry.reverseLookupPriority));
    const preferred = sharing.filter(entry => entry.reverseLookupPriority === highestPriority);
    if (highestPriority === 0 || preferred.length !== 1) {
      errors.push(
        `shared icon "${iconPath}" needs exactly one positive reverseLookupPriority; services: ` +
        sharing.map(entry => entry.key).join(', '),
      );
    }
  }

  for (const required of REQUIRED_FOUNDRY_SERVICES) {
    if (!canonicalOwners.has(required.toLowerCase())) errors.push(`required Foundry service omitted: ${required}`);
  }
  if (!canonicalOwners.has('ai gateway')) errors.push('required V24 service omitted: AI Gateway');
  if (!canonicalOwners.has('azure ai search')) errors.push('current canonical service omitted: Azure AI Search');

  if (errors.length > 0) {
    throw new Error(`Service/icon validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  }
}

function buildOutputs(entries) {
  const iconMap = {};
  const catalog = {};
  const svgs = {};
  for (const entry of entries) {
    iconMap[entry.key] = {
      displayName: entry.displayName,
      iconFile: entry.iconFile,
      category: entry.category,
      aliases: entry.aliases,
      reverseLookupPriority: entry.reverseLookupPriority,
    };
    catalog[entry.key] = {
      displayName: entry.displayName,
      aliases: entry.aliases,
      category: entry.category,
      hasPricingData: entry.hasPricingData,
      ...(entry.pricingServiceName ? { pricingServiceName: entry.pricingServiceName } : {}),
      isUsageBased: entry.isUsageBased,
      ...(entry.costRange ? { costRange: entry.costRange } : {}),
    };
    if (!svgs[entry.iconFile]) {
      const path = exactFilePath(entry.category, entry.iconFile);
      let svg = readFileSync(path, 'utf8')
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .trim();
      if (/<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)\s*=\s*["']https?:|<!ENTITY/i.test(svg)) {
        throw new Error(`Unsafe SVG content in ${entry.category}/${entry.iconFile}.svg`);
      }
      svgs[entry.iconFile] = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
    }
  }
  return {
    iconMap: `${JSON.stringify(iconMap, null, 2)}\n`,
    catalog: `${JSON.stringify(catalog, null, 2)}\n`,
    svgs: `${JSON.stringify(svgs)}\n`,
  };
}

function buildLegacyCompatibility(entries) {
  const source = JSON.parse(readFileSync(sourceMetadataPath, 'utf8'));
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const logicalReplacements = new Map(
    source.logicalContentReplacements.map(item => [item.repositoryPath, item.officialPath]),
  );
  const officialPathsByHash = new Map();
  for (const item of manifest.official) {
    const paths = officialPathsByHash.get(item.sha256) ?? [];
    paths.push(item.path);
    officialPathsByHash.set(item.sha256, paths);
  }
  const baselineByPath = new Map(baseline.iconInventory.map(item => [item.path, item]));
  const serviceByCurrentPath = new Map();
  for (const entry of entries) {
    const currentPath = `${entry.category}/${entry.iconFile}.svg`;
    const current = serviceByCurrentPath.get(currentPath);
    if (!current || entry.reverseLookupPriority > current.priority) {
      serviceByCurrentPath.set(currentPath, {
        canonicalService: entry.key,
        priority: entry.reverseLookupPriority,
      });
    }
  }

  const redirects = {};
  const legacyTypes = {};
  for (const oldPath of source.supersededRepositoryPaths) {
    const logicalTarget = logicalReplacements.get(oldPath);
    const oldHash = baselineByPath.get(oldPath)?.sha256;
    const candidates = logicalTarget
      ? [logicalTarget]
      : oldHash ? officialPathsByHash.get(oldHash) ?? [] : [];
    const canonicalTarget = candidates.find(candidate => serviceByCurrentPath.has(candidate));
    const sameFileName = candidates.find(candidate => basename(candidate) === basename(oldPath));
    const sameCategory = candidates.find(
      candidate => candidate.split('/')[0] === oldPath.split('/')[0],
    );
    const target = canonicalTarget ?? sameFileName ?? sameCategory ?? candidates[0];
    if (!target) throw new Error(`No V24 compatibility redirect for ${oldPath}`);
    const [category, fileName] = target.split(/\/(?=[^/]+$)/);
    if (!fileName || !exactFilePath(category, fileName.replace(/\.svg$/i, ''))) {
      throw new Error(`Compatibility redirect target is missing: ${oldPath} -> ${target}`);
    }
    redirects[oldPath] = target;

    const canonicalService = serviceByCurrentPath.get(target)?.canonicalService;
    if (canonicalService) {
      const legacyStem = basename(oldPath, '.svg');
      const existing = legacyTypes[legacyStem];
      if (existing && existing !== canonicalService) {
        throw new Error(`Legacy icon stem "${legacyStem}" maps to multiple services`);
      }
      legacyTypes[legacyStem] = canonicalService;
    }
  }
  return {
    redirects: `${JSON.stringify(redirects, null, 2)}\n`,
    legacyTypes: `${JSON.stringify(legacyTypes, null, 2)}\n`,
  };
}

function writeOrCheck(path, expected, label) {
  if (checkOnly) {
    if (!existsSync(path)) throw new Error(`Missing generated ${label}: ${path}`);
    if (readFileSync(path, 'utf8') !== expected) {
      throw new Error(`Generated ${label} is stale. Run npm run sync:icons in mcp-server.`);
    }
  } else {
    writeFileSync(path, expected, 'utf8');
  }
}

try {
  const entries = extractEntries(readFileSync(sourcePath, 'utf8'));
  validateEntries(entries);
  const outputs = buildOutputs(entries);
  const compatibility = buildLegacyCompatibility(entries);
  writeOrCheck(iconMapPath, outputs.iconMap, 'icon map');
  writeOrCheck(catalogPath, outputs.catalog, 'service catalog');
  writeOrCheck(iconSvgsPath, outputs.svgs, 'SVG registry');
  writeOrCheck(webRedirectsPath, compatibility.redirects, 'legacy web icon redirects');
  writeOrCheck(legacyTypesPath, compatibility.legacyTypes, 'legacy MCP icon types');
  const uniqueIcons = new Set(entries.map(entry => entry.iconFile)).size;
  console.log(`[sync-icon-map] ${checkOnly ? 'verified' : 'wrote'} ${entries.length} services and ${uniqueIcons} embedded SVGs`);
} catch (error) {
  console.error(`[sync-icon-map] ${error.message}`);
  process.exitCode = 1;
}

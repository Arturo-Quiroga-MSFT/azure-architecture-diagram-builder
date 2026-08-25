#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Build-time helper: extract iconFile + category from the web app's
 * src/data/serviceIconMapping.ts and emit a JSON sidecar consumable by the
 * MCP server (avoids duplicating ~945 lines of mapping data).
 *
 * Run: node mcp-server/scripts/sync-icon-map.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const sourcePath = resolve(repoRoot, 'src', 'data', 'serviceIconMapping.ts');
const outPath = resolve(here, '..', 'src', 'iconMap.generated.json');
const catalogOutPath = resolve(here, '..', 'src', 'serviceCatalog.generated.json');

const text = readFileSync(sourcePath, 'utf8');
const source = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

let serviceMapNode = null;
for (const statement of source.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === 'SERVICE_ICON_MAP' &&
      declaration.initializer &&
      ts.isObjectLiteralExpression(declaration.initializer)
    ) {
      serviceMapNode = declaration.initializer;
    }
  }
}
if (!serviceMapNode) {
  throw new Error(`SERVICE_ICON_MAP object literal not found in ${sourcePath}`);
}

const propertyName = (property) => {
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
  return null;
};
const propertyValue = (object, name) => object.properties.find(
  property => ts.isPropertyAssignment(property) && propertyName(property) === name,
)?.initializer;
const stringValue = (node) => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  ? node.text
  : undefined;
const booleanValue = (node) => {
  if (node?.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node?.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
};
const aliasesValue = (node) => ts.isArrayLiteralExpression(node)
  ? node.elements.map(stringValue).filter(value => value !== undefined)
  : [];

const map = {};
const catalog = {};
for (const property of serviceMapNode.properties) {
  if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) continue;
  const key = propertyName(property);
  if (!key) continue;

  const entry = property.initializer;
  const displayName = stringValue(propertyValue(entry, 'displayName'));
  const aliases = aliasesValue(propertyValue(entry, 'aliases'));
  const iconFile = stringValue(propertyValue(entry, 'iconFile'));
  const iconCategory = stringValue(propertyValue(entry, 'iconCategory'));
  const category = stringValue(propertyValue(entry, 'category'));
  const hasPricingData = booleanValue(propertyValue(entry, 'hasPricingData'));
  const pricingServiceName = stringValue(propertyValue(entry, 'pricingServiceName'));
  const isUsageBased = booleanValue(propertyValue(entry, 'isUsageBased'));
  const costRange = stringValue(propertyValue(entry, 'costRange'));

  if (!displayName || !iconFile || !category || hasPricingData === undefined) {
    throw new Error(`Incomplete canonical metadata for ${key}`);
  }

  map[key] = { iconFile, category, aliases, ...(iconCategory ? { iconCategory } : {}) };
  catalog[key] = {
    displayName,
    aliases,
    iconFile,
    ...(iconCategory ? { iconCategory } : {}),
    category,
    hasPricingData,
    ...(pricingServiceName ? { pricingServiceName } : {}),
    ...(isUsageBased !== undefined ? { isUsageBased } : {}),
    ...(costRange !== undefined ? { costRange } : {}),
  };
}

const count = Object.keys(map).length;
if (count === 0) {
  console.error(`[sync-icon-map] no entries extracted from ${sourcePath}`);
  process.exit(1);
}

const normalizeIdentity = (value) => value.trim().toLowerCase();
const identities = new Map();
const identityConflicts = [];
for (const [key, entry] of Object.entries(catalog)) {
  for (const identity of [key, entry.displayName, ...entry.aliases]) {
    const normalized = normalizeIdentity(identity);
    const owner = identities.get(normalized);
    if (owner && owner !== key) {
      identityConflicts.push({ identity, owner, contender: key });
      continue;
    }
    identities.set(normalized, key);
  }
}
if (identityConflicts.length > 0) {
  throw new Error(`Ambiguous canonical service identities:\n${identityConflicts.map(conflict =>
    `- "${conflict.identity}": ${conflict.owner} vs ${conflict.contender}`,
  ).join('\n')}`);
}
writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(`[sync-icon-map] wrote ${count} entries to ${outPath}`);
writeFileSync(catalogOutPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`[sync-icon-map] wrote ${Object.keys(catalog).length} canonical services to ${catalogOutPath}`);

// ── Embed real Azure icon SVGs as data URIs ────────────────────────────
// For each referenced icon file, read the SVG, lightly minify, and base64
// encode into a data URI. The renderer inlines these via <image> so diagrams
// use the official Azure glyphs instead of emoji. <image> data URIs avoid the
// gradient-id collisions that inlining raw <svg> would cause.
const iconsRoot = resolve(repoRoot, 'Azure_Public_Service_Icons', 'Icons');
const svgOutPath = resolve(here, '..', 'src', 'iconSvgs.generated.json');
const svgs = {};
let embedded = 0;
let missing = 0;
const seen = new Set();
for (const entry of Object.values(map)) {
  const { iconFile, category, iconCategory } = entry;
  if (seen.has(iconFile)) continue;
  seen.add(iconFile);
  const svgPath = resolve(iconsRoot, iconCategory || category, `${iconFile}.svg`);
  try {
    let svg = readFileSync(svgPath, 'utf8');
    svg = svg
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .trim();
    svgs[iconFile] = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
    embedded++;
  } catch {
    missing++;
  }
}

writeFileSync(svgOutPath, JSON.stringify(svgs) + '\n', 'utf8');
console.log(`[sync-icon-map] embedded ${embedded} icon SVGs (${missing} missing) to ${svgOutPath}`);


#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const configPath = resolve(here, 'azure-icons-v24.source.json');
const manifestPath = resolve(here, 'azure-icons-v24.manifest.json');
const targetPackageRoot = resolve(repoRoot, 'Azure_Public_Service_Icons');
const targetIconsRoot = resolve(targetPackageRoot, 'Icons');

const config = JSON.parse(readFileSync(configPath, 'utf8'));

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function validateSvg(path, relativePath) {
  const svg = readFileSync(path, 'utf8');
  if (!/<svg[\s>]/i.test(svg)) {
    throw new Error(`Invalid SVG document: ${relativePath}`);
  }
  if (/<script\b|<foreignObject\b|\son\w+\s*=|(?:href|src)\s*=\s*["']https?:|<!DOCTYPE|<!ENTITY/i.test(svg)) {
    throw new Error(`Unsafe SVG content: ${relativePath}`);
  }
}

function normalizeRelative(path) {
  return path.split(sep).join('/');
}

function walkFiles(root, extension = null) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path, extension));
    else if (!extension || entry.name.toLowerCase().endsWith(extension)) files.push(path);
  }
  return files;
}

function inventory(root) {
  return walkFiles(root, '.svg')
    .map(path => ({
      path: normalizeRelative(relative(root, path)),
      sha256: sha256File(path),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function inventoryDigest(items) {
  const text = items.map(item => `${item.path}\t${item.sha256}\n`).join('');
  return sha256Bytes(Buffer.from(text, 'utf8'));
}

function supplementalDefinitions() {
  return config.supplementalFamilies.flatMap(family =>
    family.paths.map(path => ({
      path,
      family: family.id,
      sourceUrl: family.sourceUrl,
      provenance: family.provenance,
    })),
  );
}

function loadManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}. Run --update-manifest from a verified ${config.version} extraction.`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const expectedSource = {
    version: config.version,
    publishedDate: config.publishedDate,
    documentationUrl: config.documentationUrl,
    archiveUrl: config.archiveUrl,
    archiveSha256: config.archiveSha256,
    archiveSize: config.archiveSize,
    officialIconCount: config.officialIconCount,
    officialInventorySha256: config.officialInventorySha256,
  };
  for (const [field, expected] of Object.entries(expectedSource)) {
    if (manifest.source?.[field] !== expected) {
      throw new Error(`Manifest source.${field} does not match ${config.version} source metadata`);
    }
  }
  if (manifest.official.length !== config.officialIconCount) {
    throw new Error(`Manifest must contain ${config.officialIconCount} official SVGs`);
  }
  if (inventoryDigest(manifest.official) !== config.officialInventorySha256) {
    throw new Error('Manifest official inventory digest is invalid');
  }
  const expectedSupplements = supplementalDefinitions().map(item => item.path).sort();
  const actualSupplements = manifest.supplemental.map(item => item.path).sort();
  if (JSON.stringify(expectedSupplements) !== JSON.stringify(actualSupplements)) {
    throw new Error('Manifest supplemental paths do not match the classified source metadata');
  }
  const allPaths = [...manifest.official, ...manifest.supplemental].map(item => item.path.toLowerCase());
  if (new Set(allPaths).size !== allPaths.length) {
    throw new Error('Manifest contains duplicate case-insensitive paths');
  }
  return manifest;
}

function resolveSourcePackageRoot(source) {
  const resolved = resolve(source);
  if (existsSync(join(resolved, 'Icons'))) return resolved;
  const nested = join(resolved, config.packageRoot);
  if (existsSync(join(nested, 'Icons'))) return nested;
  throw new Error(`Source does not contain ${config.packageRoot}\\Icons: ${resolved}`);
}

function validateTerms(packageRoot) {
  for (const [name, expectedHash] of Object.entries(config.termsFiles)) {
    const path = join(packageRoot, name);
    if (!existsSync(path)) throw new Error(`Missing required terms file: ${name}`);
    const actualHash = sha256File(path);
    if (actualHash !== expectedHash) {
      throw new Error(`Terms hash mismatch for ${name}: expected ${expectedHash}, got ${actualHash}`);
    }
  }
}

function validateOfficialInventory(packageRoot, expectedItems) {
  validateTerms(packageRoot);
  const actual = inventory(join(packageRoot, 'Icons'));
  const digest = inventoryDigest(actual);
  if (actual.length !== config.officialIconCount) {
    throw new Error(`Expected ${config.officialIconCount} official SVGs, found ${actual.length}`);
  }
  if (digest !== config.officialInventorySha256) {
    throw new Error(`Official inventory digest mismatch: expected ${config.officialInventorySha256}, got ${digest}`);
  }
  if (expectedItems) {
    const expected = new Map(expectedItems.map(item => [item.path, item.sha256]));
    for (const item of actual) {
      if (expected.get(item.path) !== item.sha256) {
        throw new Error(`Official inventory mismatch at ${item.path}`);
      }
    }
  }
  return actual;
}

function writeManifest(packageRoot) {
  const official = validateOfficialInventory(packageRoot);
  const supplements = supplementalDefinitions().map(definition => {
    const path = join(targetIconsRoot, ...definition.path.split('/'));
    if (!existsSync(path)) throw new Error(`Missing supplemental asset: ${definition.path}`);
    return { ...definition, sha256: sha256File(path) };
  }).sort((a, b) => a.path.localeCompare(b.path));

  const manifest = {
    schemaVersion: 1,
    source: {
      version: config.version,
      publishedDate: config.publishedDate,
      documentationUrl: config.documentationUrl,
      archiveUrl: config.archiveUrl,
      archiveSha256: config.archiveSha256,
      archiveSize: config.archiveSize,
      officialIconCount: official.length,
      officialInventorySha256: inventoryDigest(official),
    },
    mergePolicy: {
      officialAssetsWin: true,
      preserveSupplementalAssets: true,
      deleteOnlyPinnedSupersededPaths: true,
    },
    official,
    supplemental: supplements,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[refresh-azure-icons] wrote ${official.length} official and ${supplements.length} supplemental entries to ${manifestPath}`);
}

function checkCurrent(manifest) {
  validateTerms(targetPackageRoot);
  const expected = new Map([
    ...manifest.official.map(item => [item.path, item.sha256]),
    ...manifest.supplemental.map(item => [item.path, item.sha256]),
  ]);
  const actual = inventory(targetIconsRoot);
  const actualPaths = new Set(actual.map(item => item.path));
  const errors = [];
  for (const [path, hash] of expected) {
    const fullPath = join(targetIconsRoot, ...path.split('/'));
    if (!actualPaths.has(path)) errors.push(`missing ${path}`);
    else if (sha256File(fullPath) !== hash) errors.push(`hash mismatch ${path}`);
    else validateSvg(fullPath, path);
  }
  for (const item of actual) {
    if (!expected.has(item.path)) errors.push(`unexpected ${item.path}`);
  }
  if (errors.length > 0) {
    throw new Error(`Icon tree does not match ${config.version} manifest:\n${errors.map(error => `- ${error}`).join('\n')}`);
  }
  console.log(`[refresh-azure-icons] verified ${manifest.official.length} official + ${manifest.supplemental.length} supplemental SVGs (${actual.length} total)`);
}

function applyRefresh(packageRoot, manifest) {
  validateOfficialInventory(packageRoot, manifest.official);

  const officialPaths = new Set(manifest.official.map(item => item.path));
  const supplementalPaths = new Set(manifest.supplemental.map(item => item.path));
  const supersededPaths = new Set(config.supersededRepositoryPaths);
  const currentPaths = inventory(targetIconsRoot).map(item => item.path);
  const unknown = currentPaths.filter(path =>
    !officialPaths.has(path) && !supplementalPaths.has(path) && !supersededPaths.has(path));
  if (unknown.length > 0) {
    throw new Error(`Refusing to delete unclassified repository assets:\n${unknown.map(path => `- ${path}`).join('\n')}`);
  }

  for (const item of manifest.official) {
    const source = join(packageRoot, 'Icons', ...item.path.split('/'));
    const target = join(targetIconsRoot, ...item.path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  for (const name of Object.keys(config.termsFiles)) {
    copyFileSync(join(packageRoot, name), join(targetPackageRoot, name));
  }
  for (const path of supersededPaths) {
    const target = join(targetIconsRoot, ...path.split('/'));
    if (existsSync(target)) unlinkSync(target);
  }

  checkCurrent(manifest);
}

function verifyArchive(bytes) {
  if (bytes.length !== config.archiveSize) {
    throw new Error(`Archive size mismatch: expected ${config.archiveSize}, got ${bytes.length}`);
  }
  const hash = sha256Bytes(bytes);
  if (hash !== config.archiveSha256) {
    throw new Error(`Archive SHA-256 mismatch: expected ${config.archiveSha256}, got ${hash}`);
  }
}

async function extractArchive(bytes) {
  verifyArchive(bytes);
  const zip = await JSZip.loadAsync(bytes, { createFolders: true });
  const tempRoot = mkdtempSync(join(tmpdir(), 'azure-icons-v24-'));
  const seenPaths = new Set();
  for (const [name, entry] of Object.entries(zip.files)) {
    const normalized = name.replaceAll('\\', '/');
    const segments = normalized.split('/').filter(Boolean);
    if (
      isAbsolute(normalized) ||
      segments.includes('..') ||
      segments[0] !== config.packageRoot
    ) {
      rmSync(tempRoot, { recursive: true, force: true });
      throw new Error(`Unsafe or unexpected archive entry: ${name}`);
    }
    const normalizedLower = normalized.toLowerCase();
    if (seenPaths.has(normalizedLower)) {
      rmSync(tempRoot, { recursive: true, force: true });
      throw new Error(`Duplicate case-insensitive archive entry: ${name}`);
    }
    seenPaths.add(normalizedLower);
    if (
      typeof entry.unixPermissions === 'number' &&
      (entry.unixPermissions & 0o170000) === 0o120000
    ) {
      rmSync(tempRoot, { recursive: true, force: true });
      throw new Error(`Symbolic links are not allowed in the archive: ${name}`);
    }
    if (entry.dir) continue;
    const target = join(tempRoot, ...segments);
    const relativeTarget = relative(tempRoot, target);
    if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
      rmSync(tempRoot, { recursive: true, force: true });
      throw new Error(`Archive entry escapes extraction root: ${name}`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, await entry.async('nodebuffer'));
  }
  return {
    packageRoot: join(tempRoot, config.packageRoot),
    cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
  };
}

function parseArgs(argv) {
  const args = { mode: 'check', source: null, archive: null, download: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') args.mode = 'apply';
    else if (arg === '--check') args.mode = 'check';
    else if (arg === '--update-manifest') args.mode = 'update-manifest';
    else if (arg === '--download') args.download = true;
    else if (arg === '--source') args.source = argv[++i];
    else if (arg === '--archive') args.archive = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const inputs = [args.source, args.archive, args.download].filter(Boolean).length;
  if (inputs > 1) throw new Error('Use exactly one of --source, --archive, or --download.');
  if (args.mode !== 'check' && inputs !== 1) {
    throw new Error(`${args.mode} requires one of --source, --archive, or --download.`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'check') {
    checkCurrent(loadManifest());
    return;
  }

  let sourcePackageRoot;
  let cleanup = () => {};
  if (args.source) {
    sourcePackageRoot = resolveSourcePackageRoot(args.source);
  } else {
    const bytes = args.download
      ? Buffer.from(await (async () => {
          const response = await fetch(config.archiveUrl);
          if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
          return response.arrayBuffer();
        })())
      : readFileSync(resolve(args.archive));
    const extracted = await extractArchive(bytes);
    sourcePackageRoot = extracted.packageRoot;
    cleanup = extracted.cleanup;
  }

  try {
    if (args.mode === 'update-manifest') writeManifest(sourcePackageRoot);
    else applyRefresh(sourcePackageRoot, loadManifest());
  } finally {
    cleanup();
  }
}

main().catch(error => {
  console.error(`[refresh-azure-icons] ${error.message}`);
  process.exitCode = 1;
});

#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Build-time helper: copy the web app's canonical deterministic ARM extractor
 * (src/services/armExtractor.ts) into the MCP server as a generated module.
 *
 * The extractor is the single source of truth for ARM resource-type mapping,
 * child folding, name resolution, and dependsOn/resourceId edge derivation.
 * Copying it (instead of re-implementing) keeps the web app and the MCP
 * `import_architecture` ARM path behaviourally identical.
 *
 * Run: node mcp-server/scripts/sync-arm-extractor.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const sourcePath = resolve(repoRoot, 'src', 'services', 'armExtractor.ts');
const outPath = resolve(here, '..', 'src', 'armExtractor.generated.ts');

if (!existsSync(sourcePath)) {
  throw new Error(`Canonical ARM extractor not found: ${sourcePath}`);
}

const source = readFileSync(sourcePath, 'utf8');

for (const required of ['extractArchitectureFromArm', 'lookupServiceMeta', 'ArmExtractResult', 'ArmCoverage']) {
  if (!source.includes(required)) {
    throw new Error(`Canonical ARM extractor is missing expected export "${required}"`);
  }
}

// The generated module is compiled inside the MCP server, which resolves no
// web-app paths: the canonical extractor must stay dependency-free.
const importLine = source.split('\n').find(line => /^\s*(import\s|export\s+\*\s+from|const\s+\w+\s*=\s*require\()/.test(line));
if (importLine) {
  throw new Error(`Canonical ARM extractor must remain dependency-free; found: ${importLine.trim()}`);
}

const BANNER = [
  '// GENERATED FILE — DO NOT EDIT.',
  '// Source of truth: src/services/armExtractor.ts (web app).',
  '// Regenerate with: npm run sync:arm  (runs automatically in prebuild).',
  '',
].join('\n');

const generated = `${BANNER}${source}`;

const previous = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
if (previous !== generated) {
  writeFileSync(outPath, generated, 'utf8');
}

console.log(`[sync-arm-extractor] ${previous === generated ? 'verified' : 'wrote'} ${outPath} (${source.split('\n').length} source lines)`);

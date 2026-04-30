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

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const sourcePath = resolve(repoRoot, 'src', 'data', 'serviceIconMapping.ts');
const outPath = resolve(here, '..', 'src', 'iconMap.generated.json');

const text = readFileSync(sourcePath, 'utf8');

// Naive but reliable parser: each entry is `'<Key>': { ... iconFile: 'xxx', category: 'yyy', ... }`.
// We capture every block until the matching closing brace at the same depth.
const map = {};
const entryRe = /'([^']+)'\s*:\s*\{/g;
let match;
while ((match = entryRe.exec(text)) !== null) {
  const key = match[1];
  // Walk forward to find the matching closing brace
  let depth = 1;
  let i = entryRe.lastIndex;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  const block = text.slice(match.index, i);
  const iconFileMatch = block.match(/iconFile:\s*'([^']+)'/);
  const categoryMatch = block.match(/category:\s*'([^']+)'/);
  if (iconFileMatch && categoryMatch) {
    map[key] = {
      iconFile: iconFileMatch[1],
      category: categoryMatch[1],
    };
  }
}

const count = Object.keys(map).length;
if (count === 0) {
  console.error(`[sync-icon-map] no entries extracted from ${sourcePath}`);
  process.exit(1);
}

writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(`[sync-icon-map] wrote ${count} entries to ${outPath}`);

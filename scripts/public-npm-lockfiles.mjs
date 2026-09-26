#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Keeps every package-lock.json resolvable from the public npm registry.
//
// Installing on a machine whose npm points at a private or mirrored feed
// records that feed's tarball URLs in the lockfile. Those URLs only work on
// that network, so a public clone (or the container build) cannot install.
//
//   node scripts/public-npm-lockfiles.mjs          # check; exits 1 on any private URL
//   node scripts/public-npm-lockfiles.mjs --fix    # rewrite to registry.npmjs.org
//
// Rewriting only changes the host: the package path and the `integrity`
// hash stay the same, so npm still verifies the exact same tarball.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';
// Azure Artifacts feeds: https://<host>/<org>/_packaging/<feed>/npm/registry/<package path>
const FEED_URL = /^https:\/\/[^/]+\/(?:[^/]+\/){1,2}_packaging\/[^/]+\/npm\/registry\//;

const fix = process.argv.includes('--fix');
const lockfiles = execFileSync('git', ['ls-files', '*package-lock.json'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

let privateUrls = 0;
for (const file of lockfiles) {
  const lock = JSON.parse(readFileSync(file, 'utf8'));
  const entries = Object.values(lock.packages ?? {})
    .filter((entry) => typeof entry?.resolved === 'string' && entry.resolved.startsWith('https://'));

  if (fix) {
    for (const entry of entries) {
      if (FEED_URL.test(entry.resolved)) entry.resolved = entry.resolved.replace(FEED_URL, PUBLIC_REGISTRY);
    }
    writeFileSync(file, `${JSON.stringify(lock, null, 2)}\n`);
  }

  const remaining = entries.filter((entry) => !entry.resolved.startsWith(PUBLIC_REGISTRY)).length;
  if (remaining > 0) {
    console.error(`${file}: ${remaining} package(s) resolve outside ${PUBLIC_REGISTRY}`);
  }
  privateUrls += remaining;
}

if (privateUrls > 0) {
  console.error(fix
    ? `Could not rewrite ${privateUrls} URL(s); they are not Azure Artifacts feed URLs.`
    : 'Run `node scripts/public-npm-lockfiles.mjs --fix`, then `npm ci` to confirm.');
  process.exit(1);
}
console.log(`All ${lockfiles.length} lockfiles resolve from ${PUBLIC_REGISTRY}`);

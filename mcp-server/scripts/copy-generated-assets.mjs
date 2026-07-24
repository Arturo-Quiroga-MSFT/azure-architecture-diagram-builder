#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'src');
const dist = resolve(here, '..', 'dist');
const generatedFiles = [
  'iconMap.generated.json',
  'iconSvgs.generated.json',
  'legacyIconTypes.generated.json',
  'pricing.generated.json',
  'serviceCatalog.generated.json',
];

mkdirSync(dist, { recursive: true });
for (const file of generatedFiles) copyFileSync(resolve(src, file), resolve(dist, file));
console.log(`[copy-generated-assets] copied ${generatedFiles.length} generated files`);

import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const budget = JSON.parse(readFileSync('performance-budget.json', 'utf8')).initialJavaScript;
const bundleDirectory = process.env.AADB_BUNDLE_DIR || 'dist';
const assetDirectory = join(bundleDirectory, 'assets');
const entryFiles = readdirSync(assetDirectory).filter((file) => /^index-[A-Za-z0-9_-]+\.js$/.test(file));

if (entryFiles.length !== 1) {
  throw new Error(`Expected one initial index chunk in ${assetDirectory}; found ${entryFiles.length}.`);
}

const code = readFileSync(join(assetDirectory, entryFiles[0]));
const actual = { bytes: code.byteLength, gzipBytes: gzipSync(code).byteLength };

for (const metric of ['bytes', 'gzipBytes']) {
  const limit = budget[`max${metric[0].toUpperCase()}${metric.slice(1)}`];
  if (actual[metric] > limit) {
    throw new Error(`Initial JavaScript ${metric} is ${actual[metric]}, exceeding budget ${limit}.`);
  }
}

console.log(`Bundle budget passed: ${actual.bytes}/${budget.maxBytes} bytes, ${actual.gzipBytes}/${budget.maxGzipBytes} gzip bytes.`);
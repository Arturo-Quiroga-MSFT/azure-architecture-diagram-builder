import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const builtVersion = JSON.parse(readFileSync('dist/version.json', 'utf8'));
const version = packageJson.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`package.json version is not stable semantic versioning: ${version}`);
}

const versions = {
  'package-lock.json': packageLock.version,
  'package-lock.json root package': packageLock.packages?.['']?.version,
  'dist/version.json': builtVersion.version,
};

for (const [source, candidate] of Object.entries(versions)) {
  if (candidate !== version) {
    throw new Error(`${source} reports ${candidate}; expected ${version}`);
  }
}

console.log(`Version contract passed: v${version}`);
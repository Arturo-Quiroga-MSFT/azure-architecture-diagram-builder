import { readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const outputDirectory = '.dependency-bundle-dist';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, AADB_BUNDLE_REPORT: 'true' };

rmSync(outputDirectory, { recursive: true, force: true });
try {
  const result = spawnSync(npm, ['run', 'build', '--', '--outDir', outputDirectory], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const report = JSON.parse(readFileSync(resolve(outputDirectory, 'bundle-report.json'), 'utf8'));
  const modules = report.chunks.flatMap(chunk => chunk.modules.map(module => module.module));
  const imageSizeModules = modules.filter(module => /(?:^|[/\\])image-size(?:[/\\]|$)/.test(module));
  if (imageSizeModules.length > 0) {
    throw new Error(`Vulnerable image-size package is present in the browser bundle:\n${imageSizeModules.join('\n')}`);
  }
  console.log(`Browser bundle security passed: image-size absent from ${modules.length} bundled modules.`);
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}

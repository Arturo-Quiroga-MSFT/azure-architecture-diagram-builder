import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { evaluateAudit } from './dependency-audit-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const policy = JSON.parse(readFileSync(resolve(root, 'security/dependency-audit-exceptions.json'), 'utf8'));
const targets = [
  { context: 'root all', cwd: root, args: ['audit', '--json'], allowExceptions: true },
  { context: 'root production', cwd: root, args: ['audit', '--omit=dev', '--json'], allowExceptions: true },
  { context: 'server production', cwd: resolve(root, 'server'), args: ['audit', '--omit=dev', '--json'], allowExceptions: false },
  { context: 'MCP production', cwd: resolve(root, 'mcp-server'), args: ['audit', '--omit=dev', '--json'], allowExceptions: false },
];

const errors = [];
for (const target of targets) {
  const result = spawnSync(npm, target.args, { cwd: target.cwd, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    errors.push(`${target.context}: audit transport/tool failure (non-JSON output; exit ${result.status})`);
    continue;
  }
  errors.push(...evaluateAudit(report, policy, target));
  const counts = report.metadata?.vulnerabilities;
  console.log(`${target.context}: ${counts ? JSON.stringify(counts) : 'no vulnerability metadata'}`);
}

if (errors.length > 0) {
  console.error('Dependency security audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Dependency security audit passed with two time-bounded image-size exceptions.');

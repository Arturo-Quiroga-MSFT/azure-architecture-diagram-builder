import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const outputDirectory = '.dependency-runtime-dist';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  AADB_BUNDLE_DIR: outputDirectory,
  AADB_SMOKE_OUT_DIR: outputDirectory,
  VITE_AZURE_OPENAI_ENDPOINT: 'https://smoke.invalid/',
  VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA: 'smoke-gpt-5-6-luna',
  VITE_APPINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=00000000-0000-0000-0000-000000000001;IngestionEndpoint=https://telemetry.invalid/',
  VITE_SPEECH_REGION: 'eastus',
};

function run(args) {
  const result = spawnSync(npm, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(outputDirectory, { recursive: true, force: true });
try {
  run(['run', 'build', '--', '--outDir', outputDirectory]);
  run(['run', 'test:bundle-budget']);
  run(['exec', '--', 'playwright', 'test', 'tests/e2e/dependency-runtime.spec.ts']);
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}

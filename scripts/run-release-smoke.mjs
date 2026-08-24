import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const smokeDist = '.release-smoke-dist';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const smokeEnv = {
  ...process.env,
  VITE_AZURE_OPENAI_ENDPOINT: 'https://smoke.invalid/',
  VITE_AZURE_OPENAI_DEPLOYMENT_GPT51: 'smoke-gpt-5-1',
  VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA: 'smoke-gpt-5-6-luna',
  VITE_APPINSIGHTS_CONNECTION_STRING: '',
  VITE_SPEECH_REGION: '',
  VITE_ERROR_BOUNDARY_TEST: 'true',
};

function run(args, env = process.env) {
  const result = spawnSync(npm, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(smokeDist, { recursive: true, force: true });

try {
  run(['run', 'build', '--', '--outDir', smokeDist], smokeEnv);
  run(['exec', '--', 'playwright', 'test'], smokeEnv);
} finally {
  rmSync(smokeDist, { recursive: true, force: true });
}
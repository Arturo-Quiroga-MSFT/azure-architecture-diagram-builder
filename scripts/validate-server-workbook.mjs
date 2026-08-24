import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const contentFile = new URL('./server-workbook-content.json', import.meta.url);
const workbook = JSON.parse(readFileSync(contentFile, 'utf8'));
const workspace = process.env.AADB_SERVER_WORKSPACE_ID || '1ba0600a-9ae3-45aa-bf09-bc56c9e9f050';
const queries = workbook.items
  .filter((item) => typeof item?.content?.query === 'string')
  .map((item) => ({
    name: item.name,
    query: item.content.query
      .replaceAll('{TimeRange}', '> ago(24h)')
      .replaceAll('{Granularity}', '1h'),
  }));

if (workbook.version !== 'Notebook/1.0' || queries.length < 10) {
  throw new Error('Server workbook structure or query count is invalid.');
}

const serialized = JSON.stringify(workbook);
for (const forbidden of ['client_IP', 'client_Browser', 'http_user_agent', 'remote_addr', 'request_uri']) {
  if (serialized.includes(forbidden)) throw new Error(`Workbook exposes forbidden raw-client field: ${forbidden}`);
}

for (const { name, query } of queries) {
  const result = spawnSync('az', [
    'monitor', 'log-analytics', 'query',
    '-w', workspace,
    '--analytics-query', query,
    '-o', 'none',
  ], { encoding: 'utf8' });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Workbook query failed (${name}): ${result.stderr || result.stdout}`);
  }
}

console.log(`Server workbook validation passed: ${queries.length} live KQL panels`);
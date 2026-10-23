import assert from 'node:assert/strict';
import { repairBicep } from '../src/utils/bicepRepair';

const fix = (s: string) => repairBicep(s).content;

// Missing commas in single-line objects (the dominant model slip, BCP236).
assert.equal(fix(`sku: { name: 'Basic' tier: 'Basic' }`), `sku: { name: 'Basic', tier: 'Basic' }`);
assert.equal(
  fix(`properties: { administratorLogin: login administratorLoginPassword: pwd publicNetworkAccess: 'Enabled' }`),
  `properties: { administratorLogin: login, administratorLoginPassword: pwd, publicNetworkAccess: 'Enabled' }`,
);
assert.equal(
  fix(`properties: { principalId: id roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'abc') }`),
  `properties: { principalId: id, roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'abc') }`,
);

// Nested inline objects.
assert.equal(
  fix(`x = { name: 'a' sku: { name: 'S1' capacity: 1 } kind: 'web' }`),
  `x = { name: 'a', sku: { name: 'S1', capacity: 1 }, kind: 'web' }`,
);

// Semicolons used as separators (BCP022) and as statement terminators.
assert.equal(fix(`{ name: 'API_BASE_URL'; value: apiUrl }`), `{ name: 'API_BASE_URL', value: apiUrl }`);
assert.equal(fix(`param location string;\n`), `param location string\n`);

// Single-line arrays.
assert.equal(fix(`zones: [ '1' '2' '3' ]`), `zones: [ '1', '2', '3' ]`);
assert.equal(fix(`x: [ { a: 1 } { a: 2 } ]`), `x: [ { a: 1 }, { a: 2 } ]`);

// Already-valid code is untouched.
const valid = [
  `sku: { name: 'Basic', tier: 'Basic' }`,
  `zones: ['1', '2']`,
  `value: cond ? 'a' : 'b'`,
  `x: { a: cond ? b : c, d: e }`,
  `items: [for i in range(0, 3): { name: 'n\${i}' }]`,
  `name: '\${namePrefix}-sql-\${uniqueString(resourceGroup().id)}'`,
  `cs: 'Server=tcp:\${s};Initial Catalog=db;Encrypt=True;'`,
  `// a comment: with words like this\nparam a string`,
  `resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {\n  name: name\n  location: location\n  properties: {\n    tenantId: subscription().tenantId\n  }\n}\n`,
  `desc: '''\nmulti line; with semicolons\n'''`,
];
for (const v of valid) {
  const r = repairBicep(v);
  assert.equal(r.content, v, `should not change: ${v}`);
  assert.equal(r.fixes, 0);
}

// Multi-line objects stay newline-separated (valid Bicep).
const multi = `properties: {\n  a: 1\n  b: { c: 2 d: 3 }\n}`;
assert.equal(fix(multi), `properties: {\n  a: 1\n  b: { c: 2, d: 3 }\n}`);

// Fix count is reported.
assert.equal(repairBicep(`{ a: 1 b: 2 c: 3 }`).fixes, 2);

// Role assignment names built from runtime values (BCP120) get a stable literal.
assert.equal(
  fix(`  name: guid(storageAccount.id, functions.outputs.principalId, 'Storage Blob Data Contributor')`),
  `  name: guid(storageAccount.id, 'functions.principalId', 'Storage Blob Data Contributor')`
);
assert.equal(
  fix(`  name: guid(kv.id, web.identity.principalId, roleId)`),
  `  name: guid(kv.id, 'web.principalId', roleId)`
);
assert.equal(repairBicep(`  name: guid(kv.id, app.outputs.principalId, 'r')`).fixes, 1);
// Deploy-time values are left alone.
for (const v of [
  `  name: guid(resourceGroup().id, principalIdParam, 'r')`,
  `  name: guid(kv.id, principalId, 'r')`,
  `  name: guid(kv.id, 'x', subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'abc'))`,
  `  principalId: functions.outputs.principalId`,
]) assert.equal(fix(v), v);

console.log('Bicep repair tests passed');

import assert from 'node:assert/strict';
import {
  removeUnrequestedServices,
  reviewRefinement,
  summarizeRefinementReview,
} from '../src/services/refinementGuard';
import { buildModificationPrompt, type CurrentArchitecture } from '../src/services/modificationPrompt';

const current: CurrentArchitecture = {
  architectureName: 'Customer Web App',
  nodes: [
    { id: 'app', type: 'azureNode', data: { label: 'App Service' } },
    { id: 'sql-primary', type: 'azureNode', data: { label: 'SQL Database' } },
    { id: 'application', type: 'groupNode', data: { label: 'Application' } },
  ],
  edges: [{ source: 'app', target: 'sql-primary', label: 'Read and write data' }],
};

const geoWithRedis = {
  groups: [{ id: 'application', label: 'Application' }, { id: 'data', label: 'Data' }],
  services: [
    { id: 'app', name: 'App Service', type: 'App Service', groupId: 'application' },
    { id: 'sql-primary', name: 'SQL Database', type: 'SQL Database', groupId: 'data' },
    { id: 'sql-secondary', name: 'SQL Database', type: 'SQL Database', groupId: 'data' },
    { id: 'redis', name: 'Azure Cache for Redis', type: 'Azure Cache for Redis', groupId: 'data' },
  ],
  connections: [
    { from: 'app', to: 'sql-primary', label: 'Read and write data' },
    { from: 'sql-primary', to: 'sql-secondary', label: 'Geo-replicate data' },
    { from: 'app', to: 'redis', label: 'Cache reads' },
  ],
  workflow: [
    { step: 1, description: 'Read cached data.', services: ['app', 'redis'] },
    { step: 2, description: 'Replicate writes.', services: ['sql-primary', 'sql-secondary'] },
  ],
};

const geoReview = reviewRefinement(current, geoWithRedis, 'Enable Azure SQL geo-replication');
assert.deepEqual(geoReview.unrequestedAdditions.map((change) => change.canonicalName), ['Azure Cache for Redis']);
assert.equal(geoReview.added.some((change) => change.canonicalName === 'SQL Database'), true);

const sanitized = removeUnrequestedServices(geoWithRedis, geoReview);
assert.equal(sanitized.services.some((service: any) => service.id === 'redis'), false);
assert.equal(sanitized.connections.some((connection: any) => connection.from === 'redis' || connection.to === 'redis'), false);
assert.equal(sanitized.workflow.some((step: any) => step.services.includes('redis')), false);
assert.equal(sanitized.services.filter((service: any) => service.type === 'SQL Database').length, 2);

const prompt = buildModificationPrompt(current, 'Enable Azure SQL geo-replication', ['Add Key Vault']);
assert.match(prompt, /latest CHANGE REQUESTED is the only authorization/);
assert.match(prompt, /Do not silently add best-practice.*caching/);
assert.match(prompt, /Optional improvements belong in follow-up suggestions/);

const keyVaultResult = {
  services: [
    { id: 'app', name: 'App Service', type: 'App Service' },
    { id: 'sql', name: 'SQL Database', type: 'SQL Database' },
    { id: 'vault', name: 'Key Vault', type: 'Key Vault' },
  ],
  connections: [{ from: 'app', to: 'vault', label: 'Retrieve secrets' }],
};
assert.equal(reviewRefinement(current, keyVaultResult, 'Add Azure Key Vault').unrequestedAdditions.length, 0);

const monitoringResult = {
  services: [
    { id: 'app', name: 'App Service', type: 'App Service' },
    { id: 'sql', name: 'SQL Database', type: 'SQL Database' },
    { id: 'insights', name: 'Application Insights', type: 'Application Insights' },
    { id: 'logs', name: 'Log Analytics', type: 'Log Analytics' },
  ],
  connections: [{ from: 'app', to: 'insights', label: 'Send telemetry' }],
};
assert.equal(reviewRefinement(current, monitoringResult, 'Add monitoring').unrequestedAdditions.length, 0);

const explicitRedisReview = reviewRefinement(current, geoWithRedis, 'Add Redis caching and enable SQL geo-replication');
assert.equal(explicitRedisReview.unrequestedAdditions.length, 0);

const empty: CurrentArchitecture = { architectureName: 'New', nodes: [], edges: [] };
assert.equal(reviewRefinement(empty, geoWithRedis, 'Create a web app').isRefinement, false);

const summary = summarizeRefinementReview(geoReview, true);
assert.match(summary, /Added Azure Cache for Redis — AI-proposed; approved by you/);
assert.match(summary, /Connections: \d+ added, \d+ removed or replaced/);

const replacement = {
  services: [
    { id: 'functions', name: 'Azure Functions', type: 'Azure Functions' },
    { id: 'sql', name: 'SQL Database', type: 'SQL Database' },
  ],
  connections: [{ from: 'functions', to: 'sql', label: 'Read and write data' }],
};
const replacementReview = reviewRefinement(current, replacement, 'Replace App Service with Azure Functions');
assert.equal(replacementReview.unrequestedAdditions.length, 0);
assert.match(summarizeRefinementReview(replacementReview), /Replaced App Service with Azure Functions — explicitly requested/);

console.log('Refinement guard tests passed: 6 scenarios');
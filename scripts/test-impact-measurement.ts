import assert from 'node:assert/strict';
import {
  getAdoptionProfile,
  getImpactTelemetryContext,
  getInstallationId,
  initializeAttribution,
  parseAttributionSearch,
  sanitizeAttributionValue,
  saveAdoptionProfile,
} from '../src/services/impactService';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

Object.assign(globalThis, {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
});

assert.equal(sanitizeAttributionValue(' PSA Community / FY27! '), 'psa-community-fy27');
assert.equal(sanitizeAttributionValue('x'.repeat(100))?.length, 80);
assert.deepEqual(
  parseAttributionSearch('?utm_source=Partner%20Workshop&utm_campaign=FY27%20Launch&email=person@example.com&tenantId=secret'),
  { source: 'partner-workshop', campaign: 'fy27-launch' },
);

initializeAttribution('?source=CSA Community&campaign=Architecture Day&customer=Contoso');
saveAdoptionProfile({
  organizationType: 'microsoft',
  role: 'csa',
  usageScenario: 'customer-workshop',
  deploymentMode: 'public-hosted',
});

assert.deepEqual(getAdoptionProfile(), {
  organizationType: 'microsoft',
  role: 'csa',
  usageScenario: 'customer-workshop',
  deploymentMode: 'public-hosted',
});
assert.deepEqual(getImpactTelemetryContext(), {
  audienceType: 'microsoft',
  role: 'csa',
  usageScenario: 'customer-workshop',
  deploymentMode: 'public-hosted',
  attributionSource: 'csa-community',
  attributionCampaign: 'architecture-day',
});

const installationId = getInstallationId();
assert.match(installationId, /^[0-9a-f-]{36}$/i);
assert.equal(getInstallationId(), installationId);

console.log('Impact measurement privacy contract passed.');
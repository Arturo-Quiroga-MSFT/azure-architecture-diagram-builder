const assert = require('node:assert/strict');
const { createImpactStoryRecord, createDeploymentRegistrationRecord } = require('../server/impact-records');

const now = new Date('2026-08-13T20:00:00.000Z');
const story = createImpactStoryRecord({
  audience: 'customer', engagementStage: 'customer-workshop', outcome: 'discussion-advanced', timeSaved: 'half-day',
  artifacts: ['diagram', 'validation'], externalUse: 'customer', narrative: 'A safe synthetic story.',
  internalSharingConsent: true, nameConsent: false, organizationName: 'Must not be stored', contactConsent: false,
  verification: { status: 'confirmed-customer' },
}, now);
assert.equal(story.type, 'impact-story');
assert.equal(story.sharing.organizationName, '');
assert.deepEqual(story.contact, { consent: false });
assert.deepEqual(story.verification, { status: 'self-reported' });

const registration = createDeploymentRegistrationRecord({
  installationId: '123e4567-e89b-42d3-a456-426614174000', environmentType: 'partner', hosting: 'container-apps',
  region: 'Canada Central', appVersion: '1.0.0', customerDeployment: true, nameConsent: false,
  organizationName: 'Must not be stored', contactConsent: false,
}, now);
assert.equal(registration.id, 'deployment-123e4567-e89b-42d3-a456-426614174000');
assert.equal(registration.organization.name, '');
assert.deepEqual(registration.verification, { status: 'self-reported' });
assert.throws(() => createDeploymentRegistrationRecord({ installationId: 'tenant-id', environmentType: 'customer', hosting: 'other' }, now));
assert.throws(() => createImpactStoryRecord({ audience: 'customer', engagementStage: 'evaluation', outcome: 'time-saved', timeSaved: 'unknown', artifacts: [], externalUse: 'none' }, now));
assert.throws(() => createImpactStoryRecord({ audience: 'customer', engagementStage: 'evaluation', outcome: 'time-saved', timeSaved: 'unknown', artifacts: ['diagram'], externalUse: 'customer', nameConsent: true }, now));
assert.throws(() => createImpactStoryRecord({ audience: 'customer', engagementStage: 'evaluation', outcome: 'time-saved', timeSaved: 'unknown', artifacts: ['diagram'], externalUse: 'customer', contactConsent: true, contactEmail: 'not-an-email' }, now));

console.log('Impact durable-record contract passed.');

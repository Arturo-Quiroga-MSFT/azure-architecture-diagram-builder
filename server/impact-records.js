const crypto = require('crypto');

const ORGANIZATION_TYPES = ['microsoft', 'microsoft-partner', 'customer', 'independent-community', 'prefer-not-to-say'];
const OUTCOMES = ['time-saved', 'risk-identified', 'design-improved', 'discussion-advanced', 'artifact-delivered', 'implementation-accelerated', 'deployment-completed', 'training-enabled'];
const ENGAGEMENT_STAGES = ['evaluation', 'internal-design', 'customer-workshop', 'architecture-review', 'proposal-presales', 'implementation-planning', 'deployment', 'production'];
const TIME_SAVED = ['unknown', 'under-1-hour', '1-4-hours', 'half-day', 'one-day', 'multiple-days'];
const EXTERNAL_USE = ['none', 'partner', 'customer', 'both'];
const ARTIFACTS = ['diagram', 'validation', 'cost-estimate', 'deployment-guide', 'bicep-terraform', 'mcp-agent-workflow'];
const ENVIRONMENTS = ['microsoft', 'partner', 'customer', 'community'];
const HOSTING = ['local', 'container-apps', 'app-service', 'static-web-apps', 'other'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowed(values, value, field) {
  if (!values.includes(value)) throw new Error(`${field} is invalid`);
  return value;
}

function optionalText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function contactRecord(body, createdAt) {
  const consent = body.contactConsent === true;
  const email = optionalText(body.contactEmail, 254).toLowerCase();
  if (consent && !EMAIL_PATTERN.test(email)) throw new Error('a valid email is required when contact consent is enabled');
  if (!consent) return { consent: false };
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 180);
  return { consent: true, email, consentAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString(), followUpStatus: 'new' };
}

function createImpactStoryRecord(body, now = new Date()) {
  const artifacts = Array.isArray(body.artifacts) ? [...new Set(body.artifacts.filter((item) => ARTIFACTS.includes(item)))].slice(0, ARTIFACTS.length) : [];
  if (artifacts.length === 0) throw new Error('at least one artifact is required');
  const nameConsent = body.nameConsent === true;
  const organizationName = optionalText(body.organizationName, 200);
  if (nameConsent && !organizationName) throw new Error('organization name is required when naming consent is enabled');
  return {
    id: crypto.randomUUID(),
    type: 'impact-story',
    createdAt: now.toISOString(),
    audience: allowed(ORGANIZATION_TYPES, body.audience, 'audience'),
    engagementStage: allowed(ENGAGEMENT_STAGES, body.engagementStage, 'engagementStage'),
    outcome: allowed(OUTCOMES, body.outcome, 'outcome'),
    timeSaved: allowed(TIME_SAVED, body.timeSaved, 'timeSaved'),
    artifacts,
    externalUse: allowed(EXTERNAL_USE, body.externalUse, 'externalUse'),
    narrative: optionalText(body.narrative, 2000),
    sharing: {
      internalConsent: body.internalSharingConsent === true,
      nameConsent,
      organizationName: nameConsent ? organizationName : '',
    },
    contact: contactRecord(body, now),
    verification: { status: 'self-reported' },
  };
}

function createDeploymentRegistrationRecord(body, now = new Date()) {
  if (!UUID_PATTERN.test(String(body.installationId || ''))) throw new Error('installationId must be a random UUID');
  const nameConsent = body.nameConsent === true;
  const organizationName = optionalText(body.organizationName, 200);
  if (nameConsent && !organizationName) throw new Error('organization name is required when naming consent is enabled');
  return {
    id: `deployment-${String(body.installationId).toLowerCase()}`,
    type: 'deployment-registration',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    installationId: String(body.installationId).toLowerCase(),
    environmentType: allowed(ENVIRONMENTS, body.environmentType, 'environmentType'),
    hosting: allowed(HOSTING, body.hosting, 'hosting'),
    region: optionalText(body.region, 80).toLowerCase(),
    appVersion: optionalText(body.appVersion, 80) || 'unknown',
    customerDeployment: body.customerDeployment === true,
    organization: { nameConsent, name: nameConsent ? organizationName : '' },
    contact: contactRecord(body, now),
    verification: { status: 'self-reported' },
  };
}

module.exports = { createImpactStoryRecord, createDeploymentRegistrationRecord };

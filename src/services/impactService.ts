// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export const ORGANIZATION_TYPES = ['microsoft', 'microsoft-partner', 'customer', 'independent-community', 'prefer-not-to-say'] as const;
export const IMPACT_ROLES = ['psa', 'csa', 'cloud-architect', 'partner-architect-consultant', 'developer-engineer', 'security-architect', 'other', 'prefer-not-to-say'] as const;
export const USAGE_SCENARIOS = ['personal-evaluation', 'internal-design', 'customer-workshop', 'architecture-review', 'proposal-presales', 'training-demo', 'implementation-planning', 'production-project'] as const;
export const DEPLOYMENT_MODES = ['public-hosted', 'local-clone', 'organization-deployment', 'customer-tenant-deployment', 'planning-deployment'] as const;
export const OUTCOME_TYPES = ['time-saved', 'risk-identified', 'design-improved', 'discussion-advanced', 'artifact-delivered', 'implementation-accelerated', 'deployment-completed', 'training-enabled'] as const;
export const ENGAGEMENT_STAGES = ['evaluation', 'internal-design', 'customer-workshop', 'architecture-review', 'proposal-presales', 'implementation-planning', 'deployment', 'production'] as const;
export const TIME_SAVED_BANDS = ['unknown', 'under-1-hour', '1-4-hours', 'half-day', 'one-day', 'multiple-days'] as const;
export const EXTERNAL_USE_TYPES = ['none', 'partner', 'customer', 'both'] as const;
export const ARTIFACT_TYPES = ['diagram', 'validation', 'cost-estimate', 'deployment-guide', 'bicep-terraform', 'mcp-agent-workflow'] as const;
export const REGISTRATION_ENVIRONMENTS = ['microsoft', 'partner', 'customer', 'community'] as const;
export const HOSTING_MODES = ['local', 'container-apps', 'app-service', 'static-web-apps', 'other'] as const;

export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];
export type ImpactRole = (typeof IMPACT_ROLES)[number];
export type UsageScenario = (typeof USAGE_SCENARIOS)[number];
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];
export type OutcomeType = (typeof OUTCOME_TYPES)[number];
export type EngagementStage = (typeof ENGAGEMENT_STAGES)[number];
export type TimeSavedBand = (typeof TIME_SAVED_BANDS)[number];
export type ExternalUseType = (typeof EXTERNAL_USE_TYPES)[number];
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
export type RegistrationEnvironment = (typeof REGISTRATION_ENVIRONMENTS)[number];
export type HostingMode = (typeof HOSTING_MODES)[number];

export interface AdoptionProfile {
  organizationType: OrganizationType;
  role: ImpactRole;
  usageScenario: UsageScenario;
  deploymentMode: DeploymentMode;
}

export interface AttributionContext {
  source?: string;
  campaign?: string;
}

export interface ImpactStoryInput {
  audience: OrganizationType;
  engagementStage: EngagementStage;
  outcome: OutcomeType;
  timeSaved: TimeSavedBand;
  artifacts: ArtifactType[];
  externalUse: ExternalUseType;
  narrative?: string;
  internalSharingConsent: boolean;
  nameConsent: boolean;
  organizationName?: string;
  contactConsent: boolean;
  contactEmail?: string;
}

export interface DeploymentRegistrationInput {
  installationId: string;
  environmentType: RegistrationEnvironment;
  hosting: HostingMode;
  region?: string;
  appVersion: string;
  customerDeployment: boolean;
  nameConsent: boolean;
  organizationName?: string;
  contactConsent: boolean;
  contactEmail?: string;
}

const PROFILE_KEY = 'aadb.impact.profile.v1';
const ATTRIBUTION_KEY = 'aadb.impact.attribution.v1';
const INSTALLATION_ID_KEY = 'aadb.impact.installationId.v1';

function isAllowed<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export function sanitizeAttributionValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return normalized || undefined;
}

export function parseAttributionSearch(search: string): AttributionContext {
  const params = new URLSearchParams(search);
  return {
    source: sanitizeAttributionValue(params.get('source') || params.get('utm_source')),
    campaign: sanitizeAttributionValue(params.get('campaign') || params.get('utm_campaign')),
  };
}

export function initializeAttribution(search = window.location.search): AttributionContext {
  const next = parseAttributionSearch(search);

  if (next.source || next.campaign) {
    try {
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
    } catch {
      // sessionStorage can be unavailable in hardened browser contexts.
    }
    return next;
  }

  return getAttribution();
}

export function getAttribution(): AttributionContext {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}') as AttributionContext;
    return {
      source: sanitizeAttributionValue(parsed.source || null),
      campaign: sanitizeAttributionValue(parsed.campaign || null),
    };
  } catch {
    return {};
  }
}

export function getAdoptionProfile(): AdoptionProfile | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') as Partial<AdoptionProfile> | null;
    if (!parsed
      || !isAllowed(ORGANIZATION_TYPES, parsed.organizationType)
      || !isAllowed(IMPACT_ROLES, parsed.role)
      || !isAllowed(USAGE_SCENARIOS, parsed.usageScenario)
      || !isAllowed(DEPLOYMENT_MODES, parsed.deploymentMode)) return undefined;
    return parsed as AdoptionProfile;
  } catch {
    return undefined;
  }
}

export function saveAdoptionProfile(profile: AdoptionProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearAdoptionProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
}

export function getInstallationId(): string {
  try {
    const existing = localStorage.getItem(INSTALLATION_ID_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const installationId = crypto.randomUUID();
    localStorage.setItem(INSTALLATION_ID_KEY, installationId);
    return installationId;
  } catch {
    return crypto.randomUUID();
  }
}

export function getImpactTelemetryContext(): Record<string, string> {
  const profile = getAdoptionProfile();
  const attribution = getAttribution();
  return {
    audienceType: profile?.organizationType || 'not-provided',
    role: profile?.role || 'not-provided',
    usageScenario: profile?.usageScenario || 'not-provided',
    deploymentMode: profile?.deploymentMode || 'not-provided',
    attributionSource: attribution.source || 'direct-or-unknown',
    attributionCampaign: attribution.campaign || 'none',
  };
}

async function submitRecord(path: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function submitImpactStory(input: ImpactStoryInput): Promise<boolean> {
  return submitRecord('/api/impact-story', input);
}

export function submitDeploymentRegistration(input: DeploymentRegistrationInput): Promise<boolean> {
  return submitRecord('/api/deployment-registration', input);
}

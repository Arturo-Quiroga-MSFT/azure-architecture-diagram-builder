import {
  getImpactTelemetryContext,
  initializeAttribution,
  type AdoptionProfile,
  type DeploymentRegistrationInput,
  type ImpactStoryInput,
} from './impactService';
import { setTelemetryContextProvider, trackEvent } from './telemetryService';

export function initializeImpactTelemetry(): void {
  setTelemetryContextProvider(getImpactTelemetryContext);
  const attribution = initializeAttribution();
  if (!attribution.source && !attribution.campaign) return;

  let tracked = false;
  try {
    tracked = sessionStorage.getItem('aadb.impact.attributionTracked.v1') === '1';
  } catch {
    // sessionStorage can be unavailable in hardened browser contexts.
  }
  if (tracked) return;

  trackEvent('Attribution_Observed', {
    source: attribution.source || 'direct-or-unknown',
    campaign: attribution.campaign || 'none',
  });
  try {
    sessionStorage.setItem('aadb.impact.attributionTracked.v1', '1');
  } catch {
    // sessionStorage can be unavailable in hardened browser contexts.
  }
}

export function trackAdoptionProfileSaved(profile: AdoptionProfile): void {
  trackEvent('Adoption_Profile_Saved', {
    organizationType: profile.organizationType,
    role: profile.role,
    usageScenario: profile.usageScenario,
    deploymentMode: profile.deploymentMode,
  });
}

export function trackImpactStorySubmitted(input: ImpactStoryInput, persisted: boolean): void {
  trackEvent('Impact_Story_Submitted', {
    audience: input.audience,
    engagementStage: input.engagementStage,
    outcome: input.outcome,
    timeSaved: input.timeSaved,
    artifacts: input.artifacts.join(','),
    externalUse: input.externalUse,
    internalSharingConsent: String(input.internalSharingConsent),
    nameConsent: String(input.nameConsent),
    contactConsent: String(input.contactConsent),
    persisted: String(persisted),
  }, {
    artifactCount: input.artifacts.length,
  });
}

export function trackDeploymentRegistered(input: DeploymentRegistrationInput, persisted: boolean): void {
  trackEvent('Deployment_Registered', {
    environmentType: input.environmentType,
    hosting: input.hosting,
    region: input.region || 'not-provided',
    appVersion: input.appVersion,
    customerDeployment: String(input.customerDeployment),
    nameConsent: String(input.nameConsent),
    contactConsent: String(input.contactConsent),
    persisted: String(persisted),
  });
}
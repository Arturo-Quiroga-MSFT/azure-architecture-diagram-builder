// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ApplicationInsights, ICustomProperties } from '@microsoft/applicationinsights-web';

/**
 * Application Insights Telemetry Service
 * 
 * Tracks user activity, feature usage, and performance metrics for the
 * Azure Architecture Diagram Builder. Initializes only when a valid
 * connection string is provided via VITE_APPINSIGHTS_CONNECTION_STRING.
 * 
 * Tracked events:
 * - Page views (automatic)
 * - Architecture generation (AI model, prompt length, service count)
 * - Architecture validation (score, pillar scores, model)
 * - Deployment guide generation (service count, model)
 * - Exports (format, service count)
 * - ARM template import
 * - Image/sketch import
 * - Model comparison
 * - Version history (save/restore)
 * - Start fresh / reset
 * - Region changes
 */

let appInsights: ApplicationInsights | null = null;

/**
 * Initialize Application Insights. Call once at app startup.
 * No-ops gracefully if connection string is not configured.
 */
export function initTelemetry(): void {
  const connectionString = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    console.log('ℹ️ Application Insights not configured — telemetry disabled');
    return;
  }

  try {
    appInsights = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true,       // Track SPA page views
        disableFetchTracking: false,         // Track fetch/XHR requests
        enableCorsCorrelation: true,         // Correlate cross-origin requests
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        autoTrackPageVisitTime: true,        // Track how long users spend on page
        disableAjaxTracking: false,
        maxBatchInterval: 5000,              // Send telemetry every 5 seconds
      },
    });

    appInsights.loadAppInsights();
    appInsights.trackPageView({ name: 'Azure Architecture Diagram Builder' });
    console.log('✅ Application Insights initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize Application Insights:', error);
    appInsights = null;
  }
}

/**
 * Track a custom event with optional properties and measurements.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): void {
  if (!appInsights) return;
  appInsights.trackEvent({ name }, { ...properties, ...measurements } as ICustomProperties);
}

/**
 * Track a metric value (e.g., generation time, token count).
 */
export function trackMetric(name: string, average: number, properties?: Record<string, string>): void {
  if (!appInsights) return;
  appInsights.trackMetric({ name, average }, properties as ICustomProperties);
}

// ─── Feature-specific tracking helpers ──────────────────────────────

/**
 * Track architecture generation via AI.
 */
export function trackArchitectureGeneration(params: {
  model?: string;
  reasoningEffort?: string;
  promptLength?: number;
  serviceCount?: number;
  connectionCount?: number;
  groupCount?: number;
  workflowStepCount?: number;
  elapsedTimeMs?: number;
  totalTokens?: number;
  isModification?: boolean;
}): void {
  trackEvent('Architecture_Generated', {
    model: params.model || 'unknown',
    reasoningEffort: params.reasoningEffort || 'default',
    isModification: String(params.isModification ?? false),
  }, {
    promptLength: params.promptLength ?? 0,
    serviceCount: params.serviceCount ?? 0,
    connectionCount: params.connectionCount ?? 0,
    groupCount: params.groupCount ?? 0,
    workflowStepCount: params.workflowStepCount ?? 0,
    elapsedTimeMs: params.elapsedTimeMs ?? 0,
    totalTokens: params.totalTokens ?? 0,
  });
}

/**
 * Track architecture validation.
 */
export function trackValidation(params: {
  model?: string;
  overallScore?: number;
  serviceCount?: number;
  findingCount?: number;
  elapsedTimeMs?: number;
}): void {
  trackEvent('Architecture_Validated', {
    model: params.model || 'unknown',
  }, {
    overallScore: params.overallScore ?? 0,
    serviceCount: params.serviceCount ?? 0,
    findingCount: params.findingCount ?? 0,
    elapsedTimeMs: params.elapsedTimeMs ?? 0,
  });
}

/**
 * Track deployment guide generation.
 */
export function trackDeploymentGuide(params: {
  model?: string;
  serviceCount?: number;
  bicepFileCount?: number;
  elapsedTimeMs?: number;
}): void {
  trackEvent('DeploymentGuide_Generated', {
    model: params.model || 'unknown',
  }, {
    serviceCount: params.serviceCount ?? 0,
    bicepFileCount: params.bicepFileCount ?? 0,
    elapsedTimeMs: params.elapsedTimeMs ?? 0,
  });
}

/**
 * Track diagram exports.
 */
export function trackExport(format: string, serviceCount?: number): void {
  trackEvent('Diagram_Exported', {
    format,
  }, {
    serviceCount: serviceCount ?? 0,
  });
}

/**
 * Track ARM template import.
 */
export function trackARMImport(fileName: string, resourceCount?: number): void {
  trackEvent('ARM_Template_Imported', {
    fileName,
  }, {
    resourceCount: resourceCount ?? 0,
  });
}

/**
 * Track architecture image/sketch import.
 */
export function trackImageImport(): void {
  trackEvent('Image_Imported');
}

/**
 * Track model comparison usage.
 */
export function trackModelComparison(params: {
  modelsCompared?: number;
  selectedModel?: string;
}): void {
  trackEvent('Models_Compared', {
    selectedModel: params.selectedModel || 'none',
  }, {
    modelsCompared: params.modelsCompared ?? 0,
  });
}

/**
 * Track validation recommendation application.
 */
export function trackRecommendationsApplied(recommendationCount: number): void {
  trackEvent('Recommendations_Applied', {}, {
    recommendationCount,
  });
}

/**
 * Track version history operations.
 */
export function trackVersionOperation(operation: 'save' | 'restore' | 'auto-snapshot'): void {
  trackEvent('Version_Operation', { operation });
}

/**
 * Track region change.
 */
export function trackRegionChange(region: string): void {
  trackEvent('Region_Changed', { region });
}

/**
 * Track Start Fresh / reset.
 */
export function trackStartFresh(): void {
  trackEvent('Start_Fresh');
}

/**
 * Get the App Insights instance (for advanced usage).
 */
export function getAppInsights(): ApplicationInsights | null {
  return appInsights;
}

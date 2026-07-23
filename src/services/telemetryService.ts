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
const TELEMETRY_SCHEMA_VERSION = '2.0.0';
const WORKFLOW_ID_KEY = 'aadb.telemetry.workflowId';

function getWorkflowId(): string {
  const existing = sessionStorage.getItem(WORKFLOW_ID_KEY);
  if (existing) return existing;
  const workflowId = crypto.randomUUID();
  sessionStorage.setItem(WORKFLOW_ID_KEY, workflowId);
  return workflowId;
}

function rotateWorkflowId(): void {
  sessionStorage.setItem(WORKFLOW_ID_KEY, crypto.randomUUID());
}

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
 * Properties go to customDimensions (strings), measurements go to
 * customMeasurements (numerics) so KQL toint()/todouble() work correctly.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): void {
  if (!appInsights) return;
  const context = {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    appVersion: import.meta.env.VITE_APP_VERSION || 'development',
    environment: import.meta.env.MODE,
    featureVersion: properties?.featureVersion || '1',
    workflowId: getWorkflowId(),
  };
  appInsights.trackEvent(
    { name, properties: { ...context, ...properties }, measurements },
  );
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

export function trackValidationHandoff(params: {
  action: 'shown' | 'started' | 'dismissed';
  source: 'generation' | 'modification';
  serviceCount: number;
}): void {
  trackEvent('Validation_Handoff', {
    action: params.action,
    source: params.source,
  }, {
    serviceCount: params.serviceCount,
  });
}

/**
 * Track a multi-model validation comparison run. Powers the "best validator
 * model" leaderboard: which models score architectures how, and how strong the
 * cross-model consensus is. `perModel` is a compact JSON blob for offline
 * aggregation via KQL `parse_json()`.
 */
export function trackValidationCompared(params: {
  modelCount: number;
  serviceCount: number;
  connectionCount: number;
  reasoningEffort: string;
  perModel: Array<{ model: string; score: number; findings: number; high: number; critical: number; timeMs: number; tokens: number }>;
  consensusTotal: number;
  consensusHighConfidence: number;
  bestModel?: string;
  bestScore?: number;
}): void {
  trackEvent('Validation_Compared', {
    reasoningEffort: params.reasoningEffort,
    bestModel: params.bestModel || 'unknown',
    perModel: JSON.stringify(params.perModel).slice(0, 8000),
  }, {
    modelCount: params.modelCount,
    serviceCount: params.serviceCount,
    connectionCount: params.connectionCount,
    consensusTotal: params.consensusTotal,
    consensusHighConfidence: params.consensusHighConfidence,
    bestScore: params.bestScore ?? 0,
  });
}

/**
 * Track the AI critique's verdict — the judge model's #1-ranked validator.
 * Aggregated over time, this is the model-leaderboard signal: which model the
 * critique consistently rates the most trustworthy WAF reviewer.
 */
export function trackValidationCritiqueRanked(params: {
  criticModel: string;
  winnerModel: string;
  modelCount: number;
}): void {
  trackEvent('Validation_Critique_Ranked', {
    criticModel: params.criticModel,
    winnerModel: params.winnerModel,
  }, {
    modelCount: params.modelCount,
  });
}

/**
 * Track the WAF gap "topics" of a validation, for product analytics. Aggregated
 * across all validations this reveals which gaps recur (e.g. "no private
 * endpoints", "no DR") so we can prioritize guardrails, secure-by-default
 * starter templates, or "common pitfalls" nudges. `topics` is a compact JSON
 * array of { id, pillar, severity } for KQL `parse_json()` / `mv-expand`.
 */
export function trackValidationFindings(params: {
  source: string; // 'single' | 'consensus'
  model?: string;
  overallScore?: number;
  serviceCount?: number;
  topics: Array<{ id: string; label?: string; pillar: string; severity: string }>;
}): void {
  trackEvent('Validation_Findings', {
    source: params.source,
    model: params.model || 'unknown',
    topics: JSON.stringify(params.topics).slice(0, 6000),
  }, {
    overallScore: params.overallScore ?? 0,
    serviceCount: params.serviceCount ?? 0,
    topicCount: params.topics.length,
    highCount: params.topics.filter(t => t.severity === 'high' || t.severity === 'critical').length,
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
 * Track ARM template import (legacy wrapper).
 */
export function trackARMImport(fileName: string, resourceCount?: number): void {
  trackTemplateImport('arm', fileName, 1, resourceCount);
}

/**
 * Track IaC template import (Bicep, Terraform, or ARM).
 */
export function trackTemplateImport(
  format: string,
  fileName: string,
  fileCount: number,
  resourceCount?: number
): void {
  trackEvent('Template_Imported', {
    format,
    fileName,
  }, {
    fileCount,
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
 * Track Help & Learn panel opens and section views so the usage workbook can
 * report engagement with in-app guidance.
 */
export function trackHelpOpened(section?: string): void {
  trackEvent('Help_Opened', section ? { section } : {});
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
  rotateWorkflowId();
}

/**
 * Track user feedback submitted via the in-app feedback modal.
 * The rating (1-5 sentiment) is sent as both a property (for grouping)
 * and a measurement (for averaging in KQL). The free-text comment is NOT
 * sent to telemetry — it is persisted durably via the /api/feedback
 * endpoint (Cosmos DB) to keep PII out of Application Insights.
 */
export function trackFeedback(params: {
  rating: number;
  category: string;
  hasComment: boolean;
  commentLength: number;
}): void {
  trackEvent('User_Feedback', {
    category: params.category,
    rating: String(params.rating),
    hasComment: String(params.hasComment),
  }, {
    rating: params.rating,
    commentLength: params.commentLength,
  });
}

/**
 * Fallback when durable feedback storage (Cosmos) is unreachable — capture the
 * comment text in App Insights so the feedback isn't silently lost (e.g. when a
 * nightly network policy disables Cosmos public access). Fires a DISTINCT event
 * so a workbook can both surface persistence outages and recover the text. Only
 * the app owner views this telemetry.
 */
export function trackFeedbackPersistFailed(params: {
  rating: number;
  category: string;
  comment: string;
  diagramName?: string;
  model?: string;
  reason?: string;
}): void {
  trackEvent('Feedback_Persist_Failed', {
    category: params.category,
    rating: String(params.rating),
    comment: (params.comment || '').slice(0, 2000),
    diagramName: (params.diagramName || '').slice(0, 200),
    model: (params.model || '').slice(0, 100),
    reason: (params.reason || '').slice(0, 200),
  }, {
    rating: params.rating,
    commentLength: (params.comment || '').length,
  });
}

/**
 * Track AI model usage — fires on every Azure OpenAI call with full
 * model identity and token breakdown. This is the central telemetry
 * event for model/token analytics.
 */
export function trackAIModelUsage(params: {
  model: string;
  operation: string;
  reasoningEffort?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  elapsedTimeMs?: number;
}): void {
  trackEvent('AI_Model_Usage', {
    model: params.model || 'unknown',
    operation: params.operation,
    reasoningEffort: params.reasoningEffort || 'none',
  }, {
    promptTokens: params.promptTokens ?? 0,
    completionTokens: params.completionTokens ?? 0,
    totalTokens: params.totalTokens ?? 0,
    elapsedTimeMs: params.elapsedTimeMs ?? 0,
  });
}

/**
 * Get the App Insights instance (for advanced usage).
 */
export function getAppInsights(): ApplicationInsights | null {
  return appInsights;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Validation Consensus
 *
 * Synthesizes the findings from many models' WAF reviews into a single,
 * confidence-weighted list. The core idea: a finding flagged by most models
 * (e.g. "SQL needs geo-replication") is high-confidence; a finding raised by a
 * single model is exploratory but still surfaced. This turns N noisy opinions
 * into one trustworthy verdict without asking the user to pick a model.
 *
 * Clustering is deterministic and explainable: each finding is matched to a
 * curated Well-Architected "topic" by keyword signature. Findings that match no
 * known topic are grouped by their (normalized) category so model-unique risks
 * are never dropped.
 */

import type { ArchitectureValidation, ValidationFinding } from './architectureValidator.js';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ConfidenceBand = 'high' | 'medium' | 'exploratory';

export interface ConsensusInput {
  /** Display name of the model that produced this validation (e.g. "GPT-5.2"). */
  modelLabel: string;
  validation: ArchitectureValidation;
}

export interface ConsensusFinding {
  topicId: string;
  label: string;
  pillar: string;
  severity: Severity;
  /** Distinct models that flagged this topic. */
  modelCount: number;
  /** Total models that produced a successful review. */
  totalModels: number;
  /** modelCount / totalModels, 0..1. */
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** Display names of the models that flagged this topic. */
  models: string[];
  /** Representative issue text (from the highest-severity, most-detailed finding). */
  issue: string;
  /** Representative remediation. */
  recommendation: string;
  resources: string[];
  /** Total findings across all models that mapped to this topic. */
  occurrences: number;
}

export interface ConsensusResult {
  totalModels: number;
  findings: ConsensusFinding[];
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  exploratoryCount: number;
}

interface Topic {
  id: string;
  label: string;
  pillar: string;
  patterns: string[];
}

// Curated Well-Architected topics with keyword signatures. Order matters:
// more specific topics first so they win over broader ones.
const TOPICS: Topic[] = [
  { id: 'sql-ha', label: 'SQL high availability / geo-replication', pillar: 'Reliability',
    patterns: ['geo-replication', 'geo replication', 'failover group', 'auto-failover', 'single instance', 'single point of failure', 'active geo'] },
  { id: 'backup-dr', label: 'Backup & disaster recovery', pillar: 'Reliability',
    patterns: ['disaster recovery', 'backup', 'point-in-time', 'point in time', 'rpo', 'rto', 'restore', 'recovery plan'] },
  { id: 'zone-redundancy', label: 'Availability zones / zone redundancy', pillar: 'Reliability',
    patterns: ['availability zone', 'zone-redundant', 'zone redundant', 'zonal'] },
  { id: 'multi-region', label: 'Multi-region deployment', pillar: 'Reliability',
    patterns: ['multi-region', 'multi region', 'paired region', 'regional outage', 'region-aware', 'active-active', 'multiple regions', 'second region'] },
  { id: 'private-network', label: 'Private connectivity / network isolation', pillar: 'Security',
    patterns: ['private endpoint', 'private link', 'public exposure', 'publicly accessible', 'network isolation', 'public network access', 'vnet integration', 'service endpoint'] },
  { id: 'secrets', label: 'Secrets management (Key Vault)', pillar: 'Security',
    patterns: ['key vault', 'keyvault', 'secrets management', 'connection string', 'hardcoded', 'store secrets', 'managed secret'] },
  { id: 'managed-identity', label: 'Managed identity / least-privilege RBAC', pillar: 'Security',
    patterns: ['managed identity', 'system-assigned', 'user-assigned', 'rbac', 'least privilege', 'least-privilege', 'role assignment'] },
  { id: 'waf-ddos', label: 'WAF / DDoS protection', pillar: 'Security',
    patterns: ['web application firewall', 'waf policy', ' waf ', 'ddos', 'owasp'] },
  { id: 'encryption', label: 'Encryption in transit / at rest', pillar: 'Security',
    patterns: ['encryption', 'tls', 'at rest', 'in transit', 'cmk', 'customer-managed key', 'https only', 'min tls'] },
  { id: 'caching', label: 'Caching layer (Redis / CDN)', pillar: 'Performance Efficiency',
    patterns: ['cach', 'redis', 'cdn', 'content delivery', 'ttl'] },
  { id: 'global-routing', label: 'Global routing / Front Door strategy', pillar: 'Performance Efficiency',
    patterns: ['front door', 'routing strategy', 'latency-based', 'traffic manager', 'edge', 'global entry', 'health probe'] },
  { id: 'autoscale', label: 'Autoscaling / elasticity', pillar: 'Performance Efficiency',
    patterns: ['autoscale', 'auto-scale', 'scale out', 'scaling rule', 'elasticity', 'scale-out'] },
  { id: 'data-latency', label: 'Global data latency / write routing', pillar: 'Performance Efficiency',
    patterns: ['write latency', 'data latency', 'read replica', 'read routing', 'cosmos db', 'globally distributed data'] },
  { id: 'messaging-resilience', label: 'Message resilience (poison / dead-letter)', pillar: 'Operational Excellence',
    patterns: ['poison message', 'dead-letter', 'dead letter', 'reprocess', 'retry policy', 'message retry', 'idempoten'] },
  { id: 'observability', label: 'Observability (monitoring / alerting)', pillar: 'Operational Excellence',
    patterns: ['monitoring', 'observability', 'alert', 'diagnostic', 'log analytics', 'application insights', 'app insights', 'telemetry', 'dashboard'] },
  { id: 'iac-automation', label: 'IaC / deployment automation', pillar: 'Operational Excellence',
    patterns: ['infrastructure as code', 'bicep', 'terraform', 'ci/cd', 'pipeline', 'deployment automation', 'staging slot', 'blue-green'] },
  { id: 'cost', label: 'Cost optimization / right-sizing', pillar: 'Cost Optimization',
    patterns: ['cost', 'right-size', 'rightsize', 'reserved', 'reservation', 'spend', 'sku tier', 'over-provision', 'savings plan'] },
];

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function normalize(text: string): string {
  return (text || '').toLowerCase();
}

/** Resolve a finding to a topic id + label + pillar. */
function classify(finding: ValidationFinding, pillarName: string): { id: string; label: string; pillar: string } {
  const hay = normalize(`${finding.category} ${finding.issue} ${finding.recommendation}`);
  for (const topic of TOPICS) {
    if (topic.patterns.some(p => hay.includes(p))) {
      return { id: topic.id, label: topic.label, pillar: topic.pillar };
    }
  }
  // Unmatched: keep as a model-unique cluster keyed by normalized category.
  const cat = (finding.category || 'Other').trim();
  return { id: `other:${cat.toLowerCase()}`, label: cat, pillar: pillarName || 'Other' };
}

function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.3) return 'medium';
  return 'exploratory';
}

interface Cluster {
  topicId: string;
  label: string;
  pillar: string;
  models: Set<string>;
  occurrences: number;
  best: { finding: ValidationFinding; rank: number };
}

/**
 * Build a confidence-weighted consensus from multiple models' validations.
 */
export function buildValidationConsensus(inputs: ConsensusInput[]): ConsensusResult {
  const totalModels = inputs.length;
  const clusters = new Map<string, Cluster>();

  for (const { modelLabel, validation } of inputs) {
    if (!validation?.pillars) continue;
    // Track which topics this model already contributed to, so a model that
    // raises two findings on the same topic still only counts once.
    const modelTopics = new Set<string>();
    for (const pillar of validation.pillars) {
      const pillarName = (pillar as { pillar?: string }).pillar ?? 'Other';
      const findings: ValidationFinding[] = (pillar as { findings?: ValidationFinding[] }).findings ?? [];
      for (const finding of findings) {
        const { id, label, pillar: topicPillar } = classify(finding, pillarName);
        let cluster = clusters.get(id);
        if (!cluster) {
          cluster = { topicId: id, label, pillar: topicPillar, models: new Set(), occurrences: 0, best: { finding, rank: -1 } };
          clusters.set(id, cluster);
        }
        cluster.occurrences += 1;
        cluster.models.add(modelLabel);
        modelTopics.add(id);
        // Representative = highest severity, tie-break by longest recommendation.
        const rank = SEVERITY_RANK[finding.severity] * 10000 + (finding.recommendation?.length ?? 0);
        if (rank > cluster.best.rank) {
          cluster.best = { finding, rank };
        }
      }
    }
    void modelTopics;
  }

  const findings: ConsensusFinding[] = [...clusters.values()].map(c => {
    const modelCount = c.models.size;
    const confidence = totalModels > 0 ? modelCount / totalModels : 0;
    return {
      topicId: c.topicId,
      label: c.label,
      pillar: c.pillar,
      severity: c.best.finding.severity,
      modelCount,
      totalModels,
      confidence,
      confidenceBand: bandFor(confidence),
      models: [...c.models].sort(),
      issue: c.best.finding.issue,
      recommendation: c.best.finding.recommendation,
      resources: c.best.finding.resources ?? [],
      occurrences: c.occurrences,
    };
  });

  // Sort: confidence band (high first), then model agreement, then severity.
  const bandRank: Record<ConfidenceBand, number> = { high: 3, medium: 2, exploratory: 1 };
  findings.sort((a, b) =>
    bandRank[b.confidenceBand] - bandRank[a.confidenceBand] ||
    b.modelCount - a.modelCount ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    a.label.localeCompare(b.label),
  );

  return {
    totalModels,
    findings,
    highConfidenceCount: findings.filter(f => f.confidenceBand === 'high').length,
    mediumConfidenceCount: findings.filter(f => f.confidenceBand === 'medium').length,
    exploratoryCount: findings.filter(f => f.confidenceBand === 'exploratory').length,
  };
}

export interface TopicHit {
  id: string;
  label: string;
  pillar: string;
  severity: Severity;
}

/**
 * Classify a single validation's findings into distinct WAF topics (max
 * severity per topic). Used for product analytics: emitting the topics of every
 * validation lets us aggregate which gaps recur across all users.
 */
export function classifyValidationTopics(validation: ArchitectureValidation): TopicHit[] {
  const map = new Map<string, TopicHit>();
  for (const pillar of validation?.pillars ?? []) {
    const pillarName = (pillar as { pillar?: string }).pillar ?? 'Other';
    const findings: ValidationFinding[] = (pillar as { findings?: ValidationFinding[] }).findings ?? [];
    for (const f of findings) {
      const { id, label, pillar: tp } = classify(f, pillarName);
      const existing = map.get(id);
      if (!existing || SEVERITY_RANK[f.severity] > SEVERITY_RANK[existing.severity]) {
        map.set(id, { id, label, pillar: tp, severity: f.severity });
      }
    }
  }
  return [...map.values()];
}

/** Render the consensus as a Markdown section for the comparison report. */
export function renderConsensusMarkdown(consensus: ConsensusResult): string {
  if (consensus.findings.length === 0) return '';
  const lines: string[] = [];
  lines.push('## 🤝 Consensus Findings (confidence-weighted)');
  lines.push('');
  lines.push(`Synthesized from **${consensus.totalModels} models**. Confidence = share of models that flagged each topic.`);
  lines.push('');
  lines.push('| Confidence | Agreement | Severity | Pillar | Topic |');
  lines.push('| --- | --- | --- | --- | --- |');
  const bandIcon: Record<ConfidenceBand, string> = { high: '🟢 High', medium: '🟡 Medium', exploratory: '⚪ Exploratory' };
  for (const f of consensus.findings) {
    lines.push(`| ${bandIcon[f.confidenceBand]} | ${f.modelCount}/${f.totalModels} | ${f.severity.toUpperCase()} | ${f.pillar} | ${f.label} |`);
  }
  lines.push('');
  for (const f of consensus.findings) {
    lines.push(`### ${f.label} — ${bandIcon[f.confidenceBand]} (${f.modelCount}/${f.totalModels})`);
    lines.push(`- **Pillar:** ${f.pillar} · **Severity:** ${f.severity.toUpperCase()}`);
    lines.push(`- **Issue:** ${f.issue}`);
    lines.push(`- **Recommendation:** ${f.recommendation}`);
    if (f.resources.length) lines.push(`- **Resources:** ${f.resources.join(', ')}`);
    lines.push(`- **Flagged by:** ${f.models.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

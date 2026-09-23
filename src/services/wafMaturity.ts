// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * WAF Maturity helpers
 *
 * Converts the internal 0-100 WAF validation scores into qualitative
 * "maturity bands" and produces gaps-identified summaries from findings.
 *
 * Rationale: a bare numeric score can be misinterpreted or read as a
 * judgment of a user's real environment, when in fact the score is a
 * diagram-only, design-time heuristic. Bands + gap counts make the
 * actionable signal (findings) the headline, while the numeric score
 * becomes optional. See DOCS/WAF-PILLAR-MATURITY-VIEW-DESIGN.md.
 *
 * The numeric score model is unchanged — bands are derived, not stored.
 */

import type { ValidationFinding } from './architectureValidator';

export type MaturityBand = 'strong' | 'adequate' | 'developing' | 'early';

export interface MaturityDescriptor {
  band: MaturityBand;
  /** Human-readable, non-judgmental label, e.g. "Adequate, with gaps". */
  label: string;
  /** Single word for tight spaces (e.g. inside the score circle), e.g. "Adequate". */
  short: string;
  /** Color reused from the existing score color scheme for visual continuity. */
  color: string;
}

export type FindingSeverity = ValidationFinding['severity'];

export interface GapsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Band thresholds intentionally reuse the existing getScoreColor()
 * boundaries (80 / 60 / 40) so banding is consistent with the colors
 * users already see.
 */
const BAND_COLORS: Record<MaturityBand, string> = {
  strong: '#10b981', // Green
  adequate: '#f59e0b', // Yellow
  developing: '#f97316', // Orange
  early: '#ef4444', // Red
};

const BAND_LABELS: Record<MaturityBand, string> = {
  strong: 'Strong alignment',
  adequate: 'Adequate, with gaps',
  developing: 'Developing',
  early: 'Early / needs attention',
};

/** Single-word forms for tight spaces (e.g. inside the score circle). */
const BAND_SHORT_LABELS: Record<MaturityBand, string> = {
  strong: 'Strong',
  adequate: 'Adequate',
  developing: 'Developing',
  early: 'Early',
};

/**
 * Map a 0-100 score to a maturity descriptor.
 */
export function scoreToBand(score: number): MaturityDescriptor {
  let band: MaturityBand;
  if (score >= 80) band = 'strong';
  else if (score >= 60) band = 'adequate';
  else if (score >= 40) band = 'developing';
  else band = 'early';

  return { band, label: BAND_LABELS[band], short: BAND_SHORT_LABELS[band], color: BAND_COLORS[band] };
}

/**
 * Convenience accessor for just the band label.
 */
export function bandLabel(score: number): string {
  return scoreToBand(score).label;
}

/**
 * Count findings grouped by severity.
 */
export function summarizeGaps(findings: ValidationFinding[] = []): GapsSummary {
  const summary: GapsSummary = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    summary.total += 1;
    summary[f.severity] += 1;
  }
  return summary;
}

/**
 * Build a short, human-readable gaps phrase, e.g.
 *   "9 gaps identified (1 critical, 3 high, 5 medium)"
 *   "No gaps identified"
 * Only non-zero severities are listed, in priority order.
 */
export function formatGapsSummary(summary: GapsSummary): string {
  if (summary.total === 0) return 'No gaps identified';

  const parts: string[] = [];
  if (summary.critical) parts.push(`${summary.critical} critical`);
  if (summary.high) parts.push(`${summary.high} high`);
  if (summary.medium) parts.push(`${summary.medium} medium`);
  if (summary.low) parts.push(`${summary.low} low`);

  const noun = summary.total === 1 ? 'gap' : 'gaps';
  return `${summary.total} ${noun} identified (${parts.join(', ')})`;
}

/**
 * Compact per-pillar gaps phrase that omits the total, e.g.
 *   "2 high · 1 medium gap"
 *   "No gaps"
 */
export function formatPillarGaps(summary: GapsSummary): string {
  if (summary.total === 0) return 'No gaps';

  const parts: string[] = [];
  if (summary.critical) parts.push(`${summary.critical} critical`);
  if (summary.high) parts.push(`${summary.high} high`);
  if (summary.medium) parts.push(`${summary.medium} medium`);
  if (summary.low) parts.push(`${summary.low} low`);

  const noun = summary.total === 1 ? 'gap' : 'gaps';
  return `${parts.join(' · ')} ${noun}`;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Validation panel
 *
 * WAF validation results as a canvas-adjacent dock panel rather than a modal.
 * A modal blocked the diagram, so a finding could never point at the resource it
 * was about; docking it is what makes cross-highlighting possible.
 * See DOCS/APP-SHELL-NAVIGATION-PLAN.md.
 */

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info, Download, RefreshCw, Clock, Zap, Database, Cpu, Crosshair } from 'lucide-react';
import { ArchitectureValidation, ValidationFinding, formatValidationReport } from '../services/architectureValidator';
import { generateModelFilename } from '../utils/modelNaming';
import { scoreToBand, summarizeGaps, formatGapsSummary, formatPillarGaps } from '../services/wafMaturity';
import { useValidationDisplayPrefs } from '../stores/validationDisplayStore';
// Also carries the shared .modal-overlay / .modal-content base used by nine other modals.
import './ValidationModal.css';
import './ValidationPanel.css';

interface ValidationPanelProps {
  validation: ArchitectureValidation | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  /** Previous result no longer matches the modified architecture. */
  isStale?: boolean;
  onApplyRecommendations?: (selectedFindings: ValidationFinding[]) => void;
  onRevalidate?: () => void;
  /** Service names a finding affects, for glowing the matching canvas nodes. */
  onHighlightResources?: (resources: string[]) => void;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({
  validation,
  isOpen,
  onClose,
  isLoading,
  isStale,
  onApplyRecommendations,
  onRevalidate,
  onHighlightResources,
}) => {
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  // Findings pinned by clicking Locate; survives mouse-leave so you can pan the canvas.
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [pinnedResources, setPinnedResources] = useState<string[]>([]);
  const [displayPrefs, setDisplayPrefs] = useValidationDisplayPrefs();

  // Lets the right-anchored fixed elements (workflow panel, feedback and impact
  // buttons) offset themselves instead of sitting on top of the dock.
  useEffect(() => {
    document.body.classList.toggle('has-validation-dock', isOpen);
    return () => document.body.classList.remove('has-validation-dock');
  }, [isOpen]);

  if (!isOpen) return null;

  const previewResources = (resources?: string[]) => {
    if (!onHighlightResources) return;
    onHighlightResources(resources && resources.length > 0 ? resources : pinnedResources);
  };

  const restoreHighlight = () => {
    onHighlightResources?.(pinnedResources);
  };

  const togglePin = (key: string, resources: string[]) => {
    const nextPinned = pinnedKey === key ? null : key;
    setPinnedKey(nextPinned);
    const next = nextPinned ? resources : [];
    setPinnedResources(next);
    onHighlightResources?.(next);
  };

  const toggleFinding = (findingKey: string) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingKey)) next.delete(findingKey);
      else next.add(findingKey);
      return next;
    });
  };

  const getAllFindings = (): Array<ValidationFinding & { key: string }> => {
    if (!validation) return [];
    const findings: Array<ValidationFinding & { key: string }> = [];
    validation.pillars.forEach((pillar, pIndex) => {
      pillar.findings.forEach((finding, fIndex) => {
        findings.push({ ...finding, key: `pillar-${pIndex}-${fIndex}` });
      });
    });
    validation.quickWins.forEach((win, wIndex) => {
      findings.push({ ...win, key: `quickwin-${wIndex}` });
    });
    return findings;
  };

  const handleApplyRecommendations = () => {
    const selected = getAllFindings().filter(f => selectedFindings.has(f.key));
    if (onApplyRecommendations && selected.length > 0) {
      setSelectedFindings(new Set());
      onApplyRecommendations(selected);
    }
  };

  const getSeverityIcon = (severity: ValidationFinding['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="severity-icon critical" />;
      case 'high': return <AlertTriangle className="severity-icon high" />;
      case 'medium': return <Info className="severity-icon medium" />;
      case 'low': return <CheckCircle className="severity-icon low" />;
    }
  };

  const handleDownload = () => {
    if (!validation) return;
    const ts = new Date(validation.timestamp).getTime();
    const report = formatValidationReport(validation);

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateModelFilename('architecture-validation', 'md', ts);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (validation.diagramImageDataUrl) {
      const imgLink = document.createElement('a');
      imgLink.href = validation.diagramImageDataUrl;
      imgLink.download = generateModelFilename('architecture-validation-diagram', 'png', ts);
      document.body.appendChild(imgLink);
      imgLink.click();
      document.body.removeChild(imgLink);
    }
  };

  return (
    <aside className="validation-panel" aria-label="Architecture validation">
      <div className="modal-header">
        <h2>🔍 Architecture Validation</h2>
        <div className="modal-header-actions">
          {validation && (
            <label className="score-toggle" title="Show the underlying 0-100 numeric score alongside the maturity band">
              <input
                type="checkbox"
                checked={displayPrefs.showNumericScore}
                onChange={(e) => setDisplayPrefs({ showNumericScore: e.target.checked })}
              />
              <span>Show numeric score</span>
            </label>
          )}
          <button className="modal-close" onClick={onClose} title="Hide">
            <X size={22} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="modal-loading">
          <div className="spinner"></div>
          <div className="loading-content">
            <h3>Analyzing architecture against Azure Well-Architected Framework...</h3>
            <p className="loading-description">
              Running hybrid analysis: instant rule-based checks against {'>'}65 curated WAF rules,
              followed by AI-powered contextual refinement for architecture-specific insights.
            </p>
            <p className="validation-dismiss-hint">
              You may close this panel at any time — once complete, reopen your results using the <strong>Validation Score</strong> button in the toolbar.
            </p>
          </div>
        </div>
      ) : validation ? (
        <>
          <div className="modal-body">
            {isStale && (
              <div className="validation-stale-notice" role="status">
                <AlertTriangle size={18} />
                <span>
                  <strong>Architecture changed.</strong> These results describe the version before recommendations were applied. Revalidate to assess the updated diagram.
                </span>
              </div>
            )}
            <p className="validation-scope-note">
              <strong>Scope:</strong> Designed for <strong>greenfield Azure</strong> designs. This is a
              diagram-only, design-time signal to guide new architectures — not an audit of a deployed
              environment, and not for direct deployment into existing, complex environments without
              further review.
            </p>

            {(() => {
              const overall = scoreToBand(validation.overallScore);
              const allFindings = validation.pillars.flatMap(p => p.findings);
              const gaps = summarizeGaps(allFindings);
              return (
                <div className="validation-score">
                  <div
                    className="score-circle"
                    style={{ background: `conic-gradient(${overall.color} ${validation.overallScore * 3.6}deg, #e5e7eb 0deg)` }}
                    title={displayPrefs.showNumericScore ? undefined : 'Diagram-only, design-time signal — not a deployed-environment audit'}
                  >
                    <div className="score-inner">
                      {displayPrefs.showNumericScore ? (
                        <>
                          <span className="score-value">{validation.overallScore}</span>
                          <span className="score-label">/100</span>
                        </>
                      ) : (
                        <span className="score-band-mark" style={{ color: overall.color }}>{overall.short}</span>
                      )}
                    </div>
                  </div>
                  <div className="score-summary">
                    <h3>Overall Assessment</h3>
                    <div className="maturity-headline">
                      <span className="maturity-band-pill" style={{ borderColor: overall.color, color: overall.color }}>
                        {overall.label}
                      </span>
                      <span className="gaps-summary">{formatGapsSummary(gaps)}</span>
                      {displayPrefs.showNumericScore && (
                        <span className="numeric-score-aside">{validation.overallScore}/100</span>
                      )}
                    </div>
                    <p>{validation.summary}</p>
                    {validation.metrics && (
                      <div className="ai-metrics-validation">
                        <span className="metric">
                          <Clock size={14} />
                          {(validation.metrics.elapsedTimeMs / 1000).toFixed(1)}s
                        </span>
                        <span className="metric">
                          <Zap size={14} />
                          {validation.metrics.promptTokens.toLocaleString()} in → {validation.metrics.completionTokens.toLocaleString()} out ({validation.metrics.totalTokens.toLocaleString()} total)
                        </span>
                        {(validation as any).hybridMetadata && (
                          <span className="metric hybrid-metric">
                            <Database size={14} />
                            {(validation as any).hybridMetadata.localFindings} local rules ({(validation as any).hybridMetadata.localElapsedMs}ms) + AI refinement
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pillars-section">
              <h3>Five Pillars Assessment</h3>
              {validation.pillars.map((pillar, index) => {
                const pillarBand = scoreToBand(pillar.score);
                const pillarGaps = summarizeGaps(pillar.findings);
                return (
                  <div key={index} className="pillar-card">
                    <div className="pillar-header">
                      <h4>{pillar.pillar}</h4>
                      <div className="pillar-assessment">
                        <span className="maturity-band-pill small" style={{ borderColor: pillarBand.color, color: pillarBand.color }}>
                          {pillarBand.label}
                        </span>
                        <span className="pillar-gaps">{formatPillarGaps(pillarGaps)}</span>
                        {displayPrefs.showNumericScore && (
                          <span className="pillar-score" style={{ color: pillarBand.color }}>{pillar.score}/100</span>
                        )}
                      </div>
                    </div>

                    {pillar.findings.length > 0 && (
                      <div className="findings-list">
                        {pillar.findings.map((finding, fIndex) => {
                          const findingKey = `pillar-${index}-${fIndex}`;
                          const isSelected = selectedFindings.has(findingKey);
                          const resources = finding.resources ?? [];
                          const isPinned = pinnedKey === findingKey;

                          return (
                            <div
                              key={fIndex}
                              className={`finding-item severity-${finding.severity} ${isSelected ? 'selected' : ''}${isPinned ? ' pinned' : ''}`}
                              onMouseEnter={() => previewResources(resources)}
                              onMouseLeave={restoreHighlight}
                            >
                              <div className="finding-header">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleFinding(findingKey)}
                                  className="finding-checkbox"
                                />
                                {getSeverityIcon(finding.severity)}
                                <span className="finding-category">{finding.category}</span>
                                <span className={`severity-badge ${finding.severity}`}>{finding.severity}</span>
                                {(finding as any).source && (
                                  <span className={`source-badge ${(finding as any).source}`}>
                                    {(finding as any).source === 'rule-based' ? <Database size={12} /> : <Cpu size={12} />}
                                    {(finding as any).source === 'rule-based' ? 'Rule' : 'AI'}
                                  </span>
                                )}
                              </div>
                              <div className="finding-content">
                                <p className="finding-issue"><strong>Issue:</strong> {finding.issue}</p>
                                <p className="finding-recommendation">
                                  <strong>Recommendation:</strong> {finding.recommendation}
                                </p>
                                {resources.length > 0 && (
                                  <p className="finding-resources">
                                    <strong>Affected:</strong> {resources.join(', ')}
                                    <button
                                      type="button"
                                      className={`finding-locate${isPinned ? ' is-pinned' : ''}`}
                                      onClick={() => togglePin(findingKey, resources)}
                                      title={isPinned ? 'Stop highlighting these on the canvas' : 'Keep these highlighted on the canvas'}
                                      aria-pressed={isPinned}
                                    >
                                      <Crosshair size={13} />
                                      {isPinned ? 'Pinned' : 'Locate'}
                                    </button>
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {validation.quickWins.length > 0 && (
              <div className="quickwins-section">
                <h3>⚡ Quick Wins</h3>
                <div className="quickwins-list">
                  {validation.quickWins.map((win, index) => (
                    <div key={index} className="quickwin-item">
                      <div className="quickwin-header">
                        <CheckCircle className="quickwin-icon" />
                        <span className="quickwin-category">{win.category}</span>
                      </div>
                      <p className="quickwin-recommendation">{win.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleDownload}>
              <Download size={18} />
              Download Report
            </button>
            {onRevalidate && (
              <button className="btn-secondary" onClick={onRevalidate} disabled={!!isLoading} title="Run validation again">
                <RefreshCw size={18} />
                Revalidate
              </button>
            )}
            {selectedFindings.size > 0 && onApplyRecommendations && (
              <button className="btn-success" onClick={handleApplyRecommendations}>
                <RefreshCw size={18} />
                Apply {selectedFindings.size} Recommendation{selectedFindings.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="modal-empty">
          <p>No validation results available.</p>
        </div>
      )}
    </aside>
  );
};

export default ValidationPanel;

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { X, Loader2, Clock, Zap, CheckCircle, AlertCircle, GitCompare, FileJson, FileText, Shield, AlertTriangle, Info } from 'lucide-react';
import { isAzureOpenAIConfigured } from '../services/azureOpenAI';
import { validateArchitecture, ArchitectureValidation, ValidationModelOverride, AIMetrics } from '../services/architectureValidator';
import {
  MODEL_CONFIG,
  ModelType,
  ReasoningEffort,
  getAvailableModels,
  getModelSettings,
} from '../stores/modelSettingsStore';
import './CompareValidationModal.css';

/** Abbreviate model name for filenames */
function abbreviateModelForFile(model: ModelType): string {
  const map: Record<string, string> = {
    'gpt-5.1': 'gpt51', 'gpt-5.2': 'gpt52', 'gpt-5.2-codex': 'gpt52codex',
    'gpt-5.3-codex': 'gpt53codex', 'deepseek-v3.2-speciale': 'deepseek', 'grok-4.1-fast': 'grok41fast',
  };
  return map[model] || 'unknown';
}

/** Build a model suffix like "gpt52-medium" or "deepseek" */
function modelSuffix(model: ModelType, effort: ReasoningEffort): string {
  const abbr = abbreviateModelForFile(model);
  return MODEL_CONFIG[model].isReasoning ? `${abbr}-${effort}` : abbr;
}

interface ValidationComparisonResult {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
  status: 'pending' | 'running' | 'success' | 'error';
  validation?: ArchitectureValidation;
  metrics?: AIMetrics;
  error?: string;
  overallScore?: number;
  totalFindings?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  pillarScores?: { pillar: string; score: number }[];
  quickWinCount?: number;
}

interface CompareValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (validation: ArchitectureValidation) => void;
  /** Current architecture data to validate */
  services: Array<{ name: string; type: string; category: string; description?: string }>;
  connections: Array<{ from: string; to: string; label: string }>;
  groups?: Array<{ name: string; services?: string[] }>;
  architectureDescription?: string;
}

const CompareValidationModal: React.FC<CompareValidationModalProps> = ({
  isOpen, onClose, onApply, services, connections, groups, architectureDescription,
}) => {
  const availableModels = getAvailableModels();
  const currentSettings = getModelSettings();

  const [selectedModels, setSelectedModels] = useState<Set<ModelType>>(() => {
    const initial = new Set<ModelType>();
    availableModels.forEach(m => initial.add(m));
    return initial;
  });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(currentSettings.reasoningEffort);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ValidationComparisonResult[]>([]);

  const toggleModel = (model: ModelType) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) {
        if (next.size > 1) next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };

  const runComparison = async () => {
    if (selectedModels.size === 0 || services.length === 0) return;
    if (!isAzureOpenAIConfigured()) return;

    setIsRunning(true);
    const models = Array.from(selectedModels);

    const initial: ValidationComparisonResult[] = models.map(m => ({
      model: m,
      reasoningEffort: MODEL_CONFIG[m].isReasoning ? reasoningEffort : 'medium',
      status: 'pending',
    }));
    setResults(initial);

    const promises = models.map(async (model, idx) => {
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'running' as const } : r));

      const override: ValidationModelOverride = {
        model,
        reasoningEffort: MODEL_CONFIG[model].isReasoning ? reasoningEffort : 'medium',
      };

      try {
        const result = await validateArchitecture(
          services, connections, groups, architectureDescription, override
        );

        // Count findings by severity
        let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
        const pillarScores: { pillar: string; score: number }[] = [];

        for (const pillar of (result.pillars || [])) {
          pillarScores.push({ pillar: pillar.pillar, score: pillar.score });
          for (const f of (pillar.findings || [])) {
            if (f.severity === 'critical') criticalCount++;
            else if (f.severity === 'high') highCount++;
            else if (f.severity === 'medium') mediumCount++;
            else lowCount++;
          }
        }

        const totalFindings = criticalCount + highCount + mediumCount + lowCount;

        setResults(prev => prev.map((r, i) => i === idx ? {
          ...r,
          status: 'success' as const,
          validation: result,
          metrics: result.metrics,
          overallScore: result.overallScore,
          totalFindings,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          pillarScores,
          quickWinCount: result.quickWins?.length || 0,
        } : r));
      } catch (err: any) {
        setResults(prev => prev.map((r, i) => i === idx ? {
          ...r,
          status: 'error' as const,
          error: err.message || 'Unknown error',
        } : r));
      }
    });

    await Promise.allSettled(promises);
    setIsRunning(false);
  };

  const handleApply = (result: ValidationComparisonResult) => {
    if (result.validation) {
      onApply(result.validation);
      onClose();
    }
  };

  /** Download a single JSON blob */
  const downloadJson = (data: object, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
  };

  /** Download a markdown string as a .md file */
  const downloadMarkdown = (content: string, filename: string) => {
    const uri = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content);
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
  };

  /** Save a single combined comparison report */
  const saveComparisonReport = () => {
    const ts = Date.now();
    const successful = results.filter(r => r.status === 'success');
    const report: Record<string, any> = {
      type: 'validation-comparison',
      timestamp: new Date().toISOString(),
      architectureDescription,
      serviceCount: services.length,
      connectionCount: connections.length,
      reasoningEffort,
      modelCount: successful.length,
      results: {} as Record<string, any>,
    };
    for (const r of successful) {
      const key = modelSuffix(r.model, r.reasoningEffort);
      report.results[key] = {
        model: r.model,
        displayName: MODEL_CONFIG[r.model].displayName,
        metrics: r.metrics,
        overallScore: r.overallScore,
        totalFindings: r.totalFindings,
        criticalCount: r.criticalCount,
        highCount: r.highCount,
        mediumCount: r.mediumCount,
        lowCount: r.lowCount,
        pillarScores: r.pillarScores,
        quickWinCount: r.quickWinCount,
        validation: r.validation,
      };
    }
    downloadJson(report, `validation-comparison-${ts}.json`);
  };

  /** Format the comparison results as a markdown report */
  const formatComparisonAsMarkdown = (): string => {
    const successful = results.filter(r => r.status === 'success');
    const date = new Date().toLocaleString();

    let md = `# 🔍 Architecture Validation Comparison Report\n\n`;
    md += `**Generated:** ${date}\n`;
    md += `**Reasoning Effort:** ${reasoningEffort}\n`;
    md += `**Models Compared:** ${successful.length}\n\n`;

    if (architectureDescription) {
      md += `## Architecture\n\n${architectureDescription}\n\n`;
    }
    md += `**Services:** ${services.length} | **Connections:** ${connections.length}\n\n`;
    md += `---\n\n`;

    // Summary table
    md += `## 📊 Overall Comparison\n\n`;
    md += `| Model | Score | Findings | Critical | High | Medium | Low | Quick Wins | Time | Tokens |\n`;
    md += `|-------|-------|----------|----------|------|--------|-----|------------|------|--------|\n`;
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      const scoreIcon = (r.overallScore || 0) >= 80 ? '🟢' : (r.overallScore || 0) >= 60 ? '🟡' : '🔴';
      const time = r.metrics ? `${(r.metrics.elapsedTimeMs / 1000).toFixed(1)}s` : '-';
      const tokens = r.metrics?.totalTokens?.toLocaleString() || '-';
      const best = r.overallScore === highestScore ? ' ⭐' : '';
      md += `| ${name}${best} | ${scoreIcon} ${r.overallScore}/100 | ${r.totalFindings} | ${r.criticalCount} | ${r.highCount} | ${r.mediumCount} | ${r.lowCount} | ${r.quickWinCount} | ${time} | ${tokens} |\n`;
    }
    md += `\n`;

    // Pillar comparison table
    const allPillars = successful[0]?.pillarScores?.map(p => p.pillar) || [];
    if (allPillars.length > 0) {
      md += `## 🏗️ Pillar Score Comparison\n\n`;
      md += `| Pillar | ${successful.map(r => MODEL_CONFIG[r.model].displayName).join(' | ')} |\n`;
      md += `|--------|${successful.map(() => '------').join('|')}|\n`;
      for (const pillar of allPillars) {
        const scores = successful.map(r => {
          const ps = r.pillarScores?.find(p => p.pillar === pillar);
          const score = ps?.score || 0;
          const icon = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
          return `${icon} ${score}/100`;
        });
        md += `| ${pillar} | ${scores.join(' | ')} |\n`;
      }
      md += `\n`;
    }

    // Performance comparison
    md += `## ⚡ Performance Comparison\n\n`;
    md += `| Model | Elapsed Time | Prompt Tokens | Completion Tokens | Total Tokens |\n`;
    md += `|-------|-------------|---------------|-------------------|--------------|\n`;
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      const time = r.metrics ? `${(r.metrics.elapsedTimeMs / 1000).toFixed(1)}s` : '-';
      const prompt = r.metrics?.promptTokens?.toLocaleString() || '-';
      const completion = r.metrics?.completionTokens?.toLocaleString() || '-';
      const total = r.metrics?.totalTokens?.toLocaleString() || '-';
      const fastest = r.metrics?.elapsedTimeMs === fastestTime ? ' 🏆' : '';
      const cheapest = r.metrics?.totalTokens === leastTokens ? ' 💰' : '';
      md += `| ${name}${fastest}${cheapest} | ${time} | ${prompt} | ${completion} | ${total} |\n`;
    }
    md += `\n`;

    // Detailed findings per model
    md += `---\n\n`;
    md += `## 📋 Detailed Findings by Model\n\n`;
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      md += `### ${name} — Score: ${r.overallScore}/100\n\n`;

      if (r.validation?.summary) {
        md += `**Summary:** ${r.validation.summary}\n\n`;
      }

      for (const pillar of (r.validation?.pillars || [])) {
        if (pillar.findings.length === 0) continue;
        md += `#### ${pillar.pillar} (${pillar.score}/100)\n\n`;
        for (const f of pillar.findings) {
          const emoji: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
          md += `${emoji[f.severity] || '⚪'} **${f.category}** [${f.severity.toUpperCase()}]\n\n`;
          md += `- **Issue:** ${f.issue}\n`;
          md += `- **Recommendation:** ${f.recommendation}\n`;
          if (f.resources && f.resources.length > 0) {
            md += `- **Resources:** ${f.resources.join(', ')}\n`;
          }
          md += `\n`;
        }
      }

      // Quick wins
      if (r.validation?.quickWins && r.validation.quickWins.length > 0) {
        md += `#### ⚡ Quick Wins\n\n`;
        for (const qw of r.validation.quickWins) {
          md += `- **${qw.category}:** ${qw.recommendation}\n`;
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }

    // Footer
    md += `*Report generated by Azure Architecture Diagram Builder*  \n`;
    md += `*Powered by Azure OpenAI and Azure Well-Architected Framework*  \n`;
    md += `*Generated: ${date}*\n`;

    return md;
  };

  /** Save comparison report as markdown */
  const saveComparisonReportMd = () => {
    const ts = Date.now();
    const md = formatComparisonAsMarkdown();
    downloadMarkdown(md, `validation-comparison-${ts}.md`);
  };

  const completedCount = results.filter(r => r.status === 'success' || r.status === 'error').length;
  const hasResults = results.length > 0;

  const successResults = results.filter(r => r.status === 'success');
  const highestScore = successResults.length > 0
    ? Math.max(...successResults.map(r => r.overallScore || 0))
    : 0;
  const fastestTime = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.elapsedTimeMs || Infinity))
    : 0;
  const leastTokens = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.totalTokens || Infinity))
    : 0;
  const mostFindings = successResults.length > 0
    ? Math.max(...successResults.map(r => r.totalFindings || 0))
    : 0;

  if (!isOpen) return null;

  const scoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const scoreLabel = (score: number) => {
    if (score >= 80) return '🟢';
    if (score >= 60) return '🟡';
    return '🔴';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compare-modal cv-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header cv-header">
          <div className="modal-title">
            <Shield size={20} />
            <h2>Compare Validation Across Models</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="compare-modal-body">
          {/* Architecture summary */}
          <div className="compare-section cv-arch-summary">
            <h3 className="compare-section-title">
              <Info size={16} />
              Architecture Being Validated
            </h3>
            <div className="cv-arch-info">
              <span className="cv-arch-stat">{services.length} services</span>
              <span className="cv-arch-dot">•</span>
              <span className="cv-arch-stat">{connections.length} connections</span>
              <span className="cv-arch-dot">•</span>
              <span className="cv-arch-stat">{groups?.length || 0} groups</span>
              {architectureDescription && (
                <>
                  <span className="cv-arch-dot">•</span>
                  <span className="cv-arch-desc">{architectureDescription.slice(0, 80)}{architectureDescription.length > 80 ? '...' : ''}</span>
                </>
              )}
            </div>
          </div>

          {/* Model Selection */}
          <div className="compare-section">
            <h3 className="compare-section-title">Select Models to Compare</h3>
            <div className="compare-model-grid">
              {availableModels.map(model => {
                const config = MODEL_CONFIG[model];
                const isSelected = selectedModels.has(model);
                return (
                  <button
                    key={model}
                    className={`compare-model-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleModel(model)}
                    disabled={isRunning}
                    title={config.description}
                  >
                    <span className="compare-model-chip-name">{config.displayName}</span>
                    {config.isReasoning && <span className="compare-model-chip-tag">reasoning</span>}
                  </button>
                );
              })}
            </div>

            {Array.from(selectedModels).some(m => MODEL_CONFIG[m].isReasoning) && (
              <div className="compare-reasoning-row">
                <span>Reasoning Effort (for reasoning models):</span>
                <div className="compare-reasoning-buttons">
                  {(['none', 'low', 'medium', 'high'] as ReasoningEffort[]).map(level => (
                    <button
                      key={level}
                      className={`compare-reasoning-btn ${reasoningEffort === level ? 'active' : ''}`}
                      onClick={() => setReasoningEffort(level)}
                      disabled={isRunning}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Run Button */}
          {!hasResults && (
            <button
              className="btn btn-primary compare-run-btn"
              onClick={runComparison}
              disabled={isRunning || services.length === 0 || selectedModels.size < 2}
            >
              <GitCompare size={18} />
              Compare Validation Across {selectedModels.size} Models
            </button>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="compare-progress">
              <Loader2 size={16} className="spinner" />
              <span>Validating with {completedCount}/{results.length} models...</span>
            </div>
          )}

          {/* Results Grid */}
          {hasResults && (
            <div className="compare-section">
              <h3 className="compare-section-title">
                Validation Results
                {!isRunning && successResults.length > 0 && (
                  <div className="compare-save-actions">
                    <button
                      className="compare-save-btn compare-save-report-btn"
                      onClick={saveComparisonReport}
                      title="Download a single JSON with all validation results for analysis"
                    >
                      <FileJson size={14} />
                      Save JSON
                    </button>
                    <button
                      className="compare-save-btn compare-save-report-btn"
                      onClick={saveComparisonReportMd}
                      title="Download a formatted markdown report of the comparison"
                    >
                      <FileText size={14} />
                      Save Markdown
                    </button>
                  </div>
                )}
                {!isRunning && (
                  <button
                    className="compare-rerun-btn"
                    onClick={() => { setResults([]); }}
                    title="Clear results and try again"
                  >
                    New Comparison
                  </button>
                )}
              </h3>

              <div className="compare-results-grid">
                {results.map((result, idx) => (
                  <div key={idx} className={`compare-result-card ${result.status}`}>
                    <div className="compare-result-header">
                      <span className="compare-result-model">{MODEL_CONFIG[result.model].displayName}</span>
                      {result.status === 'running' && <Loader2 size={14} className="spinner" />}
                      {result.status === 'success' && <CheckCircle size={14} className="compare-icon-success" />}
                      {result.status === 'error' && <AlertCircle size={14} className="compare-icon-error" />}
                    </div>

                    {result.status === 'pending' && (
                      <div className="compare-result-pending">Waiting...</div>
                    )}

                    {result.status === 'running' && (
                      <div className="compare-result-running">Validating...</div>
                    )}

                    {result.status === 'error' && (
                      <div className="compare-result-error-msg">{result.error}</div>
                    )}

                    {result.status === 'success' && result.metrics && (
                      <>
                        {/* Overall WAF Score */}
                        <div className={`cv-score-display ${result.overallScore === highestScore ? 'cv-score-best' : ''}`}>
                          <div className="cv-score-circle" style={{ borderColor: scoreColor(result.overallScore || 0) }}>
                            <span className="cv-score-value">{result.overallScore}</span>
                            <span className="cv-score-label">/ 100</span>
                          </div>
                          {result.overallScore === highestScore && (
                            <span className="compare-badge cv-badge-score">Best Score</span>
                          )}
                        </div>

                        {/* Pillar Scores */}
                        <div className="cv-pillar-grid">
                          {result.pillarScores?.map((p, i) => (
                            <div key={i} className="cv-pillar-item">
                              <span className="cv-pillar-score" style={{ color: scoreColor(p.score) }}>
                                {scoreLabel(p.score)} {p.score}
                              </span>
                              <span className="cv-pillar-name">{p.pillar}</span>
                            </div>
                          ))}
                        </div>

                        {/* Finding severity breakdown */}
                        <div className="cv-findings-bar">
                          <div className="cv-findings-header">
                            <AlertTriangle size={13} />
                            <span>{result.totalFindings} findings</span>
                            {result.totalFindings === mostFindings && result.totalFindings! > 0 && (
                              <span className="compare-badge cv-badge-findings">Most Thorough</span>
                            )}
                          </div>
                          <div className="cv-severity-row">
                            {result.criticalCount! > 0 && (
                              <span className="cv-sev cv-sev-critical">{result.criticalCount} critical</span>
                            )}
                            {result.highCount! > 0 && (
                              <span className="cv-sev cv-sev-high">{result.highCount} high</span>
                            )}
                            {result.mediumCount! > 0 && (
                              <span className="cv-sev cv-sev-medium">{result.mediumCount} medium</span>
                            )}
                            {result.lowCount! > 0 && (
                              <span className="cv-sev cv-sev-low">{result.lowCount} low</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Wins */}
                        {result.quickWinCount! > 0 && (
                          <div className="cv-quickwins">
                            ⚡ {result.quickWinCount} quick win{result.quickWinCount! > 1 ? 's' : ''}
                          </div>
                        )}

                        {/* Metrics */}
                        <div className="compare-result-metrics">
                          <div className={`compare-metric ${result.metrics.elapsedTimeMs === fastestTime ? 'highlight' : ''}`}>
                            <Clock size={12} />
                            <span>{(result.metrics.elapsedTimeMs / 1000).toFixed(1)}s</span>
                            {result.metrics.elapsedTimeMs === fastestTime && <span className="compare-badge">Fastest</span>}
                          </div>
                          <div className={`compare-metric ${result.metrics.totalTokens === leastTokens ? 'highlight' : ''}`}>
                            <Zap size={12} />
                            <span>{result.metrics.totalTokens?.toLocaleString()} tokens</span>
                            {result.metrics.totalTokens === leastTokens && <span className="compare-badge">Cheapest</span>}
                          </div>
                        </div>

                        {/* Token breakdown */}
                        <div className="compare-result-tokens">
                          <span>{result.metrics.promptTokens?.toLocaleString()} in</span>
                          <span>→</span>
                          <span>{result.metrics.completionTokens?.toLocaleString()} out</span>
                        </div>

                        {/* Apply button */}
                        <button
                          className="btn btn-primary compare-apply-btn"
                          onClick={() => handleApply(result)}
                        >
                          <Shield size={14} />
                          Use This Validation
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompareValidationModal;

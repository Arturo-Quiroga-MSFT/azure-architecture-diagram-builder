import React, { useState } from 'react';
import { X, Sparkles, Loader2, Clock, Zap, CheckCircle, AlertCircle, GitCompare } from 'lucide-react';
import { generateArchitectureWithAI, isAzureOpenAIConfigured, AIMetrics, ModelOverride } from '../services/azureOpenAI';
import {
  MODEL_CONFIG,
  ModelType,
  ReasoningEffort,
  getAvailableModels,
  getModelSettings,
} from '../stores/modelSettingsStore';
import './CompareModelsModal.css';

interface ComparisonResult {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
  status: 'pending' | 'running' | 'success' | 'error';
  architecture?: any;
  metrics?: AIMetrics;
  error?: string;
  serviceCount?: number;
  connectionCount?: number;
  groupCount?: number;
  workflowSteps?: number;
}

interface CompareModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (architecture: any, prompt: string) => void;
}

const CompareModelsModal: React.FC<CompareModelsModalProps> = ({ isOpen, onClose, onApply }) => {
  const availableModels = getAvailableModels();
  const currentSettings = getModelSettings();
  
  const [selectedModels, setSelectedModels] = useState<Set<ModelType>>(() => {
    const initial = new Set<ModelType>();
    availableModels.forEach(m => initial.add(m));
    return initial;
  });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(currentSettings.reasoningEffort);
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);

  const toggleModel = (model: ModelType) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) {
        if (next.size > 1) next.delete(model); // keep at least 1
      } else {
        next.add(model);
      }
      return next;
    });
  };

  const runComparison = async () => {
    if (!prompt.trim() || selectedModels.size === 0) return;
    if (!isAzureOpenAIConfigured()) return;

    setIsRunning(true);
    const models = Array.from(selectedModels);

    // Initialize results
    const initial: ComparisonResult[] = models.map(m => ({
      model: m,
      reasoningEffort: MODEL_CONFIG[m].isReasoning ? reasoningEffort : 'medium',
      status: 'pending',
    }));
    setResults(initial);

    // Run all models in parallel
    const promises = models.map(async (model, idx) => {
      // Mark as running
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'running' as const } : r));

      const override: ModelOverride = {
        model,
        reasoningEffort: MODEL_CONFIG[model].isReasoning ? reasoningEffort : 'medium',
      };

      try {
        const result = await generateArchitectureWithAI(prompt, override);
        const arch = result;
        const metrics: AIMetrics = result.metrics;

        const serviceCount = arch.services?.length || 0;
        const connectionCount = arch.connections?.length || 0;
        const groupCount = arch.groups?.length || 0;
        const workflowSteps = arch.workflow?.length || 0;

        setResults(prev => prev.map((r, i) => i === idx ? {
          ...r,
          status: 'success' as const,
          architecture: arch,
          metrics,
          serviceCount,
          connectionCount,
          groupCount,
          workflowSteps,
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

  const handleApply = (result: ComparisonResult) => {
    if (result.architecture) {
      onApply(result.architecture, prompt);
      onClose();
    }
  };

  const completedCount = results.filter(r => r.status === 'success' || r.status === 'error').length;
  const hasResults = results.length > 0;

  // Find best metrics for highlighting
  const successResults = results.filter(r => r.status === 'success');
  const fastestTime = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.elapsedTimeMs || Infinity))
    : 0;
  const leastTokens = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.totalTokens || Infinity))
    : 0;
  const mostServices = successResults.length > 0
    ? Math.max(...successResults.map(r => r.serviceCount || 0))
    : 0;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <GitCompare size={20} />
            <h2>Compare Models</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="compare-modal-body">
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

            {/* Reasoning effort for reasoning models */}
            {Array.from(selectedModels).some(m => MODEL_CONFIG[m].isReasoning) && (
              <div className="compare-reasoning-row">
                <span>Reasoning Effort (for reasoning models):</span>
                <div className="compare-reasoning-buttons">
                  {(['low', 'medium', 'high'] as ReasoningEffort[]).map(level => (
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

          {/* Prompt */}
          <div className="compare-section">
            <h3 className="compare-section-title">Architecture Prompt</h3>
            <textarea
              className="compare-prompt"
              placeholder="Describe the Azure architecture you want to compare across models..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              disabled={isRunning}
            />
          </div>

          {/* Run Button */}
          {!hasResults && (
            <button
              className="btn btn-primary compare-run-btn"
              onClick={runComparison}
              disabled={isRunning || !prompt.trim() || selectedModels.size < 2}
            >
              <GitCompare size={18} />
              Compare {selectedModels.size} Models
            </button>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="compare-progress">
              <Loader2 size={16} className="spinner" />
              <span>Running {completedCount}/{results.length} models...</span>
            </div>
          )}

          {/* Results Grid */}
          {hasResults && (
            <div className="compare-section">
              <h3 className="compare-section-title">
                Results
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
                      <div className="compare-result-running">Generating...</div>
                    )}

                    {result.status === 'error' && (
                      <div className="compare-result-error-msg">{result.error}</div>
                    )}

                    {result.status === 'success' && result.metrics && (
                      <>
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

                        {/* Architecture Stats */}
                        <div className="compare-result-stats">
                          <div className={`compare-stat ${result.serviceCount === mostServices ? 'highlight' : ''}`}>
                            <span className="compare-stat-value">{result.serviceCount}</span>
                            <span className="compare-stat-label">Services</span>
                          </div>
                          <div className="compare-stat">
                            <span className="compare-stat-value">{result.connectionCount}</span>
                            <span className="compare-stat-label">Connections</span>
                          </div>
                          <div className="compare-stat">
                            <span className="compare-stat-value">{result.groupCount}</span>
                            <span className="compare-stat-label">Groups</span>
                          </div>
                          <div className="compare-stat">
                            <span className="compare-stat-value">{result.workflowSteps}</span>
                            <span className="compare-stat-label">Workflow Steps</span>
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
                          <Sparkles size={14} />
                          Use This Architecture
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

export default CompareModelsModal;

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model settings controls
 *
 * The body of the model settings UI, shared by the toolbar popover and the
 * Settings pane so the two cannot drift. All state lives in modelSettingsStore,
 * so both surfaces stay in sync automatically.
 */

import { Brain, RotateCcw, Cpu, Layers, Sparkles, Zap } from 'lucide-react';
import {
  useModelSettings,
  MODEL_CONFIG,
  ModelType,
  ReasoningEffort,
  FeatureType,
  FEATURE_CONFIG,
  getAvailableModels,
  updateFeatureOverride,
  hasFeatureOverride,
} from '../stores/modelSettingsStore';
import './ModelSettingsPopover.css';

export function getModelIcon(model: ModelType) {
  switch (model) {
    case 'gpt-5.1': return <Cpu size={14} />;
    case 'gpt-5.2': return <Brain size={14} />;
    case 'gpt-5.6-sol': return <Brain size={14} />;
    case 'gpt-5.6-terra': return <Brain size={14} />;
    case 'gpt-5.6-luna': return <Brain size={14} />;
    case 'deepseek-v3.2-speciale': return <Layers size={14} />;
    case 'grok-4.1-fast': return <Zap size={14} />;
    case 'gpt-5.4-mini': return <Sparkles size={14} />;
  }
}

export function ModelSettingsControls() {
  const [settings, updateSettings] = useModelSettings();
  const availableModels = getAvailableModels();
  const currentConfig = MODEL_CONFIG[settings.model];
  const hasAnyOverride = (Object.keys(FEATURE_CONFIG) as FeatureType[]).some(hasFeatureOverride);

  const handleModelChange = (model: ModelType) => {
    const config = MODEL_CONFIG[model];
    if (config.defaultReasoningEffort !== undefined) {
      updateSettings({ model, reasoningEffort: config.defaultReasoningEffort });
    } else {
      const currentEffort = settings.reasoningEffort;
      if (!config.isReasoning || (currentEffort === 'none' && !config.defaultReasoningEffort)) {
        updateSettings({ model, reasoningEffort: 'medium' });
      } else {
        updateSettings({ model });
      }
    }
  };

  const handleFeatureModelChange = (feature: FeatureType, value: string) => {
    if (value === 'default') {
      updateFeatureOverride(feature, null);
    } else {
      const model = value as ModelType;
      const currentOverride = settings.featureOverrides?.[feature];
      updateFeatureOverride(feature, { model, reasoningEffort: currentOverride?.reasoningEffort });
    }
  };

  const handleFeatureReasoningChange = (feature: FeatureType, value: ReasoningEffort) => {
    const currentOverride = settings.featureOverrides?.[feature];
    if (currentOverride) {
      updateFeatureOverride(feature, { ...currentOverride, reasoningEffort: value });
    }
  };

  const getEffectiveModel = (feature: FeatureType): ModelType => {
    const override = settings.featureOverrides?.[feature];
    return override ? override.model : settings.model;
  };

  const getEffectiveReasoning = (feature: FeatureType): ReasoningEffort | null => {
    if (!MODEL_CONFIG[getEffectiveModel(feature)].isReasoning) return null;
    return settings.featureOverrides?.[feature]?.reasoningEffort || settings.reasoningEffort;
  };

  return (
    <>
      <div className="toolbar-dropdown-heading">Default Model</div>
      <div className="msp-model-buttons">
        {availableModels.map((model) => (
          <button
            key={model}
            className={`msp-model-btn ${settings.model === model ? 'active' : ''}`}
            onClick={() => handleModelChange(model)}
            title={MODEL_CONFIG[model].description}
          >
            {getModelIcon(model)}
            <span>{MODEL_CONFIG[model].displayName}</span>
          </button>
        ))}
      </div>

      {currentConfig.isReasoning && (
        <div className="msp-reasoning-row">
          <span className="msp-reasoning-label">Reasoning</span>
          <div className="msp-reasoning-buttons">
            {(['none', 'low', 'medium', 'high'] as ReasoningEffort[]).map((level) => (
              <button
                key={level}
                className={`msp-reasoning-btn ${settings.reasoningEffort === level ? 'active' : ''}`}
                onClick={() => updateSettings({ reasoningEffort: level })}
                title={level === 'none' ? 'No reasoning - fastest response' : undefined}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="toolbar-dropdown-separator" role="separator" />

      <div className="toolbar-dropdown-heading">
        Per-Feature Settings
        {hasAnyOverride && (
          <button
            className="msp-reset-btn"
            onClick={() => updateSettings({ featureOverrides: {} })}
            title="Reset all to default"
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      <div className="msp-features">
        {(Object.keys(FEATURE_CONFIG) as FeatureType[]).map((feature) => {
          const override = settings.featureOverrides?.[feature];
          const currentModel = override ? override.model : 'default';
          const isOverridden = currentModel !== 'default';
          const selectedModelConfig = isOverridden ? MODEL_CONFIG[currentModel as ModelType] : null;
          const effectiveModel = getEffectiveModel(feature);
          const effectiveReasoning = getEffectiveReasoning(feature);

          return (
            <div key={feature} className={`msp-feature-row ${isOverridden ? 'overridden' : ''}`}>
              <div className="msp-feature-info">
                <span className="msp-feature-name">{FEATURE_CONFIG[feature].displayName}</span>
                <span className="msp-feature-effective">
                  {MODEL_CONFIG[effectiveModel].displayName}
                  {effectiveReasoning && ` (${effectiveReasoning})`}
                </span>
              </div>
              <div className="msp-feature-controls">
                <select
                  value={currentModel}
                  onChange={(e) => handleFeatureModelChange(feature, e.target.value)}
                  className="msp-feature-select"
                >
                  <option value="default">Default</option>
                  {availableModels.map((model) => (
                    <option key={model} value={model}>{MODEL_CONFIG[model].displayName}</option>
                  ))}
                </select>

                {isOverridden && selectedModelConfig?.isReasoning && (
                  <select
                    value={override?.reasoningEffort || settings.reasoningEffort}
                    onChange={(e) => handleFeatureReasoningChange(feature, e.target.value as ReasoningEffort)}
                    className="msp-reasoning-select"
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Med</option>
                    <option value="high">High</option>
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="toolbar-dropdown-separator" role="separator" />

      <div className="toolbar-dropdown-hint">
        Recommended: GPT-5.2 (medium) for generation, GPT-5.1 (none) for fast tasks
      </div>
    </>
  );
}

export default ModelSettingsControls;

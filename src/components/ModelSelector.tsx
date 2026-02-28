// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model Selector Component
 * Allows users to select AI model and reasoning effort level
 * Includes Advanced section for per-feature model overrides
 */

import React, { useState } from 'react';
import { Settings, Brain, ChevronDown, ChevronRight, RotateCcw, Cpu, Layers, Zap } from 'lucide-react';
import { 
  useModelSettings, 
  MODEL_CONFIG, 
  ModelType, 
  ReasoningEffort,
  FeatureType,
  FEATURE_CONFIG,
  getAvailableModels,
  updateFeatureOverride,
  hasFeatureOverride
} from '../stores/modelSettingsStore';
import './ModelSelector.css';

interface ModelSelectorProps {
  compact?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ compact = false }) => {
  const [settings, updateSettings] = useModelSettings();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const availableModels = getAvailableModels();
  
  const currentConfig = MODEL_CONFIG[settings.model];
  
  // Check if any feature has overrides
  const hasAnyOverride = (Object.keys(FEATURE_CONFIG) as FeatureType[]).some(hasFeatureOverride);
  
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ model: e.target.value as ModelType });
  };
  
  const handleReasoningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ reasoningEffort: e.target.value as ReasoningEffort });
  };

  const handleFeatureModelChange = (feature: FeatureType, value: string) => {
    if (value === 'default') {
      updateFeatureOverride(feature, null);
    } else {
      const model = value as ModelType;
      const currentOverride = settings.featureOverrides?.[feature];
      updateFeatureOverride(feature, {
        model,
        reasoningEffort: currentOverride?.reasoningEffort
      });
    }
  };

  const handleFeatureReasoningChange = (feature: FeatureType, value: ReasoningEffort) => {
    const currentOverride = settings.featureOverrides?.[feature];
    if (currentOverride) {
      updateFeatureOverride(feature, {
        ...currentOverride,
        reasoningEffort: value
      });
    }
  };

  const resetAllOverrides = () => {
    updateSettings({ featureOverrides: {} });
  };

  const getModelIcon = (model: ModelType) => {
    switch (model) {
      case 'gpt-5.1':
        return <Cpu size={16} />;
      case 'gpt-5.2':
        return <Brain size={16} />;
      case 'deepseek-v3.2-speciale':
        return <Layers size={16} />;
      case 'grok-4.1-fast':
        return <Zap size={16} />;

      default:
        return <Settings size={16} />;
    }
  };

  const getFeatureCurrentModel = (feature: FeatureType): string => {
    const override = settings.featureOverrides?.[feature];
    if (!override) return 'default';
    return override.model;
  };

  const getFeatureCurrentReasoning = (feature: FeatureType): ReasoningEffort => {
    const override = settings.featureOverrides?.[feature];
    return override?.reasoningEffort || settings.reasoningEffort;
  };

  if (compact) {
    return (
      <div className="model-selector compact">
        <div className="model-selector-with-help">
          <div className="model-selector-controls">
            <div className="model-selector-row">
              <select 
                value={settings.model} 
                onChange={handleModelChange}
                className="model-select"
                title={currentConfig.description}
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>
                    {MODEL_CONFIG[model].displayName}
                  </option>
                ))}
              </select>
              
              {currentConfig.isReasoning && (
                <select
                  value={settings.reasoningEffort}
                  onChange={handleReasoningChange}
                  className="reasoning-select"
                  title="Reasoning effort level"
                >
                  <option value="low">Low</option>
                  <option value="medium">Med</option>
                  <option value="high">High</option>
                </select>
              )}
              
              <button
                className={`advanced-toggle-compact ${showAdvanced ? 'expanded' : ''} ${hasAnyOverride ? 'has-overrides' : ''}`}
                onClick={() => setShowAdvanced(!showAdvanced)}
                title="Per-feature model settings"
              >
                <Settings size={14} />
                {hasAnyOverride && <span className="override-dot" />}
              </button>
            </div>
            
            {showAdvanced && (
              <div className="compact-advanced-panel">
                <div className="compact-advanced-header">
                  <span>Per-Feature Model Overrides</span>
                  {hasAnyOverride && (
                    <button className="reset-overrides-compact" onClick={resetAllOverrides} title="Reset all to default">
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
                
                {(Object.keys(FEATURE_CONFIG) as FeatureType[]).map(feature => {
                  const featureConfig = FEATURE_CONFIG[feature];
                  const currentModel = getFeatureCurrentModel(feature);
                  const currentReasoning = getFeatureCurrentReasoning(feature);
                  const isOverridden = currentModel !== 'default';
                  const selectedModelConfig = isOverridden ? MODEL_CONFIG[currentModel as ModelType] : null;
                  
                  return (
                    <div key={feature} className={`compact-feature-row ${isOverridden ? 'overridden' : ''}`}>
                      <span className="compact-feature-label">{featureConfig.displayName}</span>
                      <div className="compact-feature-controls">
                        <select
                          value={currentModel}
                          onChange={(e) => handleFeatureModelChange(feature, e.target.value)}
                          className="compact-feature-select"
                        >
                          <option value="default">Default ({MODEL_CONFIG[settings.model].displayName})</option>
                          {availableModels.map(model => (
                            <option key={model} value={model}>
                              {MODEL_CONFIG[model].displayName}
                            </option>
                          ))}
                        </select>
                        
                        {isOverridden && selectedModelConfig?.isReasoning && (
                          <select
                            value={currentReasoning}
                            onChange={(e) => handleFeatureReasoningChange(feature, e.target.value as ReasoningEffort)}
                            className="compact-reasoning-select"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Med</option>
                            <option value="high">High</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                <div className="compact-advanced-footer">
                  <span className="compact-hint">Rec: {FEATURE_CONFIG.architectureGeneration.recommendedModel} for generation</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="model-help-panel">
            <div className="help-item">
              <span className="help-label">Reasoning:</span>
              <span className="help-text">Low = faster, Med = balanced, High = thorough</span>
            </div>
            <div className="help-item">
              <span className="help-icon"><Settings size={10} /></span>
              <span className="help-text">Click gear for per-feature model overrides</span>
            </div>
            <div className="help-divider" />
            <div className="help-subtitle">Recommended settings (from testing):</div>
            <div className="help-defaults">
              <span>• Architecture: GPT-5.2 (medium)</span>
              <span>• Validation: GPT-5.2 (low)</span>
              <span>• Deployment: GPT-5.2 (medium)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <div className="model-selector-header">
        <Settings size={16} />
        <span>AI Model Settings</span>
      </div>
      
      <div className="model-selector-content">
        <div className="model-selector-group">
          <label className="model-label">Default Model</label>
          <div className="model-buttons">
            {availableModels.map(model => (
              <button
                key={model}
                className={`model-button ${settings.model === model ? 'active' : ''}`}
                onClick={() => updateSettings({ model })}
                title={MODEL_CONFIG[model].description}
              >
                {getModelIcon(model)}
                <span>{MODEL_CONFIG[model].displayName}</span>
              </button>
            ))}
          </div>
          <p className="model-description">{currentConfig.description}</p>
        </div>
        
        {currentConfig.isReasoning && (
          <div className="model-selector-group">
            <label className="model-label">Default Reasoning Effort</label>
            <div className="reasoning-buttons">
              {(['none', 'low', 'medium', 'high'] as ReasoningEffort[]).map(level => (
                <button
                  key={level}
                  className={`reasoning-button ${settings.reasoningEffort === level ? 'active' : ''}`}
                  onClick={() => updateSettings({ reasoningEffort: level })}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
            <p className="reasoning-hint">
              {settings.reasoningEffort === 'none' && 'No reasoning - fastest response, lowest cost'}
              {settings.reasoningEffort === 'low' && 'Faster responses, less detailed analysis'}
              {settings.reasoningEffort === 'medium' && 'Balanced speed and depth'}
              {settings.reasoningEffort === 'high' && 'Thorough analysis, may take longer'}
            </p>
          </div>
        )}

        {/* Advanced Per-Feature Settings */}
        <div className="advanced-section">
          <button 
            className={`advanced-toggle ${showAdvanced ? 'expanded' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Advanced (per-feature)</span>
            {hasAnyOverride && <span className="override-badge">{Object.keys(settings.featureOverrides || {}).length}</span>}
          </button>
          
          {showAdvanced && (
            <div className="advanced-content">
              <p className="advanced-hint">
                Override the default model for specific features. Leave as "Use default" to use the settings above.
              </p>
              
              {(Object.keys(FEATURE_CONFIG) as FeatureType[]).map(feature => {
                const featureConfig = FEATURE_CONFIG[feature];
                const currentModel = getFeatureCurrentModel(feature);
                const currentReasoning = getFeatureCurrentReasoning(feature);
                const isOverridden = currentModel !== 'default';
                const selectedModelConfig = isOverridden ? MODEL_CONFIG[currentModel as ModelType] : null;
                
                return (
                  <div key={feature} className={`feature-override ${isOverridden ? 'active' : ''}`}>
                    <div className="feature-header">
                      <span className="feature-name">{featureConfig.displayName}</span>
                      <span className="feature-desc">{featureConfig.description}</span>
                    </div>
                    <div className="feature-controls">
                      <select
                        value={currentModel}
                        onChange={(e) => handleFeatureModelChange(feature, e.target.value)}
                        className="feature-model-select"
                      >
                        <option value="default">Use default</option>
                        {availableModels.map(model => (
                          <option key={model} value={model}>
                            {MODEL_CONFIG[model].displayName}
                          </option>
                        ))}
                      </select>
                      
                      {isOverridden && selectedModelConfig?.isReasoning && (
                        <select
                          value={currentReasoning}
                          onChange={(e) => handleFeatureReasoningChange(feature, e.target.value as ReasoningEffort)}
                          className="feature-reasoning-select"
                        >
                          <option value="none">None</option>
                          <option value="low">Low</option>
                          <option value="medium">Med</option>
                          <option value="high">High</option>
                        </select>
                      )}
                    </div>
                    <div className="feature-recommended">
                      Recommended: {MODEL_CONFIG[featureConfig.recommendedModel].displayName}
                      {featureConfig.recommendedReasoning && ` (${featureConfig.recommendedReasoning})`}
                    </div>
                  </div>
                );
              })}
              
              {hasAnyOverride && (
                <button className="reset-overrides" onClick={resetAllOverrides}>
                  <RotateCcw size={12} />
                  Reset all to default
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;

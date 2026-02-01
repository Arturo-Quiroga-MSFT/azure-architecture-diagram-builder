/**
 * Model Selector Component
 * Allows users to select AI model and reasoning effort level
 */

import React from 'react';
import { Settings, Zap, Brain, Sparkles } from 'lucide-react';
import { 
  useModelSettings, 
  MODEL_CONFIG, 
  ModelType, 
  ReasoningEffort,
  getAvailableModels 
} from '../stores/modelSettingsStore';
import './ModelSelector.css';

interface ModelSelectorProps {
  compact?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ compact = false }) => {
  const [settings, updateSettings] = useModelSettings();
  const availableModels = getAvailableModels();
  
  const currentConfig = MODEL_CONFIG[settings.model];
  
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ model: e.target.value as ModelType });
  };
  
  const handleReasoningChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({ reasoningEffort: e.target.value as ReasoningEffort });
  };

  const getModelIcon = (model: ModelType) => {
    switch (model) {
      case 'gpt-5.2':
        return <Brain size={16} />;
      case 'gpt-4.1':
        return <Sparkles size={16} />;
      case 'gpt-4.1-mini':
        return <Zap size={16} />;
      default:
        return <Settings size={16} />;
    }
  };

  if (compact) {
    return (
      <div className="model-selector compact">
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
          <label className="model-label">Model</label>
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
            <label className="model-label">Reasoning Effort</label>
            <div className="reasoning-buttons">
              {(['low', 'medium', 'high'] as ReasoningEffort[]).map(level => (
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
              {settings.reasoningEffort === 'low' && 'Faster responses, less detailed analysis'}
              {settings.reasoningEffort === 'medium' && 'Balanced speed and depth'}
              {settings.reasoningEffort === 'high' && 'Thorough analysis, may take longer'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelSelector;

/**
 * Model Settings Store
 * Manages AI model selection and reasoning effort preferences
 * Supports per-feature model overrides for optimal results
 * Persists to localStorage for cross-session consistency
 */

import { useState, useEffect, useCallback } from 'react';

export type ModelType = 'gpt-5.2' | 'gpt-5.2-codex' | 'gpt-4.1' | 'gpt-4.1-mini' | 'deepseek-v3.2-speciale' | 'grok-4-fast-reasoning';
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Feature types that can have independent model settings
 */
export type FeatureType = 'architectureGeneration' | 'validation' | 'deploymentGuide';

/**
 * Per-feature model override settings
 * When undefined, the feature uses the default model settings
 */
export interface FeatureModelOverride {
  model: ModelType;
  reasoningEffort?: ReasoningEffort; // Only used for reasoning models
}

export interface ModelSettings {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
  // Per-feature overrides (optional)
  featureOverrides?: Partial<Record<FeatureType, FeatureModelOverride>>;
}

const STORAGE_KEY = 'azure-diagrams-model-settings';

const DEFAULT_SETTINGS: ModelSettings = {
  model: 'gpt-5.2',
  reasoningEffort: 'medium',
  featureOverrides: {}
};

/**
 * Feature display configuration
 */
export const FEATURE_CONFIG: Record<FeatureType, {
  displayName: string;
  description: string;
  recommendedModel: ModelType;
  recommendedReasoning?: ReasoningEffort;
}> = {
  architectureGeneration: {
    displayName: 'Architecture Generation',
    description: 'Creating Azure architecture diagrams',
    recommendedModel: 'gpt-5.2',
    recommendedReasoning: 'medium'
  },
  validation: {
    displayName: 'Architecture Validation',
    description: 'WAF validation and security analysis',
    recommendedModel: 'gpt-5.2',
    recommendedReasoning: 'low'
  },
  deploymentGuide: {
    displayName: 'Deployment Guide & Bicep',
    description: 'Generating deployment guides and IaC templates',
    recommendedModel: 'gpt-5.2',
    recommendedReasoning: 'medium'
  }
};

/**
 * Model configuration including deployment names and parameters
 */
export const MODEL_CONFIG: Record<ModelType, {
  displayName: string;
  deploymentEnvVar: string;
  isReasoning: boolean;
  maxCompletionTokens: number;
  description: string;
}> = {
  'gpt-5.2': {
    displayName: 'GPT-5.2',
    deploymentEnvVar: 'VITE_AZURE_OPENAI_DEPLOYMENT_GPT52',
    isReasoning: true,
    maxCompletionTokens: 16000,
    description: 'Most capable reasoning model - best for complex architectures'
  },
  'gpt-4.1': {
    displayName: 'GPT-4.1',
    deploymentEnvVar: 'VITE_AZURE_OPENAI_DEPLOYMENT_GPT41',
    isReasoning: false,
    maxCompletionTokens: 10000,
    description: 'Balanced performance and cost'
  },
  'gpt-4.1-mini': {
    displayName: 'GPT-4.1 Mini',
    deploymentEnvVar: 'VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI',
    isReasoning: false,
    maxCompletionTokens: 8000,
    description: 'Fast and economical for simpler tasks'
  },
  'gpt-5.2-codex': {
    displayName: 'GPT-5.2 Codex',
    deploymentEnvVar: 'VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX',
    isReasoning: true,
    maxCompletionTokens: 16000,
    description: 'Optimized for code generation - ideal for Bicep/IaC'
  },
  'deepseek-v3.2-speciale': {
    displayName: 'DeepSeek V3.2',
    deploymentEnvVar: 'VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK',
    isReasoning: false,
    maxCompletionTokens: 16000,
    description: 'Strong structured output at lower cost'
  },
  'grok-4-fast-reasoning': {
    displayName: 'Grok 4 Fast',
    deploymentEnvVar: 'VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST',
    isReasoning: true,
    maxCompletionTokens: 16000,
    description: 'Fast reasoning - good balance of speed and depth'
  }
};

/**
 * Get deployment name for a specific model
 * Each model requires its own deployment env var to be set
 */
export function getDeploymentName(model: ModelType): string {
  const config = MODEL_CONFIG[model];
  
  // Try specific deployment env var for this model
  const specificDeployment = import.meta.env[config.deploymentEnvVar];
  if (specificDeployment) {
    return specificDeployment;
  }
  
  // No fallback - each model needs its own deployment configured
  throw new Error(`No deployment configured for ${config.displayName}. Set ${config.deploymentEnvVar} in your .env file.`);
}

/**
 * Load settings from localStorage
 */
function loadSettings(): ModelSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate model type
      if (parsed.model && MODEL_CONFIG[parsed.model as ModelType]) {
        return {
          model: parsed.model as ModelType,
          reasoningEffort: ['low', 'medium', 'high'].includes(parsed.reasoningEffort) 
            ? parsed.reasoningEffort 
            : DEFAULT_SETTINGS.reasoningEffort,
          featureOverrides: parsed.featureOverrides || {}
        };
      }
    }
  } catch (e) {
    console.warn('Failed to load model settings:', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: ModelSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save model settings:', e);
  }
}

// Global state for non-hook access
let currentSettings: ModelSettings = loadSettings();
const listeners: Set<(settings: ModelSettings) => void> = new Set();

function notifyListeners() {
  listeners.forEach(listener => listener(currentSettings));
}

/**
 * Get current model settings (non-hook version for services)
 */
export function getModelSettings(): ModelSettings {
  return { ...currentSettings };
}

/**
 * Get model settings for a specific feature
 * Returns the feature-specific override if set, otherwise returns default settings
 */
export function getModelSettingsForFeature(feature: FeatureType): { model: ModelType; reasoningEffort: ReasoningEffort } {
  const settings = getModelSettings();
  const override = settings.featureOverrides?.[feature];
  
  if (override) {
    const config = MODEL_CONFIG[override.model];
    return {
      model: override.model,
      // For reasoning models, use override reasoning or fall back to default
      // For non-reasoning models, reasoning effort doesn't matter but include it for consistency
      reasoningEffort: config.isReasoning 
        ? (override.reasoningEffort || settings.reasoningEffort)
        : settings.reasoningEffort
    };
  }
  
  // No override, use default settings
  return {
    model: settings.model,
    reasoningEffort: settings.reasoningEffort
  };
}

/**
 * Update feature-specific model override
 */
export function updateFeatureOverride(feature: FeatureType, override: FeatureModelOverride | null): void {
  const newOverrides = { ...currentSettings.featureOverrides };
  
  if (override === null) {
    delete newOverrides[feature];
  } else {
    newOverrides[feature] = override;
  }
  
  updateModelSettings({ featureOverrides: newOverrides });
}

/**
 * Check if a feature has a custom override set
 */
export function hasFeatureOverride(feature: FeatureType): boolean {
  return !!currentSettings.featureOverrides?.[feature];
}

/**
 * Update model settings (non-hook version for services)
 */
export function updateModelSettings(updates: Partial<ModelSettings>): void {
  currentSettings = { ...currentSettings, ...updates };
  saveSettings(currentSettings);
  notifyListeners();
}

/**
 * React hook for model settings
 * Provides reactive updates when settings change
 */
export function useModelSettings(): [ModelSettings, (updates: Partial<ModelSettings>) => void] {
  const [settings, setSettings] = useState<ModelSettings>(currentSettings);

  useEffect(() => {
    const listener = (newSettings: ModelSettings) => {
      setSettings({ ...newSettings });
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback((updates: Partial<ModelSettings>) => {
    updateModelSettings(updates);
  }, []);

  return [settings, update];
}

/**
 * Check if a model is available (has deployment configured)
 */
export function isModelAvailable(model: ModelType): boolean {
  try {
    getDeploymentName(model);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of available models
 */
export function getAvailableModels(): ModelType[] {
  return (Object.keys(MODEL_CONFIG) as ModelType[]).filter(isModelAvailable);
}

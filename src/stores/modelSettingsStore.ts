/**
 * Model Settings Store
 * Manages AI model selection and reasoning effort preferences
 * Persists to localStorage for cross-session consistency
 */

import { useState, useEffect, useCallback } from 'react';

export type ModelType = 'gpt-5.2' | 'gpt-4.1' | 'gpt-4.1-mini';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ModelSettings {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
}

const STORAGE_KEY = 'azure-diagrams-model-settings';

const DEFAULT_SETTINGS: ModelSettings = {
  model: 'gpt-5.2',
  reasoningEffort: 'medium'
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
            : DEFAULT_SETTINGS.reasoningEffort
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

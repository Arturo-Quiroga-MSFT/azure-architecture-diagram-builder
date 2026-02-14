/**
 * Model naming utilities for file exports
 * Generates consistent model suffixes for comparing outputs across different models
 */

import { getModelSettings, MODEL_CONFIG, ReasoningEffort } from '../stores/modelSettingsStore';

/**
 * Get the model abbreviation from current settings
 * Returns: gpt52, gpt41, gpt41mini
 */
export function getModelAbbreviation(): string {
  const settings = getModelSettings();
  
  switch (settings.model) {
    case 'gpt-5.2':
      return 'gpt52';
    case 'gpt-5.2-codex':
      return 'gpt52codex';
    case 'gpt-4.1':
      return 'gpt41';
    case 'gpt-4.1-mini':
      return 'gpt41mini';
    default:
      return 'unknown';
  }
}

/**
 * Get the current reasoning effort level from settings
 */
export function getReasoningEffort(): ReasoningEffort {
  const settings = getModelSettings();
  return settings.reasoningEffort;
}

/**
 * Check if current model is a reasoning model (GPT-5.2)
 */
export function isReasoningModel(): boolean {
  const settings = getModelSettings();
  return MODEL_CONFIG[settings.model].isReasoning;
}

/**
 * Generate the model suffix for filenames
 * Examples:
 *   - gpt41 (non-reasoning)
 *   - gpt41mini (non-reasoning)
 *   - gpt52-low, gpt52-medium, gpt52-high (reasoning models)
 */
export function getModelSuffix(): string {
  const model = getModelAbbreviation();
  
  if (isReasoningModel()) {
    const reasoning = getReasoningEffort();
    return `${model}-${reasoning}`;
  }
  
  return model;
}

/**
 * Generate a timestamped filename with model suffix
 * @param prefix - The file prefix (e.g., 'azure-diagram', 'architecture-validation')
 * @param extension - The file extension (e.g., 'json', 'md', 'csv')
 * @param timestamp - Optional timestamp, defaults to Date.now()
 * @returns Formatted filename like 'azure-diagram-1768404182370-gpt52-high.json'
 */
export function generateModelFilename(
  prefix: string, 
  extension: string, 
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  const suffix = getModelSuffix();
  return `${prefix}-${ts}-${suffix}.${extension}`;
}

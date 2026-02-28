// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model naming utilities for file exports
 * Generates consistent model suffixes for comparing outputs across different models
 */

import { getModelSettings, MODEL_CONFIG, ModelType, ReasoningEffort } from '../stores/modelSettingsStore';

// Override model info set when a diagram is applied from Compare Models
let _overrideModel: ModelType | null = null;
let _overrideReasoning: ReasoningEffort | null = null;

/**
 * Set a model override for filename generation (used after applying from Compare Models)
 */
export function setSourceModel(model: ModelType, reasoningEffort: ReasoningEffort): void {
  _overrideModel = model;
  _overrideReasoning = reasoningEffort;
}

/**
 * Clear the model override so filenames use the main UI selector again
 */
export function clearSourceModel(): void {
  _overrideModel = null;
  _overrideReasoning = null;
}

function abbreviateModel(model: ModelType): string {
  switch (model) {
    case 'gpt-5.1':
      return 'gpt51';
    case 'gpt-5.2':
      return 'gpt52';
    case 'gpt-5.2-codex':
      return 'gpt52codex';
    case 'gpt-5.3-codex':
      return 'gpt53codex';
    case 'deepseek-v3.2-speciale':
      return 'deepseek';
    case 'grok-4.1-fast':
      return 'grok41fast';

    default:
      return 'unknown';
  }
}

/**
 * Get the model abbreviation from current settings (or override)
 * Returns: gpt51, gpt52, gpt52codex, gpt53codex
 */
export function getModelAbbreviation(): string {
  if (_overrideModel) {
    return abbreviateModel(_overrideModel);
  }
  const settings = getModelSettings();
  return abbreviateModel(settings.model);
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
  const model = _overrideModel || getModelSettings().model;
  return MODEL_CONFIG[model].isReasoning;
}

/**
 * Generate the model suffix for filenames
 * Examples:
 *   - gpt51-none (reasoning off), gpt51-medium (reasoning on)
 *   - gpt52-low, gpt52-medium, gpt52-high (reasoning models)
 */
export function getModelSuffix(): string {
  const model = getModelAbbreviation();
  
  if (isReasoningModel()) {
    const reasoning = _overrideReasoning || getReasoningEffort();
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

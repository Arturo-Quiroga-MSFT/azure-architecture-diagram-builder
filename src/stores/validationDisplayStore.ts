// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Validation display preferences
 *
 * UI-only preferences for how WAF validation results are presented.
 * These are presentation choices, not model parameters, so they live in
 * their own lightweight store. Persists to localStorage.
 *
 * `showNumericScore` controls whether the raw 0-100 score is shown
 * alongside the maturity band. It defaults to OFF so the qualitative
 * band + gaps summary is the headline. See
 * DOCS/WAF-PILLAR-MATURITY-VIEW-DESIGN.md.
 */

import { useState, useEffect } from 'react';

export interface ValidationDisplayPrefs {
  showNumericScore: boolean;
}

const STORAGE_KEY = 'azure-diagrams-validation-display-prefs';

const DEFAULT_PREFS: ValidationDisplayPrefs = {
  showNumericScore: false,
};

function loadPrefs(): ValidationDisplayPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        showNumericScore: typeof parsed.showNumericScore === 'boolean'
          ? parsed.showNumericScore
          : DEFAULT_PREFS.showNumericScore,
      };
    }
  } catch (e) {
    console.warn('Failed to load validation display prefs:', e);
  }
  return { ...DEFAULT_PREFS };
}

function savePrefs(prefs: ValidationDisplayPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save validation display prefs:', e);
  }
}

let currentPrefs: ValidationDisplayPrefs = loadPrefs();
const listeners: Set<(prefs: ValidationDisplayPrefs) => void> = new Set();

function notifyListeners() {
  listeners.forEach(listener => listener(currentPrefs));
}

/** Non-hook accessor for services / non-React callers. */
export function getValidationDisplayPrefs(): ValidationDisplayPrefs {
  return { ...currentPrefs };
}

/** Update one or more display preferences. */
export function updateValidationDisplayPrefs(updates: Partial<ValidationDisplayPrefs>): void {
  currentPrefs = { ...currentPrefs, ...updates };
  savePrefs(currentPrefs);
  notifyListeners();
}

/**
 * React hook for validation display preferences.
 * Provides reactive updates when preferences change in any component.
 */
export function useValidationDisplayPrefs(): [ValidationDisplayPrefs, (updates: Partial<ValidationDisplayPrefs>) => void] {
  const [prefs, setPrefs] = useState<ValidationDisplayPrefs>(currentPrefs);

  useEffect(() => {
    const listener = (newPrefs: ValidationDisplayPrefs) => setPrefs(newPrefs);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [prefs, updateValidationDisplayPrefs];
}

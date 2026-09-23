// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Active shell view
 *
 * Which top-level pane the nav rail is showing. Only `canvas` is implemented
 * today; the rest are placeholders filled in by later steps of
 * DOCS/APP-SHELL-NAVIGATION-PLAN.md.
 *
 * Deliberately NOT persisted: a reload should always land on the canvas rather
 * than restoring someone into an empty Reports pane.
 */

import { useState, useEffect } from 'react';

export type AppView = 'canvas' | 'library' | 'compare' | 'reports' | 'settings';

/** Which comparison the Compare pane is showing. */
export type CompareTab = 'models' | 'validation';

export const DEFAULT_VIEW: AppView = 'canvas';

let currentView: AppView = DEFAULT_VIEW;
const listeners: Set<(view: AppView) => void> = new Set();

/** Non-hook accessor for services / non-React callers. */
export function getAppView(): AppView {
  return currentView;
}

export function setAppView(view: AppView): void {
  if (view === currentView) return;
  currentView = view;
  listeners.forEach(listener => listener(currentView));
}

/** React hook for the active shell view. */
export function useAppView(): [AppView, (view: AppView) => void] {
  const [view, setView] = useState<AppView>(currentView);

  useEffect(() => {
    const listener = (next: AppView) => setView(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [view, setAppView];
}

// Kept alongside the view so a toolbar button can open the pane on a specific tab.
let currentCompareTab: CompareTab = 'models';
const compareTabListeners: Set<(tab: CompareTab) => void> = new Set();

export function setCompareTab(tab: CompareTab): void {
  if (tab === currentCompareTab) return;
  currentCompareTab = tab;
  compareTabListeners.forEach(listener => listener(currentCompareTab));
}

export function useCompareTab(): [CompareTab, (tab: CompareTab) => void] {
  const [tab, setTab] = useState<CompareTab>(currentCompareTab);

  useEffect(() => {
    const listener = (next: CompareTab) => setTab(next);
    compareTabListeners.add(listener);
    return () => {
      compareTabListeners.delete(listener);
    };
  }, []);

  return [tab, setCompareTab];
}

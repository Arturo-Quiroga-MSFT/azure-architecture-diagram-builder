// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Compare pane
 *
 * Two ways to compare across models: generate architectures, or validate the
 * current one. Same activity, so one pane with tabs rather than two rail items.
 *
 * Both tabs stay mounted — each run is long-running and unmounting would kill
 * it. Only one comparison may run at a time; the idle tab's run button is
 * disabled while the other is working.
 */

import { useState, useCallback } from 'react';
import { GitCompare, Shield, Loader2 } from 'lucide-react';
import CompareModelsPane from './CompareModelsPane';
import CompareValidationPane from './CompareValidationPane';
import type { ArchitectureValidation } from '../services/architectureValidator';
import type { ModelType, ReasoningEffort } from '../stores/modelSettingsStore';
import { useCompareTab, type CompareTab } from '../stores/appViewStore';
import './ComparePane.css';

interface ComparePaneProps {
  /** The Compare pane is the visible view. Stays mounted when false so runs
     survive navigating away. */
  isActive: boolean;
  onExit: () => void;
  onApplyArchitecture: (architecture: any, prompt: string, sourceModel?: ModelType, sourceReasoningEffort?: ReasoningEffort) => void;
  onApplyValidation: (validation: ArchitectureValidation) => void;
  onCaptureBatch?: (items: Array<{ architecture: any; prompt: string; filename: string; model: ModelType; reasoningEffort: ReasoningEffort }>) => Promise<void>;
  services: Array<{ name: string; type: string; category: string; description?: string }>;
  connections: Array<{ from: string; to: string; label: string }>;
  groups?: Array<{ name: string; services?: string[] }>;
  architectureDescription?: string;
}

const TABS: Array<{ id: CompareTab; label: string; hint: string; icon: typeof GitCompare }> = [
  { id: 'models', label: 'Generation', hint: 'One brief, several models, side-by-side architectures', icon: GitCompare },
  { id: 'validation', label: 'Validation', hint: 'This diagram reviewed by several models', icon: Shield },
];

export function ComparePane({
  isActive,
  onExit,
  onApplyArchitecture,
  onApplyValidation,
  onCaptureBatch,
  services,
  connections,
  groups,
  architectureDescription,
}: ComparePaneProps) {
  const [tab, setTab] = useCompareTab();
  const [modelsRunning, setModelsRunning] = useState(false);
  const [validationRunning, setValidationRunning] = useState(false);

  const handleModelsRunning = useCallback((r: boolean) => setModelsRunning(r), []);
  const handleValidationRunning = useCallback((r: boolean) => setValidationRunning(r), []);

  return (
    <div className={`compare-pane${isActive ? '' : ' is-hidden'}`}>
      <div className="compare-tabs" role="tablist" aria-label="Comparison type">
        {TABS.map(({ id, label, hint, icon: Icon }) => {
          const running = id === 'models' ? modelsRunning : validationRunning;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`compare-tab${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
              title={hint}
            >
              <Icon size={16} />
              <span>{label}</span>
              {running && <Loader2 size={13} className="compare-tab-spinner" />}
            </button>
          );
        })}
      </div>

      <CompareModelsPane
        isActive={isActive && tab === 'models'}
        onExit={onExit}
        onApply={onApplyArchitecture}
        onCaptureBatch={onCaptureBatch}
        otherRunBlocked={validationRunning}
        onRunningChange={handleModelsRunning}
      />

      <CompareValidationPane
        isActive={isActive && tab === 'validation'}
        onExit={onExit}
        onApply={onApplyValidation}
        otherRunBlocked={modelsRunning}
        onRunningChange={handleValidationRunning}
        services={services}
        connections={connections}
        groups={groups}
        architectureDescription={architectureDescription}
      />
    </div>
  );
}

export default ComparePane;

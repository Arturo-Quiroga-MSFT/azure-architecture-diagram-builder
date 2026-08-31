// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Settings pane
 *
 * Global preferences that never need the diagram visible. Exists because the
 * canvas toolbar is canvas-only, which left dark mode and model configuration
 * unreachable from the other panes. See DOCS/APP-SHELL-NAVIGATION-PLAN.md.
 */

import { Moon, Sun } from 'lucide-react';
import ModelSettingsControls from './ModelSettingsControls';
import { useValidationDisplayPrefs } from '../stores/validationDisplayStore';
import './SettingsPane.css';

interface SettingsPaneProps {
  isDarkMode: boolean;
  onToggleDarkMode: (next: boolean) => void;
}

export function SettingsPane({ isDarkMode, onToggleDarkMode }: SettingsPaneProps) {
  const [validationPrefs, setValidationPrefs] = useValidationDisplayPrefs();

  return (
    <div className="settings-pane">
      <div className="settings-pane-inner">
        <header className="settings-pane-header">
          <h2>Settings</h2>
          <p>Preferences that apply across the whole app.</p>
        </header>

        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Dark mode</span>
              <span className="settings-row-desc">Applies to the canvas, panels and exports.</span>
            </div>
            <button
              type="button"
              className="pane-btn"
              onClick={() => onToggleDarkMode(!isDarkMode)}
              aria-pressed={isDarkMode}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              {isDarkMode ? 'Switch to light' : 'Switch to dark'}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>Validation display</h3>
          <div className="settings-row">
            <div className="settings-row-info">
              <span className="settings-row-label">Show numeric score</span>
              <span className="settings-row-desc">
                Shows the raw 0-100 score next to the maturity band. Off by default, because the
                band and gap counts are the honest headline.
              </span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={validationPrefs.showNumericScore}
                onChange={(e) => setValidationPrefs({ showNumericScore: e.target.checked })}
              />
              <span>{validationPrefs.showNumericScore ? 'On' : 'Off'}</span>
            </label>
          </div>
        </section>

        <section className="settings-section settings-models">
          <h3>AI models</h3>
          <p className="settings-section-hint">
            The same settings as the toolbar model button — changes here apply everywhere.
          </p>
          <div className="settings-models-body">
            <ModelSettingsControls />
          </div>
        </section>
      </div>
    </div>
  );
}

export default SettingsPane;

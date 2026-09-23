// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Reports pane
 *
 * Full-pane home for exports and generated artifacts. Renders the same
 * ExportAction list as the toolbar dropdown, so the two cannot drift.
 *
 * The pane exists because these outputs are documents, not annotations — they
 * do not need the diagram visible. Cost and WAF findings deliberately stay
 * canvas-adjacent. See DOCS/APP-SHELL-NAVIGATION-PLAN.md.
 */

import { FileDown } from 'lucide-react';
import type { ExportBackground } from '../utils/captureCanvas';
import {
  EXPORT_GROUP_LABELS,
  EXPORT_GROUP_ORDER,
  isExportDisabled,
  type ExportAction,
} from '../types/exportActions';
import './ReportsPane.css';

export interface ReportsHistoryItem {
  id: string;
  kind: string;
  fileName: string;
  createdAt: number;
}

interface ReportsPaneProps {
  actions: ExportAction[];
  history: ReportsHistoryItem[];
  formatTimeAgo: (ts: number) => string;
  exportBackground: ExportBackground;
  onExportBackgroundChange: (next: ExportBackground) => void;
  hasDiagram: boolean;
  onGoToCanvas: () => void;
}

export function ReportsPane({
  actions,
  history,
  formatTimeAgo,
  exportBackground,
  onExportBackgroundChange,
  hasDiagram,
  onGoToCanvas,
}: ReportsPaneProps) {
  return (
    <div className="reports-pane">
      <div className="reports-pane-inner">
        <header className="reports-pane-header">
          <h2>Reports &amp; exports</h2>
          <p>Everything this architecture can be turned into. Options that need something first say so.</p>
        </header>

        {!hasDiagram && (
          <div className="reports-empty-banner">
            <span>There is no diagram yet, so most exports are unavailable.</span>
            <button type="button" className="reports-link-btn" onClick={onGoToCanvas}>
              Go to the canvas
            </button>
          </div>
        )}

        <section className="reports-section reports-settings">
          <label htmlFor="reports-export-background">Export background</label>
          <select
            id="reports-export-background"
            value={exportBackground}
            onChange={(event) => onExportBackgroundChange(event.target.value as ExportBackground)}
          >
            <option value="plain">Plain (recommended)</option>
            <option value="dots">Dots</option>
            <option value="grid">Grid</option>
          </select>
          <span className="reports-settings-hint">
            Affects PNG, SVG, animated SVG and PowerPoint captures. The editing canvas stays dotted.
          </span>
        </section>

        {EXPORT_GROUP_ORDER.map((group) => {
          const groupActions = actions.filter((action) => action.group === group);
          if (groupActions.length === 0) return null;
          return (
            <section className="reports-section" key={group}>
              <h3>{EXPORT_GROUP_LABELS[group]}</h3>
              <div className="reports-card-grid">
                {groupActions.map((action) => {
                  const disabled = isExportDisabled(action);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      className="reports-card"
                      disabled={disabled}
                      onClick={action.run}
                    >
                      <span className="reports-card-icon"><action.icon size={20} /></span>
                      <span className="reports-card-body">
                        <span className="reports-card-title">{action.label}</span>
                        <span className="reports-card-desc">{action.description}</span>
                        {disabled && (
                          <span className="reports-card-blocked">{action.disabledReason}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="reports-section">
          <h3>Recent exports</h3>
          {history.length === 0 ? (
            <p className="reports-empty">
              <FileDown size={16} aria-hidden="true" /> Nothing exported yet.
            </p>
          ) : (
            <ul className="reports-history">
              {history.map((item) => (
                <li key={item.id}>
                  <span className="reports-history-file">{item.fileName}</span>
                  <span className="reports-history-meta">
                    {item.kind.toUpperCase()} · {formatTimeAgo(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default ReportsPane;

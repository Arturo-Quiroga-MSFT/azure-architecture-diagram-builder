// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Library pane
 *
 * Saved versions and snapshots. A gallery, not a canvas — by the placement rules
 * in DOCS/APP-SHELL-NAVIGATION-PLAN.md it earns a pane, which is why History and
 * Snapshot no longer sit in the canvas toolbar.
 *
 * Converted from VersionHistoryModal; the inner markup keeps its class names so
 * VersionHistoryModal.css still applies.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, ExternalLink, Trash2, Copy, Camera, RefreshCw } from 'lucide-react';
import { DiagramVersion, getAllVersions, deleteVersion, getVersion } from '../services/versionStorageService';
import './VersionHistoryModal.css';
import './LibraryPane.css';

interface LibraryPaneProps {
  onRestoreVersion: (version: DiagramVersion) => void;
  /** Opens the snapshot form; disabled when there is nothing to snapshot. */
  onSaveSnapshot: () => void;
  canSnapshot: boolean;
  /** Restoring replaces the canvas, so the caller switches back to it. */
  onGoToCanvas: () => void;
  /** Bumped by the caller after a snapshot is saved elsewhere. */
  reloadToken?: number;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(timestamp);
}

const LibraryPane: React.FC<LibraryPaneProps> = ({ onRestoreVersion, onSaveSnapshot, canSnapshot, onGoToCanvas, reloadToken }) => {
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      setVersions(await getAllVersions());
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadVersions(); }, [loadVersions, reloadToken]);

  const handleDelete = async (versionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete this version? This cannot be undone.')) return;
    try {
      await deleteVersion(versionId);
      await loadVersions();
    } catch (error) {
      console.error('Failed to delete version:', error);
      alert('Failed to delete version');
    }
  };

  const handleOpenInNewTab = async (versionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const version = await getVersion(versionId);
      if (!version) { alert('Version not found'); return; }
      const diagramData = {
        nodes: version.nodes,
        edges: version.edges,
        metadata: version.metadata,
        workflow: version.workflow,
        architecturePrompt: version.architecturePrompt,
        titleBlockData: version.titleBlockData,
      };
      const encodedData = btoa(JSON.stringify(diagramData));
      const newTab = window.open(window.location.origin + window.location.pathname + '#version-' + encodedData, '_blank');
      if (!newTab) alert('Please allow pop-ups to open versions in new tabs');
    } catch (error) {
      console.error('Failed to open version:', error);
      alert('Failed to open version in new tab');
    }
  };

  const handleRestore = async (versionId: string) => {
    try {
      const version = await getVersion(versionId);
      if (!version) { alert('Version not found'); return; }
      if (confirm(`Restore this version? Your current diagram will be replaced.\n\nVersion: ${version.diagramName}\nCreated: ${formatDate(version.timestamp)}`)) {
        onRestoreVersion(version);
        onGoToCanvas();
      }
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert('Failed to restore version');
    }
  };

  return (
    <div className="library-pane">
      <div className="library-pane-inner">
        <header className="library-pane-header">
          <div>
            <h2>Library</h2>
            <p>Saved versions and snapshots of your architectures.</p>
          </div>
          <div className="library-header-actions">
            <button
              type="button"
              className="pane-btn"
              onClick={onSaveSnapshot}
              disabled={!canSnapshot}
              title={canSnapshot ? 'Save the current diagram as a snapshot' : 'Create a diagram first'}
            >
              <Camera size={16} />
              Save snapshot
            </button>
            <button type="button" className="pane-btn" onClick={() => void loadVersions()} title="Reload the list">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="version-loading">
            <div className="spinner"></div>
            <p>Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="version-empty">
            <Clock size={48} style={{ opacity: 0.3 }} />
            <p>No versions saved yet</p>
            <p className="version-empty-hint">
              Versions are created automatically when you regenerate an architecture with AI,
              or you can save a snapshot yourself.
            </p>
          </div>
        ) : (
          <>
            <div className="version-count">
              {versions.length} {versions.length === 1 ? 'version' : 'versions'} saved
            </div>
            <div className="version-list">
              {versions.map((version, index) => (
                <div
                  key={version.versionId}
                  className={`version-item ${selectedVersion === version.versionId ? 'selected' : ''}`}
                  onClick={() => setSelectedVersion(version.versionId)}
                >
                  <div className="version-header">
                    <div className="version-title">
                      <h4>{version.diagramName || 'Untitled Diagram'}</h4>
                      {index === 0 && <span className="version-badge latest">Latest</span>}
                      {version.validationScore !== undefined && (
                        <span className="version-badge score" title="Validation Score">
                          {version.validationScore}/100
                        </span>
                      )}
                    </div>
                    <div className="version-actions">
                      <button
                        className="version-action-btn"
                        onClick={(e) => handleOpenInNewTab(version.versionId, e)}
                        title="Open in new tab for comparison"
                      >
                        <ExternalLink size={16} />
                      </button>
                      <button
                        className="version-action-btn delete"
                        onClick={(e) => handleDelete(version.versionId, e)}
                        title="Delete this version"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="version-meta">
                    <span className="version-time" title={formatDate(version.timestamp)}>
                      <Clock size={14} />
                      {formatTimeAgo(version.timestamp)}
                    </span>
                    {version.nodes && <span className="version-stat">{version.nodes.length} services</span>}
                    {version.edges && <span className="version-stat">{version.edges.length} connections</span>}
                  </div>

                  {version.architecturePrompt && (
                    <div className="version-prompt">
                      <strong>Prompt:</strong> {version.architecturePrompt.substring(0, 100)}
                      {version.architecturePrompt.length > 100 && '...'}
                    </div>
                  )}

                  {version.improvementsApplied && version.improvementsApplied.length > 0 && (
                    <div className="version-improvements">
                      <strong>Improvements:</strong>
                      <ul>
                        {version.improvementsApplied.slice(0, 3).map((improvement, i) => (
                          <li key={i}>{improvement}</li>
                        ))}
                        {version.improvementsApplied.length > 3 && (
                          <li>+ {version.improvementsApplied.length - 3} more...</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {version.notes && (
                    <div className="version-notes"><strong>Notes:</strong> {version.notes}</div>
                  )}

                  <div className="version-footer">
                    <button className="btn-restore" onClick={() => handleRestore(version.versionId)}>
                      <Copy size={16} />
                      Restore This Version
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LibraryPane;

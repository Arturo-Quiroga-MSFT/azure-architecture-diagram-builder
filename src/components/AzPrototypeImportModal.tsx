// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useState, useCallback } from 'react';
import { Terminal, Upload, X, AlertCircle, Check } from 'lucide-react';
import { importFromAzPrototype, type ImportResult } from '../services/azPrototypeService';
import './AzPrototypeImportModal.css';

export interface AzPrototypeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the user confirms the import. Receives the parsed architecture. */
  onImport: (result: ImportResult) => void;
}

type ImportStage = 'select' | 'preview' | 'error';

export default function AzPrototypeImportModal({
  isOpen,
  onClose,
  onImport,
}: AzPrototypeImportModalProps) {
  const [stage, setStage] = useState<ImportStage>('select');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');

  const reset = useCallback(() => {
    setStage('select');
    setImportResult(null);
    setErrorMessage('');
    setFileName('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = importFromAzPrototype(content);
        setImportResult(result);
        setStage('preview');
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to parse the file.');
        setStage('error');
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-selected
    event.target.value = '';
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (importResult) {
      onImport(importResult);
      handleClose();
    }
  }, [importResult, onImport, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="azp-modal-overlay" onClick={handleClose}>
      <div className="azp-modal azp-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="azp-modal-header">
          <div className="azp-modal-title">
            <Terminal size={22} />
            <span>Import from az prototype</span>
          </div>
          <button className="azp-modal-close" onClick={handleClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="azp-modal-body">
          {stage === 'select' && (
            <>
              <p className="azp-modal-description">
                Import an architecture manifest produced by <code>az prototype design</code> or
                exported from the Azure Diagram Builder. The architecture will be rendered as an
                interactive, editable diagram with official Azure icons, workflow animation, and
                multi-region cost estimation.
              </p>

              <label className="azp-import-dropzone">
                <Upload size={32} />
                <span className="azp-import-dropzone-text">
                  Click to select an <code>az-prototype-manifest.json</code> file
                </span>
                <span className="azp-import-dropzone-hint">
                  Accepts .json files (az prototype manifest or raw architecture JSON)
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
            </>
          )}

          {stage === 'preview' && importResult && (
            <>
              <div className="azp-import-success">
                <Check size={18} />
                <span>Successfully parsed <strong>{fileName}</strong></span>
              </div>

              <div className="azp-modal-stats">
                <div className="azp-stat">
                  <span className="azp-stat-value">{importResult.stats.services}</span>
                  <span className="azp-stat-label">Services</span>
                </div>
                <div className="azp-stat">
                  <span className="azp-stat-value">{importResult.stats.connections}</span>
                  <span className="azp-stat-label">Connections</span>
                </div>
                <div className="azp-stat">
                  <span className="azp-stat-value">{importResult.stats.groups}</span>
                  <span className="azp-stat-label">Groups</span>
                </div>
                <div className="azp-stat">
                  <span className="azp-stat-value">{importResult.stats.workflowSteps}</span>
                  <span className="azp-stat-label">Workflow Steps</span>
                </div>
              </div>

              <div className="azp-import-project-info">
                <div className="azp-import-project-row">
                  <span className="azp-import-project-key">Project</span>
                  <span className="azp-import-project-val">{importResult.projectInfo.name}</span>
                </div>
                <div className="azp-import-project-row">
                  <span className="azp-import-project-key">Region</span>
                  <span className="azp-import-project-val">{importResult.projectInfo.location}</span>
                </div>
                <div className="azp-import-project-row">
                  <span className="azp-import-project-key">IaC tool</span>
                  <span className="azp-import-project-val">{importResult.projectInfo.iacTool}</span>
                </div>
                {importResult.hasCostData && (
                  <div className="azp-import-project-row">
                    <span className="azp-import-project-key">Cost data</span>
                    <span className="azp-import-project-val azp-import-project-val--green">Included</span>
                  </div>
                )}
              </div>

              <div className="azp-import-services-preview">
                <div className="azp-import-services-title">Services to import:</div>
                <div className="azp-import-services-list">
                  {importResult.architecture.services.map((svc) => (
                    <span key={svc.id} className="azp-import-service-chip">{svc.name}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {stage === 'error' && (
            <div className="azp-import-error">
              <AlertCircle size={20} />
              <div>
                <strong>Import failed</strong>
                <p>{errorMessage}</p>
              </div>
              <button className="azp-btn azp-btn--secondary" onClick={reset}>
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="azp-modal-footer">
          <button className="azp-btn azp-btn--secondary" onClick={handleClose}>
            Cancel
          </button>
          {stage === 'preview' && (
            <button
              className="azp-btn azp-btn--primary"
              onClick={handleConfirmImport}
            >
              <Upload size={18} />
              Import to Diagram
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import { X, DownloadCloud, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  listSubscriptions,
  listResourceGroups,
  AzureImportDisabledError,
  type AzureSubscription,
  type AzureResourceGroup,
} from '../services/azureImport';
import './AzureImportModal.css';

interface AzureImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Runs the export + deterministic extraction + apply; resolves when done. */
  onImport: (subscriptionId: string, resourceGroup: string) => Promise<void>;
}

const AzureImportModal: React.FC<AzureImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [subs, setSubs] = useState<AzureSubscription[]>([]);
  const [groups, setGroups] = useState<AzureResourceGroup[]>([]);
  const [subId, setSubId] = useState('');
  const [rg, setRg] = useState('');
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [importing, setImporting] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load subscriptions when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDisabled(false);
    setLoadingSubs(true);
    listSubscriptions()
      .then((s) => {
        setSubs(s);
        if (s.length === 1) setSubId(s[0].subscriptionId);
      })
      .catch((e) => {
        if (e instanceof AzureImportDisabledError) setDisabled(true);
        else setError(e.message || 'Failed to list subscriptions');
      })
      .finally(() => setLoadingSubs(false));
  }, [isOpen]);

  // Load resource groups when a subscription is chosen.
  useEffect(() => {
    if (!subId) { setGroups([]); setRg(''); return; }
    setLoadingGroups(true);
    setError(null);
    listResourceGroups(subId)
      .then(setGroups)
      .catch((e) => setError(e.message || 'Failed to list resource groups'))
      .finally(() => setLoadingGroups(false));
  }, [subId]);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!subId || !rg) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(subId, rg);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={importing ? undefined : onClose}>
      <div className="modal-content azure-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <DownloadCloud size={24} />
            Import from Azure
          </h2>
          <button className="modal-close" onClick={onClose} title="Close" disabled={importing}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {disabled ? (
            <div className="azimp-disabled">
              <AlertTriangle size={20} />
              <div>
                <p><strong>Azure import is disabled on the server.</strong></p>
                <p className="azimp-muted">
                  Reverse-engineering a live resource group uses the server identity to enumerate and
                  export resources, so it is off by default. To enable it for local / self-host use, set
                  <code>AZURE_IMPORT_ENABLED=true</code> on the token server (with <code>az login</code>
                  or a reader-scoped managed identity), then reopen this dialog.
                </p>
              </div>
            </div>
          ) : (
            <>
              <p className="azimp-intro">
                Reverse-engineer a deployed resource group into a diagram. The template is exported
                server-side and mapped deterministically — a faithful mirror of what's actually running.
              </p>

              <div className="form-group">
                <label htmlFor="azimp-sub">Subscription</label>
                <select
                  id="azimp-sub"
                  value={subId}
                  onChange={(e) => setSubId(e.target.value)}
                  disabled={loadingSubs || importing}
                >
                  <option value="">{loadingSubs ? 'Loading subscriptions…' : 'Select a subscription…'}</option>
                  {subs.map((s) => (
                    <option key={s.subscriptionId} value={s.subscriptionId}>
                      {s.displayName} ({s.subscriptionId.slice(0, 8)}…)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="azimp-rg">Resource group</label>
                <select
                  id="azimp-rg"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  disabled={!subId || loadingGroups || importing}
                >
                  <option value="">
                    {!subId ? 'Choose a subscription first' : loadingGroups ? 'Loading resource groups…' : 'Select a resource group…'}
                  </option>
                  {groups.map((g) => (
                    <option key={g.name} value={g.name}>{g.name} · {g.location}</option>
                  ))}
                </select>
              </div>

              {importing && (
                <div className="azimp-progress">
                  <RefreshCw size={16} className="spin-icon" />
                  Exporting <strong>{rg}</strong> and building the diagram… large resource groups can take a minute.
                </div>
              )}
            </>
          )}

          {error && <div className="azimp-error"><AlertTriangle size={16} /> {error}</div>}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={importing}>Cancel</button>
          {!disabled && (
            <button className="btn-primary" onClick={handleImport} disabled={!subId || !rg || importing}>
              {importing ? 'Importing…' : 'Import resource group'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AzureImportModal;

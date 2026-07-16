// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import { X, DownloadCloud, RefreshCw, AlertTriangle, LogIn } from 'lucide-react';
import { AzureImportDisabledError } from '../services/azureImport';
import {
  isDelegatedMode,
  ensureSignedIn,
  getSubscriptions,
  getResourceGroups,
  type AzureSubscription,
  type AzureResourceGroup,
} from '../services/azureImportProvider';
import { getSignedInName } from '../services/msalAuth';
import './AzureImportModal.css';

interface AzureImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Runs the query + deterministic mapping + apply; resolves when done. */
  onImport: (subscriptionId: string, resourceGroup: string) => Promise<void>;
}

const AzureImportModal: React.FC<AzureImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const delegated = isDelegatedMode();
  const [account, setAccount] = useState<string | undefined>(undefined);
  const [needsSignIn, setNeedsSignIn] = useState(delegated);
  const [signingIn, setSigningIn] = useState(false);
  const [subs, setSubs] = useState<AzureSubscription[]>([]);
  const [groups, setGroups] = useState<AzureResourceGroup[]>([]);
  const [subId, setSubId] = useState('');
  const [rg, setRg] = useState('');
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [importing, setImporting] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubs = () => {
    setLoadingSubs(true);
    setError(null);
    getSubscriptions()
      .then((s) => {
        setSubs(s);
        if (s.length === 1) setSubId(s[0].subscriptionId);
      })
      .catch((e) => {
        if (e instanceof AzureImportDisabledError) setDisabled(true);
        else setError(e.message || 'Failed to list subscriptions');
      })
      .finally(() => setLoadingSubs(false));
  };

  // On open: server mode loads subs immediately; delegated mode loads subs only
  // once the user is signed in (otherwise show the sign-in gate).
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDisabled(false);
    if (!delegated) { setNeedsSignIn(false); loadSubs(); return; }
    getSignedInName().then((name) => {
      if (name) { setAccount(name); setNeedsSignIn(false); loadSubs(); }
      else { setNeedsSignIn(true); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load resource groups when a subscription is chosen.
  useEffect(() => {
    if (!subId) { setGroups([]); setRg(''); return; }
    setLoadingGroups(true);
    setError(null);
    getResourceGroups(subId)
      .then(setGroups)
      .catch((e) => setError(e.message || 'Failed to list resource groups'))
      .finally(() => setLoadingGroups(false));
  }, [subId]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const name = await ensureSignedIn();
      setAccount(name);
      setNeedsSignIn(false);
      loadSubs();
    } catch (e: any) {
      setError(e?.message || 'Sign-in failed');
    } finally {
      setSigningIn(false);
    }
  };

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
          ) : needsSignIn ? (
            <div className="azimp-signin">
              <p className="azimp-intro">
                Sign in with your Azure account to reverse-engineer a resource group you have access to.
                We request read-only <strong>Azure Service Management</strong> access and query only what
                <strong> your</strong> permissions allow — nothing is stored.
              </p>
              <button className="btn-primary azimp-signin-btn" onClick={handleSignIn} disabled={signingIn}>
                <LogIn size={16} />
                {signingIn ? 'Signing in…' : 'Sign in to Azure'}
              </button>
            </div>
          ) : (
            <>
              <p className="azimp-intro">
                Reverse-engineer a deployed resource group into a diagram — a faithful mirror of what's
                actually running, mapped deterministically from Azure Resource Graph.
                {account && <> Signed in as <strong>{account}</strong>.</>}
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
                  Scanning <strong>{rg}</strong> and building the diagram…
                </div>
              )}
            </>
          )}

          {error && <div className="azimp-error"><AlertTriangle size={16} /> {error}</div>}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={importing}>Cancel</button>
          {!disabled && !needsSignIn && (
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

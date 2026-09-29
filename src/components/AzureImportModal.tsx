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
import { getSignedInName, consumeRedirectError } from '../services/msalAuth';
import { describeAzureSignInError } from '../utils/azureSignInErrors';
import './AzureImportModal.css';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

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
    Promise.all([getSignedInName(), consumeRedirectError()]).then(([name, redirectErr]) => {
      if (redirectErr) setError(describeAzureSignInError(redirectErr).message);
      if (name) { setAccount(name); setNeedsSignIn(false); loadSubs(); }
      else { setNeedsSignIn(true); }
    });
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

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const name = await ensureSignedIn();
      setAccount(name);
      setNeedsSignIn(false);
      loadSubs();
    } catch (e: unknown) {
      setError(describeAzureSignInError(e).message);
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
                <p><strong>Sign-in to Azure isn't set up on this deployment.</strong></p>
                <p className="azimp-muted">
                  You can still import a live resource group: export it as an ARM template (below) and
                  open it with <strong>Import → Template file</strong>.
                </p>
                <p className="azimp-muted azimp-selfhost">
                  Self-hosting? Set <code>VITE_AZURE_AD_CLIENT_ID</code> for per-user sign-in, or
                  <code>AZURE_IMPORT_ENABLED=true</code> on the token server to use its own identity.
                </p>
              </div>
            </div>
          ) : needsSignIn ? (
            <div className="azimp-signin">
              <p className="azimp-intro">
                Sign in with your Azure account to reverse-engineer a resource group you have access to.
                The app only reads resources through <strong>Azure Service Management</strong>, limited to
                what <strong>your</strong> permissions allow. Nothing is changed or stored, and your
                sign-in never leaves this browser.
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
          {(disabled || needsSignIn) && (
            <div className="azimp-fallback">
              <p><strong>No sign-in?</strong> Export the resource group with the Azure CLI, then open the file
                with <strong>Import → Template file</strong>:</p>
              <code>az group export -g &lt;resource-group&gt; &gt; rg.json</code>
            </div>
          )}
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

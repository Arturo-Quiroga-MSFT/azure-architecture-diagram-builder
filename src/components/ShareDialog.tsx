// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Share dialog: create a link to a read-only snapshot of the current design,
// and manage the links this browser created. See DOCS/SHARED-DESIGNS.md.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader, RefreshCw, Share2, Trash2, X } from 'lucide-react';
import {
  createShare, EXPIRY_CHOICES, formatExpiry, getShare, listOwnedShares, revokeShare, shareUrl, updateShare,
  type ExpiryDays, type OwnedShare, type SharePayload,
} from '../services/shareService';
import { trackShare } from '../services/telemetryService';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import './ShareDialog.css';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Snapshot of the current design; null when the canvas is empty. */
  buildPayload: () => Omit<SharePayload, 'includeBrief' | 'expiresInDays'> & { hasBrief: boolean } | null;
}

type Activity = Record<string, { views: number; lastViewedAt: string | null } | 'gone'>;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this link', text);
    return false;
  }
}

const ShareDialog: React.FC<ShareDialogProps> = ({ isOpen, onClose, buildPayload }) => {
  const [title, setTitle] = useState('');
  const [expiry, setExpiry] = useState<ExpiryDays>(30);
  const [includeBrief, setIncludeBrief] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState<OwnedShare[]>([]);
  const [created, setCreated] = useState<OwnedShare | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity>({});

  const snapshot = useMemo(() => (isOpen ? buildPayload() : null), [isOpen, buildPayload]);

  useEscapeToClose(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(snapshot?.title || '');
    setError(null);
    setCreated(null);
    setIncludeBrief(false);
    const list = listOwnedShares();
    setOwned(list);
    // Ask the server how each link is doing (views); a link removed or expired server-side drops off.
    let live = true;
    Promise.all(list.map((s) => getShare(s.id, s.ownerKey)
      .then((r) => [s.id, r.owner ?? { views: 0, lastViewedAt: null }] as const)
      .catch(() => [s.id, 'gone'] as const)))
      .then((pairs) => { if (live) setActivity(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [isOpen, snapshot]);

  const flashCopied = (id: string) => {
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1800);
  };

  const payload = useCallback((): SharePayload | null => {
    if (!snapshot) return null;
    const { hasBrief: _hasBrief, ...rest } = snapshot;
    return { ...rest, title: title.trim() || snapshot.title, includeBrief, expiresInDays: expiry };
  }, [snapshot, title, includeBrief, expiry]);

  const create = async () => {
    const p = payload();
    if (!p) return;
    setBusy('create');
    setError(null);
    try {
      const share = await createShare(p);
      setCreated(share);
      setOwned(listOwnedShares());
      setActivity((a) => ({ ...a, [share.id]: { views: 0, lastViewedAt: null } }));
      trackShare({ action: 'created', services: p.summary.services, expiresInDays: p.expiresInDays, includeBrief: p.includeBrief });
      if (await copyText(shareUrl(share.id))) flashCopied(share.id);
    } catch (err: any) {
      setError(err?.message || 'Could not create the link.');
    } finally {
      setBusy(null);
    }
  };

  const update = async (share: OwnedShare) => {
    const p = payload();
    if (!p) return;
    const { expiresInDays: _keepExpiry, ...rest } = p;
    setBusy(share.id);
    setError(null);
    try {
      await updateShare(share, rest);
      setOwned(listOwnedShares());
      trackShare({ action: 'updated', services: p.summary.services, includeBrief: p.includeBrief });
    } catch (err: any) {
      setError(err?.message || 'Could not update the link.');
      setOwned(listOwnedShares());
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (share: OwnedShare) => {
    if (!window.confirm(`Remove the link to "${share.title}"? Anyone who has it will no longer be able to open it.`)) return;
    setBusy(share.id);
    setError(null);
    try {
      await revokeShare(share);
      setOwned(listOwnedShares());
      if (created?.id === share.id) setCreated(null);
      trackShare({ action: 'revoked' });
    } catch (err: any) {
      setError(err?.message || 'Could not remove the link.');
    } finally {
      setBusy(null);
    }
  };

  const copy = async (id: string) => {
    if (await copyText(shareUrl(id))) flashCopied(id);
    trackShare({ action: 'copied-link' });
  };

  if (!isOpen) return null;

  return (
    <div className="share-overlay" role="dialog" aria-modal="true" aria-label="Share a link" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <header className="share-header">
          <div className="share-title"><Share2 size={18} /><strong>Share a link</strong></div>
          <button className="share-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="share-body">
          {!snapshot ? (
            <p className="share-empty">Create or load a design first, then share it.</p>
          ) : created ? (
            <section className="share-created">
              <p className="share-lead"><Check size={16} /> Link created and copied. Anyone with it can view this design ({formatExpiry(created.expiresAt)}).</p>
              <div className="share-url">
                <input readOnly value={shareUrl(created.id)} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
                <button onClick={() => copy(created.id)}>{copiedId === created.id ? <Check size={15} /> : <Copy size={15} />}{copiedId === created.id ? 'Copied' : 'Copy'}</button>
                <a href={shareUrl(created.id)} target="_blank" rel="noopener noreferrer" title="Open the link"><ExternalLink size={15} /></a>
              </div>
            </section>
          ) : (
            <section className="share-form">
              <p className="share-lead">Anyone with the link can view a read-only copy of this design: the diagram, its services, the monthly cost and the Well-Architected result. They can open a copy to edit in their own browser; your design stays as it is.</p>
              <label className="share-field">
                <span>Title</span>
                <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <div className="share-row">
                <label className="share-field">
                  <span>Link expires after</span>
                  <select value={expiry} onChange={(e) => setExpiry(Number(e.target.value) as ExpiryDays)}>
                    {EXPIRY_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}
                  </select>
                </label>
                <label className={`share-check${snapshot.hasBrief ? '' : ' disabled'}`}>
                  <input type="checkbox" checked={includeBrief} disabled={!snapshot.hasBrief} onChange={(e) => setIncludeBrief(e.target.checked)} />
                  <span>Include the brief (the prompt that described the workload)</span>
                </label>
              </div>
              <p className="share-note">Check the title and design for customer names or anything confidential before sharing. You can remove the link at any time.</p>
              <button className="share-primary" onClick={create} disabled={busy !== null}>
                {busy === 'create' ? <Loader size={16} className="spin" /> : <Link2 size={16} />} Create link
              </button>
            </section>
          )}

          {error && <p className="share-error" role="alert">{error}</p>}

          {owned.length > 0 && (
            <section className="share-owned">
              <h3>Links you created in this browser</h3>
              <ul>
                {owned.map((s) => {
                  const a = activity[s.id];
                  const stats = a === 'gone'
                    ? 'no longer available'
                    : a ? `${a.views} view${a.views === 1 ? '' : 's'}${a.lastViewedAt ? `, last ${new Date(a.lastViewedAt).toLocaleDateString()}` : ''}` : '…';
                  return (
                    <li key={s.id} className={a === 'gone' ? 'gone' : ''}>
                      <div className="share-owned-text">
                        <strong>{s.title}</strong>
                        <small>{stats} · {formatExpiry(s.expiresAt)}</small>
                      </div>
                      <div className="share-owned-actions">
                        <button onClick={() => copy(s.id)} title="Copy link" aria-label={`Copy link to ${s.title}`}>
                          {copiedId === s.id ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                        {snapshot && (
                          <button onClick={() => update(s)} disabled={busy !== null} title="Replace what this link shows with the current design" aria-label={`Update ${s.title} with the current design`}>
                            {busy === s.id ? <Loader size={15} className="spin" /> : <RefreshCw size={15} />}
                          </button>
                        )}
                        <button onClick={() => revoke(s)} disabled={busy !== null} title="Remove this link" aria-label={`Remove link to ${s.title}`} className="danger">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="share-note">Only this browser can update or remove these links. They expire on their own.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;

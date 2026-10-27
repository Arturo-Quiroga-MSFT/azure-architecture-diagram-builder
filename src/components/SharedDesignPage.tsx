// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Read-only view of a shared design at /d/<id>. Renders with the editor's own
// node and edge components so it looks exactly like the canvas, but nothing can
// be moved, edited or re-priced. "Open a copy" hands the design to the editor.
// See DOCS/SHARED-DESIGNS.md.

import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { ArrowRight, CircleDollarSign, Clock, Copy, Layers, Link2Off, ShieldCheck, Workflow } from 'lucide-react';
import AzureNode from './AzureNode';
import GroupNode from './GroupNode';
import EditableEdge from './EditableEdge';
import { formatExpiry, getShare, ShareError, stashCopyForEditor, type SharedDesign } from '../services/shareService';
import { trackShare } from '../services/telemetryService';
import './SharedDesignPage.css';

const nodeTypes = { azureNode: AzureNode, groupNode: GroupNode };
const edgeTypes = { editableEdge: EditableEdge };

// Same handle-id repair the editor applies on load (bare position names → real handle ids).
const SRC_FIX: Record<string, string> = { top: 'top-source', left: 'left-source' };
const TGT_FIX: Record<string, string> = { bottom: 'bottom-target', right: 'right-target' };

function readOnlyGraph(design: any): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (Array.isArray(design?.nodes) ? design.nodes : []).map((n: any) => ({
    ...n,
    selected: false,
    draggable: false,
    connectable: false,
    selectable: false,
  }));
  const edges: Edge[] = (Array.isArray(design?.edges) ? design.edges : []).map((e: any) => ({
    ...e,
    selected: false,
    sourceHandle: typeof e.sourceHandle === 'string' && SRC_FIX[e.sourceHandle] ? SRC_FIX[e.sourceHandle] : e.sourceHandle,
    targetHandle: typeof e.targetHandle === 'string' && TGT_FIX[e.targetHandle] ? TGT_FIX[e.targetHandle] : e.targetHandle,
  }));
  return { nodes, edges };
}

// One request per page load: each read counts as a view, so re-renders (and
// React StrictMode's double-run of effects in development) must not refetch.
const loads = new Map<string, Promise<SharedDesign>>();
function loadShare(id: string): Promise<SharedDesign> {
  let p = loads.get(id);
  if (!p) {
    p = getShare(id);
    p.then(
      (r) => trackShare({ action: 'opened', services: r.summary?.services }),
      (err) => trackShare({ action: 'open-failed', status: err instanceof ShareError ? err.status : 0 }),
    );
    loads.set(id, p);
  }
  return p;
}

const money = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SharedDesignPage: React.FC<{ id: string }> = ({ id }) => {
  const [shared, setShared] = useState<SharedDesign | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadShare(id)
      .then((r) => {
        if (!live) return;
        setShared(r);
        document.title = `${r.title} · Azure Architecture Diagram Builder`;
      })
      .catch((err) => {
        if (!live) return;
        setError(err instanceof ShareError ? err.message : 'This link could not be opened.');
      });
    return () => { live = false; };
  }, [id]);

  const graph = useMemo(() => (shared ? readOnlyGraph(shared.design) : { nodes: [], edges: [] }), [shared]);
  const workflow: { step: number; description: string }[] = Array.isArray(shared?.design?.workflow) ? shared!.design.workflow : [];
  const brief: string = typeof shared?.design?.originalPrompt === 'string' ? shared.design.originalPrompt : '';

  const openCopy = () => {
    if (!shared) return;
    stashCopyForEditor(shared);
    window.location.href = '/';
  };

  if (error) {
    return (
      <div className="sdv-state">
        <Link2Off size={36} />
        <h1>{error}</h1>
        <p>Ask the person who shared it for a new link, or design your own.</p>
        <a className="sdv-primary" href="/">Open the Azure Architecture Diagram Builder <ArrowRight size={16} /></a>
      </div>
    );
  }
  if (!shared) return <div className="sdv-state"><p>Loading the shared design…</p></div>;

  const s = shared.summary || { services: 0 };
  return (
    <div className="sdv-shell">
      <header className="sdv-header">
        <div className="sdv-heading">
          <span className="sdv-eyebrow">Shared design · read-only</span>
          <h1>{shared.title}</h1>
        </div>
        <div className="sdv-actions">
          <button className="sdv-primary" onClick={openCopy} title="Open an editable copy in your own browser">
            <Copy size={16} /> Open a copy in the editor
          </button>
        </div>
      </header>
      <div className="sdv-body">
        <main className="sdv-canvas" aria-label="Architecture diagram (read-only)">
          <ReactFlowProvider>
            <ReactFlow
              nodes={graph.nodes}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              edgesFocusable={false}
              nodesFocusable={false}
              zoomOnDoubleClick={false}
              deleteKeyCode={null}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              minZoom={0.1}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </ReactFlowProvider>
        </main>
        <aside className="sdv-side">
          <dl className="sdv-facts">
            <div><dt><Layers size={14} /> Services</dt><dd>{s.services}</dd></div>
            {typeof s.monthlyCost === 'number' && (
              <div><dt><CircleDollarSign size={14} /> Monthly run rate</dt><dd>{money(s.monthlyCost)}<small>{s.region ? ` · ${s.region}` : ''}, pay-as-you-go retail prices</small></dd></div>
            )}
            {s.wafBand && <div><dt><ShieldCheck size={14} /> Well-Architected review</dt><dd>{s.wafBand}</dd></div>}
            <div><dt><Clock size={14} /> Shared</dt><dd>Updated {new Date(shared.updatedAt).toLocaleDateString()}<small> · link {formatExpiry(shared.expiresAt)}</small></dd></div>
          </dl>
          {brief && (
            <section className="sdv-section">
              <h2>The brief</h2>
              <p className="sdv-brief">{brief}</p>
            </section>
          )}
          {workflow.length > 0 && (
            <section className="sdv-section">
              <h2><Workflow size={14} /> How a request flows</h2>
              <ol className="sdv-workflow">
                {workflow.map((w, i) => <li key={`${w.step}-${i}`}>{w.description}</li>)}
              </ol>
            </section>
          )}
          <p className="sdv-note">
            Indicative design and estimate, made with the Azure Architecture Diagram Builder. Not a Microsoft product, a pricing quote or a substitute for an architecture review.
          </p>
          <a className="sdv-link" href="/">Design your own <ArrowRight size={14} /></a>
        </aside>
      </div>
    </div>
  );
};

export default SharedDesignPage;

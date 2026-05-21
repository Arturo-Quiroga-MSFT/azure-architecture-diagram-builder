// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ReferenceArchitectureCanvas
 * ---------------------------
 * Editorial / publication-style renderer for a `ReferenceArchitecture`.
 *
 * This is a NEW, ADDITIVE feature and does NOT replace the primary
 * ReactFlow canvas. It is intended to be mounted off-screen for PNG export
 * (see `utils/exportReferencePng.ts`), but is also usable as a regular
 * on-screen preview component.
 *
 * Scope of this scaffold:
 *   - Header title + optional platform-wrapper bars
 *   - Left "Data sources" column (optional)
 *   - Stages grid (each stage = column with header + service tiles)
 *   - Right "Actors" column (optional)
 *   - Foundation strip
 *   - Cross-cutting governance strip
 *   - Workflow narrative legend at bottom
 *
 * Out of scope for this first pass (future polish):
 *   - SVG edge rendering between services with numbered step badges
 *   - Hot/cool path band overlays
 *   - Side annotation callouts
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ReferenceArchitecture,
  RefService,
} from '../services/referenceArchitectureAI';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { loadIcon } from '../utils/iconLoader';
import './ReferenceArchitectureCanvas.css';

export interface ReferenceArchitectureCanvasProps {
  data: ReferenceArchitecture;
  /** Fixed export width in pixels. Defaults to 1600. */
  width?: number;
  /** Optional author/credit chip shown in the header. */
  author?: string;
  /**
   * Pre-resolved icon URLs, keyed by service name. When provided, tiles render
   * synchronously with the supplied URL and skip the async loadIcon() path.
   * This is what the off-screen PNG exporter uses to guarantee icons are
   * present at capture time.
   */
  iconMap?: Record<string, string>;
  /** Pre-resolved data: URL for the generic users/actors icon. */
  actorIconUrl?: string;
}

const ReferenceArchitectureCanvas: React.FC<ReferenceArchitectureCanvasProps> = ({
  data,
  width = 1600,
  author,
  iconMap,
  actorIconUrl,
}) => {
  // Map each service id to the workflow step numbers it participates in,
  // so tiles can show small numbered badges that tie back to the narrative
  // legend at the bottom of the diagram. This replaces tile-to-tile arrows
  // (which AAC-style reference diagrams rarely use) with a cleaner visual
  // cue that can never produce nonsensical crossings.
  const stepMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const step of data.workflow || []) {
      for (const svcId of step.services || []) {
        const arr = m.get(svcId);
        if (arr) {
          if (!arr.includes(step.step)) arr.push(step.step);
        } else {
          m.set(svcId, [step.step]);
        }
      }
    }
    return m;
  }, [data]);

  // Map each service id to a path-band id (hot / cool / ...). The band is
  // inferred from `connections` that touch the service. If a service
  // participates in multiple bands, `hot` wins (more visually distinctive),
  // then any other band. Tiles use this to render a thin colored stripe so
  // the reader can trace hot vs cool flow without drawing arrows.
  const bandMap = useMemo(() => {
    if (!data.pathBands || data.pathBands.length === 0) return new Map<string, string>();
    const known = new Set(data.pathBands.map((b) => b.id));
    const m = new Map<string, string>();
    for (const c of data.connections || []) {
      if (!c.band || !known.has(c.band)) continue;
      for (const id of [c.from, c.to]) {
        const prev = m.get(id);
        if (!prev) m.set(id, c.band);
        else if (prev !== 'hot' && c.band === 'hot') m.set(id, 'hot');
      }
    }
    return m;
  }, [data]);
  return (
    <div
      className="ref-arch-canvas"
      data-ref-arch-canvas="true"
      style={{ width: `${width}px` }}
    >
      <header className="ref-arch-header">
        <div className="ref-arch-header-text">
          <div className="ref-arch-eyebrow">Reference Architecture</div>
          <h1 className="ref-arch-title">{data.title}</h1>
        </div>
        {author && <div className="ref-arch-author">{author}</div>}
      </header>

      {data.platformWrappers && data.platformWrappers.length > 0 && (
        <div className="ref-arch-wrappers">
          {data.platformWrappers.map((w) => (
            <div key={w} className="ref-arch-wrapper-bar">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="ref-arch-body">
        {data.dataSources && data.dataSources.length > 0 && (
          <aside className="ref-arch-datasources">
            <div className="ref-arch-col-header">Data sources</div>
            {data.dataSources.map((ds) => (
              <div key={ds.category} className="ref-arch-ds-group">
                <div className="ref-arch-ds-label">{ds.category}</div>
                <ul className="ref-arch-ds-list">
                  {ds.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>
        )}

        <div
          className="ref-arch-stages"
          style={{
            gridTemplateColumns: `repeat(${data.stages.length}, minmax(0, 1fr))`,
          }}
        >
          {data.stages.map((stage) => (
            <section key={stage.id} className="ref-arch-stage">
              <div className="ref-arch-stage-header">{stage.label}</div>
              <div className="ref-arch-stage-tiles">
                {stage.services.map((svc) => (
                  <ServiceTile
                    key={svc.id}
                    service={svc}
                    preloadedIconUrl={iconMap?.[svc.name]}
                    steps={stepMap.get(svc.id)}
                    band={bandMap.get(svc.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {data.actors && data.actors.length > 0 && (
          <aside className="ref-arch-actors">
            <div className="ref-arch-col-header">Actors</div>
            {data.actors.map((a) => (
              <div key={a.id} className="ref-arch-actor">
                <div className="ref-arch-actor-icon" aria-hidden>
                  {actorIconUrl ? (
                    <img src={actorIconUrl} alt="" draggable={false} />
                  ) : (
                    <span className="ref-arch-actor-glyph">◉</span>
                  )}
                </div>
                <div className="ref-arch-actor-label">{a.label}</div>
              </div>
            ))}
          </aside>
        )}
      </div>

      {data.foundation && data.foundation.length > 0 && (
        <div className="ref-arch-strip ref-arch-foundation">
          <span className="ref-arch-strip-label">Foundation</span>
          <div className="ref-arch-strip-items">
            {data.foundation.map((f) => (
              <span key={f} className="ref-arch-chip">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.crossCutting && data.crossCutting.length > 0 && (
        <div className="ref-arch-strip ref-arch-crosscutting">
          <span className="ref-arch-strip-label">Security &amp; Governance</span>
          <div className="ref-arch-strip-items">
            {data.crossCutting.map((c) => (
              <span key={c} className="ref-arch-chip ref-arch-chip-muted">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.workflow && data.workflow.length > 0 && (
        <ol className="ref-arch-workflow">
          {data.workflow.map((step) => (
            <li key={step.step}>
              <span className="ref-arch-step-badge">{step.step}</span>
              <span className="ref-arch-step-text">{step.description}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

// ─── Service tile (with lazy SVG icon load) ──────────────────────────────────

const ServiceTile: React.FC<{
  service: RefService;
  preloadedIconUrl?: string;
  steps?: number[];
  band?: string;
}> = ({ service, preloadedIconUrl, steps, band }) => {
  const [iconUrl, setIconUrl] = useState<string>(preloadedIconUrl || '');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // If the caller pre-resolved the icon URL (export path), use it directly.
    if (preloadedIconUrl) {
      setIconUrl(preloadedIconUrl);
      return;
    }
    const mapping = getServiceIconMapping(service.name);
    if (!mapping) return;
    const path = `/Azure_Public_Service_Icons/Icons/${mapping.category}/${mapping.iconFile}.svg`;
    loadIcon(path).then((url) => {
      if (mountedRef.current) setIconUrl(url);
    });
    return () => {
      mountedRef.current = false;
    };
  }, [service.name, preloadedIconUrl]);

  return (
    <div
      className="ref-arch-tile"
      data-category={service.category}
      data-band={band || undefined}
    >
      {steps && steps.length > 0 && (
        <div className="ref-arch-tile-steps" aria-label={`Workflow steps ${steps.join(', ')}`}>
          {steps.map((n) => (
            <span key={n} className="ref-arch-tile-step">{n}</span>
          ))}
        </div>
      )}
      <div className="ref-arch-tile-icon">
        {iconUrl ? (
          <img src={iconUrl} alt="" draggable={false} />
        ) : (
          <div className="ref-arch-tile-icon-placeholder" />
        )}
      </div>
      <div className="ref-arch-tile-name" title={service.name}>
        {service.name}
      </div>
    </div>
  );
};

export default ReferenceArchitectureCanvas;

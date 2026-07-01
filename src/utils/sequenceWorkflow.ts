// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * sequenceWorkflowSvg — turn a captured ReactFlow SVG into an animated SVG that
 * plays the diagram's `workflow[]` chronologically: one step at a time, the
 * step's edge flows while a caption shows its description and the involved nodes
 * pulse. Inactive edges are dimmed. The cycle loops.
 *
 * Client-side and dependency-free. The motion is carried by SVG SMIL
 * (<animateMotion> / <set>), so the SVG animates when opened in a browser.
 * Note: to produce a GIF/WebP (e.g. for GitHub/Teams, which strip SVG
 * animation) the SVG must be rasterized server-side.
 *
 * How steps map to edges: each workflow step lists the `services` it touches.
 * Saved diagrams don't number edges, so we map each edge to its SVG <path> by
 * GEOMETRY (matching the edge's source/target handle points to the path's
 * start/end), then greedily assign each step its forward edge. Node highlight
 * boxes are reconstructed from the matched edge endpoints, so they stay aligned
 * even when the JSON node positions are stale (e.g. a node was moved).
 */

export interface SequenceWorkflowOptions {
  nodes: any[];
  edges: any[];
  workflow: Array<{ step: number; description: string; services: string[] }>;
  /** Seconds each step is on screen. Default 3. */
  stepDurSec?: number;
}

// Matches a react-flow edge path, whether self-closing or paired/empty.
const EDGE_RE = /(<path\b[^>]*?react-flow__edge-path[^>]*?)(\/>|>\s*<\/path>|>)/g;

export function sequenceWorkflowSvg(svgText: string, options: SequenceWorkflowOptions): string {
  const { nodes, edges } = options;
  const STEP_DUR = options.stepDurSec ?? 3;
  const workflow = (options.workflow || []).slice().sort((a, b) => a.step - b.step);
  if (!workflow.length) return svgText;
  const TOTAL = workflow.length * STEP_DUR;

  // ── node geometry ──────────────────────────────────────────────────────────
  const nodeMap = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of nodes) {
    const p = n.positionAbsolute || n.position || { x: 0, y: 0 };
    nodeMap.set(n.id, {
      x: p.x, y: p.y,
      w: n.width || (n.style && n.style.width) || 160,
      h: n.height || (n.style && n.style.height) || 113,
    });
  }
  const handlePoint = (id: string, handle = ""): [number, number] | null => {
    const n = nodeMap.get(id);
    if (!n) return null;
    if (/right/.test(handle)) return [n.x + n.w, n.y + n.h / 2];
    if (/left/.test(handle)) return [n.x, n.y + n.h / 2];
    if (/top/.test(handle)) return [n.x + n.w / 2, n.y];
    if (/bottom/.test(handle)) return [n.x + n.w / 2, n.y + n.h];
    return [n.x + n.w / 2, n.y + n.h / 2];
  };
  const d2 = (a: [number, number] | null, b: [number, number] | null) =>
    a && b ? (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 : Infinity;

  const jsonEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle as string | undefined,
    targetHandle: e.targetHandle as string | undefined,
    src: handlePoint(e.source, e.sourceHandle),
    tgt: handlePoint(e.target, e.targetHandle),
    pathIdx: -1,
  }));

  // ── parse SVG edge paths (DOM order), capturing each path's ReactFlow edge id
  //    from the enclosing group's data-testid="rf__edge-<id>" ──────────────────
  const paths: Array<{ start: [number, number]; end: [number, number]; color: string; edgeId: string | null }> = [];
  {
    const tokenRe = /data-testid="rf__edge-([^"]+)"|(<path\b[^>]*?react-flow__edge-path[^>]*?>)/g;
    let m: RegExpExecArray | null;
    let curId: string | null = null;
    while ((m = tokenRe.exec(svgText))) {
      if (m[1] != null) { curId = m[1]; continue; }
      const open = m[2];
      const dMatch = /\bd="([^"]+)"/.exec(open);
      const d = dMatch ? dMatch[1] : "";
      const nums = (d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
      const cMatch = /color=#([0-9a-fA-F]{6})/.exec(open);
      paths.push({
        start: [nums[0], nums[1]],
        end: [nums[nums.length - 2], nums[nums.length - 1]],
        color: cMatch ? `#${cMatch[1]}` : "#1971c2",
        edgeId: curId,
      });
      curId = null;
    }
  }

  // ── map each JSON edge to its SVG path by EDGE ID (exact); fall back to nearest
  //    geometry only for edges whose id wasn't found in the SVG ────────────────
  const pathByEdgeId = new Map<string, number>();
  paths.forEach((p, i) => { if (p.edgeId != null && !pathByEdgeId.has(p.edgeId)) pathByEdgeId.set(p.edgeId, i); });
  const usedPath = new Set<number>();
  for (const je of jsonEdges) {
    const pi = pathByEdgeId.get(je.id);
    if (pi != null) { je.pathIdx = pi; usedPath.add(pi); }
  }
  for (const je of jsonEdges) {
    if (je.pathIdx >= 0) continue;
    let best = -1, bestC = Infinity;
    paths.forEach((p, i) => {
      if (usedPath.has(i)) return;
      const c = d2(je.src, p.start) + d2(je.tgt, p.end);
      if (c < bestC) { bestC = c; best = i; }
    });
    je.pathIdx = best;
    if (best >= 0) usedPath.add(best);
  }

  // ── node boxes reconstructed from matched edge endpoints (alignment-robust) ──
  const nodeBox = new Map<string, { xs: number[]; ys: number[]; w: number; h: number }>();
  const addBox = (id: string, side = "", pt: [number, number] | null) => {
    const n = nodeMap.get(id);
    if (!n || !pt) return;
    let x: number, y: number;
    if (/right/.test(side)) { x = pt[0] - n.w; y = pt[1] - n.h / 2; }
    else if (/left/.test(side)) { x = pt[0]; y = pt[1] - n.h / 2; }
    else if (/top/.test(side)) { x = pt[0] - n.w / 2; y = pt[1]; }
    else if (/bottom/.test(side)) { x = pt[0] - n.w / 2; y = pt[1] - n.h; }
    else { x = pt[0] - n.w / 2; y = pt[1] - n.h / 2; }
    if (!nodeBox.has(id)) nodeBox.set(id, { xs: [], ys: [], w: n.w, h: n.h });
    const b = nodeBox.get(id)!;
    b.xs.push(x); b.ys.push(y);
  };
  for (const je of jsonEdges) {
    if (je.pathIdx < 0) continue;
    const p = paths[je.pathIdx];
    if (!p) continue;
    addBox(je.source, je.sourceHandle, p.start);
    addBox(je.target, je.targetHandle, p.end);
  }
  const boxOf = (id: string) => {
    const b = nodeBox.get(id);
    if (!b || !b.xs.length) {
      const n = nodeMap.get(id);
      return n ? { x: n.x, y: n.y, w: n.w, h: n.h } : null;
    }
    const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    return { x: avg(b.xs), y: avg(b.ys), w: b.w, h: b.h };
  };

  // ── map workflow steps → edges (greedy, in order, by service membership) ─────
  const assignedEdge = new Set<string>();
  const pathStep = new Map<number, number>(); // pathIdx -> step number (1-based)
  workflow.forEach((step, k) => {
    const svc = new Set(step.services || []);
    let picks = jsonEdges.filter(
      (je) => !assignedEdge.has(je.id) && svc.has(je.source) && svc.has(je.target)
    );
    if (picks.length > 1) {
      const order = step.services;
      picks = picks
        .slice()
        .sort((a, b) => order.indexOf(b.target) - order.indexOf(a.target))
        .slice(0, 1);
    }
    for (const je of picks) {
      assignedEdge.add(je.id);
      if (je.pathIdx >= 0) pathStep.set(je.pathIdx, k + 1);
    }
  });

  // ── inject sequenced flow + node highlights ──────────────────────────────────
  let svg = svgText;
  svg = svg.replace(/<circle\b[^>]*>\s*<animateMotion[\s\S]*?<\/animateMotion>\s*<\/circle>/g, "");
  if (!/xmlns:xlink=/.test(svg)) {
    svg = svg.replace(/<svg\b([^>]*)>/, '<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink">');
  }
  // De-emphasize all edge labels so the active step (caption + flowing edge +
  // node rings) stands out. Labels live in the react-flow__edgelabel-renderer
  // portal (separate from edges), so we fade the whole container uniformly.
  svg = svg.replace(
    /(<div\b[^>]*class="[^"]*react-flow__edgelabel-renderer[^"]*"[^>]*style=")([^"]*)(")/,
    "$1$2;opacity:0.28$3"
  );

  // Looping timing: one master cycle of TOTAL seconds repeated forever; keyTimes
  // mark each effect's active window, so the whole sequence loops in a browser.
  const frac = (t: number) => Math.max(0, Math.min(1, t / TOTAL)).toFixed(4);
  const loopSet = (attr: string, base: string, active: string, b: number, d: number) =>
    `<animate attributeName="${attr}" dur="${TOTAL}s" repeatCount="indefinite" calcMode="discrete" values="${base};${active};${base};${base}" keyTimes="0;${frac(b)};${frac(b + d)};1"/>`;
  const loopOpacity = (op: number, b: number, d: number) =>
    `<animate attributeName="opacity" dur="${TOTAL}s" repeatCount="indefinite" calcMode="discrete" values="0;${op};0;0" keyTimes="0;${frac(b)};${frac(b + d)};1"/>`;
  const loopMotion = (mid: string, b: number, d: number) =>
    `<animateMotion dur="${TOTAL}s" repeatCount="indefinite" rotate="0" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${frac(b)};${frac(b + d)};1"><mpath xlink:href="#${mid}" href="#${mid}"/></animateMotion>`;

  let highlights = "";
  workflow.forEach((s, k) => {
    const b = k * STEP_DUR;
    (s.services || []).forEach((svc) => {
      const box = boxOf(svc);
      if (!box) return;
      highlights +=
        `<rect x="${(box.x - 6).toFixed(1)}" y="${(box.y - 6).toFixed(1)}" width="${(box.w + 12).toFixed(1)}" height="${(box.h + 12).toFixed(1)}" rx="16" ` +
        `fill="none" stroke="#ffd43b" stroke-width="4" opacity="0">` +
        loopOpacity(1, b, STEP_DUR) +
        `</rect>`;
    });
  });

  let counter = 0;
  svg = svg.replace(EDGE_RE, (_full: string, open: string) => {
    const i = counter++;
    const id = `wf-edge-${i}`;
    let tag = /\bid="/.test(open) ? open.replace(/\bid="[^"]*"/, `id="${id}"`) : `${open} id="${id}"`;
    const om = /\bstroke="([^"]+)"/.exec(tag);
    const origStroke = om ? om[1] : "#60a5fa";
    const ow = /\bstroke-width="([^"]+)"/.exec(tag);
    const origW = ow ? ow[1] : "2px";
    tag = /stroke-opacity="/.test(tag)
      ? tag.replace(/stroke-opacity="[^"]*"/, 'stroke-opacity="0.16"')
      : `${tag} stroke-opacity="0.16"`;
    const step = pathStep.get(i);
    const extra = i === 0 ? highlights : "";
    if (!step) return `${tag}>${extra}</path>`;
    const b = (step - 1) * STEP_DUR;
    const cd = STEP_DUR * 0.92;
    // Active edge pops for its window: vivid amber recolor + thicker + full opacity.
    const emphasize =
      loopSet("stroke", origStroke, "#ffa94d", b, STEP_DUR) +
      loopSet("stroke-opacity", "0.16", "1", b, STEP_DUR) +
      loopSet("stroke-width", origW, "5", b, STEP_DUR);
    const mk = (r: number, op: number, delay: number) =>
      `<circle r="${r}" fill="#ffd43b" opacity="0">` +
      loopOpacity(op, b + delay, cd - delay) +
      loopMotion(id, b + delay, cd - delay) +
      `</circle>`;
    return `${tag}>${emphasize}</path>${extra}${mk(9, 0.97, 0)}${mk(6, 0.5, 0.18)}`;
  });

  // ── caption band (root coordinate space, top) ────────────────────────────────
  const dimMatch = /<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/.exec(svg);
  const W = dimMatch ? parseInt(dimMatch[1], 10) : 2580;

  const wrap = (text: string, max: number): string[] => {
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
      else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const esc = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  const bandH = 140;
  const bandY = 24;
  let captions = `<g font-family="Segoe UI, Arial, sans-serif">`;
  workflow.forEach((s, k) => {
    const b = k * STEP_DUR;
    const lines = wrap(s.description, 84).slice(0, 3);
    const title = `Step ${s.step} of ${workflow.length}`;
    const textLines = lines
      .map((ln, li) => `<tspan x="60" dy="${li === 0 ? 0 : 34}">${esc(ln)}</tspan>`)
      .join("");
    captions +=
      `<g opacity="0">` +
      loopOpacity(1, b, STEP_DUR) +
      `<rect x="30" y="${bandY}" width="${W - 60}" height="${bandH}" rx="14" fill="#0b1220" fill-opacity="0.9" stroke="#1971c2" stroke-width="2"/>` +
      `<text x="60" y="${bandY + 42}" fill="#4dabf7" font-size="26" font-weight="700">${title}</text>` +
      `<text x="60" y="${bandY + 80}" fill="#e9ecef" font-size="25">${textLines}</text>` +
      `</g>`;
  });
  captions += `</g>`;

  // Reserve a strip at the top for the caption and push the whole diagram down,
  // so the caption never overlaps the canvas (the full diagram stays visible).
  const strip = bandH + 40;
  const H = dimMatch ? parseInt(dimMatch[2], 10) : 1107;
  const newH = H + strip;
  svg = svg.replace(/(<svg\b[^>]*\bheight=")\d+(")/, `$1${newH}$2`);
  svg = svg.replace(/(<svg\b[^>]*\bviewBox="0 0 \d+ )\d+(")/, `$1${newH}$2`);
  svg = svg.replace(/(<svg\b[^>]*>)/, `$1<g transform="translate(0,${strip})">`);

  // Play/Pause control: a button in the top strip + click-anywhere toggle. The
  // embedded script runs when the SVG is opened as a document in a browser and
  // calls pause/unpauseAnimations() on every <svg> (root + nested edges layer).
  // Degrades gracefully: where scripts don't run, the animation just keeps
  // playing. (Intentionally NOT added to the offline .cjs, whose SVG feeds the
  // GIF — a raster can't pause, so the button would be dead pixels there.)
  const cx = W - 52;
  const cy = bandY + 30;
  const controls =
    `<g id="wf-controls" style="cursor:pointer" font-family="Segoe UI, Arial, sans-serif">` +
    `<text x="${cx - 34}" y="${cy + 5}" text-anchor="end" fill="#93c5fd" font-size="16">Click to pause / resume</text>` +
    `<circle cx="${cx}" cy="${cy}" r="20" fill="#0b1220" stroke="#4dabf7" stroke-width="2"/>` +
    `<g id="wf-pause-icon" fill="#4dabf7"><rect x="${cx - 7}" y="${cy - 10}" width="5" height="20" rx="1.5"/><rect x="${cx + 3}" y="${cy - 10}" width="5" height="20" rx="1.5"/></g>` +
    `<g id="wf-play-icon" fill="#4dabf7" display="none"><path d="M ${cx - 6} ${cy - 11} L ${cx - 6} ${cy + 11} L ${cx + 12} ${cy} Z"/></g>` +
    `</g>`;
  const script =
    `<script type="text/javascript">(function(){var paused=false;` +
    `function all(){return document.querySelectorAll('svg');}` +
    `function apply(){all().forEach(function(s){try{paused?s.pauseAnimations():s.unpauseAnimations();}catch(e){}});` +
    `var pi=document.getElementById('wf-pause-icon'),pl=document.getElementById('wf-play-icon');` +
    `if(pi)pi.setAttribute('display',paused?'none':'inline');` +
    `if(pl)pl.setAttribute('display',paused?'inline':'none');}` +
    `function toggle(){paused=!paused;apply();}` +
    `var r=document.querySelector('svg');if(r)r.addEventListener('click',toggle);})();</script>`;
  svg = svg.replace(/<\/svg>\s*$/, `</g>${captions}${controls}${script}</svg>`);
  void TOTAL;
  return svg;
}

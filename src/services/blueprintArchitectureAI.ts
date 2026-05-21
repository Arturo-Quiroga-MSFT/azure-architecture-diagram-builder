// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Blueprint Architecture (Whiteboard / Sketchnote) generation mode.
 *
 * A second editorial mode alongside the swim-lane Reference Architecture.
 * Blueprints look like hand-drawn architecture sketches: nested pastel
 * "zones" (Azure / On-prem / VNet / Resource Group), service icons placed
 * topologically, and curved arrows with numbered step markers and short
 * descriptive labels. Inspired by the seed file at
 * Reference-Architecture-Mode/Initial-seed/1778200277653.gif.
 *
 * Phase 1: AI emits absolute coordinates so the renderer is a thin SVG
 *          pass. Phase 2 may swap in an auto-layout engine (elkjs) if
 *          coordinate quality becomes a bottleneck.
 */

import { callAzureOpenAI, ModelOverride, AIMetrics } from './azureOpenAI';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { MODEL_CONFIG, getModelSettings } from '../stores/modelSettingsStore';
import type { ComponentManifest } from './componentManifestAI';
import { renderManifestForPrompt } from './componentManifestAI';

// ──────────────────────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────────────────────

export interface BpZone {
  id: string;
  label: string;
  /** Visual style hint. Renderer maps to pastel palettes. */
  kind?: 'azure' | 'onprem' | 'vnet' | 'subnet' | 'rg' | 'external' | 'subsystem';
  /** Bounds in canvas coordinates (px). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional parent zone id for nesting. */
  parent?: string;
}

export interface BpNode {
  id: string;
  name: string;
  /** Canonical icon category (matches Azure_Public_Service_Icons). */
  category: string;
  /** Optional kind tweaks the glyph: persona/cloud render differently. */
  kind?: 'service' | 'persona' | 'cloud' | 'device' | 'database';
  /** Top-left position in canvas coordinates. */
  x: number;
  y: number;
  /** Optional zone id this node belongs to (purely for grouping logic). */
  zone?: string;
}

export interface BpEdge {
  id: string;
  from: string;             // node id
  to: string;               // node id
  /** Numbered step shown as a circled badge on the edge midpoint. */
  step?: number;
  /** Short label drawn alongside the edge. */
  label?: string;
  /** Routing hint. `orthogonal` = right-angle, `curve` = bezier. */
  routing?: 'orthogonal' | 'curve' | 'straight';
  /** Visual emphasis. */
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface BpWorkflowStep {
  step: number;
  description: string;
}

export interface BlueprintArchitecture {
  title: string;
  /** Canvas dimensions; renderer uses these directly. */
  canvas: { width: number; height: number };
  zones: BpZone[];
  nodes: BpNode[];
  edges: BpEdge[];
  workflow?: BpWorkflowStep[];
  metrics?: AIMetrics;
}

// ──────────────────────────────────────────────────────────────────────────────
// Few-shot example (single, dense example modelled after the seed sketch)
// ──────────────────────────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLE = `
EXAMPLE — Async batch processing with Azure Functions + Service Bus + Cosmos DB
+ on-prem callback via Site-to-Site VPN:
{
  "title": "Async Batch Processing — Cloud to On-Prem Callback",
  "canvas": { "width": 1600, "height": 1000 },
  "zones": [
    { "id": "azure",   "label": "Azure",            "kind": "azure",   "x": 60,   "y": 80,  "width": 1100, "height": 860 },
    { "id": "monitor", "label": "Azure Monitor",    "kind": "subsystem","x": 700,  "y": 140, "width": 420,  "height": 240, "parent": "azure" },
    { "id": "onprem",  "label": "On-Premises",      "kind": "onprem",  "x": 1220, "y": 420, "width": 320,  "height": 360 }
  ],
  "nodes": [
    { "id": "user",     "name": "End User",            "category": "general",   "kind": "persona", "x": 90,   "y": 480, "zone": "azure" },
    { "id": "client",   "name": "Client Application",  "category": "web",       "x": 220,  "y": 470, "zone": "azure" },
    { "id": "apim",     "name": "API Management",      "category": "integration","x": 380,  "y": 470, "zone": "azure" },
    { "id": "func1",    "name": "Azure Functions",     "category": "compute",   "x": 540,  "y": 470, "zone": "azure" },
    { "id": "sb",       "name": "Service Bus",         "category": "integration","x": 540,  "y": 660, "zone": "azure" },
    { "id": "func2",    "name": "Azure Functions",     "category": "compute",   "x": 740,  "y": 660, "zone": "azure" },
    { "id": "cosmos",   "name": "Azure Cosmos DB",     "category": "databases", "x": 940,  "y": 660, "zone": "azure" },
    { "id": "appins",   "name": "Application Insights","category": "monitor",   "x": 760,  "y": 200, "zone": "monitor" },
    { "id": "logs",     "name": "Log Analytics",       "category": "monitor",   "x": 960,  "y": 200, "zone": "monitor" },
    { "id": "s2s",      "name": "Site-to-Site VPN",    "category": "networking","kind": "cloud", "x": 1230, "y": 470, "zone": "azure" },
    { "id": "onpremapp","name": "On-Prem Service",     "category": "compute",   "x": 1320, "y": 600, "zone": "onprem" }
  ],
  "edges": [
    { "id": "e1", "from": "user",    "to": "client",   "step": 1, "label": "Submit batch",          "routing": "straight" },
    { "id": "e2", "from": "client",  "to": "apim",     "step": 2, "label": "POST /batch",           "routing": "straight" },
    { "id": "e3", "from": "apim",    "to": "func1",    "step": 3, "label": "Validate + enqueue",    "routing": "straight" },
    { "id": "e4", "from": "func1",   "to": "sb",       "step": 4, "label": "Queue message",         "routing": "orthogonal" },
    { "id": "e5", "from": "sb",      "to": "func2",    "step": 5, "label": "Trigger worker",        "routing": "straight" },
    { "id": "e6", "from": "func2",   "to": "cosmos",   "step": 6, "label": "Persist result",        "routing": "straight" },
    { "id": "e7", "from": "func2",   "to": "s2s",      "step": 7, "label": "Callback on-prem",      "routing": "orthogonal" },
    { "id": "e8", "from": "s2s",     "to": "onpremapp","step": 8, "label": "Replay synchronously",  "routing": "curve" },
    { "id": "e9", "from": "func2",   "to": "appins",   "label": "Telemetry",                         "routing": "curve", "style": "dashed" }
  ],
  "workflow": [
    { "step": 1, "description": "User submits a batch through the client application." },
    { "step": 2, "description": "Client POSTs the batch request to API Management." },
    { "step": 3, "description": "API Management routes to an Azure Function that validates and enqueues the work." },
    { "step": 4, "description": "The function publishes a message to Service Bus for asynchronous processing." },
    { "step": 5, "description": "A worker Function is triggered by the queue and processes the batch." },
    { "step": 6, "description": "The worker writes results to Cosmos DB." },
    { "step": 7, "description": "The worker initiates a callback over the Site-to-Site VPN." },
    { "step": 8, "description": "The on-premises service receives the callback synchronously." }
  ]
}
`.trim();

// ──────────────────────────────────────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────────────────────────────────────

export async function generateBlueprintArchitectureWithAI(
  description: string,
  modelOverride?: ModelOverride,
  manifest?: ComponentManifest,
): Promise<BlueprintArchitecture> {
  const manifestBlock = manifest ? '\n\n' + renderManifestForPrompt(manifest) : '';
  const systemPrompt = `You are an expert Azure cloud architect who creates whiteboard-style BLUEPRINT architecture diagrams — the kind a senior architect sketches on a whiteboard when explaining a system end-to-end.${manifestBlock}

Blueprint diagrams are NOT swim lanes. They use free positioning: services live inside nested "zones" (Azure subscription, VNet, on-prem network, resource groups), and flow is shown with numbered arrows carrying short labels ("POST /batch", "Trigger worker", "Persist result").

Return ONLY a valid JSON object (no markdown fences, no commentary) matching this TypeScript shape:

interface BlueprintArchitecture {
  title: string;
  canvas: { width: number; height: number };   // ALWAYS use { width: 1600, height: 1000 } unless the workload truly needs more space
  zones: Array<{
    id: string; label: string;
    kind?: "azure"|"onprem"|"vnet"|"subnet"|"rg"|"external"|"subsystem";
    x: number; y: number; width: number; height: number;   // px, top-left origin
    parent?: string;                                        // nest inside another zone
  }>;
  nodes: Array<{
    id: string; name: string; category: string;
    kind?: "service"|"persona"|"cloud"|"device"|"database";
    x: number; y: number;                                   // top-left of a 120x100 tile
    zone?: string;                                          // grouping hint
  }>;
  edges: Array<{
    id: string; from: string; to: string;
    step?: number;                                          // numbered badge on the edge
    label?: string;                                         // short verb phrase, <= 4 words ideal
    routing?: "orthogonal"|"curve"|"straight";
    style?: "solid"|"dashed"|"dotted";
  }>;
  workflow?: Array<{ step: number; description: string }>;
}

Service "category" MUST be one of:
"app services","databases","storage","networking","compute","containers","ai + machine learning","analytics","identity","monitor","iot","integration","devops","security","web","management + governance","general"

Layout rules — CRITICAL:
1. Canvas is 1600x1000 unless the workload truly needs more. Origin is top-left.
2. Each node tile occupies roughly 120w x 100h px.
3. SPACING (very important so edge labels don't collide with tiles):
   • Horizontally adjacent nodes connected by a labeled edge: at least 220px between their LEFT edges (i.e., at least 100px of empty space between tiles).
   • Vertically adjacent nodes connected by a labeled edge: at least 180px between their TOP edges (i.e., at least 80px of empty space between tiles).
   • Unrelated nearby tiles: at least 60px of empty space.
4. Zones must contain their child nodes with at least 40px padding on every side.
5. Nested zones (parent set) must lie fully inside their parent's bounds.
6. Zones do NOT overlap their siblings.
7. Place the primary entry actor (user/persona) on the LEFT. Place data stores and downstream sinks on the RIGHT or BOTTOM.
8. Arrange nodes so arrows flow LEFT→RIGHT or TOP→BOTTOM. Avoid crossings.
9. DEFAULT EVERY EDGE'S routing TO "orthogonal" unless a curved bypass is genuinely needed. Straight diagonal lines look messy on a blueprint — use right-angle paths.
10. Keep edge labels short — ideally 1–3 words, hard maximum 24 characters. Longer descriptions belong in the workflow array.

LAYOUT POLICY — tier-based row placement (apply rigorously):
A. The MAIN data-plane pipeline (entry actor → ingress → processing → primary sinks) must occupy the MIDDLE horizontal band of the canvas and flow strictly LEFT→RIGHT. This is the diagram's backbone and must be visually dominant.
B. Control-plane / management / provisioning services (e.g., Device Provisioning Service, Key Vault, deployment, Microsoft Entra ID when used for control) belong ABOVE the main pipeline. Their edges should drop DOWN into the pipeline.
C. Monitoring / observability / governance services (Azure Monitor, Log Analytics, Application Insights, Microsoft Sentinel, Defender for Cloud) also belong ABOVE the main pipeline OR in a dedicated Observability zone to the side. Their edges should be dashed (style: "dashed").
D. Storage / batch analytics / long-term data (Data Lake, Synapse, Cosmos DB, SQL, Blob, Time Series Insights for historical) belong BELOW the main pipeline. Their edges should come UP from the pipeline.
E. ML / inference / feedback loops belong adjacent to analytics (typically bottom-right). Feedback edges back into the pipeline should be visually distinct (curve routing OK here).
F. End-user dashboards / web apps belong on the FAR LEFT (if they trigger flow) or FAR RIGHT (if they consume outputs) — not in the middle row.
G. On-premises zones sit on the LEFT, connected via an explicit boundary node (Private Link, ExpressRoute, VPN Gateway) before crossing into Azure.
H. Anchor preference: inputs enter a node from its LEFT or TOP; outputs leave from its RIGHT or BOTTOM. Pick (from, to) order on edges accordingly so the natural arrow direction matches this convention.
I. Prefer connecting nodes in ADJACENT zones. Avoid edges that span the entire canvas — if two services in far-apart zones must communicate, add an intermediate hop or place them closer together.
J. Use SHORT VERB-FIRST labels: "Send telemetry", "Ingest stream", "Store raw", "Run batch", "Deploy model", "Update twins", "Publish metrics". Avoid noun-only labels like "Telemetry" when a verb fits.

Content rules:
9. Use ONLY OFFICIAL Microsoft product names that exist as Azure services ("Microsoft Entra ID", "Azure Cosmos DB", "Azure Functions", "Logic Apps", "Microsoft Sentinel", "Microsoft Defender for Cloud", "Azure Monitor", "Log Analytics", "Key Vault", "Application Insights", "API Management", "Service Bus", "Event Hubs", "Azure SQL Database", "Azure Cache for Redis", "Azure Kubernetes Service", "Azure Container Apps", etc.). Do NOT invent composite names like "Azure Workloads" or "Logic Apps Playbooks" — just use "Logic Apps". If you need a generic workloads tile, use kind: "cloud" with name "Azure Workloads" and category "compute" only as a last resort.
10. Use 5–20 nodes total. Use 3–5 zones — ALWAYS group related services into logical zones (kind: "subsystem" or "rg") such as "Edge / Ingress", "Compute / Microservices", "Messaging", "Data / Storage", "Observability", "Identity", or "On-Premises". Every service node (not personas) MUST belong to a zone via the "zone" field. A diagram with only one zone is INVALID.
11. Use 4–15 edges. EVERY edge MUST have a step number and a short label — including telemetry, logging, and observability flows (those should additionally be dashed via "style": "dashed"). Do not leave any edge unnumbered.
12. Always include a workflow array matching the numbered edges. STEP NUMBERING IS STRICT: the set of edge "step" values MUST equal exactly {1, 2, 3, …, workflow.length} with NO gaps, NO duplicates, and NO numbers beyond workflow.length. For every workflow item with "step": N, there MUST be exactly one edge whose "step" field is N and whose "label" describes that same action. If a workflow step has no obvious arrow in the topology, either (a) add an edge for it, or (b) remove that workflow item — never leave a gap.
13. Personas (users, operators) use kind: "persona" and category: "general".
14. Network gateways (Site-to-Site VPN, ExpressRoute, Front Door) use kind: "cloud".

Here is one high-quality blueprint to imitate in structure, density, and layout:

${FEW_SHOT_EXAMPLE}

Now generate a blueprint architecture for the user's request. Return JSON only.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: description },
  ];

  const activeModel = modelOverride?.model || getModelSettings().model;
  const { content, metrics } = await callAzureOpenAI(messages, modelOverride, true);
  console.log(
    `📐 Blueprint Architecture Response [${MODEL_CONFIG[activeModel].displayName}]: ${content.length} chars`,
  );

  let bp: BlueprintArchitecture;
  try {
    bp = JSON.parse(content);
  } catch (e: any) {
    console.error('Failed to parse blueprint architecture JSON:', content);
    throw new Error(`Invalid JSON in blueprint architecture response: ${e.message}`);
  }

  if (!bp.canvas || typeof bp.canvas.width !== 'number') {
    bp.canvas = { width: 1600, height: 1000 };
  }
  if (!Array.isArray(bp.zones)) bp.zones = [];
  if (!Array.isArray(bp.nodes) || bp.nodes.length === 0) {
    throw new Error('Blueprint architecture missing required "nodes" array.');
  }
  if (!Array.isArray(bp.edges)) bp.edges = [];

  // Normalize service names against the canonical icon map (skip personas/clouds).
  bp.nodes = bp.nodes.map((n) => {
    if (n.kind === 'persona' || n.kind === 'cloud') return n;
    const m = getServiceIconMapping(n.name);
    if (m) return { ...n, name: m.displayName, category: m.category };
    // Loose normalization — keep the AI's display name but pull the category
    // from a fuzzy match so the renderer can still find an icon.
    // (Avoid replacing the name itself, which would erase context like
    // "Logic Apps (response playbook)".)
    return n;
  });

  enforceSpacing(bp);
  validateStepNumbering(bp);

  // Force orthogonal routing on every edge. The prompt asks the model to do
  // this but it sometimes emits "straight"/"curved", which produces diagonal
  // lines that cut through unrelated nodes.
  for (const e of bp.edges) {
    e.routing = 'orthogonal';
  }

  bp.metrics = metrics;
  return bp;
}

// ──────────────────────────────────────────────────────────────────────────────
// Post-process: push apart nodes that the AI placed too close, then re-fit zones.
// ──────────────────────────────────────────────────────────────────────────────
const NODE_W = 150;
const NODE_H = 100;
const MIN_H_GAP = 120; // empty space between horizontally adjacent tiles
const MIN_V_GAP = 95;  // empty space between vertically adjacent tiles
const ZONE_PAD = 44;
const MIN_ZONE_GAP = 70; // empty space between sibling zones

function enforceSpacing(bp: BlueprintArchitecture): void {
  if (!bp.nodes?.length) return;
  const nodes = bp.nodes;

  // Run several passes — each pass only fixes one violation per pair, so a few
  // iterations let the layout settle.
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const ax2 = a.x + NODE_W;
        const ay2 = a.y + NODE_H;
        const bx2 = b.x + NODE_W;
        const by2 = b.y + NODE_H;

        const yOverlap = Math.min(ay2, by2) - Math.max(a.y, b.y);
        const xOverlap = Math.min(ax2, bx2) - Math.max(a.x, b.x);

        if (yOverlap > 0 && xOverlap > -MIN_H_GAP) {
          // Need horizontal separation.
          const need = MIN_H_GAP - (-xOverlap); // empty gap requirement
          // Determine which is on the right.
          if (a.x <= b.x) {
            b.x += Math.max(0, need);
          } else {
            a.x += Math.max(0, need);
          }
          if (need > 0) moved = true;
        } else if (xOverlap > 0 && yOverlap > -MIN_V_GAP) {
          // Need vertical separation.
          const need = MIN_V_GAP - (-yOverlap);
          if (a.y <= b.y) {
            b.y += Math.max(0, need);
          } else {
            a.y += Math.max(0, need);
          }
          if (need > 0) moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Re-fit zones to contain their children + padding. Process leaves first so
  // parent zones expand around their freshly-resized children.
  const zones = bp.zones || [];
  const depth = (z: BpZone): number => (z.parent ? 1 + depth(zones.find(p => p.id === z.parent)!) : 0);

  const fitAll = () => {
    const ordered = [...zones].sort((a, b) => depth(b) - depth(a));
    for (const z of ordered) {
      const childNodes = nodes.filter(n => n.zone === z.id);
      const childZones = zones.filter(c => c.parent === z.id);
      if (!childNodes.length && !childZones.length) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of childNodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + NODE_W);
        maxY = Math.max(maxY, n.y + NODE_H);
      }
      for (const c of childZones) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + c.width);
        maxY = Math.max(maxY, c.y + c.height);
      }
      // Tighten to actual content (with padding) — both shrink and grow.
      z.x = minX - ZONE_PAD;
      z.y = minY - ZONE_PAD;
      z.width = (maxX + ZONE_PAD) - z.x;
      z.height = (maxY + ZONE_PAD) - z.y;
    }
  };

  // Collect a zone and all its descendant zones.
  const descendants = (root: BpZone): Set<string> => {
    const out = new Set<string>([root.id]);
    const walk = (pid: string) => {
      for (const z of zones) if (z.parent === pid) { out.add(z.id); walk(z.id); }
    };
    walk(root.id);
    return out;
  };
  // Shift a zone + everything inside it (descendant zones + nodes).
  const shiftZone = (root: BpZone, dx: number, dy: number) => {
    const ids = descendants(root);
    for (const z of zones) if (ids.has(z.id)) { z.x += dx; z.y += dy; }
    for (const n of nodes) if (n.zone && ids.has(n.zone)) { n.x += dx; n.y += dy; }
  };

  // Push sibling zones apart so MESSAGING doesn't kiss CONTAINER APPS etc.
  const spaceSiblings = () => {
    let moved = false;
    // Group zones by parent (undefined = top-level group).
    const groups = new Map<string | undefined, BpZone[]>();
    for (const z of zones) {
      const key = z.parent;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(z);
    }
    for (const siblings of groups.values()) {
      for (let i = 0; i < siblings.length; i++) {
        for (let j = i + 1; j < siblings.length; j++) {
          const a = siblings[i];
          const b = siblings[j];
          const ax2 = a.x + a.width, ay2 = a.y + a.height;
          const bx2 = b.x + b.width, by2 = b.y + b.height;
          const xOverlap = Math.min(ax2, bx2) - Math.max(a.x, b.x);
          const yOverlap = Math.min(ay2, by2) - Math.max(a.y, b.y);
          if (yOverlap > 0 && xOverlap > -MIN_ZONE_GAP) {
            const need = MIN_ZONE_GAP - (-xOverlap);
            if (need > 0) {
              if (a.x <= b.x) shiftZone(b, need, 0);
              else shiftZone(a, need, 0);
              moved = true;
            }
          } else if (xOverlap > 0 && yOverlap > -MIN_ZONE_GAP) {
            const need = MIN_ZONE_GAP - (-yOverlap);
            if (need > 0) {
              if (a.y <= b.y) shiftZone(b, 0, need);
              else shiftZone(a, 0, need);
              moved = true;
            }
          }
        }
      }
    }
    return moved;
  };

  // Iterate fit → space-siblings → re-fit until stable (or max 6 passes).
  fitAll();
  for (let i = 0; i < 6; i++) {
    const moved = spaceSiblings();
    if (!moved) break;
    fitAll();
  }

  // Grow canvas to contain everything.
  let maxX = bp.canvas.width;
  let maxY = bp.canvas.height;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + NODE_W + 40);
    maxY = Math.max(maxY, n.y + NODE_H + 40);
  }
  for (const z of zones) {
    maxX = Math.max(maxX, z.x + z.width + 20);
    maxY = Math.max(maxY, z.y + z.height + 20);
  }
  bp.canvas.width = maxX;
  bp.canvas.height = maxY;
}

// Best-effort repair: if workflow declares steps 1..N but some edges are missing
// their `step`, try to fill the gaps by matching label words. Anything we can't
// match is logged so the issue surfaces in dev.
function validateStepNumbering(bp: BlueprintArchitecture): void {
  const wf = bp.workflow || [];
  if (wf.length === 0) return;

  const expected = new Set<number>();
  for (let i = 1; i <= wf.length; i++) expected.add(i);
  const present = new Set<number>();
  for (const e of bp.edges) if (typeof e.step === 'number') present.add(e.step);

  const missing: number[] = [];
  for (const n of expected) if (!present.has(n)) missing.push(n);

  if (missing.length === 0) return;

  // Try to fill: for each missing step, find an unnumbered edge whose label
  // shares a significant word with the workflow description.
  const stop = new Set(['the', 'a', 'an', 'to', 'and', 'or', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'be', 'into', 'from', 'by', 'via']);
  const tokens = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w));

  const unnumbered = bp.edges.filter((e) => e.step === undefined && e.label);
  const stillMissing: number[] = [];

  for (const step of missing) {
    const desc = wf.find((w) => w.step === step)?.description || '';
    const descTokens = new Set(tokens(desc));
    let best: { edge: typeof unnumbered[number]; score: number } | undefined;
    for (const e of unnumbered) {
      if (e.step !== undefined) continue;
      const labelTokens = tokens(e.label || '');
      let score = 0;
      for (const t of labelTokens) if (descTokens.has(t)) score++;
      if (score > 0 && (!best || score > best.score)) best = { edge: e, score };
    }
    if (best) best.edge.step = step;
    else stillMissing.push(step);
  }

  if (stillMissing.length > 0) {
    console.warn(
      `⚠️ Blueprint workflow has ${wf.length} steps but edges are missing step numbers: [${stillMissing.join(', ')}]. The AI did not produce edges for these steps.`,
    );
  }
}

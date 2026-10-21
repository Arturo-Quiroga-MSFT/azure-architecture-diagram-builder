/**
 * Technical deep dive: how the Azure Architecture Diagram Builder runs —
 * platform, identity, releases, Voice Live, MCP server, pricing, telemetry.
 *
 * Shares the overview deck's palette and type so the two can be presented
 * back to back. Facts come from the source (server/, scripts/production/,
 * src/data/pricing/snapshot-manifest.json, mcp-server/) and production
 * telemetry for 28 Sep – 20 Oct 2026.
 *
 * aadb-runtime.png is AADB's own render_diagram output (MCP tool, dark theme,
 * TB layout) with a line-style legend added; aadb-runtime.svg is the source.
 *
 * Run:  node decks/platform-deep-dive/build.cjs
 * Output: decks/platform-deep-dive/AADB-Platform-Deep-Dive.pptx
 */
const path = require('path');
const pptxgen = require('pptxgenjs');

const C = {
  navy: '0B1F3A', navy2: '102A4C', panel: '0E2746', azure: '0078D4', cyan: '50E6FF', teal: '2EC5CE',
  ink: '12233B', slate: '5B6B82', cloud: 'F4F7FB', card: 'FFFFFF', line: 'D9E2EC', white: 'FFFFFF',
  green: '3FB950', amber: 'F2A900', purple: '8764B8', soft: 'B9CAE3', softer: 'DCE8F8',
};
const FONT = 'Segoe UI';
const MONO = 'Consolas';
const W = 13.33;
const H = 7.5;
const TOTAL = 11;

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: W, height: H });
pres.layout = 'WIDE';
pres.author = 'Azure Architecture Diagram Builder';
pres.title = 'Azure Architecture Diagram Builder — Platform Deep Dive';

const softShadow = () => ({ type: 'outer', color: '0A1422', blur: 9, offset: 3, angle: 90, opacity: 0.18 });
const cardShadow = () => ({ type: 'outer', color: '233247', blur: 7, offset: 2, angle: 90, opacity: 0.12 });

function footer(s, idx, dark) {
  const col = dark ? 'AFC3DF' : C.slate;
  s.addText('Azure Architecture Diagram Builder · Platform deep dive', { x: 0.5, y: H - 0.55, w: 8, h: 0.3, fontFace: FONT, fontSize: 10, color: col, margin: 0 });
  s.addText(`${idx} / ${TOTAL}`, { x: W - 1.5, y: H - 0.55, w: 1.0, h: 0.3, fontFace: FONT, fontSize: 10, color: col, align: 'right', margin: 0 });
}

function header(s, kicker, title, dark, accent) {
  const acc = accent || (dark ? C.cyan : C.azure);
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 0.55, w: 0.16, h: 0.62, fill: { color: acc } });
  s.addText(kicker.toUpperCase(), { x: 0.78, y: 0.5, w: 11, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: acc, charSpacing: 3, margin: 0 });
  s.addText(title, { x: 0.76, y: 0.78, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: dark ? C.white : C.ink, margin: 0 });
}

function card(s, x, y, w, h, accent, dark) {
  s.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: dark ? C.navy2 : C.card }, line: { color: dark ? '1F3A5C' : C.line, width: 1 }, shadow: dark ? softShadow() : cardShadow(),
  });
  if (accent) s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.1, fill: { color: accent } });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — Title
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.azure } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: C.cyan } });
  // Motif: a small stack of layers (platform)
  [['0078D4', 0], ['2EC5CE', 0.32], ['50E6FF', 0.64]].forEach(([col, dy]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: 10.45 + dy * 0.4, y: 1.0 + dy, w: 1.9, h: 0.24, fill: { color: col }, line: { color: C.navy, width: 1 } });
  });
  s.addText('UNDER THE HOOD', { x: 0.9, y: 2.3, w: 11, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.cyan, charSpacing: 6, margin: 0 });
  s.addText('How AADB Runs', { x: 0.85, y: 2.7, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: C.white, margin: 0 });
  s.addText('Platform, identity, releases, Voice Live, MCP and pricing behind AADB.', {
    x: 0.9, y: 4.0, w: 11.2, h: 0.75, fontFace: FONT, fontSize: 20, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  const chips = ['Keyless by design', 'Reversible releases', 'Voice Live relay', '13 MCP tools', '14-region pricing'];
  let cx = 0.9;
  chips.forEach((t) => {
    const w = 0.42 + t.length * 0.105;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 5.05, w, h: 0.46, fill: { color: C.navy2 }, line: { color: C.azure, width: 1 }, rectRadius: 0.23 });
    s.addText(t, { x: cx, y: 5.05, w, h: 0.46, fontFace: FONT, fontSize: 12, color: C.softer, align: 'center', valign: 'middle', margin: 0 });
    cx += w + 0.22;
  });
  s.addText('Technical deep dive · L300 · AADB v2.1.10 · October 2026', { x: 0.9, y: 6.5, w: 9, h: 0.35, fontFace: FONT, fontSize: 13, color: '7E93B4', margin: 0 });
  footer(s, 1, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — Runtime at a glance (AADB drew this itself)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: '1E1E1E' };
  s.addText([
    { text: 'RUNTIME AT A GLANCE   ', options: { color: C.cyan, bold: true, charSpacing: 3 } },
    { text: 'drawn by AADB itself through its render_diagram MCP tool', options: { color: C.soft } },
  ], { x: 0.5, y: 0.25, w: 12.3, h: 0.4, fontFace: FONT, fontSize: 13, margin: 0 });
  const iw = 12.3, ih = iw * (676 / 1532);
  s.addImage({ path: path.join(__dirname, 'aadb-runtime.png'), x: (W - iw) / 2, y: 0.8, w: iw, h: ih });
  s.addText('Every arrow into Azure services uses the app\'s managed identity; the only keys in the system are the hashed MCP client keys.', {
    x: 0.5, y: 0.8 + ih + 0.15, w: 12.3, h: 0.35, fontFace: FONT, fontSize: 12, italic: true, color: C.soft, margin: 0,
  });
  footer(s, 2, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — Keyless by design (table)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Identity', 'Keyless by design: every hop, how it authenticates');
  const rows = [
    ['Hop', 'Credential', 'How'],
    ['Browser → token server', 'None needed', 'Same origin; no keys or model endpoints in the bundle'],
    ['Token server → Foundry (14 models)', 'Managed identity', 'Cognitive Services User + Foundry User roles'],
    ['Token server → Voice Live', 'Managed identity', 'Server opens the realtime session; browser only streams audio'],
    ['Browser → Speech avatar', 'Short-lived Entra token', 'Minted per session by /api/speech-token'],
    ['Token server → Cosmos DB', 'Managed identity', 'Data Contributor; local auth off; private endpoint only'],
    ['Container Apps → registry', 'Managed identity', 'AcrPull; no registry admin credentials'],
    ['Browser → Azure (Import)', "The user's own token", 'MSAL delegated sign-in; Resource Graph runs with the user\'s RBAC'],
    ['Agents → MCP server', 'Named API key', 'Only SHA-256 hashes stored; revocable per client'],
  ];
  const x = 0.6, top = 1.65, tw = 12.13, rowH = 0.5;
  const c0 = 3.55, c1 = 2.65, c2 = tw - c0 - c1;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const head = i === 0;
    const keyed = r[1] === 'Named API key';
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: tw, h: rowH, fill: { color: head ? C.navy : (i % 2 ? C.card : 'EEF3F9') }, line: { color: C.line, width: 0.5 } });
    s.addText(r[0], { x: x + 0.18, y, w: c0 - 0.25, h: rowH, fontFace: FONT, fontSize: 12.5, bold: true, color: head ? C.white : C.ink, valign: 'middle', margin: 0 });
    s.addText(r[1], { x: x + c0, y, w: c1 - 0.15, h: rowH, fontFace: FONT, fontSize: 12.5, bold: true, color: head ? C.white : (keyed ? 'B07800' : '1F7A3A'), valign: 'middle', margin: 0 });
    s.addText(r[2], { x: x + c0 + c1, y, w: c2 - 0.2, h: rowH, fontFace: FONT, fontSize: 12, color: head ? C.white : C.slate, valign: 'middle', margin: 0 });
  });
  s.addText('Result: no API key or secret ever reaches the browser, and none is stored for any Azure service.', {
    x: 0.6, y: top + rows.length * rowH + 0.3, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.azure, margin: 0,
  });
  footer(s, 3, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 — Hosting and network (nested boxes)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Hosting', 'One container per app, inside a private network');

  // Left: nested network drawing
  const nx = 0.6, ny = 1.7, nw = 7.2, nh = 4.9;
  s.addShape(pres.shapes.RECTANGLE, { x: nx, y: ny, w: nw, h: nh, fill: { color: 'EAF2FB' }, line: { color: C.azure, width: 1.5, dashType: 'dash' } });
  s.addText('VNet 10.60.0.0/22', { x: nx + 0.2, y: ny + 0.12, w: 4, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.azure, margin: 0 });

  const sx = nx + 0.25, sy = ny + 0.55, sw = 4.3, sh = 4.1;
  s.addShape(pres.shapes.RECTANGLE, { x: sx, y: sy, w: sw, h: sh, fill: { color: C.card }, line: { color: C.purple, width: 1.25 } });
  s.addText('Container Apps environment · subnet /23', { x: sx + 0.15, y: sy + 0.08, w: sw - 0.3, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.purple, margin: 0 });

  const box = (x, y, w, h, title, lines, accent) => {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: 'F7F9FC' }, line: { color: accent, width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.08, h, fill: { color: accent } });
    s.addText(title, { x: x + 0.2, y: y + 0.08, w: w - 0.3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.ink, margin: 0 });
    s.addText(lines, { x: x + 0.2, y: y + 0.4, w: w - 0.3, h: h - 0.45, fontFace: FONT, fontSize: 10.5, color: C.slate, margin: 0, valign: 'top' });
  };
  box(sx + 0.2, sy + 0.5, sw - 0.4, 1.85, 'azure-diagram-builder', 'nginx serves the React SPA and proxies /api to the Node token server in the same container: model proxy, Voice Live relay, speech tokens, feedback, health and readiness.', C.azure);
  box(sx + 0.2, sy + 2.5, sw - 0.4, 1.4, 'azure-diagram-mcp', 'MCP server over Streamable HTTP (/mcp) with /healthz; the same tools run locally over stdio.', C.teal);

  const px = sx + sw + 0.3, pw = nx + nw - px - 0.2;
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: sy, w: pw, h: 2.35, fill: { color: C.card }, line: { color: C.green, width: 1.25 } });
  s.addText([
    { text: 'Private endpoints · /27', options: { bold: true, color: '1F7A3A', breakLine: true } },
    { text: 'Cosmos DB, resolved through the private DNS zone', options: { color: C.slate, breakLine: true } },
    { text: 'privatelink.documents.azure.com', options: { color: C.ink, fontFace: MONO, fontSize: 9 } },
  ], { x: px + 0.12, y: sy + 0.1, w: pw - 0.24, h: 2.1, fontFace: FONT, fontSize: 10.5, margin: 0, valign: 'top' });

  // Right: facts
  const fx = 8.1, fw = 4.63;
  const facts = [
    ['Images', 'Immutable tags v<version>-<git sha>, built in Azure Container Registry and pulled with managed identity.', C.azure],
    ['Probes', '/api/ready gates each revision; /api/health reports the running version.', C.teal],
    ['Scale', 'Each active revision keeps a replica warm; after a release only the newest three stay active.', C.green],
  ];
  facts.forEach((f, i) => {
    const y = 1.7 + i * 1.7;
    card(s, fx, y, fw, 1.5, null, false);
    s.addShape(pres.shapes.RECTANGLE, { x: fx, y, w: 0.1, h: 1.5, fill: { color: f[2] } });
    s.addText(f[0], { x: fx + 0.3, y: y + 0.15, w: fw - 0.5, h: 0.35, fontFace: FONT, fontSize: 15, bold: true, color: C.ink, margin: 0 });
    s.addText(f[1], { x: fx + 0.3, y: y + 0.55, w: fw - 0.5, h: 0.9, fontFace: FONT, fontSize: 12, color: C.slate, margin: 0, valign: 'top' });
  });
  footer(s, 4, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 — Safe releases (process flow)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Releases', 'Every release is a reversible experiment');
  const steps = [
    ['Version gate', 'package.json is the single version source; an equal or older version is rejected.', C.azure],
    ['Immutable image', 'Tag v<ver>-<sha>; a dirty worktree is refused, so the image is exactly a commit.', C.teal],
    ['Candidate revision', 'Created with readiness probes while production traffic stays pinned to the current revision.', C.cyan],
    ['Direct smoke test', 'Health and version checked on the candidate\'s own URL before it sees users.', C.green],
    ['Traffic switch', '100% moves to the candidate; the previous revision stays active at 0%.', C.amber],
    ['One-command rollback', 'The script prints the exact command to move traffic back.', C.purple],
  ];
  const n = steps.length, gap = 0.3, sx = 0.6, tw = 12.13, bw = (tw - gap * (n - 1)) / n, y = 1.85, bh = 3.15;
  steps.forEach((st, i) => {
    const x = sx + i * (bw + gap);
    card(s, x, y, bw, bh, st[2], false);
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.32, w: 0.52, h: 0.52, fill: { color: st[2] } });
    s.addText(String(i + 1), { x: x + 0.2, y: y + 0.32, w: 0.52, h: 0.52, fontFace: FONT, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    s.addText(st[0], { x: x + 0.18, y: y + 1.0, w: bw - 0.3, h: 0.7, fontFace: FONT, fontSize: 14, bold: true, color: C.ink, margin: 0, valign: 'top' });
    s.addText(st[1], { x: x + 0.18, y: y + 1.7, w: bw - 0.3, h: bh - 1.8, fontFace: FONT, fontSize: 11.5, color: C.slate, margin: 0, valign: 'top' });
    if (i < n - 1) s.addText('›', { x: x + bw, y: y + 0.3, w: gap, h: 0.52, fontFace: FONT, fontSize: 26, bold: true, color: C.ink, align: 'center', margin: 0 });
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.4, w: 12.13, h: 0.75, fill: { color: C.navy } });
  s.addText([
    { text: 'Today: ', options: { bold: true, color: C.cyan } },
    { text: 'v2.1.10 serves production with v2.1.9 one command away · six releases shipped this way in ten days.', options: { color: C.softer } },
  ], { x: 0.9, y: 5.4, w: 11.6, h: 0.75, fontFace: FONT, fontSize: 14, valign: 'middle', margin: 0 });
  footer(s, 5, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 — Release gate
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Quality', 'One release gate for laptops, pull requests and Azure');

  const gx = 0.6, gw = 7.3;
  card(s, gx, 1.7, gw, 4.9, null, false);
  s.addText('npm run verify:release', { x: gx + 0.3, y: 1.85, w: gw - 0.6, h: 0.45, fontFace: MONO, fontSize: 18, bold: true, color: C.azure, margin: 0 });
  const gates = [
    ['check:lockfiles', 'every dependency resolves through the package proxy'],
    ['typecheck + lint', 'TypeScript strict checks and ESLint'],
    ['build + bundle budget', 'production build stays inside measured size limits'],
    ['test:deterministic', '21 regression suites: layout, imports, pricing, guards, telemetry'],
    ['test:version', 'UI, /version.json and package.json agree'],
    ['test:smoke', 'Playwright drives a mocked generation workflow'],
  ];
  gates.forEach((g, i) => {
    const y = 2.45 + i * 0.66;
    s.addShape(pres.shapes.OVAL, { x: gx + 0.32, y: y + 0.1, w: 0.3, h: 0.3, fill: { color: C.green } });
    s.addText('✓', { x: gx + 0.32, y: y + 0.1, w: 0.3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });
    s.addText(g[0], { x: gx + 0.8, y, w: 2.7, h: 0.5, fontFace: MONO, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', margin: 0 });
    s.addText(g[1], { x: gx + 3.5, y, w: gw - 3.75, h: 0.5, fontFace: FONT, fontSize: 12, color: C.slate, valign: 'middle', margin: 0 });
  });

  const px = 8.25, pw = 4.48;
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: 1.7, w: pw, h: 4.9, fill: { color: C.navy }, shadow: softShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: 1.7, w: pw, h: 0.12, fill: { color: C.cyan } });
  s.addText('21', { x: px + 0.3, y: 2.0, w: pw - 0.6, h: 1.1, fontFace: FONT, fontSize: 64, bold: true, color: C.white, margin: 0 });
  s.addText('deterministic regression suites, no model calls, so they are fast and repeatable', {
    x: px + 0.3, y: 3.1, w: pw - 0.6, h: 0.9, fontFace: FONT, fontSize: 14, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  s.addText([
    { text: 'Same gate everywhere', options: { bold: true, color: C.cyan, breakLine: true } },
    { text: 'Pull requests, pushes to main and the manual Azure workflow all run it. CI also runs the MCP server\'s catalog, contract and rendering tests.', options: { color: C.softer } },
  ], { x: px + 0.3, y: 3.95, w: pw - 0.6, h: 2.4, fontFace: FONT, fontSize: 13.5, margin: 0, valign: 'top' });
  footer(s, 6, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 — Voice Live relay (dark, sequence)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  header(s, 'Voice Live', 'Ava draws the diagram, but never sees a key', true, C.cyan);

  const lanes = [
    ['Browser', 'Mic audio · canvas · generation pipeline', C.azure],
    ['Relay · /api/voice-live', 'Owns model, voice, instructions and tools', C.teal],
    ['Voice Live', 'gpt-realtime-2.1 · Ava HD voice', C.purple],
  ];
  const lx = [0.9, 5.0, 9.1], lw = 3.3, ly = 1.75;
  lanes.forEach((l, i) => {
    s.addShape(pres.shapes.RECTANGLE, { x: lx[i], y: ly, w: lw, h: 0.85, fill: { color: C.navy2 }, line: { color: l[2], width: 1.5 } });
    s.addText(l[0], { x: lx[i] + 0.15, y: ly + 0.06, w: lw - 0.3, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: C.white, margin: 0, align: 'center' });
    s.addText(l[1], { x: lx[i] + 0.15, y: ly + 0.44, w: lw - 0.3, h: 0.35, fontFace: FONT, fontSize: 10.5, color: 'C7D6EC', margin: 0, align: 'center' });
    s.addShape(pres.shapes.LINE, { x: lx[i] + lw / 2, y: ly + 0.85, w: 0, h: 3.4, line: { color: '35557F', width: 1.25, dashType: 'dash' } });
  });
  const mid = (i) => lx[i] + lw / 2;
  const msg = (from, to, y, label, color) => {
    const x1 = mid(from), x2 = mid(to);
    s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y, w: Math.abs(x2 - x1), h: 0, line: { color, width: 2, endArrowType: x2 > x1 ? 'triangle' : undefined, beginArrowType: x2 < x1 ? 'triangle' : undefined } });
    s.addText(label, { x: Math.min(x1, x2) + 0.1, y: y - 0.34, w: Math.abs(x2 - x1) - 0.2, h: 0.3, fontFace: FONT, fontSize: 11, color: C.softer, align: 'center', margin: 0 });
  };
  msg(0, 1, 3.05, 'WebSocket: microphone audio only', C.azure);
  msg(1, 2, 3.6, 'Session opened with managed identity', C.teal);
  msg(2, 1, 4.15, 'Tool call: draw_architecture(brief)', C.purple);
  msg(1, 0, 4.7, 'Forward call; browser runs the pipeline', C.teal);
  msg(0, 1, 5.25, 'tool.result for that call_id only', C.azure);
  msg(1, 2, 5.8, 'Result returned; Ava speaks the outcome', C.teal);

  s.addShape(pres.shapes.RECTANGLE, { x: 0.9, y: 6.1, w: 11.5, h: 0.62, fill: { color: C.panel }, line: { color: C.cyan, width: 1 } });
  s.addText('Guards: client-event allow-list · 256 KB frames · tool output capped at 8,000 chars · results only for calls the model made · 5 sessions × 10 min', {
    x: 1.05, y: 6.1, w: 11.2, h: 0.62, fontFace: FONT, fontSize: 12, color: C.softer, valign: 'middle', margin: 0,
  });
  footer(s, 7, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8 — MCP server
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Agents', 'The same design logic as 13 deterministic MCP tools');

  const cols = [
    ['Design', ['list_services', 'validate_architecture', 'harden_architecture', 'get_waf_rules'], C.azure],
    ['Cost', ['estimate_costs', 'compare_region_costs'], C.cyan],
    ['Build', ['generate_bicep', 'generate_terraform', 'generate_deployment_guide', 'generate_manifest'], C.green],
    ['Interop', ['render_diagram', 'export_reactflow_scene', 'import_architecture'], C.amber],
  ];
  const gap = 0.25, cw = (12.13 - 3 * gap) / 4, sx = 0.6, y = 1.7, ch = 2.4;
  cols.forEach((c, i) => {
    const x = sx + i * (cw + gap);
    card(s, x, y, cw, ch, c[2], false);
    s.addText(c[0], { x: x + 0.22, y: y + 0.25, w: cw - 0.4, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.ink, margin: 0 });
    s.addText(c[1].map((t, j) => ({ text: t, options: { breakLine: j < c[1].length - 1 } })), {
      x: x + 0.22, y: y + 0.75, w: cw - 0.4, h: ch - 0.9, fontFace: MONO, fontSize: 12.5, color: '3A4A5C', margin: 0, valign: 'top', paraSpaceAfter: 6,
    });
  });

  const by = 4.45, bw = (12.13 - 2 * 0.25) / 3, bh = 1.4;
  const facts = [
    ['Contracts', 'Typed structuredContent with declared output schemas; 3 resources and 3 starter prompts.'],
    ['Transports + auth', 'stdio locally; Streamable HTTP hosted with named API keys (hashes only), optional Entra for self-hosting.'],
    ['Clients', 'GitHub Copilot in VS Code, Copilot CLI, Microsoft Scout and the Azure SRE Agent.'],
  ];
  facts.forEach((f, i) => {
    const x = 0.6 + i * (bw + 0.25);
    s.addShape(pres.shapes.RECTANGLE, { x, y: by, w: bw, h: bh, fill: { color: C.navy } });
    s.addText(f[0], { x: x + 0.25, y: by + 0.15, w: bw - 0.5, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.cyan, margin: 0 });
    s.addText(f[1], { x: x + 0.25, y: by + 0.55, w: bw - 0.5, h: bh - 0.65, fontFace: FONT, fontSize: 12, color: C.softer, margin: 0, valign: 'top' });
  });
  footer(s, 8, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9 — Pricing engine
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Pricing', 'Native retail prices, shipped with the app');

  const stats = [
    ['14', 'native pricing regions', C.azure],
    ['81', 'service queries per region', C.teal],
    ['1,043', 'price files downloaded', C.cyan],
    ['29 Sep', 'current snapshot (2026)', C.green],
  ];
  const cw = 2.8075, gap = 0.3, sx = 0.6, y = 1.65, ch = 1.55;
  stats.forEach((c, i) => {
    const x = sx + i * (cw + gap);
    card(s, x, y, cw, ch, c[2], false);
    s.addText(c[0], { x, y: y + 0.22, w: cw, h: 0.75, fontFace: FONT, fontSize: 32, bold: true, color: C.ink, align: 'center', valign: 'middle', margin: 0 });
    s.addText(c[1], { x: x + 0.1, y: y + 1.0, w: cw - 0.2, h: 0.4, fontFace: FONT, fontSize: 12, color: C.slate, align: 'center', margin: 0 });
  });

  const rules = [
    ['Snapshot, not live calls', 'Azure Retail Prices data ships as per-region JSON: fast, offline, deterministic.'],
    ['Meter selection rules', 'One representative meter per service and tier; duplicate restatements demoted.'],
    ['Two terms', 'Pay-as-you-go or a 1-year term; a SKU without a 1-year meter stays at pay-as-you-go.'],
    ['Honest about usage', 'Usage-based services show ranges; exports carry a "Prices as of" stamp.'],
    ['Fabric and Microsoft IQ', 'Fabric Capacity (F2–F2048) carries the cost; Foundry IQ prices as AI Search.'],
  ];
  rules.forEach((r, i) => {
    const ry = 3.45 + i * 0.6;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: ry, w: 0.1, h: 0.48, fill: { color: [C.azure, C.teal, C.cyan, C.green, C.amber][i] } });
    s.addText(r[0], { x: 0.85, y: ry, w: 3.1, h: 0.48, fontFace: FONT, fontSize: 13, bold: true, color: C.ink, valign: 'middle', margin: 0 });
    s.addText(r[1], { x: 3.95, y: ry, w: 8.8, h: 0.48, fontFace: FONT, fontSize: 12, color: C.slate, valign: 'middle', margin: 0 });
  });
  footer(s, 9, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10 — Observability
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  header(s, 'Observability', 'Three telemetry planes, each answering one question');

  const planes = [
    ['Is it used?', 'Browser · Application Insights', 'Feature events, counts and coarse geography; never prompts, diagrams or model output.', '329 users · 37 countries', C.azure],
    ['What does it cost?', 'Server · Log Analytics', 'Every model call: model, tokens, latency, status, concurrency. The authoritative traffic record.', '2,560 calls · 99.0% success', '1A8A93'],
    ['Who calls the agents API?', 'MCP · Log Analytics', 'One line per request: auth result, key name, client and tools called.', 'Attributed per key', '1F7A3A'],
  ];
  const gap = 0.25, cw = (12.13 - 2 * gap) / 3, y = 1.7, ch = 3.15;
  planes.forEach((p, i) => {
    const x = 0.6 + i * (cw + gap);
    card(s, x, y, cw, ch, p[4], false);
    s.addText(p[0], { x: x + 0.25, y: y + 0.28, w: cw - 0.5, h: 0.45, fontFace: FONT, fontSize: 18, bold: true, color: C.ink, margin: 0 });
    s.addText(p[1], { x: x + 0.25, y: y + 0.78, w: cw - 0.5, h: 0.3, fontFace: FONT, fontSize: 11.5, bold: true, color: p[4], margin: 0 });
    s.addText(p[2], { x: x + 0.25, y: y + 1.18, w: cw - 0.5, h: 1.5, fontFace: FONT, fontSize: 12, color: C.slate, margin: 0, valign: 'top' });
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.25, y: y + ch - 0.7, w: cw - 0.5, h: 0.45, fill: { color: 'EEF3F9' } });
    s.addText(p[3], { x: x + 0.35, y: y + ch - 0.7, w: cw - 0.7, h: 0.45, fontFace: FONT, fontSize: 12, bold: true, color: C.ink, valign: 'middle', margin: 0 });
  });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.2, w: 12.13, h: 1.1, fill: { color: C.navy } });
  s.addText([
    { text: 'Workbooks: ', options: { bold: true, color: C.cyan } },
    { text: 'LLM Cost Monitor · Server Usage & Guardrails · MCP Usage Monitor · Feedback · WAF Findings.', options: { color: C.softer, breakLine: true } },
    { text: 'Numbers shown: 28\u00A0Sep\u00A0–\u00A020\u00A0Oct\u00A02026.', options: { color: C.soft, italic: true } },
  ], { x: 0.9, y: 5.2, w: 11.6, h: 1.1, fontFace: FONT, fontSize: 13.5, valign: 'middle', margin: 0 });
  footer(s, 10, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11 — Run your own (dark close)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.azure } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: C.cyan } });
  s.addText('RUN YOUR OWN', { x: 0.9, y: 0.85, w: 11, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.cyan, charSpacing: 4, margin: 0 });
  s.addText('Three ways to put it to work', { x: 0.86, y: 1.2, w: 11.5, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.white, margin: 0 });

  const ways = [
    ['Use the hosted app', 'aka.ms/diagram-builder', 'Production v2.1.10 with Voice Live, 14 models and every export.', C.cyan],
    ['Deploy it yourself', 'azd up', 'Greenfield Bicep provisions Foundry with GPT-5.6 Luna, Container Apps and identity in your subscription.', '4DA3FF'],
    ['Give agents the tools', 'mcp-server/', 'Run the 13 tools over stdio, or point Copilot and Scout at a hosted endpoint with an API key.', C.green],
  ];
  const gap = 0.25, cw = (12.13 - 2 * gap) / 3, y = 2.4, ch = 2.35;
  ways.forEach((w, i) => {
    const x = 0.6 + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.navy2 }, line: { color: '1F3A5C', width: 1 }, shadow: softShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.12, fill: { color: w[3] } });
    s.addText(w[0], { x: x + 0.3, y: y + 0.35, w: cw - 0.6, h: 0.45, fontFace: FONT, fontSize: 18, bold: true, color: C.white, margin: 0 });
    s.addText(w[1], { x: x + 0.3, y: y + 0.9, w: cw - 0.6, h: 0.4, fontFace: MONO, fontSize: 14, bold: true, color: w[3], margin: 0 });
    s.addText(w[2], { x: x + 0.3, y: y + 1.45, w: cw - 0.6, h: ch - 1.6, fontFace: FONT, fontSize: 13, color: C.soft, margin: 0, valign: 'top' });
  });
  s.addText('github.com/Arturo-Quiroga-MSFT/azure-architecture-diagram-builder', {
    x: 0.6, y: 5.2, w: 12.1, h: 0.45, fontFace: FONT, fontSize: 14, bold: true, color: 'AFC3DF', align: 'center', margin: 0,
  });
  footer(s, 11, true);
}

const out = path.join(__dirname, 'AADB-Platform-Deep-Dive.pptx');
pres.writeFile({ fileName: out }).then((f) => console.log('✅ Wrote', f)).catch((e) => { console.error(e); process.exit(1); });

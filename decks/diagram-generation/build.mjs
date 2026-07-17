// Technical deck: "How a Diagram Is Born" — the end-to-end diagram generation
// pipeline for AI PSAs. Dark premium theme. Purple = LLM stages, teal =
// deterministic stages. Healthcare FHIR example threaded throughout.
import pptxgen from 'pptxgenjs';
import { existsSync } from 'node:fs';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.author = 'Azure Architecture Diagram Builder';
pres.title = 'How a Diagram Is Born — Generation Pipeline';

const W = 13.333, H = 7.5, M = 0.6;

// ── Palette ──────────────────────────────────────────────────────────────────
const BG = '0E1330';        // deep indigo background
const BG2 = '0A0E24';       // darker (title/close)
const PANEL = '1A2150';     // card on dark
const PANEL2 = '141A40';    // secondary card
const BORDER = '2C356E';    // subtle card border
const INK = 'F5F7FF';       // primary text
const MUTE = '99A2CC';      // muted text
const FAINT = '6A74A6';     // faint labels
const LLM = 'A579F2';       // LLM / model stages (purple)
const LLM_DK = '6D3FC7';
const DET = '2FD1C0';       // deterministic stages (teal)
const DET_DK = '128E82';
const NEUTRAL = '8892C4';   // input / neutral
const GOLD = 'F2B03C';      // cost / callouts
const HDR = 'Consolas';     // header/mono font (technical identity)
const BODY = 'Calibri';

// 10-stage pipeline (index 0..9). type drives color.
const STAGES = [
  { n: '01', t: 'Input',            k: 'in'  },
  { n: '02', t: 'Prompt assembly',  k: 'llm' },
  { n: '03', t: 'Model call',       k: 'llm' },
  { n: '04', t: 'JSON contract',    k: 'llm' },
  { n: '05', t: 'Parse + normalize',k: 'det' },
  { n: '06', t: 'Icon resolution',  k: 'det' },
  { n: '07', t: 'Groups / zones',   k: 'det' },
  { n: '08', t: 'Edges',            k: 'det' },
  { n: '09', t: 'Layout engine',    k: 'det' },
  { n: '10', t: 'Costing',          k: 'det' },
];
const kColor = (k) => (k === 'llm' ? LLM : k === 'det' ? DET : NEUTRAL);
const kColorDk = (k) => (k === 'llm' ? LLM_DK : k === 'det' ? DET_DK : '3A4270');

// ── Helpers ──────────────────────────────────────────────────────────────────
function bg(slide, color = BG) {
  slide.background = { color };
}
function footer(slide, page) {
  slide.addText('Azure Architecture Diagram Builder', { x: M, y: H - 0.42, w: 6, h: 0.3, fontFace: BODY, fontSize: 9, color: FAINT, align: 'left', margin: 0 });
  slide.addText(`${page} / 16`, { x: W - M - 1.2, y: H - 0.42, w: 1.2, h: 0.3, fontFace: HDR, fontSize: 9, color: FAINT, align: 'right', margin: 0 });
}
// Compact progress strip at top of stage slides; highlights the active stage.
function progress(slide, activeIdx) {
  const y = 1.28, h = 0.12, gap = 0.06;
  const totalW = W - 2 * M;
  const segW = (totalW - gap * (STAGES.length - 1)) / STAGES.length;
  STAGES.forEach((s, i) => {
    const x = M + i * (segW + gap);
    const active = i === activeIdx;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: segW, h,
      fill: { color: active ? kColor(s.k) : PANEL },
      line: { type: 'none' },
    });
  });
  const a = STAGES[activeIdx];
  slide.addText([
    { text: `STAGE ${a.n}  `, options: { color: kColor(a.k), bold: true } },
    { text: a.k === 'llm' ? 'LLM' : a.k === 'det' ? 'DETERMINISTIC' : 'ENTRY', options: { color: MUTE } },
  ], { x: M, y: 0.86, w: totalW, h: 0.32, fontFace: HDR, fontSize: 11, align: 'left', margin: 0, charSpacing: 1 });
}
function title(slide, text) {
  slide.addText(text, { x: M, y: 0.36, w: W - 2 * M, h: 0.5, fontFace: HDR, fontSize: 26, bold: true, color: INK, align: 'left', margin: 0 });
}
function card(slide, x, y, w, h, fill = PANEL, border = BORDER) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: border, width: 1 } });
}
function chip(slide, x, y, w, label, color) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.34, rectRadius: 0.05, fill: { color: PANEL2 }, line: { color, width: 1 } });
  slide.addText(label, { x, y, w, h: 0.34, fontFace: HDR, fontSize: 10.5, color, align: 'center', valign: 'middle', margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); bg(s, BG2);
  // vertical accent bars
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: H, fill: { color: LLM } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.16, y: 0, w: 0.16, h: H, fill: { color: DET } });
  s.addText('DIAGRAM GENERATION PIPELINE', { x: M, y: 1.5, w: 10, h: 0.4, fontFace: HDR, fontSize: 13, color: DET, charSpacing: 3, margin: 0 });
  s.addText('How a Diagram Is Born', { x: M, y: 2.0, w: 12, h: 1.2, fontFace: HDR, fontSize: 52, bold: true, color: INK, margin: 0 });
  s.addText('From a natural-language prompt to a costed Azure architecture — every stage, end to end.',
    { x: M, y: 3.35, w: 11.4, h: 0.7, fontFace: BODY, fontSize: 18, color: MUTE, margin: 0 });
  // legend
  s.addShape(pres.shapes.OVAL, { x: M, y: 4.5, w: 0.22, h: 0.22, fill: { color: LLM } });
  s.addText('LLM decides structure', { x: M + 0.32, y: 4.44, w: 4, h: 0.34, fontFace: BODY, fontSize: 14, color: INK, margin: 0, valign: 'middle' });
  s.addShape(pres.shapes.OVAL, { x: M + 4.2, y: 4.5, w: 0.22, h: 0.22, fill: { color: DET } });
  s.addText('Deterministic code decides visuals', { x: M + 4.52, y: 4.44, w: 5, h: 0.34, fontFace: BODY, fontSize: 14, color: INK, margin: 0, valign: 'middle' });
  s.addText([
    { text: 'Technical walkthrough for AI PSAs', options: { color: DET, bold: true } },
    { text: '   •   Worked example: HIPAA-compliant Healthcare FHIR API', options: { color: FAINT } },
  ], { x: M, y: 5.6, w: 12, h: 0.4, fontFace: HDR, fontSize: 12.5, margin: 0 });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — The core idea (two columns)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); bg(s);
  title(s, 'The one idea that explains everything');
  s.addText('The model never picks a pixel, an icon, or a price. It emits a strict JSON contract; deterministic engines do the rest.',
    { x: M, y: 0.98, w: W - 2 * M, h: 0.5, fontFace: BODY, fontSize: 15, color: MUTE, margin: 0 });

  const colW = (W - 2 * M - 0.5) / 2, cy = 1.75, ch = 4.7;
  // LLM column
  card(s, M, cy, colW, ch, PANEL, LLM_DK);
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: cy, w: colW, h: 0.7, fill: { color: LLM_DK } });
  s.addText('LLM  ·  the semantic step', { x: M + 0.3, y: cy, w: colW - 0.6, h: 0.7, fontFace: HDR, fontSize: 16, bold: true, color: INK, valign: 'middle', margin: 0 });
  s.addText([
    { text: 'Interprets intent from natural language', options: { bullet: true, breakLine: true } },
    { text: 'Chooses which Azure services fit', options: { bullet: true, breakLine: true } },
    { text: 'Assigns services to logical groups', options: { bullet: true, breakLine: true } },
    { text: 'Declares connections + a workflow narrative', options: { bullet: true, breakLine: true } },
    { text: 'Outputs JSON only — no coordinates, no styling', options: { bullet: true } },
  ], { x: M + 0.35, y: cy + 0.95, w: colW - 0.7, h: ch - 1.2, fontFace: BODY, fontSize: 14.5, color: INK, lineSpacingMultiple: 1.25, margin: 0 });

  // Deterministic column
  const x2 = M + colW + 0.5;
  card(s, x2, cy, colW, ch, PANEL, DET_DK);
  s.addShape(pres.shapes.RECTANGLE, { x: x2, y: cy, w: colW, h: 0.7, fill: { color: DET_DK } });
  s.addText('CODE  ·  the visual step', { x: x2 + 0.3, y: cy, w: colW - 0.6, h: 0.7, fontFace: HDR, fontSize: 16, bold: true, color: INK, valign: 'middle', margin: 0 });
  s.addText([
    { text: 'Normalizes names against a curated icon map', options: { bullet: true, breakLine: true } },
    { text: 'Resolves each service to a real Azure SVG', options: { bullet: true, breakLine: true } },
    { text: 'Renders groups as containers, typed edges', options: { bullet: true, breakLine: true } },
    { text: 'Computes every position (Dagre / ELK)', options: { bullet: true, breakLine: true } },
    { text: 'Prices services from Azure Retail Prices data', options: { bullet: true } },
  ], { x: x2 + 0.35, y: cy + 0.95, w: colW - 0.7, h: ch - 1.2, fontFace: BODY, fontSize: 14.5, color: INK, lineSpacingMultiple: 1.25, margin: 0 });

  s.addText('Why it matters: reproducible, model-swappable, and correct-by-construction — not "AI magic."',
    { x: M, y: 6.55, w: W - 2 * M, h: 0.4, fontFace: HDR, fontSize: 12.5, color: DET, margin: 0 });
  footer(s, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Pipeline overview (the map)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); bg(s);
  title(s, 'The pipeline: 10 stages, one JSON contract in the middle');
  s.addText('Purple stages run in the model. Teal stages run as deterministic code in the browser + token server.',
    { x: M, y: 0.98, w: W - 2 * M, h: 0.4, fontFace: BODY, fontSize: 14, color: MUTE, margin: 0 });

  // 2 rows of 5 cards
  const cols = 5, rows = 2, gapx = 0.32, gapy = 0.5;
  const cw = (W - 2 * M - gapx * (cols - 1)) / cols, chh = 1.85;
  const top = 1.7;
  STAGES.forEach((st, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const x = M + c * (cw + gapx), y = top + r * (chh + gapy);
    const col = kColor(st.k);
    card(s, x, y, cw, chh, PANEL, BORDER);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.1, fill: { color: col } });
    s.addText(st.n, { x: x + 0.18, y: y + 0.22, w: cw - 0.36, h: 0.5, fontFace: HDR, fontSize: 22, bold: true, color: col, margin: 0 });
    s.addText(st.t, { x: x + 0.18, y: y + 0.78, w: cw - 0.36, h: 0.8, fontFace: HDR, fontSize: 12.5, bold: true, color: INK, margin: 0 });
    s.addText(st.k === 'llm' ? 'LLM' : st.k === 'det' ? 'code' : 'entry',
      { x: x + 0.18, y: y + chh - 0.42, w: cw - 0.36, h: 0.3, fontFace: HDR, fontSize: 9.5, color: MUTE, charSpacing: 1, margin: 0 });
  });
  footer(s, 3);
}

// ── Generic stage slide builder ──────────────────────────────────────────────
function stageSlide(idx, heading, bullets, codeTitle, codeLines, opts = {}) {
  const s = pres.addSlide(); bg(s);
  progress(s, idx);
  s.addText(heading, { x: M, y: 1.55, w: W - 2 * M, h: 0.55, fontFace: HDR, fontSize: 24, bold: true, color: INK, margin: 0 });
  const bodyTop = 2.35;
  const leftW = codeLines ? 5.7 : (W - 2 * M);
  s.addText(bullets, { x: M, y: bodyTop, w: leftW, h: 4.2, fontFace: BODY, fontSize: 15, color: INK, lineSpacingMultiple: 1.28, margin: 0,
    // bullets is a rich-text array already
  });
  if (codeLines) {
    const cx = M + leftW + 0.5, cw = W - M - cx, cy = bodyTop - 0.05, chh = 4.35;
    card(s, cx, cy, cw, chh, PANEL2, BORDER);
    s.addText(codeTitle, { x: cx + 0.25, y: cy + 0.16, w: cw - 0.5, h: 0.3, fontFace: HDR, fontSize: 10.5, color: (opts.codeColor || DET), charSpacing: 1, margin: 0 });
    s.addShape(pres.shapes.LINE, { x: cx + 0.25, y: cy + 0.52, w: cw - 0.5, h: 0, line: { color: BORDER, width: 1 } });
    s.addText(codeLines, { x: cx + 0.25, y: cy + 0.62, w: cw - 0.5, h: chh - 0.8, fontFace: HDR, fontSize: opts.codeSize || 10, color: INK, lineSpacingMultiple: 1.12, margin: 0 });
  }
  footer(s, opts.page);
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Stage 1: Input
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(0, 'Input — one prompt, four entry points',
  [
    { text: 'Natural language is the primary path — free-form intent, no schema required.', options: { bullet: true, breakLine: true } },
    { text: 'Voice input is transcribed (Azure Speech) into the same prompt box.', options: { bullet: true, breakLine: true } },
    { text: 'Two deterministic entry points skip the model entirely:', options: { bullet: true, breakLine: true } },
    { text: 'Import Template — ARM JSON parsed directly (<1s)', options: { bullet: true, indentLevel: 1, breakLine: true, color: MUTE } },
    { text: 'Import from Azure — live Resource Graph of a resource group', options: { bullet: true, indentLevel: 1, breakLine: true, color: MUTE } },
    { text: 'Everything converges on the same architecture object downstream.', options: { bullet: true } },
  ],
  'EXAMPLE PROMPT (ACTUAL)', [
    { text: '"A HIPAA-compliant healthcare data', options: { breakLine: true } },
    { text: ' platform integrating EHR systems', options: { breakLine: true } },
    { text: ' via HL7 FHIR R4 APIs, PACS/DICOM', options: { breakLine: true } },
    { text: ' imaging (500TB), clinical decision', options: { breakLine: true } },
    { text: ' support, patient portal + secure', options: { breakLine: true } },
    { text: ' messaging, PHI audit logging,', options: { breakLine: true } },
    { text: ' 15-min RPO DR…"', options: { breakLine: true, color: DET } },
    { text: '', options: { breakLine: true } },
    { text: '→ sent verbatim as the user message', options: { color: MUTE } },
  ], { page: 4, codeColor: NEUTRAL });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Stage 2: Prompt assembly
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(1, 'Prompt assembly — the system prompt does the heavy lifting',
  [
    { text: 'Role: "expert Azure cloud architect… return a JSON specification."', options: { bullet: true, breakLine: true } },
    { text: 'Known-services catalog injected from SERVICE_ICON_MAP so the model uses exact display names.', options: { bullet: true, breakLine: true } },
    { text: 'Icon-category vocabulary (17 categories) constrains the "category" field.', options: { bullet: true, breakLine: true } },
    { text: '13 rules encode Microsoft-reference-architecture conventions: grouping, edge budget, hub-and-spoke monitoring, service caps.', options: { bullet: true, breakLine: true } },
    { text: 'The exact output JSON schema is spelled out inline.', options: { bullet: true } },
  ],
  'SYSTEM PROMPT (EXCERPT)', [
    { text: 'DO NOT include position, x, y,', options: { color: LLM, breakLine: true } },
    { text: 'width or height — the layout', options: { color: LLM, breakLine: true } },
    { text: 'engine calculates positions.', options: { color: LLM, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'Rules (excerpt):', options: { color: MUTE, breakLine: true } },
    { text: '1  Create 2-5 logical groups', options: { breakLine: true } },
    { text: '3  Use "Microsoft Entra ID"', options: { breakLine: true } },
    { text: '9  Hub-and-spoke for monitoring', options: { breakLine: true } },
    { text: '10 Limit connections to 12-18', options: { breakLine: true } },
    { text: '12 Total services: 8-12 max', options: {} },
  ], { page: 5, codeColor: LLM, codeSize: 10.5 });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — Stage 3: Model call
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(2, 'Model call — proxied, model-agnostic, JSON-only',
  [
    { text: 'The browser never holds the API key. All traffic goes through the token server at /api/openai (the security boundary).', options: { bullet: true, breakLine: true } },
    { text: '12 selectable models (GPT-5.x, DeepSeek, Grok, Mistral, Kimi) — the pipeline is identical regardless of model.', options: { bullet: true, breakLine: true } },
    { text: 'The system + user messages are sent; JSON output is requested.', options: { bullet: true, breakLine: true } },
    { text: 'Latency + token metrics are captured and attached to the result for the leaderboard.', options: { bullet: true } },
  ],
  'REQUEST SHAPE', [
    { text: 'POST /api/openai', options: { color: DET, breakLine: true } },
    { text: 'messages: [', options: { breakLine: true } },
    { text: '  { role: "system", content: … },', options: { breakLine: true } },
    { text: '  { role: "user",   content: prompt }', options: { breakLine: true } },
    { text: ']', options: { breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'key stays server-side  ✔', options: { color: GOLD, breakLine: true } },
    { text: 'model swappable         ✔', options: { color: GOLD } },
  ], { page: 6, codeColor: LLM });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — Stage 4: The JSON contract
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(3, 'The JSON contract — four sections, zero coordinates',
  [
    { text: 'groups — logical containers (id + label only).', options: { bullet: true, breakLine: true } },
    { text: 'services — id, name, type, category, description, groupId.', options: { bullet: true, breakLine: true } },
    { text: 'connections — from, to, label, type (sync/async/optional).', options: { bullet: true, breakLine: true } },
    { text: 'workflow — ordered steps, each listing the service IDs involved.', options: { bullet: true, breakLine: true } },
    { text: 'This contract is the single hand-off from "AI" to "code." Everything after here is deterministic.', options: { bullet: true, color: DET } },
  ],
  'RESPONSE SCHEMA', [
    { text: '{', options: { breakLine: true } },
    { text: '  "groups":      [{ id, label }],', options: { breakLine: true } },
    { text: '  "services":    [{ id, name, type,', options: { breakLine: true } },
    { text: '                   category, groupId }],', options: { color: MUTE, breakLine: true } },
    { text: '  "connections": [{ from, to, label,', options: { breakLine: true } },
    { text: '                   type }],', options: { color: MUTE, breakLine: true } },
    { text: '  "workflow":    [{ step, description,', options: { breakLine: true } },
    { text: '                   services:[…] }]', options: { color: MUTE, breakLine: true } },
    { text: '}', options: { breakLine: true } },
    { text: '// no x, y, width, height', options: { color: LLM } },
  ], { page: 7, codeColor: LLM });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — Stage 5: Parse + normalize
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(4, 'Parse + normalize — trust, but verify the model',
  [
    { text: 'JSON.parse with strict error handling; malformed output is rejected, not rendered.', options: { bullet: true, breakLine: true } },
    { text: 'Every service is matched against SERVICE_ICON_MAP by name, then by type.', options: { bullet: true, breakLine: true } },
    { text: 'On a match, the code overwrites name, type and category with the curated canonical values — so a diagram is consistent even if the model is loose.', options: { bullet: true, breakLine: true } },
    { text: 'Fuzzy matching catches near-misses (e.g. "FHIR service" → Azure Health Data Services).', options: { bullet: true } },
  ],
  'NORMALIZATION', [
    { text: 'mapping = getServiceIconMapping(', options: { breakLine: true } },
    { text: '  service.name) ||', options: { breakLine: true } },
    { text: '  getServiceIconMapping(service.type)', options: { breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'if (mapping) {', options: { breakLine: true } },
    { text: '  name     = mapping.displayName', options: { color: DET, breakLine: true } },
    { text: '  category = mapping.category', options: { color: DET, breakLine: true } },
    { text: '}', options: { breakLine: true } },
    { text: '🔧 "FHIR API" → Azure Health', options: { color: GOLD, breakLine: true } },
    { text: '   Data Services (databases)', options: { color: GOLD } },
  ], { page: 8, codeColor: DET });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — Stage 6: Icon resolution
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(5, 'Icon resolution — the official Azure icon set, not clip-art',
  [
    { text: 'The icon map holds { displayName, category, iconFile } per service.', options: { bullet: true, breakLine: true } },
    { text: 'The SVG path is built deterministically from category + iconFile.', options: { bullet: true, breakLine: true } },
    { text: '714 official Azure SVG icons across 29 category folders are glob-loaded at build time.', options: { bullet: true, breakLine: true } },
    { text: 'Because the category is validated upstream, every node gets a real, correct product icon — no guessing at render time.', options: { bullet: true } },
  ],
  'PATH RESOLUTION', [
    { text: '/Azure_Public_Service_Icons', options: { color: DET, breakLine: true } },
    { text: '  /Icons', options: { color: DET, breakLine: true } },
    { text: '    /{category}', options: { color: DET, breakLine: true } },
    { text: '      /{iconFile}.svg', options: { color: DET, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'e.g. databases/', options: { color: MUTE, breakLine: true } },
    { text: '  10142-icon-service-Azure-', options: { breakLine: true } },
    { text: '  API-for-FHIR.svg', options: { breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '714 icons · 29 categories', options: { color: GOLD } },
  ], { page: 9, codeColor: DET });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — Stage 7: Groups / zones
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(6, 'Groups & zones — structure the model already chose',
  [
    { text: 'Each service carries a groupId; groups become compound container nodes.', options: { bullet: true, breakLine: true } },
    { text: 'Prompt rules shape the topology: 2-5 groups, max 6 services each.', options: { bullet: true, breakLine: true } },
    { text: 'Directional flow is enforced: Ingress/Edge → Application → Data, left-to-right.', options: { bullet: true, breakLine: true } },
    { text: 'Cross-cutting zones are pinned: Identity/Security bottom-left, Monitoring bottom-right.', options: { bullet: true, breakLine: true } },
    { text: 'Tightly-coupled services are kept in the same group to minimize cross-group clutter.', options: { bullet: true } },
  ],
  'ACTUAL GROUPS (FHIR EXAMPLE)', [
    { text: '▸ Ingress and Patient Access', options: { color: DET, breakLine: true } },
    { text: '    App Service', options: { color: MUTE, breakLine: true } },
    { text: '▸ Application and Clinical Workflows', options: { color: DET, breakLine: true } },
    { text: '    Azure Functions, Logic Apps', options: { color: MUTE, breakLine: true } },
    { text: '▸ Healthcare Data and Storage', options: { color: DET, breakLine: true } },
    { text: '    FHIR API, DICOM, Cosmos DB, Storage', options: { color: MUTE, breakLine: true } },
    { text: '▸ Identity and Security', options: { color: DET, breakLine: true } },
    { text: '    Entra ID, Key Vault, Defender', options: { color: MUTE, breakLine: true } },
    { text: '▸ Monitoring and Observability', options: { color: DET, breakLine: true } },
    { text: '    Azure Monitor, Log Analytics', options: { color: MUTE } },
  ], { page: 10, codeColor: DET, codeSize: 10 });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 11 — Stage 8: Edges
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(7, 'Edges — typed, budgeted, and styled by meaning',
  [
    { text: 'Each connection becomes a React Flow edge from source to target node.', options: { bullet: true, breakLine: true } },
    { text: 'Edge type drives the visual style — no manual styling needed:', options: { bullet: true, breakLine: true } },
    { text: 'sync → solid (HTTP/SQL) · async → dashed (queues/events) · optional → dotted (fallback)', options: { bullet: true, indentLevel: 1, breakLine: true, color: MUTE } },
    { text: 'Labels must be action-oriented ("Submit FHIR bundle"), never generic ("data").', options: { bullet: true, breakLine: true } },
    { text: 'A 12-18 edge budget + hub-and-spoke monitoring keeps the graph legible.', options: { bullet: true } },
  ],
  'EDGE TYPES', [
    { text: 'sync      ───────  solid', options: { color: DET, breakLine: true } },
    { text: 'async     — — — —  dashed', options: { color: LLM, breakLine: true } },
    { text: 'optional  · · · ·  dotted', options: { color: MUTE, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'Monitoring pattern:', options: { color: GOLD, breakLine: true } },
    { text: '  compute → Azure Monitor', options: { breakLine: true } },
    { text: '          → Log Analytics', options: { breakLine: true } },
    { text: '  (one hub edge, not N edges)', options: { color: MUTE } },
  ], { page: 11, codeColor: DET });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 12 — Stage 9: Layout engine
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(8, 'Layout — where every pixel actually comes from',
  [
    { text: 'The model supplies zero coordinates; the layout engine computes them all.', options: { bullet: true, breakLine: true } },
    { text: 'Dagre (default): hierarchical, compound-node graph. Services nest inside their group; rankdir + nodesep/ranksep set the flow.', options: { bullet: true, breakLine: true } },
    { text: 'ELK (alternative): layered algorithm for denser graphs — same interface, swappable.', options: { bullet: true, breakLine: true } },
    { text: 'Layout presets + a re-layout action let users re-flow without regenerating.', options: { bullet: true } },
  ],
  'DAGRE CONFIG', [
    { text: 'g = new dagre.graphlib.Graph(', options: { breakLine: true } },
    { text: '      { compound: true })', options: { breakLine: true } },
    { text: 'g.setGraph({', options: { breakLine: true } },
    { text: '  rankdir:  "LR",', options: { color: DET, breakLine: true } },
    { text: '  nodesep:  …,  ranksep: …,', options: { breakLine: true } },
    { text: '})', options: { breakLine: true } },
    { text: 'g.setParent(svc.id, group.id)', options: { color: DET, breakLine: true } },
    { text: 'g.setEdge(conn.from, conn.to)', options: { color: DET, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'Dagre  |  ELK  — swappable', options: { color: GOLD } },
  ], { page: 12, codeColor: DET });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 13 — Stage 10: Costing
// ═══════════════════════════════════════════════════════════════════════════
stageSlide(9, 'Costing — grounded in Azure Retail Prices, per region',
  [
    { text: 'Each normalized service maps to a pricing meter from Azure Retail Prices snapshots.', options: { bullet: true, breakLine: true } },
    { text: 'Pricing data ships per region (8 regions) as local JSON — fast, offline, deterministic.', options: { bullet: true, breakLine: true } },
    { text: 'calculateMonthlyCost sums PAYG estimates; 1-year Reserved is shown side-by-side.', options: { bullet: true, breakLine: true } },
    { text: 'Microsoft Fabric bills at the shared F-SKU capacity; OneLake storage is separate.', options: { bullet: true, breakLine: true } },
    { text: 'Cost updates live as you change region or edit the diagram.', options: { bullet: true } },
  ],
  'PRICING LOOKUP', [
    { text: 'src/data/pricing/regions/', options: { color: DET, breakLine: true } },
    { text: '  eastus2/azure_api_for_fhir.json', options: { breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '{ "retailPrice": 0.25,', options: { breakLine: true } },
    { text: '  "unitOfMeasure": "1 Hour",', options: { color: MUTE, breakLine: true } },
    { text: '  "armRegionName": "eastus2" }', options: { color: MUTE, breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: '8 regions · PAYG + 1-yr reserved', options: { color: GOLD } },
  ], { page: 13, codeColor: DET });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 14 — Worked example (rendered representation)
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); bg(s, BG2);

  const IMG = 'healthcare-fhir.png';
  const hasImg = existsSync(new URL(`./${IMG}`, import.meta.url));

  if (hasImg) {
    // ── Full-bleed diagram (aspect preserved), overlays on top ──────────────
    // Source PNG is ~1297×768 (≈1.69:1); fit to full slide height.
    const ih = H, iw = ih * (1297 / 768), ix = (W - iw) / 2;
    s.addImage({ path: IMG, x: ix, y: 0, w: iw, h: ih, sizing: { type: 'contain', w: iw, h: ih } });

    // Title pill (top-left overlay)
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.35, y: 0.3, w: 6.9, h: 0.62, rectRadius: 0.08, fill: { color: BG2, transparency: 14 }, line: { color: DET, width: 1 } });
    s.addText([
      { text: 'WORKED EXAMPLE   ', options: { color: DET, bold: true } },
      { text: 'Healthcare FHIR — real exported diagram', options: { color: INK } },
    ], { x: 0.55, y: 0.3, w: 6.6, h: 0.62, fontFace: HDR, fontSize: 12.5, valign: 'middle', margin: 0, charSpacing: 1 });

    // Cost band (bottom, full-width overlay)
    const by = H - 0.86;
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: by, w: W, h: 0.86, fill: { color: BG2, transparency: 10 }, line: { type: 'none' } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: by, w: W, h: 0.05, fill: { color: GOLD } });
    s.addText([
      { text: '$287', options: { color: GOLD, bold: true, fontSize: 20 } },
      { text: ' /mo PAYG', options: { color: INK, fontSize: 12 } },
    ], { x: 0.5, y: by + 0.02, w: 2.6, h: 0.82, fontFace: HDR, valign: 'middle', margin: 0 });
    s.addText([
      { text: 'East US 2', options: { color: MUTE } },
      { text: '     12 services  ·  5 groups  ·  14 edges (9 sync / 5 async)', options: { color: INK } },
      { text: '     Azure Retail Prices snapshot', options: { color: MUTE } },
    ], { x: 3.15, y: by, w: 8.9, h: 0.86, fontFace: BODY, fontSize: 12, valign: 'middle', margin: 0 });
    s.addText('14 / 16', { x: W - 1.2, y: by, w: 1.0, h: 0.86, fontFace: HDR, fontSize: 10, color: FAINT, align: 'right', valign: 'middle', margin: 0 });
    s.addText('DICOM tier unpriced in this snapshot',
      { x: 0.5, y: by - 0.32, w: 7, h: 0.28, fontFace: BODY, fontSize: 9, italic: true, color: FAINT, margin: 0 });
  } else {
    // ── Fallback: stylized schematic + cost card (no PNG present) ───────────
    title(s, 'Worked example — the Healthcare FHIR diagram');
    s.addText('The same prompt, resolved through all 10 stages into grouped services, typed edges, and a monthly estimate.',
      { x: M, y: 0.98, w: W - 2 * M, h: 0.4, fontFace: BODY, fontSize: 14, color: MUTE, margin: 0 });
    const top = 1.7;
    const cx = M + 9.05, cw = W - M - cx;
    const drawGroup = (x, y, w, h, label, color, svcs) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: PANEL2 }, line: { color, width: 1.5 } });
      s.addText(label, { x: x + 0.12, y: y + 0.08, w: w - 0.24, h: 0.3, fontFace: HDR, fontSize: 10.5, bold: true, color, margin: 0 });
      svcs.forEach((sv, i) => {
        const sy = y + 0.44 + i * 0.44;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.14, y: sy, w: w - 0.28, h: 0.36, rectRadius: 0.04, fill: { color: PANEL }, line: { color: BORDER, width: 1 } });
        s.addText(sv, { x: x + 0.24, y: sy, w: w - 0.4, h: 0.36, fontFace: BODY, fontSize: 10.5, color: INK, valign: 'middle', margin: 0 });
      });
    };
    drawGroup(M,        top,        2.5, 1.8, 'INGRESS / EDGE', DET, ['Front Door', 'App Gateway (WAF)']);
    drawGroup(M + 2.9,  top,        2.7, 1.8, 'APPLICATION',    DET, ['API Management', 'Azure API for FHIR']);
    drawGroup(M + 6.0,  top,        2.7, 1.8, 'DATA',           DET, ['Health Data Services', 'Blob Storage']);
    drawGroup(M,        top + 2.15, 2.5, 1.8, 'IDENTITY & SEC', LLM, ['Microsoft Entra ID', 'Key Vault']);
    drawGroup(M + 6.0,  top + 2.15, 2.7, 1.8, 'MONITORING',     GOLD,['Azure Monitor', 'Log Analytics']);
    const arrow = (x1, y1, x2, y2, color, dash) => s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width: 2, dashType: dash || 'solid', endArrowType: 'triangle' } });
    arrow(M + 2.5, top + 0.9, M + 2.9, top + 0.9, DET);
    arrow(M + 5.6, top + 0.9, M + 6.0, top + 0.9, DET);
    arrow(M + 1.25, top + 2.15, M + 2.9, top + 1.4, LLM, 'dash');
    arrow(M + 7.3, top + 1.8, M + 7.3, top + 2.15, GOLD);
    card(s, cx, top, cw, 3.95, PANEL, GOLD);
    s.addText('MONTHLY ESTIMATE', { x: cx + 0.2, y: top + 0.18, w: cw - 0.4, h: 0.3, fontFace: HDR, fontSize: 10.5, color: GOLD, charSpacing: 1, margin: 0 });
    s.addText('~$287', { x: cx + 0.2, y: top + 0.5, w: cw - 0.4, h: 0.7, fontFace: HDR, fontSize: 30, bold: true, color: INK, margin: 0 });
    s.addText('PAYG / month · East US 2', { x: cx + 0.2, y: top + 1.2, w: cw - 0.4, h: 0.3, fontFace: BODY, fontSize: 11, color: MUTE, margin: 0 });
    s.addText([
      { text: '12 services', options: { bullet: true, breakLine: true } },
      { text: '5 groups', options: { bullet: true, breakLine: true } },
      { text: '14 edges · 9 sync / 5 async', options: { bullet: true, breakLine: true } },
      { text: 'Azure Retail Prices · eastus2', options: { bullet: true, color: GOLD } },
    ], { x: cx + 0.2, y: top + 1.7, w: cw - 0.4, h: 2.0, fontFace: BODY, fontSize: 12, color: INK, lineSpacingMultiple: 1.2, margin: 0 });
    s.addText('Real exported diagram · monthly total summed from per-service Azure Retail Prices (East US 2); DICOM tier unpriced in this snapshot.',
      { x: M, y: 6.55, w: W - 2 * M, h: 0.3, fontFace: BODY, fontSize: 10, italic: true, color: FAINT, margin: 0 });
    footer(s, 14);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 15 — LLM vs deterministic recap table
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); bg(s);
  title(s, 'Who does what — the boundary, stage by stage');

  const rows = [
    ['Stage', 'LLM (purple)', 'Deterministic code (teal)'],
    ['Input', '—', 'Capture prompt / template / ARG'],
    ['Prompt assembly', 'Receives rules + schema', 'Build system prompt from icon map'],
    ['Model call', 'Infers architecture', 'Proxy key, capture metrics'],
    ['JSON contract', 'Emits groups/services/edges', 'Validate JSON shape'],
    ['Normalize', '—', 'Canonicalize names + categories'],
    ['Icons', '—', 'Resolve category → real SVG'],
    ['Groups & edges', 'Chose grouping + flows', 'Build containers + typed edges'],
    ['Layout', '—', 'Compute all positions (Dagre/ELK)'],
    ['Costing', '—', 'Map to Retail Prices, sum monthly'],
  ];
  const top = 1.35, rowH = 0.5, x = M, tw = W - 2 * M;
  const c0 = 2.6, c1 = 4.2, c2 = tw - c0 - c1;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const head = i === 0;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: tw, h: rowH, fill: { color: head ? PANEL : (i % 2 ? PANEL2 : BG) }, line: { color: BORDER, width: 0.5 } });
    s.addText(r[0], { x: x + 0.15, y, w: c0 - 0.2, h: rowH, fontFace: HDR, fontSize: head ? 12 : 11.5, bold: head, color: head ? INK : INK, valign: 'middle', margin: 0 });
    s.addText(r[1], { x: x + c0, y, w: c1 - 0.1, h: rowH, fontFace: BODY, fontSize: head ? 12 : 11.5, bold: head, color: head ? LLM : (r[1] === '—' ? FAINT : MUTE), valign: 'middle', margin: 0 });
    s.addText(r[2], { x: x + c0 + c1, y, w: c2 - 0.1, h: rowH, fontFace: BODY, fontSize: head ? 12 : 11.5, bold: head, color: head ? DET : INK, valign: 'middle', margin: 0 });
  });
  // color spine
  s.addShape(pres.shapes.RECTANGLE, { x: x + c0 - 0.03, y: top, w: 0.03, h: rowH * rows.length, fill: { color: LLM } });
  s.addShape(pres.shapes.RECTANGLE, { x: x + c0 + c1 - 0.03, y: top, w: 0.03, h: rowH * rows.length, fill: { color: DET } });
  footer(s, 15);
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 16 — Why it matters / close
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); bg(s, BG2);
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: H, fill: { color: DET } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.16, y: 0, w: 0.16, h: H, fill: { color: LLM } });
  s.addText('WHY THIS DESIGN WINS', { x: M, y: 1.1, w: 10, h: 0.4, fontFace: HDR, fontSize: 13, color: DET, charSpacing: 3, margin: 0 });
  s.addText('The contract is the product', { x: M, y: 1.55, w: 12, h: 0.9, fontFace: HDR, fontSize: 38, bold: true, color: INK, margin: 0 });

  const items = [
    ['Reproducible', 'Same JSON → same diagram, every time. No render-time guessing.'],
    ['Model-swappable', 'All 12 models flow through one pipeline; swap models freely.'],
    ['Correct by construction', 'Curated icon map + validation beat model hallucination.'],
    ['Fast where it counts', 'ARM & Resource Graph imports skip the model — sub-second.'],
  ];
  const cw = (W - 2 * M - 0.5) / 2, chh = 1.5;
  items.forEach((it, i) => {
    const r = Math.floor(i / 2), c = i % 2;
    const x = M + c * (cw + 0.5), y = 2.75 + r * (chh + 0.35);
    card(s, x, y, cw, chh, PANEL, BORDER);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.1, h: chh, fill: { color: i % 2 ? LLM : DET } });
    s.addText(it[0], { x: x + 0.35, y: y + 0.2, w: cw - 0.6, h: 0.4, fontFace: HDR, fontSize: 16, bold: true, color: INK, margin: 0 });
    s.addText(it[1], { x: x + 0.35, y: y + 0.65, w: cw - 0.6, h: 0.75, fontFace: BODY, fontSize: 13, color: MUTE, margin: 0 });
  });
  s.addText('Deep dives: DOCS/LLM_PROMPT_DOCUMENTATION.md · DOCS/ARCHITECTURE.md · DOCS/LAYOUT_ENGINES_COMPARISON.md · DOCS/REGIONAL_PRICING_IMPLEMENTATION.md',
    { x: M, y: 6.7, w: W - 2 * M, h: 0.4, fontFace: HDR, fontSize: 10, color: FAINT, margin: 0 });
}

const out = 'How-Diagrams-Are-Generated-Technical.pptx';
pres.writeFile({ fileName: out }).then(() => console.log('WROTE', out));

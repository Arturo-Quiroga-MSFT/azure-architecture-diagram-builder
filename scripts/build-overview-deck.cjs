/**
 * Builds a polished overview slide deck for the Azure Architecture Diagram Builder.
 *
 * Source data: README.md, DOCS/RELEASE-NOTES.md, MCP tool inventory;
 * reach from the de-duplicated MCAPS + FDPO telemetry archive (2026-07-01 to
 * 2026-10-16); recent use from FDPO browser telemetry
 * (scripts/usage-report-range.sh 2026-09-21 2026-10-21, data from 2026-09-28)
 * and server model logs in log-aadb-prod for the same window.
 *
 * Run:  node scripts/build-overview-deck.cjs
 * Output: decks/azure-diagram-builder-overview.pptx
 */
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');

// ── Palette (content-informed: Azure blues with a cyan accent) ───────────────
const C = {
  navy: '0B1F3A',       // deep azure navy (dark backgrounds)
  navy2: '102A4C',      // card on dark
  azure: '0078D4',      // Azure blue (dominant accent)
  cyan: '50E6FF',       // bright Azure cyan (sharp accent)
  teal: '2EC5CE',
  ink: '12233B',        // near-black text on light
  slate: '5B6B82',      // muted text
  cloud: 'F4F7FB',      // light slide background
  card: 'FFFFFF',
  line: 'D9E2EC',
  white: 'FFFFFF',
  green: '3FB950',
  amber: 'F2A900',
};

const FONT = 'Segoe UI';
const W = 13.33;
const H = 7.5;

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: W, height: H });
pres.layout = 'WIDE';
pres.author = 'Azure Architecture Diagram Builder';
pres.title = 'Azure Architecture Diagram Builder — Overview';

// Fresh shadow factories (PptxGenJS mutates option objects in place).
const softShadow = () => ({ type: 'outer', color: '0A1422', blur: 9, offset: 3, angle: 90, opacity: 0.18 });
const cardShadow = () => ({ type: 'outer', color: '233247', blur: 7, offset: 2, angle: 90, opacity: 0.12 });

// ── Reusable helpers ─────────────────────────────────────────────────────────
function footer(slide, idx, dark) {
  const col = dark ? 'AFC3DF' : C.slate;
  slide.addText('Azure Architecture Diagram Builder', {
    x: 0.5, y: H - 0.55, w: 7, h: 0.3, fontFace: FONT, fontSize: 10, color: col, align: 'left',
  });
  slide.addText(`${idx}`, {
    x: W - 1.1, y: H - 0.55, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: col, align: 'right',
  });
}

function sectionHeader(slide, kicker, title) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 0.55, w: 0.16, h: 0.62, fill: { color: C.azure } });
  slide.addText(kicker.toUpperCase(), {
    x: 0.78, y: 0.5, w: 11, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.azure, charSpacing: 3, margin: 0,
  });
  slide.addText(title, {
    x: 0.76, y: 0.78, w: 12, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: C.ink, margin: 0,
  });
}

function statCard(slide, x, y, w, h, value, label, accent) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: C.card }, line: { color: C.line, width: 1 }, shadow: cardShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.1, fill: { color: accent } });
  slide.addText(value, {
    x, y: y + 0.28, w, h: h * 0.46, fontFace: FONT, fontSize: 30, bold: true, color: C.ink, align: 'center', valign: 'middle', margin: 0,
  });
  slide.addText(label, {
    x: x + 0.1, y: y + h * 0.62, w: w - 0.2, h: h * 0.32, fontFace: FONT, fontSize: 12, color: C.slate, align: 'center', valign: 'top', margin: 0,
  });
}

function featureCard(slide, x, y, w, h, glyph, title, body, accent) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h, fill: { color: C.card }, line: { color: C.line, width: 1 }, shadow: cardShadow(),
  });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.1, h, fill: { color: accent } });
  slide.addText(glyph, {
    x: x + 0.22, y: y + 0.16, w: 0.9, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: accent, margin: 0,
  });
  slide.addText(title, {
    x: x + 0.22, y: y + 0.66, w: w - 0.4, h: 0.34, fontFace: FONT, fontSize: 14.5, bold: true, color: C.ink, margin: 0,
  });
  slide.addText(body, {
    x: x + 0.22, y: y + 1.0, w: w - 0.4, h: h - 1.1, fontFace: FONT, fontSize: 12, color: C.slate, margin: 0, valign: 'top',
  });
}


function darkHeader(slide, kicker, title, accent) {
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 0.6, w: 0.16, h: 0.62, fill: { color: accent } });
  slide.addText(kicker.toUpperCase(), { x: 0.78, y: 0.55, w: 11, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: accent, charSpacing: 3, margin: 0 });
  slide.addText(title, { x: 0.76, y: 0.85, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: C.white, margin: 0 });
}

function barChart(slide, labels, values, opts) {
  slide.addChart(pres.charts.BAR, [{ name: opts.name, labels, values }], {
    x: opts.x, y: opts.y, w: opts.w, h: opts.h, barDir: 'bar',
    chartColors: [opts.color || C.azure],
    chartArea: { fill: { color: C.card }, roundedCorners: true },
    catAxisLabelColor: C.slate, valAxisLabelColor: C.slate, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    valGridLine: { color: 'B8C7D9', size: 1 }, catGridLine: { style: 'none' },
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 12, dataLabelFontBold: true,
    showTitle: true, title: opts.title, titleColor: C.ink, titleFontFace: FONT, titleFontSize: 14,
    showLegend: false, barGapWidthPct: 45,
    catAxisMajorTickMark: 'none', valAxisMajorTickMark: 'none',
    ...(opts.max ? { valAxisMinVal: 0, valAxisMaxVal: opts.max, valAxisMajorUnit: 250 } : {}),
  });
}

function navyPanel(slide, x, y, w, h) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.navy }, shadow: softShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.12, fill: { color: C.cyan } });
}

const RECENT_WINDOW = '28 Sep – 20 Oct 2026';

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — Title (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.azure } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: C.cyan } });
  const motif = (cx, cy, col) => s.addShape(pres.shapes.OVAL, { x: cx, y: cy, w: 0.34, h: 0.34, fill: { color: col }, line: { color: C.navy, width: 1 } });
  s.addShape(pres.shapes.LINE, { x: 10.7, y: 1.25, w: 1.4, h: 0.7, line: { color: '24456E', width: 2 } });
  s.addShape(pres.shapes.LINE, { x: 10.7, y: 1.25, w: 1.4, h: -0.0, line: { color: '24456E', width: 2 } });
  motif(10.55, 1.1, C.cyan); motif(12.0, 0.85, C.azure); motif(12.0, 1.7, C.teal);

  s.addText('AZURE ARCHITECTURE', {
    x: 0.9, y: 2.35, w: 11, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.cyan, charSpacing: 6, margin: 0,
  });
  s.addText('Diagram Builder', {
    x: 0.85, y: 2.75, w: 11.5, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: C.white, margin: 0,
  });
  s.addText('From a conversation, a sketch or a live estate to a validated, deployable Azure design.', {
    x: 0.9, y: 4.05, w: 11.2, h: 0.75, fontFace: FONT, fontSize: 20, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  const chips = ['Type, talk, sketch or import', '14 AI models', 'WAF + cost + IaC', 'Web app + MCP'];
  let cx = 0.9;
  chips.forEach((t) => {
    const w = 0.42 + t.length * 0.105;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 5.05, w, h: 0.46, fill: { color: C.navy2 }, line: { color: C.azure, width: 1 }, rectRadius: 0.23 });
    s.addText(t, { x: cx, y: 5.05, w, h: 0.46, fontFace: FONT, fontSize: 12, color: 'DCE8F8', align: 'center', valign: 'middle', margin: 0 });
    cx += w + 0.25;
  });
  s.addText('AADB v2.1.10 · October 2026 · aka.ms/diagram-builder', {
    x: 0.9, y: 6.5, w: 8, h: 0.35, fontFace: FONT, fontSize: 13, color: '7E93B4', margin: 0,
  });
  footer(s, 1, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 2 — What it is (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  darkHeader(s, 'What it is', 'One workspace from first idea to deployable artifact', C.cyan);

  const pillars = [
    ['Create', 'Type a brief, talk it through with Ava, upload a sketch, or import ARM, Bicep, Terraform or a live resource group.', C.cyan],
    ['Refine', 'Edit the canvas directly, or ask Guided Chat or Ava for deliberate, minimal changes that keep your layout.', C.azure],
    ['Validate', 'Score Well-Architected gaps, apply fixes, compare 14 models, and price the design across 14 Azure regions.', C.teal],
    ['Deliver', 'Export slides, Visio, draw.io and images, generate Bicep deployment guides, or call it from agents via MCP.', C.green],
  ];
  const cardW = 2.8075, gap = 0.3, startX = 0.6, y = 2.0, cardH = 2.95;
  pillars.forEach((p, i) => {
    const x = startX + i * (cardW + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: cardH, fill: { color: C.navy2 }, line: { color: '1C3A5C', width: 1 }, shadow: softShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cardW, h: 0.12, fill: { color: p[2] } });
    s.addText(`0${i + 1}`, { x: x + 0.22, y: y + 0.28, w: cardW - 0.4, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: p[2], margin: 0 });
    s.addText(p[0], { x: x + 0.22, y: y + 1.05, w: cardW - 0.4, h: 0.5, fontFace: FONT, fontSize: 19, bold: true, color: C.white, margin: 0 });
    s.addText(p[1], { x: x + 0.22, y: y + 1.6, w: cardW - 0.44, h: cardH - 1.7, fontFace: FONT, fontSize: 12.5, color: 'B9CAE3', margin: 0, valign: 'top' });
  });
  footer(s, 2, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 3 — Reach since July (light, big stats)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Reach', 'Used across the field, not just demoed');
  s.addText('1 Jul – 16 Oct 2026 · browser telemetry from both production environments, de-duplicated', {
    x: 0.78, y: 1.4, w: 12, h: 0.3, fontFace: FONT, fontSize: 12, italic: true, color: '4A596E', margin: 0,
  });

  const stats = [
    ['2,857', 'active users', C.azure],
    ['7,892', 'architectures generated', C.teal],
    ['83', 'countries', C.cyan],
    ['6,147', 'unique visitors', C.green],
  ];
  const cw = 2.8075, gap = 0.3, sx = 0.6, y = 2.1, ch = 2.5;
  stats.forEach((c, i) => {
    const x = sx + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.card }, line: { color: C.line, width: 1 }, shadow: cardShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.1, fill: { color: c[2] } });
    s.addText(c[0], { x, y: y + 0.45, w: cw, h: 1.1, fontFace: FONT, fontSize: 48, bold: true, color: C.ink, align: 'center', valign: 'middle', margin: 0 });
    s.addText(c[1], { x: x + 0.1, y: y + 1.65, w: cw - 0.2, h: 0.5, fontFace: FONT, fontSize: 14, color: C.slate, align: 'center', valign: 'top', margin: 0 });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.05, w: 12.13, h: 1.25, fill: { color: C.navy }, shadow: softShadow() });
  s.addText([
    { text: 'What we measure: ', options: { bold: true, color: C.cyan } },
    { text: 'feature events, counts and coarse geography. ', options: { color: 'DCE8F8' } },
    { text: 'What we never collect: ', options: { bold: true, color: C.cyan } },
    { text: 'prompts, diagram content, model responses, credentials or raw IPs.', options: { color: 'DCE8F8' } },
  ], { x: 0.95, y: 5.05, w: 11.4, h: 1.25, fontFace: FONT, fontSize: 15, valign: 'middle', margin: 0 });
  footer(s, 3, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4 — Current product state (light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Current state', 'A live product with a steady release cadence');
  s.addText('Production verified on 2026-10-21 · six releases since 12 Oct', {
    x: 0.78, y: 1.4, w: 12, h: 0.3, fontFace: FONT, fontSize: 12, italic: true, color: C.slate, margin: 0,
  });

  const cards = [
    ['v2.1.10', 'Production web app', C.azure],
    ['14', 'AI models on Microsoft Foundry', C.teal],
    ['14', 'Native pricing regions', C.cyan],
    ['13', 'Deterministic MCP tools', C.azure],
  ];
  const cw = 2.8075, gap = 0.3, sx = 0.6, y = 2.0, ch = 1.8;
  cards.forEach((c, i) => statCard(s, sx + i * (cw + gap), y, cw, ch, c[0], c[1], c[2]));

  const cards2 = [
    ['Voice Live', 'Design out loud with Ava', C.teal],
    ['Microsoft IQ', 'Fabric IQ, Foundry IQ, Work IQ', C.amber],
    ['Blueprint', 'Presentation-ready output', C.green],
    ['azd', 'Greenfield self-deployment', C.azure],
  ];
  cards2.forEach((c, i) => statCard(s, sx + i * (cw + gap), 4.1, cw, ch, c[0], c[1], c[2]));

  s.addText([
    { text: 'Two interfaces, one design system: ', options: { color: C.ink } },
    { text: 'an interactive web app for people and deterministic MCP tools for agents.', options: { color: C.azure, bold: true } },
  ], { x: 0.6, y: 6.2, w: 12.1, h: 0.45, fontFace: FONT, fontSize: 15, align: 'center', margin: 0 });
  footer(s, 4, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5 — Recent usage (light, bar chart)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Recent use', 'People go past generation to validation and delivery');

  barChart(s,
    ['Template imports', 'WAF fixes applied', 'Deploy guides', 'Image imports', 'Version history', 'Region changes', 'WAF validations', 'Exports', 'Architectures'],
    [30, 43, 43, 66, 79, 106, 226, 458, 1012],
    { name: 'Events', x: 0.6, y: 1.7, w: 7.4, h: 4.9, title: `Feature events · ${RECENT_WINDOW} · independent counts` });

  const px = 8.4, pw = 4.3;
  navyPanel(s, px, 1.7, pw, 4.9);
  s.addText('LAST 23 DAYS', { x: px + 0.3, y: 1.95, w: pw - 0.6, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.cyan, charSpacing: 2, margin: 0 });
  s.addText('329', { x: px + 0.3, y: 2.3, w: pw - 0.6, h: 0.9, fontFace: FONT, fontSize: 52, bold: true, color: C.white, margin: 0 });
  s.addText('feature users in 37 countries, 530 sessions', {
    x: px + 0.3, y: 3.2, w: pw - 0.6, h: 0.6, fontFace: FONT, fontSize: 14, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  s.addText('HOW NEW USERS START', { x: px + 0.3, y: 3.95, w: pw - 0.6, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: C.cyan, charSpacing: 2, margin: 0 });
  const starts = [['Guided Chat', '121'], ['Brief or image', '113'], ['Azure import', '38'], ['Template import', '35']];
  starts.forEach((r, i) => {
    const ry = 4.3 + i * 0.5;
    s.addText(r[0], { x: px + 0.3, y: ry, w: 2.6, h: 0.42, fontFace: FONT, fontSize: 13.5, color: 'DCE8F8', margin: 0, valign: 'middle' });
    s.addText(`${r[1]} users`, { x: px + 2.6, y: ry, w: 1.4, h: 0.42, fontFace: FONT, fontSize: 13.5, bold: true, color: C.white, align: 'right', margin: 0, valign: 'middle' });
  });
  footer(s, 5, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6 — Key features (light, card grid)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Capabilities', 'One canvas, the whole architecture lifecycle');

  const feats = [
    ['IN', 'Five ways in', 'A brief, a voice conversation, an image or whiteboard photo, an ARM/Bicep/Terraform template, or a live resource group.', C.azure],
    ['AI', 'Generate + refine', 'Pick any of 14 models, then refine with Guided Chat or Ava and keep your canvas edits.', C.teal],
    ['VIEW', 'Topology + Blueprint', 'An editable engineering view and a polished whiteboard-style view from one brief.', C.green],
    ['WAF', 'Evidence-aware review', 'Score diagram-level WAF gaps, apply recommendations, and compare model critiques with a narrated avatar.', C.azure],
    ['$', 'Cost with provenance', 'Native Azure Retail Prices across 14 regions, PAYG or 1-year, with Fabric capacity and IQ services priced.', C.teal],
    ['OUT', 'Deliver and extend', 'Full-resolution slides, Visio, draw.io and images; Bicep deployment guides; 13 deterministic MCP tools.', C.amber],
  ];
  const cw = 3.83, ch = 2.2, gx = 0.32, gy = 0.3, sx = 0.6, sy = 1.8;
  feats.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    featureCard(s, sx + col * (cw + gx), sy + row * (ch + gy), cw, ch, f[0], f[1], f[2], f[3]);
  });
  footer(s, 6, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7 — What's new since September (light, timeline)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, "What's new", 'Six releases in ten days');

  const items = [
    ['v2.1.5', '12 Oct', 'Choose your narrator', '28 avatars and 12 voices to choose from; session leaks fixed.', C.azure],
    ['v2.1.6', '16 Oct', 'Readable imports', 'Real edge labels and resource names from ARM and live Azure; named MCP keys.', C.teal],
    ['v2.1.7', '20 Oct', 'Talk it through with Ava', 'Voice Live in Guided Chat: Ava asks, draws and refines the diagram herself.', C.cyan],
    ['v2.1.8–9', '21 Oct', 'Microsoft IQ', 'Fabric, Foundry and Work IQ as named services; Fabric capacity always priced.', C.amber],
    ['v2.1.10', '21 Oct', 'Full-size exports', 'Slides and images show the diagram itself at up to 8000 px, no canvas chrome.', C.green],
  ];
  const lineY = 2.55, sx = 0.6, tw = 12.13, n = items.length, colW = tw / n;
  s.addShape(pres.shapes.RECTANGLE, { x: sx, y: lineY - 0.03, w: tw, h: 0.06, fill: { color: C.line } });
  items.forEach((it, i) => {
    const x = sx + i * colW;
    const cxm = x + colW / 2;
    s.addShape(pres.shapes.OVAL, { x: cxm - 0.17, y: lineY - 0.17, w: 0.34, h: 0.34, fill: { color: it[4] }, line: { color: C.cloud, width: 3 } });
    s.addText(it[0], { x, y: 1.75, w: colW, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.ink, align: 'center', margin: 0 });
    s.addText(it[1], { x, y: 2.1, w: colW, h: 0.25, fontFace: FONT, fontSize: 11, color: C.slate, align: 'center', margin: 0 });
    const cardX = x + 0.15, cardW = colW - 0.3, cardY = 3.0, cardH = 2.0;
    s.addShape(pres.shapes.RECTANGLE, { x: cardX, y: cardY, w: cardW, h: cardH, fill: { color: C.card }, line: { color: C.line, width: 1 }, shadow: cardShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: cardX, y: cardY, w: cardW, h: 0.1, fill: { color: it[4] } });
    s.addText(it[2], { x: cardX + 0.18, y: cardY + 0.3, w: cardW - 0.36, h: 0.45, fontFace: FONT, fontSize: 14.5, bold: true, color: C.ink, margin: 0, valign: 'top' });
    s.addText(it[3], { x: cardX + 0.18, y: cardY + 0.85, w: cardW - 0.36, h: cardH - 1.0, fontFace: FONT, fontSize: 12, color: C.slate, margin: 0, valign: 'top' });
  });
  s.addText('Full notes: DOCS/RELEASE-NOTES.md', { x: 0.6, y: 5.3, w: 12.1, h: 0.3, fontFace: FONT, fontSize: 11, italic: true, color: '4A596E', margin: 0 });
  footer(s, 7, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 8 — Real output / export usage (light, bar chart)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Delivery', 'The output leaves the canvas');

  barChart(s,
    ['Workflow animation', 'PowerPoint slide', 'PowerPoint deck', 'Workflow (Markdown)', 'CSV', 'Visio', 'SVG', 'Draw.io', 'PNG', 'JSON'],
    [18, 23, 28, 28, 29, 32, 34, 54, 85, 105],
    { name: 'Exports', x: 0.6, y: 1.7, w: 7.6, h: 4.9, title: `Exports by format · ${RECENT_WINDOW}` });

  const px = 8.55, pw = 4.18;
  const facts = [
    ['458', 'exports by 105 users', C.azure],
    ['43', 'Bicep deployment guides by 23 users', C.teal],
    ['30', 'IaC template imports by 14 users', C.green],
  ];
  facts.forEach((f, i) => {
    const y = 1.7 + i * 1.74;
    s.addShape(pres.shapes.RECTANGLE, { x: px, y, w: pw, h: 1.42, fill: { color: C.card }, line: { color: C.line, width: 1 }, shadow: cardShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: px, y, w: 0.1, h: 1.42, fill: { color: f[2] } });
    s.addText(f[0], { x: px + 0.28, y: y + 0.18, w: pw - 0.5, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.ink, margin: 0 });
    s.addText(f[1], { x: px + 0.28, y: y + 0.86, w: pw - 0.5, h: 0.55, fontFace: FONT, fontSize: 12.5, color: C.slate, margin: 0, valign: 'top' });
  });
  footer(s, 8, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 9 — Multi-model by design (light, chart + panel)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Model layer', 'Multi-model by design, measured at the server');
  s.addText('14 models on Microsoft Foundry: GPT-6.x, GPT-5.6, Claude, MAI, DeepSeek, Grok, Mistral and Kimi.', {
    x: 0.78, y: 1.4, w: 12, h: 0.3, fontFace: FONT, fontSize: 13, color: C.slate, margin: 0,
  });

  barChart(s,
    ['Claude Sonnet 5.5', 'GPT-6 Astra', 'Claude Opus 5.5', 'GPT-6.1 Sol', 'GPT-5.6 Sol', 'GPT-5.6 Luna'],
    [60, 62, 82, 100, 912, 1171],
    { name: 'Calls', x: 0.6, y: 1.95, w: 7.3, h: 4.6, color: C.teal, max: 1500, title: `Top server model traffic · ${RECENT_WINDOW}` });

  const px = 8.25, pw = 4.45;
  navyPanel(s, px, 1.95, pw, 4.6);
  s.addText('AUTHORITATIVE TRAFFIC', { x: px + 0.3, y: 2.25, w: pw - 0.6, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.cyan, charSpacing: 2, margin: 0 });
  s.addText('2,560 calls', { x: px + 0.3, y: 2.6, w: pw - 0.6, h: 0.7, fontFace: FONT, fontSize: 34, bold: true, color: C.white, margin: 0 });
  s.addText('13.1M tokens processed. 2,535 requests succeeded (99.0%); 3 were throttled.', {
    x: px + 0.3, y: 3.4, w: pw - 0.6, h: 1.3, fontFace: FONT, fontSize: 13.5, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  s.addText([
    { text: 'Scope: ', options: { bold: true, color: C.cyan } },
    { text: `production model proxy, every model and helper call. Window: ${RECENT_WINDOW}.`, options: { color: 'DCE8F8' } },
  ], { x: px + 0.3, y: 4.55, w: pw - 0.6, h: 1.2, fontFace: FONT, fontSize: 13, margin: 0, valign: 'top' });
  footer(s, 9, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 10 — Operational evidence (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  darkHeader(s, 'Operations', 'Keyless, private and reversible by default', C.green);

  const econ = [
    ['99.0%', 'model requests succeeded', C.green],
    ['0', 'API keys in the browser', C.cyan],
    ['1 cmd', 'rollback to last release', C.teal],
    ['4', 'revocable MCP client keys', C.amber],
  ];
  const cw = 2.8075, gap = 0.3, sx = 0.6, y = 2.1, ch = 2.0;
  econ.forEach((c, i) => {
    const x = sx + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.navy2 }, line: { color: '1F3A5C', width: 1 }, shadow: softShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.1, fill: { color: c[2] } });
    s.addText(c[0], { x, y: y + 0.35, w: cw, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(c[1], { x: x + 0.15, y: y + 1.15, w: cw - 0.3, h: 0.7, fontFace: FONT, fontSize: 12.5, color: 'B9CAE3', align: 'center', valign: 'top', margin: 0 });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.55, w: 12.13, h: 1.7, fill: { color: '0E2746' }, line: { color: C.green, width: 1 } });
  s.addText([
    { text: 'Managed identity to Foundry, Speech, Cosmos DB and the registry, inside a private network. ', options: { color: 'DCE8F8' } },
    { text: 'Each release is health-checked before it takes traffic.', options: { color: C.cyan, bold: true } },
  ], { x: 1.0, y: 4.75, w: 11.3, h: 1.3, fontFace: FONT, fontSize: 17, align: 'center', valign: 'middle', margin: 0, lineSpacingMultiple: 1.15 });
  footer(s, 10, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 11 — Demo close (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.azure } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: C.cyan } });

  s.addText('SEE IT WORK', { x: 0.6, y: 0.85, w: 11, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.cyan, charSpacing: 4, margin: 0 });
  s.addText('One architecture, four moves', {
    x: 0.6, y: 1.2, w: 11.5, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.white, margin: 0,
  });

  const asks = [
    ['Create', 'Talk the workload through with Ava, or import an existing resource group.', C.cyan],
    ['Refine', 'Add one requirement by voice or Guided Chat and watch only that change.', C.azure],
    ['Validate', 'Inspect a WAF gap, apply the fix, compare regional cost.', C.teal],
    ['Deliver', 'Export the slide and Bicep guide, or call the same logic through MCP.', C.green],
  ];
  const cw = 2.8075, gap = 0.3, sx = 0.6, y = 2.45, ch = 2.4;
  asks.forEach((a, i) => {
    const x = sx + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.navy2 }, line: { color: '1F3A5C', width: 1 }, shadow: softShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.12, fill: { color: a[2] } });
    s.addText(`0${i + 1}`, { x: x + 0.25, y: y + 0.3, w: cw - 0.5, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: a[2], margin: 0 });
    s.addText(a[0], { x: x + 0.25, y: y + 0.95, w: cw - 0.5, h: 0.45, fontFace: FONT, fontSize: 17, bold: true, color: C.white, margin: 0, valign: 'top' });
    s.addText(a[1], { x: x + 0.25, y: y + 1.4, w: cw - 0.5, h: ch - 1.5, fontFace: FONT, fontSize: 12.5, color: 'B9CAE3', margin: 0, valign: 'top' });
  });

  s.addText('Try it:  aka.ms/diagram-builder   ·   Current production version: v2.1.10', {
    x: 0.6, y: 5.4, w: 12.1, h: 0.46, fontFace: FONT, fontSize: 14, bold: true, color: 'AFC3DF', align: 'center', margin: 0,
  });
  footer(s, 11, true);
}

// ── Write ────────────────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, '..', 'decks');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'azure-diagram-builder-overview.pptx');
pres.writeFile({ fileName: outFile }).then((f) => {
  console.log('✅ Wrote', f);
}).catch((e) => {
  console.error('❌ Failed:', e);
  process.exit(1);
});

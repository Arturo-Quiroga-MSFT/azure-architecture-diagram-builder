/* eslint-disable */
/**
 * Builds a polished overview slide deck for the Azure Architecture Diagram Builder.
 *
 * Source data: DOCS/USAGE-AND-IMPACT-ONE-PAGER.md (real Application Insights +
 * Azure Cost Management telemetry, ~85-day window ending 2026-06-05) and README.md.
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
  const col = dark ? '5E7799' : C.slate;
  slide.addText('Azure Architecture Diagram Builder', {
    x: 0.5, y: H - 0.42, w: 7, h: 0.3, fontFace: FONT, fontSize: 9, color: col, align: 'left',
  });
  slide.addText(`${idx}`, {
    x: W - 1.0, y: H - 0.42, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 9, color: col, align: 'right',
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
    x, y: y + 0.28, w, h: h * 0.46, fontFace: FONT, fontSize: 34, bold: true, color: C.ink, align: 'center', valign: 'middle', margin: 0,
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
    x: x + 0.22, y: y + 1.0, w: w - 0.4, h: h - 1.1, fontFace: FONT, fontSize: 11, color: C.slate, margin: 0, valign: 'top',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 1 — Title (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  // Accent bands
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.azure } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: C.cyan } });
  // Decorative diagram-node motif (top right)
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
  s.addText('Natural-language prompts → validated, costed, deployable Azure architectures.', {
    x: 0.9, y: 4.05, w: 10.8, h: 0.6, fontFace: FONT, fontSize: 20, color: 'C7D6EC', margin: 0,
  });
  // Chips
  const chips = ['714 official Azure icons', '8 export formats', '12+ frontier models', 'WAF validation'];
  let cx = 0.9;
  chips.forEach((t) => {
    const w = 0.42 + t.length * 0.105;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 4.95, w, h: 0.46, fill: { color: C.navy2 }, line: { color: C.azure, width: 1 }, rectRadius: 0.23 });
    s.addText(t, { x: cx, y: 4.95, w, h: 0.46, fontFace: FONT, fontSize: 12, color: 'DCE8F8', align: 'center', valign: 'middle', margin: 0 });
    cx += w + 0.25;
  });
  s.addText('Overview · June 2026', {
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
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 0.6, w: 0.16, h: 0.62, fill: { color: C.cyan } });
  s.addText('WHAT IT IS', { x: 0.78, y: 0.55, w: 11, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.cyan, charSpacing: 3, margin: 0 });
  s.addText('From a sentence to a stakeholder-ready architecture', {
    x: 0.76, y: 0.85, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: C.white, margin: 0,
  });

  const pillars = [
    ['Describe', 'Type what you want to build in plain English. Pick from 12+ frontier models and a reasoning effort.', C.cyan],
    ['Generate', 'Get a laid-out diagram with official Azure icons, smart grouping, and editable connections in seconds.', C.azure],
    ['Validate', 'Run a Well-Architected Framework review that scores the design and surfaces concrete gaps.', C.teal],
    ['Ship', 'Export to PNG/SVG/PPTX/Draw.io, generate Bicep deployment guides, and costed multi-region estimates.', C.green],
  ];
  const cardW = 2.86, gap = 0.3, startX = 0.6, y = 2.0, cardH = 4.3;
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
// SLIDE 3 — Headline impact (light)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Impact', 'Real adoption, measured — not estimated');
  s.addText('Application Insights + Azure Cost Management · 2026 year-to-date (through 2026-06-22)', {
    x: 0.78, y: 1.4, w: 12, h: 0.3, fontFace: FONT, fontSize: 12, italic: true, color: C.slate, margin: 0,
  });

  const cards = [
    ['267', 'Unique users', C.azure],
    ['39', 'Countries reached', C.teal],
    ['432', 'Sessions', C.cyan],
    ['2,873', 'Tracked events', C.azure],
  ];
  const cw = 2.86, gap = 0.3, sx = 0.6, y = 2.0, ch = 1.9;
  cards.forEach((c, i) => statCard(s, sx + i * (cw + gap), y, cw, ch, c[0], c[1], c[2]));

  const cards2 = [
    ['151', 'Cities reached', C.teal],
    ['~$109', 'LLM cost / month', C.amber],
    ['~$0.41', 'Cost per user / mo', C.green],
    ['520', 'Architectures generated', C.azure],
  ];
  cards2.forEach((c, i) => statCard(s, sx + i * (cw + gap), 4.15, cw, ch, c[0], c[1], c[2]));

  s.addText([
    { text: 'Globally adopted, maintained by one person on a personal subscription — ', options: { color: C.ink } },
    { text: 'for the price of two coffees a month.', options: { color: C.azure, bold: true } },
  ], { x: 0.6, y: 6.25, w: 12.1, h: 0.5, fontFace: FONT, fontSize: 15, align: 'center', margin: 0 });
  footer(s, 3, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 4 — Adoption accelerating (light, bar chart)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Growth', 'Adoption is accelerating — organically');

  s.addChart(pres.charts.BAR, [{
    name: 'Active users', labels: ['Mar', 'Apr', 'May', 'Jun (partial)'], values: [5, 10, 109, 155],
  }], {
    x: 0.6, y: 1.7, w: 7.4, h: 4.9, barDir: 'col',
    chartColors: [C.azure],
    chartArea: { fill: { color: C.card }, roundedCorners: true },
    catAxisLabelColor: C.slate, valAxisLabelColor: C.slate, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' },
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 13, dataLabelFontBold: true,
    showTitle: true, title: 'Monthly active users', titleColor: C.ink, titleFontFace: FONT, titleFontSize: 14,
    showLegend: false, barGapWidthPct: 60,
  });

  // Insight panel
  const px = 8.4, pw = 4.3;
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: 1.7, w: pw, h: 4.9, fill: { color: C.navy }, shadow: softShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: 1.7, w: pw, h: 0.12, fill: { color: C.cyan } });
  s.addText('STILL CLIMBING', { x: px + 0.3, y: 2.0, w: pw - 0.6, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.cyan, charSpacing: 2, margin: 0 });
  s.addText('155', { x: px + 0.3, y: 2.4, w: pw - 0.6, h: 1.0, fontFace: FONT, fontSize: 56, bold: true, color: C.white, margin: 0 });
  s.addText('active users in June (22 days) — up from 10 in April. May’s 10× jump was no fluke.', {
    x: px + 0.3, y: 3.5, w: pw - 0.6, h: 0.9, fontFace: FONT, fontSize: 14, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  s.addText([
    { text: 'Recent months\n', options: { bold: true, color: C.cyan, breakLine: true } },
    { text: 'Jun — 155 users / 1,151 events', options: { color: 'DCE8F8', breakLine: true } },
    { text: 'May — 109 users / 1,370 events', options: { color: 'DCE8F8' } },
  ], { x: px + 0.3, y: 4.55, w: pw - 0.6, h: 1.6, fontFace: FONT, fontSize: 13, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 });
  footer(s, 4, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 5 — Key features (light, card grid)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Capabilities', 'One canvas, the whole architecture lifecycle');

  const feats = [
    ['AI', 'AI generation', 'Natural-language prompts become laid-out diagrams across 12+ frontier models.', C.azure],
    ['WAF', 'WAF validation', 'Scored Well-Architected reviews surface concrete reliability, security & cost gaps.', C.teal],
    ['$', 'Multi-region cost', 'Snapshot-derived estimates across 14 Azure regions with ranked comparison and savings flags.', C.green],
    ['IaC', 'Deployment guides', 'Generates Bicep templates, prerequisites, and verification steps per service.', C.azure],
    ['⇄', 'Workflow & narration', 'Animated step-by-step data-flow walkthroughs with optional avatar narration.', C.cyan],
    ['↧', '8 export formats', 'PNG, SVG, PPTX, Draw.io, HTML, JSON, CSV, and az-prototype IaC round-trips.', C.amber],
  ];
  const cw = 3.97, ch = 2.32, gx = 0.32, gy = 0.28, sx = 0.6, sy = 1.75;
  feats.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    featureCard(s, sx + col * (cw + gx), sy + row * (ch + gy), cw, ch, f[0], f[1], f[2], f[3]);
  });
  footer(s, 5, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 6 — Real output / export usage (light, bar chart)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Output', 'People ship real artifacts, not just pictures');

  s.addChart(pres.charts.BAR, [{
    name: 'Exports',
    labels: ['JSON', 'PNG', 'PowerPoint', 'Draw.io', 'CSV', 'SVG', 'HTML', 'IaC bundle'],
    values: [135, 79, 43, 36, 27, 23, 22, 11],
  }], {
    x: 0.6, y: 1.7, w: 7.6, h: 4.9, barDir: 'bar',
    chartColors: [C.azure],
    chartArea: { fill: { color: C.card }, roundedCorners: true },
    catAxisLabelColor: C.slate, valAxisLabelColor: C.slate, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' },
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 11, dataLabelFontBold: true,
    showTitle: true, title: 'Exports by format', titleColor: C.ink, titleFontFace: FONT, titleFontSize: 14,
    showLegend: false, barGapWidthPct: 45,
  });

  const px = 8.55, pw = 4.15;
  const facts = [
    ['376', 'diagrams exported by 83 users', C.azure],
    ['50', 'Bicep deployment guides generated', C.teal],
    ['19', 'IaC imports — ARM 9 · Bicep 6 · Terraform 4', C.green],
  ];
  facts.forEach((f, i) => {
    const y = 1.7 + i * 1.66;
    s.addShape(pres.shapes.RECTANGLE, { x: px, y, w: pw, h: 1.5, fill: { color: C.card }, line: { color: C.line, width: 1 }, shadow: cardShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: px, y, w: 0.1, h: 1.5, fill: { color: f[2] } });
    s.addText(f[0], { x: px + 0.28, y: y + 0.18, w: pw - 0.5, h: 0.7, fontFace: FONT, fontSize: 30, bold: true, color: C.ink, margin: 0 });
    s.addText(f[1], { x: px + 0.28, y: y + 0.86, w: pw - 0.5, h: 0.55, fontFace: FONT, fontSize: 12.5, color: C.slate, margin: 0, valign: 'top' });
  });
  footer(s, 6, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 7 — Multi-model by design (light, table + chart)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.cloud };
  sectionHeader(s, 'Choice', 'Multi-model by design');
  s.addText('12+ frontier models in production — users compare quality, latency, and cost side by side.', {
    x: 0.78, y: 1.4, w: 12, h: 0.3, fontFace: FONT, fontSize: 13, color: C.slate, margin: 0,
  });

  s.addChart(pres.charts.BAR, [{
    name: 'Calls', labels: ['GPT-5.2', 'GPT-5.1', 'GPT-5.4', 'GPT-5.3 Codex', 'GPT-5.4 Mini'], values: [481, 292, 227, 66, 55],
  }], {
    x: 0.6, y: 1.95, w: 7.3, h: 4.6, barDir: 'bar',
    chartColors: [C.teal],
    chartArea: { fill: { color: C.card }, roundedCorners: true },
    catAxisLabelColor: C.slate, valAxisLabelColor: C.slate, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    valGridLine: { color: C.line, size: 0.5 }, catGridLine: { style: 'none' },
    showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: C.ink, dataLabelFontFace: FONT, dataLabelFontSize: 12, dataLabelFontBold: true,
    showTitle: true, title: 'Generation calls by model', titleColor: C.ink, titleFontFace: FONT, titleFontSize: 14,
    showLegend: false, barGapWidthPct: 45,
  });

  const px = 8.25, pw = 4.45;
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: 1.95, w: pw, h: 4.6, fill: { color: C.navy }, shadow: softShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: px, y: 1.95, w: pw, h: 0.12, fill: { color: C.cyan } });
  s.addText('WAF VALIDATION', { x: px + 0.3, y: 2.25, w: pw - 0.6, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.cyan, charSpacing: 2, margin: 0 });
  s.addText('146 runs', { x: px + 0.3, y: 2.6, w: pw - 0.6, h: 0.7, fontFace: FONT, fontSize: 34, bold: true, color: C.white, margin: 0 });
  s.addText('Structured, scored design feedback — average 62–71 / 100 across leading models, surfacing concrete gaps before deployment.', {
    x: px + 0.3, y: 3.4, w: pw - 0.6, h: 1.3, fontFace: FONT, fontSize: 13.5, color: 'C7D6EC', margin: 0, valign: 'top',
  });
  s.addText([
    { text: 'Also exercised: ', options: { bold: true, color: C.cyan } },
    { text: 'DeepSeek, Kimi, Mistral, GPT-OSS, and more.', options: { color: 'DCE8F8' } },
  ], { x: px + 0.3, y: 4.95, w: pw - 0.6, h: 1.2, fontFace: FONT, fontSize: 13, margin: 0, valign: 'top' });
  footer(s, 7, false);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 8 — The economics (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 0.6, w: 0.16, h: 0.62, fill: { color: C.green } });
  s.addText('ECONOMICS', { x: 0.78, y: 0.55, w: 11, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.green, charSpacing: 3, margin: 0 });
  s.addText('Enterprise-grade guidance at hobby-grade cost', {
    x: 0.76, y: 0.85, w: 12, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: C.white, margin: 0,
  });

  const econ = [
    ['$108.52', 'attributable token spend / 30 days', C.amber],
    ['$17.88', 'blended cost per 1M tokens', C.cyan],
    ['$0.12', 'avg cost per generation call', C.teal],
    ['~$0.41', 'cost per active user / month', C.green],
  ];
  const cw = 2.86, gap = 0.3, sx = 0.6, y = 2.1, ch = 2.0;
  econ.forEach((c, i) => {
    const x = sx + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.navy2 }, line: { color: '1F3A5C', width: 1 }, shadow: softShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.1, fill: { color: c[2] } });
    s.addText(c[0], { x, y: y + 0.35, w: cw, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.white, align: 'center', margin: 0 });
    s.addText(c[1], { x: x + 0.15, y: y + 1.15, w: cw - 0.3, h: 0.7, fontFace: FONT, fontSize: 12.5, color: 'B9CAE3', align: 'center', valign: 'top', margin: 0 });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.55, w: 12.13, h: 1.7, fill: { color: '0E2746' }, line: { color: C.green, width: 1 } });
  s.addText([
    { text: 'Validated, multi-cloud-quality Azure architecture guidance delivered to ', options: { color: 'DCE8F8' } },
    { text: '267 users across 39 countries', options: { color: C.cyan, bold: true } },
    { text: ' — for the price of two coffees a month, on a single personal subscription.', options: { color: 'DCE8F8' } },
  ], { x: 1.0, y: 4.75, w: 11.3, h: 1.3, fontFace: FONT, fontSize: 18, align: 'center', valign: 'middle', margin: 0, lineSpacingMultiple: 1.15 });
  footer(s, 8, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE 9 — The ask / closing (dark)
// ─────────────────────────────────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.navy };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: C.azure } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: C.cyan } });

  s.addText('THE ASK', { x: 0.9, y: 0.85, w: 11, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: C.cyan, charSpacing: 4, margin: 0 });
  s.addText('Help it scale responsibly', {
    x: 0.86, y: 1.2, w: 11.5, h: 0.8, fontFace: FONT, fontSize: 34, bold: true, color: C.white, margin: 0,
  });

  const asks = [
    ['Sponsorship / landing zone', 'Move off a personal subscription onto a funded, right-sized Azure environment with proper quotas and isolation.', C.cyan],
    ['Co-maintainers', 'Reduce the bus-factor of one and accelerate the roadmap with additional contributors.', C.azure],
    ['Strategic reuse', 'Package the validation + generation engine as a reusable skill for Learn / Copilot surfaces so impact compounds.', C.teal],
  ];
  const cw = 3.97, gap = 0.32, sx = 0.6, y = 2.45, ch = 3.0;
  asks.forEach((a, i) => {
    const x = sx + i * (cw + gap);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: C.navy2 }, line: { color: '1F3A5C', width: 1 }, shadow: softShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: 0.12, fill: { color: a[2] } });
    s.addText(`0${i + 1}`, { x: x + 0.25, y: y + 0.3, w: cw - 0.5, h: 0.7, fontFace: FONT, fontSize: 28, bold: true, color: a[2], margin: 0 });
    s.addText(a[0], { x: x + 0.25, y: y + 1.0, w: cw - 0.5, h: 0.7, fontFace: FONT, fontSize: 17, bold: true, color: C.white, margin: 0, valign: 'top' });
    s.addText(a[1], { x: x + 0.25, y: y + 1.7, w: cw - 0.5, h: ch - 1.8, fontFace: FONT, fontSize: 12.5, color: 'B9CAE3', margin: 0, valign: 'top' });
  });

  s.addText('Reproduce the numbers anytime:  ./scripts/usage-report.sh 120   ·   python3 scripts/llm-cost-report.py --days 30', {
    x: 0.6, y: 5.95, w: 12.1, h: 0.4, fontFace: FONT, fontSize: 12, italic: true, color: '7E93B4', align: 'center', margin: 0,
  });
  footer(s, 9, true);
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

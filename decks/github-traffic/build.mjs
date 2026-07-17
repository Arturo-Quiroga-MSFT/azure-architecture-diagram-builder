// Executive deck: GitHub Traffic — Azure Architecture Diagram Builder.
// Sourced from scripts/repo-traffic.sh (GitHub Traffic API), 14-day window
// 2026-07-02 → 2026-07-15, captured 2026-07-16.
import pptxgen from 'pptxgenjs';

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pres.layout = 'WIDE';
pres.author = 'Azure Architecture Diagram Builder';
pres.title = 'GitHub Traffic — Executive Summary';

const W = 13.333, H = 7.5, M = 0.6;

// ── Palette (Azure blues + cyan accent) ──────────────────────────────────────
const NAVY = '0B1F3A', NAVY2 = '102A4C', AZURE = '0078D4', CYAN = '50E6FF',
      TEAL = '2EC5CE', GREEN = '3FB950', AMBER = 'F2A900',
      INK = 'F4F8FF', MUTE = 'AFC2DE', FAINT = '6E86A8', LINE = '1C3A5C',
      CARD = '0F2745';
const HDR = 'Segoe UI', BODY = 'Segoe UI';

const soft = () => ({ type: 'outer', color: '05101F', blur: 9, offset: 3, angle: 90, opacity: 0.28 });

function footer(s, n) {
  s.addText('GitHub Traffic · Azure Architecture Diagram Builder', { x: M, y: H - 0.42, w: 8, h: 0.3, fontFace: BODY, fontSize: 9, color: FAINT, margin: 0 });
  s.addText(`${n} / 6`, { x: W - 1.1, y: H - 0.42, w: 0.6, h: 0.3, fontFace: BODY, fontSize: 9, color: FAINT, align: 'right', margin: 0 });
}
function kicker(s, k, t, tColor = INK) {
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 0.55, w: 0.16, h: 0.62, fill: { color: CYAN } });
  s.addText(k.toUpperCase(), { x: M + 0.28, y: 0.5, w: 11, h: 0.3, fontFace: HDR, fontSize: 12, bold: true, color: CYAN, charSpacing: 3, margin: 0 });
  s.addText(t, { x: M + 0.26, y: 0.78, w: 12.2, h: 0.6, fontFace: HDR, fontSize: 26, bold: true, color: tColor, margin: 0 });
}
function stat(s, x, y, w, h, value, label, accent, sub) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: soft() });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.1, fill: { color: accent } });
  s.addText(String(value), { x, y: y + 0.28, w, h: h * 0.42, fontFace: HDR, fontSize: 40, bold: true, color: INK, align: 'center', valign: 'middle', margin: 0 });
  s.addText(label, { x: x + 0.1, y: y + h * 0.6, w: w - 0.2, h: h * 0.24, fontFace: HDR, fontSize: 13, bold: true, color: MUTE, align: 'center', margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.1, y: y + h * 0.78, w: w - 0.2, h: h * 0.2, fontFace: BODY, fontSize: 10.5, color: accent, align: 'center', margin: 0 });
}

// ═══ SLIDE 1 — Title ═════════════════════════════════════════════════════════
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 0.18, fill: { color: AZURE } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.18, w: W, h: 0.06, fill: { color: CYAN } });
  s.addText('GITHUB TRAFFIC', { x: 0.9, y: 2.3, w: 11, h: 0.5, fontFace: HDR, fontSize: 20, bold: true, color: CYAN, charSpacing: 6, margin: 0 });
  s.addText('Azure Architecture\nDiagram Builder', { x: 0.85, y: 2.75, w: 11.5, h: 1.9, fontFace: HDR, fontSize: 50, bold: true, color: INK, margin: 0, lineSpacingMultiple: 0.95 });
  s.addText('Repository adoption — last 14 days (2026-07-02 → 07-15)', { x: 0.9, y: 4.9, w: 11, h: 0.5, fontFace: BODY, fontSize: 18, color: MUTE, margin: 0 });
  const chips = ['396 views', '131 unique visitors', '215 clones', '14 stars', '5 forks'];
  let cx = 0.9;
  chips.forEach((t) => {
    const w = 0.5 + t.length * 0.108;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: cx, y: 5.6, w, h: 0.46, fill: { color: NAVY2 }, line: { color: AZURE, width: 1 }, rectRadius: 0.23 });
    s.addText(t, { x: cx, y: 5.6, w, h: 0.46, fontFace: BODY, fontSize: 12.5, color: INK, align: 'center', valign: 'middle', margin: 0 });
    cx += w + 0.22;
  });
  s.addText('Source: GitHub Traffic API · captured 2026-07-16', { x: 0.9, y: 6.6, w: 9, h: 0.3, fontFace: BODY, fontSize: 12, color: FAINT, margin: 0 });
  footer(s, 1);
}

// ═══ SLIDE 2 — Headline metrics ══════════════════════════════════════════════
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  kicker(s, 'Headline metrics · 14 days', 'Real, technical engagement — not casual browsing');
  const y = 2.0, h = 2.15, gap = 0.3, w = (W - 2 * M - gap * 3) / 4;
  stat(s, M + 0 * (w + gap), y, w, h, 396, 'VIEWS', CYAN, '131 unique visitors');
  stat(s, M + 1 * (w + gap), y, w, h, 215, 'CLONES', AZURE, '59 unique cloners');
  stat(s, M + 2 * (w + gap), y, w, h, 14, 'STARS', AMBER, 'all-time');
  stat(s, M + 3 * (w + gap), y, w, h, 5, 'FORKS', GREEN, 'all-time');
  // insight band
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 4.7, w: W - 2 * M, h: 1.5, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 4.7, w: 0.12, h: 1.5, fill: { color: CYAN } });
  s.addText('What it means', { x: M + 0.35, y: 4.9, w: 11, h: 0.35, fontFace: HDR, fontSize: 15, bold: true, color: CYAN, margin: 0 });
  s.addText([
    { text: '131 unique visitors and 59 unique cloners in two weeks — nearly half opened the getting-started guide.', options: { bullet: true, breakLine: true } },
    { text: 'Clones + forks indicate hands-on trial (standing the tool up), not passive interest. Zero open issues.', options: { bullet: true } },
  ], { x: M + 0.35, y: 5.28, w: W - 2 * M - 0.7, h: 0.85, fontFace: BODY, fontSize: 13.5, color: INK, lineSpacingMultiple: 1.15, margin: 0 });
  footer(s, 2);
}

// ═══ SLIDE 3 — The surge ═════════════════════════════════════════════════════
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  kicker(s, 'The surge · Jul 13–15', '~90% of two-week traffic landed in three days');
  // simple bar chart of daily views
  const days = [
    ['Jul 11', 2], ['Jul 12', 0], ['Jul 13', 95], ['Jul 14', 188], ['Jul 15', 78],
  ];
  const cx = M, cy = 1.9, cw = 7.3, ch = 4.1;
  const maxV = 188, baseY = cy + ch - 0.5, plotH = ch - 0.9;
  const bw = cw / days.length * 0.55, step = cw / days.length;
  days.forEach((d, i) => {
    const bh = Math.max(0.03, (d[1] / maxV) * plotH);
    const bx = cx + i * step + (step - bw) / 2;
    const by = baseY - bh;
    const peak = d[1] >= 78;
    s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: peak ? CYAN : AZURE } });
    s.addText(String(d[1]), { x: bx - 0.2, y: by - 0.32, w: bw + 0.4, h: 0.3, fontFace: HDR, fontSize: 12, bold: true, color: INK, align: 'center', margin: 0 });
    s.addText(d[0], { x: bx - 0.2, y: baseY + 0.05, w: bw + 0.4, h: 0.3, fontFace: BODY, fontSize: 11, color: MUTE, align: 'center', margin: 0 });
  });
  s.addText('Daily views', { x: cx, y: cy - 0.05, w: 4, h: 0.3, fontFace: BODY, fontSize: 11, italic: true, color: FAINT, margin: 0 });

  // right column: peak day detail
  const rx = M + 7.9, rw = W - M - rx;
  s.addShape(pres.shapes.RECTANGLE, { x: rx, y: 1.9, w: rw, h: 4.1, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: soft() });
  s.addShape(pres.shapes.RECTANGLE, { x: rx, y: 1.9, w: rw, h: 0.1, fill: { color: CYAN } });
  s.addText('Peak day — July 14', { x: rx + 0.3, y: 2.15, w: rw - 0.6, h: 0.4, fontFace: HDR, fontSize: 16, bold: true, color: INK, margin: 0 });
  s.addText([
    { text: '188 views', options: { bold: true } },
    { text: '  ·  71 unique visitors', options: { color: MUTE } },
  ], { x: rx + 0.3, y: 2.7, w: rw - 0.6, h: 0.4, fontFace: HDR, fontSize: 17, color: CYAN, margin: 0 });
  s.addText([
    { text: '127 clones', options: { bold: true } },
    { text: '  ·  36 unique cloners', options: { color: MUTE } },
  ], { x: rx + 0.3, y: 3.2, w: rw - 0.6, h: 0.4, fontFace: HDR, fontSize: 17, color: AZURE, margin: 0 });
  s.addText('Driven by a Microsoft Teams share reaching a technical field audience.',
    { x: rx + 0.3, y: 3.95, w: rw - 0.6, h: 1.6, fontFace: BODY, fontSize: 13.5, color: INK, lineSpacingMultiple: 1.2, valign: 'top', margin: 0 });
  footer(s, 3);
}

// ═══ SLIDE 4 — Referrers + content ═══════════════════════════════════════════
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  kicker(s, 'Reach & engagement', 'How they arrived — and what they read');
  const colW = (W - 2 * M - 0.5) / 2, y = 1.95, h = 4.25;
  // Referrers
  s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: colW, h, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: soft() });
  s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: colW, h: 0.6, fill: { color: NAVY2 } });
  s.addText('Top referrers', { x: M + 0.3, y, w: colW - 0.6, h: 0.6, fontFace: HDR, fontSize: 15, bold: true, color: CYAN, valign: 'middle', margin: 0 });
  const refs = [
    ['github.com (internal / search)', '49'],
    ['Microsoft Teams share', '16'],
    ['techcommunity.microsoft.com', '1'],
    ['linkedin.com', '1'],
    ['Google', '1'],
  ];
  refs.forEach((r, i) => {
    const ry = y + 0.85 + i * 0.62;
    s.addText(r[0], { x: M + 0.3, y: ry, w: colW - 1.3, h: 0.5, fontFace: BODY, fontSize: 13, color: i === 1 ? CYAN : INK, valign: 'middle', margin: 0, bold: i === 1 });
    s.addText(r[1] + 'v', { x: M + colW - 1.0, y: ry, w: 0.7, h: 0.5, fontFace: HDR, fontSize: 13, bold: true, color: MUTE, align: 'right', valign: 'middle', margin: 0 });
  });
  // Content
  const x2 = M + colW + 0.5;
  s.addShape(pres.shapes.RECTANGLE, { x: x2, y, w: colW, h, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: soft() });
  s.addShape(pres.shapes.RECTANGLE, { x: x2, y, w: colW, h: 0.6, fill: { color: NAVY2 } });
  s.addText('Most-read content', { x: x2 + 0.3, y, w: colW - 0.6, h: 0.6, fontFace: HDR, fontSize: 15, bold: true, color: CYAN, valign: 'middle', margin: 0 });
  const paths = [
    ['Repo home', '135'],
    ['DOCS/getting-started-guide.md', '71'],
    ['File tree', '15'],
    ['Architecture_validations/', '7'],
    ['DOCS/ARCHITECTURE.md', '6'],
    ['mcp-server/', '5'],
  ];
  paths.forEach((p, i) => {
    const ry = y + 0.8 + i * 0.55;
    s.addText(p[0], { x: x2 + 0.3, y: ry, w: colW - 1.3, h: 0.45, fontFace: BODY, fontSize: 12.5, color: i === 1 ? CYAN : INK, valign: 'middle', margin: 0, bold: i === 1 });
    s.addText(p[1] + 'v', { x: x2 + colW - 1.0, y: ry, w: 0.7, h: 0.45, fontFace: HDR, fontSize: 12.5, bold: true, color: MUTE, align: 'right', valign: 'middle', margin: 0 });
  });
  s.addText('Getting-started guide is the #2 destination after the repo home — onboarding docs are doing real work.',
    { x: M, y: 6.5, w: W - 2 * M, h: 0.35, fontFace: BODY, fontSize: 12, italic: true, color: CYAN, margin: 0 });
  footer(s, 4);
}

// ═══ SLIDE 5 — Forks / conversion ════════════════════════════════════════════
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  kicker(s, 'Conversion', 'The spike turned lookers into builders');
  const forks = [
    ['2026-07-16', 'sinnitesh'],
    ['2026-07-14', 'yang-jiayi'],
    ['2026-07-14', 'speaking-frankly'],
    ['2026-07-14', 'nipaul'],
    ['2026-07-13', 'anton-kasperovich'],
  ];
  s.addText('All 5 forks were created inside the July 13–16 surge:', { x: M, y: 1.95, w: 11, h: 0.4, fontFace: BODY, fontSize: 15, color: MUTE, margin: 0 });
  forks.forEach((f, i) => {
    const y = 2.55 + i * 0.62;
    s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: 7.6, h: 0.5, fill: { color: CARD }, line: { color: LINE, width: 1 } });
    s.addShape(pres.shapes.RECTANGLE, { x: M, y, w: 0.08, h: 0.5, fill: { color: GREEN } });
    s.addText(f[0], { x: M + 0.25, y, w: 1.7, h: 0.5, fontFace: BODY, fontSize: 12.5, color: MUTE, valign: 'middle', margin: 0 });
    s.addText(f[1] + '/azure-architecture-diagram-builder', { x: M + 2.0, y, w: 5.4, h: 0.5, fontFace: BODY, fontSize: 12.5, color: INK, valign: 'middle', margin: 0 });
  });
  // note card
  const rx = M + 8.1, rw = W - M - rx;
  s.addShape(pres.shapes.RECTANGLE, { x: rx, y: 2.55, w: rw, h: 3.6, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: soft() });
  s.addShape(pres.shapes.RECTANGLE, { x: rx, y: 2.55, w: rw, h: 0.1, fill: { color: AMBER } });
  s.addText('On "ZIP downloads"', { x: rx + 0.3, y: 2.8, w: rw - 0.6, h: 0.4, fontFace: HDR, fontSize: 15, bold: true, color: AMBER, margin: 0 });
  s.addText([
    { text: 'GitHub does not expose a count for "Download ZIP" of source — not in the API or UI.', options: { bullet: true, breakLine: true } },
    { text: 'Only release-asset downloads are tracked; this repo has no releases yet.', options: { bullet: true, breakLine: true } },
    { text: 'Recommendation: cut a tagged Release to get per-asset download metrics.', options: { bullet: true, color: AMBER } },
  ], { x: rx + 0.3, y: 3.3, w: rw - 0.6, h: 2.7, fontFace: BODY, fontSize: 13, color: INK, lineSpacingMultiple: 1.2, valign: 'top', margin: 0 });
  footer(s, 5);
}

// ═══ SLIDE 6 — Takeaways ═════════════════════════════════════════════════════
{
  const s = pres.addSlide(); s.background = { color: NAVY };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.16, h: H, fill: { color: AZURE } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.16, y: 0, w: 0.16, h: H, fill: { color: CYAN } });
  s.addText('TAKEAWAYS FOR LEADERSHIP', { x: M, y: 0.9, w: 11, h: 0.4, fontFace: HDR, fontSize: 13, color: CYAN, charSpacing: 3, margin: 0 });
  s.addText('Adoption is accelerating — and organic', { x: M, y: 1.35, w: 12, h: 0.7, fontFace: HDR, fontSize: 32, bold: true, color: INK, margin: 0 });
  const items = [
    ['One Teams share, real reach', '131 unique visitors, 59 unique cloners, and 5 forks in days — from internal word-of-mouth.'],
    ['High-quality engagement', 'Nearly half opened onboarding docs; clones and forks show hands-on trial, not browsing.'],
    ['No support backlog', 'Zero open issues — an opening to invite feedback from new fork owners.'],
    ['Sustain the momentum', 'Cut a Release for download metrics; keep sharing via Teams/TechCommunity; trend the CSV log.'],
  ];
  const cw = (W - 2 * M - 0.5) / 2, ch = 1.7;
  items.forEach((it, i) => {
    const r = Math.floor(i / 2), c = i % 2;
    const x = M + c * (cw + 0.5), y = 2.5 + r * (ch + 0.35);
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: cw, h: ch, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: soft() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.1, h: ch, fill: { color: i % 2 ? CYAN : AZURE } });
    s.addText(it[0], { x: x + 0.35, y: y + 0.22, w: cw - 0.6, h: 0.5, fontFace: HDR, fontSize: 16, bold: true, color: INK, margin: 0 });
    s.addText(it[1], { x: x + 0.35, y: y + 0.72, w: cw - 0.6, h: 0.85, fontFace: BODY, fontSize: 13, color: MUTE, valign: 'top', margin: 0 });
  });
  footer(s, 6);
}

const out = 'GitHub-Traffic-Executive-Summary.pptx';
pres.writeFile({ fileName: out }).then(() => console.log('WROTE', out));

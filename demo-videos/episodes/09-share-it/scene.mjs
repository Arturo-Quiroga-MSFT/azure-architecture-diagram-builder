// Episode 9 · Share It. Recorded live on production AADB (v2.1.13+).
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { film, config } from '../../engine/film.mjs';
import { recordDrawio } from './drawio-clip.mjs';

const run = promisify(execFile);

// Off camera: render the deck the way the audience sees it (PowerPoint → PDF → PNG), LibreOffice as fallback.
async function renderDeck(pptx, outDir, log) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const tmpPptx = '/tmp/aadb-ep9-deck.pptx', tmpPdf = '/tmp/aadb-ep9-deck.pdf';
  fs.copyFileSync(pptx, tmpPptx);
  fs.rmSync(tmpPdf, { force: true });
  let by = 'PowerPoint';
  // PowerPoint (macOS) renders with the deck's real fonts; LibreOffice substitutes missing ones.
  if (process.platform === 'darwin' && fs.existsSync('/Applications/Microsoft PowerPoint.app')) try {
    await run('osascript', ['-e', `with timeout of 150 seconds
tell application "Microsoft PowerPoint"
  open POSIX file "${tmpPptx}"
  delay 3
  save active presentation in POSIX file "${tmpPdf}" as save as PDF
  delay 1
  close active presentation saving no
end tell
end timeout`], { timeout: 170000 });
  } catch (e) { log('powerpoint render failed', String(e.message).slice(0, 200)); }
  else log('PowerPoint not available; rendering with LibreOffice');
  if (!fs.existsSync(tmpPdf)) {
    by = 'LibreOffice';
    await run(config('SOFFICE', 'soffice'), ['--headless', '--convert-to', 'pdf', '--outdir', '/tmp', tmpPptx], { timeout: 120000 });
  }
  await run(config('PDFTOPPM', 'pdftoppm'), ['-png', '-scale-to-x', '1280', '-scale-to-y', '-1', tmpPdf, path.join(outDir, 's')]);
  const slides = fs.readdirSync(outDir).filter((x) => x.endsWith('.png')).sort().map((x) => path.join(outDir, x));
  log('deck rendered by', by, slides.length, 'slides');
  return { slides, by };
}

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR, log, esc } = f;
  const DRAFT = path.join(DIR, 'assets', 'clinic-booking-first-draft.json');
  const has = (sel) => page.locator(sel).count().then((n) => n > 0);
  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
  };
  // A framed "app window" card around arbitrary content.
  const windowCard = (title, inner, { w = 1500, h = 880, light = false } = {}) => `<style>
      .xwin { width: ${w}px; border-radius: 16px; overflow: hidden; background: ${light ? '#fff' : '#111827'}; box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff22; text-align: left }
      .xbar { height: 40px; background: ${light ? '#e2e8f0' : '#1e293b'}; display: flex; align-items: center; gap: 8px; padding: 0 16px; font: 15px system-ui; color: ${light ? '#334155' : '#94a3b8'} }
      .xbar i { width: 12px; height: 12px; border-radius: 50%; display: inline-block }
      .xbody { height: ${h}px; position: relative; overflow: hidden }
      .xbody iframe, .xbody video { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: auto; background: ${light ? '#fff' : '#111827'} }
    </style>
    <div class="xwin in"><div class="xbar"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i>&nbsp; ${esc(title)}</div>
    <div class="xbody">${inner}</div></div>`;
  const shortName = (n) => n.replace(/-\d{10,}/, '').replace(/-gpt[\w-]+(?=\.)/, '');

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  const aud = (ic, who, what, d, col) => `<div class="node in" style="animation-delay:${d}s;width:300px;border-color:${col};box-shadow:0 0 34px ${col}55"><div class="ic">${ic}</div><b>${who}</b><span>${what}</span></div>`;
  await f.card(`<div class="in eyebrow">From design to everyone who needs it</div>
    <div class="in q" style="animation-delay:.3s">One design · many audiences</div>
    <div class="flow" style="gap:24px">
      ${aud('👔', 'Leadership', 'Customer deck (PowerPoint)', 1.4, '#60a5fa')}
      ${aud('🔎', 'Reviewers', 'Interactive web page', 2.0, '#a78bfa')}
      ${aud('🎬', 'Walkthroughs', 'Workflow animation', 2.6, '#34d399')}
      ${aud('🛠️', 'Architects', 'Draw.io · Visio', 3.2, '#fbbf24')}
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.6 });
  await f.opener({ title: 'Share <span class="g">It</span>', sub: 'Decks · interactive pages · animations · editable Draw.io and Visio, from one design', narr: 'n02-title' });

  // ── 2. Load the draft ────────────────────────────────────────────────────────
  await f.card('');
  await sleep(500);
  await f.cursor(true);
  await f.tag('Load a saved diagram');
  await f.pointTo('label[title="Load diagram"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.mouse.down().then(() => page.mouse.up())]);
  await fc.setFiles(DRAFT);
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 6, null, { timeout: 30000 });
  await page.mouse.move(1000, 640, { steps: 12 });
  await f.cursor(false);
  await tidy();
  await f.fit();
  f.reveal();
  await f.tag('Clinic Booking · first draft');
  await f.say('n03-draft', { pad: 0.5 });

  // ── 3. Quick review ──────────────────────────────────────────────────────────
  const vbtn = page.getByRole('button', { name: /^Validate Architecture/ }).first();
  await vbtn.evaluate((e) => e.setAttribute('data-v', 'vbtn'));
  const n4 = f.say('n04-validate', { wait: false, pad: 0.3 });
  await f.cursor(true);
  await f.ring('[data-v="vbtn"]', 'Validate Architecture', 6);
  await sleep(1800);
  await f.ring(null);
  await f.pointTo('[data-v="vbtn"]', { click: true });
  await f.cursor(false);
  await f.tag('Well-Architected review · sped up');
  let reviewed = false;
  await f.ff(async () => {
    reviewed = await page.waitForFunction(() => document.querySelector('.validation-score') && (document.querySelector('.score-summary')?.innerText || '').trim(), null, { timeout: 400000 }).then(() => true).catch(() => false);
    await sleep(1000);
  }, { max: 6 });
  await n4;
  // Scores are hidden until "show numbers" is ticked (same as Episode 5).
  const numbers = page.locator('.score-toggle input');
  if (reviewed && !(await numbers.isChecked().catch(() => true))) { await numbers.check().catch(() => {}); await sleep(600); }
  const score = await page.evaluate(() => {
    const t = (document.querySelector('.validation-score')?.innerText || '') + ' ' + (document.querySelector('.score-summary')?.innerText || '');
    return (t.match(/(\d{1,3})\s*\/\s*100/) || [])[1] || null;
  }).catch(() => null);
  log('review', reviewed, score);
  if (reviewed) {
    f.reveal();
    await f.ring('.validation-score', score ? `Well-Architected · ${score}/100` : 'Well-Architected review', 6);
    await sleep(2200);
    await f.ring(null);
  }
  await f.tag('');
  await page.locator('.validation-panel .modal-close').first().click({ timeout: 2000 }).catch(() => page.keyboard.press('Escape'));
  await page.locator('.validation-panel').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => log('validation panel still open'));
  await sleep(600);

  // ── 4. Share ─────────────────────────────────────────────────────────────────
  await f.cursor(true);
  await f.tag('Share or Build');
  const n5 = f.say('n05-share', { wait: false, pad: 0.4 });
  await f.pointTo(page.getByRole('button', { name: /Share or Build/ }).first(), { click: true });
  await sleep(1100);
  await page.locator('.deliver-choice-grid button').first().evaluate((e) => e.setAttribute('data-v', 'share'));
  await f.ring('[data-v="share"]', 'Share', 6);
  await sleep(1000);
  await f.ring(null);
  await f.pointTo('[data-v="share"]', { click: true });
  await page.locator('.reports-pane').waitFor({ timeout: 10000 });
  await page.mouse.move(1880, 600, { steps: 15 });
  await f.cursor(false);
  await f.tag('');
  f.reveal();
  await sleep(600);
  const sections = await page.evaluate(() => [...document.querySelectorAll('.reports-pane .reports-section')].map((s, i) => {
    s.setAttribute('data-v', `sec${i}`);
    return (s.querySelector('h3,h2')?.textContent || '').trim();
  }));
  log('sections', sections.join(' | '));
  for (const [i, name] of sections.entries()) {
    if (!/image|document|edit|cost/i.test(name)) continue;
    await page.locator(`[data-v="sec${i}"]`).evaluate((e) => e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    await sleep(350);
    await f.ring(`[data-v="sec${i}"]`, name.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase()), 6);
    await sleep(1500);
  }
  await n5;
  await f.ring(null);
  await page.locator('.reports-pane-inner').evaluate((e) => e.scrollIntoView({ block: 'start', behavior: 'smooth' })).catch(() => {});
  await sleep(500);

  const n6 = f.say('n06-background', { wait: false, pad: 0.4 });
  await f.ring('.reports-settings', 'Export background · Plain (recommended)', 6);
  await n6;
  await f.ring(null);

  // ── 5. Export four formats ───────────────────────────────────────────────────
  const exp = async (label, ring, { building } = {}) => {
    const card = page.locator('.reports-card').filter({ hasText: label }).first();
    await card.evaluate((e) => { e.setAttribute('data-v', 'xcard'); e.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
    await sleep(700);
    await f.ring('[data-v="xcard"]', ring, 6);
    await f.pointTo('[data-v="xcard"]');
    await sleep(700);
    // Some exports briefly switch to the canvas to capture it; don't leave a callout floating there.
    await f.ring(null);
    const dlP = page.waitForEvent('download', { timeout: 120000 });
    await f.pointTo('[data-v="xcard"]', { click: true, steps: 2 });
    let dl;
    if (building) {
      await f.tag(building);
      dl = await f.ff(() => dlP, { max: 4 });
    } else dl = await dlP;
    const file = path.join(f.DL, dl.suggestedFilename());
    await dl.saveAs(file);
    log('downloaded', path.basename(file), fs.statSync(file).size);
    await f.ring(null);
    await card.evaluate((e) => e.removeAttribute('data-v')).catch(() => {});
    await f.tag(`Saved · ${shortName(path.basename(file))}`);
    return file;
  };
  await f.cursor(true);
  const n7 = f.say('n07-deck', { wait: false, pad: 0.3 });
  const deckFile = await exp('Export Customer Deck (PPTX)', 'Customer deck · PowerPoint', { building: 'Capturing the diagram for the deck · sped up' });
  const deckP = renderDeck(deckFile, path.join(f.DL, 'deck'), log);
  await n7;
  const n8 = f.say('n08-html', { wait: false, pad: 0.3 });
  const htmlFile = await exp('Export Interactive HTML', 'Interactive web page · one file');
  await n8;
  const n9 = f.say('n09-workflow', { wait: false, pad: 0.3 });
  const wfFile = await exp('Export Workflow Animation', 'Workflow animation · SVG');
  await n9;
  const n10 = f.say('n10-editable', { wait: false, pad: 0.3 });
  const dioFile = await exp('Export Draw.io', 'Draw.io · editable');
  const dioP = recordDrawio(f.browser, dioFile, path.join(f.DL, 'drawio-clip'), log);
  await sleep(500);
  const vsdxFile = await exp('Export Visio (VSDX)', 'Visio · editable shapes');
  await n10;
  await f.cursor(false);
  await f.tag('');

  // ── 6. Open each one ─────────────────────────────────────────────────────────
  const chip = (ic, name, d) => `<div class="file in" style="animation-delay:${d}s">${ic} ${esc(shortName(path.basename(name)))}<small>${(fs.statSync(name).size / 1024).toFixed(0)} KB</small></div>`;
  await f.card(`<div class="in eyebrow">Open each one</div>
    <div class="files" style="grid-template-columns:repeat(3,420px)">
      ${chip('📊', deckFile, 0.3)}${chip('🌐', htmlFile, 0.5)}${chip('🎬', wfFile, 0.7)}
      ${chip('✏️', dioFile, 0.9)}${chip('📐', vsdxFile, 1.1)}
    </div>`);
  await sleep(400);
  await f.say('n11-open', { pad: 0.6 });

  // Deck, as rendered by PowerPoint.
  const deck = await deckP.catch((e) => { log('deck render error', e.message); return { slides: [] }; });
  const deckXml = (await run('unzip', ['-p', deckFile, 'ppt/slides/*.xml'], { maxBuffer: 64e6 }).catch(() => ({ stdout: '' }))).stdout;
  const deckHasReview = /Well-Architected/i.test(deckXml);
  log('deck review slide', deckHasReview);
  if (deck.slides.length) {
    const D = 2.6, N = deck.slides.length;
    const slides = deck.slides.map((s, i) => `<img class="sl" style="z-index:${i + 1};animation-delay:${0.6 + i * D}s" src="data:image/png;base64,${fs.readFileSync(s).toString('base64')}">`).join('');
    const thumbs = deck.slides.map((s, i) => `<img class="th" style="animation-delay:${0.6 + i * D}s;animation-duration:${D}s" src="data:image/png;base64,${fs.readFileSync(s).toString('base64')}">`).join('');
    await f.card(`<style>
        .deck { display: flex; flex-direction: column; align-items: center; gap: 18px }
        .stage { position: relative; width: 1280px; height: 720px; border-radius: 10px; overflow: hidden; box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff22; background: #fff }
        .stage .sl { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; animation: slin .5s ease forwards }
        .stage .sl:first-child { animation-delay: 0s !important; opacity: 1 }
        @keyframes slin { from { opacity: 0; transform: translateX(40px) } to { opacity: 1; transform: none } }
        .thumbs { display: flex; gap: 10px }
        .thumbs .th { width: 150px; height: 84px; border-radius: 5px; border: 3px solid transparent; opacity: .55; animation-name: thl; animation-timing-function: linear }
        @keyframes thl { 0%, 100% { border-color: #facc15; opacity: 1 } }
        .dcap { font: 17px system-ui; color: #94a3b8 }
      </style>
      <div class="deck in"><div class="dcap">${esc(shortName(path.basename(deckFile)))} · ${N} slides · opened in ${deck.by}</div>
      <div class="stage">${slides}</div><div class="thumbs">${thumbs}</div></div>`);
    f.reveal();
    const cue = deckHasReview ? 'n12-deck-show' : 'n12-deck-show-noreview';
    await sleep(800);
    await f.say(cue, { pad: 0.2 });
    await sleep(Math.max(0, (0.6 + N * D + 0.6) * 1000 - (f.narrDur(cue) + 1.0) * 1000));
  }

  // Interactive web page, live.
  const html = fs.readFileSync(htmlFile, 'utf8');
  await f.card(windowCard(`${path.basename(htmlFile)} · any browser`, '<iframe id="hx"></iframe>', { light: true }));
  await page.evaluate((h) => { document.getElementById('hx').srcdoc = h; }, html);
  await page.waitForFunction(() => document.getElementById('hx')?.contentDocument?.querySelector('.canvas'), null, { timeout: 10000 }).catch(() => {});
  await sleep(1200);
  await page.evaluate(() => {
    const fr = document.getElementById('hx'), c = document.getElementById('v-cursor');
    const mv = (e) => { const r = fr.getBoundingClientRect(); c.style.transform = `translate(${r.left + e.clientX - 4}px, ${r.top + e.clientY - 2}px)`; };
    fr.contentDocument.addEventListener('mousemove', mv, true);
  });
  f.reveal();
  const n13 = f.say('n13-html-show', { wait: false, pad: 0.4 });
  await f.cursor(true);
  const hx = page.frameLocator('#hx');
  const node = hx.getByText('Key Vault', { exact: true }).first();
  if (await f.pointTo(node, { steps: 34 })) {
    await sleep(2200);
  } else log('html: Key Vault not found');
  const box = await page.locator('#hx').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy, { steps: 25 });
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -160); await sleep(260); }
  await sleep(600);
  await f.drag({ x: cx, y: cy }, -260, -140, { steps: 40 });
  await sleep(600);
  const fn = hx.getByText('Azure Functions', { exact: true }).first();
  if (await fn.isVisible().catch(() => false)) { await f.pointTo(fn, { steps: 28 }); await sleep(1800); }
  await f.cursor(false);
  await n13;

  // Workflow animation, live.
  let svg = fs.readFileSync(wfFile, 'utf8');
  svg = svg.replace(/<svg([^>]*?)\swidth="[\d.]+"\s+height="[\d.]+"/, '<svg$1 width="100%" height="100%"');
  await f.card(windowCard(`${shortName(path.basename(wfFile))} · any browser`, '<iframe id="wx"></iframe>', { light: true }));
  await page.evaluate((s) => {
    document.getElementById('wx').srcdoc = `<!doctype html><html><head><style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}</style></head><body>${s}</body></html>`;
  }, svg);
  await sleep(500);
  f.reveal();
  await f.say('n14-workflow-show', { pad: 0.3 });
  await sleep(4200);

  // Draw.io, as recorded off camera in diagrams.net.
  const clip = await dioP.catch((e) => { log('drawio clip error', e.message); return null; });
  if (clip?.video && fs.existsSync(clip.video)) {
    log('drawio clip', JSON.stringify(clip));
    const b64 = fs.readFileSync(clip.video).toString('base64');
    await f.card(windowCard(`diagrams.net · ${path.basename(dioFile)} · real session`, '<video id="dx" muted playsinline></video>', { w: 1600, h: 900 }));
    await page.evaluate(async ({ b64, start }) => {
      const v = document.getElementById('dx');
      v.src = URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'video/webm' }));
      await new Promise((r) => { v.onloadedmetadata = r; setTimeout(r, 3000); });
      v.currentTime = start;
      await new Promise((r) => { v.onseeked = r; setTimeout(r, 2000); });
      await v.play().catch(() => {});
    }, { b64, start: Math.max(0, clip.start - 0.3) });
    f.reveal();
    await sleep(400);
    await f.say('n15-drawio', { pad: 0.3 });
    await sleep(Math.max(0, (clip.end - clip.start) * 1000 - (f.narrDur('n15-drawio') + 0.7) * 1000));
  }

  // ── 7. Recent exports ────────────────────────────────────────────────────────
  await f.card('');
  await sleep(500);
  if (await has('.reports-history')) {
    await page.locator('.reports-history').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await sleep(900);
    const n = await page.locator('.reports-history li').count();
    const n16 = f.say('n16-history', { wait: false, pad: 0.5 });
    await f.ring('.reports-history', `${n} exports this session`, 8);
    await n16;
    await f.ring(null);
  }

  // ── 8. Close ─────────────────────────────────────────────────────────────────
  await f.say('n17-close', { pad: 1.0 });
  await f.endCard();
});

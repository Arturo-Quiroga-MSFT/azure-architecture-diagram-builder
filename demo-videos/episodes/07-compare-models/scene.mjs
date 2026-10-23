// Episode 7 · Compare Models. Recorded live on production AADB.
import path from 'path';
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep, log } = f;
  const MODELS = ['GPT-6.1 Sol', 'Claude Opus 5.5', 'Mistral Large 3', 'Kimi K2.6'];
  const BRIEF = 'Patient appointment booking for a regional clinic network: web front end, booking API, appointments database, referral documents, secrets and monitoring';
  const VIS = '.compare-tab-body:not(.is-hidden)';
  const body = page.locator(VIS);

  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
  };
  const fitAll = async () => {
    await tidy();
    await f.fit();
    const k = await page.evaluate(() => {
      const pane = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!pane) return null;
      const vp = document.querySelector('.react-flow__viewport');
      const m = new DOMMatrixReadOnly(getComputedStyle(vp).transform);
      let l = 1e9, r = -1e9, t = 1e9, b = -1e9;
      document.querySelectorAll('.react-flow__node').forEach((n) => { const x = n.getBoundingClientRect(); l = Math.min(l, x.left); r = Math.max(r, x.right); t = Math.min(t, x.top); b = Math.max(b, x.bottom); });
      if (l >= pane.left + 20 && r <= pane.right - 20 && t >= pane.top + 60 && b <= pane.bottom - 20) return null;
      const fx = (x) => (x - pane.left - m.e) / m.a, fy = (y) => (y - pane.top - m.f) / m.a;
      const box = { l: fx(l), r: fx(r), t: fy(t), b: fy(b) };
      const area = { l: 40, t: 90, w: pane.width - 80, h: pane.height - 170 };
      const k = Math.min(area.w / (box.r - box.l), area.h / (box.b - box.t), m.a);
      const x = area.l + (area.w - (box.r - box.l) * k) / 2 - box.l * k;
      const y = area.t + (area.h - (box.b - box.t) * k) / 2 - box.t * k;
      vp.style.transition = 'transform .6s ease';
      vp.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      setTimeout(() => { vp.style.transition = ''; }, 700);
      return k;
    }).catch(() => null);
    if (k) { log('camera fit', k.toFixed(3)); await sleep(800); }
  };
  const center = (sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), sel).then(() => sleep(900));
  const tagEl = (loc, id) => loc.first().evaluate((e, id) => { document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v')); e.setAttribute('data-v', id); }, id).catch(() => {});

  // Select exactly MODELS in the visible tab, with a visible cursor click for each wanted model.
  const chooseModels = async () => {
    const chips = body.locator('.compare-model-chip');
    const n = await chips.count();
    for (let i = 0; i < n; i++) {
      const c = chips.nth(i);
      const name = (await c.locator('.compare-model-chip-name').innerText().catch(() => '')).trim();
      const on = /\bselected\b/.test((await c.getAttribute('class')) || '');
      if (on && !MODELS.includes(name)) await c.click();
    }
    for (const m of MODELS) {
      const c = body.locator('.compare-model-chip', { hasText: m }).first();
      if (!/\bselected\b/.test((await c.getAttribute('class')) || '')) await f.pointTo(c, { click: true, steps: 16 });
      else await f.pointTo(c, { steps: 16 });
      await sleep(250);
    }
    const sel = await body.locator('.compare-model-chip.selected .compare-model-chip-name').allInnerTexts();
    log('selected', sel.join(', '));
  };
  const waitResults = (min) => page.waitForFunction(({ VIS, min }) => {
    const b = document.querySelector(VIS);
    return b && b.querySelectorAll('.compare-result-running, .compare-result-pending').length === 0
      && b.querySelectorAll('.compare-apply-btn, .compare-result-error-msg').length >= min;
  }, { VIS, min }, { timeout: 900000 });

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  const chip = (t, d, col) => `<div class="node in" style="animation-delay:${d}s;width:300px;border-color:${col};box-shadow:0 0 34px ${col}55"><b style="font-size:30px;margin:0">${t}</b></div>`;
  await f.card(`<div class="in eyebrow">Same brief · different instincts</div>
    <div class="in q" style="animation-delay:.3s">Which model designs it best?</div>
    <div class="flow" style="gap:24px">${chip('GPT-6.1 Sol', 1.4, '#60a5fa')}${chip('Claude Opus 5.5', 2.0, '#f472b6')}${chip('Mistral Large 3', 2.6, '#fbbf24')}${chip('Kimi K2.6', 3.2, '#34d399')}</div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Compare <span class="g">Models</span>', sub: 'One brief, many models · AI critique · consensus validation', narr: 'n02-title' });

  // ── 2. Compare pane ──────────────────────────────────────────────────────────
  await f.card('');
  await sleep(400);
  await f.cursor(true);
  const n3 = f.say('n03-compare', { wait: false, pad: 0.3 });
  await f.pointTo(page.locator('.nav-rail-item', { hasText: 'Compare' }), { click: true });
  await page.locator('.compare-tabs').waitFor({ timeout: 10000 });
  await sleep(800);
  await f.pointTo(page.locator('.compare-tabs button', { hasText: 'Generation' }), { click: true });
  await sleep(900);
  await tagEl(page.locator('.compare-tabs'), 'tabs');
  await f.ring('[data-v="tabs"]', 'Generation · Validation', 4);
  await n3;
  await f.ring(null);

  // ── 3. Models and brief ──────────────────────────────────────────────────────
  await center(`${VIS} .compare-model-grid`);
  await tagEl(body.locator('.compare-model-grid'), 'grid');
  const n4 = f.say('n04-models', { wait: false, pad: 0.3 });
  await f.ring('[data-v="grid"]', '14 models · several providers', 6);
  await sleep(1500);
  await f.ring(null);
  await chooseModels();
  await n4;

  const prompt = body.locator('.compare-prompt');
  await prompt.scrollIntoViewIfNeeded();
  await f.pointTo(prompt, { click: true });
  await prompt.fill('');
  const n5 = f.say('n05-run', { wait: false, pad: 0.2 });
  await f.typeSlow(prompt, BRIEF.slice(0, 60), 18);
  await prompt.fill(BRIEF);
  await n5;
  const run = body.locator('.compare-run-btn');
  await run.scrollIntoViewIfNeeded();
  await f.pointTo(run, { click: true });
  await f.cursor(false);
  await f.tag('Four models, one brief · sped up');
  await sleep(1500);
  await center(`${VIS} .compare-results-grid`);
  await f.ff(() => waitResults(MODELS.length), { max: 7 });
  f.reveal();
  await f.tag('');
  await sleep(1200);
  for (const c of await body.locator('.compare-results-grid > *').allInnerTexts()) log('RESULT', c.replace(/\n/g, ' | ').slice(0, 220));

  // ── 4. Results ───────────────────────────────────────────────────────────────
  await center(`${VIS} .compare-results-grid`);
  await tagEl(body.locator('.compare-results-grid'), 'results');
  const n6 = f.say('n06-results', { wait: false, pad: 0.4 });
  await f.ring('[data-v="results"]', 'Side by side · same brief', 6);
  await sleep(4200);
  for (const [cls, label] of [['.compare-metric.highlight .compare-badge:not(.badge-thorough)', null], ['.badge-thorough', 'Most thorough']]) {
    const hit = body.locator(cls).first();
    if (await hit.count()) {
      await tagEl(hit.locator('xpath=ancestor::*[contains(@class,"compare-result-metrics")]'), 'badge');
      await f.ring('[data-v="badge"]', label || 'Fastest · cheapest · most thorough', 4);
      await sleep(2400);
    }
  }
  await n6;
  await f.ring(null);

  // ── 5. AI critique ───────────────────────────────────────────────────────────
  const critBtn = body.locator('.compare-critique-btn');
  await critBtn.scrollIntoViewIfNeeded();
  await sleep(600);
  await tagEl(body.locator('.compare-critique-controls'), 'critctl');
  const n7 = f.say('n07-critique', { wait: false, pad: 0.3 });
  await f.ring('[data-v="critctl"]', 'Critic model', 4);
  await sleep(2200);
  await f.ring(null);
  await f.cursor(true);
  await f.pointTo(critBtn, { click: true });
  await f.cursor(false);
  await n7;
  await f.tag('Critiquing · sped up');
  await f.ff(() => page.waitForFunction((VIS) => /Regenerate Critique/.test(document.querySelector(`${VIS} .compare-critique-btn`)?.textContent || ''), VIS, { timeout: 600000 }), { max: 4 });
  f.reveal();
  await f.tag('');
  await sleep(800);
  const critique = await body.locator('.compare-critique-output').innerText().catch(() => '');
  const ranked = MODELS.map((m) => ({ m, i: critique.indexOf(m) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i);
  const winner = (critique.match(/1\.\s*\**\s*([^—\n*]+?)\s*\**\s*—/) || [])[1]?.trim() || ranked[0]?.m || MODELS[1];
  log('critique winner', winner);
  await page.evaluate((VIS) => document.querySelector(`${VIS} .compare-critique-output`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), VIS);
  await sleep(1000);
  await tagEl(body.locator('.compare-critique-output'), 'crit');
  await f.ring('[data-v="crit"]', `Ranked · #1 ${winner}`, 6);
  await sleep(4500);
  await f.ring(null);

  // ── 6. The avatar presents ───────────────────────────────────────────────────
  const present = body.locator('.compare-avatar-btn');
  if (await present.count()) {
    await present.scrollIntoViewIfNeeded();
    await f.cursor(true);
    const n8 = f.say('n08-present', { wait: false, pad: 0.3 });
    await f.pointTo(present, { click: true });
    await n8;
    await f.tag('Connecting the avatar · sped up');
    const ok = await f.ff(() => page.waitForFunction(() => /Presenting/.test(document.querySelector('.compare-avatar-panel-title')?.textContent || ''), null, { timeout: 60000 }).then(() => true).catch(() => false), { max: 2 });
    await f.tag('');
    log('avatar presenting', ok);
    if (ok) {
      // Move the panel toward the middle and make it bigger.
      const hb = await page.locator('.compare-avatar-panel-header').first().boundingBox();
      if (hb) await f.drag({ x: hb.x + 60, y: hb.y + hb.height / 2 }, 1060 - (hb.x + 60), 150 - (hb.y + hb.height / 2), { steps: 30 });
      const rh = await page.locator('.compare-avatar-panel .avatar-resize-handle').first().boundingBox();
      if (rh) await f.drag({ x: rh.x + rh.width / 2, y: rh.y + rh.height / 2 }, 1860 - (rh.x + rh.width / 2), 1010 - (rh.y + rh.height / 2), { steps: 30 });
      await f.cursor(false);
      await f.tag('🎙️ AI presenter · ranking and recommendation');
      await sleep(26000);
      await f.tag('');
      await page.locator('.compare-avatar-action-btn.stop').first().click().catch(() => {});
      await sleep(800);
    }
    await page.locator('.compare-avatar-dismiss').first().click().catch(() => {});
    await f.cursor(false);
    await sleep(600);
  }

  // ── 7. Use the winner ────────────────────────────────────────────────────────
  const wcard = body.locator('.compare-results-grid > *', { hasText: winner }).first();
  await wcard.scrollIntoViewIfNeeded();
  await sleep(600);
  await tagEl(wcard, 'wcard');
  const n9 = f.say('n09-use', { wait: false, pad: 0.3 });
  await f.ring('[data-v="wcard"]', `#1 · ${winner}`, 6);
  await sleep(2000);
  await f.ring(null);
  await f.cursor(true);
  await f.pointTo(wcard.locator('.compare-apply-btn'), { click: true });
  await f.cursor(false);
  await n9;
  await sleep(1500);
  if (!(await page.locator('.react-flow__node').count())) await page.locator('.nav-rail-item', { hasText: 'Canvas' }).click().catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 4, null, { timeout: 120000 });
  await sleep(1500);
  await fitAll();
  f.reveal();
  await f.tag(`On the canvas · designed by ${winner}`);
  await sleep(2500);

  // ── 8. Make it yours ─────────────────────────────────────────────────────────
  const n10 = f.say('n10-yours', { wait: false, pad: 0.5 });
  await f.tag('Make it yours');
  await f.cursor(true);
  const grp = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => ({ n, b: n.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 40 && b.left > 140 && b.top > 300 && b.bottom < innerHeight - 60 && b.right < innerWidth - 160);
    const x = gs.sort((a, b) => a.b.width * a.b.height - b.b.width * b.b.height)[0];
    if (!x) return null;
    x.n.setAttribute('data-v', 'drag-group');
    return { x: x.b.left + Math.min(40, x.b.width / 3), y: x.b.top + 8, cx: x.b.left + x.b.width / 2 };
  });
  if (grp) {
    await f.ring('[data-v="drag-group"]', 'Drag groups and services anywhere', 8);
    await sleep(900);
    await f.ring(null);
    await f.drag(grp, grp.cx > 960 ? 170 : -150, 30);
  }
  await f.cursor(false);
  await n10;
  await f.tag('');

  // ── 9. Validation across models ──────────────────────────────────────────────
  await f.cursor(true);
  await f.pointTo(page.locator('.nav-rail-item', { hasText: 'Compare' }), { click: true });
  await sleep(900);
  await f.pointTo(page.locator('.compare-tabs button', { hasText: 'Validation' }), { click: true });
  await sleep(1200);
  const n11 = f.say('n11-validate', { wait: false, pad: 0.3 });
  await center(`${VIS} .compare-model-grid`);
  await chooseModels();
  await n11;
  const vrun = body.locator('.compare-run-btn');
  await vrun.scrollIntoViewIfNeeded();
  await f.pointTo(vrun, { click: true });
  await f.cursor(false);
  await f.tag('Four independent reviews · sped up');
  await sleep(1500);
  await center(`${VIS} .compare-results-grid`);
  await f.ff(() => waitResults(MODELS.length), { max: 7 });
  f.reveal();
  await f.tag('');
  await sleep(1200);
  for (const c of await body.locator('.compare-results-grid > *').allInnerTexts()) log('VRESULT', c.replace(/\n/g, ' | ').slice(0, 200));
  await center(`${VIS} .compare-results-grid`);
  await tagEl(body.locator('.compare-results-grid'), 'vres');
  const n12 = f.say('n12-vresults', { wait: false, pad: 0.4 });
  await f.ring('[data-v="vres"]', 'Five pillars · scored by each model', 8);
  await n12;
  await f.ring(null);

  // ── 10. Consensus ────────────────────────────────────────────────────────────
  await page.evaluate((VIS) => document.querySelector(`${VIS} .cv-consensus`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), VIS);
  await sleep(1200);
  const top = body.locator('.cv-consensus-card').first();
  const topPill = (await top.locator('.cv-conf-pill').innerText().catch(() => '')).trim();
  log('top consensus', topPill, (await top.locator('.cv-consensus-label').innerText().catch(() => '')).trim());
  await tagEl(body.locator('.cv-consensus-sub'), 'csub');
  const n13 = f.say('n13-consensus', { wait: false, pad: 0.4 });
  await f.ring('[data-v="csub"]', 'Merged across all four', 4);
  await sleep(2600);
  await tagEl(top, 'ctop');
  await f.ring('[data-v="ctop"]', `${topPill || 'Highest confidence'} · flagged independently`, 8);
  await n13;
  await sleep(800);
  await f.ring(null);

  // ── 11. Use a validation ─────────────────────────────────────────────────────
  const best = body.locator('.compare-results-grid > *', { has: page.locator('.cv-badge-findings') }).first();
  const pick = (await best.count()) ? best : body.locator('.compare-results-grid > *').first();
  await pick.scrollIntoViewIfNeeded();
  await sleep(600);
  await tagEl(pick, 'vpick');
  const n14 = f.say('n14-usevalidation', { wait: false, pad: 0.4 });
  await f.ring('[data-v="vpick"]', 'Use This Validation', 4);
  await sleep(1600);
  await f.ring(null);
  await f.cursor(true);
  await f.pointTo(pick.locator('.compare-apply-btn'), { click: true });
  await f.cursor(false);
  await sleep(1200);
  if (!(await page.locator('.validation-panel').isVisible().catch(() => false))) {
    await page.locator('.nav-rail-item', { hasText: 'Canvas' }).click().catch(() => {});
    await sleep(1200);
  }
  await page.locator('.validation-panel').waitFor({ timeout: 15000 }).catch(() => log('no validation panel'));
  await fitAll();
  f.reveal();
  await f.ring('.validation-panel', 'The chosen review, back on the canvas', 6);
  await n14;
  await sleep(1500);
  await f.ring(null);

  // ── 12. Close ────────────────────────────────────────────────────────────────
  await f.say('n15-close', { pad: 1.0 });
  await f.endCard();
});

// Episode 6 · Cost and Regions. Recorded live on production AADB.
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR, OUT, log, browser } = f;
  const DRAFT = path.join(DIR, 'assets', 'clinic-booking-first-draft.json');

  const cost = () => page.locator('.cost-indicator').first().innerText().then((s) => s.replace(/[^\d$.,/mo]/g, '').trim()).catch(() => '');
  const tagNode = (re, id) => page.evaluate(({ re, id }) => {
    document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v'));
    const n = [...document.querySelectorAll('.react-flow__node-azureNode')].find((e) => new RegExp(re).test(e.textContent || ''));
    if (!n) return false;
    n.setAttribute('data-v', id);
    n.querySelector('.cost-badge')?.setAttribute('data-v', `${id}-badge`);
    return true;
  }, { re, id });
  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
  };
  const zoomTo = async (sel, steps = 4) => {
    const b = await page.locator(sel).first().boundingBox().catch(() => null);
    if (!b) return;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, -120); await sleep(170); }
    await sleep(600);
  };
  const canvasFit = async () => { await tidy(); await f.fit(); };

  // Pick a region from the selector and wait for the total to reprice.
  const pickRegion = async (name) => {
    const before = await cost();
    await f.pointTo('.region-selector-button', { click: true });
    await page.locator('.region-dropdown').waitFor({ timeout: 5000 });
    await sleep(700);
    const opt = page.locator('.region-option', { hasText: name }).first();
    await opt.scrollIntoViewIfNeeded().catch(() => {});
    await f.pointTo(opt, { click: true });
    await page.waitForFunction((b) => {
      const t = (document.querySelector('.cost-indicator')?.textContent || '').replace(/[^\d$.,/mo]/g, '').trim();
      return t && t !== b;
    }, before, { timeout: 20000 }).catch(() => log('cost unchanged for', name));
    await sleep(800);
    const after = await cost();
    log('region', name, after);
    return after;
  };

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">The two questions</div>
    <div class="flow" style="gap:60px;margin-top:40px">
      <div class="node in hot" style="animation-delay:.6s;width:420px"><div class="ic">💲</div><b style="font-size:38px">What will it cost?</b></div>
      <div class="node in" style="animation-delay:2.4s;width:420px;border-color:#60a5fa;box-shadow:0 0 40px #3b82f688"><div class="ic">🌍</div><b style="font-size:38px">Where should it run?</b></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Cost and <span class="g">Regions</span>', sub: 'Live pricing per service · size for production · compare 14 regions', narr: 'n02-title' });

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
  await canvasFit();
  f.reveal();
  await f.tag('Clinic Booking · first draft');
  const c0 = await cost();
  log('draft cost', c0);
  const n3 = f.say('n03-draft', { wait: false, pad: 0.5 });
  await sleep(2200);
  await f.ring('.cost-indicator', 'Monthly run rate · Azure retail prices', 6);
  await sleep(2600);
  await f.ring('.region-selector-button', 'Selected region', 6);
  await n3;
  await f.ring(null);
  await f.tag('');

  // ── 3. Per-service badges ────────────────────────────────────────────────────
  await tagNode('App Service', 'app');
  const n4 = f.say('n04-badges', { wait: false, pad: 0.5 });
  await zoomTo('[data-v="app"]', 3);
  await tagNode('App Service', 'app');
  await sleep(1600);
  await f.ring('[data-v="app-badge"]', 'App Service plan · 58% of the bill', 8);
  await n4;
  await f.ring(null);
  await canvasFit();

  // ── 4. Regions ───────────────────────────────────────────────────────────────
  await f.cursor(true);
  await f.tag('Region');
  const n5 = f.say('n05-regions', { wait: false, pad: 0.3 });
  await f.pointTo('.region-selector-button', { click: true });
  await page.locator('.region-dropdown').waitFor({ timeout: 5000 });
  await sleep(900);
  await f.ring('.region-dropdown', '14 regions · each with its own price snapshot', 6);
  // Glide the cursor down the list.
  const opts = page.locator('.region-option');
  for (const i of [1, 3, 6, 9, 12]) {
    const o = opts.nth(i);
    if (await o.count()) { await o.scrollIntoViewIfNeeded().catch(() => {}); await f.pointTo(o, { steps: 18 }); await sleep(500); }
  }
  await n5;
  await f.ring(null);
  await page.keyboard.press('Escape').catch(() => {});
  if (await page.locator('.region-dropdown').isVisible().catch(() => false)) await page.locator('.region-selector-button').click();
  await sleep(500);

  const n6 = f.say('n06-canada', { wait: false, pad: 0.4 });
  const cCa = await pickRegion('Canada Central');
  await f.tag('🇨🇦 Canada Central');
  await f.ring('.cost-indicator', `${c0} in East US 2 → ${cCa}`, 6);
  await n6;
  await f.ring(null);

  const n7 = f.say('n07-brazil', { wait: false, pad: 0.4 });
  const cBr = await pickRegion('Brazil South');
  await f.tag('🇧🇷 Brazil South');
  await f.ring('.cost-indicator', `Same design · ${cBr}`, 6);
  await n7;
  await f.ring(null);

  await f.tag('Back to East US 2');
  await pickRegion('East US 2');
  await sleep(600);
  await f.tag('');

  // ── 5. Size for production ───────────────────────────────────────────────────
  await tagNode('App Service', 'app');
  await zoomTo('[data-v="app"]', 3);
  await tagNode('App Service', 'app');
  const n8 = f.say('n08-tier', { wait: false, pad: 0.3 });
  await f.tag('Click a price badge');
  await f.pointTo('[data-v="app-badge"]', { click: true });
  await page.locator('.npe-modal').waitFor({ timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('.npe-modal select option').length > 3, null, { timeout: 30000 }).catch(() => {});
  await sleep(900);
  const sel = page.locator('.npe-modal select').first();
  const optList = await sel.locator('option').evaluateAll((o) => o.map((x) => [x.value, x.textContent]));
  const p1 = optList.find((o) => /^P1 ?v3/i.test(o[1])) || optList.find((o) => /^P1/i.test(o[1]));
  await sel.evaluate((e) => e.setAttribute('data-v', 'tier'));
  await f.ring('[data-v="tier"]', 'Tier / SKU', 4);
  await f.pointTo(sel, { click: false });
  await sleep(700);
  if (p1) await sel.selectOption(p1[0]);
  await sleep(1200);
  const qty = page.locator('.npe-modal input[type="number"]').first().or(page.locator('.npe-modal input').first());
  await qty.first().evaluate((e) => e.setAttribute('data-v', 'qty')).catch(() => {});
  await f.ring('[data-v="qty"]', 'Instances', 4);
  await f.pointTo(qty.first(), { click: true });
  await qty.first().selectText().catch(() => {});
  await page.keyboard.type('2', { delay: 80 });
  if ((await qty.first().inputValue().catch(() => '2')) !== '2') await qty.first().fill('2');
  log('instances', await qty.first().inputValue().catch(() => '?'));
  await sleep(900);
  await n8;
  const n9 = f.say('n09-tier-cost', { wait: false, pad: 0.4 });
  const est = page.locator('.npe-modal').getByText(/Estimated .*monthly cost/i).locator('..');
  await est.first().evaluate((e) => e.setAttribute('data-v', 'est')).catch(() => {});
  await f.ring('[data-v="est"]', 'Previewed before you apply', 6);
  await sleep(3200);
  await page.locator('.npe-modal input[type="checkbox"]').first().evaluate((e) => e.closest('label')?.setAttribute('data-v', 'override')).catch(() => {});
  await f.ring('[data-v="override"]', 'Or use your negotiated price', 6);
  await sleep(2600);
  await f.ring(null);
  await f.pointTo('.npe-btn--primary', { click: true });
  await sleep(1500);
  await f.cursor(false);
  const cP = await cost();
  log('production cost', cP);
  await f.tag('App Service · Premium v3 × 2');
  await tagNode('App Service', 'app');
  await f.ring('[data-v="app-badge"]', 'Repriced', 6);
  await sleep(1500);
  await f.ring('.cost-indicator', `${c0} → ${cP}`, 6);
  await n9;
  await f.ring(null);
  await f.tag('');

  // ── 6. Make it yours ─────────────────────────────────────────────────────────
  await canvasFit();
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
    await f.drag(grp, grp.cx > 960 ? 180 : -160, 30);
  }
  await n10;
  await f.tag('');

  // ── 7. Export the cost report ────────────────────────────────────────────────
  const n11 = f.say('n11-export', { wait: false, pad: 0.3 });
  await f.tag('Export');
  await f.pointTo(page.getByRole('button', { name: /^Export/ }).first(), { click: true });
  await sleep(1500);
  const card = page.getByText('Export Costs (All Formats)').first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.evaluate((e) => (e.closest('button') || e).setAttribute('data-v', 'costcard')).catch(() => {});
  await sleep(600);
  await f.ring('[data-v="costcard"]', 'CSV · JSON · Cost Intelligence report', 6);
  await sleep(1800);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    f.pointTo('[data-v="costcard"]', { click: true }),
  ]);
  const zip = path.join(f.DL, dl.suggestedFilename());
  await dl.saveAs(zip);
  log('downloaded', path.basename(zip));
  await f.ring(null);
  await f.cursor(false);
  await f.tag(`Saved · ${path.basename(zip).replace(/-\d{10,}-/, '-…-')}`);
  await n11;

  // Render the HTML report off-camera and scroll it in a framed window.
  const zdir = path.join(f.DL, 'costzip');
  fs.rmSync(zdir, { recursive: true, force: true });
  fs.mkdirSync(zdir, { recursive: true });
  execFileSync('unzip', ['-oq', zip, '-d', zdir]);
  const html = fs.readdirSync(zdir).find((x) => x.endsWith('-report.html'));
  const rctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
  const rp = await rctx.newPage();
  await rp.goto('file://' + path.join(zdir, html));
  await rp.waitForTimeout(2000);
  const marks = await rp.evaluate(() => {
    const hs = [...document.querySelectorAll('h1,h2')];
    const top = hs.find((h) => /Intelligence/.test(h.textContent))?.offsetTop ?? 0;
    const reg = hs.find((h) => /Multi-region/.test(h.textContent));
    let end = document.body.scrollHeight;
    if (reg) { let t = reg.nextElementSibling; while (t && t.tagName !== 'TABLE') t = t.nextElementSibling; if (t) end = t.offsetTop + t.offsetHeight + 120; }
    return { top: Math.max(0, top - 30), end };
  });
  const png = await rp.screenshot({ fullPage: true });
  await rctx.close();
  const H = 860, dist = Math.max(0, marks.end - H - marks.top);
  log('report scroll', JSON.stringify(marks), dist);
  await f.tag('');
  await f.card(`<style>
      @keyframes rscroll { 0%,8% { transform: translateY(-${marks.top}px) } 92%,100% { transform: translateY(-${marks.top + dist}px) } }
      .rwin { width: 1040px; height: ${H + 52}px; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff22; }
      .rbar { height: 40px; background: #e2e8f0; display: flex; align-items: center; gap: 8px; padding: 0 16px; font: 15px system-ui; color: #334155 }
      .rbar i { width: 12px; height: 12px; border-radius: 50%; display: inline-block }
      .rview { height: ${H}px; overflow: hidden; display: block; text-align: left }
      .rview img { display: block; width: 1000px; height: auto; max-width: none; max-height: none; margin: 0 20px; animation: rscroll 17s cubic-bezier(.45,0,.55,1) .6s forwards; transform: translateY(-${marks.top}px) }
    </style>
    <div class="rwin in"><div class="rbar"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i>&nbsp; Cost Intelligence Report · ${f.esc(html.replace(/-\d{10,}-/, '-…-'))}</div>
    <div class="rview"><img src="data:image/png;base64,${png.toString('base64')}"></div></div>`);
  await sleep(1500);
  await f.say('n12-report', { pad: 0.2 });
  await sleep(Math.max(0, 17600 - 1500 - (f.narrDur('n12-report') + 0.2) * 1000));
  await f.card('');
  await sleep(400);

  // ── 8. Hide cost for customer-facing views ───────────────────────────────────
  await f.cursor(true);
  await page.locator('.nav-rail button, .nav-rail a').filter({ hasText: 'Canvas' }).first().click().catch(async () => {
    await page.getByRole('button', { name: /^Canvas$/ }).first().click().catch(() => {});
  });
  await page.locator('.cost-visibility-toggle').waitFor({ timeout: 10000 });
  await sleep(1000);
  await canvasFit();
  const n13 = f.say('n13-hide', { wait: false, pad: 0.4 });
  await f.ring('.cost-visibility-toggle', 'Hide cost estimates', 4);
  await sleep(2200);
  await f.ring(null);
  await f.pointTo('.cost-visibility-toggle', { click: true });
  await f.tag('Costs hidden · design only');
  await sleep(2400);
  await n13;
  await f.pointTo('.cost-visibility-toggle', { click: true });
  await f.cursor(false);
  await f.tag('');
  await sleep(800);

  // ── 9. Close ─────────────────────────────────────────────────────────────────
  await f.say('n14-close', { pad: 1.0 });
  await f.endCard();
});

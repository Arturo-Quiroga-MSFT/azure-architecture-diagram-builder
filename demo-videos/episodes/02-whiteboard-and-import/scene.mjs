// Episode 2 · Whiteboard and Import. Recorded live on production AADB.
import fs from 'fs';
import path from 'path';
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR } = f;
  const ASSETS = path.join(DIR, 'assets');
  const SKETCH = path.join(ASSETS, 'whiteboard-real-time-messaging.png');
  const ARM = path.join(ASSETS, 'contoso-orders-rg-export.json');

  const tagText = (texts, id, sel = 'div,section,aside,button,span,li') => page.evaluate(({ texts, id, sel }) => {
    const hit = [...document.querySelectorAll(sel)]
      .filter((e) => texts.every((t) => (e.textContent || '').includes(t)) && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (hit) hit.setAttribute('data-v', id);
    return !!hit;
  }, { texts, id, sel });

  const zoomIntoBusiestGroup = async (steps = 4) => {
    const g = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')].map((m) => m.getBoundingClientRect());
      const best = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => {
        const b = n.getBoundingClientRect();
        return { b, k: nodes.filter((r) => r.left > b.left && r.right < b.right && r.top > b.top && r.bottom < b.bottom).length };
      }).sort((a, b) => b.k - a.k)[0];
      return best && { x: best.b.left + best.b.width / 2, y: best.b.top + best.b.height / 2 };
    });
    if (!g) return;
    await page.mouse.move(g.x, g.y, { steps: 20 });
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, -120); await sleep(180); }
    await sleep(700);
  };

  const pickGroup = () => page.evaluate(() => {
    const gs = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => ({ n, b: n.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 0 && b.left > 140 && b.top > 280 && b.bottom < innerHeight - 140 && b.right < innerWidth - 200);
    const x = gs.sort((a, b) => b.b.width * b.b.height - a.b.width * a.b.height)[0];
    if (!x) return null;
    x.n.setAttribute('data-v', 'drag-group');
    return { x: x.b.left + Math.min(60, x.b.width / 3), y: x.b.top + 14 };
  });

  const toCanvas = async () => {
    await page.getByRole('button', { name: 'Exit Focus' }).click({ timeout: 2000 }).catch(() => {});
    await page.getByRole('button', { name: 'Show the toolbar' }).click({ timeout: 2000 }).catch(() => {});
    await sleep(900);
  };

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">Where do architectures come from?</div>
    <div class="row">
      <div class="tile in" style="animation-delay:.5s;opacity:.55"><div class="ic">💬</div><b>A sentence</b><span>Episode 1</span></div>
      <div class="tile in" style="animation-delay:2.2s;border-color:#a78bfa;box-shadow:0 0 40px #8b5cf666"><div class="ic">🖍️</div><b>A whiteboard</b><span>photo, sketch or napkin</span></div>
      <div class="tile in" style="animation-delay:3.6s;border-color:#60a5fa;box-shadow:0 0 40px #3b82f666"><div class="ic">☁️</div><b>Already running</b><span>template or live resource group</span></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'From a whiteboard, <span class="g">or what\'s already running</span>', sub: 'Sketches, templates and live resource groups become editable Azure diagrams', narr: 'n02-title' });

  // ── 2. The whiteboard photo ──────────────────────────────────────────────────
  const img = `data:image/jpeg;base64,${fs.readFileSync(path.join(ASSETS, 'whiteboard-stage.jpg')).toString('base64')}`;
  await f.stage(`<img class="slide" src="${img}" style="width:1500px">`);
  await f.card('');
  await sleep(300);
  await page.evaluate(() => document.querySelector('#v-stage .slide')?.classList.add('on'));
  await f.tag('Whiteboard from a design session');
  await f.say('n03-photo', { pad: 0.6 });

  // ── 3. Upload it ─────────────────────────────────────────────────────────────
  await f.stage('');
  await f.tag('Generate Diagram · upload a sketch');
  await f.subTop(true);
  await f.cursor(true);
  await f.pointTo(page.getByRole('button', { name: 'Generate Diagram' }).first(), { click: true });
  await sleep(900);
  const n4 = f.say('n04-upload', { wait: false });
  const drop = page.getByText('Drop an architecture diagram here');
  await f.pointTo(drop, { steps: 30 });
  await tagText(['Drop an architecture diagram here'], 'drop', 'div');
  await f.ring('[data-v="drop"]', 'Photo, screenshot, sketch or napkin drawing', 6);
  await sleep(900);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.mouse.down().then(() => page.mouse.up())]);
  await f.ring(null);
  await chooser.setFiles(SKETCH);
  await sleep(600);
  if (await tagText(['Analyzing diagram with AI'], 'analyzing', 'div')) await f.ring('[data-v="analyzing"]', 'Reading boxes, arrows and handwriting', 6);
  await page.getByText('Analyzing diagram with AI').waitFor({ state: 'detached', timeout: 240000 }).catch(() => {});
  await n4;
  await f.ring(null);
  await sleep(600);

  // ── 4. Generate from the sketch ──────────────────────────────────────────────
  await f.pointTo(page.getByRole('button', { name: /Generate Architecture/ }), { click: true });
  await f.tag('Generating from the sketch · sped up');
  await f.say('n05-gen', { pad: 0.3 });
  await f.ff(async () => {
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 6, null, { timeout: 420000 });
    await sleep(3000);
    await page.keyboard.press('Escape');
    await sleep(500);
    await f.fit();
  });
  f.reveal();
  await f.subTop(false);
  await f.cursor(false);
  await f.tag('');
  f.log('sketch nodes', await page.locator('.react-flow__node').count());
  await sleep(2500);

  // ── 5. Tour ──────────────────────────────────────────────────────────────────
  let n6 = null;
  await f.showcase({
    onGroup: async (label) => {
      if (!n6) n6 = f.say('n06-tour', { wait: false, pad: 0.2 });
      await f.tag(label ? `🔎 ${label}` : '');
    },
  });
  await n6;
  await f.tag('');

  // ── 6. The pinned reference sketch ───────────────────────────────────────────
  await toCanvas();
  await f.fit();
  const n7 = f.say('n07-ref', { wait: false, pad: 0.8 });
  if (await page.locator('.ref-image-viewer').count()) {
    await f.ring('.ref-image-viewer', 'The original sketch, pinned to the canvas', 6);
    await sleep(2000);
    await f.ring(null);
    await f.cursor(true);
    await f.pointTo('.ref-image-thumb', { click: true }).catch(() => {});
    await sleep(3200);
    await page.mouse.move(960, 700, { steps: 15 });
    for (let i = 0; i < 3 && await page.locator('.ref-image-overlay').count(); i++) {
      await page.evaluate(() => { const b = document.querySelector('.ref-image-close-btn'); if (b) b.click(); else document.querySelector('.ref-image-overlay')?.click(); });
      await sleep(500);
    }
    f.log('overlay after close', await page.locator('.ref-image-overlay').count());
    await f.cursor(false);
  }
  await n7;

  // ── 7. Already running? Import it ────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">Part two</div>
    <h1 class="in" style="animation-delay:.25s">Already running <span class="g">in Azure?</span></h1>
    <div class="in sub" style="animation-delay:.8s">Bicep · Terraform · ARM · a live resource group</div>`);
  await sleep(400);
  await f.say('n08-import', { pad: 0.6 });
  await f.card('');
  await sleep(700);
  await page.evaluate(() => document.querySelector('.ref-image-btn-dismiss')?.click());
  await sleep(300);
  await page.getByRole('button', { name: 'Show the toolbar' }).click({ timeout: 1500 }).catch(() => {});
  await f.cursor(true);
  await f.tag('Import');
  await f.pointTo(page.locator('button[aria-haspopup="menu"]', { hasText: 'Import' }).first(), { click: true });
  await sleep(700);
  const n9 = f.say('n09-options', { wait: false, pad: 0.4 });
  const menu = page.locator('[role=menu][aria-label="Import options"]');
  await menu.locator('[role=menuitem]', { hasText: 'Template file' }).first().evaluate((e) => e.setAttribute('data-v', 'opt-template'));
  await menu.locator('[role=menuitem], button', { hasText: 'From Azure' }).first().evaluate((e) => e.setAttribute('data-v', 'opt-azure'));
  await f.ring('[data-v="opt-template"]', 'Bicep, Terraform or ARM template', 4);
  await f.pointTo('[data-v="opt-template"]', { steps: 14 });
  await sleep(3800);
  await f.ring('[data-v="opt-azure"]', 'Live resource group · read-only · your own permissions', 4);
  await f.pointTo('[data-v="opt-azure"]', { steps: 14 });
  await n9;
  await f.ring(null);

  // ── 8. Import the exported resource group ────────────────────────────────────
  await f.pointTo('[data-v="opt-template"]', { steps: 10 });
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.mouse.down().then(() => page.mouse.up())]);
  await fc.setFiles(ARM);
  await page.waitForFunction(() => /Mapped \d+ resources/.test(document.body.innerText), null, { timeout: 120000 });
  await sleep(600);
  await page.locator('.react-flow__controls-fitview').click().catch(() => {});
  f.reveal();
  await f.cursor(false);
  await f.tag('Imported: contoso-orders-rg-export.json');
  await sleep(800);
  const n10 = f.say('n10-arm', { wait: false, pad: 0.4 });
  await sleep(2600);
  if (await tagText(['Mapped', 'resources', 'links'], 'mapped', 'div')) await f.ring('[data-v="mapped"]', 'Every resource mapped · every reference a link', 6);
  await n10;
  await f.ring(null);

  // ── 9. Labelled edges ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Hide the toolbar' }).click({ timeout: 1500 }).catch(() => {});
  await sleep(500);
  await f.fit();
  await zoomIntoBusiestGroup(6);
  const n11 = f.say('n11-edges', { wait: false, pad: 0.6 });
  await sleep(1200);
  for (const label of ['runs in', 'pulls images from', 'reads secrets from', 'sends messages to']) {
    const ok = await page.evaluate((lbl) => {
      const els = [...document.querySelectorAll('.react-flow__edgelabel-renderer *, .react-flow__edge-text')]
        .filter((e) => e.children.length === 0 && (e.textContent || '').trim() === lbl)
        .map((e) => ({ e, b: e.getBoundingClientRect() }))
        .filter(({ b }) => b.width > 0 && b.left > 140 && b.right < innerWidth - 140 && b.top > 120 && b.bottom < innerHeight - 140);
      document.querySelectorAll('[data-v="edge"]').forEach((x) => x.removeAttribute('data-v'));
      if (!els.length) return false;
      els[0].e.setAttribute('data-v', 'edge'); return true;
    }, label);
    if (ok) { await f.ring('[data-v="edge"]', `“${label}”`, 8); await sleep(1700); }
  }
  await n11;
  await f.ring(null);

  // ── 10. Make it yours ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Show the toolbar' }).click({ timeout: 1500 }).catch(() => {});
  await sleep(500);
  await f.fit();
  await page.addStyleTag({ content: '.canvas-layout-hint { display: flex !important; }' });
  await sleep(400);
  const n12 = f.say('n12-yours', { wait: false, pad: 0.6 });
  await f.tag('Make it yours');
  if (await page.locator('.canvas-layout-hint').count()) {
    await f.ring('.canvas-layout-hint', "AADB's own reminder", 6);
    await sleep(2400);
    await f.ring(null);
  }
  await f.cursor(true);
  const grp = await pickGroup();
  if (grp) {
    await f.ring('[data-v="drag-group"]', 'Drag groups and services anywhere', 8);
    await sleep(900);
    await f.ring(null);
    await f.drag(grp, -320, 40);
  }
  await n12;
  await f.cursor(false);
  await f.tag('');

  // ── 11. Close ────────────────────────────────────────────────────────────────
  await f.fit();
  await f.say('n13-close', { pad: 1.2 });
  await f.endCard();
});

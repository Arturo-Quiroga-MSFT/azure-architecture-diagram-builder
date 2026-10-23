// Episode 1 · Prompt to Architecture. Recorded live on production AADB.
import { film } from '../../engine/film.mjs';

const BRIEF = 'Black Friday-ready e-commerce platform for a global retailer: a web storefront and mobile API that scale to 50,000 concurrent shoppers, product search with AI recommendations, an order pipeline that never loses an order, real-time fraud checks on payments, and dashboards for the operations team. Primary region East US 2.';

await film(import.meta.url, async (f) => {
  const { page, sleep } = f;

  // Tag the smallest element whose text matches, walking up `up` levels, so ring() can target it.
  // Tag the smallest element that contains all the given texts, so ring() can target it.
  const tagEl = (texts, id) => page.evaluate(({ texts, id }) => {
    const hit = [...document.querySelectorAll('div,section,aside')]
      .filter((e) => texts.every((t) => (e.textContent || '').includes(t)) && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (hit) hit.setAttribute('data-v', id);
    return !!hit;
  }, { texts, id });

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">Every Azure conversation starts the same way</div>
    <div class="in q" style="animation-delay:.6s;font-size:46px;font-weight:500;color:#cbd5e1;max-width:1300px;font-style:italic">“We need a storefront that survives Black Friday…”</div>
    <div class="flow" style="margin-top:60px">
      <div class="node in" style="animation-delay:2.2s"><div class="ic">💬</div><b>A description</b><span>in the customer's words</span></div>
      <div class="arrow in" style="animation-delay:3s"></div>
      <div class="node in hot" style="animation-delay:3.6s"><div class="ic">🏗️</div><b>An architecture</b><span>someone has to draw</span></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'From a sentence to <span class="g">an Azure architecture</span>', sub: 'Generate a complete design from one prompt', narr: 'n02-promise' });

  // ── 2. Generate Diagram dialog ───────────────────────────────────────────────
  await f.subTop(true);
  await f.card('');
  await sleep(700);
  await f.cursor(true);
  await f.pointTo(page.getByRole('button', { name: 'Generate Diagram' }).first(), { click: true });
  await sleep(900);
  await f.tag('Generate Diagram');
  await sleep(700);
  const box = page.getByPlaceholder(/Describe a new architecture/);
  await box.evaluate((el) => el.setAttribute('data-v', 'brief'));
  const n3 = f.say('n03-dialog', { wait: false });
  await sleep(2200);
  await f.ring('[data-v="brief"]', 'Describe it in plain language', 6);
  await sleep(3000);
  if (await tagEl(['Example Prompts', 'Three-tier web app', 'Serverless event processing'], 'examples')) await f.ring('[data-v="examples"]', 'Or start from a ready-made example', 6);
  await n3;
  await f.ring(null);

  // ── 3. The brief ─────────────────────────────────────────────────────────────
  await f.pointTo(box, { click: true });
  const n4 = f.say('n04-brief', { wait: false, pad: 0.4 });
  await sleep(300);
  await f.ring('[data-v="brief"]', "The customer's words, not a service list", 6);
  await box.pressSequentially(BRIEF, { delay: 14 });
  await n4;
  await f.ring(null);

  // ── 4. Model and reasoning ───────────────────────────────────────────────────
  await page.locator('select[aria-label="Select AI model"]').evaluate((el) => el.closest('div[class]')?.parentElement?.setAttribute('data-v', 'model'));
  const n5 = f.say('n05-model', { wait: false, pad: 0.5 });
  await sleep(600);
  await f.ring('[data-v="model"]', 'Model + reasoning effort', 6);
  await n5;
  await f.ring(null);

  // ── 5. Generate ──────────────────────────────────────────────────────────────
  await f.pointTo(page.getByRole('button', { name: /Generate Architecture/ }), { click: true });
  await f.tag('Generating with Azure OpenAI · sped up');
  await f.say('n06-gen', { pad: 0.3 });
  await f.ff(async () => {
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 6, null, { timeout: 420000 });
    await sleep(2500);
    await page.keyboard.press('Escape');
    await sleep(500);
    await f.fit();
  });
  f.reveal();
  await f.subTop(false);
  await f.cursor(false);
  await f.tag('');
  f.log('nodes', await page.locator('.react-flow__node').count());
  await sleep(3000);

  // ── 6. Tour ──────────────────────────────────────────────────────────────────
  let n7 = null;
  await f.showcase({
    onGroup: async (label) => {
      if (!n7) n7 = f.say('n07-tour', { wait: false, pad: 0.2 });
      await f.tag(label ? `🔎 ${label}` : '');
    },
  });
  await n7;
  await f.tag('');

  // ── 7. Make it yours ─────────────────────────────────────────────────────────
  // Zoom into the busiest group so the drag reads on screen, move a service, then zoom out
  // and move a whole group. The drawn cursor makes the gestures visible.
  const zoomInto = async () => {
    const g = await page.evaluate(() => {
      const gs = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => ({ n, c: n.querySelectorAll('.react-flow__node').length, b: n.getBoundingClientRect() }));
      const best = gs.map((x) => ({ ...x, k: document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)').length && [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')].filter((m) => { const r = m.getBoundingClientRect(); return r.left > x.b.left && r.right < x.b.right && r.top > x.b.top && r.bottom < x.b.bottom; }).length }))
        .sort((a, b) => b.k - a.k)[0];
      return best && { x: best.b.left + best.b.width / 2, y: best.b.top + best.b.height / 2 };
    });
    if (!g) return;
    await page.mouse.move(g.x, g.y, { steps: 20 });
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await sleep(180); }
    await sleep(600);
  };
  const pickNode = () => page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')]
      .map((n) => ({ n, b: n.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 0 && b.left > 450 && b.right < innerWidth - 500 && b.top > 260 && b.bottom < innerHeight - 260);
    const x = nodes.sort((a, b) => Math.hypot(a.b.left - innerWidth / 2, a.b.top - innerHeight / 2) - Math.hypot(b.b.left - innerWidth / 2, b.b.top - innerHeight / 2))[0];
    if (!x) return null;
    x.n.setAttribute('data-v', 'drag-node');
    return { x: x.b.left + x.b.width / 2, y: x.b.top + x.b.height / 2 };
  });
  const pickGroup = () => page.evaluate(() => {
    const gs = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => ({ n, b: n.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 0 && b.left > 120 && b.top > 150 && b.bottom < innerHeight - 120);
    const x = gs.sort((a, b) => a.b.width * a.b.height - b.b.width * b.b.height)[0];
    if (!x) return null;
    x.n.setAttribute('data-v', 'drag-group');
    return { x: x.b.left + Math.min(60, x.b.width / 3), y: x.b.top + 14 };
  });
  await f.tag('Make it yours');
  await f.cursor(true);
  const n7b = f.say('n07b-yours', { wait: false, pad: 0.6 });
  await zoomInto();
  const node = await pickNode();
  if (node) {
    await f.ring('[data-v="drag-node"]', 'Drag any service · connections follow', 10);
    await sleep(1100);
    await f.ring(null);
    await f.drag(node, 230, 120);
    await sleep(900);
  }
  await f.fit();
  const grp = await pickGroup();
  if (grp) {
    await f.ring('[data-v="drag-group"]', 'Move whole groups too', 8);
    await sleep(1000);
    await f.ring(null);
    await f.drag(grp, -160, 90);
    await sleep(700);
  }
  await n7b;
  await f.cursor(false);
  await f.tag('');

  // ── 8. Workflow panel ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Exit Focus' }).click({ timeout: 2000 }).catch(() => {});
  await page.getByRole('button', { name: 'Show the toolbar' }).click({ timeout: 2000 }).catch(() => {});
  await sleep(1000);
  if (await page.locator('.workflow-panel.collapsed').count()) await page.locator('.workflow-panel .workflow-header').click();
  await sleep(800);
  await f.fit();
  const n8 = f.say('n08-workflow', { wait: false, pad: 0.4 });
  await f.ring('.workflow-panel', 'Architecture Workflow · step by step', 4);
  await sleep(1800);
  await f.ring(null);
  await f.cursor(true);
  for (const i of [0, 1, 2]) {
    await f.pointTo(page.locator('.workflow-step').nth(i), { click: true, steps: 18 }).catch(() => {});
    await sleep(1300);
  }
  await f.pointTo(page.locator('.workflow-step').nth(2), { click: true, steps: 8 }).catch(() => {});
  await n8;
  await page.mouse.move(960, 700, { steps: 15 });
  await f.cursor(false);

  // ── 9. Cost ──────────────────────────────────────────────────────────────────
  const cost = (await page.locator('.cost-indicator').first().innerText().catch(() => '')).replace(/[^\d$,.k/]/gi, '').trim();
  const n9 = f.say('n09-cost', { wait: false, pad: 0.6 });
  await sleep(1200);
  await f.ring('.cost-indicator', `Monthly run rate${cost ? ` ≈ ${cost}` : ''} · Azure Retail Prices`, 6);
  await n9;
  await f.ring(null);

  // ── 10. Close ────────────────────────────────────────────────────────────────
  await f.fit();
  await f.say('n10-close', { pad: 1.2 });
  await f.endCard();
});

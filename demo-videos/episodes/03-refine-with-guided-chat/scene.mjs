// Episode 3 · Refine with Guided Chat. Recorded live on production AADB.
import path from 'path';
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR } = f;
  const DRAFT = path.join(DIR, 'assets', 'clinic-booking-first-draft.json');
  const REQUEST = 'Add a Redis cache between the booking API and the database';

  // Tag the smallest visible element containing all of `texts`.
  const tagText = (texts, id, sel = 'div,section,aside,button,span,li') => page.evaluate(({ texts, id, sel }) => {
    document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v'));
    const hit = [...document.querySelectorAll(sel)]
      .filter((e) => texts.every((t) => (e.textContent || '').includes(t)) && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (hit) hit.setAttribute('data-v', id);
    return !!hit;
  }, { texts, id, sel });

  const tagNode = (label, id) => page.evaluate(({ label, id }) => {
    document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v'));
    const n = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')]
      .find((e) => (e.textContent || '').includes(label) && e.getBoundingClientRect().width > 0);
    if (!n) return null;
    n.setAttribute('data-v', id);
    const b = n.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, { label, id });

  const lastReply = () => page.evaluate(() => {
    document.querySelectorAll('[data-v="reply"]').forEach((x) => x.removeAttribute('data-v'));
    const b = [...document.querySelectorAll('.arch-chat-bubble')].at(-1);
    if (b) b.setAttribute('data-v', 'reply');
    return b?.innerText || '';
  });

  // Finished replies (assistant or error), excluding the in-progress spinner row.
  const replies = () => page.evaluate(() => [...document.querySelectorAll('.arch-chat-msg-assistant, .arch-chat-msg-error')]
    .filter((m) => !m.querySelector('.spin')).length);
  // Wait for one Guided Chat change to land (or for the extra-services review).
  const waitForChange = async (repliesBefore) => {
    await page.waitForFunction((n) => document.querySelector('.arch-chat-review')
      || [...document.querySelectorAll('.arch-chat-msg-assistant, .arch-chat-msg-error')].filter((m) => !m.querySelector('.spin')).length > n,
    repliesBefore, { timeout: 600000 });
    await sleep(1500);
  };

  // Collapse the services palette and the workflow panel so the diagram gets the room.
  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
  };
  // Zoom the canvas toward a tagged node.
  const zoomTo = async (sel, steps = 4) => {
    const b = await page.locator(sel).first().boundingBox().catch(() => null);
    if (!b) return;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, -120); await sleep(170); }
    await sleep(600);
  };

  const cost = () => page.locator('.cost-indicator').first().innerText().catch(() => '');
  const canvasFit = async () => { await tidy(); await f.fit(); };

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">After the first draft</div>
    <div class="row">
      <div class="tile in" style="animation-delay:.5s;border-color:#f472b6;box-shadow:0 0 40px #ec489966"><div class="ic">⚡</div><b>“Can we add a cache?”</b><span>Monday</span></div>
      <div class="tile in" style="animation-delay:2.1s;border-color:#a78bfa;box-shadow:0 0 40px #8b5cf666"><div class="ic">🛡️</div><b>“What about security?”</b><span>Tuesday</span></div>
      <div class="tile in" style="animation-delay:3.5s;border-color:#60a5fa;box-shadow:0 0 40px #3b82f666"><div class="ic">↩️</div><b>“Go back to yesterday's”</b><span>Wednesday</span></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Refine with <span class="g">Guided Chat</span>', sub: 'Change the design in plain English · every step reviewed, priced and saved', narr: 'n02-title' });

  // ── 2. Load the first draft ──────────────────────────────────────────────────
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
  f.log('draft cost', await cost());
  const n3 = f.say('n03-draft', { wait: false, pad: 0.6 });
  await sleep(6500);
  await f.ring('.cost-indicator', 'Monthly run rate · Azure retail prices', 6);
  await n3;
  await f.ring(null);

  // ── 3. Open Guided Chat ──────────────────────────────────────────────────────
  await f.cursor(true);
  await f.tag('Guided Chat');
  await f.pointTo(page.getByRole('button', { name: /Guided Chat/ }).first(), { click: true });
  await page.locator('.arch-chat-panel').waitFor({ timeout: 10000 });
  await sleep(1200);
  await canvasFit();
  const n4 = f.say('n04-chat', { wait: false, pad: 0.5 });
  await sleep(1800);
  await f.ring('.arch-chat-suggestions', 'Suggestions from what is on the canvas · tagged by WAF pillar', 8);
  await n4;
  await f.ring(null);

  // ── 4. Ask in plain English ──────────────────────────────────────────────────
  const input = page.locator('.arch-chat-input');
  await f.pointTo(input, { click: true });
  const n5 = f.say('n05-ask', { wait: false, pad: 0.4 });
  await sleep(1200);
  await f.typeSlow(input, REQUEST, 45);
  await n5;
  const before1 = await replies();
  await f.pointTo('.arch-chat-send', { click: true });
  await f.cursor(false);
  await f.tag('Updating the diagram · sped up');
  await f.say('n06-apply', { pad: 0.2 });
  await f.ff(() => waitForChange(before1), { max: 7 });

  // Extra-services review on the first change: apply only what was asked.
  let guardShown = false;
  if (await page.locator('.arch-chat-review').count()) {
    f.log('review dialog on change 1');
    await f.ring('.arch-chat-review', 'AI-proposed extras wait for your approval', 6);
    await f.say('n10b-guard', { pad: 0.3 });
    guardShown = true;
    await f.ring(null);
    await f.cursor(true);
    await f.pointTo(page.getByRole('button', { name: /Apply requested changes only/ }), { click: true });
    await f.cursor(false);
    await f.ff(() => waitForChange(before1), { max: 4 });
  }
  f.reveal();
  await f.tag('');
  await sleep(800);

  // ── 5. The change review ─────────────────────────────────────────────────────
  f.log('reply 1', (await lastReply()).replace(/\n/g, ' | '));
  const n7 = f.say('n07-review', { wait: false, pad: 0.5 });
  await sleep(500);
  await f.ring('[data-v="reply"]', 'Change review · added, removed and why', 6);
  await n7;
  await f.ring(null);

  // ── 6. On the canvas ─────────────────────────────────────────────────────────
  await canvasFit();
  const n8 = f.say('n08-canvas', { wait: false, pad: 0.4 });
  await sleep(600);
  if (await tagNode('Redis', 'redis')) {
    await zoomTo('[data-v="redis"]', 5);
    await tagNode('Redis', 'redis');
    await f.ring('[data-v="redis"]', 'Azure Cache for Redis · new', 10);
  }
  await n8;
  f.log('cost after change 1', await cost());
  await f.ring('.cost-indicator', 'Re-priced with the change', 6);
  await f.say('n09-cost', { pad: 0.6 });
  await f.ring(null);

  // ── 7. One-click next step ───────────────────────────────────────────────────
  await page.locator('.arch-chat-followups').waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => !/Finding tailored suggestions/.test(document.querySelector('.arch-chat-followups')?.innerText || ''), null, { timeout: 60000 }).catch(() => {});
  await sleep(600);
  const chip = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.arch-chat-followups .arch-chat-chip')]
      .filter((c) => !/what would you add/i.test(c.textContent || ''));
    const safe = chips.filter((c) => !/private|vnet|virtual network|network|dns|endpoint|restore/i.test(c.textContent || ''));
    const pref = safe.find((c) => /front door|waf|firewall/i.test(c.textContent || ''))
      || safe.find((c) => /slot|zone|backup|failover|autoscal|identit/i.test(c.textContent || '')) || safe[0];
    if (!pref) return null;
    pref.setAttribute('data-v', 'chip');
    return pref.textContent.trim();
  });
  f.log('chip', chip);
  const n10 = f.say('n10-next', { wait: false, pad: 0.3 });
  await f.ring('.arch-chat-followups', 'Suggested next steps · refreshed after every change', 6);
  await sleep(3800);
  await f.ring(null);
  const before2 = await replies();
  if (chip) {
    await f.cursor(true);
    await f.pointTo('[data-v="chip"]', { click: true });
    await f.cursor(false);
  } else {
    await input.fill('Put Azure Front Door with a WAF policy in front of the web app');
    await page.locator('.arch-chat-send').click();
  }
  await f.tag('Updating the diagram · sped up');
  await n10;
  await f.ff(() => waitForChange(before2), { max: 6 });
  if (await page.locator('.arch-chat-review').count()) {
    f.log('review dialog on change 2');
    await f.ring('.arch-chat-review', 'AI-proposed extras wait for your approval', 6);
    if (!guardShown) await f.say('n10b-guard', { pad: 0.3 }); else await sleep(2500);
    await f.ring(null);
    await f.cursor(true);
    await f.pointTo(page.getByRole('button', { name: /Apply requested changes only/ }), { click: true });
    await f.cursor(false);
    await f.ff(() => waitForChange(before2), { max: 4 });
  }
  f.reveal();
  await f.tag('');
  f.log('reply 2', (await lastReply()).replace(/\n/g, ' | '));
  f.log('cost after change 2', await cost());
  await f.ring('[data-v="reply"]', chip ? `“${chip}”` : 'Change review', 6);
  await sleep(3000);
  await f.ring(null);

  // ── 8. Make it yours ─────────────────────────────────────────────────────────
  await page.locator('.arch-chat-close').click().catch(() => {});
  await sleep(700);
  await canvasFit();
  const n11 = f.say('n11-yours', { wait: false, pad: 0.5 });
  await f.tag('Make it yours');
  if (await tagNode('Redis', 'redis')) await zoomTo('[data-v="redis"]', 4);
  await f.cursor(true);
  const mv = await page.evaluate(() => {
    const n = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')]
      .find((e) => /Redis/.test(e.textContent || ''));
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height * 0.35, top: b.top };
  });
  if (mv) await f.drag(mv, mv.x > 1100 ? -220 : 220, 0);
  await sleep(600);
  await n11;
  await f.cursor(false);
  await f.tag('');

  // ── 9. Version history ───────────────────────────────────────────────────────
  await f.cursor(true);
  await f.tag('Library · version history');
  await f.pointTo(page.getByRole('button', { name: /Library/ }).first(), { click: true });
  await page.locator('.version-list').waitFor({ timeout: 15000 });
  await sleep(1000);
  f.log('versions', await page.locator('.version-item').count());
  const n12 = f.say('n12-history', { wait: false, pad: 0.4 });
  await f.ring('.version-list', 'Saved automatically before every change', 10);
  await sleep(3500);
  await f.ring('.version-item:first-child .version-prompt', 'The request that changed it', 6);
  await n12;
  await f.ring(null);

  // ── 10. Restore the first draft ──────────────────────────────────────────────
  const oldest = page.locator('.version-item').last();
  await oldest.scrollIntoViewIfNeeded().catch(() => {});
  await oldest.evaluate((e) => e.setAttribute('data-v', 'oldest'));
  const n13 = f.say('n13-restore', { wait: false, pad: 0.4 });
  await f.ring('[data-v="oldest"]', 'The first draft', 8);
  await sleep(2200);
  await f.ring(null);
  page.once('dialog', (d) => d.accept());
  await f.pointTo(oldest.locator('.btn-restore'), { click: true });
  await f.tag('Restored · first draft');
  await f.cursor(false);
  await sleep(1500);
  await canvasFit();
  f.log('cost after restore', await cost());
  await f.ring('.cost-indicator', 'Back to the first draft', 6);
  await n13;
  await f.ring(null);
  await f.tag('');

  // ── 11. Close ────────────────────────────────────────────────────────────────
  await f.say('n14-close', { pad: 1.0 });
  await f.endCard();
});

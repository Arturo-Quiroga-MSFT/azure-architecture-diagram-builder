// Episode 11 · Microsoft IQ and Fabric. Recorded live on production AADB.
import { film } from '../../engine/film.mjs';

const BRIEF = 'AI underwriting copilot for a commercial insurer. Underwriters ask questions in Microsoft Teams. A Foundry agent answers using Foundry IQ as its knowledge base over underwriting guidelines and past policies, Fabric IQ as the business ontology over policy, claims and broker data in OneLake, and Work IQ for the broker emails and meetings in Microsoft 365. A Fabric Operations Agent watches incoming submissions and flags risky ones in real time. Primary region East US 2.';
const REQUEST = 'Add a Fabric Graph Model over the Fabric IQ ontology so the agent can trace how brokers, policies and claims are connected.';
// Generation varies; these are the services the narration names.
const NAMED = ['Work IQ', 'Foundry IQ', 'Fabric IQ', 'Microsoft Fabric Capacity'];

await film(import.meta.url, async (f) => {
  const { page, sleep } = f;

  // Tag the node whose label is `label` (its last text line), so ring() can target it.
  const tagNode = (label, id) => page.evaluate(({ label, id }) => {
    document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v'));
    const n = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')]
      .find((e) => (e.innerText || '').split('\n').map((s) => s.trim()).includes(label) && e.getBoundingClientRect().width > 0);
    if (!n) return null;
    n.setAttribute('data-v', id);
    return (n.innerText || '').split('\n').map((s) => s.trim()).filter((s) => s && s !== label)[0] || '';
  }, { label, id });
  const has = async (label) => (await tagNode(label, 'probe')) !== null;
  const cost = async () => ((await page.locator('.cost-indicator').first().innerText().catch(() => '')).match(/\$[\d,.]+/) || [''])[0];

  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
    await f.fit();
  };
  const zoomTo = async (sel, steps = 4) => {
    const b = await page.locator(sel).first().boundingBox().catch(() => null);
    if (!b) return;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
    for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, -120); await sleep(170); }
    await sleep(700);
  };
  // Zoom to a service, ring it with a label, speak, then fit back.
  const spotlight = async (label, cue, ringLabel) => {
    const n = f.say(cue, { wait: false, pad: 0.5 });
    if ((await tagNode(label, 'spot')) !== null) {
      await zoomTo('[data-v="spot"]', 7);
      const badge = await tagNode(label, 'spot');
      await f.ring('[data-v="spot"]', typeof ringLabel === 'function' ? ringLabel(badge) : ringLabel, 12);
    } else f.log('missing on canvas:', label);
    await n;
    await f.ring(null);
    await f.fit();
  };

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">Microsoft IQ · context for agents</div>
    <div class="row">
      <div class="tile in" style="animation-delay:2.2s;border-color:#60a5fa;box-shadow:0 0 40px #3b82f666"><div class="ic">💬</div><b>Work IQ</b><span>How people work: mail, meetings, chats</span></div>
      <div class="tile in" style="animation-delay:3.6s;border-color:#34d399;box-shadow:0 0 40px #10b98166"><div class="ic">🧭</div><b>Fabric IQ</b><span>What the business data means</span></div>
      <div class="tile in" style="animation-delay:5.2s;border-color:#c084fc;box-shadow:0 0 40px #a855f766"><div class="ic">📚</div><b>Foundry IQ</b><span>Knowledge an agent retrieves</span></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Microsoft IQ <span class="g">and Fabric</span>', sub: 'Agent architectures with every IQ layer in place, and priced the way it is billed', narr: 'n02-title' });

  // ── 2. The brief ─────────────────────────────────────────────────────────────
  await f.subTop(true);
  await f.card('');
  await sleep(700);
  await f.cursor(true);
  await f.pointTo(page.getByRole('button', { name: 'Generate Diagram' }).first(), { click: true });
  await sleep(900);
  const box = page.getByPlaceholder(/Describe a new architecture/);
  await box.evaluate((el) => el.setAttribute('data-v', 'brief'));
  await f.pointTo(box, { click: true });
  const n3 = f.say('n03-brief', { wait: false, pad: 0.4 });
  await f.ring('[data-v="brief"]', 'Work IQ · Fabric IQ · Foundry IQ, named in the brief', 6);
  await box.pressSequentially(BRIEF, { delay: 8 });
  await n3;
  await f.ring(null);

  // ── 3. Generate ──────────────────────────────────────────────────────────────
  await f.pointTo(page.getByRole('button', { name: /Generate Architecture/ }), { click: true });
  await f.cursor(false);
  await f.tag('Generating with Azure OpenAI · sped up');
  const n4 = f.say('n04-gen', { wait: false, pad: 0.3 });
  await f.ff(async () => {
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 6, null, { timeout: 420000 });
    await sleep(2500);
    await page.keyboard.press('Escape');
    await sleep(500);
  });
  await tidy();
  f.reveal();
  await f.subTop(false);
  await f.tag('');
  const present = {};
  for (const s of [...NAMED, 'Fabric Operations Agent']) present[s] = await has(s);
  f.log('services', JSON.stringify(present), 'cost', await cost());
  await n4;
  await sleep(1500);

  // ── 4. The IQ layers ─────────────────────────────────────────────────────────
  await spotlight('Work IQ', 'n05-workiq', (b) => `Work IQ · ${b || 'external'}`);
  await spotlight('Foundry IQ', 'n06-foundryiq', (b) => `Foundry IQ · on Azure AI Search${b ? ` · ${b}` : ''}`);
  await spotlight('Fabric IQ', 'n07-fabriciq', 'Fabric IQ · business ontology over OneLake');
  if (present['Fabric Operations Agent']) await spotlight('Fabric Operations Agent', 'n08-opsagent', 'Fabric Operations Agent · real-time watch');

  // ── 5. Fabric capacity ───────────────────────────────────────────────────────
  {
    const n9 = f.say('n09-capacity', { wait: false, pad: 0.6 });
    if ((await tagNode('Microsoft Fabric Capacity', 'spot')) !== null) {
      await zoomTo('[data-v="spot"]', 6);
      const b = await tagNode('Microsoft Fabric Capacity', 'spot');
      await f.ring('[data-v="spot"]', `Fabric Capacity · F SKU${b ? ` · ${b}` : ''} · carries every Fabric item`, 12);
    }
    await sleep(5500);
    await f.ring(null);
    await f.fit();
    const total = await cost();
    await f.ring('.cost-indicator', `Monthly run rate${total ? ` ≈ ${total}` : ''} · capacity included`, 6);
    await n9;
    await f.ring(null);
  }

  // ── 6. Guided Chat: add a Graph Model ────────────────────────────────────────
  const before = await cost();
  await f.cursor(true);
  await f.tag('Guided Chat');
  await f.pointTo(page.getByRole('button', { name: /Guided Chat/ }).first(), { click: true });
  await page.locator('.arch-chat-panel').waitFor({ timeout: 10000 });
  await sleep(1000);
  await tidy();
  const input = page.locator('.arch-chat-input');
  await f.pointTo(input, { click: true });
  const n10 = f.say('n10-ask', { wait: false, pad: 0.4 });
  await sleep(1500);
  await f.typeSlow(input, REQUEST, 22);
  await n10;
  const repliesBefore = await page.evaluate(() => [...document.querySelectorAll('.arch-chat-msg-assistant, .arch-chat-msg-error')].filter((m) => !m.querySelector('.spin')).length);
  await f.pointTo('.arch-chat-send', { click: true });
  await f.cursor(false);
  await f.tag('Updating the diagram · sped up');
  const n11 = f.say('n11-wait', { wait: false, pad: 0.2 });
  await f.ff(async () => {
    await page.waitForFunction((n) => document.querySelector('.arch-chat-review')
      || [...document.querySelectorAll('.arch-chat-msg-assistant, .arch-chat-msg-error')].filter((m) => !m.querySelector('.spin')).length > n,
    repliesBefore, { timeout: 600000 });
    if (await page.locator('.arch-chat-review').count()) {
      f.log('extra-services review shown; applying requested changes only');
      await page.getByRole('button', { name: /Apply requested changes only/ }).click();
      await page.waitForFunction((n) => [...document.querySelectorAll('.arch-chat-msg-assistant, .arch-chat-msg-error')].filter((m) => !m.querySelector('.spin')).length > n, repliesBefore, { timeout: 600000 });
    }
    await sleep(1500);
  }, { max: 5 });
  await n11;
  f.reveal();
  await f.tag('');
  const reply = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.arch-chat-bubble')].at(-1);
    if (b) b.setAttribute('data-v', 'reply');
    return b?.innerText || '';
  });
  f.log('reply', reply.replace(/\n/g, ' | '));
  await f.ring('[data-v="reply"]', 'Change review · what was added and why', 6);
  await sleep(3000);
  await f.ring(null);

  // Close the chat so the canvas gets the full width again.
  await page.locator('.arch-chat-close').click({ timeout: 2000 }).catch(() => {});
  await sleep(800);
  await tidy();
  const n12 = f.say('n12-added', { wait: false, pad: 0.5 });
  if ((await tagNode('Fabric Graph Model', 'spot')) !== null) {
    await zoomTo('[data-v="spot"]', 6);
    const b = await tagNode('Fabric Graph Model', 'spot');
    await f.ring('[data-v="spot"]', `Fabric Graph Model · new${b ? ` · ${b}` : ''}`, 12);
  } else f.log('Graph Model not on canvas');
  await n12;
  await f.ring(null);
  await f.fit();
  const after = await cost();
  f.log('cost before', before, 'after', after);
  const same = before && before === after;
  await f.ring('.cost-indicator', same ? `Still ${after}/mo · same capacity` : `Re-priced · ${after}/mo`, 6);
  await f.say(same ? 'n13-same-cost' : 'n13-new-cost', { pad: 0.6 });
  await f.ring(null);

  // ── 7. Close ─────────────────────────────────────────────────────────────────
  await tidy();
  await f.say('n14-close', { pad: 1.2 });
  await f.endCard();
});

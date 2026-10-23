// Episode 4 · Talk to Your Architecture. A live Voice Live conversation on production AADB:
// the seller turns are pre-recorded WAVs fed to a fake microphone; every Ava reply and drawing is real.
import path from 'path';
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep, now, log, DIR } = f;
  const SELLER = path.join(DIR, 'assets', 'seller');
  const TURNS = JSON.parse((await import('fs')).readFileSync(path.join(SELLER, 'turns.json'), 'utf8'));

  // ── Voice Live websocket: capture Ava's audio and tool calls ─────────────────
  let playhead = 0, inFlight = 0, lastToolAt = 0, curAudio = false, avaText = '', avaStart = null;
  const completed = [], failed = [], pending = new Map();
  let drawing = null, draws = 0;
  page.on('websocket', (ws) => {
    if (!ws.url().includes('/api/voice-live')) return;
    ws.on('framesent', ({ payload }) => {
      if (typeof payload !== 'string' || !payload.includes('"tool.result"')) return;
      const ev = JSON.parse(payload);
      const name = pending.get(ev.call_id); pending.delete(ev.call_id);
      lastToolAt = now();
      if (drawing) {
        const a = Math.max(drawing.callAt, playhead) + 0.4, b = lastToolAt - 0.4;
        if (b - a > 2) f.timeline.ff.push({ a, b, max: 6 });
        drawing = null; draws += 1;
        f.reveal();
        f.tag('✅ Drawn by Ava');
        setTimeout(() => f.tag(''), 4000);
      }
      log('tool result', name);
    });
    ws.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string') return;
      let ev; try { ev = JSON.parse(payload); } catch { return; }
      const t = now();
      if (ev.type === 'response.created') { inFlight += 1; curAudio = false; avaText = ''; avaStart = null; }
      if (ev.type === 'response.audio.delta' && ev.delta) {
        const at = Math.max(t + 0.02, playhead);
        if (avaStart === null) avaStart = at;
        f.pcm(at, ev.delta);
        curAudio = true;
        playhead = at + Buffer.from(ev.delta, 'base64').length / 2 / 24000;
      }
      if (ev.type === 'response.audio_transcript.delta') avaText += ev.delta;
      if (ev.type === 'response.done') {
        inFlight -= 1;
        if (curAudio && avaText.trim()) f.caption(avaStart, playhead, `Ava: ${avaText.trim()}`);
        if (ev.response?.status === 'completed') completed.push({ t, audio: curAudio });
        else { log('response', ev.response?.status); if (ev.response?.status === 'failed') failed.push(t); }
      }
      if (ev.type === 'response.function_call_arguments.done') {
        log('TOOL', ev.name, (ev.arguments || '').slice(0, 160));
        pending.set(ev.call_id, ev.name);
        if (ev.name === 'draw_architecture') {
          drawing = { callAt: t };
          notes('hide');
          f.tag('⚙️ Ava calls draw_architecture · drawing on the canvas · sped up');
        } else {
          f.tag(`⚙️ Ava calls ${ev.name}`);
        }
      }
    });
  });

  // "What Ava has heard": a notes card on the empty canvas that fills in as the seller talks.
  const NOTES = {
    '01-opener': ['🏭 3 plants · Ontario and Michigan', '📷 Catch defects with computer vision'],
    '02-workload': ['⚡ Real time · pass or fail in < 200 ms', '🖥️ Inference at the edge, in every plant', '☁️ Cloud: model training and dashboards'],
    '03-data-and-security': ['🗂️ 2 million images a day · defects kept 2 years', '📊 Power BI for quality · 🔔 alerts in Teams', '🔒 Private networking · Entra ID · Canada Central'],
  };
  const notes = (op, text) => page.evaluate(({ op, text }) => {
    let el = document.getElementById('v-notes');
    if (op === 'hide') { if (el) { el.style.opacity = '0'; setTimeout(() => el.remove(), 700); } return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'v-notes';
      el.style.cssText = 'position:fixed;left:170px;top:150px;width:640px;z-index:100000;pointer-events:none;padding:26px 30px;border-radius:20px;background:#0f172ae6;border:1px solid #6366f155;box-shadow:0 20px 60px #0009;font-family:Segoe UI,system-ui,sans-serif;transition:opacity .6s';
      el.innerHTML = '<div style="font-size:16px;letter-spacing:.22em;color:#a5b4fc;text-transform:uppercase;margin-bottom:14px">🎧 What Ava has heard</div><div class="items" style="display:grid;gap:12px"></div>';
      document.body.appendChild(el);
    }
    if (op === 'add') {
      const d = document.createElement('div');
      d.textContent = text;
      d.style.cssText = 'font-size:25px;color:#e2e8f0;padding:10px 14px;border-radius:12px;background:#1e293b;border:1px solid #334155;opacity:0;transform:translateX(-14px);transition:all .5s';
      el.querySelector('.items').appendChild(d);
      requestAnimationFrame(() => { d.style.opacity = '1'; d.style.transform = 'none'; });
    }
  }, { op, text });

  const waitForAva = async (clipEnd) => {
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const last = completed.filter((c) => c.t > Math.max(clipEnd, lastToolAt) && c.audio).pop();
      if (pending.size === 0 && inFlight === 0 && last && now() > playhead + 0.8) return;
      const fail = failed.filter((x) => x > clipEnd).pop();
      if (fail && pending.size === 0 && inFlight === 0 && now() - fail > 2 && now() > playhead + 0.8) { log('reply failed; continuing'); return; }
      await sleep(200);
    }
    log('waitForAva timed out');
  };

  // Fit the whole diagram inside the visible canvas; below the app's minimum zoom, scale the
  // viewport directly for the camera (the next real pan or zoom resets it).
  const fitAll = async () => {
    let prev = '', stable = 0;
    for (let i = 0; i < 30 && stable < 4; i++) {
      const sig = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map((n) => n.style.transform).join('|')).catch(() => '');
      stable = sig && sig === prev ? stable + 1 : 0; prev = sig; await sleep(300);
    }
    await page.locator('.react-flow__controls-fitview').click({ timeout: 2000 }).catch(() => {});
    await sleep(900);
    const k = await page.evaluate(() => {
      const pane = document.querySelector('.react-flow').getBoundingClientRect();
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
  const fitNarrow = fitAll;

  const applyReviewIfShown = async () => {
    const btn = page.getByRole('button', { name: 'Apply requested changes only' });
    if (!(await btn.isVisible().catch(() => false))) return false;
    log('review dialog');
    await f.ring('.arch-chat-review', 'AI-proposed extras wait for approval', 6);
    await sleep(3500);
    await f.ring(null);
    await f.cursor(true);
    await f.pointTo(btn, { click: true });
    await f.cursor(false);
    await sleep(2500);
    return true;
  };

  async function turn(name, text) {
    await f.sub(`🎙 Seller: ${text}`);
    const dur = await f.clip(path.join(SELLER, `${name}.wav`), `Seller: ${text}`);
    const items = draws ? [] : (NOTES[name] || []);
    const step = (dur * 1000) / (items.length + 1);
    for (const it of items) { await sleep(step); await notes('add', it); }
    await sleep(Math.max(0, dur * 1000 - step * items.length));
    await f.sub('');
    const clipEnd = now();
    await waitForAva(clipEnd);
    if (!drawing) await f.tag('');
    await applyReviewIfShown();
    log('nodes', await page.locator('.react-flow__node').count());
    await sleep(900);
  }

  // Room for the canvas beside the chat panel; hide chrome the voice story doesn't need.
  await page.addStyleTag({ content: [
    'body.rec-narrow .react-flow { width: calc(100% - 460px) !important; }',
    '.react-flow__minimap, .canvas-layout-hint, .model-generation-badge, .prompt-banner:not(.loading-banner), .title-block, .feedback-toast, .feedback-fab, .workflow-panel, .canvas-nav-hint { display: none !important; }',
  ].join('\n') });

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">How designs really start</div>
    <div class="row">
      <div class="tile in" style="animation-delay:.5s;border-color:#60a5fa;box-shadow:0 0 40px #3b82f666"><div class="ic">🗣️</div><b>Ask</b><span>the right questions</span></div>
      <div class="tile in" style="animation-delay:2.0s;border-color:#a78bfa;box-shadow:0 0 40px #8b5cf666"><div class="ic">✏️</div><b>Sketch</b><span>while you talk</span></div>
      <div class="tile in" style="animation-delay:3.4s;border-color:#f472b6;box-shadow:0 0 40px #ec489966"><div class="ic">🏗️</div><b>Shape</b><span>the design together</span></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Talk to your <span class="g">architecture</span>', sub: 'Azure AI Voice Live · Ava asks, draws and refines on the canvas', narr: 'n02-title' });

  // ── 2. Guided Chat + microphone ──────────────────────────────────────────────
  await f.card('');
  await sleep(400);
  await page.locator('.icon-palette:not(.collapsed) .collapse-toggle').click({ timeout: 2000 }).catch(() => {});
  await f.cursor(true);
  await f.tag('Guided Chat');
  await f.pointTo(page.getByRole('button', { name: /^Guided Chat/ }).first(), { click: true });
  await page.locator('.arch-chat-panel').waitFor({ timeout: 10000 });
  await sleep(900);
  await page.evaluate(() => { document.querySelector('button[aria-label="Hide the toolbar"]')?.click(); document.body.classList.add('rec-narrow'); });
  await sleep(700);
  const mic = page.getByRole('button', { name: 'Start voice conversation' });
  const n3 = f.say('n03-mic', { wait: false, pad: 0.5 });
  await mic.evaluate((e) => e.setAttribute('data-v', 'mic'));
  await f.ring('[data-v="mic"]', 'Talk to Ava', 8);
  await f.pointTo(mic);
  await sleep(2800);
  await f.ring(null);
  await f.pointTo(mic, { click: true });
  await f.cursor(false);
  await page.locator('.arch-chat-voice-bar', { hasText: 'Listening' }).waitFor({ timeout: 30000 });
  await f.tag('🎙 Voice Live · listening');
  await n3;

  // ── 3. Scenario ──────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">The scenario</div>
    <h1 class="in" style="animation-delay:.2s;font-size:62px">Catch defects on the line <span class="g">with computer vision</span></h1>
    <div class="row" style="justify-content:center">
      <div class="tile in" style="animation-delay:.8s"><div class="ic">🏭</div><b>3 plants</b><span>Ontario and Michigan</span></div>
      <div class="tile in" style="animation-delay:1.3s"><div class="ic">📷</div><b>~40 cameras each</b><span>2 million images a day</span></div>
      <div class="tile in" style="animation-delay:1.8s"><div class="ic">⏱️</div><b>&lt; 200 ms</b><span>pass or fail, at the edge</span></div>
    </div>
    <div class="in fine" style="animation-delay:2.6s;margin-top:34px;font-size:20px">Seller lines pre-recorded · every Ava reply and drawing is live on production</div>`);
  await sleep(400);
  await f.say('n04-scenario', { pad: 0.8 });
  await f.card('');
  await sleep(600);

  // ── 4. The conversation ──────────────────────────────────────────────────────
  for (const [name, text] of TURNS.slice(0, 3)) await turn(name, text);
  const [drawName, drawText] = TURNS[3];
  if (!draws) await turn(drawName, drawText);
  if (!draws) {
    log('no drawing after the draw turn; asking once more');
    await turn(drawName, drawText);
  }
  await notes('hide');
  await fitNarrow();
  await f.say('n05-drawn', { pad: 0.6 });

  const [chName, chText] = TURNS[4];
  await turn(chName, chText);
  await fitNarrow();
  const arc = await page.evaluate(() => {
    const n = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')].find((e) => /Arc/.test(e.textContent || ''));
    if (n) n.setAttribute('data-v', 'arc');
    return !!n;
  });
  const n6 = f.say('n06-changed', { wait: false, pad: 0.5 });
  if (arc) { await f.ring('[data-v="arc"]', 'Azure Arc · added by voice', 10); await sleep(3000); }
  await page.evaluate(() => {
    const m = [...document.querySelectorAll('.arch-chat-msg-assistant')].filter((x) => /Change review/.test(x.textContent || '')).at(-1);
    if (m) m.setAttribute('data-v', 'review');
  });
  await f.ring('[data-v="review"]', 'Change review', 6);
  await n6;
  await f.ring(null);
  await f.tag('');

  // ── 5. Make it yours ─────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Stop voice conversation' }).click().catch(() => {});
  await sleep(600);
  await page.locator('.arch-chat-close').click().catch(() => {});
  await page.evaluate(() => document.body.classList.remove('rec-narrow'));
  await sleep(800);
  await fitAll();
  const n7 = f.say('n07-yours', { wait: false, pad: 0.5 });
  await f.tag('Make it yours');
  await f.cursor(true);
  const grp = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => ({ n, b: n.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 40 && b.left > 140 && b.top > 200 && b.bottom < innerHeight - 100 && b.right < innerWidth - 160);
    const x = gs.sort((a, b) => a.b.width * a.b.height - b.b.width * b.b.height)[0];
    if (!x) return null;
    x.n.setAttribute('data-v', 'drag-group');
    return { x: x.b.left + Math.min(40, x.b.width / 3), y: x.b.top + 8, cx: x.b.left + x.b.width / 2 };
  });
  if (grp) {
    await f.ring('[data-v="drag-group"]', 'Drag groups and services anywhere', 8);
    await sleep(900);
    await f.ring(null);
    await f.drag(grp, grp.cx > 960 ? 140 : -140, 40);
  }
  await f.cursor(false);
  await n7;
  await f.tag('');

  // ── 6. Tour ──────────────────────────────────────────────────────────────────
  let n8 = null;
  await f.showcase({
    onGroup: async (label) => {
      if (!n8) n8 = f.say('n08-tour', { wait: false, pad: 0.2 });
      await f.tag(label ? `🔎 ${label}` : '');
    },
  });
  await n8;
  await f.tag('');

  // ── 7. Close ─────────────────────────────────────────────────────────────────
  await f.endCard({ narr: 'n09-close', line: 'Talk it through · watch it take shape' });
});

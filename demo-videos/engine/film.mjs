// Shared film engine for the AADB video series.
//
// An episode is a folder with:
//   episode.json   { "output": "1_Prompt-to-Architecture", "title": "...", "music": "drive",
//                    "url": "<app url, overrides AADB_APP_URL>", "internal": false,
//                    "basicAuth": { "username": "...", "passwordEnv": "<env var or .env key>" } }
//   narration.json [["n01-intro", "text or SSML"], ...]
//   scene.mjs      import { film } from '../../engine/film.mjs'; await film(import.meta.url, async (f) => { ... });
//
// The scene drives the live app with Playwright while the engine records 1080p video and a
// timeline (narration cues, sped-up waits, reveal marks). mix.py then builds the soundtrack,
// captions and the ffmpeg cut list; encode.sh writes videos/<output>.mp4.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { overlayInit } from './overlay.js';
import { showcase as showcaseTour } from './showcase.mjs';

// Playwright comes from the repository's own devDependencies.
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

// Settings: the environment first, then demo-videos/.env (git-ignored; see .env.example).
const VIDEOS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(VIDEOS_ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
export const config = (name, fallback) => process.env[name] || fallback;
export const PROD_URL = config('AADB_APP_URL', 'https://aka.ms/diagram-builder');
const W = 1920, H = 1080;

// Extra card styles for the series (episode badge, bullet lists, end card).
export function seriesCss() {
  if (window !== window.top) return;
  const CSS = `
  #v-card .ep { display: inline-block; padding: 8px 18px; border-radius: 999px; border: 1px solid #a78bfa88; background: #4c1d9533; color: #ddd6fe; font-size: 20px; letter-spacing: .2em; text-transform: uppercase; }
  #v-card .list { text-align: left; margin-top: 40px; display: grid; gap: 18px; }
  #v-card .list div { font-size: 32px; color: #e2e8f0; display: flex; gap: 18px; align-items: center; }
  #v-card .list div i { font-style: normal; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; background: #1e293b; border: 1px solid #334155; font-size: 28px; }
  #v-card .row { display: flex; gap: 22px; margin-top: 46px; }
  #v-card .tile { width: 300px; padding: 26px 20px; border-radius: 20px; background: #0f172acc; border: 1px solid #334155; text-align: left; }
  #v-card .tile .ic { font-size: 44px; } #v-card .tile b { display: block; font-size: 25px; margin-top: 12px; } #v-card .tile span { display: block; font-size: 18px; color: #94a3b8; margin-top: 6px; }
  #v-card .url { margin-top: 40px; font-size: 30px; color: #93c5fd; letter-spacing: .04em; }
  #v-card .fine { margin-top: 14px; font-size: 18px; color: #64748b; }
  #v-card .big { font-size: 120px; font-weight: 800; line-height: 1; background: linear-gradient(180deg, #fff, #93c5fd); -webkit-background-clip: text; color: transparent; }
  `;
  const CURSOR = `
  #v-cursor { position: fixed; left: 0; top: 0; z-index: 100002; width: 30px; height: 30px; pointer-events: none; transform: translate(-200px, -200px);
    transition: transform .06s linear; filter: drop-shadow(0 2px 6px #000a); display: none; }
  #v-cursor.on { display: block; }
  .v-ripple { position: fixed; z-index: 100001; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 3px solid #facc15;
    pointer-events: none; animation: vrip .6s ease-out forwards; }
  @keyframes vrip { to { transform: scale(3.2); opacity: 0; } }
  body.v-sub-top #v-sub { bottom: auto; top: 26px; }
  `;
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = CSS + CURSOR; document.head.appendChild(s);
    // Playwright recordings have no OS cursor; draw one that follows the synthetic mouse.
    const c = document.createElement('div'); c.id = 'v-cursor';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.9L4 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 2}px)`; }, true);
    addEventListener('mousedown', (e) => {
      if (!c.classList.contains('on')) return;
      const r = document.createElement('div'); r.className = 'v-ripple'; r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 700);
    }, true);
  });
}

// Voice episodes: a fake microphone fed from WAV clips (Voice Live expects 24 kHz mono).
function fakeMic() {
  let mctx, dest;
  const ensure = () => { if (!mctx) { mctx = new AudioContext({ sampleRate: 24000 }); dest = mctx.createMediaStreamDestination(); } };
  navigator.mediaDevices.getUserMedia = async () => { ensure(); await mctx.resume(); return dest.stream; };
  window.__playClip = async (b64) => {
    ensure(); await mctx.resume();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const buf = await mctx.decodeAudioData(bytes.buffer);
    const src = mctx.createBufferSource(); src.buffer = buf; src.connect(dest); src.start();
    return buf.duration;
  };
}

// Media-tap episodes: copy any <audio> element's live stream (e.g. a WebRTC avatar) as 24 kHz int16 chunks.
function mediaTap() {
  const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');
  const tapped = new WeakSet();
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get() { return desc.get.call(this); },
    set(v) {
      desc.set.call(this, v);
      if (this.tagName !== 'AUDIO' || !v || !v.getAudioTracks || tapped.has(v)) return;
      tapped.add(v);
      const hook = () => {
        if (!v.getAudioTracks().length) return setTimeout(hook, 200);
        const ac = new AudioContext({ sampleRate: 24000 });
        const src = ac.createMediaStreamSource(v);
        const sp = ac.createScriptProcessor(4096, 1, 1);
        sp.onaudioprocess = (e) => {
          const d = e.inputBuffer.getChannelData(0);
          let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
          if (peak < 0.002) return;
          const out = new Int16Array(d.length);
          for (let i = 0; i < d.length; i++) out[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
          let bin = ''; const u8 = new Uint8Array(out.buffer);
          for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
          window.__tapChunk?.(btoa(bin));
        };
        src.connect(sp); sp.connect(ac.destination);
        ac.resume();
      };
      hook();
    },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export async function film(sceneUrl, scene) {
  const DIR = path.dirname(fileURLToPath(sceneUrl));
  const EP = JSON.parse(fs.readFileSync(path.join(DIR, 'episode.json'), 'utf8'));
  const OUT = path.join(DIR, 'out');
  const DL = path.join(OUT, 'downloads');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(DL, { recursive: true });
  const NARR = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'narration.json'), 'utf8')));
  const narrDur = (n) => (fs.statSync(path.join(DIR, 'narr', `${n}.wav`)).size - 44) / 48000;

  // audio: extra voice clips (wav files); pcm: 24 kHz int16 chunks (e.g. Ava); captions: extra .srt lines.
  const timeline = { narr: [], ff: [], reveals: [], marks: {}, audio: [], pcm: [], captions: [] };
  let t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const log = (...a) => console.log(`[${now().toFixed(1)}s]`, ...a);

  const args = ['--autoplay-policy=no-user-gesture-required'];
  if (EP.voice_live) args.push('--use-fake-ui-for-media-stream');
  const browser = await chromium.launch({ args });
  const ctxOpts = { viewport: { width: W, height: H }, deviceScaleFactor: 1, acceptDownloads: true, recordVideo: { dir: OUT, size: { width: W, height: H } } };
  if (EP.voice_live) ctxOpts.permissions = ['microphone'];
  // basicAuth: { username, password } or { username, passwordEnv: "NAME" } to keep the secret out of episode.json.
  if (EP.basicAuth) {
    const password = EP.basicAuth.passwordEnv ? config(EP.basicAuth.passwordEnv, '') : EP.basicAuth.password;
    if (!password) throw new Error(`basicAuth: set ${EP.basicAuth.passwordEnv || 'password'}`);
    ctxOpts.httpCredentials = { username: EP.basicAuth.username, password };
  }
  const ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(overlayInit);
  await ctx.addInitScript(seriesCss);
  if (EP.voice_live) await ctx.addInitScript(fakeMic);
  // Tapped audio arrives in 4096-sample chunks; stitch contiguous ones into segments so the mix has no seams.
  const tapSegs = [];
  if (EP.media_tap) {
    await ctx.exposeBinding('__tapChunk', (_src, b64) => {
      const buf = Buffer.from(b64, 'base64'); const t = now() - buf.length / 48000; const last = tapSegs.at(-1);
      if (last && t - (last.at + last.len / 48000) < 0.6) { last.parts.push(buf); last.len += buf.length; }
      else tapSegs.push({ at: t, parts: [buf], len: buf.length });
    });
    await ctx.addInitScript(mediaTap);
  }
  const pageCreated = Date.now();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));

  const v = (fn, ...args) => page.evaluate(([f, a]) => window.__v[f](...a), [fn, args]).catch((e) => log('overlay', fn, e.message.split('\n')[0]));
  const f = {
    page, ctx, browser, sleep, log, now, esc, EP, DIR, OUT, DL, timeline, config,
    v,
    card: (html) => v('card', html || ''),
    sub: (t) => v('sub', t || ''),
    tag: (t) => v('tag', t || ''),
    ring: (sel, label, pad) => v('ring', sel, label, pad),
    stage: (html) => v('stage', html || ''),
    glide: (sel, to, ms) => v('glide', sel, to, ms),
    narrDur,
    // Speak a narration cue (placed at this timestamp in post) with a subtitle.
    async say(name, { wait = true, pad = 0.6 } = {}) {
      const d = narrDur(name);
      timeline.narr.push({ name, at: now(), dur: d, text: NARR[name].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
      await v('sub', timeline.narr.at(-1).text);
      log('say', name, d.toFixed(1));
      const done = sleep((d + pad) * 1000).then(() => v('sub', ''));
      if (wait) await done;
      return done;
    },
    // Run fn; if it takes more than 2 s, that stretch is sped up 6x in post.
    // Optional { max }: compress harder so the wait lasts at most `max` seconds on screen.
    async ff(fn, { max } = {}) { const a = now(); const r = await fn(); const b = now(); if (b - a > 2) timeline.ff.push({ a: a + 0.4, b: b - 0.4, ...(max ? { max } : {}) }); return r; },
    // A reveal gets a riser into it and a hit on it in the score.
    reveal() { timeline.reveals.push(now()); },
    mark(name) { timeline.marks[name] = now(); },
    async typeSlow(loc, text, ms = 60) { for (const ch of text) { await loc.type(ch); await sleep(ms); } },
    async fit() {
      let prev = '', stable = 0;
      for (let i = 0; i < 40 && stable < 5; i++) {
        const sig = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node')].map((n) => n.style.transform).join('|')).catch(() => '');
        stable = sig && sig === prev ? stable + 1 : 0; prev = sig; await sleep(300);
      }
      await page.locator('.react-flow__controls-fitview').click({ timeout: 2000 }).catch(() => {});
      await sleep(900);
    },
    async download(name, timeout = 240000) {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), page.getByRole('button', { name }).first().click()]);
      const file = path.join(DL, dl.suggestedFilename()); await dl.saveAs(file); log('downloaded', path.basename(file)); return file;
    },
    showcase: (opts) => showcaseTour(page, sleep, opts),
    // Speak a WAV clip into the fake microphone; it is also laid on the soundtrack. Returns seconds.
    async clip(file, caption) {
      const at = now();
      const dur = await page.evaluate((d) => window.__playClip(d), fs.readFileSync(file).toString('base64'));
      timeline.audio.push({ at, file });
      if (caption) timeline.captions.push({ at, end: at + dur, text: caption });
      log('clip', path.basename(file), dur.toFixed(1));
      return dur;
    },
    pcm: (at, b64) => timeline.pcm.push({ at, b64 }),
    caption: (at, end, text) => timeline.captions.push({ at, end, text }),
    // Show/hide the drawn cursor (shown for clicks and drags the viewer should follow).
    cursor: (on = true) => page.evaluate((o) => document.getElementById('v-cursor')?.classList.toggle('on', o), on),
    // Subtitles at the top (when a dialog's controls sit at the bottom of the screen).
    subTop: (on = true) => page.evaluate((o) => document.body.classList.toggle('v-sub-top', o), on),
    // Glide the cursor to an element's center (or a point), then optionally click it.
    async pointTo(target, { click = false, steps = 28, dx = 0, dy = 0 } = {}) {
      let p = target;
      if (typeof target === 'string' || target?.boundingBox) {
        const loc = typeof target === 'string' ? page.locator(target).first() : target;
        const b = await loc.boundingBox(); if (!b) return false;
        p = { x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy };
      }
      await page.mouse.move(p.x, p.y, { steps }); await sleep(250);
      if (click) { await page.mouse.down(); await sleep(90); await page.mouse.up(); }
      return true;
    },
    // A visible drag: glide to `from`, press, move by (dx, dy) slowly, release.
    async drag(from, dx, dy, { steps = 45 } = {}) {
      await page.mouse.move(from.x, from.y, { steps: 25 }); await sleep(300);
      await page.mouse.down(); await sleep(150);
      await page.mouse.move(from.x + dx, from.y + dy, { steps }); await sleep(200);
      await page.mouse.up(); await sleep(300);
    },
    // Standard opening card for an episode.
    async opener({ eyebrow, title, sub, narr }) {
      await v('card', `<div class="in ep">${esc(EP.badge || '')}</div>
        <div class="in eyebrow" style="animation-delay:.2s;margin-top:26px">${esc(eyebrow || 'Azure Architecture Diagram Builder')}</div>
        <h1 class="in" style="animation-delay:.45s">${title}</h1>
        ${sub ? `<div class="in sub" style="animation-delay:1s">${sub}</div>` : ''}`);
      await sleep(600);
      if (narr) await f.say(narr, { pad: 1.0 });
    },
    // Standard end card for every episode.
    async endCard({ narr, line = 'Design · validate · price · deploy, in minutes' } = {}) {
      await v('card', `<div class="in eyebrow">Azure Architecture Diagram Builder</div>
        <h1 class="in" style="animation-delay:.3s;font-size:68px"><span class="g">${esc(line)}</span></h1>
        <div class="in url" style="animation-delay:1.2s">aka.ms/diagram-builder</div>
        <div class="in fine" style="animation-delay:1.8s">${esc(EP.output.replace(/_/g, ' · ').replace(/-/g, ' '))}${EP.internal ? ' · Internal: beta features, not for external sharing' : ' · recorded live on the production app'}</div>`);
      await sleep(400);
      if (narr) await f.say(narr, { pad: 0.4 });
      await sleep(4200);
    },
  };

  try {
    await page.goto(EP.url || PROD_URL, { waitUntil: 'networkidle' });
    await sleep(2500);
    t0 = Date.now();
    await scene(f);
    timeline.end = now();
  } finally {
    await page.close();
    const video = await page.video().path();
    await ctx.close();
    await browser.close();
    for (const g of tapSegs) if (g.at >= 0) timeline.pcm.push({ at: g.at, b64: Buffer.concat(g.parts).toString('base64') });
    if (tapSegs.length) log('media tap', tapSegs.length, 'segments', (tapSegs.reduce((a, g) => a + g.len, 0) / 48000).toFixed(1), 's');
    timeline.videoOffset = (t0 - pageCreated) / 1000;
    fs.renameSync(video, path.join(OUT, 'screen.webm'));
    fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 1));
    log('done', JSON.stringify({ ff: timeline.ff.length, reveals: timeline.reveals.length, end: timeline.end }));
  }
}

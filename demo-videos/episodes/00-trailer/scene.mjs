// Trailer builder: cut from the episodes' raw recordings instead of recording the app.
// Runs in place of a scene (engine/run.sh: narrate → this → mix → encode). It renders the overlays
// (verbs, episode labels, subtitles, title and end cards) with the series styles in Playwright,
// assembles out/screen.mkv with ffmpeg, and writes out/timeline.json for mix.py.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { overlayInit } from '../../engine/overlay.js';
import { seriesCss, config } from '../../engine/film.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const DIR = path.dirname(fileURLToPath(import.meta.url));
const EPISODES = path.resolve(DIR, '..');
const OUT = path.join(DIR, 'out');
const FF = config('FFMPEG', 'ffmpeg');
const W = 1920, H = 1080, FPS = 30;
const BAR = (4 * 60) / 124; // the "pulse" score: 124 bpm, 4 beats to a bar

const T = JSON.parse(fs.readFileSync(path.join(DIR, 'trailer.json'), 'utf8'));
const NARR = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, 'narration.json'), 'utf8')));
const narrDur = (cue) => (fs.statSync(path.join(DIR, 'narr', `${cue}.wav`)).size - 44) / 48000;
const plain = (cue) => NARR[cue].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const ff = (args) => execFileSync(FF, ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
// Enough bars for the line plus a breath, at least the planned length.
const barsFor = (cue, planned) => Math.max(planned, Math.ceil((narrDur(cue) + 1.1) / BAR));

fs.rmSync(OUT, { recursive: true, force: true });
const PNG = path.join(OUT, 'overlays'), SEG = path.join(OUT, 'segments');
fs.mkdirSync(PNG, { recursive: true });
fs.mkdirSync(SEG, { recursive: true });

// ── Plan the timeline ────────────────────────────────────────────────────────
const plan = [];
let t = 0;
const add = (kind, item) => {
  const bars = barsFor(item.cue, item.bars);
  plan.push({ kind, ...item, at: t, dur: bars * BAR });
  t += bars * BAR;
};
add('open', T.open);
for (const b of T.beats) add('beat', b);
add('close', T.close);
const total = t;
console.log(`trailer: ${plan.length} parts, ${total.toFixed(1)} s`);

// ── Render overlays with the series styles ───────────────────────────────────
const blank = path.join(os.tmpdir(), 'aadb-trailer-blank.html');
fs.writeFileSync(blank, '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:transparent"></body></html>');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript(overlayInit);
await ctx.addInitScript(seriesCss);
const page = await ctx.newPage();
await page.goto('file://' + blank);
await page.waitForFunction(() => window.__v && document.getElementById('v-card'));
await page.addStyleTag({ content: `
  html, body { background: transparent !important; }
  #x-ov { position: fixed; inset: 0; display: none; font-family: 'Segoe UI', system-ui, sans-serif; }
  #x-ov .scrim { position: absolute; left: 0; top: 0; width: 1100px; height: 300px; background: radial-gradient(900px 300px at 0 0, #020617ee, #02061700 70%); }
  #x-ov .verb { position: absolute; left: 70px; top: 64px; font-size: 92px; font-weight: 800; letter-spacing: -.02em; line-height: 1;
    background: linear-gradient(90deg, #ffffff, #c4b5fd 60%, #f9a8d4); -webkit-background-clip: text; color: transparent; filter: drop-shadow(0 6px 24px #000c); }
  #x-ov .ep { position: absolute; left: 74px; top: 176px; padding: 7px 16px; border-radius: 999px; border: 1px solid #a78bfa88; background: #1e1b4bcc;
    color: #ddd6fe; font-size: 19px; letter-spacing: .14em; text-transform: uppercase; }
  #x-ov .sub { position: absolute; left: 50%; bottom: 34px; transform: translateX(-50%); max-width: 1500px; padding: 12px 26px; border-radius: 12px;
    background: #020617d9; color: #f8fafc; font: 500 25px/1.4 'Segoe UI', system-ui, sans-serif; text-align: center; box-shadow: 0 10px 40px #0009; }
  #v-card .in { animation: none !important; opacity: 1 !important; transform: none !important; }
` });
await page.evaluate(() => { const d = document.createElement('div'); d.id = 'x-ov'; document.body.appendChild(d); });
// The overlay's card starts visible; hide it so overlay PNGs come out transparent.
await page.evaluate(() => { document.getElementById('v-card').style.display = 'none'; });

// Transparent PNG: a verb with its episode label, or a subtitle.
async function overlayPng(file, html) {
  await page.evaluate((h) => { const o = document.getElementById('x-ov'); o.innerHTML = h; o.style.display = 'block'; }, html);
  await page.screenshot({ path: file, omitBackground: true });
  await page.evaluate(() => { document.getElementById('x-ov').style.display = 'none'; });
}
// Full-screen card PNG (cold open, end card) using the overlay's own card.
async function cardPng(file, html) {
  await page.evaluate((h) => window.__v.card(h), html);
  await page.waitForTimeout(300);
  await page.screenshot({ path: file });
  await page.evaluate(() => { document.getElementById('v-card').style.display = 'none'; });
}

// ── Build each part ──────────────────────────────────────────────────────────
const segs = [], narr = [], hits = [], reveals = [];
const subWindow = (p) => ({ a: 0.25, b: Math.min(p.dur - 0.15, 0.25 + narrDur(p.cue) + 0.45) });
const pushZoom = (n) => `zoompan=z='1+0.035*on/${n}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS}`;

for (const [i, p] of plan.entries()) {
  const seg = path.join(SEG, `${String(i).padStart(2, '0')}.mp4`);
  const frames = Math.round(p.dur * FPS);
  const sw = subWindow(p);
  const subPng = path.join(PNG, `${i}-sub.png`);
  // The cold open's card already shows its line, so it gets no subtitle.
  await overlayPng(subPng, p.kind === 'open' ? '' : `<div class="sub">${esc(plain(p.cue))}</div>`);
  narr.push({ name: p.cue, at: p.at + sw.a, dur: narrDur(p.cue), text: plain(p.cue) });

  if (p.kind === 'beat') {
    const tl = JSON.parse(fs.readFileSync(path.join(EPISODES, p.ep, 'out', 'timeline.json'), 'utf8'));
    const src = path.join(EPISODES, p.ep, 'out', 'screen.webm');
    const srcLen = p.to - p.from;
    const speed = Math.max(1, srcLen / p.dur);
    const verbPng = path.join(PNG, `${i}-verb.png`);
    await overlayPng(verbPng, `<div class="scrim"></div><div class="verb">${esc(p.verb)}</div><div class="ep">${esc(p.label)}</div>`);
    // Source clip at `speed`, held on its last frame if it runs short, gently pushed in.
    const vf = `[0:v]trim=start=${(p.from + tl.videoOffset).toFixed(3)}:end=${(p.to + tl.videoOffset).toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(4)},fps=${FPS},scale=${W}:${H},tpad=stop_mode=clone:stop_duration=${p.dur.toFixed(3)},trim=end_frame=${frames},${pushZoom(frames)}[v0];` +
      `[1:v]format=rgba,fade=t=in:st=0.05:d=0.3:alpha=1,fade=t=out:st=${(p.dur - 0.45).toFixed(3)}:d=0.35:alpha=1[ov];` +
      `[2:v]format=rgba,fade=t=in:st=${sw.a}:d=0.15:alpha=1,fade=t=out:st=${(sw.b - 0.15).toFixed(3)}:d=0.15:alpha=1[sb];` +
      `[v0][ov]overlay=0:0:shortest=1[v1];[v1][sb]overlay=0:0:shortest=1,format=yuv420p[v]`;
    ff(['-i', src, '-loop', '1', '-t', p.dur.toFixed(3), '-i', verbPng, '-loop', '1', '-t', p.dur.toFixed(3), '-i', subPng,
      '-filter_complex', vf, '-map', '[v]', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-r', String(FPS), seg]);
    if (i === 1) reveals.push(p.at); else hits.push(p.at);
    console.log(`  ${p.verb.padEnd(16)} ${p.ep} ${p.from}-${p.to}s ×${speed.toFixed(2)} → ${p.dur.toFixed(2)}s`);
  } else {
    const cardFile = path.join(PNG, `${i}-card.png`);
    if (p.kind === 'open') {
      await cardPng(cardFile, `<div class="in eyebrow">Azure Architecture Diagram Builder</div>
        <div class="in q" style="max-width:1400px;line-height:1.2">What if every architecture conversation ended with something you could <span style="background:linear-gradient(90deg,#60a5fa,#c084fc,#f472b6);-webkit-background-clip:text;color:transparent">deploy</span>?</div>`);
    } else {
      const list = T.series.map((s, k) => `<div style="font-size:21px;color:#cbd5e1;text-align:left"><b style="color:#93c5fd;display:inline-block;width:34px">${k + 1}</b>${esc(s)}</div>`).join('');
      await cardPng(cardFile, `<div class="in eyebrow">Azure Architecture Diagram Builder</div>
        <h1 class="in" style="font-size:66px;margin:18px 0 10px"><span class="g">Design · validate · price · deploy, in minutes</span></h1>
        <div class="in" style="display:grid;grid-template-columns:repeat(2,420px);gap:10px 40px;margin-top:26px">${list}</div>
        <div class="in url" style="margin-top:34px">aka.ms/diagram-builder</div>
        <div class="in fine">The video series · recorded live on the production app · more episodes coming</div>`);
      reveals.push(p.at);
    }
    const vf = `[0:v]fps=${FPS},scale=${W}:${H},${pushZoom(frames)},fade=t=in:st=0:d=0.5[v0];` +
      `[1:v]format=rgba,fade=t=in:st=${sw.a}:d=0.15:alpha=1,fade=t=out:st=${(sw.b - 0.15).toFixed(3)}:d=0.15:alpha=1[sb];` +
      `[v0][sb]overlay=0:0:shortest=1,format=yuv420p[v]`;
    ff(['-loop', '1', '-t', p.dur.toFixed(3), '-i', cardFile, '-loop', '1', '-t', p.dur.toFixed(3), '-i', subPng,
      '-filter_complex', vf, '-map', '[v]', '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-r', String(FPS), seg]);
    console.log(`  ${p.kind.padEnd(16)} card → ${p.dur.toFixed(2)}s`);
  }
  segs.push(seg);
}
await browser.close();

// ── Assemble and hand over to mix.py / encode.sh ─────────────────────────────
// The concat filter decodes every segment (the concat demuxer dropped frames between segments).
const inputs = segs.flatMap((s) => ['-i', s]);
const join = segs.map((_, k) => `[${k}:v]setsar=1[s${k}];`).join('') + segs.map((_, k) => `[s${k}]`).join('') + `concat=n=${segs.length}:v=1:a=0[v]`;
ff([...inputs, '-filter_complex', join, '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', path.join(OUT, 'screen.mkv')]);
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ narr, ff: [], reveals, hits, marks: {}, audio: [], pcm: [], captions: [], end: total, videoOffset: 0 }, null, 1));
console.log(`done ${JSON.stringify({ parts: plan.length, end: Number(total.toFixed(2)), reveals: reveals.length, hits: hits.length })}`);

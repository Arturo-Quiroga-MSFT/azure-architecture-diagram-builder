// Off camera: open a .drawio export in diagrams.net, record a short editing clip (move a shape, select one).
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const CURSOR = () => {
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;width:30px;height:30px;pointer-events:none;transform:translate(-200px,-200px);transition:transform .06s linear;filter:drop-shadow(0 2px 6px #000a)';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.9L4 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const mv = (e) => { c.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 2}px)`; };
    addEventListener('mousemove', mv, true); addEventListener('pointermove', mv, true);
  });
};

// Returns { video, start, end } with start/end in seconds into the clip (the part worth showing).
export async function recordDrawio(browser, file, outDir, log = console.log) {
  const xml = fs.readFileSync(file, 'utf8');
  const data = zlib.deflateRawSync(Buffer.from(encodeURIComponent(xml))).toString('base64');
  fs.mkdirSync(outDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, recordVideo: { dir: outDir, size: { width: 1600, height: 900 } } });
  await ctx.addInitScript(CURSOR);
  const p = await ctx.newPage();
  const t0 = Date.now();
  const at = () => (Date.now() - t0) / 1000;
  const sleep = (ms) => p.waitForTimeout(ms);
  await p.goto(`https://app.diagrams.net/?splash=0&ui=dark&libraries=0&title=${encodeURIComponent(path.basename(file))}#R${encodeURIComponent(data)}`, { waitUntil: 'networkidle', timeout: 90000 });
  await p.locator('.geDiagramContainer svg g').first().waitFor({ timeout: 60000 });
  await sleep(2500);
  // Hide the shape library and format panel so the diagram gets the room.
  for (const k of ['Meta+Shift+P', 'Meta+Shift+K']) { await p.keyboard.press(k); await sleep(500); }
  await sleep(1200);
  const start = at();
  const move = async (x, y, steps = 30) => { await p.mouse.move(x, y, { steps }); await sleep(200); };
  // Icon of the shape whose label starts with `text`.
  const icon = (text) => p.evaluate((text) => {
    const lab = [...document.querySelectorAll('.geDiagramContainer foreignObject div div div')].find((d) => d.textContent.trim().startsWith(text));
    if (!lab) return null;
    const lr = lab.getBoundingClientRect(); const lx = lr.x + lr.width / 2;
    let best = null;
    for (const im of document.querySelectorAll('.geDiagramContainer svg image')) {
      const r = im.getBoundingClientRect(); if (r.width < 10) continue;
      const d = Math.abs(r.x + r.width / 2 - lx) + Math.abs(r.y + r.height - lr.y);
      if (!best || d < best.d) best = { d, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return best;
  }, text);
  await move(800, 470, 12);
  await sleep(800);
  // Zoom in toward the front end so icons and labels are readable.
  const fn0 = await icon('Azure Functions');
  if (fn0) {
    await move(fn0.x + 120, fn0.y, 24);
    await p.keyboard.down('Control');
    for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -120); await sleep(350); }
    await p.keyboard.up('Control');
    await sleep(1000);
  }
  // Move the App Service shape; its connector follows.
  const as = await icon('App Service');
  if (as && as.x > 40 && as.x < 1560 && as.y > 110 && as.y < 860) {
    await move(as.x, as.y);
    await p.mouse.down(); await sleep(300);
    await p.mouse.move(as.x - 10, as.y + 150, { steps: 55 }); await sleep(300);
    await p.mouse.up(); await sleep(1800);
    log('drawio moved App Service', JSON.stringify(as));
  } else log('drawio: App Service icon not on screen', JSON.stringify(as));
  const fn = await icon('Azure Functions');
  if (fn && fn.x > 0 && fn.x < 1600) { await move(fn.x, fn.y); await p.mouse.down(); await sleep(90); await p.mouse.up(); await sleep(2200); }
  await p.mouse.click(1500, 820); await sleep(900);
  const end = at();
  const video = await p.video().path();
  await ctx.close();
  return { video, start, end };
}

// Standalone test: node drawio-clip.mjs <file.drawio>
if (process.argv[1] && process.argv[1].endsWith('drawio-clip.mjs') && process.argv[2]) {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const { chromium } = require('@playwright/test');
  const b = await chromium.launch();
  const r = await recordDrawio(b, process.argv[2], '/tmp/drawio-clip');
  await b.close();
  console.log(JSON.stringify(r));
}

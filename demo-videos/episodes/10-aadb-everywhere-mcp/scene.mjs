// Episode 10 · AADB Everywhere (MCP). A real GitHub Copilot CLI session against the production MCP server,
// streamed live into a terminal window, then the agent's exported design opens in the web app.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { film, config } from '../../engine/film.mjs';
import { runCopilot, mcpConfigFile } from './copilot-session.mjs';

const require = createRequire(import.meta.url);
const XTERM = path.dirname(require.resolve('@xterm/xterm/package.json'));
const MCP_URL = config('AADB_MCP_URL');
const MCP_KEY = config('AADB_MCP_KEY');
if (!MCP_URL || !MCP_KEY) throw new Error('Set AADB_MCP_URL and AADB_MCP_KEY in demo-videos/.env');
const COLS = 118, ROWS = 31;

// List the server's tools over MCP (Streamable HTTP, stateless).
async function listTools() {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${MCP_KEY}` };
  const rpc = async (id, method, params) => {
    const r = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
    const t = await r.text();
    const m = t.match(/^data: (.*)$/m);
    return JSON.parse(m ? m[1] : t);
  };
  await rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'aadb-demo-video', version: '1' } });
  const res = await rpc(2, 'tools/list', {});
  return res.result.tools.map((t) => t.title || t.name);
}

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR, log, esc, now } = f;
  const PROMPT = fs.readFileSync(path.join(DIR, 'assets', 'prompt.txt'), 'utf8').trim();

  // Narration that follows the session: one line at a time, never overlapping.
  let voice = Promise.resolve();
  const sayNext = (cue) => { voice = voice.then(() => f.say(cue, { pad: 0.5 })); return voice; };

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  const chip = (ic, name, d) => `<div class="node in" style="animation-delay:${d}s;width:270px"><div class="ic">${ic}</div><b>${name}</b></div>`;
  await f.card(`<div class="in eyebrow">Beyond the web app</div>
    <div class="in q" style="animation-delay:.3s">Your architecture tools, in your agent</div>
    <div class="flow" style="gap:22px">
      ${chip('🧩', 'VS Code · GitHub Copilot', 1.3)}${chip('⌨️', 'GitHub Copilot CLI', 1.9)}${chip('🤖', 'Claude', 2.5)}${chip('🔌', 'Any MCP client', 3.1)}
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.2 });
  await f.opener({ title: 'AADB <span class="g">Everywhere</span>', sub: 'The Diagram Builder as an MCP server · real GitHub Copilot session', narr: 'n02-title' });

  // ── 2. The tools, listed live ────────────────────────────────────────────────
  const tools = await listTools().catch((e) => { log('tools/list failed', e.message); return []; });
  log('tools', tools.length, tools.join(' | '));
  if (tools.length) {
    const chips = tools.map((t, i) => `<div class="chip in" style="animation-delay:${0.4 + i * 0.12}s">${esc(t)}</div>`).join('');
    await f.card(`<div class="in eyebrow">MCP server · tools/list · live</div>
      <div class="in" style="font-size:52px;font-weight:750;margin-top:18px;animation-delay:.2s">${tools.length} tools for any agent</div>
      <div class="chips" style="max-width:1500px">${chips}</div>`);
    f.reveal();
    await sleep(400);
    await f.say(tools.length === 13 ? 'n03-tools' : 'n03-tools-generic', { pad: 0.8 });
  }

  // ── 3. Connect ───────────────────────────────────────────────────────────────
  const mcpJson = `{
  "inputs": [
    {
      "type": "promptString", "id": "aadb-mcp-key",
      "description": "AADB MCP API key", "password": true
    }
  ],
  "servers": {
    "azure-diagram-builder": {
      "type": "http",
      "url": "https://&lt;aadb-mcp-host&gt;/mcp",
      "headers": { "X-API-Key": "\${input:aadb-mcp-key}" }
    }
  }
}`;
  await f.card(`<style>
      .code { width: 1180px; border-radius: 16px; overflow: hidden; background: #0b1020; box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff22; text-align: left }
      .cbar { height: 40px; background: #1e293b; display: flex; align-items: center; gap: 8px; padding: 0 16px; font: 15px system-ui; color: #94a3b8 }
      .cbar i { width: 12px; height: 12px; border-radius: 50%; display: inline-block }
      .code pre { margin: 0; padding: 26px 30px; font: 21px/1.55 Menlo, Consolas, monospace; color: #e2e8f0; white-space: pre }
      .code .k { color: #93c5fd } .code .s { color: #86efac }
    </style>
    <div class="in eyebrow">Connect once</div>
    <div class="code in" style="margin-top:26px;animation-delay:.2s"><div class="cbar"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i>&nbsp; .vscode/mcp.json · from the project README</div>
    <pre>${mcpJson.replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:').replace(/: "([^"]*)"/g, ': <span class="s">"$1"</span>')}</pre></div>
    <div class="in fine" style="animation-delay:.8s;margin-top:22px;font-size:20px;color:#94a3b8">The key is prompted once and stored securely, never written in the file</div>`);
  await sleep(400);
  await f.say('n04-connect', { pad: 0.8 });

  // ── 4. The terminal ──────────────────────────────────────────────────────────
  await page.addStyleTag({ path: path.join(XTERM, 'css', 'xterm.css') });
  await page.addScriptTag({ path: path.join(XTERM, 'lib', 'xterm.js') });
  await f.card(`<style>
      .tw { width: 1360px; border-radius: 16px; overflow: hidden; background: #0b1020; box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff22; text-align: left }
      .tw .bar { height: 40px; background: #1e293b; display: flex; align-items: center; gap: 8px; padding: 0 16px; font: 15px system-ui; color: #94a3b8 }
      .tw .bar i { width: 12px; height: 12px; border-radius: 50%; display: inline-block }
      #term { padding: 14px 18px 18px; height: 745px }
      #chips { margin-left: auto; display: flex; gap: 8px }
      #chips span { padding: 4px 12px; border-radius: 999px; background: #facc15; color: #111827; font: 600 14px system-ui; animation: chipin .4s ease }
      @keyframes chipin { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }
    </style>
    <div class="tw in"><div class="bar"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i>&nbsp; Terminal · GitHub Copilot CLI with the AADB MCP server · real session<div id="chips"></div></div><div id="term"></div></div>`);
  await page.evaluate(({ cols, rows }) => {
    const term = new window.Terminal({ cols, rows, fontSize: 17, lineHeight: 1.15, fontFamily: 'Menlo, Consolas, monospace', convertEol: true, cursorBlink: true,
      theme: { background: '#0b1020', foreground: '#e2e8f0', cursor: '#60a5fa', green: '#4ade80', brightBlack: '#64748b', blue: '#60a5fa', cyan: '#67e8f9', yellow: '#facc15' } });
    term.open(document.getElementById('term'));
    window.__term = term;
  }, { cols: COLS, rows: ROWS });
  f.reveal();
  await sleep(700);

  // Type the request (the real command; the MCP config file holds the server URL and key).
  const typed = `\x1b[38;5;75m$\x1b[0m copilot --additional-mcp-config @aadb-mcp.json -p "${PROMPT}"`;
  const n5 = f.say('n05-ask', { wait: false, pad: 0.4 });
  for (let i = 0; i < typed.length; i += 3) {
    await page.evaluate((s) => window.__term.write(s), typed.slice(i, i + 3));
    await sleep(typed[i] === '\x1b' ? 0 : 18);
  }
  await page.evaluate(() => window.__term.write('\r\n\r\n'));
  await n5;
  await f.tag('Limited to the AADB MCP tools · no shell, no file access');

  // Run the session and stream its output into the page.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aadb-ep10-'));
  const sceneFile = path.join(f.DL, 'copilot-exported-scene.json');
  let buf = '', last = now(), quiet = false, plain = '';
  const flush = setInterval(() => {
    if (!buf) {
      if (!quiet && now() - last > 1.5) { quiet = true; f.tag('Copilot is working · sped up'); }
      return;
    }
    const chunk = buf; buf = '';
    page.evaluate((s) => window.__term.write(s), chunk).catch(() => {});
  }, 60);
  const seen = { validate: false, harden: false, cost: false };
  // Live results, read from the session, accumulate as chips in the terminal's title bar.
  const chipOut = (text) => page.evaluate((t) => {
    const c = document.getElementById('chips'); if (!c) return;
    const e = document.createElement('span'); e.textContent = t; c.appendChild(e);
  }, text).catch(() => {});
  const onData = (d) => {
    const t = now();
    // A pause in the output (the model thinking, a tool running) is sped up in post.
    if (t - last > 3) f.timeline.ff.push({ a: last + 0.8, b: t - 0.3, max: 2.5 });
    last = t;
    if (quiet) { quiet = false; f.tag(''); }
    buf += d;
    plain += d.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
    const flat = plain.replace(/\s+/g, ' ');
    const scores = [...flat.matchAll(/WAF design score (\d+)\/100/g)].map((m) => m[1]);
    if (!seen.validate && scores.length >= 1) {
      seen.validate = true; f.reveal(); sayNext('n06-validate');
      chipOut(`Design score ${scores[0]}/100`);
    }
    if (!seen.harden && /Harden Azure Architecture/.test(flat)) { seen.harden = true; sayNext('n07-harden'); }
    if (seen.harden && scores.length >= 2 && !seen.after) {
      seen.after = true; f.reveal();
      chipOut(`Hardened · ${scores[0]} → ${scores[scores.length - 1]}/100`);
    }
    const cost = flat.match(/~?\$([\d,]+\.\d{2})\/mo/);
    if (!seen.cost && /Estimate Azure Costs/.test(flat)) { seen.cost = true; sayNext('n08-cost'); }
    if (cost && !seen.costTag) { seen.costTag = true; chipOut(`~$${cost[1]}/mo baseline`); }
    if (!seen.exported && /Export React Flow Scene/.test(flat)) { seen.exported = true; chipOut('Exported for the web app'); }
  };
  const result = await runCopilot({ prompt: PROMPT, mcpConfig: mcpConfigFile(MCP_URL, MCP_KEY, work), model: config('COPILOT_MODEL'), cwd: work, cols: COLS, rows: ROWS, onData, sceneOut: sceneFile, log });
  await sleep(400);
  clearInterval(flush);
  if (buf) await page.evaluate((s) => window.__term.write(s), buf);
  fs.rmSync(work, { recursive: true, force: true });
  log('copilot exit', result.exitCode, 'scene', Boolean(result.scene));
  await voice;
  await f.tag('');
  f.reveal();
  await sleep(600);
  await f.say('n09-summary', { pad: 1.2 });
  await sleep(1500);

  // ── 5. The design in the web app ─────────────────────────────────────────────
  if (result.scene) {
    await f.card('');
    await sleep(500);
    await f.cursor(true);
    await f.tag('Load the scene Copilot exported');
    await f.pointTo('label[title="Load diagram"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.mouse.down().then(() => page.mouse.up())]);
    await fc.setFiles(result.scene);
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length > 6, null, { timeout: 30000 });
    await page.mouse.move(1000, 640, { steps: 12 });
    await f.cursor(false);
    await page.evaluate(() => document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click());
    await f.fit();
    f.reveal();
    const services = await page.locator('.react-flow__node-azureNode').count().catch(() => 0);
    await f.tag(`Designed by GitHub Copilot through MCP · ${services} services`);
    await f.say('n10-open', { pad: 0.4 });
    const n11 = f.say('n11-tour', { wait: false, pad: 0.6 });
    await f.ring('.cost-indicator', 'Priced live at Azure retail prices', 6);
    await sleep(3000);
    await f.ring(null);
    if (await page.locator('.workflow-panel').count()) {
      await f.ring('.workflow-panel', 'Request flow from the agent\'s design', 6);
      await sleep(2600);
      await f.ring(null);
    }
    await n11;
    await f.tag('');
  }

  // ── 6. Close ─────────────────────────────────────────────────────────────────
  await f.say('n12-close', { pad: 1.0 });
  await f.endCard();
});

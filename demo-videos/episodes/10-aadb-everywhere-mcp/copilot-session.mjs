// Run a real GitHub Copilot CLI session against the AADB MCP server in a pseudo-terminal.
// Streams raw terminal output (with timing) to onData and copies the exported diagram scene
// as soon as Copilot saves the large tool result (that temp file is deleted when the session ends).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pty = require('node-pty');

// Tools Copilot CLI may not use, so the agent works only through the AADB MCP tools.
const EXCLUDED = ['bash', 'apply_patch', 'view', 'glob', 'rg', 'web_fetch', 'task', 'skill', 'sql'];

// The saved tool output starts with the JSON result and may be followed by more text.
function leadingJson(body) {
  const start = body.indexOf('{');
  if (start < 0) return null;
  try { return JSON.parse(body.slice(start)); } catch (e) {
    const at = /position (\d+)/.exec(e.message);
    if (!at) return null;
    try { return JSON.parse(body.slice(start, start + Number(at[1]))); } catch { return null; }
  }
}

export function mcpConfigFile(url, key, dir) {
  const file = path.join(dir, 'aadb-mcp.json');
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { aadb: { type: 'http', url, headers: { Authorization: `Bearer ${key}` }, tools: ['*'] } } }), { mode: 0o600 });
  return file;
}

export function runCopilot({ prompt, mcpConfig, model, cwd, cols = 110, rows = 32, onData = () => {}, sceneOut, log = console.log, copilotBin = 'copilot', maxCredits = 40 }) {
  const args = ['-p', prompt, '--additional-mcp-config', `@${mcpConfig}`, '--excluded-tools', ...EXCLUDED,
    '--no-custom-instructions', '--disable-builtin-mcps', '--allow-all-tools', '--max-ai-credits', String(maxCredits)];
  if (model) args.push('--model', model);
  const p = pty.spawn(copilotBin, args, { name: 'xterm-256color', cols, rows, cwd, env: { ...process.env, FORCE_COLOR: '1' } });
  let text = '', copied = null;
  const strip = (s) => s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
  p.onData((d) => { onData(d); text += strip(d); });
  // Large tool results are saved to temp files named *copilot-tool-output-*.txt; keep the scene export.
  const tmp = os.tmpdir(), started = Date.now() - 2000, seen = new Set();
  const watch = setInterval(() => {
    let names = [];
    try { names = fs.readdirSync(tmp).filter((n) => n.includes('copilot-tool-output-') && !seen.has(n)); } catch { return; }
    for (const n of names) {
      const f = path.join(tmp, n);
      try {
        if (fs.statSync(f).mtimeMs < started) { seen.add(n); continue; }
        const j = leadingJson(fs.readFileSync(f, 'utf8'));
        if (!j) continue;
        seen.add(n);
        if (Array.isArray(j.nodes) && Array.isArray(j.edges) && sceneOut) {
          fs.writeFileSync(sceneOut, JSON.stringify(j)); copied = sceneOut;
          log('scene saved', n, `${j.nodes.length} nodes, ${j.edges.length} edges`);
        }
      } catch (e) { if (process.env.EP10_DEBUG) log('candidate', n, String(e.message).slice(0, 120)); }
    }
  }, 150);
  return new Promise((resolve) => p.onExit(({ exitCode }) => { clearInterval(watch); resolve({ exitCode, text, scene: copied }); }));
}

// Rehearsal: node copilot-session.mjs  (prints the plain transcript, writes out/rehearsal.cast)
if (process.argv[1]?.endsWith('copilot-session.mjs')) {
  const { config } = await import('../../engine/film.mjs').catch(() => ({ config: (n, f) => process.env[n] || f }));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aadb-ep10-'));
  const cfg = mcpConfigFile(config('AADB_MCP_URL'), config('AADB_MCP_KEY'), dir);
  const prompt = fs.readFileSync(new URL('./assets/prompt.txt', import.meta.url), 'utf8').trim();
  const t0 = Date.now(), cast = [];
  fs.mkdirSync(new URL('./out', import.meta.url), { recursive: true });
  const r = await runCopilot({ prompt, mcpConfig: cfg, model: config('COPILOT_MODEL'), cwd: dir, onData: (d) => cast.push([(Date.now() - t0) / 1000, d]), sceneOut: new URL('./out/rehearsal-scene.json', import.meta.url).pathname });
  fs.writeFileSync(new URL('./out/rehearsal.cast', import.meta.url), JSON.stringify(cast));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(r.text);
  console.log('exit', r.exitCode, 'secs', ((Date.now() - t0) / 1000).toFixed(0), 'scene', r.scene);
}

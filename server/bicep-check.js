// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * POST /api/bicep/build — compile model-generated Bicep with the real Bicep CLI
 * and return its diagnostics, so the Deployment Guide can prove its templates
 * compile (and feed real compiler errors back to the model for one repair).
 *
 * Only diagnostics are returned, never the compiled ARM JSON. Files are written
 * to a throwaway directory, external module restore is disabled, file-loading
 * functions are refused, and size, count, time and concurrency are bounded.
 */

const { execFile } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const BICEP_PATH = process.env.BICEP_PATH || 'bicep';
const MAX_FILES = 40;
const MAX_TOTAL_BYTES = 400 * 1024;
const TIMEOUT_MS = 60_000;
const MAX_CONCURRENT = 2;
const FILENAME_RE = /^(?:[A-Za-z0-9_-]+\/){0,3}[A-Za-z0-9_.-]+\.bicep$/;
const LOAD_FN_RE = /\bload(?:TextContent|FileAsBase64|JsonContent|YamlContent|DirectoryFileInfo)\s*\(/;
const DIAG_RE = /^(?:(?:ERROR|WARNING): )?(.+?)\((\d+),(\d+)\) : (Error|Warning|Info) ([A-Za-z0-9-]+): (.*?)(?: \[https?:\/\/[^\]]+\])?$/;

let running = 0;
let cachedVersion = null;

function run(args, cwd) {
  return new Promise((resolve) => {
    execFile(BICEP_PATH, args, { cwd, timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: '1' } },
      (error, stdout, stderr) => resolve({ error, stdout: String(stdout || ''), stderr: String(stderr || '') }));
  });
}

async function bicepVersion() {
  if (cachedVersion) return cachedVersion;
  const { error, stdout } = await run(['--version'], os.tmpdir());
  const version = error ? '' : (stdout.match(/\d+\.\d+\.\d+/) || [''])[0];
  if (version) cachedVersion = version;
  return version;
}

function parseDiagnostics(text, root) {
  const seen = new Set();
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = DIAG_RE.exec(raw.trim());
    if (!m) continue;
    const file = path.relative(root, path.resolve(root, m[1])).split(path.sep).join('/');
    const d = { file, line: Number(m[2]), column: Number(m[3]), level: m[4].toLowerCase(), code: m[5], message: m[6].slice(0, 400) };
    const key = `${d.file}:${d.line}:${d.column}:${d.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

function validate(files) {
  if (!Array.isArray(files) || files.length === 0) return 'files is required';
  if (files.length > MAX_FILES) return `at most ${MAX_FILES} files`;
  let total = 0;
  const names = new Set();
  for (const f of files) {
    if (!f || typeof f.filename !== 'string' || typeof f.content !== 'string') return 'each file needs filename and content';
    const name = f.filename.replace(/^\.\//, '');
    if (!FILENAME_RE.test(name) || name.split('/').includes('..')) return `invalid filename: ${f.filename.slice(0, 80)}`;
    if (names.has(name)) return `duplicate filename: ${name}`;
    names.add(name);
    total += Buffer.byteLength(f.content, 'utf8');
  }
  if (total > MAX_TOTAL_BYTES) return 'templates too large';
  return null;
}

function register(app) {
  app.get('/api/bicep/version', async (_req, res) => {
    const version = await bicepVersion();
    res.status(version ? 200 : 503).json({ available: Boolean(version), version });
  });

  app.post('/api/bicep/build', async (req, res) => {
    const files = req.body?.files;
    const problem = validate(files);
    if (problem) return res.status(400).json({ error: problem });
    const version = await bicepVersion();
    if (!version) return res.status(503).json({ error: 'Bicep CLI unavailable' });
    if (running >= MAX_CONCURRENT) return res.status(429).json({ error: 'Busy, retry shortly' });

    running++;
    const started = Date.now();
    let root = '';
    try {
      root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'bicep-')));
      const refused = [];
      for (const f of files) {
        const name = f.filename.replace(/^\.\//, '');
        const target = path.join(root, name);
        if (!target.startsWith(root + path.sep)) throw new Error('path escape');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, f.content, 'utf8');
        if (LOAD_FN_RE.test(f.content)) {
          refused.push({ file: name, line: 1, column: 1, level: 'error', code: 'AADB001', message: 'File-loading functions are not supported by the compile check.' });
        }
      }
      let diagnostics = refused;
      if (refused.length === 0) {
        const { error, stdout, stderr } = await run(['build', '--pattern', '**/*.bicep', '--no-restore', '--outdir', path.join(root, '.out')], root);
        if (error && error.killed) return res.status(504).json({ error: 'Bicep compile timed out' });
        diagnostics = parseDiagnostics(`${stdout}\n${stderr}`, root);
        if (error && !diagnostics.some((d) => d.level === 'error')) {
          diagnostics.push({ file: '', line: 0, column: 0, level: 'error', code: 'AADB000', message: (stderr || error.message).trim().slice(0, 400) });
        }
      }
      const errors = diagnostics.filter((d) => d.level === 'error');
      res.json({
        ok: errors.length === 0,
        version,
        files: files.length,
        errorCount: errors.length,
        warningCount: diagnostics.filter((d) => d.level === 'warning').length,
        diagnostics: diagnostics.slice(0, 200),
        elapsedMs: Date.now() - started,
      });
    } catch (err) {
      console.error('[bicep-check] error:', err.message);
      res.status(500).json({ error: 'Bicep compile failed to run' });
    } finally {
      running--;
      if (root) fs.rm(root, { recursive: true, force: true }).catch(() => {});
    }
  });
}

module.exports = { register, parseDiagnostics, validate };

// Episode 8 · Deploy It. Recorded live on production AADB (v2.1.12+).
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { film, config } from '../../engine/film.mjs';

const run = promisify(execFile);
// az runs with the same Azure CLI profile as the rest of the toolkit (AZURE_CONFIG_DIR, if set).
const AZ_ENV = { ...process.env };
// An empty resource group for `az deployment group what-if`. Without one, the terminal card shows the build only.
const WHATIF_RG = config('WHATIF_RESOURCE_GROUP', '');

// Fill main.bicep's required parameters with valid throwaway values.
function paramsFor(main, suffix) {
  const lines = main.split('\n');
  const params = {};
  lines.forEach((l, i) => {
    const m = /^param\s+(\w+)\s+(\w+)\s*$/.exec(l.trim());
    if (!m) return;
    const [, name, type] = m;
    const secure = /@secure\(\)/.test(lines.slice(Math.max(0, i - 3), i).join(' '));
    let value;
    if (secure || /password|secret/i.test(name)) value = `Aa1!${crypto.randomBytes(12).toString('hex')}`;
    else if (type === 'int') value = 1;
    else if (type === 'bool') value = false;
    else if (type === 'array') value = [];
    else if (type === 'object') value = {};
    else if (/login|user/i.test(name)) value = 'clinicadmin';
    else if (/location/i.test(name)) value = 'eastus2';
    else value = `${name.replace(/Name$/, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 6)}clinic${suffix}`;
    params[name] = { value };
  });
  return params;
}

// Off camera: unzip the downloaded Bicep, build it, then what-if against an empty resource group.
async function terminalRun(zip, dir, log) {
  const out = { build: null, whatif: null };
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await run('unzip', ['-oq', zip, '-d', dir]);
  const main = path.join(dir, 'main.bicep');
  try {
    const r = await run('az', ['bicep', 'build', '--file', main, '--stdout'], { env: AZ_ENV, maxBuffer: 32e6, timeout: 120000 });
    out.build = { ok: true, warnings: (r.stderr.match(/: Warning /g) || []).length };
  } catch (e) {
    out.build = { ok: false, errors: (String(e.stderr).match(/: Error /g) || []).length };
    log('bicep build failed', String(e.stderr).slice(0, 400));
    return out;
  }
  if (!WHATIF_RG) { log('what-if skipped: set WHATIF_RESOURCE_GROUP to run it'); return out; }
  const params = paramsFor(fs.readFileSync(main, 'utf8'), crypto.randomBytes(3).toString('hex'));
  fs.writeFileSync(path.join(dir, 'parameters.json'), JSON.stringify({ $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#', contentVersion: '1.0.0.0', parameters: params }, null, 1));
  try {
    const r = await run('az', ['deployment', 'group', 'what-if', '-g', WHATIF_RG, '--template-file', main, '--parameters', '@' + path.join(dir, 'parameters.json'), '--no-pretty-print', '-o', 'json'], { env: AZ_ENV, maxBuffer: 32e6, timeout: 240000 });
    const d = JSON.parse(r.stdout);
    if (d.status !== 'Succeeded') throw new Error(JSON.stringify(d.error || d.status));
    out.whatif = d.changes.map((c) => ({ type: c.changeType, id: c.resourceId.split('/providers/').pop() }));
  } catch (e) {
    log('what-if failed', String(e.stderr || e.message).slice(0, 600));
  }
  return out;
}

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR, log } = f;
  const DRAFT = path.join(DIR, 'assets', 'clinic-booking-first-draft.json');

  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
  };
  // Smoothly scroll the guide so `sel` sits near the top of the modal body.
  const scrollTo = async (sel, offset = 24, ms = 1400) => {
    await page.evaluate(({ sel, offset, ms }) => {
      const el = document.querySelector(sel);
      const body = document.querySelector('.deployment-modal .modal-body');
      if (!el || !body) return;
      const from = body.scrollTop;
      const to = Math.min(body.scrollHeight - body.clientHeight, from + el.getBoundingClientRect().top - body.getBoundingClientRect().top - offset);
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        body.scrollTop = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { sel, offset, ms });
    await sleep(ms + 300);
  };
  const has = (sel) => page.locator(sel).count().then((n) => n > 0);

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  await f.card(`<div class="in eyebrow">From design to Azure</div>
    <div class="flow" style="gap:60px;margin-top:40px">
      <div class="node in" style="animation-delay:.6s;width:420px;border-color:#60a5fa;box-shadow:0 0 40px #3b82f688"><div class="ic">🗺️</div><b style="font-size:38px">A diagram is a plan</b></div>
      <div class="node in hot" style="animation-delay:2.2s;width:420px"><div class="ic">🚀</div><b style="font-size:38px">Deployment is the proof</b></div>
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Deploy <span class="g">It</span>', sub: 'Deployment guide · Bicep compiled with the real Bicep CLI · ready to run', narr: 'n02-title' });

  // ── 2. Load the draft ────────────────────────────────────────────────────────
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
  await tidy();
  await f.fit();
  f.reveal();
  await f.tag('Clinic Booking · first draft');
  await f.say('n03-draft', { pad: 0.6 });

  // ── 3. Generate the guide ────────────────────────────────────────────────────
  await f.cursor(true);
  await f.tag('Share or Build');
  await f.pointTo(page.getByRole('button', { name: /Share or Build/ }).first(), { click: true });
  await sleep(1200);
  const gen = page.getByRole('button', { name: /Generate a deployment guide/ }).first();
  await gen.evaluate((e) => e.setAttribute('data-v', 'gen')).catch(() => {});
  await f.ring('[data-v="gen"]', 'Deployment guide + Bicep', 6);
  const n4 = f.say('n04-generate', { wait: false, pad: 0.4 });
  await sleep(1600);
  await f.ring(null);
  await f.pointTo('[data-v="gen"]', { click: true });
  await f.cursor(false);
  await page.locator('.guide-progress').waitFor({ timeout: 20000 }).catch(() => {});
  await f.tag('Writing the guide · sped up');
  await f.ring('.guide-progress', 'Live progress', 8);
  const phases = new Set();
  await f.ff(async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 420000) {
      const t = await page.locator('.guide-progress').innerText().catch(() => '');
      if (t && !phases.has(t)) { phases.add(t); log('phase', t); }
      if (await has('.deployment-modal .guide-header')) { await sleep(800); break; }
      await sleep(400);
    }
  }, { max: 9 });
  await n4;
  await f.ring(null);
  await f.tag('');
  await page.locator('.deployment-modal .modal-body').waitFor({ timeout: 10000 });
  await sleep(600);
  f.reveal();

  // Off camera: fetch the Bicep ZIP now and start build + what-if while the tour runs.
  const [bg] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.locator('.btn-download-all-bicep').evaluate((e) => e.click())]);
  const bgZip = path.join(f.DL, 'offcamera-' + bg.suggestedFilename());
  await bg.saveAs(bgZip);
  const terminal = terminalRun(bgZip, path.join(f.DL, 'terminal'), log);

  // ── 4. Tour the guide ────────────────────────────────────────────────────────
  const n5 = f.say('n05-overview', { wait: false, pad: 0.5 });
  await f.ring('.guide-header', 'Written for this architecture', 6);
  await sleep(2600);
  await f.ring('.prerequisites-list', 'Prerequisites', 6);
  await n5;
  await f.ring(null);

  await scrollTo('.steps-list');
  const steps = await page.locator('.step-card').count();
  log('steps', steps);
  const n6 = f.say('n06-steps', { wait: false, pad: 0.5 });
  await f.tag(`${steps} steps`);
  if (steps > 1) {
    await f.cursor(true);
    await page.locator('.step-card .step-header').first().click();
    await sleep(500);
    await f.pointTo(page.locator('.step-card .step-header').nth(1), { click: true });
    await sleep(900);
    await page.locator('.step-card').nth(1).evaluate((e) => e.setAttribute('data-v', 'step'));
    await scrollTo('[data-v="step"]', 60, 900);
    const cmd = page.locator('[data-v="step"] .command-block').first();
    if (await cmd.count()) {
      await cmd.evaluate((e) => e.setAttribute('data-v', 'cmd'));
      await f.ring('[data-v="cmd"]', 'Azure CLI · ready to copy', 6);
      await f.pointTo('[data-v="cmd"] .copy-button');
    }
    await f.cursor(false);
  }
  await n6;
  await f.ring(null);
  await f.tag('');

  const n7 = f.say('n07-config', { wait: false, pad: 0.5 });
  if (await has('.configuration-section')) {
    await scrollTo('.configuration-section');
    await f.ring('.configuration-section', 'Configuration', 6);
    await sleep(2400);
  }
  if (await has('.validation-list')) {
    await scrollTo('.validation-list', 120);
    await f.ring('.validation-list', 'Validation checklist', 6);
  }
  await n7;
  await f.ring(null);

  const n8 = f.say('n08-grounding', { wait: false, pad: 0.5 });
  if (await has('.grounding-section')) {
    await scrollTo('.grounding-section');
    const nSrc = await page.locator('.grounding-list li').count();
    await f.ring('.grounding-list', `${nSrc} Microsoft Learn sources`, 6);
  }
  await n8;
  await f.ring(null);

  // ── 5. The compile check ─────────────────────────────────────────────────────
  await scrollTo('.bicep-section', 20);
  const badge = (await page.locator('.bicep-check-text').innerText().catch(() => '')).split('\n').map((s) => s.trim()).filter(Boolean);
  const passed = await has('.bicep-check--passed');
  log('badge', passed, badge.join(' | '));
  await f.tag(passed ? '✅ Compiled' : 'Compile check');
  const n9 = f.say('n09-compiled', { wait: false, pad: 0.5 });
  await sleep(800);
  await f.ring('.bicep-check', badge.join(' · ').slice(0, 110), 8);
  await n9;
  await f.ring(null);
  await f.tag('');

  const tCount = await page.locator('.bicep-template-card').count();
  const n10 = f.say('n10-modules', { wait: false, pad: 0.5 });
  await scrollTo('.bicep-templates-list', 30);
  await f.tag(`${tCount} templates`);
  await f.ring('.bicep-template-card:first-child .bicep-template-header', (await page.locator('.bicep-template-filename').first().innerText().catch(() => 'main.bicep')), 6);
  await sleep(1200);
  await f.ring(null);
  await page.evaluate(() => {
    const pre = document.querySelector('.bicep-template-card .bicep-code');
    if (!pre) return;
    const to = pre.scrollHeight - pre.clientHeight, t0 = performance.now(), ms = 4500;
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); pre.scrollTop = to * k; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  await sleep(4800);
  await scrollTo('.bicep-template-card:nth-child(2)', 40, 1000);
  await f.ring('.bicep-templates-list', 'One module per part of the design', 6);
  await n10;
  await f.ring(null);
  await f.tag('');

  // ── 6. Download ──────────────────────────────────────────────────────────────
  await scrollTo('.bicep-section', 20, 900);
  await f.subTop(true);
  const n11 = f.say('n11-download', { wait: false, pad: 0.4 });
  await f.cursor(true);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), f.pointTo('.btn-download-all-bicep', { click: true })]);
  const zip = path.join(f.DL, dl.suggestedFilename());
  await dl.saveAs(zip);
  await f.tag(`Saved · ${path.basename(zip)}`);
  await sleep(1200);
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), f.pointTo('.modal-actions .btn-secondary', { click: true })]);
  await dl2.saveAs(path.join(f.DL, dl2.suggestedFilename()));
  await f.tag(`Saved · ${dl2.suggestedFilename().replace(/-\d{10,}/, '')}`);
  await f.cursor(false);
  await n11;
  await f.subTop(false);
  await f.tag('');

  // ── 7. Terminal card ─────────────────────────────────────────────────────────
  const res = await terminal;
  log('terminal', JSON.stringify({ build: res.build, whatif: res.whatif?.length }));
  const esc = f.esc;
  const ln = (html, d, cls = '') => `<div class="tl ${cls}" style="animation-delay:${d}s">${html}</div>`;
  let d = 0.6;
  let body = ln(`<span class="tp">$</span> unzip ${esc(path.basename(zip))} -d clinic-bicep && cd clinic-bicep`, d);
  body += ln(`<span class="tp">$</span> az bicep build --file main.bicep`, (d += 1.2));
  body += res.build?.ok
    ? ln(`<span class="tok">✔ main.json written · 0 errors${res.build.warnings ? ` · ${res.build.warnings} warning${res.build.warnings > 1 ? 's' : ''}` : ''}</span>`, (d += 1.4))
    : ln(`<span class="terr">✖ ${res.build?.errors || ''} errors</span>`, (d += 1.4));
  const wi = res.build?.ok && res.whatif?.length ? res.whatif : null;
  if (wi) {
    body += ln(`<span class="tp">$</span> az deployment group what-if -g ${WHATIF_RG} --template-file main.bicep --parameters @parameters.json`, (d += 1.4));
    const creates = wi.filter((c) => c.type === 'Create');
    body += ln(`<span class="tdim">Resource and property changes are indicated with this symbol:</span>`, (d += 2.0));
    body += ln(`<span class="tok">&nbsp;&nbsp;+</span> Create`, (d += 0.3));
    const show = creates.slice(0, 11);
    for (const c of show) body += ln(`<span class="tok">&nbsp;&nbsp;+ ${esc(c.id)}</span>`, (d += 0.28));
    if (creates.length > show.length) body += ln(`<span class="tdim">&nbsp;&nbsp;… and ${creates.length - show.length} more</span>`, (d += 0.28));
    body += ln(`<b>Resource changes: ${creates.length} to create.</b>`, (d += 0.8));
  }
  await f.card(`<style>
      .term { width: 1380px; border-radius: 16px; overflow: hidden; background: #0b1020; box-shadow: 0 30px 90px #000c, 0 0 0 1px #ffffff22; text-align: left }
      .tbar { height: 40px; background: #1e293b; display: flex; align-items: center; gap: 8px; padding: 0 16px; font: 15px system-ui; color: #94a3b8 }
      .tbar i { width: 12px; height: 12px; border-radius: 50%; display: inline-block }
      .tbody { padding: 22px 28px; font: 19px/1.55 Menlo, Consolas, monospace; color: #e2e8f0; min-height: 560px }
      .tl { opacity: 0; animation: tin .25s ease forwards; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
      .tl .tp { color: #60a5fa } .tl .tok { color: #4ade80 } .tl .terr { color: #f87171 } .tl .tdim { color: #64748b }
      @keyframes tin { to { opacity: 1 } }
    </style>
    <div class="term in"><div class="tbar"><i style="background:#f87171"></i><i style="background:#fbbf24"></i><i style="background:#34d399"></i>&nbsp; Terminal · the downloaded templates, real run</div>
    <div class="tbody">${body}</div></div>`);
  f.reveal();
  await f.say(wi ? 'n12-terminal' : 'n12-build-only', { pad: 0.3 });
  await sleep(Math.max(0, (d + 2.2) * 1000 - (f.narrDur(wi ? 'n12-terminal' : 'n12-build-only') + 0.3) * 1000));
  await f.card('');
  await sleep(400);

  // ── 8. Troubleshooting ───────────────────────────────────────────────────────
  const n13 = f.say('n13-troubleshoot', { wait: false, pad: 0.5 });
  if (await has('.troubleshooting-section')) {
    await scrollTo('.troubleshooting-section');
    const tips = await page.locator('.troubleshooting-item').count();
    await f.ring('.troubleshooting-list', `${tips} troubleshooting tips`, 6);
  }
  await n13;
  await f.ring(null);

  // ── 9. Close ─────────────────────────────────────────────────────────────────
  await f.say('n14-close', { pad: 1.0 });
  await f.endCard();
});

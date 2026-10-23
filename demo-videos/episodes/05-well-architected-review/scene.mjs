// Episode 5 · Well-Architected Review. Recorded live on production AADB.
import path from 'path';
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep, DIR, log } = f;
  const DRAFT = path.join(DIR, 'assets', 'clinic-booking-first-draft.json');
  // Preferred fixes, in order: edge protection, regional resilience, data resilience, secrets. Avoid private networking.
  const PREF = [/Network Security|Web Application (Protection|Firewall)|Edge Security|Ingress Protection/i, /High Availability|Regional Resilience|Disaster Recovery|Multi-?Region/i, /Data(base)? Resilience|Backup/i, /Secrets? Management/i];
  const WANT = { test: (c) => PREF.some((r) => r.test(c)) && !/Isolation|Private/i.test(c) };

  const tagText = (texts, id, sel = 'div,section,aside,button,span,li,p') => page.evaluate(({ texts, id, sel }) => {
    document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v'));
    const hit = [...document.querySelectorAll(sel)]
      .filter((e) => texts.every((t) => (e.textContent || '').includes(t)) && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (hit) hit.setAttribute('data-v', id);
    return !!hit;
  }, { texts, id, sel });
  const tagNode = (re, id, group = false) => page.evaluate(({ re, id, group }) => {
    document.querySelectorAll(`[data-v="${id}"]`).forEach((x) => x.removeAttribute('data-v'));
    const rx = new RegExp(re, 'i');
    const n = [...document.querySelectorAll(group ? '.react-flow__node-groupNode' : '.react-flow__node:not(.react-flow__node-groupNode)')]
      .find((e) => rx.test(group ? (e.querySelector('*')?.textContent || e.textContent || '').slice(0, 80) : e.textContent || '') && e.getBoundingClientRect().width > 0);
    if (!n) return false;
    n.setAttribute('data-v', id);
    return true;
  }, { re: re.source || re, id, group });
  const center = (sel) => page.evaluate((s) => { document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, sel);
  const cost = () => page.locator('.cost-indicator').first().innerText().then((s) => s.trim()).catch(() => '');

  const tidy = async () => {
    await page.evaluate(() => {
      document.querySelector('.icon-palette:not(.collapsed) .collapse-toggle')?.click();
      document.querySelector('.workflow-panel.expanded .workflow-header')?.click();
    });
    await sleep(500);
  };
  // Fit every node into the visible canvas, scaling the viewport further than min zoom if needed.
  const fitAll = async () => {
    await tidy();
    await f.fit();
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

  // Read the validation result shown in the panel.
  const readResult = () => page.evaluate(() => {
    const t = document.querySelector('.score-summary')?.innerText || '';
    const s = document.querySelector('.validation-score')?.innerText || '';
    const score = +((s.match(/(\d{1,3})\s*\/\s*100/) || t.match(/(\d{1,3})\s*\/\s*100/) || [])[1] || 0);
    const g = t.match(/(\d+) gaps? identified \(([^)]*)\)/);
    const high = +((g?.[2] || '').match(/(\d+) high/)?.[1] || 0);
    const band = (t.match(/(Strong alignment|Adequate, with gaps|Developing|Needs attention|Critical gaps|At risk)/) || [])[1] || '';
    const seen = new Set();
    const pillars = [...document.querySelectorAll('.pillar-header')].map((h) => {
      const txt = h.innerText.replace(/\n+/g, ' ').trim();
      const name = (txt.match(/^(Reliability|Security|Cost Optimization|Operational Excellence|Performance Efficiency)/) || [])[1];
      const sc = (txt.match(/(\d{1,3})\s*(?:\/\s*100)?\s*$/) || [])[1];
      return { name, score: sc ? +sc : null, txt };
    }).filter((p) => p.name && !seen.has(p.name) && seen.add(p.name));
    return { score, gaps: +(g?.[1] || 0), high, band, pillars };
  });

  const validate = async (btn) => {
    const prevSummary = await page.evaluate(() => document.querySelector('.score-summary')?.innerText || '');
    await f.pointTo(btn, { click: true });
    await f.cursor(false);
    await f.tag('Reviewing against the Well-Architected Framework · sped up');
    await f.ff(async () => {
      await page.waitForFunction((prev) => {
        const sc = document.querySelector('.validation-score');
        const t = document.querySelector('.score-summary')?.innerText || '';
        return sc && t && t !== prev;
      }, prevSummary, { timeout: 400000 });
      await sleep(1200);
    }, { max: 6 });
    f.reveal();
    await f.tag('');
  };
  const showNumbers = async () => {
    const box = page.locator('.score-toggle input');
    if (await box.isChecked().catch(() => true)) return;
    await f.cursor(true);
    await f.pointTo('.score-toggle', { click: true });
    await f.cursor(false);
    if (!(await box.isChecked().catch(() => true))) await box.check().catch(() => {});
    await sleep(600);
  };
  const tagPillars = () => page.evaluate(() => {
    document.querySelectorAll('[data-v="pillars"]').forEach((x) => x.removeAttribute('data-v'));
    let e = document.querySelector('.pillar-header');
    while (e && e.querySelectorAll('.pillar-header').length < 5) e = e.parentElement;
    if (e && !e.classList.contains('validation-panel')) { e.setAttribute('data-v', 'pillars'); return true; }
    return false;
  });

  // ── 1. Cold open ─────────────────────────────────────────────────────────────
  const pill = (ic, name, d, col) => `<div class="node in" style="animation-delay:${d}s;width:250px;border-color:${col};box-shadow:0 0 34px ${col}55"><div class="ic">${ic}</div><b>${name}</b></div>`;
  await f.card(`<div class="in eyebrow">Before the design review</div>
    <div class="in q" style="animation-delay:.3s">Would this pass?</div>
    <div class="flow" style="gap:22px">
      ${pill('🛟', 'Reliability', 1.6, '#60a5fa')}${pill('🛡️', 'Security', 2.3, '#a78bfa')}${pill('💲', 'Cost', 3.0, '#34d399')}
      ${pill('⚙️', 'Operations', 3.6, '#fbbf24')}${pill('⚡', 'Performance', 4.2, '#f472b6')}
    </div>`);
  await sleep(500);
  await f.say('n01-open', { pad: 1.0 });
  await f.opener({ title: 'Well-Architected <span class="g">Review</span>', sub: 'Score the design on five pillars · fix the gaps in one click · revalidate', narr: 'n02-title' });

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
  await fitAll();
  f.reveal();
  await f.tag('Clinic Booking · first draft');
  const cost0 = await cost();
  log('draft cost', cost0);
  const n3 = f.say('n03-draft', { wait: false, pad: 0.6 });
  await sleep(4800);
  await f.ring('.cost-indicator', 'Monthly run rate · Azure retail prices', 6);
  await n3;
  await f.ring(null);
  await f.tag('');

  // ── 3. Validate ──────────────────────────────────────────────────────────────
  await f.cursor(true);
  const n4 = f.say('n04-validate', { wait: false, pad: 0.3 });
  await page.getByRole('button', { name: /^Validate Architecture/ }).first().evaluate((e) => e.setAttribute('data-v', 'vbtn'));
  await f.ring('[data-v="vbtn"]', 'Validate Architecture', 6);
  await sleep(2500);
  await f.ring(null);
  await n4;
  await validate(page.getByRole('button', { name: /^Validate Architecture/ }).first());
  await showNumbers();
  const before = await readResult();
  log('before', JSON.stringify(before));

  // ── 4. Score and pillars ─────────────────────────────────────────────────────
  const n5 = f.say('n05-score', { wait: false, pad: 0.4 });
  await center('.validation-score');
  await sleep(600);
  await f.ring('.score-summary', `Overall · ${before.score}/100 · ${before.band || 'assessment'}`, 8);
  await sleep(3800);
  if (await tagPillars()) {
    await center('[data-v="pillars"]');
    await sleep(900);
    const weak = [...before.pillars].filter((p) => p.score != null).sort((a, b) => a.score - b.score).slice(0, 2).map((p) => p.name);
    await f.ring('[data-v="pillars"]', weak.length ? `Five pillars · weakest: ${weak.join(' & ')}` : 'Scored on all five pillars', 8);
  }
  await n5;
  await sleep(600);
  await f.ring(null);

  // Scope note.
  await page.evaluate(() => document.querySelector('.validation-panel [class*="scroll"], .validation-panel')?.scrollTo?.({ top: 0, behavior: 'smooth' }));
  if (await tagText(['Scope:', 'greenfield'], 'scope')) {
    await center('[data-v="scope"]');
    await sleep(700);
    const n6 = f.say('n06-scope', { wait: false, pad: 0.4 });
    await f.ring('[data-v="scope"]', 'Design-time signal · not a runtime audit', 8);
    await n6;
    await f.ring(null);
  }

  // ── 5. A finding and Locate ──────────────────────────────────────────────────
  const items = page.locator('.findings-list > *');
  const count = await items.count();
  const cats = [];
  for (let i = 0; i < count; i++) {
    const it = items.nth(i);
    cats.push({ i, cat: (await it.locator('.finding-category').innerText().catch(() => '')).trim(), high: /\bHIGH\b/.test(await it.innerText().catch(() => '')) });
  }
  log('findings', cats.map((c) => `${c.cat}${c.high ? '*' : ''}`).join(' | '));
  const demo = cats.find((c) => PREF[0].test(c.cat)) || cats.find((c) => c.high) || cats[0];
  if (demo) {
    const it = items.nth(demo.i);
    await it.evaluate((e) => { e.setAttribute('data-v', 'finding'); e.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
    await sleep(900);
    const n7 = f.say('n07-finding', { wait: false, pad: 0.4 });
    await f.ring('[data-v="finding"]', `${demo.cat} · issue, recommendation, affected services`, 8);
    await sleep(5200);
    await f.ring(null);
    const loc = it.getByRole('button', { name: /Locate/ }).first();
    if (await loc.count()) {
      await f.cursor(true);
      await f.pointTo(loc, { click: true });
      await f.cursor(false);
      await f.tag(`Locate · ${demo.cat}`);
      await sleep(1200);
      const glow = await page.evaluate(() => {
        const g = [...document.querySelectorAll('.react-flow__node:not(.react-flow__node-groupNode)')]
          .filter((n) => /highlight|glow|locat|pinned|focus/i.test(n.className + ' ' + (n.firstElementChild?.className || '')));
        g.forEach((n, k) => n.setAttribute('data-v', `glow${k}`));
        return g.length;
      });
      log('glowing nodes', glow);
      await sleep(3000);
    }
    await n7;
    await f.tag('');
    // Clear the pinned highlight.
    if (await loc.count()) await loc.click().catch(() => {});
  }

  // ── 6. Select and apply ──────────────────────────────────────────────────────
  const picks = [];
  for (const r of PREF) {
    const c = cats.find((x) => r.test(x.cat) && x.high && !picks.includes(x)) || cats.find((x) => r.test(x.cat) && !picks.includes(x));
    if (c && picks.length < 3 && !/Isolation|Private/i.test(c.cat)) picks.push(c);
  }
  for (const c of cats) if (picks.length < 2 && c.high && !picks.includes(c) && !/API|Private|Isolation/i.test(c.cat)) picks.push(c);
  log('picks', picks.map((p) => p.cat).join(', '));
  const n8 = f.say('n08-select', { wait: false, pad: 0.3 });
  await f.cursor(true);
  for (const p of picks) {
    const it = items.nth(p.i);
    await it.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await sleep(700);
    await f.tag(`✓ ${p.cat}`);
    await f.pointTo(it.locator('.finding-checkbox'), { click: true });
    if (!(await it.locator('.finding-checkbox').isChecked().catch(() => true))) await it.locator('.finding-checkbox').check().catch(() => {});
    await sleep(700);
  }
  const applyBtn = page.getByRole('button', { name: /Apply \d+ Recommendation/ });
  await applyBtn.scrollIntoViewIfNeeded().catch(() => {});
  await f.tag('');
  await applyBtn.evaluate((e) => e.setAttribute('data-v', 'apply')).catch(() => {});
  await f.ring('[data-v="apply"]', `Apply ${picks.length} recommendations`, 6);
  await n8;
  await f.ring(null);
  // The engine hides AADB's "Make this layout yours" hint for clean shots; this episode features it.
  await page.evaluate(() => {
    localStorage.removeItem('azure-diagram-builder.layoutHintSeen.v1');
    const st = document.createElement('style');
    st.textContent = 'body .canvas-layout-hint { display: flex !important; }';
    document.head.appendChild(st);
  });
  await f.pointTo(applyBtn, { click: true });
  await f.cursor(false);
  await f.tag('Regenerating with the fixes · sped up');
  await f.say('n09-applying', { pad: 0.2 });
  await f.ff(async () => {
    await page.waitForFunction(() => /⏳ Applying recommendations/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => log('applying banner not seen'));
    try {
      await page.waitForFunction(() => !/⏳ Applying recommendations/.test(document.body.innerText), null, { timeout: 300000 });
    } catch (e) {
      await page.screenshot({ path: path.join(DIR, 'out', 'stuck-apply.png') });
      throw new Error('apply did not finish in 5 min');
    }
    await sleep(1500);
  }, { max: 6 });
  await f.tag('');
  const toast = await tagText(['regenerated', 'recommendations applied'], 'toast');
  log('toast', toast);
  await fitAll();
  f.reveal();
  if (toast) {
    await f.ring('[data-v="toast"]', 'What was added, and why', 6);
    await sleep(3500);
    await f.ring(null);
  }

  // ── 7. The improved design ───────────────────────────────────────────────────
  const hasFD = await tagNode(/Front Door/, 'fd');
  const hasSec = await tagNode(/Secondary|West US|Failover|DR /, 'sec', true);
  log('front door', hasFD, 'secondary group', hasSec);
  const n10 = f.say(hasFD && hasSec ? 'n10-result' : 'n10-result-b', { wait: false, pad: 0.5 });
  if (hasFD) {
    await f.ring('[data-v="fd"]', 'Azure Front Door + WAF · new', 14);
    await sleep(3600);
  }
  if (hasSec) {
    await f.ring('[data-v="sec"]', 'Secondary region · failover', 8);
    await sleep(3200);
  }
  await n10;
  await f.ring(null);
  const cost1 = await cost();
  log('cost after apply', cost1);
  const n11 = f.say('n11-cost', { wait: false, pad: 0.5 });
  await f.ring('.cost-indicator', `${cost0.replace(/\s+/g, ' ')} → ${cost1.replace(/\s+/g, ' ')}`, 6);
  await n11;
  await f.ring(null);

  // ── 8. Make it yours ─────────────────────────────────────────────────────────
  const hintSeen = await page.evaluate(() => {
    const h = document.querySelector('.canvas-layout-hint');
    const b = h?.getBoundingClientRect();
    if (!h || !b || b.width < 50 || b.height < 20) return false;
    h.setAttribute('data-v', 'hint');
    return true;
  });
  const hint = hintSeen;
  log('hint', hint);
  const n12 = f.say(hintSeen ? 'n12-yours' : 'n12-yours-b', { wait: false, pad: 0.5 });
  await f.tag('Make it yours');
  if (hint) {
    await f.ring('[data-v="hint"]', 'Make this layout yours', 6);
    await sleep(4200);
    await f.ring(null);
  }
  await f.cursor(true);
  const grp = await page.evaluate(() => {
    const gs = [...document.querySelectorAll('.react-flow__node-groupNode')].map((n) => ({ n, b: n.getBoundingClientRect() }))
      .filter(({ b }) => b.width > 40 && b.left > 140 && b.top > 300 && b.bottom < innerHeight - 60 && b.right < innerWidth - 160);
    const x = gs.sort((a, b) => a.b.width * a.b.height - b.b.width * b.b.height)[0];
    if (!x) return null;
    x.n.setAttribute('data-v', 'drag-group');
    return { x: x.b.left + Math.min(40, x.b.width / 3), y: x.b.top + 8, cx: x.b.left + x.b.width / 2 };
  });
  if (grp) {
    await f.ring('[data-v="drag-group"]', 'Drag groups and services anywhere', 8);
    await sleep(900);
    await f.ring(null);
    await f.drag(grp, grp.cx > 960 ? 160 : -120, -30);
  }
  await f.cursor(false);
  await n12;
  await page.locator('[data-v="hint"] button, [data-v="hint"] [aria-label*="ismiss"], [data-v="hint"] [aria-label*="lose"]').first().click({ timeout: 1500 }).catch(() => {});
  await f.tag('');

  // ── 9. Revalidate ────────────────────────────────────────────────────────────
  await f.cursor(true);
  const revalBtn = page.getByRole('button', { name: /Revalidate Needed/ }).first();
  const useReval = await revalBtn.isVisible().catch(() => false);
  await page.locator('.validation-panel').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  await f.say('n13-revalidate', { pad: 0.2 });
  if (useReval) {
    // "Revalidate Needed" reopens the previous results; the panel's Revalidate button runs a fresh review.
    await f.pointTo(revalBtn, { click: true });
    await page.locator('.validation-panel').waitFor({ timeout: 10000 });
    await sleep(900);
    const rb = page.locator('.validation-panel').getByRole('button', { name: /^Revalidate$/ }).first();
    await rb.evaluate((e) => e.setAttribute('data-v', 'reval')).catch(() => {});
    await f.ring('[data-v="reval"]', 'Run a fresh review', 6);
    await sleep(1500);
    await f.ring(null);
    await f.cursor(true);
    await validate(rb);
  } else {
    await validate(page.getByRole('button', { name: /^Validate Architecture/ }).first());
  }
  await showNumbers();
  const after = await readResult();
  log('after', JSON.stringify(after));
  await center('.validation-score');
  await sleep(600);
  await f.ring('.score-summary', `${before.score} → ${after.score} /100 · high-severity gaps ${before.high} → ${after.high}`, 8);
  await sleep(3500);
  if (await tagPillars()) {
    await center('[data-v="pillars"]');
    await sleep(900);
    await f.ring('[data-v="pillars"]', 'Pillar scores after the fixes', 8);
    await sleep(3500);
  }
  await f.ring(null);

  // ── 10. Before / after card ──────────────────────────────────────────────────
  const delta = before.pillars.map((p) => {
    const q = after.pillars.find((x) => x.name === p.name);
    return p.score != null && q?.score != null ? `<div class="chip">${p.name} &nbsp;${p.score} → <b>${q.score}</b></div>` : '';
  }).join('');
  const money = (s) => (s.match(/\$[\d,.]+/) || [''])[0];
  await f.card(`<div class="in eyebrow">Clinic Booking · before → after</div>
    <div class="stats in" style="animation-delay:.3s">
      <div class="stat"><b>${before.score} → ${after.score}</b><span>Score /100</span></div>
      <div class="stat"><b>${before.high} → ${after.high}</b><span>High-severity gaps</span></div>
      <div class="stat"><b style="font-size:72px;line-height:1.33">${money(cost0)} → ${money(cost1)}</b><span>Per month</span></div>
    </div>
    ${delta ? `<div class="chips in" style="animation-delay:1.2s">${delta}</div>` : ''}`);
  await sleep(500);
  await f.say('n14-compare', { pad: 1.2 });
  await f.card('');
  await sleep(500);

  // ── 11. Report ───────────────────────────────────────────────────────────────
  await f.cursor(true);
  const n15 = f.say('n15-report', { wait: false, pad: 0.5 });
  await f.pointTo(page.getByRole('button', { name: /Download Report/ }).first());
  await f.cursor(false);
  const file = await f.download(/Download Report/, 30000).catch((e) => { log('report', e.message); return null; });
  await f.tag(file ? `Saved · ${path.basename(file)}` : 'Download Report · Markdown');
  await page.getByRole('button', { name: /Download Report/ }).first().evaluate((e) => e.setAttribute('data-v', 'report')).catch(() => {});
  await f.ring('[data-v="report"]', 'Full findings report · Markdown', 6);
  await n15;
  await f.ring(null);
  await f.tag('');

  // ── 12. Close ────────────────────────────────────────────────────────────────
  await page.locator('.validation-panel button[aria-label*="lose"], .validation-panel .close-button').first().click({ timeout: 1500 }).catch(() => {});
  await sleep(600);
  await fitAll();
  await f.say('n16-close', { pad: 1.0 });
  await f.endCard();
});

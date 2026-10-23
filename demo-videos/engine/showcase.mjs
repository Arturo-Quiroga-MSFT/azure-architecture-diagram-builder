// Final reveal: clean focus view of the whole diagram, then a guided tour that zooms
// into each group so services are legible, then back out to the full picture.
export async function showcase(page, sleep, { onGroup } = {}) {
  await page.getByRole('button', { name: 'Dismiss layout guidance' }).click({ timeout: 1000 }).catch(() => {});
  await page.getByRole('button', { name: 'Close chat' }).click({ timeout: 2000 }).catch(() => {});
  await page.evaluate(() => document.body.classList.remove('rec-narrow'));
  await sleep(400);
  await page.getByRole('button', { name: 'Hide the toolbar' }).click({ timeout: 1000 }).catch(() => {});
  await sleep(400);
  await page.getByRole('button', { name: /^Focus/ }).first().click({ timeout: 2000 }).catch(() => {});
  await sleep(800);
  // Hide the canvas hint chip and title block so the diagram is the only thing on screen.
  await page.addStyleTag({ content: '.title-block, .canvas-title-block, [class*="titleBlock"], [class*="title-block"] { display: none !important; }' }).catch(() => {});
  await page.locator('button[aria-label*="Dismiss"], button[title*="Dismiss"]').first().click({ timeout: 1000 }).catch(() => {});
  const fit = () => page.locator('.react-flow__controls-fitview').click().catch(() => {});
  await fit();
  await sleep(4500);

  const viewport = () => page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport');
    const m = new DOMMatrixReadOnly(getComputedStyle(vp).transform);
    const pane = document.querySelector('.react-flow').getBoundingClientRect();
    return { x: m.e, y: m.f, k: m.a, pane: { l: pane.left, t: pane.top, w: pane.width, h: pane.height } };
  });
  const groups = await page.evaluate(() => [...document.querySelectorAll('.react-flow__node-groupNode')]
    .map((g) => { const b = g.getBoundingClientRect(); return { label: (g.innerText || '').split('\n')[0].trim(), l: b.left, t: b.top, w: b.width, h: b.height }; })
    .filter((g) => g.w > 0)
    .sort((a, b) => a.l - b.l || a.t - b.t));

  // Smoothly animate the React Flow viewport by dispatching wheel-free transforms via the
  // store isn't public, so drive it with zoom-at-cursor wheel steps and right-drag pans.
  const zoomTo = async (box, fill = 0.8) => {
    for (let i = 0; i < 30; i++) {
      const g = await page.evaluate(({ l, t, w, h, label }) => {
        const el = [...document.querySelectorAll('.react-flow__node-groupNode')].find((n) => (n.innerText || '').split('\n')[0].trim() === label);
        const b = (el || document.body).getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height };
      }, box);
      const v = await viewport();
      const area = { l: v.pane.l + 120, t: v.pane.t + 90, w: v.pane.w - 260, h: v.pane.h - 140 };
      const ratio = Math.max(g.w / area.w, g.h / area.h);
      const cx = g.l + g.w / 2, cy = g.t + g.h / 2;
      const tx = area.l + area.w / 2, ty = area.t + area.h / 2;
      const centered = Math.abs(cx - tx) < 30 && Math.abs(cy - ty) < 30;
      if (ratio > fill * 0.92 && ratio < fill * 1.08 && centered) return;
      if (!centered) {
        const dx = tx - cx, dy = ty - cy;
        // Start the right-drag on empty pane (not on a group/node) so React Flow pans.
        const start = await page.evaluate(({ a, dx, dy }) => {
          for (let y = a.t + 10; y < a.t + a.h; y += 30) {
            for (let x = a.l + 10; x < a.l + a.w; x += 30) {
              const el = document.elementFromPoint(x, y);
              const ex = x + dx, ey = y + dy;
              if (el && el.classList.contains('react-flow__pane')
                && ex > 0 && ey > 60 && ex < innerWidth && ey < innerHeight) return { x, y };
            }
          }
          return null;
        }, { a: area, dx, dy });
        if (!start) { await page.mouse.move(tx, ty); await page.mouse.wheel(0, 100); await sleep(140); continue; }
        const sx = start.x, sy = start.y;
        await page.mouse.move(sx, sy); await page.mouse.down({ button: 'right' });
        await page.mouse.move(sx + dx, sy + dy, { steps: 12 }); await page.mouse.up({ button: 'right' });
        await sleep(120);
        continue;
      }
      await page.mouse.move(tx, ty);
      await page.mouse.wheel(0, ratio < fill ? -100 : 100);
      await sleep(140);
    }
  };

  for (const g of groups) {
    if (onGroup) await onGroup(g.label);
    await zoomTo(g, 0.75);
    await sleep(3200);
  }
  if (onGroup) await onGroup('');
  await fit();
  await sleep(4000);
  return groups.map((g) => g.label);
}

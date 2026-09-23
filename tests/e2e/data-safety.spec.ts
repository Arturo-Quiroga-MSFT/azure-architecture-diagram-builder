import { expect, test } from '@playwright/test';
import { generateDeterministicDiagram } from './fixtures';

/**
 * Fences for the two v2.0.4 fixes, both of which shipped without a regression
 * test. Either could silently return and the rest of the gate would stay green.
 *
 * The underlying report: right-click on the canvas, let go, and the whole
 * diagram disappeared. The canvas hint teaches "Right-click + drag to pan", but
 * the native browser menu was only suppressed on the pane and on edges, so
 * right-clicking a node or group opened Chrome's own menu, whose top entries are
 * Back, Forward and Reload. Nothing was persisted, so the resulting navigation
 * discarded everything.
 */

/**
 * Records the ancestor chain, not just a derived label. A first attempt at this
 * check in production reported a false failure because the clicks never landed
 * on a node and one "empty pane" click actually hit a button in the nav-hint
 * overlay, where a native menu is correct.
 */
async function rightClickAndReportSuppression(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<{ prevented: boolean; chain: string[] }> {
  await page.evaluate(() => {
    (window as unknown as { __ctx: unknown[] }).__ctx = [];
    (window as unknown as { __ctxHandler: EventListener }).__ctxHandler = ((event: MouseEvent) => {
      const chain: string[] = [];
      let el: Element | null = event.target as Element;
      while (el && el !== document.body && chain.length < 8) {
        const cls = String((el.className as unknown as SVGAnimatedString)?.baseVal ?? el.className ?? '');
        chain.push(`${el.tagName}.${cls.split(' ').slice(0, 2).join('.')}`);
        el = el.parentElement;
      }
      (window as unknown as { __ctx: unknown[] }).__ctx.push({ prevented: event.defaultPrevented, chain });
    }) as EventListener;
    document.addEventListener('contextmenu', (window as unknown as { __ctxHandler: EventListener }).__ctxHandler);
  });

  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} must be visible to right-click`).not.toBeNull();
  await page.mouse.move(box!.x + Math.min(20, box!.width / 2), box!.y + Math.min(10, box!.height / 2));
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });

  const recorded = await page.evaluate(() => {
    document.removeEventListener('contextmenu', (window as unknown as { __ctxHandler: EventListener }).__ctxHandler);
    return (window as unknown as { __ctx: { prevented: boolean; chain: string[] }[] }).__ctx;
  });
  expect(recorded.length, 'a contextmenu event must have fired').toBeGreaterThan(0);
  return recorded[0];
}

test('right-clicking the canvas never opens the browser menu that discards the diagram', async ({ page }) => {
  await generateDeterministicDiagram(page);

  const group = await rightClickAndReportSuppression(page, '.react-flow__node-groupNode');
  expect(group.chain.join(' > ')).toContain('react-flow__node');
  expect(group.prevented, `group right-click was not suppressed: ${group.chain.join(' > ')}`).toBe(true);

  const node = await rightClickAndReportSuppression(page, '.react-flow__node-azureNode');
  expect(node.chain.join(' > ')).toContain('react-flow__node');
  expect(node.prevented, `node right-click was not suppressed: ${node.chain.join(' > ')}`).toBe(true);

  const pane = await rightClickAndReportSuppression(page, '.react-flow__pane');
  expect(pane.prevented, `pane right-click was not suppressed: ${pane.chain.join(' > ')}`).toBe(true);

  // The one context menu the app owns must still work.
  const edgeBox = await page.locator('.react-flow__edge').first().boundingBox();
  await page.mouse.move(edgeBox!.x + edgeBox!.width / 2, edgeBox!.y + edgeBox!.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect(page.getByRole('button', { name: 'One-way (Forward)' })).toBeVisible();
});

test('an accidental reload does not lose the diagram', async ({ page }) => {
  await generateDeterministicDiagram(page);

  // Autosave is debounced; the wait is the debounce, not a race workaround.
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Reloading still yields a clean canvas: restore is offered, never forced.
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  const banner = page.locator('.canvas-restore-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Export Artifact Architecture');

  await page.locator('.canvas-restore-banner-primary').click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'App Service' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL Database' })).toHaveCount(1);
  await expect(banner).toBeHidden();
});

test('deliberately clearing the diagram is not undone by a reload', async ({ page }) => {
  await generateDeterministicDiagram(page);
  await page.waitForTimeout(1500);

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('button[title="Clear diagram and start fresh"]').click();
  await expect(page.locator('.react-flow__node')).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.react-flow__node')).toHaveCount(0);
  // Offering back a diagram the user deliberately discarded would be worse than
  // not autosaving at all.
  await expect(page.locator('.canvas-restore-banner')).toBeHidden();
});

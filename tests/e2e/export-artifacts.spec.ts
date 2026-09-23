import { expect, test } from '@playwright/test';
import { captureExportBlobs, generateDeterministicDiagram } from './fixtures';

/**
 * Exported artifacts are the product. Everything else in the gate checks the
 * engine that builds them, which is why v2.0.1 shipped exports that were blank
 * files while the whole suite stayed green: the canvas is captured from the DOM,
 * and on any non-canvas view it is present but transparent, so a correct capture
 * of an invisible element produced an empty artifact.
 *
 * These tests drive the real Reports pane, intercept the exact Blob handed to
 * the download, and inspect its bytes. Asserting a download merely fired would
 * have passed against the blank files.
 */

/** Exports live on the Reports pane, which is exactly where the canvas is hidden. */
async function runExportFromReportsPane(
  page: import('@playwright/test').Page,
  cardLabel: string,
  expectedFilePattern: RegExp,
): Promise<void> {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.locator('.canvas-container')).toHaveClass(/is-hidden/);

  const download = page.waitForEvent('download');
  await page.locator('.reports-card').filter({ hasText: cardLabel }).first().click();
  expect((await download).suggestedFilename()).toMatch(expectedFilePattern);

  // The capture must leave the user where they were.
  await expect(page.locator('.canvas-container')).toHaveClass(/is-hidden/);
}

test('exported PNG contains the rendered diagram, not a blank canvas', async ({ page }) => {
  await captureExportBlobs(page);
  await generateDeterministicDiagram(page);
  await runExportFromReportsPane(page, 'Export PNG', /\.png$/);

  const png = await page.evaluate(async () => {
    const blobs = (window as unknown as { __exportBlobs: Blob[] }).__exportBlobs
      .filter((b) => b.type === 'image/png');
    const blob = blobs[blobs.length - 1];
    if (!blob) return null;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    // Sample on a prime stride so a repeating pattern cannot alias to one colour.
    const colours = new Set<string>();
    for (let i = 0; i < data.length; i += 4 * 97) colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return { width: bitmap.width, height: bitmap.height, bytes: blob.size, distinctColours: colours.size };
  });

  expect(png).not.toBeNull();
  expect(png!.width).toBeGreaterThan(0);
  expect(png!.height).toBeGreaterThan(0);
  // A blank export is a single flat fill. Real node icons, labels and edges push
  // this into the hundreds; the threshold is deliberately far below that.
  expect(png!.distinctColours).toBeGreaterThan(20);
  expect(png!.bytes).toBeGreaterThan(10_000);
});

test('exported SVG contains the rendered diagram, not a hidden canvas', async ({ page }) => {
  await captureExportBlobs(page);
  await generateDeterministicDiagram(page);
  await runExportFromReportsPane(page, 'Export SVG', /\.svg$/);

  const svg = await page.evaluate(async () => {
    const blobs = (window as unknown as { __exportBlobs: Blob[] }).__exportBlobs
      .filter((b) => b.type.includes('svg'));
    const blob = blobs[blobs.length - 1];
    if (!blob) return null;
    const text = await blob.text();
    return {
      bytes: blob.size,
      hasAppService: text.includes('App Service'),
      hasSqlDatabase: text.includes('SQL Database'),
      // The exact fingerprints of the v2.0.1 blank exports.
      serialisedHiddenClass: text.includes('is-hidden'),
      serialisedZeroOpacity: /opacity:\s*0[;"]/.test(text),
    };
  });

  expect(svg).not.toBeNull();
  expect(svg!.hasAppService).toBe(true);
  expect(svg!.hasSqlDatabase).toBe(true);
  expect(svg!.serialisedHiddenClass).toBe(false);
  expect(svg!.serialisedZeroOpacity).toBe(false);
  expect(svg!.bytes).toBeGreaterThan(10_000);
});

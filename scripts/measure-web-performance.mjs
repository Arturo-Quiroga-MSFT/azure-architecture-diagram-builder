import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('Usage: npm run measure:performance -- <url>');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });

  await page.addInitScript(() => {
    window.__aadbVitals = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__aadbVitals.lcp = last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__aadbVitals.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.locator('.app-version').waitFor();

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map((entry) => [entry.name, Math.round(entry.startTime)]),
    );
    const resources = performance.getEntriesByType('resource');
    const javascript = resources.filter((entry) => entry.name.includes('/assets/') && entry.name.endsWith('.js'));
    return {
      version: document.querySelector('.app-version')?.textContent,
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      loadMs: Math.round(navigation.loadEventEnd),
      firstContentfulPaintMs: paints['first-contentful-paint'] ?? null,
      largestContentfulPaintMs: Math.round(window.__aadbVitals?.lcp || 0),
      cumulativeLayoutShift: Number((window.__aadbVitals?.cls || 0).toFixed(4)),
      initialJsRequests: javascript.length,
      initialJsTransferBytes: javascript.reduce((sum, entry) => sum + entry.transferSize, 0),
      initialJsDecodedBytes: javascript.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
    };
  });

  console.log(JSON.stringify({ url, ...metrics }, null, 2));
} finally {
  await browser.close();
}
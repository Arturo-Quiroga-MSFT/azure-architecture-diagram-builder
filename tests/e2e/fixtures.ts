import { expect, type Page } from '@playwright/test';

/** Shared by the export-artifact and data-safety suites. */
export const twoServiceArchitecture = {
  architectureName: 'Export Artifact Architecture',
  groups: [
    { id: 'application', label: 'Application' },
    { id: 'data', label: 'Data' },
  ],
  services: [
    {
      id: 'web-app',
      name: 'App Service',
      type: 'App Service',
      category: 'app services',
      description: 'Hosts the web application',
      groupId: 'application',
    },
    {
      id: 'database',
      name: 'SQL Database',
      type: 'SQL Database',
      category: 'databases',
      description: 'Stores application data',
      groupId: 'data',
    },
  ],
  connections: [
    { from: 'web-app', to: 'database', label: 'Read and write application data', type: 'sync' },
  ],
  workflow: [
    { step: 1, description: 'The web application receives a request.', services: ['web-app'] },
    { step: 2, description: 'The application reads or writes data.', services: ['web-app', 'database'] },
  ],
};

/**
 * The app revokes each object URL immediately after clicking the download, so a
 * URL captured here would be dead by assertion time. Keeping the Blob itself
 * alive is what makes the bytes readable afterwards.
 */
export async function captureExportBlobs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __exportBlobs: Blob[] }).__exportBlobs = [];
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob) (window as unknown as { __exportBlobs: Blob[] }).__exportBlobs.push(obj);
      return original(obj);
    };
  });
}

export async function mockModel(page: Page): Promise<void> {
  await page.route('**/api/openai', async (route) => {
    const request = route.request().postDataJSON();
    if (request.apiFormat === 'chat-completions') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: '[]' } }] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'smoke-gpt-5-6-luna',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(twoServiceArchitecture) }] }],
        usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
      }),
    });
  });
}

/**
 * Leaves the app on the canvas with a rendered two-service diagram.
 *
 * Deliberately does not clear storage through addInitScript: that runs on every
 * navigation, so it would wipe the autosaved draft during a reload the test is
 * trying to survive. Playwright gives each test a fresh browser context, so
 * storage is already isolated.
 */
export async function generateDeterministicDiagram(page: Page): Promise<void> {
  await mockModel(page);

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('button.btn-generate-ai').first().click();
  await page.locator('#architecture-description').fill('A web app backed by Azure SQL Database.');
  await page.getByRole('button', { name: 'Generate Architecture' }).click();
  await page.getByRole('button', { name: 'Review on Canvas' }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'App Service' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL Database' })).toHaveCount(1);
}

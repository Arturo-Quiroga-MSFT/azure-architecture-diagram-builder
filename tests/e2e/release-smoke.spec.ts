import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

const architecture = {
  architectureName: 'Release Smoke Architecture',
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

const geoReplicationWithUnrequestedRedis = {
  architectureName: 'Release Smoke Architecture',
  groups: architecture.groups,
  services: [
    ...architecture.services,
    {
      id: 'database-secondary',
      name: 'SQL Database',
      type: 'SQL Database',
      category: 'databases',
      description: 'Geo-replicated secondary database',
      groupId: 'data',
    },
    {
      id: 'redis',
      name: 'Azure Cache for Redis',
      type: 'Azure Cache for Redis',
      category: 'databases',
      description: 'Caches application reads',
      groupId: 'data',
    },
  ],
  connections: [
    ...architecture.connections,
    { from: 'database', to: 'database-secondary', label: 'Geo-replicate application data', type: 'async' },
    { from: 'web-app', to: 'redis', label: 'Cache application reads', type: 'sync' },
  ],
  workflow: [
    ...architecture.workflow,
    { step: 3, description: 'The primary database replicates data.', services: ['database', 'database-secondary'] },
    { step: 4, description: 'The application caches reads.', services: ['web-app', 'redis'] },
  ],
};

test('release-critical workflow renders a deterministic architecture', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  let proxyCalls = 0;
  await page.route('**/api/openai', async (route) => {
    const request = route.request().postDataJSON();
    expect(route.request().headers()['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    if (request.apiFormat === 'chat-completions') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: '[]' } }] }),
      });
      return;
    }

    proxyCalls += 1;
    expect(request.apiFormat).toBe('responses');
    expect(request.deployment).toBe('smoke-gpt-5-6-luna');
    expect(request.body.model).toBe('smoke-gpt-5-6-luna');

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'smoke-gpt-5-6-luna',
        output: [
          {
            type: 'message',
            content: [{
              type: 'output_text',
              text: JSON.stringify(proxyCalls === 1 ? architecture : geoReplicationWithUnrequestedRedis),
            }],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
      }),
    });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('.header-brand h1')).toHaveText('Azure Architecture Diagram Builder');
  await expect(page.locator('.app-version')).toHaveText(`v${version}`);
  await expect.poll(async () => (await page.request.get('/version.json')).json()).toEqual({ version });

  await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByRole('dialog', { name: 'Help and Learn' })).toBeVisible();
  await page.getByRole('button', { name: 'Close help' }).click();

  await page.locator('button.btn-generate-ai').first().click();
  await expect(page.getByRole('heading', { name: 'Generate Diagram' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Select AI model' })).toHaveValue('gpt-5.6-luna');
  await page.locator('#architecture-description').fill('Create a web app backed by Azure SQL.');
  await page.getByRole('button', { name: 'Generate Architecture' }).click();

  await expect(page.getByRole('heading', { name: 'Diagram created — review it before validation' })).toBeVisible();
  expect(proxyCalls).toBe(1);
  await page.getByRole('button', { name: 'Review on Canvas' }).click();

  await expect(page.locator('.react-flow__node').filter({ hasText: 'App Service' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL Database' })).toHaveCount(1);
  await expect(page.locator('.workflow-panel')).toContainText('2 steps');
  await expect(page.getByRole('button', { name: 'Validate Architecture' })).toBeEnabled();
  const layoutHint = page.getByRole('note', { name: 'Diagram layout guidance' });
  await expect(layoutHint).toContainText('Make this layout yours');
  await expect(layoutHint).toContainText('Drag services and groups into the positions that best communicate your architecture.');
  await page.getByRole('button', { name: 'Dismiss layout guidance' }).click();
  await expect(layoutHint).toBeHidden();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('azure-diagram-builder.layoutHintSeen.v1'))).toBe('1');

  const elkChunk = page.waitForResponse((response) =>
    response.url().includes('/assets/elkLayoutEngine-') && response.ok(),
  );
  await page.getByRole('button', { name: 'Layout' }).click();
  await page.locator('#layoutEngine').selectOption('elk');
  await page.getByRole('menuitem', { name: 'Apply Layout' }).click();
  await elkChunk;
  await expect(page.locator('.react-flow__node').filter({ hasText: 'App Service' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const htmlDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export Interactive HTML' }).click();
  await expect.poll(async () => (await htmlDownload).suggestedFilename()).toMatch(/\.html$/);

  await page.getByRole('button', { name: 'Guided Chat', exact: true }).click();
  const chatInput = page.locator('.arch-chat-input');
  await chatInput.fill('Enable Azure SQL geo-replication');
  await page.getByRole('button', { name: 'Send' }).click();

  const reviewDialog = page.getByRole('dialog', { name: 'Review extra services' });
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog).toContainText('Azure Cache for Redis');
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Azure Cache for Redis' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Keep current architecture' }).click();
  await expect(reviewDialog).toBeHidden();
  await expect(page.locator('.arch-chat-bubble').filter({ hasText: 'No changes applied.' })).toBeVisible();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL Database' })).toHaveCount(1);

  await chatInput.fill('Enable Azure SQL geo-replication');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(reviewDialog).toBeVisible();
  await page.getByRole('button', { name: 'Apply requested changes only' }).click();
  await expect(reviewDialog).toBeHidden();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL Database' })).toHaveCount(2);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Azure Cache for Redis' })).toHaveCount(0);
  await expect(page.locator('.arch-chat-bubble').filter({ hasText: 'Added SQL Database' })).toBeVisible();
  await expect(page.locator('.arch-chat-bubble').filter({ hasText: 'Connections:' })).toBeVisible();

  await chatInput.fill('Enable Azure SQL geo-replication');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(reviewDialog).toBeVisible();
  await page.getByRole('button', { name: 'Apply all changes' }).click();
  await expect(reviewDialog).toBeHidden();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'Azure Cache for Redis' })).toHaveCount(1);
  await expect(page.locator('.arch-chat-bubble').filter({ hasText: 'AI-proposed; approved by you' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('root error boundary contains render failures', async ({ page }) => {
  await page.goto('/?error-boundary-test', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('alert')).toContainText('Something interrupted the workspace');
  await expect(page.getByRole('button', { name: 'Reload application' })).toBeVisible();
  await expect(page.locator('.react-flow')).toHaveCount(0);
});
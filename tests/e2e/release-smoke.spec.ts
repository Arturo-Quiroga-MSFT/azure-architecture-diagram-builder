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

test('release-critical workflow renders a deterministic architecture', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  let proxyCalls = 0;
  await page.route('**/api/openai', async (route) => {
    proxyCalls += 1;
    const request = route.request().postDataJSON();
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
            content: [{ type: 'output_text', text: JSON.stringify(architecture) }],
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
  await page.getByRole('combobox', { name: 'Select AI model' }).selectOption('gpt-5.6-luna');
  await page.locator('#architecture-description').fill('Create a web app backed by Azure SQL.');
  await page.getByRole('button', { name: 'Generate Architecture' }).click();

  await expect(page.getByRole('heading', { name: 'Diagram created — review it before validation' })).toBeVisible();
  expect(proxyCalls).toBe(1);
  await page.getByRole('button', { name: 'Review on Canvas' }).click();

  await expect(page.locator('.react-flow__node').filter({ hasText: 'App Service' })).toHaveCount(1);
  await expect(page.locator('.react-flow__node').filter({ hasText: 'SQL Database' })).toHaveCount(1);
  await expect(page.locator('.workflow-panel')).toContainText('2 steps');
  await expect(page.getByRole('button', { name: 'Validate Architecture' })).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
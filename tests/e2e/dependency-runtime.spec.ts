import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const architecture = {
  architectureName: 'Dependency Runtime Architecture',
  groups: [{ id: 'app', label: 'Application' }],
  services: [{ id: 'web', name: 'App Service', type: 'App Service', category: 'app services', description: 'Hosts the app', groupId: 'app' }],
  connections: [],
  workflow: [{ step: 1, description: 'The app receives a request.', services: ['web'] }],
};

test.skip(!process.env.VITE_APPINSIGHTS_CONNECTION_STRING, 'Runs through npm run test:dependency-runtime');

test('upgraded telemetry, Speech Avatar, and PPTX dependencies work at browser boundaries', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleMessages: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => consoleMessages.push(message.text()));

  await page.route('https://telemetry.invalid/**', route => route.fulfill({ status: 200, body: '' }));
  await page.route('**/api/openai', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      model: 'smoke-gpt-5-6-luna',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(architecture) }] }],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    }),
  }));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => consoleMessages.some(message => message.includes('Application Insights initialized'))).toBe(true);

  await page.locator('button.btn-generate-ai').first().click();
  await page.locator('#architecture-description').fill('Create one App Service with a one-step workflow.');
  await page.getByRole('button', { name: 'Generate Architecture' }).click();
  await page.getByRole('button', { name: 'Review on Canvas' }).click();
  await expect(page.locator('.react-flow__node').filter({ hasText: 'App Service' })).toHaveCount(1);

  await page.locator('.workflow-header').click();
  const speechChunk = page.waitForResponse(response => response.url().includes('microsoft.cognitiveservices.speech.sdk-') && response.ok());
  await page.locator('.workflow-narrate-btn').hover();
  await speechChunk;

  await page.getByRole('button', { name: 'Reports' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.reports-card').filter({ hasText: 'Export PPTX Slide' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const zip = await JSZip.loadAsync(await readFile(downloadPath!));
  expect(zip.file('[Content_Types].xml')).not.toBeNull();
  expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
  expect(Object.keys(zip.files).some(name => /^ppt\/media\/.*\.png$/i.test(name))).toBe(true);
  const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  expect(slideXml).toContain('Dependency Runtime Architecture');
  expect(pageErrors).toEqual([]);
});

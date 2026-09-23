/**
 * demo-recording.mjs
 * ==================
 * Records a 30–60 second Playwright demo of the Azure Architecture Diagram Builder.
 *
 * Prerequisites:
 *   1. Dev server running:  npm run dev:avatar   (Vite on :5173 + token server on :3001)
 *   2. ffmpeg installed:    brew install ffmpeg
 *
 * Usage:
 *   node scripts/demo-recording.mjs
 *
 * Output:
 *   demo-output/demo-raw.webm   — raw Playwright recording
 *   demo-output/demo.mp4        — final H.264 MP4 (trimmed + scaled to 1280×720)
 *
 * What the script does (≈ 50 sec at normal speed):
 *   0s  — App loads, hero view
 *   3s  — Click "Generate Architecture" button
 *   5s  — Type the demo prompt
 *   8s  — Submit generation, wait for diagram (~15–25s depending on model)
 *   ~30s — Pan over the diagram: icons, cost badges, connections
 *   ~35s — Scroll down to reveal the Architecture Workflow panel, click Narrate
 *   ~40s — Avatar connects and narrates (let it run ~15s)
 *   ~55s — End recording
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'demo-output');
const APP_URL = 'http://localhost:3000';

// Prompt to use for diagram generation — concise enough for a fast response
const DEMO_PROMPT =
  'E-commerce web app: React frontend on Azure Static Web Apps, ' +
  'Azure API Management, Function Apps backend, Cosmos DB, Redis Cache, ' +
  'Azure CDN, App Insights monitoring, and Key Vault for secrets.';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function smoothScroll(page, deltaY, steps = 8) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, deltaY / steps);
    await wait(60);
  }
}

async function typeSlowly(locator, text, delay = 28) {
  await locator.click();
  await locator.fill('');
  for (const ch of text) {
    await locator.pressSequentially(ch, { delay });
  }
}

(async () => {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('🎬  Starting Playwright browser with video recording…');

  const browser = await chromium.launch({
    headless: false,          // visible window so the recording looks real
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1280, height: 720 },
    },
    // Allow microphone/camera so the avatar WebRTC session isn't blocked
    permissions: ['camera', 'microphone'],
  });

  const page = await context.newPage();

  // ── 1. Load the app ──────────────────────────────────────────────────────────
  console.log('🌐  Loading app…');
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30_000 });
  await wait(2500);   // let the UI settle / animate in

  // ── 2. Open the AI generator modal ──────────────────────────────────────────
  console.log('🖱️   Opening AI Architecture Generator…');
  // The toolbar button text varies; try common selectors
  const genBtn = page.locator('button.btn-generate-ai').first();
  await genBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await wait(2000);   // let any entrance animations finish
  await genBtn.click({ force: true });
  await wait(800);

  // ── 3. Type the demo prompt ──────────────────────────────────────────────────
  console.log('⌨️   Typing demo prompt…');
  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 8_000 });
  await typeSlowly(textarea, DEMO_PROMPT);
  await wait(800);

  // ── 4. Submit generation ─────────────────────────────────────────────────────
  console.log('🚀  Submitting generation — waiting for diagram…');
  const submitBtn = page.locator('button.btn-primary.btn-generate-ai');
  await submitBtn.waitFor({ state: 'visible', timeout: 8_000 });
  await submitBtn.click();

  // Wait for the modal to close (diagram rendered) — up to 60 s
  await page.locator('.react-flow__node').first().waitFor({ state: 'visible', timeout: 60_000 });
  await wait(2000);   // let the diagram fully settle

  // ── 5. Pan across the diagram ────────────────────────────────────────────────
  console.log('🗺️   Panning the diagram…');
  const canvas = page.locator('.react-flow__renderer');
  const box = await canvas.boundingBox();
  if (box) {
    // Slowly drag from right to left to reveal nodes
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(box.x + box.width * 0.7 - i * 8, box.y + box.height * 0.5);
      await wait(50);
    }
    await page.mouse.up();
    await wait(1500);
    // Pan back
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(box.x + box.width * 0.3 + i * 8, box.y + box.height * 0.5);
      await wait(50);
    }
    await page.mouse.up();
    await wait(1000);
  }

  // ── 6. Expand the Workflow Panel if collapsed ────────────────────────────────
  console.log('📋  Opening Workflow panel…');
  const workflowPanel = page.locator('.workflow-panel').first();
  const isExpanded = await workflowPanel.evaluate(el => el.classList.contains('expanded'));
  if (!isExpanded) {
    await page.locator('.workflow-header').first().click();
    await wait(600);
  }

  // ── 7. Click the Narrate button ──────────────────────────────────────────────
  console.log('🎙️   Clicking Narrate…');
  const narrateBtn = page.locator('.workflow-narrate-btn').first();
  try {
    await narrateBtn.waitFor({ state: 'visible', timeout: 6_000 });
    await narrateBtn.click();
    console.log('⏳  Waiting for avatar to connect (up to 30s)…');
    // Wait for avatar panel to appear (status != idle)
    await page.locator('.workflow-avatar-panel').waitFor({ state: 'visible', timeout: 30_000 });
    console.log('🗣️   Avatar connected — recording narration for 18s…');
    await wait(18_000);
  } catch {
    console.warn('⚠️   Narrate button not found or avatar unavailable — VITE_SPEECH_REGION may not be set locally.');
    console.log('⏸️   Holding on the diagram for 6s instead…');
    await wait(6_000);
  }

  // ── 8. End recording ─────────────────────────────────────────────────────────
  console.log('🛑  Closing browser — saving WebM…');
  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (!videoPath) {
    console.error('❌  No video file produced. Check Playwright recordVideo config.');
    process.exit(1);
  }

  // ── 9. Convert WebM → MP4 via ffmpeg ─────────────────────────────────────────
  const mp4Path = join(OUT_DIR, 'demo.mp4');
  console.log(`\n🎞️   Converting WebM → MP4…\n    ${videoPath}\n    → ${mp4Path}`);
  execSync(
    `ffmpeg -y -i "${videoPath}" ` +
    `-vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" ` +
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p ` +
    `-movflags +faststart "${mp4Path}"`,
    { stdio: 'inherit' }
  );

  console.log(`\n✅  Done!  →  ${mp4Path}`);
  console.log('    Share this file directly or upload to LinkedIn / OneDrive.');
})();

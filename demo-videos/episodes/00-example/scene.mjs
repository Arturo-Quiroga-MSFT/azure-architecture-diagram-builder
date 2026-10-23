// Example episode: a 25-second template and smoke test for the toolkit (no AI calls).
// Run: engine/run.sh episodes/00-example
import { film } from '../../engine/film.mjs';

await film(import.meta.url, async (f) => {
  const { page, sleep } = f;

  // Title card with narration.
  await f.opener({ title: 'Demo video <span class="g">toolkit</span>', sub: 'Recorded live · narrated · captioned', narr: 'n01-open' });

  // The live app, with a tag, a highlight ring and a visible cursor.
  await f.card('');
  await sleep(800);
  f.reveal();
  const n2 = f.say('n02-app', { wait: false, pad: 0.4 });
  await f.tag('The live app');
  const btn = page.getByRole('button', { name: /Generate/ }).first();
  await btn.evaluate((e) => e.setAttribute('data-v', 'gen')).catch(() => {});
  await f.cursor(true);
  await f.ring('[data-v="gen"]', 'Rings point at what the narration describes', 6);
  await f.pointTo('[data-v="gen"]');
  await n2;
  await f.ring(null);
  await f.cursor(false);
  await f.tag('');

  // End card.
  await f.say('n03-close', { pad: 0.6 });
  await f.endCard();
});

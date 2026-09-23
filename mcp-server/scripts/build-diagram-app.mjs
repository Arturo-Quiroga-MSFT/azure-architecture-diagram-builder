import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const result = await build({
  entryPoints: [resolve(root, 'src/diagramAppClient.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  write: false,
});

const template = await readFile(resolve(root, 'src/diagramApp.html'), 'utf8');
const script = result.outputFiles[0].text.replace(/<(?=\/?script)/gi, '\\x3c');
const html = template.replace('/* DIAGRAM_APP_SCRIPT */', () => script);

await writeFile(resolve(root, 'dist/diagramApp.html'), html);
console.log(`[build-diagram-app] wrote dist/diagramApp.html (${Buffer.byteLength(html)} bytes)`);
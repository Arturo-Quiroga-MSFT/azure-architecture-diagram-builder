// Run with: npm run test:drawio-export (bundled by esbuild so import.meta.env resolves).
import assert from 'node:assert/strict';
import type { Node, Edge } from 'reactflow';

// Icons are fetched and embedded; serve a tiny SVG for any path.
globalThis.fetch = (async () => new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18"/>')) as typeof fetch;
// The model-settings store warns about localStorage when loaded outside a browser.
console.log = () => {};
console.error = () => {};
console.warn = () => {};
const { exportToDrawio } = await import('../src/services/drawioExporter');

const nodes = [
  { id: 'g1', type: 'groupNode', position: { x: 100, y: 200 }, data: { label: 'Ingress' } },
  { id: 'app', type: 'azureNode', parentNode: 'g1', position: { x: 40, y: 60 }, data: { label: 'App Service', iconPath: '/Icons/web/app.svg' } },
  { id: 'kv', type: 'azureNode', position: { x: 600, y: 300 }, data: { label: 'Key Vault', iconPath: '/Icons/security/kv.svg' } },
] as unknown as Node[];
const edges = [{ id: 'e1', source: 'app', target: 'kv', label: 'Read secrets' }] as unknown as Edge[];

const xml = await exportToDrawio(nodes, edges, 'Test');
const cells = [...xml.matchAll(/<mxCell id="([^"]+)" value="([^"]*)" style="([^"]*)"([^>]*)>\s*(?:<mxGeometry x="([-\d.]+)" y="([-\d.]+)")?/g)]
  .map((m) => ({ id: m[1], value: m[2], style: m[3], attrs: m[4], x: m[5], y: m[6] }));
const byLabel = (l: string) => cells.find((c) => c.value.startsWith(l))!;
const parentOf = (c: { attrs: string }) => /parent="([^"]+)"/.exec(c.attrs)?.[1];
const icons = cells.filter((c) => c.style.startsWith('shape=image'));

// Each icon is a child of its service card, so moving the card in draw.io moves the icon.
assert.equal(icons.length, 2);
const app = byLabel('App Service');
const kv = byLabel('Key Vault');
assert.deepEqual(icons.map(parentOf).sort(), [app.id, kv.id].sort());
for (const icon of icons) {
  // Centered at the top of the 140-wide card, in coordinates relative to it.
  assert.equal(icon.x, '46');
  assert.equal(icon.y, '8');
  assert.match(icon.attrs, /connectable="0"/);
}

// Cards keep their group parent; parents are written before their children.
assert.equal(parentOf(app), byLabel('Ingress').id);
assert.equal(parentOf(kv), '1');
const order = cells.map((c) => c.id);
for (const icon of icons) assert.ok(order.indexOf(parentOf(icon)!) < order.indexOf(icon.id));

// The connector still joins the two cards, not their icons.
assert.match(xml, new RegExp(`source="${app.id}" target="${kv.id}"`));

process.stdout.write('drawio export tests passed\n');

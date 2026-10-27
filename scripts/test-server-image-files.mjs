// The Dockerfile copies the token server's files one by one. A new module that
// token-server.js requires but the Dockerfile doesn't copy passes every local
// test and crashes the container at startup ("Cannot find module"). This check
// fails the release gate instead.
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('Dockerfile', 'utf8');
const copied = new Set();
for (const line of dockerfile.split('\n')) {
  const m = line.match(/^COPY\s+(?!--from)(.+)\s+\.\/\s*$/);
  if (!m) continue;
  for (const src of m[1].trim().split(/\s+/)) {
    const f = src.match(/^server\/([^/*]+\.js)$/);
    if (f) copied.add(f[1]);
  }
}
// Optional modules the image removes on purpose when their feature is off.
const optional = new Set(['impact-routes.js', 'impact-records.js']);

const missing = [];
const seen = new Set();
const visit = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  const src = readFileSync(`server/${file}`, 'utf8');
  for (const m of src.matchAll(/require\(\s*['"]\.\/([^'"]+?)(?:\.js)?['"]\s*\)/g)) {
    const dep = `${m[1]}.js`;
    if (!copied.has(dep)) missing.push(`${file} requires ./${m[1]}, but the Dockerfile does not copy server/${dep}`);
    else if (!optional.has(dep)) visit(dep);
  }
};
visit('token-server.js');

if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}
console.log(`Server image files check passed (${copied.size} server files copied).`);

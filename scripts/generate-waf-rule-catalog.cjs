#!/usr/bin/env node
// Generate a markdown rule catalog from src/data/wafRules.ts
// Strips TS types and evals the exported arrays.

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../src/data/wafRules.ts');
const OUT = path.resolve(__dirname, '../blog-post/post-2-waf-validation/waf-rule-catalog.md');

let src = fs.readFileSync(SRC, 'utf8');

// Strip TS-only constructs so we can eval as JS.
src = src
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/^\s*export\s+(type|interface)\s+[\s\S]*?^}/gm, '')
  .replace(/^\s*export\s+type\s+.*?;$/gm, '')
  .replace(/:\s*WafRule\[\]/g, '')
  // Drop everything from ALL_WAF_RULES onward — we only need the two source arrays.
  .replace(/export\s+const\s+ALL_WAF_RULES[\s\S]*$/, '')
  .replace(/^export\s+/gm, '');

// Append serialization
src += `
console.log(JSON.stringify({
  pattern: ARCHITECTURE_PATTERN_RULES,
  service: SERVICE_SPECIFIC_RULES,
}));
`;

const tmp = path.join(require('os').tmpdir(), 'wafRules.eval.cjs');
fs.writeFileSync(tmp, src);

const { execSync } = require('child_process');
const json = execSync(`node ${tmp}`, { encoding: 'utf8' });
const { pattern, service } = JSON.parse(json);

const PILLARS = ['Reliability', 'Security', 'Cost Optimization', 'Operational Excellence', 'Performance Efficiency'];
const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_BADGE = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };

function tableRows(rules) {
  return rules
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.category.localeCompare(b.category))
    .map(r => {
      const services = r.appliesTo.join(', ');
      const issue = r.issue.replace(/\|/g, '\\|');
      const rec = r.recommendation.replace(/\|/g, '\\|');
      return `| ${SEV_BADGE[r.severity]} ${r.severity} | ${r.category} | ${issue} | ${rec} | ${services}${r.pattern ? ` *(pattern: \`${r.pattern}\`)*` : ''} |`;
    })
    .join('\n');
}

const all = [...pattern, ...service];
const byPillar = Object.fromEntries(PILLARS.map(p => [p, all.filter(r => r.pillar === p)]));
const services = [...new Set(service.flatMap(r => r.appliesTo))].sort();

let md = `# WAF Rule Catalog

> Companion artifact for [*WAR, Advisor, and Us: Three Ways to Score an Azure Architecture*](./blog-draft-waf-validation.md).
>
> This catalog is **auto-generated** from [\`src/data/wafRules.ts\`](../../src/data/wafRules.ts) — the exact same rules the [Azure Architecture Diagram Builder](https://aka.ms/diagram-builder) runs against during design-time WAF validation. Use it as a standalone design-time checklist independent of the tool.

**Last generated:** ${new Date().toISOString().slice(0, 10)}

---

## Summary

| Metric | Count |
|---|---|
| Total rules | **${all.length}** |
| Architecture-pattern rules | **${pattern.length}** |
| Service-specific rules | **${service.length}** |
| Distinct Azure services covered | **${services.length}** |
${PILLARS.map(p => `| Rules tagged *${p}* | ${byPillar[p].length} |`).join('\n')}

### Severity legend

| Badge | Severity | Design-time deduction (when scored) |
|---|---|---|
| 🔴 | critical | −12 |
| 🟠 | high | −7 |
| 🟡 | medium | −3 |
| 🔵 | low | −1 |

### Services covered

${services.map(s => `\`${s}\``).join(' · ')}

---

## 1. Architecture-pattern rules (${pattern.length})

These rules fire when a topology anti-pattern is detected across the whole architecture, regardless of which services are present.

| Severity | Category | Issue | Recommendation | Pattern / Applies to |
|---|---|---|---|---|
${tableRows(pattern)}

---

## 2. Service-specific rules (${service.length})

These rules fire for each occurrence of a specific Azure service in the diagram.

`;

for (const p of PILLARS) {
  const rules = service.filter(r => r.pillar === p);
  if (!rules.length) continue;
  md += `### ${p} (${rules.length})\n\n`;
  md += `| Severity | Category | Issue | Recommendation | Service(s) |\n|---|---|---|---|---|\n${tableRows(rules)}\n\n`;
}

md += `---

## Using this catalog without the tool

The rules above are written so they can be applied by hand during a design review:

1. List the Azure services in your proposed architecture.
2. For each service, check the corresponding rows in §2 above.
3. Check §1 for architecture-wide patterns (e.g., is there an identity provider? a Key Vault? a WAF in front of public endpoints?).
4. Score it the same way the tool does: start at 100, deduct using the legend above, floor at 10.

This gives you a deterministic, reproducible **design-time WAF score** in under 15 minutes per architecture — no AI, no Azure subscription required.

## Sources

- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
- [Azure Well-Architected Framework — pillars](https://learn.microsoft.com/azure/well-architected/pillars)
- [Azure Architecture Center service guides](https://learn.microsoft.com/azure/well-architected/service-guides/)

## License

The rule catalog ships under the same MIT license as the rest of the [Azure Architecture Diagram Builder](https://github.com/Arturo-Quiroga-MSFT/azure-architecture-diagram-builder) repository.
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT} (${all.length} rules, ${services.length} services)`);

/**
 * Emit CLI — writes the full deterministic artifact package for a scenario to an
 * output directory. Used by local validation scripts and the export feature.
 *
 * Usage: tsx scripts/emit.ts [outputDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { regulatedAiAssistant } from "../scenarios/regulated-ai-assistant.js";
import { validateParsedManifest } from "../core/validation/validate.js";
import { generateBicep } from "../core/bicep/generate.js";
import {
  generateManagementGroupsBicep,
  generateManagementGroupsTerraform,
} from "../core/bicep/managementGroups.js";
import { generateTerraform } from "../core/terraform/generate.js";
import { generateIpPlanCsv } from "../core/export/ipPlan.js";
import { buildScene } from "../core/diagram/scene.js";
import { buildTraceability } from "../core/traceability/map.js";

const outDir = process.argv[2] ?? join(process.cwd(), "out");
mkdirSync(outDir, { recursive: true });

const manifest = regulatedAiAssistant;
const validation = validateParsedManifest(manifest);

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(join(outDir, "validation.json"), JSON.stringify(validation, null, 2));
writeFileSync(join(outDir, "main.bicep"), generateBicep(manifest));
writeFileSync(join(outDir, "main.tf"), generateTerraform(manifest));
const mgBicep = generateManagementGroupsBicep(manifest);
if (mgBicep) {
  writeFileSync(join(outDir, "managementGroups.bicep"), mgBicep);
  writeFileSync(
    join(outDir, "managementGroups.tf"),
    generateManagementGroupsTerraform(manifest),
  );
}
writeFileSync(join(outDir, "ip-plan.csv"), generateIpPlanCsv(manifest));
writeFileSync(
  join(outDir, "scene.concept.json"),
  JSON.stringify(buildScene(manifest, "concept"), null, 2),
);
writeFileSync(
  join(outDir, "scene.physical.json"),
  JSON.stringify(buildScene(manifest, "physical"), null, 2),
);
writeFileSync(
  join(outDir, "traceability.json"),
  JSON.stringify(buildTraceability(manifest), null, 2),
);

const errors = validation.findings.filter((f) => f.severity === "error");
console.log(`Artifacts written to ${outDir}`);
console.log(`Validation: ${validation.ok ? "PASSED" : "FAILED"} (${errors.length} errors)`);
if (errors.length > 0) {
  for (const e of errors) console.error(`  [${e.code}] ${e.message}`);
  process.exit(1);
}

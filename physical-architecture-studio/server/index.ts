/**
 * Express host for the Physical Architecture Studio.
 *
 * The deterministic core runs client-side in the SPA; this server exists to:
 *   - serve the built static assets (dist/) in production
 *   - expose a health endpoint for the Container App probe
 *   - provide a minimal JSON API mirror of the core for programmatic use
 *
 * Authentication is enforced at the Container App ingress via Entra
 * (assignment-required), not in this process.
 */
import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { regulatedAiAssistant } from "../scenarios/regulated-ai-assistant.js";
import { validateManifest } from "../core/validation/validate.js";
import { generateBicep } from "../core/bicep/generate.js";
import { generateTerraform } from "../core/terraform/generate.js";
import { generateIpPlanCsv } from "../core/export/ipPlan.js";
import { buildScene } from "../core/diagram/scene.js";
import { buildTraceability } from "../core/traceability/map.js";
import { physicalToAadb } from "../core/bridge/toAadb.js";
import { importAnyAadb } from "../core/bridge/importAny.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 8080);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "physical-architecture-studio" });
});

app.get("/api/scenario", (_req, res) => {
  res.json(regulatedAiAssistant);
});

app.post("/api/validate", (req, res) => {
  res.json(validateManifest(req.body));
});

app.post("/api/bicep", (req, res) => {
  const parsed = validateManifest(req.body);
  if (!parsed.schemaValid) return res.status(400).json(parsed);
  res.type("text/plain").send(generateBicep(req.body));
});

app.post("/api/terraform", (req, res) => {
  const parsed = validateManifest(req.body);
  if (!parsed.schemaValid) return res.status(400).json(parsed);
  res.type("text/plain").send(generateTerraform(req.body));
});

app.post("/api/ip-plan", (req, res) => {
  const parsed = validateManifest(req.body);
  if (!parsed.schemaValid) return res.status(400).json(parsed);
  res.type("text/csv").send(generateIpPlanCsv(req.body));
});

app.post("/api/scene/:view", (req, res) => {
  const view = req.params.view === "concept" ? "concept" : "physical";
  const parsed = validateManifest(req.body);
  if (!parsed.schemaValid) return res.status(400).json(parsed);
  res.json(buildScene(req.body, view));
});

app.post("/api/traceability", (req, res) => {
  const parsed = validateManifest(req.body);
  if (!parsed.schemaValid) return res.status(400).json(parsed);
  res.json(buildTraceability(req.body));
});

// --- AADB bridge ---------------------------------------------------------
// Promote an AADB export (manifest OR ReactFlow scene) into a physical manifest.
app.post("/api/bridge/import", (req, res) => {
  const outcome = importAnyAadb(req.body);
  if (!outcome.ok) {
    return res.status(400).json({ ok: false, error: outcome.error });
  }
  res.json({
    format: outcome.format,
    manifest: outcome.manifest,
    unmapped: outcome.unmapped,
    notes: outcome.notes,
    validation: validateManifest(outcome.manifest),
  });
});

// Return a physical manifest to AADB's interchange format.
app.post("/api/bridge/export", (req, res) => {
  const parsed = validateManifest(req.body);
  if (!parsed.schemaValid) return res.status(400).json(parsed);
  res.json(physicalToAadb(req.body));
});

// Serve the built SPA in production. Compiled server lives at
// dist-server/server/, so the SPA build (dist/) is two levels up.
const distDir = join(__dirname, "..", "..", "dist");
app.use(express.static(distDir));
// SPA fallback: any non-API GET returns index.html (Express 5 has no bare "*").
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) return next();
  res.sendFile(join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Physical Architecture Studio listening on :${PORT}`);
});

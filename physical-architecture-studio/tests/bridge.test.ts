import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseAadbManifest } from "../core/bridge/aadbManifest.js";
import { promoteFromAadb } from "../core/bridge/promote.js";
import { physicalToAadb } from "../core/bridge/toAadb.js";
import { validateParsedManifest } from "../core/validation/validate.js";
import { parseManifest } from "../core/manifest/schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sampleRaw = JSON.parse(
  readFileSync(join(__dirname, "..", "scenarios", "aadb-concept-sample.json"), "utf8"),
);

describe("AADB bridge — promote (concept -> physical)", () => {
  it("accepts the sample AADB concept manifest", () => {
    expect(() => parseAadbManifest(sampleRaw)).not.toThrow();
  });

  it("promotes to a valid physical manifest with zero errors", () => {
    const aadb = parseAadbManifest(sampleRaw);
    const { manifest } = promoteFromAadb(aadb);
    expect(() => parseManifest(manifest)).not.toThrow();
    const report = validateParsedManifest(manifest);
    expect(report.findings.filter((f) => f.severity === "error")).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("creates a private endpoint for each private-link-capable service", () => {
    const aadb = parseAadbManifest(sampleRaw);
    const { manifest } = promoteFromAadb(aadb);
    const spoke = manifest.landingZones.find((l) => l.kind === "application")!;
    // aoai, search, storage, cosmos, key vault => 5 private endpoints
    expect(spoke.privateEndpoints.length).toBe(5);
    expect(manifest.privateDnsZones.length).toBe(5);
  });

  it("is deterministic (same input -> same output)", () => {
    const a = promoteFromAadb(parseAadbManifest(sampleRaw)).manifest;
    const b = promoteFromAadb(parseAadbManifest(sampleRaw)).manifest;
    expect(a).toEqual(b);
  });

  it("reports unmapped services instead of dropping silently", () => {
    const withJunk = structuredClone(sampleRaw);
    withJunk.architecture.services.push({
      id: "svc-x",
      name: "Mystery Mainframe",
      type: "COBOL Batch",
      category: "other",
      description: "",
      groupId: null,
    });
    const { unmapped } = promoteFromAadb(parseAadbManifest(withJunk));
    expect(unmapped.some((u) => u.includes("Mystery Mainframe"))).toBe(true);
  });
});

describe("AADB bridge — return (physical -> AADB)", () => {
  it("produces a schema-valid AADB manifest", () => {
    const aadb = parseAadbManifest(sampleRaw);
    const { manifest } = promoteFromAadb(aadb);
    const back = physicalToAadb(manifest);
    expect(() => parseAadbManifest(back)).not.toThrow();
    expect(back.source).toBe("physical-architecture-studio");
  });

  it("represents network constructs as AADB nodes with CIDR detail", () => {
    const { manifest } = promoteFromAadb(parseAadbManifest(sampleRaw));
    const back = physicalToAadb(manifest);
    const vnetNodes = back.architecture.services.filter(
      (s) => s.type === "Virtual Network",
    );
    expect(vnetNodes.length).toBe(2); // hub + spoke
    expect(vnetNodes.some((n) => /10\.\d+\.0\.0\/16/.test(n.description))).toBe(true);
    expect(back.architecture.services.some((s) => s.type === "Private Endpoint")).toBe(true);
  });

  it("preserves full physical fidelity under metadata.physical", () => {
    const { manifest } = promoteFromAadb(parseAadbManifest(sampleRaw));
    const back = physicalToAadb(manifest);
    expect(back.metadata?.physical).toBeDefined();
    // Round-trip: the embedded physical manifest re-validates cleanly.
    const rehydrated = parseManifest(back.metadata!.physical);
    expect(validateParsedManifest(rehydrated).ok).toBe(true);
  });
});

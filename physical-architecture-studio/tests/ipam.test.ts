import { describe, it, expect } from "vitest";
import { analyzeIpam } from "../core/ipam/engine.js";
import { validateParsedManifest } from "../core/validation/validate.js";
import { parseManifest, type PhysicalManifest } from "../core/manifest/schema.js";
import { regulatedAiAssistant } from "../scenarios/regulated-ai-assistant.js";

/** Deep-clone a manifest so mutation tests do not leak between cases. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Look landing zones up by role rather than array position. */
const app = (m: PhysicalManifest) =>
  m.landingZones.find((z) => z.kind === "application")!;
const hub = (m: PhysicalManifest) =>
  m.landingZones.find((z) => z.platformSubscription === "connectivity")!;

describe("golden scenario", () => {
  it("parses against the manifest schema", () => {
    expect(() => parseManifest(regulatedAiAssistant)).not.toThrow();
  });

  it("passes deterministic IPAM validation with no errors", () => {
    const report = analyzeIpam(regulatedAiAssistant);
    const errors = report.findings.filter((f) => f.severity === "error");
    expect(errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("produces a stable, deterministic subnet plan", () => {
    const report = analyzeIpam(regulatedAiAssistant);
    expect(report.subnetPlan).toMatchSnapshot();
  });

  it("allocates deterministic private-endpoint IPs", () => {
    const a = analyzeIpam(regulatedAiAssistant).privateEndpoints;
    const b = analyzeIpam(clone(regulatedAiAssistant)).privateEndpoints;
    expect(a).toEqual(b);
    expect(a).toMatchSnapshot();
  });
});

describe("overlap detection", () => {
  it("flags a spoke that overlaps the hub", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    // Make the spoke collide with the hub 10.20.0.0/16.
    app(m).vnets[0].addressSpace = ["10.20.0.0/16"];
    // Keep subnets inside the (now overlapping) space to isolate VNET_OVERLAP.
    app(m).vnets[0].subnets[0].addressPrefix = "10.20.0.0/23";
    app(m).vnets[0].subnets[1].addressPrefix = "10.20.2.0/24";
    const report = validateParsedManifest(m);
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.code === "VNET_OVERLAP")).toBe(true);
  });

  it("flags a VNet overlapping the on-premises range", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    m.onPremises.addressSpaces = ["10.21.0.0/16"]; // collides with spoke
    const report = validateParsedManifest(m);
    expect(report.findings.some((f) => f.code === "ONPREM_OVERLAP")).toBe(true);
  });

  it("flags two subnets that overlap within a VNet", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    app(m).vnets[0].subnets[1].addressPrefix = "10.21.0.0/23";
    const report = validateParsedManifest(m);
    expect(report.findings.some((f) => f.code === "SUBNET_OVERLAP")).toBe(true);
  });

  it("flags a subnet outside its VNet address space", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    app(m).vnets[0].subnets[0].addressPrefix = "10.99.0.0/23";
    const report = validateParsedManifest(m);
    expect(report.findings.some((f) => f.code === "SUBNET_OUT_OF_VNET")).toBe(true);
  });
});

describe("special subnet rules", () => {
  it("rejects an AzureFirewallSubnet smaller than /26", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    hub(m).vnets[0].subnets[0].addressPrefix = "10.20.0.0/27";
    const report = validateParsedManifest(m);
    expect(report.findings.some((f) => f.code === "SPECIAL_SUBNET_PREFIX")).toBe(true);
  });

  it("rejects a GatewaySubnet with the wrong name", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    hub(m).vnets[0].subnets[1].name = "gw";
    const report = validateParsedManifest(m);
    expect(report.findings.some((f) => f.code === "SPECIAL_SUBNET_NAME")).toBe(true);
  });
});

describe("private endpoint allocation", () => {
  it("assigns each PE a distinct IP in the private-endpoints subnet", () => {
    const report = analyzeIpam(regulatedAiAssistant);
    const ips = report.privateEndpoints.map((p) => p.allocatedIp);
    expect(new Set(ips).size).toBe(ips.length);
    for (const ip of ips) {
      expect(ip.startsWith("10.21.2.")).toBe(true);
    }
  });

  it("errors when a PE targets an unknown subnet", () => {
    const m = clone(regulatedAiAssistant) as PhysicalManifest;
    app(m).privateEndpoints[0].subnet = "does-not-exist";
    const report = validateParsedManifest(m);
    expect(report.findings.some((f) => f.code === "PE_SUBNET_MISSING")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { checkAlzConformance } from "../core/validation/alz.js";
import { regulatedAiAssistant } from "../scenarios/regulated-ai-assistant.js";
import { importAnyAadb } from "../core/bridge/importAny.js";
import type { PhysicalManifest } from "../core/manifest/schema.js";

function clone(m: PhysicalManifest): PhysicalManifest {
  return JSON.parse(JSON.stringify(m)) as PhysicalManifest;
}

/** Look landing zones up by role rather than array position. */
const app = (m: PhysicalManifest) =>
  m.landingZones.find((z) => z.kind === "application")!;
const hub = (m: PhysicalManifest) =>
  m.landingZones.find((z) => z.platformSubscription === "connectivity")!;

describe("ALZ conformance — golden scenario", () => {
  it("is fully conformant with no findings", () => {
    const report = checkAlzConformance(regulatedAiAssistant);
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.passed).toBe(report.total);
  });

  it("defaults to the hub & spoke topology", () => {
    expect(checkAlzConformance(regulatedAiAssistant).topology).toBe("hubSpoke");
  });
});

describe("ALZ conformance — composition rules", () => {
  it("flags a manifest with no platform landing zone", () => {
    const m = clone(regulatedAiAssistant);
    m.landingZones = m.landingZones.filter((z) => z.kind !== "platform");
    const report = checkAlzConformance(m);
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.code === "ALZ_NO_PLATFORM_LZ")).toBe(true);
  });

  it("flags a manifest with no application landing zone", () => {
    const m = clone(regulatedAiAssistant);
    m.landingZones = m.landingZones.filter((z) => z.kind !== "application");
    const report = checkAlzConformance(m);
    expect(report.findings.some((f) => f.code === "ALZ_NO_APPLICATION_LZ")).toBe(true);
  });

  it("flags an application landing zone with no Corp/Online archetype", () => {
    const m = clone(regulatedAiAssistant);
    delete app(m).archetype;
    const report = checkAlzConformance(m);
    expect(report.findings.some((f) => f.code === "ALZ_NO_ARCHETYPE")).toBe(true);
  });

  it("flags private endpoints placed in the platform landing zone", () => {
    const m = clone(regulatedAiAssistant);
    hub(m).privateEndpoints = [
      {
        name: "pe-oops",
        service: "aoai",
        subnet: "management",
        privateDnsZone: "privatelink.openai.azure.com",
      },
    ];
    expect(
      checkAlzConformance(m).findings.some((f) => f.code === "ALZ_PE_IN_PLATFORM"),
    ).toBe(true);
  });
});

describe("ALZ conformance — network topology rules", () => {
  it("hub & spoke requires firewall and gateway subnets in the hub", () => {
    const m = clone(regulatedAiAssistant);
    hub(m).vnets[0].subnets = hub(m).vnets[0].subnets.filter(
      (s) => s.role !== "AzureFirewallSubnet" && s.role !== "GatewaySubnet",
    );
    const codes = checkAlzConformance(m).findings.map((f) => f.code);
    expect(codes).toContain("ALZ_HUB_NO_FIREWALL_SUBNET");
    expect(codes).toContain("ALZ_HUB_NO_GATEWAY_SUBNET");
  });

  it("Virtual WAN flags a self-declared managed-hub subnet", () => {
    const m = clone(regulatedAiAssistant);
    m.networkTopology = "virtualWan";
    const report = checkAlzConformance(m);
    expect(report.topology).toBe("virtualWan");
    expect(report.findings.some((f) => f.code === "ALZ_VWAN_MANAGED_HUB")).toBe(true);
  });

  it("Virtual WAN is clean when the hub declares no managed subnets", () => {
    const m = clone(regulatedAiAssistant);
    m.networkTopology = "virtualWan";
    hub(m).vnets[0].subnets = hub(m).vnets[0].subnets.filter(
      (s) => s.role === "management",
    );
    expect(
      checkAlzConformance(m).findings.some((f) => f.code === "ALZ_VWAN_MANAGED_HUB"),
    ).toBe(false);
  });
});

describe("ALZ conformance — promoted manifests", () => {
  it("promotion from AADB produces an ALZ-conformant manifest", () => {
    const scene = {
      nodes: [
        {
          id: "a",
          type: "azureNode",
          data: {
            label: "Azure OpenAI",
            iconPath: "/i/azure-openai.svg",
          },
        },
      ],
      metadata: { architectureName: "Promoted" },
    };
    const outcome = importAnyAadb(scene);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const report = checkAlzConformance(outcome.manifest);
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { generateBicep } from "../core/bicep/generate.js";
import { generateTerraform } from "../core/terraform/generate.js";
import { generateIpPlanCsv } from "../core/export/ipPlan.js";
import { buildScene } from "../core/diagram/scene.js";
import { buildTraceability } from "../core/traceability/map.js";
import { regulatedAiAssistant } from "../scenarios/regulated-ai-assistant.js";

describe("Bicep emitter", () => {
  it("is deterministic (byte-identical across runs)", () => {
    expect(generateBicep(regulatedAiAssistant)).toBe(
      generateBicep(regulatedAiAssistant),
    );
  });

  it("emits AVM module references and the allocated PE IP", () => {
    const bicep = generateBicep(regulatedAiAssistant);
    expect(bicep).toContain("br/public:avm/res/network/virtual-network");
    expect(bicep).toContain("br/public:avm/res/network/private-endpoint");
    expect(bicep).toContain("10.21.2.4"); // pe-aoai deterministic IP
  });

  it("matches snapshot", () => {
    expect(generateBicep(regulatedAiAssistant)).toMatchSnapshot();
  });
});

describe("Terraform emitter", () => {
  it("is deterministic (byte-identical across runs)", () => {
    expect(generateTerraform(regulatedAiAssistant)).toBe(
      generateTerraform(regulatedAiAssistant),
    );
  });

  it("emits AVM module sources and the allocated PE IP", () => {
    const tf = generateTerraform(regulatedAiAssistant);
    expect(tf).toContain("Azure/avm-res-network-virtualnetwork/azurerm");
    expect(tf).toContain("Azure/avm-res-network-privateendpoint/azurerm");
    expect(tf).toContain("10.21.2.4");
  });

  it("matches snapshot", () => {
    expect(generateTerraform(regulatedAiAssistant)).toMatchSnapshot();
  });
});

describe("IP plan CSV", () => {
  it("includes subnet and private-endpoint rows", () => {
    const csv = generateIpPlanCsv(regulatedAiAssistant);
    expect(csv.split("\n")[0]).toContain("addressPrefix");
    expect(csv).toContain("AzureFirewallSubnet");
    expect(csv).toContain("pe-aoai");
  });
});

describe("diagram scene", () => {
  it("concept view lists services without network fabric", () => {
    const scene = buildScene(regulatedAiAssistant, "concept");
    expect(scene.view).toBe("concept");
    expect(scene.nodes.some((n) => n.kind === "azureOpenAI")).toBe(true);
    expect(scene.nodes.some((n) => n.kind === "subnet")).toBe(false);
  });

  it("physical view includes vnets, subnets and private endpoints", () => {
    const scene = buildScene(regulatedAiAssistant, "physical");
    expect(scene.nodes.some((n) => n.kind === "hubVnet")).toBe(true);
    expect(scene.nodes.some((n) => n.kind === "spokeVnet")).toBe(true);
    expect(scene.nodes.some((n) => n.kind === "subnet")).toBe(true);
    expect(scene.nodes.some((n) => n.kind === "privateEndpoint")).toBe(true);
    expect(scene.edges.some((e) => e.kind === "hybrid")).toBe(true);
  });
});

describe("traceability", () => {
  it("links elements to both Bicep and Terraform", () => {
    const rows = buildTraceability(regulatedAiAssistant);
    const spoke = rows.find((r) => r.element === "spoke-ai-vnet");
    expect(spoke?.bicep).toContain("module vnet_spoke_ai_vnet");
    expect(spoke?.terraform).toBe("module.vnet_spoke_ai_vnet");
  });
});

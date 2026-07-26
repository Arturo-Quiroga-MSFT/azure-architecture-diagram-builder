import { describe, it, expect } from "vitest";
import { generateBicep } from "../core/bicep/generate.js";
import {
  generateManagementGroupsBicep,
  generateManagementGroupsTerraform,
} from "../core/bicep/managementGroups.js";
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

describe("Virtual WAN emission", () => {
  const vwan = {
    ...regulatedAiAssistant,
    networkTopology: "virtualWan" as const,
  };

  it("Bicep emits a virtual WAN and managed hub instead of a hub VNet", () => {
    const bicep = generateBicep(vwan);
    expect(bicep).toContain("br/public:avm/res/network/virtual-wan");
    expect(bicep).toContain("br/public:avm/res/network/virtual-hub");
    expect(bicep).toContain("Virtual WAN (Microsoft-managed hub)");
    // The customer-managed hub VNet is no longer emitted.
    expect(bicep).not.toContain("name: 'hub-vnet'");
    // Spokes are still emitted.
    expect(bicep).toContain("name: 'spoke-ai-vnet'");
  });

  it("Terraform emits the AVM virtual WAN module with hubs", () => {
    const tf = generateTerraform(vwan);
    expect(tf).toContain("Azure/avm-res-network-virtualwan/azurerm");
    expect(tf).toContain("virtual_hubs");
    expect(tf).not.toContain('name                = "hub-vnet"');
  });

  it("hub & spoke output is unchanged (no Virtual WAN resources)", () => {
    const bicep = generateBicep(regulatedAiAssistant);
    expect(bicep).not.toContain("virtual-wan");
    expect(bicep).toContain("name: 'hub-vnet'");
  });
});

describe("management group hierarchy emission", () => {
  it("Bicep emits a tenant-scoped ALZ hierarchy", () => {
    const bicep = generateManagementGroupsBicep(regulatedAiAssistant);
    expect(bicep).toContain("targetScope = 'tenant'");
    expect(bicep).toContain("Microsoft.Management/managementGroups@");
    for (const name of ["Platform", "Landing zones", "Sandbox", "Decommissioned"]) {
      expect(bicep).toContain(`displayName: '${name}'`);
    }
    // Platform subscriptions and archetypes.
    expect(bicep).toContain("displayName: 'connectivity'");
    expect(bicep).toContain("displayName: 'corp'");
  });

  it("Terraform emits the same hierarchy", () => {
    const tf = generateManagementGroupsTerraform(regulatedAiAssistant);
    expect(tf).toContain("azurerm_management_group");
    expect(tf).toContain('display_name               = "Platform"');
    expect(tf).toContain("parent_management_group_id");
  });

  it("emits nothing when no hierarchy is declared", () => {
    const m = { ...regulatedAiAssistant, managementGroups: undefined };
    expect(generateManagementGroupsBicep(m)).toBe("");
    expect(generateManagementGroupsTerraform(m)).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { importAnyAadb } from "../core/bridge/importAny.js";
import { isReactFlowScene, resolveNodeKind } from "../core/bridge/sceneImport.js";
import { validateParsedManifest } from "../core/validation/validate.js";

/** A representative AADB ReactFlow scene export (saveDiagram output shape). */
const scene = {
  nodes: [
    {
      id: "grp-ai",
      type: "groupNode",
      position: { x: 0, y: 0 },
      data: { label: "AI Services", isGroup: true },
    },
    {
      id: "n1",
      type: "azureNode",
      position: { x: 40, y: 40 },
      parentNode: "grp-ai",
      data: {
        label: "Azure OpenAI",
        iconPath: "/Azure_Public_Service_Icons/Icons/ai + machine learning/azure-openai.svg",
        category: "ai + machine learning",
      },
    },
    {
      id: "n2",
      type: "azureNode",
      position: { x: 240, y: 40 },
      parentNode: "grp-ai",
      data: {
        label: "Product Search",
        iconPath: "/Azure_Public_Service_Icons/Icons/ai + machine learning/azure-cognitive-search.svg",
      },
    },
    {
      id: "n3",
      type: "azureNode",
      position: { x: 40, y: 200 },
      data: {
        label: "Documents",
        iconPath: "/Azure_Public_Service_Icons/Icons/storage/storage-account.svg",
      },
    },
    {
      id: "n4",
      type: "azureNode",
      position: { x: 240, y: 200 },
      data: {
        label: "App Secrets",
        iconPath: "/Azure_Public_Service_Icons/Icons/security/key-vault.svg",
      },
    },
    {
      id: "n5",
      type: "azureNode",
      position: { x: 440, y: 200 },
      data: {
        label: "Chat App",
        iconPath:
          "/Azure_Public_Service_Icons/Icons/containers/02989-icon-service-Container-Apps-Environments.svg",
      },
    },
  ],
  edges: [
    { source: "n5", target: "n1", label: "generate", data: { connectionType: "sync" } },
    { source: "n5", target: "n2", label: "retrieve" },
  ],
  metadata: { architectureName: "My Diagram", savedAt: "2026-07-24T00:00:00Z" },
};

describe("scene detection + node resolution", () => {
  it("detects a ReactFlow scene", () => {
    expect(isReactFlowScene(scene)).toBe(true);
    expect(isReactFlowScene({ schemaVersion: "1.0" })).toBe(false);
  });

  it("resolves nodes by icon-file stem", () => {
    expect(resolveNodeKind("/x/azure-openai.svg")?.kind).toBe("azureOpenAI");
    expect(resolveNodeKind("/x/azure-cognitive-search.svg")?.kind).toBe("aiSearch");
    expect(resolveNodeKind("/x/storage-account.svg")?.kind).toBe("storageAccount");
    expect(resolveNodeKind("/x/key-vault.svg")?.kind).toBe("keyVault");
    expect(
      resolveNodeKind("/x/02989-icon-service-Container-Apps-Environments.svg")?.kind,
    ).toBe("containerAppsEnvironment");
  });

  it("falls back to label when the icon is unknown", () => {
    expect(resolveNodeKind(undefined, "Azure Cosmos DB")?.kind).toBe("cosmosDb");
    expect(resolveNodeKind("/x/mystery.svg", "Documents Storage")?.kind).toBe("storageAccount");
  });

  it("resolves Event Grid and Document Intelligence", () => {
    expect(
      resolveNodeKind("/x/10206-icon-service-Event-Grid-Topics.svg")?.kind,
    ).toBe("eventGrid");
    expect(resolveNodeKind("/x/document-intelligence.svg")?.kind).toBe("documentIntelligence");
    expect(resolveNodeKind(undefined, "Form Recognizer")?.kind).toBe("documentIntelligence");
  });

  it("resolves Azure Machine Learning and Logic Apps", () => {
    expect(resolveNodeKind("/x/azure-machine-learning.svg")?.kind).toBe("azureMachineLearning");
    expect(resolveNodeKind(undefined, "AML Online Endpoint")?.kind).toBe("azureMachineLearning");
    expect(resolveNodeKind("/x/logic-apps.svg")?.kind).toBe("logicApps");
  });
});

describe("importAnyAadb (scene format)", () => {
  it("imports a scene and promotes to a valid physical manifest", () => {
    const outcome = importAnyAadb(scene);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.format).toBe("scene");
    const report = validateParsedManifest(outcome.manifest);
    expect(report.ok).toBe(true);
    // OpenAI, Search, Storage, Key Vault => 4 private endpoints (Container Apps has none)
    const spoke = outcome.manifest.landingZones.find((l) => l.kind === "application")!;
    expect(spoke.privateEndpoints.length).toBe(4);
  });

  it("still accepts the az-prototype manifest format", () => {
    const manifest = {
      schemaVersion: "1.0",
      source: "azure-diagram-builder",
      createdAt: "2026-07-24T00:00:00Z",
      project: { name: "M", location: "eastus2", iacTool: "bicep" },
      architecture: {
        services: [
          { id: "s1", name: "AOAI", type: "Azure OpenAI", category: "ai", description: "", groupId: null },
        ],
        connections: [],
        groups: [],
        workflow: [],
      },
    };
    const outcome = importAnyAadb(manifest);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.format).toBe("manifest");
  });

  it("rejects unrecognized JSON with a helpful error", () => {
    const outcome = importAnyAadb({ hello: "world" });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/Unrecognized/);
  });
});

describe("event-driven AKS scene (expanded catalog)", () => {
  const aksScene = {
    nodes: [
      svcNode("aks", "Azure Kubernetes Service", "containers/azure-kubernetes-service"),
      svcNode("sb", "Service Bus", "integration/service-bus"),
      svcNode("acr", "Container Registry", "containers/container-registry"),
      svcNode("agw", "Application Gateway", "networking/application-gateway"),
      svcNode("kv", "Key Vault", "security/key-vault"),
      svcNode("mon", "Azure Monitor", "monitor/00001-icon-service-Monitor"),
      // Infrastructure / global — should be recognized, not "unmapped".
      svcNode("vnet", "Virtual Network", "networking/10061-icon-service-Virtual-Networks"),
      svcNode("pl", "Azure Private Link", "networking/private-link"),
      svcNode("entra", "Microsoft Entra ID", "identity/10340-icon-service-Entra-Identity-Roles-and-Administrators"),
    ],
    edges: [],
    metadata: { architectureName: "Event-driven Microservices on AKS" },
  };

  it("maps AKS, Service Bus, ACR, App Gateway and produces PEs", () => {
    const outcome = importAnyAadb(aksScene);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const spoke = outcome.manifest.landingZones.find((l) => l.kind === "application")!;
    const kinds = spoke.services.map((s) => s.kind).sort();
    expect(kinds).toContain("aks");
    expect(kinds).toContain("serviceBus");
    expect(kinds).toContain("containerRegistry");
    expect(kinds).toContain("applicationGateway");
    // Service Bus + Container Registry + Key Vault => 3 private endpoints
    expect(spoke.privateEndpoints.length).toBe(3);
    // Ingress present => an app-gateway subnet is added
    expect(spoke.vnets[0].subnets.some((s) => s.name === "app-gateway")).toBe(true);
  });

  it("recognizes infrastructure/global nodes instead of flagging them unmapped", () => {
    const outcome = importAnyAadb(aksScene);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.unmapped).toEqual([]);
    const infraNote = outcome.notes.find((n) => n.includes("platform/global"));
    expect(infraNote).toBeDefined();
    expect(infraNote).toMatch(/Virtual Network/);
    expect(infraNote).toMatch(/Microsoft Entra ID/);
  });

  it("still validates cleanly (no CIDR errors)", () => {
    const outcome = importAnyAadb(aksScene);
    if (!outcome.ok) throw new Error("import failed");
    expect(validateParsedManifest(outcome.manifest).ok).toBe(true);
  });
});

function svcNode(id: string, label: string, iconTail: string) {
  return {
    id,
    type: "azureNode",
    position: { x: 0, y: 0 },
    data: { label, iconPath: `/Azure_Public_Service_Icons/Icons/${iconTail}.svg` },
  };
}

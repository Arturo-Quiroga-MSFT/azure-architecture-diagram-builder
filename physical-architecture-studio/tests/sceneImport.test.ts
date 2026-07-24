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

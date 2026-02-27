#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure Architecture Diagram Builder — MCP Server
 *
 * Exposes `generate_architecture` as an MCP tool so that other AI agents
 * can request Azure architecture diagrams from natural language descriptions.
 *
 * Reads Azure OpenAI config from the project `.env` file (or process env).
 * Supports VITE_-prefixed vars (shared with the frontend) and plain names.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DefaultAzureCredential } from "@azure/identity";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from the project root (one level above mcp-server/)
config({ path: resolve(__dirname, "../../.env") });

function env(plain: string, vite?: string): string | undefined {
  return process.env[plain] ?? (vite ? process.env[vite] : undefined);
}

const ENDPOINT = env("AZURE_OPENAI_ENDPOINT", "VITE_AZURE_OPENAI_ENDPOINT");
const API_KEY = env("AZURE_OPENAI_API_KEY", "VITE_AZURE_OPENAI_API_KEY");

// ---------------------------------------------------------------------------
// Entra ID (Azure AD) token auth — used when API key is not set
// ---------------------------------------------------------------------------

const COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default";
let credential: DefaultAzureCredential | null = null;

async function getAuthHeader(): Promise<Record<string, string>> {
  if (API_KEY) {
    return { "api-key": API_KEY };
  }
  // Fall back to Entra ID / DefaultAzureCredential (az login, managed identity, etc.)
  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  const token = await credential.getToken(COGNITIVE_SERVICES_SCOPE);
  return { Authorization: `Bearer ${token.token}` };
}

/** Supported models and their env-var deployment names */
const MODEL_CONFIG: Record<
  string,
  { envPlain: string; envVite: string; isReasoning: boolean; maxTokens: number }
> = {
  "gpt-5.2": {
    envPlain: "AZURE_OPENAI_DEPLOYMENT_GPT52",
    envVite: "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52",
    isReasoning: true,
    maxTokens: 16000,
  },
  "gpt-4.1": {
    envPlain: "AZURE_OPENAI_DEPLOYMENT_GPT41",
    envVite: "VITE_AZURE_OPENAI_DEPLOYMENT_GPT41",
    isReasoning: false,
    maxTokens: 10000,
  },
  "gpt-4.1-mini": {
    envPlain: "AZURE_OPENAI_DEPLOYMENT_GPT41MINI",
    envVite: "VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI",
    isReasoning: false,
    maxTokens: 8000,
  },
};

function getDeployment(model: string): string {
  const cfg = MODEL_CONFIG[model];
  if (!cfg) throw new Error(`Unknown model: ${model}`);
  const dep = env(cfg.envPlain, cfg.envVite);
  if (!dep) throw new Error(`No deployment configured for ${model}. Set ${cfg.envVite} in .env.`);
  return dep;
}

// ---------------------------------------------------------------------------
// Known Azure service names (compact list for the system prompt)
// ---------------------------------------------------------------------------

interface ServiceEntry {
  displayName: string;
  aliases: string[];
  category: string;
}

// Minimal service registry used in the prompt.  Full list is in the frontend;
// this covers the most commonly generated services.
const KNOWN_SERVICES: ServiceEntry[] = [
  { displayName: "Azure OpenAI", aliases: ["OpenAI", "GPT"], category: "ai + machine learning" },
  { displayName: "Azure Machine Learning", aliases: ["AML"], category: "ai + machine learning" },
  { displayName: "Azure AI Search", aliases: ["Cognitive Search"], category: "ai + machine learning" },
  { displayName: "Azure Bot Service", aliases: ["Bot Service"], category: "ai + machine learning" },
  { displayName: "Azure AI Services", aliases: ["Cognitive Services"], category: "ai + machine learning" },
  { displayName: "App Service", aliases: ["Web App"], category: "app services" },
  { displayName: "Azure Functions", aliases: ["Function App"], category: "app services" },
  { displayName: "API Management", aliases: ["APIM"], category: "app services" },
  { displayName: "Azure SignalR", aliases: ["SignalR"], category: "app services" },
  { displayName: "Virtual Machines", aliases: ["VM"], category: "compute" },
  { displayName: "Azure Kubernetes Service", aliases: ["AKS"], category: "containers" },
  { displayName: "Container Apps", aliases: ["ACA"], category: "containers" },
  { displayName: "Container Registry", aliases: ["ACR"], category: "containers" },
  { displayName: "Container Instances", aliases: ["ACI"], category: "containers" },
  { displayName: "Azure SQL Database", aliases: ["SQL Database"], category: "databases" },
  { displayName: "Cosmos DB", aliases: ["CosmosDB"], category: "databases" },
  { displayName: "Azure Database for PostgreSQL", aliases: ["PostgreSQL"], category: "databases" },
  { displayName: "Azure Database for MySQL", aliases: ["MySQL"], category: "databases" },
  { displayName: "Azure Cache for Redis", aliases: ["Redis Cache"], category: "databases" },
  { displayName: "Blob Storage", aliases: ["Azure Blob"], category: "storage" },
  { displayName: "Azure Data Lake Storage", aliases: ["ADLS"], category: "storage" },
  { displayName: "Azure Files", aliases: ["File Share"], category: "storage" },
  { displayName: "Queue Storage", aliases: ["Storage Queue"], category: "storage" },
  { displayName: "Virtual Network", aliases: ["VNet"], category: "networking" },
  { displayName: "Application Gateway", aliases: ["App Gateway"], category: "networking" },
  { displayName: "Azure Front Door", aliases: ["Front Door"], category: "networking" },
  { displayName: "Azure Firewall", aliases: ["Firewall"], category: "networking" },
  { displayName: "Load Balancer", aliases: [], category: "networking" },
  { displayName: "Azure DNS", aliases: ["DNS"], category: "networking" },
  { displayName: "VPN Gateway", aliases: [], category: "networking" },
  { displayName: "Azure CDN", aliases: ["CDN"], category: "networking" },
  { displayName: "Azure DDoS Protection", aliases: ["DDoS"], category: "networking" },
  { displayName: "Private Link", aliases: ["Private Endpoint"], category: "networking" },
  { displayName: "Microsoft Entra ID", aliases: ["Entra ID", "Azure AD"], category: "identity" },
  { displayName: "Key Vault", aliases: ["Azure Key Vault"], category: "security" },
  { displayName: "Microsoft Defender for Cloud", aliases: ["Defender"], category: "security" },
  { displayName: "Azure Monitor", aliases: ["Monitor"], category: "monitor" },
  { displayName: "Log Analytics", aliases: ["Log Analytics Workspace"], category: "monitor" },
  { displayName: "Application Insights", aliases: ["App Insights"], category: "monitor" },
  { displayName: "Event Hubs", aliases: ["Azure Event Hubs"], category: "analytics" },
  { displayName: "Event Grid", aliases: ["Azure Event Grid"], category: "integration" },
  { displayName: "Service Bus", aliases: ["Azure Service Bus"], category: "integration" },
  { displayName: "Logic Apps", aliases: ["Azure Logic Apps"], category: "integration" },
  { displayName: "Azure Data Factory", aliases: ["ADF"], category: "analytics" },
  { displayName: "Azure Synapse Analytics", aliases: ["Synapse"], category: "analytics" },
  { displayName: "Azure Stream Analytics", aliases: ["Stream Analytics"], category: "analytics" },
  { displayName: "Azure Databricks", aliases: ["Databricks"], category: "analytics" },
  { displayName: "Power BI Embedded", aliases: ["Power BI"], category: "analytics" },
  { displayName: "Azure Managed Grafana", aliases: ["Grafana"], category: "monitor" },
  { displayName: "IoT Hub", aliases: ["Azure IoT Hub"], category: "iot" },
  { displayName: "IoT Central", aliases: [], category: "iot" },
  { displayName: "Azure Digital Twins", aliases: ["Digital Twins"], category: "iot" },
  { displayName: "Azure DevOps", aliases: ["DevOps"], category: "devops" },
  { displayName: "Azure Backup", aliases: ["Backup"], category: "storage" },
  { displayName: "Azure Site Recovery", aliases: ["Site Recovery"], category: "management + governance" },
  { displayName: "Azure Policy", aliases: ["Policy"], category: "management + governance" },
  { displayName: "Microsoft Sentinel", aliases: ["Sentinel", "Azure Sentinel"], category: "security" },
  { displayName: "Azure Bastion", aliases: ["Bastion"], category: "security" },
  { displayName: "Web Application Firewall", aliases: ["WAF"], category: "networking" },
  { displayName: "Static Web Apps", aliases: ["SWA"], category: "web" },
  { displayName: "Azure Notification Hubs", aliases: ["Notification Hubs"], category: "web" },
];

const KNOWN_SERVICES_PROMPT = KNOWN_SERVICES.map(
  (s) => `${s.displayName} (${s.category})`
).join(", ");

// ---------------------------------------------------------------------------
// Azure OpenAI Responses API helper
// ---------------------------------------------------------------------------

interface AiResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

async function callAzureOpenAI(
  messages: { role: string; content: string }[],
  model: string,
  reasoningEffort: string
): Promise<AiResult> {
  if (!ENDPOINT) {
    throw new Error(
      "Azure OpenAI endpoint not configured. Set VITE_AZURE_OPENAI_ENDPOINT in .env."
    );
  }

  const deployment = getDeployment(model);
  const cfg = MODEL_CONFIG[model];
  const url = `${ENDPOINT.replace(/\/$/, "")}/openai/v1/responses`;

  const body: Record<string, unknown> = {
    model: deployment,
    input: messages,
    max_output_tokens: cfg.maxTokens,
    text: { format: { type: "json_object" } },
    store: false,
  };

  if (cfg.isReasoning) {
    body.reasoning = { effort: reasoningEffort };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure OpenAI ${res.status}: ${text}`);
    }

    const data = (await res.json()) as Record<string, any>;
    let content: string = (data.output_text as string) ?? "";
    if (!content && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text") content += part.text;
          }
        }
      }
    }

    const usage = (data.usage ?? {}) as Record<string, number>;
    return {
      content,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// System prompt (mirrors src/services/azureOpenAI.ts)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert Azure cloud architect. Analyze architecture requirements and return a JSON specification for an Azure architecture diagram with logical groupings.

**IMPORTANT: DO NOT include position, x, y, width, or height in your response. The layout engine will calculate optimal positions automatically.**

Return ONLY a valid JSON object (no markdown, no explanations) with this structure:
{
  "groups": [{ "id": "unique-group-id", "label": "Group Name" }],
  "services": [{ "id": "unique-id", "name": "Service Display Name", "type": "Azure service type", "category": "icon category", "description": "Brief role", "groupId": "group-id or null" }],
  "connections": [{ "from": "service-id", "to": "service-id", "label": "Detailed action description", "type": "sync|async|optional" }],
  "workflow": [{ "step": 1, "description": "What happens in this step", "services": ["service-id-1", "service-id-2"] }]
}

KNOWN SERVICES (use these exact names for "name" and "type" fields):
${KNOWN_SERVICES_PROMPT}

Icon categories (use for "category" field):
"app services", "databases", "storage", "networking", "compute", "containers", "ai + machine learning", "analytics", "identity", "monitor", "iot", "integration", "devops", "security", "web", "management + governance"

Rules:
1. Create 2-5 logical groups. Max 6 services per group.
2. Use EXACT service names from the KNOWN SERVICES list above for both "name" and "type". If a required service is NOT in the list, use its official Azure service name and set category to the closest match.
3. For identity/auth, use "Microsoft Entra ID" (never "Azure Active Directory" or "AAD").
4. Connection labels MUST be specific and action-oriented (e.g., "Submit batch job per tenant"), NOT generic ("Request", "Data").
5. Do NOT specify sourcePosition or targetPosition.
6. Connection types: "sync" (solid, HTTP/SQL), "async" (dashed, queues/events), "optional" (dotted, fallback).
7. Provide 5-10 workflow steps following the data flow chronologically. Each step's "services" array MUST list ALL service IDs involved in that step (typically 2-3 services per step, not just one).

LAYOUT READABILITY — CRITICAL:
8. Directional group flow: Ingress/Edge → Application/Compute → Data/Storage. Identity/Security bottom-left. Monitoring bottom-right.
9. Hub-and-spoke for monitoring. Maximum 2-3 edges involving monitoring services total.
10. Limit total connections to 12-18.
11. Minimize cross-group edges (1-2 outgoing per group).
12. Total service count: 8-12 max unless the user explicitly names more.
13. When the user mentions dashboards/reporting, include a dedicated visualization service.`;

// ---------------------------------------------------------------------------
// Post-processing: normalise service names against the known registry
// ---------------------------------------------------------------------------

function normaliseServices(architecture: Record<string, any>): void {
  if (!Array.isArray(architecture.services)) return;

  const lookup = new Map<string, ServiceEntry>();
  for (const svc of KNOWN_SERVICES) {
    lookup.set(svc.displayName.toLowerCase(), svc);
    for (const alias of svc.aliases) {
      lookup.set(alias.toLowerCase(), svc);
    }
  }

  architecture.services = architecture.services.map((svc: any) => {
    const match =
      lookup.get(String(svc.name).toLowerCase()) ??
      lookup.get(String(svc.type).toLowerCase());
    if (match) {
      return { ...svc, name: match.displayName, type: match.displayName, category: match.category };
    }
    return svc;
  });
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "azure-architecture",
  version: "1.0.0",
});

server.tool(
  "generate_architecture",
  "Generate an Azure architecture diagram from a natural language description. Returns structured JSON with groups, services, connections, and workflow steps that can be rendered by the Azure Architecture Diagram Builder UI.",
  {
    description: z
      .string()
      .describe(
        "Natural language description of the desired Azure architecture (e.g. 'A web app with Azure App Service, Cosmos DB backend, and CDN')"
      ),
    model: z
      .enum(["gpt-5.2", "gpt-4.1", "gpt-4.1-mini"])
      .default("gpt-4.1")
      .describe("Azure OpenAI model to use for generation"),
    reasoning_effort: z
      .enum(["low", "medium", "high"])
      .default("medium")
      .describe("Reasoning effort level (only applies to gpt-5.2)"),
  },
  async ({ description, model, reasoning_effort }) => {
    try {
      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
      ];

      const result = await callAzureOpenAI(messages, model, reasoning_effort);

      if (!result.content || result.content.trim().length === 0) {
        return {
          content: [{ type: "text" as const, text: "Error: Empty response from Azure OpenAI." }],
          isError: true,
        };
      }

      let architecture: Record<string, any>;
      try {
        architecture = JSON.parse(result.content);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Error: Invalid JSON from model:\n${result.content.slice(0, 500)}` }],
          isError: true,
        };
      }

      // Normalise names against known registry
      normaliseServices(architecture);

      // Ensure required arrays exist
      if (!Array.isArray(architecture.services)) {
        return {
          content: [{ type: "text" as const, text: "Error: Response missing 'services' array." }],
          isError: true,
        };
      }
      architecture.connections ??= [];
      architecture.groups ??= [];
      architecture.workflow ??= [];

      // Attach token usage metadata
      architecture.metadata = {
        model,
        reasoning_effort,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };

      const json = JSON.stringify(architecture, null, 2);

      return {
        content: [{ type: "text" as const, text: json }],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text" as const, text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});

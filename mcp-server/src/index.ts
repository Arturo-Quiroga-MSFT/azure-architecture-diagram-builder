#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure Architecture Diagram Builder — MCP Server
 *
 * Exposes the Diagram Builder's core capabilities as MCP tools so that
 * `az prototype` agents (or any MCP-compatible client) can:
 *
 *   1. Browse the Azure service catalog (68+ services with categories & pricing)
 *   2. Validate architectures against Azure WAF rules (deterministic, no LLM)
 *   3. Estimate monthly costs for a set of Azure services
 *   4. Generate an az prototype interchange manifest from services & connections
 *   5. Query WAF rules by pillar or service type
 *   6. Render professional architecture diagrams (SVG/HTML) replacing Mermaid
 *
 * Transport: stdio (JSON-RPC over stdin/stdout) — the standard for
 * local MCP integrations.
 *
 * Usage:
 *   node dist/index.js          # start server (stdio)
 *   npx azure-diagram-mcp       # via npx
 */

import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  SERVICE_CATALOG,
  resolveServiceName,
  getCategories,
  getServicesByCategory,
} from './serviceCatalog.js';

import {
  detectWafPatterns,
  getWafRules,
  groupFindingsByPillar,
} from './wafDetector.js';

import { computeLayout } from './layoutEngine.js';
import { renderSvg } from './svgRenderer.js';
import { renderHtml } from './htmlRenderer.js';
import { estimateServiceCost, getPricingMeta, type PricingTerm, type CostTier } from './pricing.js';
import { generateBicep } from './bicepGenerator.js';
import { generateTerraform } from './terraformGenerator.js';
import { generateDeploymentGuide } from './deploymentGuide.js';
import { hardenArchitecture } from './hardener.js';
import { importArchitecture } from './importer.js';

// Web app icon mapping (generated from src/data/serviceIconMapping.ts via
// scripts/sync-icon-map.mjs). Used by export_reactflow_scene to emit icon
// paths that match what the React Flow web app expects.
// Loaded at runtime via fs to avoid Node ESM JSON-import-attribute issues.
const __thisDir = dirname(fileURLToPath(import.meta.url));
const iconMap: Record<string, { iconFile: string; category: string }> = JSON.parse(
  readFileSync(resolvePath(__thisDir, 'iconMap.generated.json'), 'utf8'),
);

type IconEntry = { iconFile: string; category: string };
const ICON_MAP = iconMap as Record<string, IconEntry>;

// Shared guidance for connection/edge labels. Terse one-word labels ("data",
// "cache", "sync") make diagrams hard to read; this steers the calling model to
// write descriptive, action-oriented phrases like the web app produces.
const CONN_LABEL_DESC =
  'Descriptive, action-oriented label for what actually flows across this connection — a 3-6 word phrase, not a single generic word. ' +
  'Good: "Submit FHIR bundle for ingestion", "Publish order-placed events", "Query product catalog", "Cache session tokens", "Replicate writes to secondary region", "Authenticate via OAuth token". ' +
  'Avoid vague one-word labels like "data", "sync", "cache", "traffic", or "secrets" — say what moves and why.';

// Reverse map: icon file stem → canonical service name. Lets import_architecture
// recover a service type from a React Flow node's iconPath when the scene has no
// explicit type field.
const ICON_FILE_TO_TYPE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [name, entry] of Object.entries(ICON_MAP)) {
    if (entry?.iconFile && !out[entry.iconFile]) out[entry.iconFile] = name;
  }
  return out;
})();

function resolveIconPath(serviceType: string): { iconPath: string; category: string } {
  const canonical = resolveServiceName(serviceType);
  const entry = canonical ? ICON_MAP[canonical] : undefined;
  if (entry) {
    return {
      iconPath: `/Azure_Public_Service_Icons/Icons/${entry.category}/${entry.iconFile}.svg`,
      category: entry.category,
    };
  }
  // Fallback: unknown service — use a generic icon path slot
  return {
    iconPath: '/Azure_Public_Service_Icons/Icons/other/generic-service.svg',
    category: 'other',
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ── Server factory ─────────────────────────────────────────────────────
//
// Tool registrations are wrapped in createServer() so each transport
// (stdio for local clients; streamable-HTTP for remote clients like
// M365 Copilot or hosted agents) can spin up its own server instance.

export function createServer(): McpServer {
const server = new McpServer({
  name: 'azure-diagram-builder',
  version: '1.0.0',
});

// ── Tool 1: list_services ──────────────────────────────────────────────

server.tool(
  'list_services',
  'List Azure services available in the Diagram Builder. Returns service names, categories, aliases, pricing availability, and cost ranges. Optionally filter by category.',
  {
    category: z
      .string()
      .optional()
      .describe(
        'Filter by service category. Valid values: ' + getCategories().join(', '),
      ),
  },
  async ({ category }) => {
    const catalog = category
      ? getServicesByCategory(category)
      : SERVICE_CATALOG;

    const services = Object.entries(catalog).map(([key, info]) => ({
      key,
      displayName: info.displayName,
      category: info.category,
      aliases: info.aliases,
      hasPricingData: info.hasPricingData,
      isUsageBased: info.isUsageBased ?? false,
      costRange: info.costRange ?? 'N/A',
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              totalServices: services.length,
              categories: category ? [category] : getCategories(),
              services,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Tool 2: validate_architecture ──────────────────────────────────────

server.registerTool(
  'validate_architecture',
  {
    description:
      'Validate an Azure architecture against the Well-Architected Framework (WAF). Runs deterministic rule-based analysis — detects anti-patterns, missing best practices, and security gaps. Returns a 0-100 score, findings grouped by WAF pillar, and actionable recommendations. No LLM required.',
    inputSchema: {
      services: z
        .array(
          z.object({
            name: z.string().describe('Service instance name (e.g. "Web App Backend")'),
            type: z.string().describe('Azure service type (e.g. "App Service", "SQL Database")'),
          }),
        )
        .describe('List of Azure services in the architecture'),
      connections: z
        .array(
          z.object({
            from: z.string().describe('Source service name'),
            to: z.string().describe('Target service name'),
            label: z.string().optional().describe('Connection label'),
          }),
        )
        .optional()
        .describe('Connections between services'),
    },
    outputSchema: {
      score: z.number().describe('Overall WAF score, 0-100'),
      totalFindings: z.number(),
      patternsDetected: z.array(z.string()).describe('Architecture-level anti-pattern ids detected'),
      rulesApplied: z.object({
        pattern: z.number(),
        service: z.number(),
      }),
      findingsByPillar: z.record(
        z.string(),
        z.object({
          count: z.number(),
          findings: z.array(
            z.object({
              severity: z.string(),
              category: z.string(),
              issue: z.string(),
              recommendation: z.string(),
              resources: z.array(z.string()).optional(),
            }),
          ),
        }),
      ).describe('Findings grouped by WAF pillar'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ services, connections }) => {
    const conns = (connections ?? []).map(c => ({
      from: c.from,
      to: c.to,
      label: c.label,
    }));

    const result = detectWafPatterns(services, conns);
    const grouped = groupFindingsByPillar(result.findings);

    const structured = {
      score: result.score,
      totalFindings: result.findings.length,
      patternsDetected: result.patternsDetected,
      rulesApplied: {
        pattern: result.patternRulesApplied,
        service: result.serviceRulesApplied,
      },
      findingsByPillar: Object.fromEntries(
        Object.entries(grouped).map(([pillar, findings]) => [
          pillar,
          {
            count: findings.length,
            findings: findings.map(f => ({
              severity: f.severity,
              category: f.category,
              issue: f.issue,
              recommendation: f.recommendation,
              resources: f.resources,
            })),
          },
        ]),
      ),
    };

    const pillarCount = Object.keys(structured.findingsByPillar).length;
    const summary = `WAF score ${result.score}/100 — ${result.findings.length} finding(s) across ${pillarCount} pillar(s). Patterns detected: ${result.patternsDetected.length ? result.patternsDetected.join(', ') : 'none'}.`;

    return {
      content: [{ type: 'text' as const, text: summary }],
      structuredContent: structured,
    };
  },
);

// ── Tool 3: estimate_costs ─────────────────────────────────────────────

server.registerTool(
  'estimate_costs',
  {
    description:
      'Estimate monthly Azure costs for a list of services using live-derived Azure Retail Prices (distilled per region). Returns NUMERIC per-service monthly costs (low/expected/high) plus a real total and by-category totals, honoring region and pricing term (pay-as-you-go or 1-year reserved). Services without distilled pricing data fall back to a catalog cost range and are flagged.',
    inputSchema: {
      services: z
        .array(
          z.object({
            name: z.string().describe('Service instance name'),
            type: z.string().describe('Azure service type'),
            tier: z
              .string()
              .optional()
              .describe('Pricing tier. Allowed values: basic, standard, premium. Default: standard. Maps to low/expected/high SKU band.'),
            quantity: z.number().optional().describe('Number of instances (default: 1)'),
          }),
        )
        .describe('List of Azure services to estimate costs for'),
      region: z
        .string()
        .optional()
        .describe('Azure region (default: eastus2). Available: eastus2, swedencentral, westeurope, canadacentral, brazilsouth, australiaeast, southeastasia, mexicocentral'),
      term: z
        .string()
        .optional()
        .describe('Pricing term. Allowed values: payg (pay-as-you-go, default) or reserved1yr (1-year reserved / savings plan).'),
    },
    outputSchema: {
      region: z.string(),
      term: z.string(),
      currency: z.string(),
      pricesAsOf: z.string().nullable(),
      serviceCount: z.number(),
      hasPricingData: z.boolean(),
      totalMonthlyCost: z.object({ low: z.number(), expected: z.number(), high: z.number() }),
      byCategory: z.record(
        z.string(),
        z.object({ count: z.number(), services: z.array(z.string()), expectedMonthlyCost: z.number() }),
      ),
      estimates: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          category: z.string(),
          tier: z.string().optional(),
          quantity: z.number().optional(),
          hasPricingData: z.boolean(),
          currency: z.string().optional(),
          term: z.string().optional(),
          sampleSku: z.string().optional(),
          expectedBasis: z.string().optional(),
          reservedApplied: z.boolean().optional(),
          monthlyCostPerInstance: z
            .object({ low: z.number(), expected: z.number(), high: z.number() })
            .optional(),
          selectedMonthlyCost: z.number().optional(),
          totalMonthlyCost: z.number().optional(),
          pricesAsOf: z.string().nullable().optional(),
          catalogCostRange: z.string().optional(),
          note: z.string().optional(),
        }),
      ),
      servicesMissingData: z.array(z.string()),
      pricingSource: z.object({
        generatedAt: z.string(),
        currency: z.string(),
        regions: z.array(z.string()),
      }),
      note: z.string(),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ services, region, term }) => {
    const targetRegion = region ?? 'eastus2';
    const targetTerm: PricingTerm = term === 'reserved1yr' ? 'reserved1yr' : 'payg';

    const estimates: Array<Record<string, unknown>> = [];

    // Numeric running totals across services that have pricing data.
    const totals = { low: 0, expected: 0, high: 0 };
    const categoryTotals = new Map<
      string,
      { count: number; services: string[]; expectedMonthlyCost: number }
    >();
    let anyPricingData = false;
    let currency = 'USD';
    let pricesAsOf: string | null = null;
    const servicesMissingData: string[] = [];

    for (const svc of services) {
      const resolved = resolveServiceName(svc.type);
      const info = resolved ? SERVICE_CATALOG[resolved] : null;
      const tier = (svc.tier as CostTier) ?? 'standard';
      const qty = svc.quantity && svc.quantity > 0 ? svc.quantity : 1;

      const cat = info?.category ?? 'other';
      if (!categoryTotals.has(cat)) {
        categoryTotals.set(cat, { count: 0, services: [], expectedMonthlyCost: 0 });
      }
      const catEntry = categoryTotals.get(cat)!;
      catEntry.count += qty;
      catEntry.services.push(svc.name);

      // Prefer the explicit pricingServiceName from the catalog; fall back to
      // the resolved catalog key or the raw type.
      const pricingName = info?.pricingServiceName ?? resolved ?? svc.type;
      const est = estimateServiceCost({
        pricingServiceName: pricingName,
        region: targetRegion,
        term: targetTerm,
        tier,
        quantity: qty,
      });

      if (est.hasPricingData && est.monthlyCost) {
        anyPricingData = true;
        currency = est.currency ?? currency;
        if (est.pricesAsOf && (!pricesAsOf || est.pricesAsOf > pricesAsOf)) {
          pricesAsOf = est.pricesAsOf;
        }
        totals.low += est.monthlyCost.low * qty;
        totals.expected += est.monthlyCost.expected * qty;
        totals.high += est.monthlyCost.high * qty;
        catEntry.expectedMonthlyCost += est.selectedMonthlyCost ? est.selectedMonthlyCost * qty : est.monthlyCost.expected * qty;

        estimates.push({
          name: svc.name,
          type: resolved ?? svc.type,
          category: cat,
          tier,
          quantity: qty,
          hasPricingData: true,
          currency: est.currency,
          term: targetTerm,
          sampleSku: est.sampleSku,
          expectedBasis: est.expectedBasis,
          reservedApplied: est.reservedApplied ?? false,
          monthlyCostPerInstance: est.monthlyCost,
          selectedMonthlyCost: est.selectedMonthlyCost,
          totalMonthlyCost: est.totalMonthlyCost,
          pricesAsOf: est.pricesAsOf,
        });
      } else {
        servicesMissingData.push(svc.name);
        estimates.push({
          name: svc.name,
          type: resolved ?? svc.type,
          category: cat,
          tier,
          quantity: qty,
          hasPricingData: false,
          catalogCostRange: info?.costRange ?? 'No pricing data available',
          note: info?.isUsageBased
            ? 'Usage-based service — see catalog range; numeric distillation pending (P0-1b: AI/Fabric/per-GB).'
            : 'No distilled pricing for this service/region; using catalog range.',
        });
      }
    }

    const roundedTotals = {
      low: Math.round(totals.low * 100) / 100,
      expected: Math.round(totals.expected * 100) / 100,
      high: Math.round(totals.high * 100) / 100,
    };

    const structured = {
      region: targetRegion,
      term: targetTerm,
      currency,
      pricesAsOf,
      serviceCount: services.length,
      hasPricingData: anyPricingData,
      totalMonthlyCost: roundedTotals,
      byCategory: Object.fromEntries(
        [...categoryTotals.entries()].map(([cat, data]) => [
          cat,
          {
            count: data.count,
            services: data.services,
            expectedMonthlyCost: Math.round(data.expectedMonthlyCost * 100) / 100,
          },
        ]),
      ),
      estimates,
      servicesMissingData,
      pricingSource: getPricingMeta(),
      note:
        'Numeric costs are derived from a distilled Azure Retail Prices snapshot (per region). Coverage: instance-priced services use a representative typical-deployment SKU (e.g. App Service P1v3, Redis C1, SQL S3, VM D2s v4, AKS Standard) with low/high spanning the SKU range; Microsoft Fabric uses F-SKU capacity (F2/F8/F64 reservation monthly). Usage-based services — AI (Foundry, per-token), per-GB storage, and composite-billed networking (App Gateway, Firewall, VPN, Load Balancer, managed-DB Flexible Server) — report curated catalog ranges instead, because a fixed monthly would mislead. For authoritative quotes use the Azure Pricing Calculator.',
    };

    const missingNote = servicesMissingData.length
      ? ` ${servicesMissingData.length} service(s) use catalog ranges: ${servicesMissingData.join(', ')}.`
      : '';
    const summary = `Estimated total ~$${roundedTotals.expected.toLocaleString()}/mo expected ($${roundedTotals.low.toLocaleString()}–$${roundedTotals.high.toLocaleString()} range) in ${targetRegion} (${targetTerm}, ${currency}).${missingNote}`;

    return {
      content: [{ type: 'text' as const, text: summary }],
      structuredContent: structured,
    };
  },
);

// ── Tool 4: generate_manifest ──────────────────────────────────────────

server.tool(
  'generate_manifest',
  'Generate an az prototype interchange manifest (JSON) from a list of services and connections. The manifest can be imported into the Azure Architecture Diagram Builder or consumed by `az prototype build` for IaC generation.',
  {
    projectName: z.string().describe('Project name for the architecture'),
    location: z.string().optional().describe('Azure region (default: eastus2)'),
    iacTool: z
      .string()
      .describe('Output IaC format. Allowed values: bicep, terraform')
      .optional()
      .describe('Infrastructure as Code tool (default: bicep)'),
    services: z
      .array(
        z.object({
          name: z.string().describe('Service instance name'),
          type: z.string().describe('Azure service type'),
          description: z.string().optional().describe('Service description'),
          groupId: z.string().optional().describe('Group ID this service belongs to'),
        }),
      )
      .describe('List of Azure services'),
    connections: z
      .array(
        z.object({
          from: z.string().describe('Source service name'),
          to: z.string().describe('Target service name'),
          label: z.string().optional().describe(CONN_LABEL_DESC),
          type: z
            .string()
            .optional()
            .describe('Connection type. Allowed values: sync, async, optional'),
        }),
      )
      .optional()
      .describe('Connections between services'),
    groups: z
      .array(
        z.object({
          id: z.string().describe('Group identifier'),
          label: z.string().describe('Display label'),
        }),
      )
      .optional()
      .describe('Logical service groups'),
  },
  async ({ projectName, location, iacTool, services, connections, groups }) => {
    const manifest = {
      schemaVersion: '1.0' as const,
      source: 'azure-diagram-builder' as const,
      createdAt: new Date().toISOString(),
      project: {
        name: projectName,
        location: location ?? 'eastus2',
        iacTool: iacTool ?? 'bicep',
      },
      architecture: {
        services: services.map((s, i) => {
          const resolved = resolveServiceName(s.type);
          const info = resolved ? SERVICE_CATALOG[resolved] : null;
          return {
            id: `svc-${i + 1}`,
            name: s.name,
            type: resolved ?? s.type,
            category: info?.category ?? 'other',
            description: s.description ?? `${info?.displayName ?? s.type} instance`,
            groupId: s.groupId ?? null,
          };
        }),
        connections: (connections ?? []).map(c => ({
          from: c.from,
          to: c.to,
          label: c.label ?? '',
          type: c.type ?? ('sync' as const),
        })),
        groups: groups ?? [],
        workflow: [],
      },
      metadata: {
        generatedBy: 'azure-diagram-builder-mcp',
        serviceCount: services.length,
        connectionCount: (connections ?? []).length,
      },
    };

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(manifest, null, 2),
        },
      ],
    };
  },
);

// ── Tool 4b: generate_bicep ────────────────────────────────────────────

server.tool(
  'generate_bicep',
  'Generate deployable Bicep (IaC) from a list of services and connections, with Well-Architected secure defaults PRE-SET: App Service HTTPS-only + TLS 1.2 + managed identity + health check + autoscale + staging slot, Key Vault soft-delete + purge protection + RBAC, Storage HTTPS-only/no-public-access, Cosmos DB automatic failover + continuous backup, Redis TLS 1.2, plus managed-identity Key Vault role assignments. Resolves the config-level WAF findings that cannot be expressed in a diagram. Returns the Bicep text and a structured map of which WAF finding each setting resolves. Design-time only — never deploys.',
  {
    projectName: z.string().optional().describe('Project name (used for namePrefix). Default: workload'),
    location: z.string().optional().describe('Azure region (default: eastus2)'),
    iacTool: z
      .string()
      .optional()
      .describe('IaC format. Allowed values: bicep (default). For Terraform, use the dedicated generate_terraform tool.'),
    services: z
      .array(
        z.object({
          name: z.string().describe('Service instance name'),
          type: z.string().describe('Azure service type (e.g. "App Service", "Key Vault")'),
          description: z.string().optional().describe('Service description'),
          groupId: z.string().optional().describe('Group ID this service belongs to'),
        }),
      )
      .describe('List of Azure services to generate Bicep for'),
    connections: z
      .array(
        z.object({
          from: z.string().describe('Source service name'),
          to: z.string().describe('Target service name'),
          label: z.string().optional().describe('Connection label'),
        }),
      )
      .optional()
      .describe('Connections between services'),
  },
  async ({ projectName, location, iacTool, services, connections }) => {
    const result = generateBicep({
      services,
      connections,
      projectName,
      location,
      iacTool,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              iacTool: result.iacTool,
              servicesCovered: result.servicesCovered,
              servicesGeneric: result.servicesGeneric,
              findingsResolved: result.findingsResolved,
              findingsResolvedCount: result.findingsResolved.length,
              note: result.note,
              bicep: result.bicep,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Tool 4c: generate_terraform ────────────────────────────────────────

server.tool(
  'generate_terraform',
  'Generate deployable Terraform (azurerm provider) from a list of services and connections, with Well-Architected secure defaults PRE-SET: App Service (Linux web app) HTTPS-only + TLS 1.2 + managed identity + health check + autoscale + staging slot, Key Vault soft-delete + purge protection + RBAC, Storage HTTPS-only/no-public-access, Cosmos DB automatic failover + continuous backup, Redis TLS 1.2, AI Search keyless, Container Apps HTTPS-only ingress, plus Key Vault Secrets User role assignments for managed identities. Emits a resource group + azurerm provider block. Resolves the config-level WAF findings that cannot be expressed in a diagram. Returns the HCL and a structured map of which WAF finding each attribute resolves. Design-time only — never runs terraform apply.',
  {
    projectName: z.string().optional().describe('Project name (used for name_prefix variable). Default: workload'),
    location: z.string().optional().describe('Azure region (default: eastus2)'),
    services: z
      .array(
        z.object({
          name: z.string().describe('Service instance name'),
          type: z.string().describe('Azure service type (e.g. "App Service", "Key Vault")'),
          description: z.string().optional().describe('Service description'),
          groupId: z.string().optional().describe('Group ID this service belongs to'),
        }),
      )
      .describe('List of Azure services to generate Terraform for'),
    connections: z
      .array(
        z.object({
          from: z.string().describe('Source service name'),
          to: z.string().describe('Target service name'),
          label: z.string().optional().describe('Connection label'),
        }),
      )
      .optional()
      .describe('Connections between services'),
  },
  async ({ projectName, location, services, connections }) => {
    const result = generateTerraform({ services, connections, projectName, location });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              iacTool: result.iacTool,
              servicesCovered: result.servicesCovered,
              servicesGeneric: result.servicesGeneric,
              findingsResolved: result.findingsResolved,
              findingsResolvedCount: result.findingsResolved.length,
              note: result.note,
              terraform: result.terraform,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Tool 4d: generate_deployment_guide ────────────────────────────────

server.tool(
  'generate_deployment_guide',
  'Generate a step-by-step Markdown deployment runbook for an architecture: prerequisites, az login, resource group, IaC deploy commands (Bicep via `az deployment group create`, or Terraform via `init/plan/apply`), a post-deploy config-hardening checklist derived from the WAF service-level findings, per-service smoke tests, and teardown. Pairs with generate_bicep / generate_terraform. Deterministic, design-time only — it never deploys.',
  {
    projectName: z.string().optional().describe('Project name (used for resource group + name prefix). Default: workload'),
    location: z.string().optional().describe('Azure region (default: eastus2)'),
    iacTool: z
      .string()
      .optional()
      .describe('Which IaC the guide targets. Allowed values: bicep (default), terraform.'),
    services: z
      .array(
        z.object({
          name: z.string().describe('Service instance name'),
          type: z.string().describe('Azure service type'),
          groupId: z.string().optional().describe('Group ID this service belongs to'),
        }),
      )
      .describe('List of Azure services in the architecture'),
    connections: z
      .array(
        z.object({
          from: z.string().describe('Source service name'),
          to: z.string().describe('Target service name'),
          label: z.string().optional().describe('Connection label'),
        }),
      )
      .optional()
      .describe('Connections between services'),
  },
  async ({ projectName, location, iacTool, services, connections }) => {
    const result = generateDeploymentGuide({ services, connections, projectName, location, iacTool });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              iacTool: result.iacTool,
              steps: result.steps,
              checklistItems: result.checklistItems,
              markdown: result.markdown,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Tool 5: get_waf_rules ──────────────────────────────────────────────

server.registerTool(
  'harden_architecture',
  {
    description:
      'Deterministically HARDEN an architecture by clearing pattern-level WAF anti-patterns (single-region, no-identity, no-waf, no-api-gateway, direct-db-access, single-database, no-cache, no-key-vault, no-backup, no-monitoring). Adds the remediating services (Entra ID, Front Door + WAF, API Management, geo-replica, Redis, Key Vault, Backup, Monitor) and rewires connections, then re-validates. Returns the hardened services/connections/groups (ready to pass to render_diagram, generate_bicep, or export_reactflow_scene), a change log, and before/after WAF scores. Collapses the manual add-service → re-validate loop into one call. No LLM. Only fixes topology; config-level findings are resolved by generate_bicep.',
    inputSchema: {
      services: z
        .array(
          z.object({
            name: z.string().describe('Service instance name'),
            type: z.string().describe('Azure service type (e.g. "App Service", "SQL Database")'),
            description: z.string().optional().describe('Service description'),
            groupId: z.string().optional().describe('Group ID this service belongs to'),
          }),
        )
        .describe('List of Azure services in the current architecture'),
      connections: z
        .array(
          z.object({
            from: z.string().describe('Source service name'),
            to: z.string().describe('Target service name'),
            label: z.string().optional().describe('Connection label'),
            type: z.string().optional().describe('Connection type. Allowed values: sync, async, optional'),
          }),
        )
        .optional()
        .describe('Connections between services'),
      groups: z
        .array(
          z.object({
            id: z.string().describe('Group identifier'),
            label: z.string().describe('Display label'),
          }),
        )
        .optional()
        .describe('Existing logical service groups (new groups are appended as needed)'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ services, connections, groups }) => {
    const result = hardenArchitecture(
      services,
      (connections ?? []).map(c => ({ from: c.from, to: c.to, label: c.label, type: c.type as any })),
      groups ?? [],
    );

    const summary =
      `Hardened: WAF score ${result.before.score} → ${result.after.score}. ` +
      `Patterns ${result.before.patternsDetected.length} → ${result.after.patternsDetected.length}` +
      (result.after.patternsDetected.length ? ` (remaining: ${result.after.patternsDetected.join(', ')})` : ' (all cleared)') +
      `. ${result.changes.length} change(s) applied.`;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              summary,
              before: result.before,
              after: result.after,
              changes: result.changes,
              unresolved: result.unresolved,
              note: result.note,
              services: result.services,
              connections: result.connections,
              groups: result.groups,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  'import_architecture',
  {
    description:
      'Import an existing architecture back into the canonical { services, connections, groups } shape — the inverse of generate_manifest and export_reactflow_scene. Accepts an az prototype interchange manifest (clean round-trip) OR a React Flow scene JSON (from this server or the web app; service types are recovered from data.azureServiceType, or reversed from the icon path). Returns the normalized architecture ready to feed straight into validate_architecture, harden_architecture, estimate_costs, render_diagram, or generate_bicep. Tolerant: collects warnings instead of failing on partially-recognized input.',
    inputSchema: {
      content: z
        .string()
        .describe('The architecture document as a JSON string — either an az prototype manifest or a React Flow scene.'),
      format: z
        .string()
        .optional()
        .describe('Format hint. Allowed values: auto (default), manifest, reactflow. Auto-detected from the document shape when omitted.'),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ content }) => {
    let result;
    try {
      result = importArchitecture(content, { iconFileToType: ICON_FILE_TO_TYPE });
    } catch (e) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `import_architecture failed: ${(e as Error).message}` }],
      };
    }

    const summary =
      `Imported ${result.format}: ${result.services.length} service(s), ` +
      `${result.connections.length} connection(s), ${result.groups.length} group(s)` +
      (result.warnings.length ? `. ${result.warnings.length} warning(s).` : '.');

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              summary,
              format: result.format,
              projectName: result.projectName,
              location: result.location,
              warnings: result.warnings,
              services: result.services,
              connections: result.connections,
              groups: result.groups,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Tool 5: get_waf_rules ──────────────────────────────────────────────

server.registerTool(
  'get_waf_rules',
  {
    description:
      'Get Azure Well-Architected Framework rules from the Diagram Builder knowledge base. Returns architecture-wide pattern rules and per-service best practices. Optionally filter by WAF pillar.',
    inputSchema: {
      pillar: z
        .string()
        .optional()
        .describe('Filter rules by WAF pillar. Allowed values: Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency'),
      serviceType: z
        .string()
        .optional()
        .describe(
          'Filter rules that apply to a specific Azure service type (e.g. "App Service", "SQL Database")',
        ),
    },
    outputSchema: {
      totalRules: z.number(),
      filters: z.object({ pillar: z.string(), serviceType: z.string() }),
      rulesByPillar: z.record(z.string(), z.number()),
      rules: z.array(
        z.object({
          id: z.string(),
          pillar: z.string(),
          severity: z.string(),
          category: z.string(),
          issue: z.string(),
          recommendation: z.string(),
          appliesTo: z.array(z.string()),
          pattern: z.string().optional(),
        }),
      ),
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ pillar, serviceType }) => {
    let rules = getWafRules(pillar as any);

    if (serviceType) {
      const lower = serviceType.toLowerCase().trim();
      rules = rules.filter(
        r =>
          r.appliesTo.includes('*') ||
          r.appliesTo.some(t => t.toLowerCase() === lower),
      );
    }

    const byPillar: Record<string, number> = {};
    for (const r of rules) {
      byPillar[r.pillar] = (byPillar[r.pillar] ?? 0) + 1;
    }

    const structured = {
      totalRules: rules.length,
      filters: {
        pillar: pillar ?? 'all',
        serviceType: serviceType ?? 'all',
      },
      rulesByPillar: byPillar,
      rules: rules.map(r => ({
        id: r.id,
        pillar: r.pillar,
        severity: r.severity,
        category: r.category,
        issue: r.issue,
        recommendation: r.recommendation,
        appliesTo: r.appliesTo,
        pattern: r.pattern,
      })),
    };

    const summary = `${rules.length} WAF rule(s)${pillar ? ` for pillar "${pillar}"` : ''}${serviceType ? ` applying to "${serviceType}"` : ''}. By pillar: ${Object.entries(byPillar).map(([p, n]) => `${p}: ${n}`).join(', ') || 'none'}.`;

    return {
      content: [{ type: 'text' as const, text: summary }],
      structuredContent: structured,
    };
  },
);

// ── Tool 6: render_diagram ──────────────────────────────────────────────

server.tool(
  'render_diagram',
  'Render a professional Azure architecture diagram as SVG (for embedding in markdown/SpecKit docs) or as self-contained interactive HTML (with pan, zoom, hover tooltips). Replaces Mermaid text diagrams with Azure-branded visuals using official category colors, dagre layout, and directional edges. IMPORTANT: give every connection a descriptive, action-oriented label (a 3-6 word phrase describing what flows and why, e.g. "Submit FHIR bundle for ingestion"), not a terse one-word label like "data" or "sync" — readable edge labels are what make the diagram understandable.',
  {
    title: z
      .string()
      .optional()
      .describe('Diagram title (displayed at the top)'),
    format: z
      .string()
      .describe('Output format. Allowed values: svg, html')
      .optional()
      .describe('Output format: svg (static, for markdown embedding) or html (interactive viewer). Default: svg'),
    direction: z
      .string()
      .describe('Diagram direction. Allowed values: TB (top-to-bottom), LR (left-to-right)')
      .optional()
      .describe('Layout direction: TB (top-to-bottom) or LR (left-to-right). Default: TB'),
    theme: z
      .string()
      .optional()
      .describe('Visual theme for SVG output. Allowed values: light (default), dark.'),
    region: z
      .string()
      .optional()
      .describe('Azure region used for best-effort per-node cost badges (e.g. eastus2). Default: eastus2. Set to "none" to disable cost badges.'),
    author: z
      .string()
      .optional()
      .describe('Author shown in the SVG metadata panel (top-right).'),
    generatedBy: z
      .string()
      .optional()
      .describe('Provenance label for the SVG metadata panel, e.g. the model that produced the design.'),
    services: z
      .array(
        z.object({
          name: z.string().describe('Service instance name'),
          type: z.string().describe('Azure service type (e.g. "App Service", "SQL Database")'),
          description: z.string().optional().describe('Service description (shown in tooltips for HTML format)'),
          groupId: z.string().optional().describe('Group ID this service belongs to'),
        }),
      )
      .describe('List of Azure services in the architecture'),
    connections: z
      .array(
        z.object({
          from: z.string().describe('Source service name'),
          to: z.string().describe('Target service name'),
          label: z.string().optional().describe(CONN_LABEL_DESC),
          type: z
            .string()
            .optional()
            .describe('Connection type. Allowed values: sync (solid), async (dashed purple), optional (dotted gray)'),
        }),
      )
      .optional()
      .describe('Connections between services. Label each one descriptively so a reader understands the data flow.'),
    groups: z
      .array(
        z.object({
          id: z.string().describe('Group identifier (referenced by services\' groupId)'),
          label: z.string().describe('Display label for the group'),
        }),
      )
      .optional()
      .describe('Logical service groups (rendered as dashed containers)'),
  },
  async ({ title, format, direction, services, connections, groups, theme, region, author, generatedBy }) => {
    const fmt = format ?? 'svg';
    const dir = direction ?? 'TB';

    const layout = computeLayout(
      services.map(s => ({ name: s.name, type: s.type, description: s.description, groupId: s.groupId })),
      (connections ?? []).map(c => ({ from: c.from, to: c.to, label: c.label, type: c.type as any })),
      groups ?? [],
      dir as any,
    );

    // Best-effort per-node cost enrichment (SVG cost badges + total footer).
    // Uses the same service→pricing resolution as the estimate_costs tool.
    // Skipped when region === 'none'.
    if (region !== 'none') {
      const targetRegion = region ?? 'eastus2';
      for (const node of layout.nodes) {
        const resolved = resolveServiceName(node.type);
        const info = resolved ? SERVICE_CATALOG[resolved] : null;
        const pricingName = info?.pricingServiceName ?? resolved ?? node.type;
        const est = estimateServiceCost({ pricingServiceName: pricingName, region: targetRegion });
        if (est.hasPricingData && est.totalMonthlyCost != null && est.totalMonthlyCost > 0) {
          node.estimatedCost = est.totalMonthlyCost;
          node.costCurrency = est.currency ?? 'USD';
        } else if (info?.costRange) {
          // No firm numeric estimate (usage-based / composite billing): fall
          // back to the curated catalog range so the badge isn't blank.
          node.costRange = info.costRange;
          node.isUsageBased = info.isUsageBased ?? false;
        }
      }
    }

    const output = fmt === 'html'
      ? renderHtml(layout, title, {
          theme: theme === 'dark' ? 'dark' : 'light',
          author,
          generatedBy,
        })
      : renderSvg(layout, title, {
          theme: theme === 'dark' ? 'dark' : 'light',
          author,
          generatedBy,
        });

    return {
      content: [
        {
          type: 'text' as const,
          text: output,
        },
      ],
    };
  },
);

// ── Tool 7: export_reactflow_scene ─────────────────────────────────────

server.tool(
  'export_reactflow_scene',
  'Export an Azure architecture as a React Flow scene JSON compatible with the Azure Architecture Diagram Builder web app. Reuses the dagre layout engine for positions and the web app icon catalog for icon paths. The result can be imported directly into the web app (Open / Import Architecture).',
  {
    architectureName: z.string().optional().describe('Display name shown in the architecture metadata block. Default: "MCP Generated Architecture"'),
    architecturePrompt: z.string().optional().describe('Original natural-language prompt the diagram was generated from (preserved in the JSON for provenance)'),
    author: z.string().optional().describe('Author shown in the metadata. Default: "Azure Architect"'),
    direction: z.string().optional().describe('Layout direction: TB (top-to-bottom), LR (left-to-right), or auto. Default: auto (picks LR for 4+ groups or dense graphs, TB otherwise).'),
    region: z.string().optional().describe('Azure region for best-effort per-node pricing embedded in each node (e.g. eastus2). Default: eastus2. Set to "none" to omit pricing.'),
    services: z.array(z.object({
      name: z.string().describe('Service instance name (becomes the node label)'),
      type: z.string().describe('Azure service type (e.g. "App Service", "SQL Database")'),
      description: z.string().optional().describe('Optional description'),
      groupId: z.string().optional().describe('Optional group ID this service belongs to'),
    })).describe('List of Azure services in the architecture'),
    connections: z.array(z.object({
      from: z.string().describe('Source service name'),
      to: z.string().describe('Target service name'),
      label: z.string().optional().describe('Edge label'),
      type: z.string().optional().describe('Connection type. Allowed values: sync, async, optional'),
    })).optional().describe('Connections between services'),
    groups: z.array(z.object({
      id: z.string().describe('Group identifier (referenced by services\' groupId)'),
      label: z.string().describe('Display label for the group'),
    })).optional().describe('Logical service groups (rendered as group containers)'),
    workflow: z.array(z.object({
      step: z.number().describe('1-based step number'),
      description: z.string().describe('Human-readable description of this step'),
      services: z.array(z.string()).describe('Service names involved in this step'),
    })).optional().describe('Optional ordered workflow narrative shown in the web app'),
  },
  async ({ architectureName, architecturePrompt, author, direction, services, connections, groups, workflow, region }) => {
    // ── Auto direction heuristic ────────────────────────────────────────
    // 'auto' (default) picks LR when many groups would stack too tall in TB:
    //   - 4+ groups OR
    //   - average group has 4+ services AND total > 12 services
    // Otherwise TB. Explicit 'TB'/'LR' wins.
    const grpsForDir = groups ?? [];
    const svcsPerGroup = grpsForDir.length
      ? services.filter(s => s.groupId).length / grpsForDir.length
      : 0;
    const dir: 'TB' | 'LR' =
      direction === 'TB' || direction === 'LR'
        ? direction
        : (grpsForDir.length >= 4 || (svcsPerGroup >= 4 && services.length > 12))
          ? 'LR'
          : 'TB';

    const conns = (connections ?? []).map(c => ({
      from: c.from,
      to: c.to,
      label: c.label,
      type: (c.type as 'sync' | 'async' | 'optional' | undefined),
    }));
    const grps = groups ?? [];

    const layout = computeLayout(
      services.map(s => ({ name: s.name, type: s.type, description: s.description, groupId: s.groupId })),
      conns,
      grps,
      dir,
    );

    // Build deterministic node IDs from service names
    const nodeIdByName = new Map<string, string>();
    for (const s of services) {
      const slug = slugify(s.name) || `node-${nodeIdByName.size + 1}`;
      let candidate = `svc-${slug}`;
      let n = 2;
      while ([...nodeIdByName.values()].includes(candidate)) {
        candidate = `svc-${slug}-${n++}`;
      }
      nodeIdByName.set(s.name, candidate);
    }
    const groupIdToNodeId = new Map<string, string>();
    for (const g of grps) {
      groupIdToNodeId.set(g.id, `grp-${slugify(g.id) || g.label.toLowerCase().replace(/\W+/g, '-')}`);
    }

    // ── Group padding ───────────────────────────────────────────────────
    // Inflate dagre's tight cluster bounds so child nodes don't crowd the
    // group title bar. Top gets extra padding for the label; sides/bottom
    // are symmetric.
    const GROUP_PAD_TOP = 50;
    const GROUP_PAD_SIDE = 30;
    const GROUP_PAD_BOTTOM = 30;
    const paddedGroupBounds = new Map<string, { x: number; y: number; width: number; height: number; label: string; color: string }>();
    for (const g of layout.groups) {
      paddedGroupBounds.set(g.id, {
        x: g.x - GROUP_PAD_SIDE,
        y: g.y - GROUP_PAD_TOP,
        width: g.width + GROUP_PAD_SIDE * 2,
        height: g.height + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
        label: g.label,
        color: g.color,
      });
    }

    // ── Group nodes (React Flow) ─────────────────────────────────────────
    const groupNodes = layout.groups.map(g => {
      const id = groupIdToNodeId.get(g.id)!;
      const b = paddedGroupBounds.get(g.id)!;
      return {
        id,
        type: 'groupNode',
        position: { x: b.x, y: b.y },
        data: { label: g.label, stylePreset: 'presentation' },
        style: { width: b.width, height: b.height },
        width: b.width,
        height: b.height,
      };
    });

    // ── Service nodes (React Flow) ───────────────────────────────────────
    // Track absolute positions per service id for per-edge handle picking.
    const absoluteByNodeId = new Map<string, { x: number; y: number; width: number; height: number }>();
    const pricingRegion = region && region !== 'none' ? region : (region === 'none' ? null : 'eastus2');
    const serviceNodes = layout.nodes.map(n => {
      const id = nodeIdByName.get(n.name)!;
      const { iconPath } = resolveIconPath(n.type);
      const parentBounds = n.groupId ? paddedGroupBounds.get(n.groupId) : undefined;
      const parentNodeId = n.groupId ? groupIdToNodeId.get(n.groupId) : undefined;

      // React Flow expects child positions RELATIVE to the parent group;
      // positionAbsolute remains in canvas coordinates.
      const position = parentBounds
        ? { x: n.x - parentBounds.x, y: n.y - parentBounds.y }
        : { x: n.x, y: n.y };
      const positionAbsolute = { x: n.x, y: n.y };
      absoluteByNodeId.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });

      // Best-effort pricing object (matches the web app's node.data.pricing
      // shape so imported scenes show cost badges). Numeric estimatedCost is
      // only present for services with distilled pricing data; usage-based
      // services carry the flag with a null estimate.
      let pricing: Record<string, unknown> | undefined;
      if (pricingRegion) {
        const resolved = resolveServiceName(n.type);
        const info = resolved ? SERVICE_CATALOG[resolved] : null;
        const pricingName = info?.pricingServiceName ?? resolved ?? n.type;
        const est = estimateServiceCost({ pricingServiceName: pricingName, region: pricingRegion });
        pricing = {
          estimatedCost: est.hasPricingData ? est.totalMonthlyCost ?? null : null,
          tier: est.selectedTier ? est.selectedTier.charAt(0).toUpperCase() + est.selectedTier.slice(1) : 'Standard',
          skuName: est.sampleSku ?? 'Standard',
          quantity: 1,
          region: pricingRegion,
          unit: est.hasPricingData ? 'per instance/month' : 'usage-based',
          lastUpdated: new Date().toISOString(),
          isCustom: false,
          isUsageBased: info?.isUsageBased ?? false,
        };
      }

      const node: Record<string, unknown> = {
        id,
        type: 'azureNode',
        position,
        positionAbsolute,
        data: {
          label: n.name,
          iconPath,
          stylePreset: 'presentation',
          ...(pricing ? { pricing } : {}),
          ...(n.description ? { description: n.description } : {}),
        },
        width: n.width,
        height: n.height,
      };
      if (parentNodeId) {
        node.parentNode = parentNodeId;
        node.extent = 'parent';
      }
      return node;
    });

    const nodes = [...groupNodes, ...serviceNodes];

    // ── Edges (React Flow editableEdge) ──────────────────────────────────
    // Per-edge handle selection: pick handles from the dominant axis between
    // source and target node centers, so back-edges don't U-turn.
    function pickHandles(srcId: string, tgtId: string): { sourceHandle: string; targetHandle: string } {
      const s = absoluteByNodeId.get(srcId);
      const t = absoluteByNodeId.get(tgtId);
      if (!s || !t) {
        return dir === 'TB'
          ? { sourceHandle: 'bottom', targetHandle: 'top' }
          : { sourceHandle: 'right',  targetHandle: 'left' };
      }
      const sx = s.x + s.width / 2, sy = s.y + s.height / 2;
      const tx = t.x + t.width / 2, ty = t.y + t.height / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      // AzureNode exposes asymmetric handle ids: sources are
      // top-source/left-source/right/bottom; targets are top/left/right-target/
      // bottom-target. Emit ids that exist on the matching handle type, else the
      // edge silently fails to render.
      if (Math.abs(dx) > Math.abs(dy)) {
        return dx >= 0
          ? { sourceHandle: 'right', targetHandle: 'left' }
          : { sourceHandle: 'left-source',  targetHandle: 'right-target' };
      }
      return dy >= 0
        ? { sourceHandle: 'bottom', targetHandle: 'top' }
        : { sourceHandle: 'top-source',    targetHandle: 'bottom-target' };
    }

    const validConns = conns.filter(c => nodeIdByName.has(c.from) && nodeIdByName.has(c.to));

    // ── Edge label de-collision ─────────────────────────────────────────
    // Bucket each edge's midpoint into a coarse grid; assign alternating
    // labelOffsetY values so labels in the same bucket don't stack.
    const BUCKET_W = 140;
    const BUCKET_H = 70;
    const bucketCounters = new Map<string, number>();
    function offsetForMidpoint(mx: number, my: number): { dx: number; dy: number } {
      const key = `${Math.round(mx / BUCKET_W)}|${Math.round(my / BUCKET_H)}`;
      const idx = bucketCounters.get(key) ?? 0;
      bucketCounters.set(key, idx + 1);
      if (idx === 0) return { dx: 0, dy: 0 };
      // Sequence: -22, +22, -44, +44, -66, +66, ...
      const step = Math.ceil(idx / 2) * 22;
      const sign = idx % 2 === 1 ? -1 : 1;
      return { dx: 0, dy: sign * step };
    }

    const edges = validConns.map((c, idx) => {
      const sourceId = nodeIdByName.get(c.from)!;
      const targetId = nodeIdByName.get(c.to)!;
      const connectionType = c.type ?? 'sync';
      const { sourceHandle, targetHandle } = pickHandles(sourceId, targetId);

      const s = absoluteByNodeId.get(sourceId)!;
      const t = absoluteByNodeId.get(targetId)!;
      const mx = (s.x + s.width / 2 + t.x + t.width / 2) / 2;
      const my = (s.y + s.height / 2 + t.y + t.height / 2) / 2;
      const { dx, dy } = offsetForMidpoint(mx, my);

      return {
        id: `edge-${idx}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
        animated: false,
        type: 'editableEdge',
        label: c.label ?? '',
        markerEnd: { type: 'arrowclosed', color: '#0078d4' },
        labelStyle: { fontSize: 13, fill: '#333', fontWeight: '600', opacity: 1 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.95, stroke: '#000', strokeWidth: 1.5, rx: 6 },
        style: { strokeWidth: 2 },
        data: {
          connectionType,
          direction: 'forward',
          baseFlowAnimated: connectionType !== 'optional',
          flowAnimated: connectionType !== 'optional',
          flowMode: connectionType === 'async' ? 'pulse' : 'directional',
          pathStyle: 'orthogonal',
          labelOffsetX: dx,
          labelOffsetY: dy,
        },
      };
    });

    // ── Viewport: center the bounding box at zoom 0.65 ───────────────────
    const viewport = {
      x: -layout.width  / 2 + 600,
      y: -layout.height / 2 + 400,
      zoom: 0.65,
    };

    const today = new Date().toISOString().split('T')[0];
    const scene = {
      nodes,
      edges,
      viewport,
      metadata: {
        architectureName: architectureName ?? 'MCP Generated Architecture',
        author: author ?? 'Azure Architect',
        version: '1.0',
        date: today,
        savedAt: new Date().toISOString(),
      },
      workflow: workflow ?? [],
      ...(architecturePrompt ? { architecturePrompt } : {}),
    };

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(scene, null, 2) },
      ],
    };
  },
);

// ── Resources ──────────────────────────────────────────────────────────
// Expose the catalog / rules / pricing as browsable, cacheable MCP resources
// so clients can read them without a tool round-trip.

server.registerResource(
  'service-catalog',
  'azure://catalog/services',
  {
    title: 'Azure service catalog',
    description: 'All Azure services known to the Diagram Builder with categories, aliases, pricing availability, and cost ranges.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'application/json',
      text: JSON.stringify(
        Object.entries(SERVICE_CATALOG).map(([key, info]) => ({
          key,
          displayName: info.displayName,
          category: info.category,
          aliases: info.aliases,
          hasPricingData: info.hasPricingData,
          isUsageBased: info.isUsageBased ?? false,
          costRange: info.costRange ?? 'N/A',
        })),
        null,
        2,
      ),
    }],
  }),
);

server.registerResource(
  'waf-rules',
  'azure://waf/rules',
  {
    title: 'Well-Architected Framework rules',
    description: 'Architecture-wide pattern rules and per-service best practices used by validate_architecture.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(getWafRules(), null, 2) }],
  }),
);

server.registerResource(
  'pricing-meta',
  'azure://pricing/meta',
  {
    title: 'Pricing metadata',
    description: 'Distilled Azure Retail Prices metadata: regions and priced service entries available to estimate_costs.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(getPricingMeta(), null, 2) }],
  }),
);

// ── Prompts ────────────────────────────────────────────────────────────
// Starter templates that guide any MCP client through the design workflow.

server.registerPrompt(
  'design-secure-web-app',
  {
    title: 'Design a secure web app',
    description: 'Scaffold a Well-Architected secure web application and run it through validate → harden → cost → render → bicep.',
    argsSchema: { workload: z.string().describe('What the app does (e.g. "customer portal with SQL backend")') },
  },
  ({ workload }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Design a secure, Well-Architected Azure web application for: ${workload}\n\nUse the azure-diagram-builder MCP tools in this order:\n1. Propose services + connections (App Service or AKS front end, a database, cache, Key Vault, Entra ID, monitoring).\n2. validate_architecture — get the WAF score and findings.\n3. harden_architecture — clear topology anti-patterns automatically.\n4. estimate_costs for the hardened design (region eastus2).\n5. render_diagram (format svg) to visualize.\n6. generate_bicep to resolve the remaining config-level findings.\nReport the before/after WAF score and the estimated monthly cost.`,
      },
    }],
  }),
);

server.registerPrompt(
  'design-event-driven-platform',
  {
    title: 'Design an event-driven platform',
    description: 'Scaffold an event-driven / streaming architecture (ingest → process → store → analytics) and run the full validate → harden → cost → render → bicep flow.',
    argsSchema: { workload: z.string().describe('The event workload (e.g. "IoT telemetry at 50k events/sec")') },
  },
  ({ workload }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Design an event-driven Azure platform for: ${workload}\n\nInclude an ingestion tier (Event Hubs / Service Bus), stream processing (Stream Analytics or Functions), a durable store (Cosmos DB / Data Lake), and observability. Then:\n1. validate_architecture, 2. harden_architecture, 3. estimate_costs, 4. render_diagram (svg), 5. generate_bicep.\nGroup services into logical tiers so the diagram reads cleanly, and summarize the before/after WAF score and monthly cost.`,
      },
    }],
  }),
);

server.registerPrompt(
  'harden-and-cost',
  {
    title: 'Harden and cost an existing design',
    description: 'Take an existing architecture (or an imported manifest / scene), harden it, and produce the cost + hardened diagram + Bicep.',
    argsSchema: { region: z.string().optional().describe('Azure region for costing (default: eastus2)') },
  },
  ({ region }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `For the architecture we are working on:\n1. If it came from a saved file, call import_architecture first.\n2. validate_architecture to capture the baseline WAF score.\n3. harden_architecture to clear the topology anti-patterns.\n4. estimate_costs (region ${region ?? 'eastus2'}) on the hardened design.\n5. render_diagram (svg) of the hardened topology.\n6. generate_bicep to resolve config-level findings.\nPresent a before/after comparison of the WAF score and the monthly cost.`,
      },
    }],
  }),
);

  return server;
}

// ── Transport selection ────────────────────────────────────────────────
//
// MCP_TRANSPORT=stdio   (default) — local clients
// MCP_TRANSPORT=http    — remote clients via streamable HTTP + SSE
//   MCP_HTTP_PORT=3030  (default)
//   MCP_HTTP_HOST=0.0.0.0 (default)
//   MCP_HTTP_PATH=/mcp  (default)
//   MCP_AUTH_TOKEN      — when set, requires `Authorization: Bearer <token>`
//                         on the MCP path (health probe stays open). When unset,
//                         the endpoint is open (local/dev/stdio behavior).
//
// CLI flags --http / --stdio override the env var.

function resolveTransportMode(): 'stdio' | 'http' {
  const argv = process.argv.slice(2);
  if (argv.includes('--http')) return 'http';
  if (argv.includes('--stdio')) return 'stdio';
  const env = (process.env.MCP_TRANSPORT ?? '').toLowerCase();
  if (env === 'http' || env === 'streamable-http') return 'http';
  return 'stdio';
}

async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport drives lifecycle; nothing else to do
}

async function readJsonBody(req: IncomingMessage): Promise<unknown | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Constant-time comparison so a configured Bearer token can't be discovered
// by timing how quickly the server rejects a guess.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function startHttp(): Promise<void> {
  const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3030', 10);
  const host = process.env.MCP_HTTP_HOST ?? '0.0.0.0';
  const mcpPath = process.env.MCP_HTTP_PATH ?? '/mcp';
  const authToken = process.env.MCP_AUTH_TOKEN?.trim();
  if (authToken) {
    console.error('[mcp-http] Bearer-token auth ENABLED on', mcpPath);
  } else {
    console.error('[mcp-http] WARNING: no MCP_AUTH_TOKEN set — endpoint is OPEN (no auth)');
  }

  // Stateful sessions: one transport per MCP session id.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      // Health probe — handy for ACA / container probes. Always open (no auth)
      // so liveness/readiness checks don't need to carry the Bearer token.
      if (req.method === 'GET' && url.pathname === '/healthz') {
        writeJson(res, 200, { status: 'ok', transport: 'streamable-http', sessions: transports.size });
        return;
      }

      if (url.pathname !== mcpPath) {
        writeJson(res, 404, { error: 'not_found', path: url.pathname });
        return;
      }

      // Liveness probe for connector wizards (e.g. Azure SRE Agent) that send a
      // bare GET/HEAD to /mcp (no session id) to confirm the endpoint speaks MCP
      // before initializing. Answered BEFORE the auth gate so the probe succeeds
      // whether or not it carries the Bearer token. Returns no MCP data — every
      // real operation still requires POST + (when configured) a valid token.
      if ((req.method === 'GET' || req.method === 'HEAD') && !req.headers['mcp-session-id']) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(req.method === 'HEAD'
          ? undefined
          : 'Azure Diagram Builder MCP — Streamable-HTTP endpoint. POST an initialize request to begin.');
        return;
      }

      // CORS preflight — some clients preflight before the initialize POST.
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Allow': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, mcp-session-id, Accept',
        });
        res.end();
        return;
      }

      // Bearer-token gate (only enforced when MCP_AUTH_TOKEN is configured).
      if (authToken) {
        const authHeader = req.headers['authorization'];
        const provided = Array.isArray(authHeader) ? authHeader[0] : authHeader;
        const expected = `Bearer ${authToken}`;
        if (!provided || !safeEqual(provided, expected)) {
          res.setHeader('WWW-Authenticate', 'Bearer');
          writeJson(res, 401, {
            jsonrpc: '2.0',
            error: { code: -32001, message: 'Unauthorized. A valid Bearer token is required.' },
            id: null,
          });
          return;
        }
      }

      const sessionId = req.headers['mcp-session-id'];
      const sid = Array.isArray(sessionId) ? sessionId[0] : sessionId;

      let transport: StreamableHTTPServerTransport | undefined = sid ? transports.get(sid) : undefined;
      let body: unknown | undefined;

      if (req.method === 'POST') {
        body = await readJsonBody(req);
      }

      if (!transport) {
        // Only POST with an initialize request can create a new session.
        if (req.method !== 'POST' || !isInitializeRequest(body)) {
          writeJson(res, 400, {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'No valid session. Send an initialize request first.' },
            id: null,
          });
          return;
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSid: string) => {
            transports.set(newSid, transport!);
          },
        });
        transport.onclose = () => {
          if (transport && transport.sessionId) {
            transports.delete(transport.sessionId);
          }
        };
        const server = createServer();
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error('[mcp-http] request error:', err);
      if (!res.headersSent) {
        writeJson(res, 500, { error: 'internal_error', message: (err as Error).message });
      } else {
        try { res.end(); } catch { /* ignore */ }
      }
    }
  });

  httpServer.listen(port, host, () => {
    console.error(`[mcp-http] azure-diagram-builder listening on http://${host}:${port}${mcpPath}`);
    console.error(`[mcp-http] health: http://${host}:${port}/healthz`);
  });

  const shutdown = (signal: string) => {
    console.error(`[mcp-http] received ${signal}, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  const mode = resolveTransportMode();
  if (mode === 'http') {
    await startHttp();
  } else {
    await startStdio();
  }
}

main().catch((err) => {
  console.error('MCP server fatal error:', err);
  process.exit(1);
});

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
 *
 * Transport: stdio (JSON-RPC over stdin/stdout) — the standard for
 * local MCP integrations.
 *
 * Usage:
 *   node dist/index.js          # start server (stdio)
 *   npx azure-diagram-mcp       # via npx
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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

// ── Server initialization ──────────────────────────────────────────────

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

server.tool(
  'validate_architecture',
  'Validate an Azure architecture against the Well-Architected Framework (WAF). Runs deterministic rule-based analysis — detects anti-patterns, missing best practices, and security gaps. Returns a 0-100 score, findings grouped by WAF pillar, and actionable recommendations. No LLM required.',
  {
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
  async ({ services, connections }) => {
    const conns = (connections ?? []).map(c => ({
      from: c.from,
      to: c.to,
      label: c.label,
    }));

    const result = detectWafPatterns(services, conns);
    const grouped = groupFindingsByPillar(result.findings);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
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
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Tool 3: estimate_costs ─────────────────────────────────────────────

server.tool(
  'estimate_costs',
  'Estimate monthly Azure costs for a list of services. Uses the Diagram Builder pricing catalog with cost ranges. Returns per-service estimates, total cost, and a breakdown by category.',
  {
    services: z
      .array(
        z.object({
          name: z.string().describe('Service instance name'),
          type: z.string().describe('Azure service type'),
          tier: z
            .enum(['basic', 'standard', 'premium'])
            .optional()
            .describe('Pricing tier (default: standard)'),
          quantity: z.number().optional().describe('Number of instances (default: 1)'),
        }),
      )
      .describe('List of Azure services to estimate costs for'),
    region: z
      .string()
      .optional()
      .describe('Azure region (default: eastus2). Available: eastus2, swedencentral, westeurope, canadacentral, brazilsouth, australiaeast, southeastasia, mexicocentral'),
  },
  async ({ services, region }) => {
    const targetRegion = region ?? 'eastus2';
    const estimates: Array<{
      name: string;
      type: string;
      tier: string;
      quantity: number;
      hasPricingData: boolean;
      costRange: string;
      estimatedMonthlyCost: string;
    }> = [];

    const categoryCosts = new Map<string, { count: number; services: string[] }>();

    for (const svc of services) {
      const resolved = resolveServiceName(svc.type);
      const info = resolved ? SERVICE_CATALOG[resolved] : null;
      const tier = svc.tier ?? 'standard';
      const qty = svc.quantity ?? 1;

      estimates.push({
        name: svc.name,
        type: resolved ?? svc.type,
        tier,
        quantity: qty,
        hasPricingData: info?.hasPricingData ?? false,
        costRange: info?.costRange ?? 'Unknown',
        estimatedMonthlyCost: info?.costRange ?? 'No pricing data available',
      });

      if (info) {
        const cat = info.category;
        if (!categoryCosts.has(cat)) {
          categoryCosts.set(cat, { count: 0, services: [] });
        }
        const entry = categoryCosts.get(cat)!;
        entry.count += qty;
        entry.services.push(svc.name);
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              region: targetRegion,
              serviceCount: services.length,
              estimates,
              byCategory: Object.fromEntries(
                [...categoryCosts.entries()].map(([cat, data]) => [
                  cat,
                  data,
                ]),
              ),
              note: 'Cost ranges are from the Diagram Builder pricing catalog. For precise estimates, use the Azure Pricing Calculator or the Diagram Builder UI with live pricing API.',
            },
            null,
            2,
          ),
        },
      ],
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
      .enum(['bicep', 'terraform'])
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
          label: z.string().optional().describe('Connection label'),
          type: z
            .enum(['sync', 'async', 'optional'])
            .optional()
            .describe('Connection type'),
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

// ── Tool 5: get_waf_rules ──────────────────────────────────────────────

server.tool(
  'get_waf_rules',
  'Get Azure Well-Architected Framework rules from the Diagram Builder knowledge base. Returns architecture-wide pattern rules and per-service best practices. Optionally filter by WAF pillar.',
  {
    pillar: z
      .enum([
        'Reliability',
        'Security',
        'Cost Optimization',
        'Operational Excellence',
        'Performance Efficiency',
      ])
      .optional()
      .describe('Filter rules by WAF pillar'),
    serviceType: z
      .string()
      .optional()
      .describe(
        'Filter rules that apply to a specific Azure service type (e.g. "App Service", "SQL Database")',
      ),
  },
  async ({ pillar, serviceType }) => {
    let rules = getWafRules(pillar);

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

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
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
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ── Start server ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is running — stdio transport handles the lifecycle
}

main().catch((err) => {
  console.error('MCP server fatal error:', err);
  process.exit(1);
});

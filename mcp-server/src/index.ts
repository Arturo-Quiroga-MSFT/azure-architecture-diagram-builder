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
import { randomUUID } from 'node:crypto';

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

// ── Tool 6: render_diagram ──────────────────────────────────────────────

server.tool(
  'render_diagram',
  'Render a professional Azure architecture diagram as SVG (for embedding in markdown/SpecKit docs) or as self-contained interactive HTML (with pan, zoom, hover tooltips). Replaces Mermaid text diagrams with Azure-branded visuals using official category colors, dagre layout, and directional edges.',
  {
    title: z
      .string()
      .optional()
      .describe('Diagram title (displayed at the top)'),
    format: z
      .enum(['svg', 'html'])
      .optional()
      .describe('Output format: svg (static, for markdown embedding) or html (interactive viewer). Default: svg'),
    direction: z
      .enum(['TB', 'LR'])
      .optional()
      .describe('Layout direction: TB (top-to-bottom) or LR (left-to-right). Default: TB'),
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
          label: z.string().optional().describe('Connection label'),
          type: z
            .enum(['sync', 'async', 'optional'])
            .optional()
            .describe('Connection type: sync (solid), async (dashed purple), optional (dotted gray)'),
        }),
      )
      .optional()
      .describe('Connections between services'),
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
  async ({ title, format, direction, services, connections, groups }) => {
    const fmt = format ?? 'svg';
    const dir = direction ?? 'TB';

    const layout = computeLayout(
      services.map(s => ({ name: s.name, type: s.type, description: s.description, groupId: s.groupId })),
      (connections ?? []).map(c => ({ from: c.from, to: c.to, label: c.label, type: c.type })),
      groups ?? [],
      dir,
    );

    const output = fmt === 'html'
      ? renderHtml(layout, title)
      : renderSvg(layout, title);

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

  return server;
}

// ── Transport selection ────────────────────────────────────────────────
//
// MCP_TRANSPORT=stdio   (default) — local clients
// MCP_TRANSPORT=http    — remote clients via streamable HTTP + SSE
//   MCP_HTTP_PORT=3030  (default)
//   MCP_HTTP_HOST=0.0.0.0 (default)
//   MCP_HTTP_PATH=/mcp  (default)
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

async function startHttp(): Promise<void> {
  const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3030', 10);
  const host = process.env.MCP_HTTP_HOST ?? '0.0.0.0';
  const mcpPath = process.env.MCP_HTTP_PATH ?? '/mcp';

  // Stateful sessions: one transport per MCP session id.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      // Health probe — handy for ACA / container probes.
      if (req.method === 'GET' && url.pathname === '/healthz') {
        writeJson(res, 200, { status: 'ok', transport: 'streamable-http', sessions: transports.size });
        return;
      }

      if (url.pathname !== mcpPath) {
        writeJson(res, 404, { error: 'not_found', path: url.pathname });
        return;
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

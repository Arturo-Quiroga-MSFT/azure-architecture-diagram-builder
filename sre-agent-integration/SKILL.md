---
name: azure-architecture-diagramming
description: |
  Load this skill when the user asks to:
  - Visualize or diagram an Azure architecture (from description, incident context, or resource list)
  - Validate an architecture against the Azure Well-Architected Framework (WAF)
  - Estimate monthly costs for an Azure architecture
  - Generate a Bicep/IaC deployment manifest for an architecture
  - List available Azure services and their categories for architecture planning
  - Export an architecture as an editable React Flow scene for the Azure Architecture Diagram Builder web app
  - Get WAF best-practice rules for specific Azure service types or pillars
  - Produce architecture documentation as part of an incident RCA, post-mortem, or design review
  Do NOT load for:
  - Runtime diagnostics, log analysis, or active incident triage (use service-specific diagnostic skills)
  - Azure resource configuration changes or remediation (use azure_cli_command_executor or service skills)
  - Simple resource inventory or property lookups (use core system tools)
  Load this skill alongside diagnostic skills when the user wants both investigation AND architecture visualization in the same session (e.g., "investigate this incident and show me the architecture").
tools:
  - azure-diagram-builder_list_services
  - azure-diagram-builder_render_diagram
  - azure-diagram-builder_validate_architecture
  - azure-diagram-builder_estimate_costs
  - azure-diagram-builder_generate_manifest
  - azure-diagram-builder_get_waf_rules
  - azure-diagram-builder_export_reactflow_scene
---

# Azure Architecture Diagramming Skill

## Purpose

Generate professional Azure architecture diagrams, validate them against the Well-Architected Framework, estimate costs, and produce deployment-ready IaC manifests — all within an agent conversation. Closes the loop from incident diagnosis to architecture documentation to infrastructure-as-code.

## Scope

**In scope:** architecture visualization (SVG, interactive HTML, editable React Flow scenes), WAF validation and scoring, cost estimation, Bicep manifest generation, service catalog discovery, WAF rule lookup by service type or pillar.

**Out of scope:** runtime diagnostics, log queries, active remediation, resource configuration changes, kubectl/az CLI operations. Defer those to the appropriate diagnostic or operational skill.

## Tools Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `list_services` | List available Azure services (68 services, 16 categories) | Discovery: find which service types map to the user's components |
| `render_diagram` | Render architecture as SVG (static, for embedding) or interactive HTML (pan/zoom/tooltips) | Produce a visual diagram for documentation, presentations, or exploration |
| `validate_architecture` | Score architecture against WAF (0–100), detect anti-patterns | Architecture review, post-incident improvement, compliance check |
| `estimate_costs` | Estimate monthly costs by service and category | Budget planning, cost governance, architecture comparison |
| `generate_manifest` | Generate az prototype interchange manifest (Bicep/IaC) | Infrastructure-as-code generation, deployment automation |
| `get_waf_rules` | Get WAF rules filtered by service type or pillar | Targeted best-practice guidance for specific services or WAF pillars |
| `export_reactflow_scene` | Export full React Flow scene JSON for the AADB web app | When the user wants an editable, importable diagram they can refine in the Diagram Builder UI |

## Core Workflow

### Standard Architecture Review (default flow)

1. **Gather context** — identify the services, connections, and logical groups from the user's description, incident context, or resource inventory.
2. **Map to AADB service types** — use `list_services` (with category filter if needed) to find the correct service type keys. Cache results; do not re-query the catalog in the same session.
3. **Render the diagram** — call `render_diagram` with:
   - `format: svg` for static embedding (docs, slides, PRs)
   - `format: html` for interactive exploration (pan, zoom, tooltips)
   - Always include `groups` for logical separation and `connections` with `type` (sync/async/optional)
4. **Validate against WAF** — call `validate_architecture` with the same services and connections. Report the score and findings grouped by pillar.
5. **Estimate costs** — call `estimate_costs` with the deployable services (exclude external/SaaS services the user doesn't pay for directly).
6. **Summarize** — deliver a structured report: diagram, WAF score + findings table, cost breakdown, and actionable recommendations.

### Editable Scene Export (when user wants to refine in AADB web app)

1. Follow steps 1–2 above.
2. Call `export_reactflow_scene` instead of (or in addition to) `render_diagram`. Include:
   - `architectureName`, `author`, `architecturePrompt` for metadata
   - `workflow` array with step-by-step narrative (the right panel in the web app)
   - `groups` for visual container grouping
   - `direction: "LR"` for wide architectures, `"TB"` for tall/hierarchical ones
3. Save the returned JSON to a file the user can download and import via **Open → Import Architecture** in the AADB web app.

### IaC Generation

1. Follow steps 1–2 above.
2. Call `generate_manifest` with `iacTool: "bicep"` (default) and the architecture definition.
3. The returned JSON can be consumed by `az prototype build` or imported into the AADB web app.

### Targeted WAF Guidance

1. Call `get_waf_rules` with `serviceType` (e.g., "Container Apps") and/or `pillar` (e.g., "Security").
2. Present rules as an actionable checklist, not a raw dump.

## Architecture Modeling Guidelines

### Services

- Use the exact `key` values from `list_services` for the `type` field (e.g., `"Container Apps"`, `"Microsoft Entra ID"`, `"Key Vault"`).
- Give each service a descriptive `name` that identifies its role (e.g., `"Grocery API"` not just `"Container Apps"`).
- Add a `description` for tooltip/hover context.
- Assign a `groupId` to place services in logical containers.

### Connections

- Use `type: "sync"` for synchronous request/response (solid blue line).
- Use `type: "async"` for event-driven, fire-and-forget, or telemetry flows (dashed purple line).
- Use `type: "optional"` for fallback or degraded-mode paths (dotted gray line).
- Always include a `label` describing what flows over the connection.

### Groups

- Model functional boundaries: "Application Tier", "Identity & Access", "Observability", "Infrastructure", etc.
- Keep to 3–7 groups for readability.
- Each group needs an `id` (referenced by services' `groupId`) and a `label`.

### Workflow (for `export_reactflow_scene`)

- Number steps sequentially starting from 1.
- Each step has a `description` (what happens) and `services` (which services are involved).
- Steps should tell the story of the primary data flow or user journey.

## Response Pattern

1. **Direct answer** — 1–2 sentences summarizing what was produced.
2. **Diagram** — embedded SVG or link to HTML/JSON artifact.
3. **WAF findings** — table with pillar, severity, issue, recommendation.
4. **Cost summary** — table by category with ranges.
5. **Recommendations** — 2–4 actionable items tied to WAF findings or cost observations.
6. **Next steps** — offer follow-up actions (export to AADB, generate IaC, address WAF gaps).

## Key Principles

- **Don't ask for what you can infer.** If the user describes an architecture or you have resource context from a diagnostic session, model it directly. Only ask for clarification when service types are genuinely ambiguous.
- **Chain tools efficiently.** For a full review, call `render_diagram`, `validate_architecture`, and `estimate_costs` in parallel — they're independent.
- **Match format to purpose.** SVG for docs/slides, HTML for exploration, React Flow JSON for editing in the AADB web app. Default to SVG unless the user implies interactivity.
- **Keep diagrams readable.** 8–15 services is the sweet spot. For larger architectures, split into focused views (e.g., data plane vs control plane).
- **WAF score is directional, not absolute.** The validator checks known patterns (single-region, no-identity, no-monitoring, etc.) but can't see runtime config. Frame findings as "areas to investigate" not "confirmed deficiencies".

## Validation (internal)

After each tool call, silently verify:
- `render_diagram` returned valid SVG/HTML (non-empty response).
- `validate_architecture` returned a numeric score and findings array.
- `estimate_costs` returned per-service estimates (check for services with `hasPricingData: false`).
- `export_reactflow_scene` returned nodes and edges arrays (verify node count matches input service count + group count).

## Examples

### Example 1: Post-Incident Architecture Review

User: "We just had a 429 storm on our Grocery API. Show me the architecture and check it against WAF."

Plan:
- Model Grocery SRE Demo architecture (Web → API → Supplier → Loki → Grafana → Agent → Jira)
- Render SVG diagram with 6 groups
- Validate against WAF
- Summarize findings and recommend improvements

### Example 2: Architecture for Demo Deck

User: "Generate an architecture diagram for the PIM Approver Agent for the Zafin demo."

Plan:
- Model PIM architecture (PIM → Agent → pim-mcp → Entra ID → Jira → Teams)
- Export React Flow scene with 8-step workflow narrative
- Render SVG version for slide embedding
- Save both artifacts for download

### Example 3: Cost Comparison

User: "Compare the cost of our Grocery demo vs the PIM testbed."

Plan:
- Model both architectures
- Call `estimate_costs` for each
- Present side-by-side cost breakdown by category
- Highlight cost drivers and optimization opportunities

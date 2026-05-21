# Copilot Studio MCP — array-of-objects input tool not invoked

Date: 2026-04-29
Status: Complete

## Research questions

1. Does Copilot Studio generative orchestration build JSON args for complex MCP input schemas (e.g., `services: [{name,type,tier}]`) and call the tool, or fall back to slot-filling?
2. What causes the symptom: test pane shows "Working" with correct JSON args displayed, but the MCP server only receives `initialize` / `notifications/initialized` / `tools/list` — never `tools/call`. Agent then asks user for one field at a time.
3. Recommended fix? (server-entry setting, confirmation, license/SKU, "Action authentication" mode, commit-to-call flag.)
4. Microsoft Learn search results.
5. GitHub `microsoft/copilot-studio-samples` issues.

## Key findings (with evidence)

### Microsoft Learn — official MCP troubleshooting page

Source: https://learn.microsoft.com/microsoft-copilot-studio/mcp-troubleshooting

Verbatim known-issues table (April 2026 snapshot):

| Issue | Workaround |
| --- | --- |
| Endpoint in Open SSE call must be a full URI. | n/a |
| `System.FormatException` thrown when `exclusiveMinimum` is an integer (not boolean) in MCP tool input schema. | n/a |
| **MCP tool input schema is truncated when a `type` is an array of multiple types instead of a single type.** | **Make the values for `type` fields a single type.** |
| **Tools with reference type inputs in the schema are filtered from the list of available tools for MCP server. Reference type inputs and outputs aren't supported.** | n/a |
| Tools with enum type inputs are interpreted as string instead of enum. | n/a |

### Microsoft Learn — MCP overview

Source: https://learn.microsoft.com/microsoft-copilot-studio/agent-extend-action-mcp

- Generative orchestration MUST be on for MCP. Each tool's `inputSchema` (name/description/inputs/outputs from MCP) is what the orchestrator binds against.
- "When you update or remove tools and resources on the MCP server, Copilot Studio dynamically reflects these changes." — implies the orchestrator caches `tools/list` output; stale schemas can mislead the planner.

### Microsoft Learn — add-tools-custom-agent (the per-tool config that exists for connectors but is hidden / different for MCP)

Source: https://learn.microsoft.com/microsoft-copilot-studio/add-tools-custom-agent

Important quotes:

- "For MCP servers connected as agent tools, the configuration page is **different from other tool types**. The Details section is similar, but instead of Inputs and Completion, there are Tools and Resources sections." → **You cannot per-input override `Fill using` / `Custom value` on MCP tools** the way you can on connector tools. The orchestrator must construct args from the schema entirely on its own.
- Per-tool toggles on the Details page:
  - **Allow agent to decide dynamically when to use the tool** (must be ON for orchestrator to invoke).
  - **Ask the end user before running** (default No; if Yes, asks confirmation before `tools/call`).
  - **Authentication**: End user vs Maker-provided.
- "Tools are always run in the agent's runtime in the user context and **can't be run unless authentication is enabled**." (Caveat: this sentence appears in the broader tools doc, not specifically scoped to MCP `None` auth — but is still the strongest published statement on auth being a hard prerequisite to execution.)

### Microsoft Learn — MCP onboarding wizard

Source: https://learn.microsoft.com/microsoft-copilot-studio/mcp-add-existing-server-to-agent

- The onboarding wizard is per **MCP server entry** (not per tool). Auth options: None, API key, OAuth 2.0 (Dynamic discovery / Dynamic / Manual).
- Streamable HTTP is the supported transport (SSE deprecated post-Aug 2025).
- After server creation, you must **Create a new connection** and **Add to agent**. If the connection is missing or in an unauthorized state, tools list but don't execute.

### Microsoft Learn — guidance on tools

Source: https://learn.microsoft.com/microsoft-copilot-studio/guidance/agent-tools

- "You can't enrich tool descriptions with more context about when to invoke." (You're stuck with what the MCP server publishes.)
- "Topics can't call MCP servers directly." (No fallback to a topic to bind args manually.)

### GitHub issue search

- `microsoft/copilot-studio-samples` — repo not searchable / does not exist by that name (422 from the search API). The Copilot Studio samples live elsewhere (commonly under `microsoft/CopilotStudioSamples`); no public issues match the symptom pattern.
- General GitHub issue search for the symptom returns no exact matches in Microsoft-owned repos.

## Symptom-to-cause mapping

User symptoms:
- Test pane inspector displays the planned `tools/call` args, e.g. `{"services":[{"name":"web","type":"App Service","tier":"premium"}]}`.
- Server log shows only `initialize`, `notifications/initialized`, `tools/list`. **No `tools/call` ever arrives.**
- Agent then asks "What type of Azure service…" — i.e., reverts to one-field-at-a-time slot filling.

Most consistent root cause (highest confidence):

- **The published JSON Schema for the array-of-objects input contains `$ref` / `$defs` (reference types).** Per the Microsoft Learn known-issues table, "Tools with reference type inputs in the schema are filtered from the list of available tools for MCP server." When MCP SDK 1.x is fed a zod schema for `z.array(z.object({...}))`, common zod→JSON-schema converters (including `zod-to-json-schema` defaults) emit `items: { $ref: "#/$defs/Service" }` plus a `$defs` block. Copilot Studio's planner can still see the tool name + description and *speculatively* construct args (which is what the test pane shows), but the validated/registered tool surface is reduced — so when the planner attempts execution, it fails the registered-tool check, drops the call silently, and falls back to its NLU/slot-filling pipeline. That matches the exact "args shown but `tools/call` never sent" pattern.

Other contributing causes worth ruling out in order:

1. **Connection not authorized.** If the MCP server entry's connection is in `Unauthorized` / `Sign in required` state, Copilot Studio shows the tools (from `tools/list`) but suppresses execution. Even with `Authentication: None`, the underlying Power Platform custom-connector connection must show a green check. Open Tools → your MCP server → connection panel; reconnect.
2. **"Ask the end user before running" = Yes** on the MCP server entry → produces a confirmation prompt instead of immediate execution. Verify it is **No**.
3. **"Allow agent to decide dynamically when to use the tool" = Off** → orchestrator never plans the call.
4. **License/SKU.** Copilot Studio MCP integration requires a Power Platform license that includes Copilot Studio (per Azure MCP deploy doc prerequisites). Copilot Chat / "Lite" / message-pack-only tenants may *list* MCP tools but block execution. Confirm tenant has full Copilot Studio entitlement (not just M365 Copilot Chat).
5. **Schema gotchas already on the troubleshooting page** that may also bite array-of-objects shapes:
   - `type` as an array of types (e.g. `["string","null"]`) → schema truncated. Replace with single type.
   - `enum` values reduced to plain string (so `tier: "basic"|"standard"|"premium"` becomes free-form string the orchestrator can ask about).
   - `exclusiveMinimum` as integer → `System.FormatException`.

## Recommended fix (action steps)

Apply in order; stop when the call succeeds.

1. **Inline the JSON Schema — eliminate `$ref` / `$defs`.**
   - In the MCP server, after building the zod schema, convert with refs disabled. With `zod-to-json-schema`:
     ```ts
     import { zodToJsonSchema } from "zod-to-json-schema";
     const inputSchema = zodToJsonSchema(myZodSchema, {
       $refStrategy: "none",
       target: "jsonSchema7",
     });
     ```
     Then strip any leftover `$schema`, `definitions`, `$defs` keys before publishing in `tools/list`.
   - Equivalently: hand-author the `inputSchema` JSON for the tool with the object shape inlined under `properties.services.items.properties` (no `$ref`).
   - For the `tier` field, drop `enum` (or accept that it'll be treated as string) and validate server-side instead.
   - Ensure every `type` is a single string (`"string"`, `"object"`, `"array"`), never an array of types. Mark `nullable: true` instead of `type: ["string","null"]`.
2. **Re-list tools in Copilot Studio.** Tools → MCP server → … → **Refresh** (or remove and re-add the server). The cached schema must be re-fetched for the new shape to take effect.
3. **Verify the per-server tool settings.** Open the MCP server entry → Details:
   - **Allow agent to decide dynamically when to use the tool** = **On**.
   - **Ask the end user before running** = **No**.
   - **Authentication** = appropriate for your server (End user with OAuth, or None if unauthenticated and tenant policy allows).
4. **Verify the connection.** Same page → Connections → confirm the connection shows a green check. If red/unauthorized, click **Reconnect** and complete the OAuth/API-key flow.
5. **Confirm tenant licensing.** In the Power Platform admin center, confirm the environment has a Copilot Studio license (not Copilot Chat only). The Azure MCP/Copilot Studio walkthrough explicitly lists a Power Platform license that includes Copilot Studio + Power Apps as a prerequisite.
6. **Use a higher-context model.** Microsoft's Sentinel MCP guidance recommends GPT-5 for best MCP tool reasoning. In the agent → Overview → **Generative AI** model selector, pick the highest available (e.g., GPT-5).
7. **Re-test.** In the test pane, watch Activity Map; you should now see a `tools/call` POST hit the server with the constructed JSON.

## Official docs supporting the fix

- Known issues incl. reference-type filter and array-type truncation: https://learn.microsoft.com/microsoft-copilot-studio/mcp-troubleshooting
- Per-tool Details settings (Allow dynamic / Ask before running / Authentication): https://learn.microsoft.com/microsoft-copilot-studio/add-tools-custom-agent
- MCP onboarding wizard auth + connection: https://learn.microsoft.com/microsoft-copilot-studio/mcp-add-existing-server-to-agent
- MCP overview + generative orchestration prereq: https://learn.microsoft.com/microsoft-copilot-studio/agent-extend-action-mcp
- Streamable HTTP transport requirement: same overview page (SSE deprecated after Aug 2025)
- Azure MCP + Copilot Studio reference template (license prereqs, custom-connector path): https://learn.microsoft.com/azure/developer/azure-mcp-server/how-to/deploy-remote-mcp-server-copilot-studio
- Sample swagger with `x-ms-agentic-protocol: mcp-streamable-1.0`: https://github.com/Azure-Samples/azmcp-copilot-studio-aca-mi/blob/main/custom-connector-swagger-example.yaml

## Known-bug status / workaround summary

- **Reference types in input schema** → documented as a Microsoft-known limitation with no fix shipped as of the troubleshooting page snapshot. **Workaround = inline the schema (no `$ref`/`$defs`).** This is the most likely cause of the user's exact symptom.
- **`enum` interpreted as string** → known, no fix; expect orchestrator to keep asking for the value.
- **Array-of-types `type` field truncation** → known, no fix; use single type + nullability flag.

## Recommended next research (not done this session)

- [ ] Capture the actual JSON the user's MCP server returns from `tools/list` for the `services`-bearing tool to confirm presence of `$ref`/`$defs`.
- [ ] Inspect outbound HTTP from Copilot Studio test pane (Power Platform admin → connector trace) to confirm whether a `tools/call` is ever attempted and 4xx'd vs. never sent.
- [ ] Confirm tenant SKU in Power Platform admin center for the environment hosting the agent.

## Clarifying questions for user (optional)

- Which library generates the JSON Schema served by `tools/list` (zod-to-json-schema, `@modelcontextprotocol/sdk` helper, hand-rolled)?
- Is the current published `inputSchema` available so we can confirm presence of `$ref`/`$defs` and `enum`/multi-type fields?
- What auth mode is set on the MCP server entry in Copilot Studio (None / API key / OAuth)?
- Is the agent in a tenant with a full Copilot Studio license, or Copilot Chat only?

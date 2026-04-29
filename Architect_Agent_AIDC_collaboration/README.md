# Architect Agent ↔ Diagram Builder ↔ AIDC

Working materials for integrating the Azure Architecture Diagram Builder with the Microsoft-internal **Architect Agent** (M365 Copilot, used by PSAs) and for formalizing its use as an official tool in **AI Discovery Cards (AIDC)** workshops.

## Background

These deliverables came out of a PSA team call on **April 28, 2026** with Lucy, Guilherme, Arturo, and Ellie. The two strategic threads:

1. **Architect Agent integration.** Today the Architect Agent cannot call the Diagram Builder as a tool. Lucy maintains the agent's instructions; the agreed near-term move is to embed clear handoff guidance and a copy-paste prompt template inside those instructions. When MCP support lands for the Architect Agent platform, the same instruction surface upgrades naturally to a direct tool call (the Diagram Builder already ships an MCP server with stdio + streamable HTTP transports).
2. **AIDC formalization.** Guilherme reported that using the Diagram Builder during in-person AIDC workshops sharpened the customer outcome — the team agreed to package the workflow so any AIDC Champ in any region can replicate it, share via Viva Engage, and present at the global Champs call.

## What's in this folder

| File | Audience | Use |
|---|---|---|
| [01-starter-prompts.md](01-starter-prompts.md) | Lucy + general users of the Diagram Builder | Three-tier prompt pack: one-liners, structured template with six worked examples, and an AIDC-card-driven variant with three worked examples. Includes iteration prompts and anti-patterns. |
| [02-architect-agent-snippet.md](02-architect-agent-snippet.md) | Lucy → Architect Agent system prompt | A drop-in instruction block that tells the Architect Agent when to recommend the Diagram Builder, how to hand off, the prompt template to produce, an AIDC variant note, and a few-shot example dialogue. Includes a future-proofing note for when MCP arrives. |
| [03-aidc-facilitator-guide.md](03-aidc-facilitator-guide.md) | AIDC Champs (Guilherme et al.), regional + global | End-to-end facilitator guide: where the diagram step fits in the workshop flow, a card-to-services cheat-sheet pulled directly from the official AIDC deck, pre-workshop checklist, live facilitator script, the post-workshop deliverable package, adoption channels, and troubleshooting. |

## Status & ownership

| Track | Status | Owner | Next checkpoint |
|---|---|---|---|
| Sample prompts shared with Lucy | ✅ Drafted (file 01) | Arturo to send | Lucy folds into Architect Agent instructions |
| Architect Agent instruction snippet | ✅ Drafted (file 02) | Lucy reviews + adapts | Paste into agent instructions for review |
| MCP server roadmap (Seismic) | 🔍 Investigation | Lucy | Share findings with team |
| AIDC Viva Engage post | 📝 Pending | Guilherme | First regional case study |
| AIDC Americas Champs chat | 📝 Pending | Lucy | Coordinate share at next regional call |
| AIDC global Champs agenda | 📝 Pending | Lucy / Doreen | Slot at upcoming call |
| MCP HTTP transport for hosted agents | ✅ Shipped on `main` | — | Ready when Architect Agent supports MCP |
| Reasoning-transparency experiments | 🔬 Ongoing | Arturo | Identify which models expose reasoning tokens cleanly |

## How the pieces fit together

```
                ┌──────────────────────────────────────────────────────┐
                │  Customer conversation (Architect Agent in M365)     │
                └───────────────────┬──────────────────────────────────┘
                                    │
                file 02 instruction │ "When 3+ services agreed → hand off"
                                    ▼
                ┌──────────────────────────────────────────────────────┐
                │  Diagram Builder (web app + MCP server on ACA)       │
                │  - 68+ services, official icons, WAF rules,          │
                │    8-region pricing, PPTX/SVG/PNG/Draw.io export     │
                └───────────────────┬──────────────────────────────────┘
                                    │ az prototype manifest, IaC
                                    ▼
                ┌──────────────────────────────────────────────────────┐
                │  Downstream: az prototype build → IaC → deploy       │
                └──────────────────────────────────────────────────────┘

   AIDC workshop (file 03) ─── feeds the same Diagram Builder with a
   card-driven prompt that names selected cards by Category > Title.
```

## Source material referenced by these documents

- **AIDC card deck (PDF)** — capability categories, card titles, and per-card recommended Microsoft services. The card-to-services cheat-sheet in file 03 and the AIDC vocabulary in files 01 and 02 are pulled directly from the deck so the Diagram Builder receives prompts in the exact language the cards use.
- **April 28, 2026 meeting recap** — kept in `DONOTTRACK/` (gitignored) since it contains internal discussion. Strategic decisions captured in files 01–03 above.
- **MCP server work on `main`** — `mcp-server/` directory. Six tools (`list_services`, `validate_architecture`, `estimate_costs`, `generate_manifest`, `get_waf_rules`, `render_diagram`); stdio + streamable HTTP transports; HTTPS endpoint shipped via the existing ACA deployment at `/mcp`.

## How to use these docs

- **Lucy:** start with file 02. Adapt the snippet to match the Architect Agent's existing voice and paste it into the agent's instructions. Use file 01 if you want a richer set of prompt examples to seed user-facing guidance.
- **AIDC Champs:** start with file 03. Run one workshop using the live script as-is, then post a short case study to the Viva Engage AIDC channel.
- **PSAs preparing for a customer briefing:** open file 01 and pick the tier that matches your prep time. Tier B (structured) is the recommended default.
- **Anyone exploring the Architect Agent → MCP future state:** see the MCP follow-up note in `/memories/repo/mcp-server-followups.md` and the `mcp-server/examples/` folder at the repo root.

## Conventions used in the prompts

- **AIDC vocabulary as grounding.** Cards are referenced as `Category > Card title` (matching the deck), e.g. `Information Management > Retrieve information`. The model treats this as a hint and biases toward the per-card recommended services.
- **Per-card services preferred.** The AIDC template tells the Diagram Builder to use the Microsoft services already listed on the chosen cards before adding anything else, then add only the supporting services that are necessary (identity, networking, storage, observability, key management).
- **Group by AIDC category.** The diagram visually validates the customer's card choices instead of contradicting them.
- **Short, structured constraints block.** Region, compliance, identity, scale, budget tier, and an explicit "out of scope." This keeps the model from hedging.

## Updating this folder

These are working documents, not specifications. Edit freely as the Architect Agent integration evolves, as new AIDC cards ship, or as workshop experience surfaces better patterns. When the Architect Agent gains MCP tool support, the most likely changes are:

- **File 02:** replace the "produce a copy-paste prompt" step with a description of the direct MCP tool call.
- **File 03:** add a section on the in-app AIDC mode if/when the Diagram Builder surfaces AIDC categories as first-class UI groups.
- **File 01:** retain as the canonical prompt library — useful even after MCP integration, since the prompts double as documentation of the supported scenarios.

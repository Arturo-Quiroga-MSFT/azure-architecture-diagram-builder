# Azure Architecture Diagram Builder — Usage & Impact

_Snapshot: last ~85 days (2026-03-12 → 2026-06-05). Source: Azure Application Insights (`aq-app-insights-001`) + Azure Cost Management. All figures are real telemetry, not estimates._

## The headline

A solo, side-project tool that turns natural-language prompts into validated Azure
architecture diagrams has quietly grown into a **globally adopted** utility — at a
cost of pennies per user.

| Metric | Value |
| --- | --- |
| Unique users | **193** |
| Sessions | **333** |
| Tracked events | **2,883** |
| Countries reached | **36** |
| Cities reached | **117** |
| Attributable LLM cost | **~$123 / month** |
| Cost per user | **~$0.64 / month** |

## Adoption is accelerating

Organic, word-of-mouth growth with a clear May inflection point — no marketing spend.

| Month | Active users | Events |
| --- | --- | --- |
| 2026-03 | 15 | 838 |
| 2026-04 | 10 | 229 |
| 2026-05 | **109** | 1,370 |
| 2026-06 (partial) | 68 | 446 |

Peak single days: **Jun 3 — 29 users / 192 events**, **May 21 — 24 users / 222 events**.

## Global, not local

Top countries by users: United States (93), United Kingdom (14), Australia (10),
Netherlands (9), India (9), Greece (5), Canada (5), France (4), plus 28 more —
including Brazil, Japan, Germany, Singapore, UAE, South Africa, Chile, and Korea.

## People actually use the core features

| Feature | Events | Users |
| --- | --- | --- |
| AI model generation calls | 1,370 | 144 |
| Architectures generated | 531 | 129 |
| Diagrams exported | 387 | 62 |
| Pricing region changed | 163 | 72 |
| WAF validations run | 128 | 55 |
| Multi-model comparisons | 112 | 5 |
| Deployment guides generated | 47 | 23 |
| Recommendations applied | 34 | 11 |

Average generated architecture: **~12 Azure services, ~12 connections** (largest: 56 services).

## Real output, not just pictures

- **8 export formats** in active use: JSON (112), PowerPoint (87), PNG (64), CSV (36),
  draw.io (32), SVG (19), HTML (19), and Azure prototype/Bicep bundles (14).
- **47 deployment guides** generated (avg ~9 services, ~9 Bicep files each).
- **IaC round-tripping**: users import existing ARM (6), Bicep (5), and Terraform (2)
  templates to visualize and improve them.

## Multi-model by design

**12+ frontier models** exercised in production, letting users compare quality, latency,
and cost side by side:

| Model | Calls | Users |
| --- | --- | --- |
| GPT-5.2 | 400 | 128 |
| GPT-5.1 | 302 | 13 |
| GPT-5.4 | 249 | 28 |
| GPT-5.3 Codex | 80 | 13 |
| Grok 4.1 Fast | 79 | 11 |
| + DeepSeek, Kimi, Mistral, GPT-OSS, … | — | — |

WAF validation runs (128 total) produce structured, scored design feedback —
average scores of **61–71 / 100** across the leading models, surfacing concrete gaps.

## The economics

| | |
| --- | --- |
| Attributable LLM token spend | **$123.10 / 30 days** |
| Blended cost per 1M tokens | $20.59 |
| Avg cost per generation call | $0.14 |
| **Cost per active user** | **~$0.64 / month** |

Delivering validated, multi-cloud-quality Azure architecture guidance to **193 users in
36 countries for the price of two coffees a month** — maintained by a single person on a
personal subscription.

## The ask

This tool has outgrown a hobby footprint. To sustain and scale it responsibly:

1. **Sponsorship / landing zone** — move off a personal subscription onto a funded,
   right-sized Azure environment with proper quotas and isolation.
2. **Co-maintainers** — reduce the bus-factor of one and accelerate the roadmap.
3. **Strategic reuse** — package the validation + generation engine as a reusable skill
   (e.g., for Learn / Copilot surfaces) so the impact compounds beyond this app.

---

_Reproduce these numbers anytime:_
`./scripts/usage-report.sh 120` (usage) and `python3 scripts/llm-cost-report.py --days 30` (cost).

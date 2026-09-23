# WAF Scoring Methodology

> How the Azure Architecture Diagram Builder validates generated architectures against the Azure Well-Architected Framework (WAF).

**Audience:** Reviewers, architects, and stakeholders who want to understand how the validation score is produced, what its limits are, and how to interpret findings responsibly.

---

## 1. TL;DR

The app uses a **hybrid two-phase validator**:

1. **Phase 1 — Deterministic rule engine** (runs in ~1 ms, no AI). Scans the diagram's services, connections, and topology against a curated knowledge base of WAF rules and known anti-patterns.
2. **Phase 2 — LLM contextual refinement** (Azure OpenAI). The model receives the architecture *plus* the rule-engine findings, then produces the final scored report across the five WAF pillars.

The score is **a directional design-time signal based on the diagram only**. It is not an audit of a deployed environment, and it does not replace human architectural review. See [Section 7](#7-known-limitations) for explicit limitations to share with reviewers.

---

## 2. Scope: What "WAF Scoring" Means Here

The score answers one specific question:

> *"Based purely on the services and connections drawn on the canvas (plus any natural-language description), how well does this proposed architecture align with the five pillars of the Azure Well-Architected Framework?"*

What it **is**:

- A **design-time heuristic** that surfaces missing best-practice patterns.
- A **conversation starter** for architecture reviews.
- A **comparator** that lets you contrast outputs from different AI models for the same prompt.

What it **is not**:

- A configuration audit of an actually-deployed Azure subscription.
- A substitute for the official [Azure Well-Architected Review tool](https://learn.microsoft.com/assessments/azure-architecture-review/) on Microsoft Learn.
- A compliance certification or security assessment.
- Aware of runtime settings (SKUs, redundancy options, network rules, IAM policies) that are not represented as nodes/edges in the diagram.

---

## 3. The Five WAF Pillars Evaluated

The validator scores against the five canonical pillars defined by Microsoft:

| Pillar | Focus |
|---|---|
| **Reliability** | Resiliency, HA, DR, redundancy, failover |
| **Security** | Identity, network isolation, secrets, encryption, WAF/DDoS |
| **Cost Optimization** | Right-sizing, consumption models, reserved capacity |
| **Operational Excellence** | Monitoring, automation, DevOps, observability |
| **Performance Efficiency** | Scaling, caching, async patterns, regional latency |

Reference: <https://learn.microsoft.com/azure/well-architected/>

---

## 4. The Two-Phase Hybrid Pipeline

### Phase 1 — Deterministic Rule Engine

Source: [src/services/wafPatternDetector.ts](src/services/wafPatternDetector.ts) and the knowledge base in [src/data/wafRules.ts](src/data/wafRules.ts).

The engine runs **two kinds of rules** against the in-memory diagram:

**A. Architecture-pattern rules** (topology-level). Defined in `ARCHITECTURE_PATTERN_RULES`. Each rule is tied to a detected pattern such as:

| Pattern key | What it detects |
|---|---|
| `single-region` | No global load balancer (Front Door / Traffic Manager) with ≥ 3 services |
| `single-database` | Exactly one database service with no replica/geo hint |
| `no-cache` | Compute + DB present, but no Redis/CDN |
| `no-monitoring` | No Azure Monitor / App Insights / Log Analytics |
| `no-identity` | No Microsoft Entra ID node |
| `no-waf` | Public-facing app with no WAF, App Gateway, or Front Door |
| `direct-db-access` | Edge/frontend node connected directly to a database |
| `no-key-vault` | ≥ 4 services and no Key Vault |
| `no-backup` | Database(s) present and no Backup/Recovery Services |
| `no-api-gateway` | ≥ 2 compute services with no APIM / App Gateway / Front Door |

**B. Per-service rules** (`SERVICE_SPECIFIC_RULES`). Curated checklist items keyed to specific Azure service types (App Service, Functions, AKS, SQL DB, Cosmos DB, Storage, Key Vault, etc.). Each rule has:

```ts
{
  id, pillar, severity, category,
  issue, recommendation, appliesTo[]
}
```

Severities: `critical | high | medium | low`.

The rule engine returns:

- A list of findings (pattern + service-specific).
- The set of patterns detected.
- A **preliminary score** computed by point deduction:

```text
start  = 100
deduct = 12 (critical) | 7 (high) | 3 (medium) | 1 (low) per finding
floor  = 10
```

This preliminary score is **not** what the user sees — it is a sanity check that gets sent into Phase 2.

### Phase 2 — LLM Contextual Refinement

Source: [src/services/architectureValidator.ts](src/services/architectureValidator.ts) (`validateArchitecture`).

The prompt sent to the configured Azure OpenAI model contains:

1. The full service list (name + type).
2. The connection list (`from → to: label`).
3. Logical groups.
4. The original natural-language description (when available).
5. **A summary of the architecture-level pattern findings** from Phase 1 (per-service rules are intentionally withheld to keep the prompt focused).
6. **Explicit scoring guidance** in the system prompt (see below).
7. A strict JSON output schema.

The model returns:

```json
{
  "overallScore": 0-100,
  "summary": "...",
  "pillars": [
    { "pillar": "...", "score": 0-100, "findings": [ ... ] }
  ],
  "quickWins": [ ... ]
}
```

Each finding is tagged with a `source` field:

- `rule-based` — originated from the Phase 1 pre-scan.
- `ai-analysis` — added by the LLM during refinement.

This makes the trail from rule → finding fully **auditable**.

---

## 5. The Scoring Guidance Given to the LLM

The system prompt explicitly instructs the model **not to over-penalize**:

> - Score the architecture based on what **IS** present, not what could be added.
> - A well-connected architecture with appropriate services should score **60–80**.
> - Only score below 50 for architectures with **critical gaps** (no auth, no monitoring, single points of failure).
> - Findings are improvement suggestions, not reasons to penalize the score severely.

This counters the most common reviewer concern — that an LLM left to its own devices will "deduct points for everything." The model is anchored to a realistic, design-stage scoring band.

### Pillar score rollup

Each pillar gets its own 0–100 score from the LLM, conditioned on:

- Pre-scan findings that map to that pillar's category.
- Service-mix appropriateness (e.g., presence of identity = boost to Security).
- The LLM's own architecture-specific reasoning.

The **overall score** is the LLM's holistic synthesis across pillars — not a strict arithmetic mean. This is intentional: critical gaps in one pillar (e.g., no identity) should weigh more than nominal gaps in others.

### Maturity bands shown in the UI

The app's primary, user-facing signal is a **qualitative maturity band**, not a
bare number. Each 0–100 score (overall and per pillar) maps to a band, using the
existing color thresholds for continuity:

| Band | Score | Label | Short form | Color |
|---|---|---|---|---|
| `strong` | 80–100 | Strong alignment | Strong | 🟢 |
| `adequate` | 60–79 | Adequate, with gaps | Adequate | 🟡 |
| `developing` | 40–59 | Developing | Developing | 🟠 |
| `early` | 0–39 | Early / needs attention | Early | 🔴 |

Alongside each band, the UI shows a **gaps-identified summary** (finding counts by
severity), making the actionable findings — not a number — the headline. Labels
are deliberately non-judgmental (no "good/bad", pass/fail, or letter grades) to
avoid the score being misread as a verdict on a real environment.

The band/short-form/color mapping is centralized in
[src/services/wafMaturity.ts](src/services/wafMaturity.ts) and reused across the
validation modal, comparison modal, toolbar badge, and report.

### Optional numeric score (off by default)

The raw 0–100 number is **hidden by default** in the live UI and revealed by a
**"Show numeric score"** toggle in the validation modal header. The preference is
persisted to `localStorage` via
[src/stores/validationDisplayStore.ts](src/stores/validationDisplayStore.ts).
When enabled, the number returns to the score circle, the overall headline, and
each pillar row. The **multi-model comparison** view always keeps the number,
because it needs a numeric basis to rank models against each other. The
**downloaded markdown report** also always includes the numeric signal for
archival completeness, regardless of the toggle.

The underlying score model is unchanged — bands are derived, not stored — so
saved validations, version history, telemetry, and comparisons are unaffected.

---

## 6. Why a Hybrid Approach (and Not Pure LLM or Pure Rules)?

| Approach | Pros | Cons |
|---|---|---|
| **Pure rules** | Fast, deterministic, fully auditable | Brittle, misses context, can't reason about novel patterns |
| **Pure LLM** | Flexible, context-aware, explains itself | Non-deterministic, can hallucinate findings, inconsistent scoring |
| **Hybrid (this app)** | Deterministic baseline + contextual nuance, auditable rule provenance, faster prompts | More code paths to maintain |

Concretely, hybrid wins on three reviewer concerns:

1. **Determinism floor** — every score is anchored to a rule-engine pre-scan that any reviewer can reproduce.
2. **Smaller, focused prompts** — only pattern-level findings are sent to the LLM (not the entire 100+ per-service rule list), making responses faster and more on-task.
3. **Source attribution** — every finding has a `source` tag (`rule-based` vs `ai-analysis`), so reviewers can see exactly what came from where.

---

## 7. Known Limitations

Be upfront with reviewers about these. The score does **not** account for:

1. **Runtime configuration** — A diagram cannot show whether an App Service has zone redundancy enabled, a SQL DB has geo-replication, or a Storage account uses private endpoints. The validator can only suggest these as findings.
2. **SKU and pricing tier** — The diagram has no notion of "Standard vs Premium" for most services.
3. **Network topology details** — Subnets, NSG rules, route tables, and private endpoints are not first-class diagram nodes.
4. **IAM/RBAC specifics** — Identity *presence* is detected; identity *configuration* is not.
5. **Data classification & compliance regimes** — HIPAA, PCI-DSS, FedRAMP context is taken only from the description, not validated.
6. **Operational maturity** — CI/CD, IaC adoption, runbooks, on-call patterns are not in the diagram.
7. **LLM variability** — Different models (or even repeated calls to the same model) may return slightly different scores for the same input. The hybrid pre-scan dampens this, but does not eliminate it.

The validator's output banner and report footer both link out to:

- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/architecture/framework/)
- [Azure Well-Architected Review (official assessment tool)](https://learn.microsoft.com/assessments/azure-architecture-review/)

so users always have the path to a more authoritative review.

---

## 8. Reproducibility & Auditability

For any validation run, the app captures:

- The exact AI model used (e.g., `GPT-5.2 (medium)`), shown in the report footer.
- Token counts (prompt / completion / total) and elapsed time.
- `hybridMetadata` attached to the validation result:
  - `localFindings` — number of Phase 1 findings.
  - `patternsDetected` — list of pattern keys triggered.
  - `localElapsedMs` — Phase 1 runtime.
  - `preliminaryScore` — the deterministic score before LLM refinement.
  - `kbRulesUsed` — size of the rule knowledge base.

Reviewers can also use **Multi-Model Comparison** to run the same architecture through all 7 configured models side-by-side and observe scoring variance directly — this is the most honest way to communicate the inherent fuzziness of any LLM-assisted score.

---

## 9. Where to Look in the Code

| Concern | File |
|---|---|
| Validation orchestration & LLM call | [src/services/architectureValidator.ts](src/services/architectureValidator.ts) |
| Deterministic rule engine | [src/services/wafPatternDetector.ts](src/services/wafPatternDetector.ts) |
| Rule knowledge base | [src/data/wafRules.ts](src/data/wafRules.ts) |
| UI display & severity colors | [src/components/ValidationModal.tsx](src/components/ValidationModal.tsx) |
| Model selection / reasoning effort | [src/stores/modelSettingsStore.ts](src/stores/modelSettingsStore.ts) |

---

## 10. Related Documents

- [WAF Scoring FAQ for Reviewers](WAF-SCORING-FAQ.md) — short Q&A addressing the most common pushback.
- [LLM_PROMPT_DOCUMENTATION.md](LLM_PROMPT_DOCUMENTATION.md) — full prompt catalogue.
- [AI_SERVICE_REFERENCE.md](AI_SERVICE_REFERENCE.md) — model configuration reference.

---

*Last reviewed: May 2026 · Maintainer: Arturo Quiroga (PSA, Microsoft)*

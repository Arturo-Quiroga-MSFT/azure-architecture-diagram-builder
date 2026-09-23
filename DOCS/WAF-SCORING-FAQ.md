# WAF Scoring — FAQ for Reviewers

> Short answers to the most common pushback on how the Azure Architecture Diagram Builder produces its Well-Architected Framework scores. For the full methodology, see [WAF-SCORING-METHODOLOGY.md](WAF-SCORING-METHODOLOGY.md).

---

### Q1. Is this just an LLM guessing a score?

**No.** Every validation runs a deterministic, rule-based pre-scan first (Phase 1), then sends those findings along with the architecture to the LLM for contextual refinement (Phase 2). The LLM is anchored to pre-scan evidence and cannot freely invent a score in a vacuum. Each finding carries a `source` tag — `rule-based` or `ai-analysis` — so the trail is auditable.

---

### Q2. Why is the score sometimes different when I re-run validation?

LLMs are non-deterministic by design. Two factors limit variance:

1. The Phase 1 rule engine is fully deterministic — the same diagram always produces the same baseline findings.
2. The system prompt anchors the model to a realistic 60–80 band for "well-connected architectures" and reserves sub-50 scores for critical gaps.

If you need to demonstrate variance honestly, use **Multi-Model Comparison** to run the same prompt through all 7 models side-by-side.

---

### Q3. Is this a substitute for the official Microsoft WAF Assessment?

**No, and the app says so.** The score is a **design-time heuristic on a diagram**, not an audit of a deployed environment. Both the in-app report and our docs link to the official [Azure Well-Architected Review](https://learn.microsoft.com/assessments/azure-architecture-review/) as the authoritative path.

---

### Q4. The score "feels too generous." Why?

This is a deliberate tradeoff. Two design choices push scores up:

1. **The system prompt explicitly instructs the LLM not to over-penalize** for things that *could* be added. A reasonable architecture with the right services should land at 60–80.
2. **A diagram is the lower bound of what an architecture provides.** Many WAF best practices (zone redundancy, private endpoints, managed identity, geo-replication) are runtime configuration choices invisible to a static diagram. Penalizing for absence of *invisible* features would produce misleadingly low scores.

Users who want a stricter assessment can:

- Switch to a more capable reasoning model (e.g., GPT-5.2 medium/high) under model settings.
- Review the per-pillar findings list, which surfaces gaps even when the headline score is healthy.

---

### Q5. The score "feels too harsh." Why?

Usually because:

- A critical-severity pattern was detected (no identity, no monitoring, direct DB access from frontend). The system prompt allows sub-50 scores precisely for these cases.
- A required service was named in the description but missing from the diagram.

Look at the **Detailed Assessment by Pillar** section of the report — every deduction is tied to a concrete finding with a recommendation.

---

### Q6. How are the per-pillar scores computed?

Each pillar gets its own 0–100 score from the LLM, conditioned on:

- Phase 1 pattern findings mapped to that pillar's category.
- The mix of services present (e.g., Microsoft Entra ID = boost to Security).
- The LLM's architecture-specific reasoning.

The **overall score** is a holistic synthesis, **not** a strict arithmetic mean — critical gaps in one pillar (e.g., no auth) intentionally weigh more than minor gaps spread across others.

---

### Q7. What rules are in the knowledge base?

Two sets:

- **Architecture-pattern rules** (~10) — detect topology-level anti-patterns: `single-region`, `single-database`, `no-cache`, `no-monitoring`, `no-identity`, `no-waf`, `direct-db-access`, `no-key-vault`, `no-backup`, `no-api-gateway`.
- **Per-service rules** (~100+) — curated WAF best practices for App Service, Functions, AKS, SQL DB, Cosmos DB, Storage, Key Vault, and other common services.

Source files: [src/data/wafRules.ts](src/data/wafRules.ts) and [src/services/wafPatternDetector.ts](src/services/wafPatternDetector.ts).

---

### Q8. Which AI model produced the score?

It's printed in the validation report footer (e.g., `*Powered by GPT-5.2 (medium) and Azure Well-Architected Framework*`) and recorded in the result's `modelUsed` field. Token counts and latency are captured too, so any score can be traced to a specific model invocation.

---

### Q9. Can the scoring rules be updated?

Yes — the rule knowledge base is plain TypeScript, not embedded in the prompt or hardcoded. To add or modify a rule:

1. Edit [src/data/wafRules.ts](src/data/wafRules.ts) — add to `ARCHITECTURE_PATTERN_RULES` or `SERVICE_SPECIFIC_RULES`.
2. If introducing a new architectural pattern, add the detection logic to `detectPatterns()` in [src/services/wafPatternDetector.ts](src/services/wafPatternDetector.ts).
3. Rebuild and redeploy.

No model fine-tuning required.

---

### Q10. What should I tell stakeholders the score *means*?

> *"This is a directional, design-time WAF alignment signal based on the services drawn on the canvas. A score of 70+ indicates the architecture covers most foundational best practices. Findings below the headline number are concrete improvement suggestions. For a production-ready assessment of a deployed environment, run the official Azure Well-Architected Review."*

---

### Q11. Why does the UI show a maturity "band" instead of a number?

By default the app leads with a **maturity band** (Strong alignment / Adequate,
with gaps / Developing / Early) plus a **gaps-identified summary**, rather than a
bare `NN/100`. A single number is easy to misread as an audit of a real,
deployed environment or as a judgment of the team behind the design — when in
fact it is a diagram-only, design-time heuristic. Bands keep the focus on the
actionable part (the findings) while still conveying overall posture.

The number is not gone: flip **"Show numeric score"** in the validation modal
header to bring it back everywhere (circle, overall headline, and per-pillar
rows). The choice is remembered across sessions. The model-comparison view and
the downloaded report always retain the number. See
[WAF-PILLAR-MATURITY-VIEW-DESIGN.md](WAF-PILLAR-MATURITY-VIEW-DESIGN.md) for the
rationale and band thresholds.

---

*Last reviewed: June 2026 · Maintainer: Arturo Quiroga (PSA, Microsoft)*

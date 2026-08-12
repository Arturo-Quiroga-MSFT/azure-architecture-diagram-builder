# AADB Model Specialization Strategy

## Goal

Use measured AADB evidence to recommend models by feature, workload, prompt style, and operating objective. Do not declare one globally best model.

The decision space is:

```text
feature x scenario x prompt style x quality/latency/cost objective
```

A model may be strongest for WAF reasoning while another is faster and more reliable for structured topology JSON. AADB should preserve user choice while offering evidence-based defaults.

## Evidence Layers

Keep these layers separate:

1. **Canonical capture:** Full model, deployment, provider, API format, reasoning effort, prompt contract, app commit, latency, tokens, success/failure, and output.
2. **Deterministic evaluation:** Computable correctness, schema, graph, compiler, deployment, and requirement checks.
3. **Blinded human review:** Model identity removed during rating to reduce brand and expectation bias.
4. **Semantic evaluation:** Built-in and custom judge results with judge model/version recorded separately.
5. **User preference:** Comparison selections, critique winners, and overrides. Treat as preference evidence, not correctness labels.
6. **Operational evidence:** Production success rate, latency distribution, token usage, cost, and post-processing repairs.

After human review, rejoin ratings to canonical rows through a one-way case hash and analyze by model. Never place model identity in the blinded artifact.

## Feature Suites

Each feature needs its own dataset and evaluator contract.

| Feature suite | Core deterministic evidence | Human or semantic evidence |
| --- | --- | --- |
| Topology generation | Schema, graph integrity, required capabilities/flows, labels, workflow, renderability, normalization repairs | Architecture suitability, requirement adherence, security, explanation quality |
| WAF validation | Known-finding precision/recall, severity, pillar, resource references, duplicate findings | Architectural significance, actionability, false-positive cost |
| Deployment artifacts | Bicep build, Terraform validate, ARM what-if, resource coverage, secure defaults, parameterization | Operational clarity, maintainability, migration suitability |
| Deployment guide | Command syntax, prerequisite completeness, official-doc grounding, ordering, referenced resources | Usability, safety, ambiguity, recovery guidance |
| Architecture modification | Requested delta correctness, preservation of unchanged graph, no collateral deletion | Intent fulfillment, quality of changed design |
| Blueprint and Reference modes | Schema, component coverage, topology consistency, image nonblank/canvas bounds | Visual hierarchy, readability, explanatory value |
| Both mode | Shared manifest coverage, topology/blueprint component agreement | Whether both artifacts communicate the same architecture |
| Model critique | Pairwise ranking agreement, defect recall, unsupported-claim count | Rank correlation with architect preference and rationale quality |
| IaC/image/live-Azure import | Source-resource coverage, relationship precision, no invented resources | Diagram usefulness and understandable grouping |

Do not mix these outputs into one dataset. Their response schemas and definitions of correctness differ.

## Canonical Evidence Schema

Every model attempt should record:

- `feature`
- `scenario_id`
- `prompt_style`
- `attempt_id` and repetition number
- Model ID, display name, provider role, deployment, API format, reasoning effort
- Model/deployment version when the platform exposes it
- System-prompt or contract SHA-256
- App commit and dirty-worktree/source fingerprint
- Request timestamp and region
- Success or structured failure
- P50/P95-compatible latency sample
- Input, output, and total tokens
- Final user-visible artifact after AADB normalization
- Post-processing repair/drop counters
- Deterministic, semantic, and human result references
- Dated pricing-source reference when cost is computed

Never derive cost from undocumented assumptions. If no dated input/output pricing source is pinned, report cost as unavailable.

## Experimental Design

Use balanced matrices:

- Same prompts across candidate models.
- Same reasoning policy unless reasoning effort is itself the tested variable.
- Randomized execution order to reduce time/capacity effects.
- At least 3-5 repetitions per model/scenario for routing decisions.
- Preserve failed attempts; do not build datasets only from successful output.
- Keep bridge scenarios when contracts change, but do not compare incompatible aggregate versions.

Two attempts per model/scenario are acceptable for seed discovery, not for production routing confidence.

Report confidence intervals or bootstrap ranges once sample sizes support them. Avoid ranking models on differences smaller than observed run-to-run variance.

## Scorecard Dimensions

Keep dimensions visible rather than collapsing them into one opaque score:

- Generation success rate
- Strict deterministic pass rate
- Required-service recall
- Required-flow recall
- Human quality by dimension
- Semantic evaluator results
- P50 and P95 latency
- Average and total tokens
- Estimated cost per attempt and per successful artifact, when grounded
- Post-processing repair/drop rate
- Variance across attempts
- User comparison selection rate
- Critique/human ranking agreement

Present a Pareto frontier across quality, reliability, latency, tokens, and cost. Offer views such as:

- Highest quality
- Fastest acceptable
- Best token efficiency
- Best quality per dollar
- Most reliable structured output
- Best for regulated or complex prompts

## Human Review and Judge Controls

- Blind candidate model identity during review.
- Store reviewer identity/team, timestamp, rubric version, and decision.
- Track judge model/deployment separately from candidate model.
- Avoid treating a same-family judge as independent evidence.
- Calibrate semantic evaluators against human labels before using them for routing.
- Review deterministic/human/judge disagreements rather than averaging them away.
- Preserve hard rows and negative examples.

## User Preference Telemetry

AADB's comparison and critique experiences provide valuable preference signals. Capture only privacy-reviewed metadata:

- Feature and scenario category, not raw sensitive prompts by default
- Models compared
- Selected model or artifact
- Whether critique changed the selection
- Time to selection
- Whether the chosen artifact was subsequently validated, modified, exported, or used for deployment artifacts
- Explicit thumbs-up/down or structured feedback when available

User choice is affected by aesthetics, familiarity, and speed. It should influence product recommendations but must not override technical correctness gates.

## Recommendation and Routing Policy

Recommendations should be scoped and explainable:

```text
Recommended for topology generation on complex regulated prompts:
GPT-X, based on N reviewed attempts, strict pass rate, human score,
P95 latency, and estimated cost as of pricing version Y.
```

A model becomes eligible for an automatic feature default only when:

1. Dataset and evaluator contracts are versioned.
2. Minimum sample size is met across representative scenarios.
3. Generation reliability passes the feature threshold.
4. Deterministic checks pass at the agreed rate.
5. Blinded human review is complete.
6. Semantic evaluator is calibrated where used.
7. Latency and cost are within product objectives.
8. No scenario category shows a critical safety or correctness regression.

The router should return a recommendation plus evidence, not silently remove user control. Users can always override it.

## Current Topology v2 Evidence

Current scorecard artifacts:

- `.foundry/results/aadb-model-scorecard-v2.json`
- `.foundry/results/aadb-model-scorecard-v2.md`

Current evidence is provisional because human review and semantic evaluator v2 are pending. It includes three models, eight scenarios, and two attempts per model/scenario. Use it for hypothesis generation, not production auto-routing.

## Execution Roadmap

1. Complete and finalize blinded topology v2 architect review.
2. Rebuild the topology scorecard with human ratings rejoined by case hash.
3. Calibrate and register `aadb_architecture_quality` version 2.
4. Register Foundry dataset version 2 and run the semantic baseline.
5. Increase repetitions for scenarios where model rankings are close or unstable.
6. Build the WAF validation suite using architect-authored known findings.
7. Build deployment-artifact suites with compiler and what-if gates.
8. Add modification-fidelity and critique-ranking suites.
9. Add a dated model-pricing input and quality-per-dollar views.
10. Surface evidence-backed per-feature recommendations in AADB while preserving manual model selection.

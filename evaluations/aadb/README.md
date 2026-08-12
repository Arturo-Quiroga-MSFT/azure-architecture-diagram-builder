# AADB Evaluation Baseline

This folder defines the versioned Phase 1 evaluation baseline for the Azure Architecture Diagram Builder (AADB). It evaluates AADB as a bring-your-own generative AI application rather than treating it as only a model or a Foundry-hosted agent.

## Phase 1 scope

The v1 smoke corpus uses two synthetic prompts and 14 captured model candidates from existing AADB comparison reports:

- Multi-region commerce: 9 candidates
- Intelligent document processing: 5 candidates

No production prompts, user diagrams, feedback comments, identities, subscription IDs, or customer architecture content are included.

## Files

| File | Purpose |
| --- | --- |
| `cases.v1.json` | Human-reviewed scenario expectations and graph constraints |
| `cases.v2.json` | Eight reviewed current-app topology prompts and v2 requirements |
| `FOUNDRY-DATASET-STORAGE-RUNBOOK.md` | Reusable project-identity, RBAC, policy exemption, upload, verification, and cleanup procedure |
| `MODEL-SPECIALIZATION-STRATEGY.md` | Cross-feature model evaluation, scorecard, and routing strategy |
| `V2-PLAN.md` | Current-app dataset design, gates, and execution order |
| `V2-REVIEW-GUIDE.md` | Blinded architect review rubric and finalization instructions |
| `../../eval.yaml` | Local Foundry evaluation intent; not proof of a registered remote suite |
| `../../scripts/evaluations/build-aadb-seed.mjs` | Normalize approved comparison outputs into Foundry-compatible JSONL |
| `../../scripts/evaluations/run-aadb-deterministic.mjs` | Run authoritative deterministic application evaluators |
| `../../.foundry/datasets/aadb-eval-seed-v1.jsonl` | Versioned candidate dataset |
| `../../.foundry/datasets/manifest.json` | Dataset hash, sources, and lineage |
| `../../.foundry/evaluators/aadb-architecture-quality-v1.md` | Source rubric for registered Foundry evaluator `aadb_architecture_quality` version 1 |
| `../../.foundry/evaluation-metadata.json` | Selected Foundry project, evaluator, dataset, and run lineage |
| `../../.foundry/results/aadb-baseline-v1.rows.jsonl` | Row-level deterministic evaluation output |
| `../../.foundry/results/aadb-baseline-v1.json` | Machine-readable aggregate summary |
| `../../.foundry/results/aadb-baseline-v1.md` | Human-readable baseline report |
| `../../.foundry/results/aadb-foundry-baseline-v1.json` | Machine-readable Foundry semantic run summary |
| `../../.foundry/results/aadb-foundry-baseline-v1.md` | Human-readable Foundry semantic run summary and portal link |

## Run locally

```bash
npm run eval:aadb
```

The builder refuses to overwrite `v1` if regenerated content differs. When case definitions or approved source outputs change, create `v2`. Use `--force` only to correct an acknowledged generation defect in the current version.

## Deterministic evaluator contract

The v1 evaluator measures:

- Architecture JSON schema
- Unique service and group identifiers
- Valid, non-self-referential connection endpoints
- Valid group membership
- Orphan services
- Workflow references
- Required service-set recall
- Required connection recall
- Forbidden connection direction
- Minimum grouping and workflow coverage
- Captured latency and token usage

Deterministic checks are authoritative for computable defects. An LLM judge must not override them.

## Baseline result

The first run produced:

- Candidates: 14
- Passed strict deterministic gate: 2 (14.3%)
- Average score: 93.9/100
- Required-service recall: 100%
- Required-connection recall: 91.1%

The strict pass rate is low because most saved candidates use the semantically reversed `Azure Monitor -> Log Analytics` connection. Several intelligent-document-processing candidates also omit a required pipeline flow. These are useful baseline failures and must not be removed to improve the score.

## Foundry semantic evaluation

The JSONL contains the standard `query`, `response`, `context`, and `expected_behavior` fields needed for Foundry quality and custom evaluators.

Selected project:

- Project: `Main-Project`
- Account: `r2d2-foundry-001`
- Region: East US 2
- Judge deployment: `gpt-5.4-mini`

Completed remote setup:

1. Verified the built-in `relevance` and `coherence` evaluators.
2. Registered `aadb_architecture_quality` version 1 with an ordinal 1–5 score and pass threshold 4.
3. Started evaluation group `eval_32eda4aa4285491fadd28cb700857c29`.
4. Started run `evalrun_de4529ef901d478a98e801deacede30f` over all 14 captured responses.
5. Connected approved Azure Storage and granted the Main-Project managed identity `Storage Blob Data Contributor` at the storage-account scope.
6. Registered `aadb-eval-seed` version `1` and verified its backing blob SHA-256 against the immutable local seed.

The first semantic run used inline JSONL before the approved storage connection and named dataset were available. This does not change the approved local dataset: `case_id` links every compact cloud row to the complete graph and deterministic result. Future runs can use Foundry dataset `aadb-eval-seed` version `1`; its remote ID, backing blob URI, and verified hash are recorded in `.foundry/evaluation-metadata.json`.

For repeatable dataset registration, including the critical distinction between the Foundry account identity and project identity, follow [Foundry Dataset Storage Access Runbook](FOUNDRY-DATASET-STORAGE-RUNBOOK.md). The runbook also documents the tenant policy exemption used for a short upload window and the mandatory cleanup that restores storage network isolation.

The first cloud run completed:

- Relevance: 14/14 passed
- Coherence: 14/14 passed
- AADB architecture quality: 1/14 passed
- Overall: 1/14 passed, 13 failed, 0 errored
- Evaluator usage: 59,516 tokens across 42 invocations

The aggregate semantic result is cached in `.foundry/results/aadb-foundry-baseline-v1.json` and summarized in `.foundry/results/aadb-foundry-baseline-v1.md`. Row-level scores and reasons are available through the Foundry portal report linked from those files. The current Foundry MCP catalog does not expose a row-level result artifact download command.

Next review steps:

1. Inspect row-level custom-evaluator reasons in the Foundry portal.
2. Compare semantic results with the deterministic baseline; do not combine them into one opaque score.
3. Review disagreements between the LLM judge and deterministic evaluator with an Azure architect before changing either rubric.

## Current-app topology dataset v2

V2 captures the current topology-generation path rather than rebuilding rows from historical comparison reports. The browser app and capture harness share the same versioned system prompt and post-processing modules, so evaluation rows include the service normalization, endpoint repair, and integrity counters that users receive.

The execution plan is documented in [AADB Current-App Evaluation Dataset v2 Plan](V2-PLAN.md).

Capture matrix:

- Scenarios: 8
- Models: GPT-5.6 Luna, GPT-5.2, and Kimi K2.7 Code
- Attempts per scenario/model: 2
- Total attempts: 48
- Successful attempts in this capture: 48
- Failed attempts in this capture: 0

The 100% generation success rate applies only to this pinned 48-attempt capture. It is not a claim about all prompts, models, or production traffic.

Pinned lineage:

- App commit: `71ef7e82e354aefb738bb92082216ae4e9326875`
- Topology contract SHA-256: `6a72f6ec1b86524b826f4cb32978109784678acc8a780e9f5bb9add089f890bf`
- Attempt-file SHA-256: `8e50a004c56ceca0844cfee6efdbc94aad963c20d3238bff8cc7c914c6dc5ef4`
- Dataset SHA-256: `0528c33f3abd6d81b3369a1bddc1a26643cb5d82d46c323fba06ba85150c35b3`

Deterministic v2 baseline:

- Strict passes: 27/48 (56.3%)
- Average score: 96.8/100
- All rows passed schema, label, connection-type, sizing, monitoring-density, visualization, Fabric-core, and post-processing checks
- Remaining failures are concentrated in required capability/flow coverage plus one workflow-reference defect

Run the reproducible local pipeline:

```bash
npm run eval:aadb:v2
```

Live capture is intentionally separate because it calls deployed models:

```bash
./scripts/dev-all.sh
npm run eval:aadb:v2:capture -- --dry-run
npm run eval:aadb:v2:capture -- --concurrency=3
```

The v2 review queue contains 16 blinded rows, two per scenario. Follow [AADB v2 Architect Review Guide](V2-REVIEW-GUIDE.md). Foundry dataset registration and evaluator version 2 are blocked until the review is completed and explicitly approved.

The provisional per-model analysis is available in `.foundry/results/aadb-model-scorecard-v2.json` and `.foundry/results/aadb-model-scorecard-v2.md`. It retains canonical model lineage, reports deterministic quality, latency, token usage, scenario/prompt specialization, and the current Pareto frontier, and automatically incorporates human ratings after review finalization. Cost remains explicitly unavailable until a dated model-pricing source is versioned with the evaluation.

The broader program for WAF validation, deployment artifacts, architecture modification, visual modes, and critique ranking is documented in [AADB Model Specialization Strategy](MODEL-SPECIALIZATION-STRATEGY.md).

Foundry MCP authentication is now working against subscription `ARTURO-MngEnvMCAP094150` and tenant `a172a259-b1c7-4944-b2e1-6d551f954711`.

## Versioning rules

- Keep a stable dataset name: `aadb-eval-seed`.
- Increment versions as `v1`, `v2`, and so on.
- Never edit an approved version in place merely to improve scores.
- Record source file hashes in `.foundry/datasets/manifest.json`.
- Add real production-derived cases only after privacy review and human curation.
- Promote a seed dataset to curated or production stages only after architect review and evaluator calibration.

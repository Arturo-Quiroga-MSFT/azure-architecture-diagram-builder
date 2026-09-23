# AADB Current-App Evaluation Dataset v2 Plan

## Objective

Create a versioned evaluation dataset from the current AADB topology-generation contract rather than the May 2026 model-comparison artifacts used by v1. Preserve v1 unchanged as historical evidence.

The v2 program evaluates the application output users receive after current service normalization and connection repair. It separately records generation failures so invalid JSON, empty output, timeouts, and service errors are not hidden by successful-only sampling.

## Scope

This first implementation covers current natural-language **Topology** mode.

Out of scope for this dataset version:

- Reference-mode editorial schema and PNG quality
- Blueprint-mode schema and PNG quality
- Both-mode topology/blueprint consistency
- Architecture Chat modifications
- WAF validation and recommendation application
- Image, IaC, and live Azure imports

Those surfaces require separate datasets and evaluators because their schemas and success criteria differ from topology generation.

## Dataset Design

Target dataset: `aadb-eval-seed`, local version `v2`, Foundry version `2`.

Capture matrix:

- 8 reviewed prompts
- 3 deployed models selected from current configuration
- 2 attempts per prompt/model
- 48 total generation attempts

Model roles:

- Current application default
- Current recommended architecture-generation model
- One deployed non-OpenAI model for provider diversity

If one role is unavailable, record the availability check and select the nearest deployed replacement. Do not silently reduce the matrix.

Prompt strata:

- 2 concise or underspecified requests
- 4 detailed requests with measurable workload constraints
- 1 ambiguous request that requires explicit assumptions
- 1 request containing tension between requirements that should be resolved safely

Workload coverage:

1. Simple three-tier web application
2. Event-driven order processing
3. Private PaaS and zero-trust networking
4. RAG or agentic AI application
5. Intelligent document processing
6. Real-time analytics or IoT
7. Microsoft Fabric medallion analytics
8. Multi-region regulated workload with RPO/RTO constraints

The two v1 workloads remain represented as bridge scenarios, but v2 expectations are reviewed against the current product contract.

## Versioned Artifacts

Planned files:

| File | Purpose |
| --- | --- |
| `evaluations/aadb/cases.v2.json` | Reviewed current-app prompts and structured requirements |
| `evaluations/aadb/V2-PLAN.md` | This execution and governance plan |
| `src/services/architectureGenerationContract.ts` | Pure shared topology prompt contract |
| `src/services/architecturePostProcessing.ts` | Pure shared current-app normalization and integrity repair |
| `scripts/evaluations/capture-aadb-v2.ts` | Capture every live generation attempt through the existing proxy |
| `scripts/evaluations/build-aadb-seed-v2.mjs` | Convert reviewed successful captures into immutable Foundry JSONL |
| `scripts/evaluations/run-aadb-deterministic-v2.mjs` | Current-contract deterministic evaluator |
| `scripts/evaluations/test-aadb-v2.mjs` | Contract, lineage, immutability, and evaluator tests |
| `.foundry/captures/aadb-v2-attempts.jsonl` | All successful and failed attempts |
| `.foundry/datasets/aadb-eval-seed-v2.jsonl` | Successful normalized responses for evaluation |
| `.foundry/datasets/manifest.v2.json` | Commit, prompt-contract, source, model, and dataset lineage |
| `.foundry/results/aadb-baseline-v2.*` | Deterministic row and aggregate results |
| `.foundry/reviews/aadb-v2-review-sample.jsonl` | Stratified human-review queue |

Existing v1 files are not overwritten.

## Capture Contract

Every attempt records:

- Attempt ID and scenario ID
- Prompt and prompt SHA-256
- Topology contract SHA-256
- App commit SHA and dirty-worktree flag
- Capture timestamp
- Model, display name, deployment name, API format, and reasoning effort
- Attempt number
- HTTP/generation status
- Latency and token usage
- Raw model content when available
- Final normalized architecture when successful
- Normalization integrity counters
- Error class, status, and safe error text when unsuccessful

The semantic dataset contains only successful normalized architectures because evaluator rows require a response. Generation success rate remains an explicit deterministic metric computed from the complete attempt file.

## Current-Contract Deterministic Evaluator

Version 2 measures:

- Required topology arrays and service fields
- Unique service and group IDs
- No service/group ID collision
- Valid connection endpoints and no self-edges
- Valid group membership
- No orphan services
- Valid workflow references
- Duplicate-edge count
- Required workload capability recall
- Required primary-flow recall
- Forbidden workload anti-patterns
- Group count and workflow-step bounds
- Current service-count and connection-count guidance
- Specific, non-generic connection labels
- Valid connection types
- Monitoring hub-and-spoke density
- Dedicated visualization service when requested
- Fabric capacity and OneLake when Fabric is requested
- Current post-processing repair/drop/orphan counters
- Generation success, latency, and token usage

The stale v1 prohibition on `Azure Monitor -> Log Analytics` is removed. V2 expectations follow the current product prompt and architect-reviewed scenario requirements.

## Human Review Gate

Before remote registration:

1. Generate a deterministic review queue containing 12-16 rows.
2. Include passing, borderline, and failing outputs across every selected model.
3. Blind model identity in the review copy.
4. Have an Azure architect label architecture suitability, requirement adherence, security, and explanation quality.
5. Review deterministic/judge disagreements before changing thresholds.
6. Do not remove hard rows or weaken evaluators to improve the score.

The current execution can produce the review queue, but it cannot declare human review complete without an actual reviewer decision.

## Foundry Gate

Register Foundry dataset version `2` only after:

- All planned attempts completed or have explicit recorded failures
- Dataset and manifest hashes are stable
- Deterministic v2 tests pass
- Human review is completed and recorded
- The remote backing blob hash matches the local v2 JSONL

Use `FOUNDRY-DATASET-STORAGE-RUNBOOK.md` for the approved storage access and cleanup sequence.

Create or register `aadb_architecture_quality` version `2` only after its rubric is aligned with the current topology contract. Do not run evaluator v1 against dataset v2.

## Validation and Exit Criteria

Implementation is complete when:

- Browser generation and capture use the same pure prompt and post-processing modules
- Focused contract tests pass
- Existing build and v1 baseline remain green
- Capture records all attempts, including failures
- Exactly 48 attempts are present unless a documented availability blocker exists
- V2 dataset, manifest, deterministic results, and review queue are generated
- Human review status is explicit
- Foundry registration and remote hash verification are complete after review
- Metadata records v1 and v2 lineage without replacing historical run references

## Execution Order

1. Extract and test shared current-app generation contract.
2. Add v2 cases and all-attempt capture harness.
3. Capture current outputs from a pinned commit/worktree state.
4. Build immutable v2 JSONL and manifest.
5. Run deterministic evaluator v2 and create the review queue.
6. Complete human review and calibrate evaluator v2.
7. Register Foundry dataset version `2` and verify its remote hash.
8. Run semantic evaluation with evaluator version `2`.
9. Compare only bridge scenarios across versions; do not compare aggregate v1/v2 pass rates as if the contracts were identical.

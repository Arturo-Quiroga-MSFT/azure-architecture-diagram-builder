# AADB v2 Architect Review Guide

The v2 dataset cannot be registered in Foundry or used to calibrate evaluator version 2 until a human Azure architect reviews the blinded sample.

Review file:

```text
.foundry/reviews/aadb-v2-review-sample.jsonl
```

The sample contains 16 rows: two outputs from each of the eight scenarios. Model identity, deployment name, and token usage are removed. Each row includes the prompt, expected behavior, structured requirements, normalized architecture, deterministic score, and empty reviewer fields.

## Rating Scale

Set each rating to an integer from 1 through 5.

| Rating | Meaning |
| ---: | --- |
| 1 | Fundamentally incorrect, unsafe, or unusable |
| 2 | Major omissions or design errors; extensive rework required |
| 3 | Viable direction with material gaps or unclear decisions |
| 4 | Strong architecture with minor correctable gaps |
| 5 | Excellent, coherent, and suitable as a reference-quality response |

Rate four dimensions:

- `architectureSuitability`: Is the design technically appropriate for the workload and constraints?
- `requirementAdherence`: Does the design satisfy mandatory capabilities and primary flows without inventing contradictory behavior?
- `security`: Are identity, secrets, network exposure, data protection, and operational safeguards appropriate to the scenario?
- `explanationQuality`: Do connection labels and workflow steps clearly explain the end-to-end behavior and important assumptions?

## Review Procedure

The easiest workflow is the resumable interactive reviewer:

```bash
npm run eval:aadb:v2:review:interactive
```

It presents one blinded architecture at a time, asks for the four ratings and optional notes, and saves atomically after every confirmed row. Use `q` to pause or `s` to skip a row. Resume with the same command.

Check progress at any time:

```bash
npm run eval:aadb:v2:review:status
```

Alternatively, edit the JSONL reviewer objects directly by following the steps below.

For each JSONL row:

1. Read `query`, `expected_behavior`, and `requirements` before inspecting the architecture.
2. Inspect `architecture.services`, `architecture.connections`, `architecture.groups`, and `architecture.workflow`.
3. Use `deterministic` as evidence, not as the final answer. A reviewer may disagree with it.
4. Set all four ratings from 1 to 5.
5. Set `reviewer.status` to `reviewed`.
6. Add concise `reviewer.notes`, especially when disagreeing with deterministic results or identifying an evaluator alias/flow defect.

Example completed reviewer object:

```json
{
  "status": "reviewed",
  "architectureSuitability": 4,
  "requirementAdherence": 3,
  "security": 4,
  "explanationQuality": 4,
  "notes": "The design is viable, but the residency conflict is not explicitly resolved in the workflow."
}
```

Do not add model guesses or attempt to identify the generating model.

## Finalize the Review

After the status command reports `16/16 complete`, validate and record the decision:

```bash
npm run eval:aadb:v2:review -- \
  --reviewed-by='<reviewer name or team>' \
  --decision=approve
```

Use `--decision=reject` when the dataset or rubric needs correction. The command does not modify ratings; it validates the review file, calculates aggregate human scores, updates `.foundry/reviews/aadb-v2-review-status.json` and `.foundry/evaluation-metadata.json`, and rebuilds the unblinded model scorecard with ratings rejoined through the case hash.

The approval command fails when:

- Any row is still pending.
- Any rating is missing or outside 1-5.
- The sample does not contain 16 unique review IDs and all eight scenarios.
- The dataset hash differs from the pinned v2 manifest.
- The reviewer name or explicit decision is missing.

`--decision=approve` does not assign ratings or mean "approve every row." It finalizes a completed review and records whether the reviewed dataset is approved for Foundry registration.

## After Approval

1. Review deterministic/human disagreements.
2. Correct evaluator defects only when the architecture and human rationale support the correction.
3. Draft and register `aadb_architecture_quality` version `2` against the reviewed current contract.
4. Register Foundry dataset `aadb-eval-seed` version `2` by following `FOUNDRY-DATASET-STORAGE-RUNBOOK.md`.
5. Download the backing blob and verify SHA-256 against `.foundry/datasets/aadb-eval-seed-v2.jsonl`.
6. Update `.foundry/evaluation-metadata.json` with remote v2 lineage while preserving v1.
7. Run the semantic v2 baseline.

Do not register or evaluate v2 remotely while review status is `pending-human-review` or `rejected`.

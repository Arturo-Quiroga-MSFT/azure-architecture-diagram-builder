# AADB Foundry Semantic Evaluation Baseline v1

**Project:** Main-Project  
**Judge deployment:** gpt-5.4-mini  
**Dataset:** aadb-eval-seed v1, 14 captured model candidates  
**Evaluation:** `eval_32eda4aa4285491fadd28cb700857c29`  
**Run:** `evalrun_de4529ef901d478a98e801deacede30f`

## Results

| Criterion | Passed | Failed | Pass rate |
| --- | ---: | ---: | ---: |
| Relevance | 14 | 0 | 100% |
| Coherence | 14 | 0 | 100% |
| AADB architecture quality | 1 | 13 | 7.1% |
| Overall run | 1 | 13 | 7.1% |

No rows errored or were skipped.

## Usage

- Evaluator invocations: 42
- Prompt tokens: 54,223
- Completion tokens: 5,293
- Total evaluator tokens: 59,516

## Interpretation

Generic relevance and coherence both passed every architecture. Those metrics confirm that the responses are readable and topically related, but they do not detect Azure architecture defects.

The custom AADB architecture-quality evaluator passed only one candidate. The deterministic baseline passed two. Both domain-aware gates are far stricter than generic text-quality metrics, which validates the layered evaluation design.

The deterministic baseline remains authoritative for computable defects such as invalid graph references, orphan services, forbidden flow direction, and required-flow coverage. Foundry semantic results add architecture suitability and explanation quality; they do not replace deterministic checks.

## Row-level review

[Open the Foundry evaluation report](https://ai.azure.com/nextgen/r/eiiyHg0-RDWmhtkoidTulg,AQ-FOUNDRY-RG,,r2d2-foundry-001,Main-Project/build/evaluations/eval_32eda4aa4285491fadd28cb700857c29/run/evalrun_de4529ef901d478a98e801deacede30f) to inspect per-row scores and reasons.

The current Foundry MCP catalog returns aggregate metrics but does not expose a row-level evaluation artifact download command. Do not infer which specific deterministic pass disagreed with the custom judge until the portal rows are reviewed.

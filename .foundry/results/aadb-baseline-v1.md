# AADB Deterministic Evaluation Baseline v1

**Generated:** 2026-08-11T15:03:55.599Z
**Dataset:** aadb-eval-seed v1 (14 candidate rows, 2 scenarios)

## Overall

- Pass rate: **14%** (2/14)
- Average deterministic score: **93.9/100**
- Average required-service recall: **100%**
- Average required-connection recall: **91%**

## By model

| Model | Candidates | Pass rate | Avg score | Service recall | Connection recall | Avg latency | Avg tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-5.2-codex | 1 | 100% | 100 | 100% | 100% | 9979 ms | 2451 |
| deepseek-v3.2-speciale | 1 | 0% | 95 | 100% | 100% | 12482 ms | 2996 |
| gpt-5.1 | 2 | 0% | 95 | 100% | 100% | 17457 ms | 4007 |
| gpt-5.3-codex | 1 | 0% | 95 | 100% | 100% | 23535 ms | 3781 |
| grok-4.3 | 2 | 50% | 95 | 100% | 88% | 50409 ms | 5815 |
| gpt-5.2 | 2 | 0% | 92.5 | 100% | 88% | 22222 ms | 3714 |
| gpt-5.4 | 2 | 0% | 92.5 | 100% | 88% | 29094 ms | 3681 |
| gpt-5.4-mini | 2 | 0% | 92.5 | 100% | 88% | 15270 ms | 3937 |
| grok-4.1-fast | 1 | 0% | 90 | 100% | 75% | 7869 ms | 2618 |

## By scenario

| Scenario | Candidates | Pass rate | Avg score | Service recall | Connection recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| multi-region-commerce | 9 | 11% | 95 | 100% | 97% |
| intelligent-document-processing | 5 | 20% | 92 | 100% | 80% |

## Failed candidates

- **multi-region-commerce::gpt51-low** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::gpt52-low** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::gpt53codex-low** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::gpt54-low** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::gpt54mini-low** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::deepseek** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::unknown** (95/100): 1 forbidden connection(s)
- **multi-region-commerce::grok41fast** (90/100): 1 required connection(s) missing; 1 forbidden connection(s)
- **intelligent-document-processing::gpt51-low** (95/100): 1 forbidden connection(s)
- **intelligent-document-processing::gpt52-low** (90/100): 1 required connection(s) missing; 1 forbidden connection(s)
- **intelligent-document-processing::gpt54-low** (90/100): 1 required connection(s) missing; 1 forbidden connection(s)
- **intelligent-document-processing::gpt54mini-low** (90/100): 1 required connection(s) missing; 1 forbidden connection(s)

## Interpretation

This baseline measures deterministic structure and requirement coverage only. It does not yet measure architecture suitability, semantic explanation quality, safety, or groundedness. Those dimensions are reserved for calibrated Foundry built-in and custom evaluators in the next step.


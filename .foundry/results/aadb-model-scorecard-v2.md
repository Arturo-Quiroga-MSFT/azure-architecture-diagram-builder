# AADB Model Specialization Scorecard v2

**Feature:** Topology generation
**Dataset:** aadb-eval-seed v2
**Dataset SHA-256:** `0528c33f3abd6d81b3369a1bddc1a26643cb5d82d46c323fba06ba85150c35b3`
**Human review:** pending-human-review
**Recommendations:** Provisional

## Model Scorecard

| Model | Attempts | Success | Strict pass | Avg score | Service recall | Flow recall | P50 latency | P95 latency | Avg tokens | Human score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6 Luna | 16 | 100% | 75% | 98 | 97% | 92% | 27.6s | 47.7s | 4977 | pending |
| Kimi K2.7 Code | 16 | 100% | 50% | 97.6 | 95% | 92% | 98.1s | 201.3s | 9447 | pending |
| GPT-5.2 | 16 | 100% | 44% | 94.8 | 95% | 73% | 55.4s | 122.4s | 6070 | pending |

## Current Leaders

- Deterministic quality: **gpt-5.6-luna**
- Sampled human quality: **pending**
- P50 latency: **gpt-5.6-luna**
- Token efficiency: **gpt-5.6-luna**
- Pareto frontier: **gpt-5.6-luna**

These leaders are provisional until blinded human review and semantic evaluator v2 are complete.

## Scenario Leaders

| Scenario | Provisional leader |
| --- | --- |
| enterprise-rag-agent | gpt-5.6-luna |
| event-driven-orders-detailed | gpt-5.2 |
| fabric-medallion-current | gpt-5.6-luna |
| intelligent-document-processing-v2 | gpt-5.2 |
| iot-real-time-analytics | gpt-5.6-luna |
| multi-region-regulated-tension | kimi-k2-7-code |
| private-paas-zero-trust | gpt-5.6-luna |
| three-tier-web-concise | kimi-k2-7-code |

## Prompt-Style Leaders

| Prompt style | Provisional leader |
| --- | --- |
| ambiguous | gpt-5.6-luna |
| concise | gpt-5.6-luna |
| conflicting-constraints | kimi-k2-7-code |
| detailed | gpt-5.6-luna |

## Evidence Boundaries

- Model identity is retained in canonical capture, dataset, and deterministic results.
- Human-review rows remain blinded; final ratings are rejoined through a SHA-256 case reference.
- Cost is not computed because this evaluation package has no dated, versioned model-pricing source.
- User selections and critique winners should be tracked as preference signals, not architecture correctness labels.
- Aggregate v1 and v2 scores are not directly comparable because their prompts and evaluator contracts differ.


# AADB Deterministic Evaluation Baseline v2

**Evaluated from capture:** 2026-08-12T13:41:48.193Z
**Dataset:** aadb-eval-seed v2 (48 rows, 8 scenarios)
**Capture:** 48 attempts; 48 successful; 0 failed

## Overall

- Strict pass rate: **56%** (27/48)
- Average deterministic score: **96.8/100**
- Average required-service recall: **95%**
- Average required-flow recall: **86%**

## By model

| Model | Rows | Pass rate | Avg score | Service recall | Flow recall | Avg latency | Avg tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gpt-5.6-luna | 16 | 75% | 98 | 97% | 92% | 30840 ms | 4977 |
| kimi-k2-7-code | 16 | 50% | 97.6 | 95% | 92% | 104308 ms | 9447 |
| gpt-5.2 | 16 | 44% | 94.8 | 95% | 73% | 63015 ms | 6070 |

## By scenario

| Scenario | Rows | Pass rate | Avg score | Service recall | Flow recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| fabric-medallion-current | 6 | 83% | 99.5 | 98% | 100% |
| event-driven-orders-detailed | 6 | 100% | 99.4 | 100% | 96% |
| intelligent-document-processing-v2 | 6 | 50% | 98.9 | 96% | 100% |
| private-paas-zero-trust | 6 | 83% | 98.8 | 98% | 95% |
| three-tier-web-concise | 6 | 83% | 98.3 | 100% | 89% |
| enterprise-rag-agent | 6 | 33% | 95.4 | 98% | 72% |
| iot-real-time-analytics | 6 | 17% | 95.1 | 88% | 83% |
| multi-region-regulated-tension | 6 | 0% | 89.2 | 83% | 50% |

## Failed rows

- **three-tier-web-concise::gpt-5.2::2** (90/100): required flows
- **private-paas-zero-trust::gpt-5.2::2** (93/100): required services; required flows
- **enterprise-rag-agent::gpt-5.2::1** (95/100): required flows
- **enterprise-rag-agent::gpt-5.2::2** (95/100): required flows
- **enterprise-rag-agent::kimi-k2-7-code::2** (95/100): required flows
- **enterprise-rag-agent::kimi-k2-7-code::1** (87.5/100): required services; required flows
- **intelligent-document-processing-v2::gpt-5.6-luna::2** (97.8/100): graph integrity
- **intelligent-document-processing-v2::kimi-k2-7-code::2** (97.8/100): required services
- **iot-real-time-analytics::gpt-5.6-luna::1** (94.3/100): required services
- **intelligent-document-processing-v2::kimi-k2-7-code::1** (97.8/100): required services
- **iot-real-time-analytics::gpt-5.2::1** (92.1/100): required services; required flows
- **iot-real-time-analytics::gpt-5.2::2** (95/100): required flows
- **iot-real-time-analytics::kimi-k2-7-code::1** (92.1/100): required services; required flows
- **fabric-medallion-current::gpt-5.2::2** (97.1/100): required services
- **iot-real-time-analytics::kimi-k2-7-code::2** (97.1/100): required services
- **multi-region-regulated-tension::gpt-5.6-luna::2** (82.5/100): required services; required flows
- **multi-region-regulated-tension::gpt-5.6-luna::1** (97.5/100): required services
- **multi-region-regulated-tension::gpt-5.2::1** (80/100): required services; required flows
- **multi-region-regulated-tension::gpt-5.2::2** (80/100): required services; required flows
- **multi-region-regulated-tension::kimi-k2-7-code::1** (97.5/100): required services
- **multi-region-regulated-tension::kimi-k2-7-code::2** (97.5/100): required services

## Review status

A blinded 16-row architect review queue is available at `.foundry/reviews/aadb-v2-review-sample.jsonl`.
Remote registration and semantic evaluator v2 remain gated on completed human review.


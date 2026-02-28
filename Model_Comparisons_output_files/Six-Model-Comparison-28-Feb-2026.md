---
title: Six-Model Comparison for Azure Architecture Diagram Generation
description: Comprehensive benchmarking of GPT-5.1, GPT-5.2, GPT-5.2 Codex, GPT-5.3 Codex, DeepSeek V3.2 Speciale, and Grok 4.1 Fast across four architecture prompts
author: Arturo Quiroga
ms.date: 2026-02-28
ms.topic: reference
keywords:
  - model comparison
  - azure architecture
  - GPT-5
  - DeepSeek
  - Grok
  - diagram generation
  - PSA guidance
estimated_reading_time: 12
---

## Overview

This document presents a structured comparison of six AI models generating Azure architecture diagrams through the Azure Architecture Diagram Builder. All models received the same four prompts, all using low reasoning effort, and all running through the same Azure OpenAI endpoint. The goal is to provide PSAs and internal teams with clear, data-driven guidance on which model to select for different use cases.

## Test Configuration

| Parameter         | Value                                              |
|-------------------|----------------------------------------------------|
| Date              | February 28, 2026                                  |
| Reasoning Effort  | Low (all models)                                   |
| Endpoint          | Azure OpenAI (Responses API for GPT, Chat Completions API for third-party) |
| Prompts           | 4 short natural-language descriptions              |
| Models Tested     | 6                                                  |
| Total Generations | 24 (6 models x 4 prompts, 100% success rate)       |

## Models Tested

| Model              | Deployment Name              | API Type              |
|---------------------|------------------------------|-----------------------|
| GPT-5.1             | gpt-5.1                     | Responses API         |
| GPT-5.2             | gpt-5.2                     | Responses API         |
| GPT-5.2 Codex       | gpt-5.2-codex               | Responses API         |
| GPT-5.3 Codex       | gpt-5.3-codex               | Responses API         |
| DeepSeek V3.2 Speciale | DeepSeek-V3-2-Speciale    | Chat Completions API  |
| Grok 4.1 Fast       | grok-4.1-fast-20250709      | Chat Completions API  |

## Test Prompts

| ID | Prompt                                                   |
|----|----------------------------------------------------------|
| P1 | E-commerce platform with payments and search             |
| P2 | Real-time IoT telemetry pipeline with dashboards         |
| P3 | Microservices app with API gateway and auth              |
| P4 | RAG chatbot with vector search and AI                    |

These prompts were intentionally brief (one sentence each) to test how well each model infers Azure-specific architecture from minimal input.

## Summary Table

| Model              | Avg Time | Avg Tokens | Avg Services | Avg Connections | Avg Groups | Avg Workflows | Svc/sec |
|---------------------|----------|------------|--------------|-----------------|------------|---------------|---------|
| GPT-5.1             | 12.9s    | 3,769      | 10.0         | 10.0            | 5.0        | 9.3           | 0.77    |
| GPT-5.2             | 51.6s    | 3,757      | 11.5         | 12.8            | 5.0        | 8.3           | 0.22    |
| GPT-5.2 Codex       | 31.9s    | 3,224      | 9.3          | 9.8             | 5.0        | 7.0           | 0.29    |
| GPT-5.3 Codex       | 49.5s    | 3,982      | 11.5         | 12.5            | 5.0        | 7.8           | 0.23    |
| DeepSeek V3.2       | 20.3s    | 3,121      | 11.5         | 14.8            | 5.3        | 7.3           | 0.57    |
| Grok 4.1 Fast       | 8.1s     | 2,854      | 10.5         | 11.0            | 5.8        | 9.0           | 1.30    |

## Tier Classification

The six models cluster into three distinct performance tiers based on the speed-vs-quality tradeoff.

### Tier 1: Speed Leaders

Grok 4.1 Fast and GPT-5.1 deliver results in under 15 seconds while still producing architecturally complete diagrams. Grok is the fastest model tested at 8.1 seconds average and achieves the highest efficiency ratio (1.30 services per second). GPT-5.1 follows at 12.9 seconds with the deepest workflow narratives (9.3 steps average).

### Tier 2: Balanced Performance

DeepSeek V3.2 Speciale occupies a unique position. At 20.3 seconds average, it is moderately fast while producing the richest connectivity of any model (14.8 connections average). It uses the second-fewest tokens (3,121) and generates the most groups (5.3 average). This model excels at understanding inter-service relationships.

### Tier 3: Deep Reasoning

GPT-5.2, GPT-5.2 Codex, and GPT-5.3 Codex require 32 to 52 seconds per diagram. GPT-5.2 and GPT-5.3 Codex tie for the most services (11.5 average) and produce high connection counts (12.5 to 12.8). GPT-5.2 Codex is the lightest of this tier (3,224 tokens) but generates fewer services (9.3 average) and connections (9.8).

## Detailed Rankings

### Speed

| Rank | Model              | Avg Time | Range          |
|------|--------------------|----------|----------------|
| 1    | Grok 4.1 Fast      | 8.1s     | 7.1s to 8.7s   |
| 2    | GPT-5.1            | 12.9s    | 10.5s to 14.6s |
| 3    | DeepSeek V3.2      | 20.3s    | 12.8s to 31.9s |
| 4    | GPT-5.2 Codex      | 31.9s    | 19.0s to 46.1s |
| 5    | GPT-5.3 Codex      | 49.5s    | 45.8s to 53.6s |
| 6    | GPT-5.2            | 51.6s    | 42.4s to 61.2s |

Grok 4.1 Fast also shows the tightest variance (1.6s spread), making it the most predictable model for latency-sensitive scenarios.

### Token Efficiency

| Rank | Model              | Avg Total Tokens | Avg Completion Tokens |
|------|--------------------|------------------|-----------------------|
| 1    | Grok 4.1 Fast      | 2,854            | 1,488                 |
| 2    | DeepSeek V3.2      | 3,121            | 1,701                 |
| 3    | GPT-5.2 Codex      | 3,224            | 1,831                 |
| 4    | GPT-5.2            | 3,757            | 2,364                 |
| 5    | GPT-5.1            | 3,769            | 2,376                 |
| 6    | GPT-5.3 Codex      | 3,982            | 2,590                 |

Lower token consumption translates directly to lower cost per diagram. Grok uses 28% fewer tokens than GPT-5.3 Codex while producing comparable service counts.

### Architecture Richness (Service Count)

| Rank | Model              | Avg Services | Range   | Std Dev |
|------|--------------------|--------------|---------|---------|
| 1    | GPT-5.2            | 11.5         | 10 - 12 | 0.9     |
| 1    | GPT-5.3 Codex      | 11.5         | 11 - 12 | 0.5     |
| 1    | DeepSeek V3.2      | 11.5         | 10 - 14 | 1.7     |
| 4    | Grok 4.1 Fast      | 10.5         | 9 - 12  | 1.1     |
| 5    | GPT-5.1            | 10.0         | 8 - 12  | 1.6     |
| 6    | GPT-5.2 Codex      | 9.3          | 6 - 11  | 1.9     |

GPT-5.3 Codex is the most consistent producer (SD 0.5), while DeepSeek shows the widest variance (SD 1.7), ranging from 10 to 14 services depending on the prompt.

### Connectivity Density

| Rank | Model              | Avg Connections | Range   |
|------|--------------------|-----------------|---------|
| 1    | DeepSeek V3.2      | 14.8            | 11 - 22 |
| 2    | GPT-5.2            | 12.8            | 12 - 13 |
| 3    | GPT-5.3 Codex      | 12.5            | 12 - 13 |
| 4    | Grok 4.1 Fast      | 11.0            | 9 - 12  |
| 5    | GPT-5.1            | 10.0            | 7 - 12  |
| 6    | GPT-5.2 Codex      | 9.8             | 5 - 12  |

DeepSeek stands out here. Its 22-connection output for the microservices prompt is the single highest connectivity score across all 24 generations, demonstrating a strong understanding of service-mesh patterns.

### Workflow Depth

| Rank | Model              | Avg Steps | Range  |
|------|--------------------|-----------|--------|
| 1    | GPT-5.1            | 9.3       | 7 - 10 |
| 2    | Grok 4.1 Fast      | 9.0       | 8 - 10 |
| 3    | GPT-5.2            | 8.3       | 8 - 9  |
| 4    | GPT-5.3 Codex      | 7.8       | 7 - 9  |
| 5    | DeepSeek V3.2      | 7.3       | 5 - 10 |
| 6    | GPT-5.2 Codex      | 7.0       | 5 - 8  |

GPT-5.1 and Grok produce the most detailed workflow narratives, which is valuable for PSA presentations that walk stakeholders through data flow.

## Per-Prompt Analysis

### P1: E-commerce Platform

| Model              | Time   | Tokens | Services | Connections | Groups | Workflows |
|---------------------|--------|--------|----------|-------------|--------|-----------|
| GPT-5.1             | 13.5s  | 3,944  | 12       | 12          | 5      | 10        |
| GPT-5.2             | 52.9s  | 3,711  | 12       | 13          | 5      | 8         |
| GPT-5.2 Codex       | 39.1s  | 3,611  | 11       | 12          | 5      | 8         |
| GPT-5.3 Codex       | 49.0s  | 3,826  | 12       | 12          | 5      | 7         |
| DeepSeek V3.2       | 12.8s  | 2,860  | 10       | 11          | 5      | 6         |
| Grok 4.1 Fast       | 8.7s   | 2,987  | 12       | 12          | 6      | 10        |

Winners: Grok (fastest at 8.7s), GPT-5.1 (most services and workflows tied with Grok at 12 and 10), GPT-5.2 (most connections at 13).

E-commerce is a well-understood domain. All models performed strongly, with four of six generating 12 services. Grok delivered the same richness as GPT-5.1 in one-sixth of the time.

### P2: IoT Telemetry Pipeline

| Model              | Time   | Tokens | Services | Connections | Groups | Workflows |
|---------------------|--------|--------|----------|-------------|--------|-----------|
| GPT-5.1             | 13.1s  | 3,846  | 11       | 12          | 5      | 10        |
| GPT-5.2             | 49.8s  | 3,957  | 10       | 13          | 5      | 8         |
| GPT-5.2 Codex       | 46.1s  | 3,883  | 10       | 12          | 5      | 7         |
| GPT-5.3 Codex       | 53.6s  | 4,426  | 12       | 13          | 5      | 9         |
| DeepSeek V3.2       | 14.8s  | 2,855  | 12       | 13          | 6      | 8         |
| Grok 4.1 Fast       | 8.4s   | 2,863  | 10       | 11          | 6      | 8         |

Winners: Grok (fastest at 8.4s), GPT-5.3 Codex and DeepSeek (tied at 12 services), three models tied at 13 connections.

IoT prompts benefit from models that understand event-driven patterns. DeepSeek produced the same service count as GPT-5.3 Codex (12) in less than a third of the time (14.8s vs 53.6s).

### P3: Microservices Architecture

| Model              | Time   | Tokens | Services | Connections | Groups | Workflows |
|---------------------|--------|--------|----------|-------------|--------|-----------|
| GPT-5.1             | 10.5s  | 3,343  | 8        | 7           | 5      | 7         |
| GPT-5.2             | 42.4s  | 3,603  | 12       | 12          | 5      | 8         |
| GPT-5.2 Codex       | 23.7s  | 2,620  | 6        | 5           | 5      | 5         |
| GPT-5.3 Codex       | 49.6s  | 3,925  | 11       | 12          | 5      | 7         |
| DeepSeek V3.2       | 31.9s  | 3,642  | 14       | 22          | 5      | 5         |
| Grok 4.1 Fast       | 7.1s   | 2,675  | 9        | 9           | 6      | 8         |

Winners: Grok (fastest at 7.1s), DeepSeek (most services at 14, most connections at 22), GPT-5.2 (most workflows at 8).

This prompt reveals the largest quality spread across models. DeepSeek generated 14 services with 22 connections, modeling a genuine service mesh. GPT-5.2 Codex produced only 6 services and 5 connections for the same prompt. The microservices domain appears to be where model choice matters most.

> [!IMPORTANT]
> For microservices architecture prompts, DeepSeek V3.2 Speciale produces significantly richer output than any other model, with 57% more connections than the next-best model on this prompt type.

### P4: RAG Chatbot

| Model              | Time   | Tokens | Services | Connections | Groups | Workflows |
|---------------------|--------|--------|----------|-------------|--------|-----------|
| GPT-5.1             | 14.6s  | 3,943  | 9        | 9           | 5      | 10        |
| GPT-5.2             | 61.2s  | 3,755  | 12       | 13          | 5      | 9         |
| GPT-5.2 Codex       | 19.0s  | 2,781  | 10       | 10          | 5      | 8         |
| GPT-5.3 Codex       | 45.8s  | 3,752  | 11       | 13          | 5      | 8         |
| DeepSeek V3.2       | 21.5s  | 3,128  | 10       | 13          | 5      | 10        |
| Grok 4.1 Fast       | 8.1s   | 2,889  | 11       | 12          | 5      | 10        |

Winners: Grok (fastest at 8.1s), GPT-5.2 (most services at 12, most connections at 13), three models tied at 10 workflow steps.

RAG/AI prompts showed strong performance across all models. Even the fastest model (Grok at 8.1s) produced 11 services and 10 workflow steps, nearly matching the slowest model's output.

## Key Findings

### 1. Speed and quality are not correlated

Grok 4.1 Fast produces diagrams 6x faster than GPT-5.2 while delivering comparable service counts (10.5 vs 11.5 average). The additional 43 seconds of processing in GPT-5.2 yields only one additional service on average.

### 2. DeepSeek owns connectivity

With a 14.8 average connection count (18% higher than the runner-up), DeepSeek V3.2 Speciale consistently models richer inter-service relationships. This is especially pronounced on microservices prompts, where it generates nearly double the connections of most GPT models.

### 3. GPT-5.2 Codex underperforms its tier

Despite requiring 31.9 seconds average, GPT-5.2 Codex produces the fewest services (9.3), fewest connections (9.8), and fewest workflow steps (7.0). It also shows the highest variance (SD 1.9 for services), making it the least predictable model.

### 4. Prompt domain matters more than model selection for some architectures

E-commerce (P1) and RAG (P4) prompts produced relatively uniform results across all six models. Microservices (P3) showed the widest divergence. Model selection has the biggest impact when the prompt targets complex distributed patterns.

### 5. Token cost inversely correlates with speed

The two fastest models (Grok and DeepSeek) also consume the fewest tokens. Grok uses 28% fewer tokens than GPT-5.3 Codex. For high-volume diagram generation, these models offer significant cost advantages.

## PSA Recommendations

### For live customer demos and workshops

Use Grok 4.1 Fast. At 8.1 seconds average with tight variance (7.1s to 8.7s), it provides a responsive experience that keeps audience attention. Service and workflow output is strong enough for presentation-quality diagrams.

### For detailed architecture reviews

Use GPT-5.2 or GPT-5.3 Codex. These models invest more processing time to produce architectures with 11 to 12 services and 12 to 13 connections. The additional detail supports deeper technical conversations.

### For microservices-focused engagements

Use DeepSeek V3.2 Speciale. No other model approaches its connectivity density for distributed service patterns. At 20.3 seconds average, the wait is acceptable for the quality of output.

### For cost-sensitive batch operations

Use Grok 4.1 Fast or DeepSeek V3.2 Speciale. Both consume fewer tokens (2,854 and 3,121 average) and complete faster, reducing both API cost and elapsed time for bulk generation.

### For maximum workflow narrative depth

Use GPT-5.1. Despite being the second-fastest model, it produces the most detailed workflow sequences (9.3 steps average, up to 10), which helps stakeholders understand end-to-end data flow.

## Model Selection Quick Reference

| Scenario                      | Recommended Model    | Why                                        |
|-------------------------------|----------------------|--------------------------------------------|
| Live demos                    | Grok 4.1 Fast        | 8s response, minimal latency variance      |
| Architecture deep-dives       | GPT-5.2              | Richest service and connection output      |
| Microservices patterns        | DeepSeek V3.2        | 14.8 avg connections, service-mesh aware   |
| Cost-optimized batch runs     | Grok 4.1 Fast        | Fewest tokens, fastest completion          |
| Workflow-focused presentations| GPT-5.1              | 9.3 avg workflow steps, fast generation    |
| Balanced quality and speed    | DeepSeek V3.2        | 20s with 11.5 services and 14.8 connections|
| Maximum consistency           | GPT-5.3 Codex        | Lowest service variance (SD 0.5)           |

## Appendix: Raw Data Files

All diagram JSON files and comparison reports are stored in the `model-comparisons/` directory.

### Comparison Reports

| Prompt | File                               |
|--------|------------------------------------|
| P1     | `model-comparison-1772289751953.json` |
| P2     | `model-comparison-1772289766279.json` |
| P3     | `model-comparison-1772289781521.json` |
| P4     | `model-comparison-1772289808978.json` |

### Individual Diagram Files

Each file follows the naming pattern `azure-diagram-{timestamp}-{model-suffix}.json`. The timestamp groups diagrams by prompt (all models for a given prompt share the same timestamp).

| Timestamp       | Prompt |
|-----------------|--------|
| 1772289748953   | P1     |
| 1772289764279   | P2     |
| 1772289779521   | P3     |
| 1772289804978   | P4     |

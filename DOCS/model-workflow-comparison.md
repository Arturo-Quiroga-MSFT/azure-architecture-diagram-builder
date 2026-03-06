---
title: "Model Workflow Narrative Comparison"
description: "Analysis of architecture workflow narrative quality across 7 AI models using two reference architectures"
author: "Arturo Quiroga"
ms.date: 2026-03-06
ms.topic: reference
keywords:
  - model comparison
  - workflow narrative
  - architecture quality
  - GPT-5.4
  - Azure architecture
estimated_reading_time: 8
---

## Overview

This document compares the architecture workflow narrative quality produced by
all seven AI models available in the Azure Architecture Diagram Builder. Two
reference architectures were used as prompts, and each model generated a
complete diagram with services, connections, groups, and a step-by-step
workflow narrative.

The workflow panel in the application displays a numbered sequence of
architecture steps that describe how data flows through the system. Each step
references the services involved and explains the purpose of the interaction.
The quality of these narratives directly impacts how useful the generated
diagram is for stakeholders, architects, and documentation.

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Date | 2026-03-06 |
| Reasoning Effort | Low (all models) |
| Models Tested | 7 (GPT-5.1, GPT-5.2, GPT-5.2 Codex, GPT-5.3 Codex, GPT-5.4, DeepSeek V3.2 Speciale, Grok 4.1 Fast) |
| Test Runs | 2 (one per reference architecture) |

## Reference Architectures

### Test 1: Enterprise RAG Application

**Prompt:** An enterprise RAG application with Azure AI Foundry for
orchestration, Azure AI Search with hybrid vector and keyword retrieval,
Azure OpenAI GPT-5 for generation, Azure Cache for Redis for semantic
caching, and App Service with Entra ID authentication.

### Test 2: Intelligent Document Processing Pipeline

**Prompt:** An intelligent document processing pipeline with Azure AI
Document Intelligence for OCR, Azure OpenAI for summarization, Cognitive
Search for indexing, Cosmos DB for metadata, and Blob Storage for document
retention.

## Results Summary

### Test 1: Enterprise RAG Application

| Model | Time | Tokens | Services | Connections | Workflow Steps |
|-------|------|--------|----------|-------------|----------------|
| GPT-5.1 | 18.6s | 4,622 | 10 | 14 | 10 |
| GPT-5.2 | 61.6s | 4,078 | 10 | 12 | 9 |
| GPT-5.2 Codex | 26.5s | 3,352 | 8 | 12 | 7 |
| GPT-5.3 Codex | 36.3s | 4,296 | 10 | 15 | 7 |
| GPT-5.4 | 48.4s | 3,438 | 8 | 10 | 9 |
| DeepSeek V3.2 Speciale | 20.6s | 3,206 | 11 | 13 | 9 |
| Grok 4.1 Fast | 17.3s | 2,921 | 9 | 13 | 8 |

### Test 2: Intelligent Document Processing Pipeline

| Model | Time | Tokens | Services | Connections | Workflow Steps |
|-------|------|--------|----------|-------------|----------------|
| GPT-5.1 | 16.6s | 3,990 | 10 | 13 | 8 |
| GPT-5.2 | 35.2s | 3,322 | 11 | 12 | 10 |
| GPT-5.2 Codex | 36.4s | 3,441 | 9 | 12 | 6 |
| GPT-5.3 Codex | 27.2s | 3,880 | 10 | 13 | 8 |
| GPT-5.4 | 56.0s | 3,863 | 10 | 13 | 8 |
| DeepSeek V3.2 Speciale | 18.0s | 3,058 | 10 | 13 | 8 |
| Grok 4.1 Fast | 11.7s | 2,634 | 8 | 10 | 8 |

## Narrative Quality Rankings

### Combined Ranking (Both Tests)

| Rank | Model | Narrative Style | Key Strengths |
|------|-------|----------------|---------------|
| 1 | GPT-5.4 | Design-document quality | Most precise architectural language, explains "why" at every step, covers both ingestion and query paths |
| 2 | GPT-5.1 | Comprehensive | Broadest coverage including batch flows and edge cases, mentions Cognitive Search external data source patterns |
| 3 | GPT-5.2 | Balanced and enterprise-aware | Adds enterprise components such as API Management, covers governance flags and TTL-based caching |
| 4 | GPT-5.3 Codex | Dense and technically accurate | Uses correct Azure patterns like Event Grid triggers and workload identity, mentions citation anchors |
| 5 | DeepSeek V3.2 Speciale | Practical but terse | Mentions real patterns like Cosmos DB change feed, App Insights separation, conditional flow logic |
| 6 | Grok 4.1 Fast | Telegraphic | 3x faster than average, but shallow narratives and missing security services |
| 7 | GPT-5.2 Codex | Minimal | Fewest steps, sometimes architecturally incorrect connection flows |

## Detailed Model Analysis

### GPT-5.4: Consistently Best Narratives

GPT-5.4 produced the highest quality workflow narratives across both
reference architectures. Each step reads like a paragraph from a formal
architecture design document, explaining not only what happens but why each
interaction exists.

Sample narrative step (RAG test):

> "App Service checks Azure Cache for Redis to determine whether a
> semantically equivalent question already has a reusable grounded response."

Sample narrative step (IDP test):

> "The application sends the uploaded file to the orchestration layer, which
> stores the original document for long-term retention before analysis."

Distinctive qualities:

- Precise architectural language ("semantically equivalent," "orchestration-level formatting")
- Covers both ingestion and query paths in the same workflow
- Mentions compliance patterns such as document retention before processing
- Connection labels are descriptive sentences, not short phrases

### GPT-5.1: Most Comprehensive Coverage

GPT-5.1 generated the most workflow steps on average and covered scenarios
that other models missed entirely.

Unique contributions:

- Only model to include batch document ingestion as a separate workflow step in the RAG test
- Mentioned Cognitive Search connecting to Blob Storage as an external data source (a real Azure pattern)
- Covered security setup (credentials and configuration) as a distinct step
- Referenced "processed document variants" written back to storage

### GPT-5.2: Enterprise Architecture Awareness

GPT-5.2 added enterprise-grade components that other models omitted, such as
API Management as the entry point for the IDP pipeline.

Unique contributions:

- Only model to include API Management in the document processing architecture
- Mentioned governance flags and TTL-based cache entries in the RAG test
- Covered both ingestion and query user paths
- Generated the most services (11) in the IDP test

### GPT-5.3 Codex: Architecturally Correct Patterns

GPT-5.3 Codex used the most technically accurate Azure patterns in its
architecture designs.

Unique contributions:

- Used Event Grid for blob event triggering (correct pattern, not direct blob triggers)
- Mentioned workload identity tokens (real Azure security pattern)
- Referenced "citation anchors" from search results and "governance traces" in storage
- Used terms like "reasoning-ready output tokens" showing deep model knowledge

### DeepSeek V3.2 Speciale: Practical Implementation Focus

DeepSeek produced practical, implementable architectures with some real-world
patterns that GPT models missed.

Unique contributions:

- Mentioned Cosmos DB change feed for search indexer (a real Azure pattern)
- Separated Application Insights from Azure Monitor (architecturally distinct services)
- Included conditional logic in workflow: "if hit, returns cached response (skip steps 5-6)"
- Generated the most services in the RAG test (11)

### Grok 4.1 Fast: Speed Over Depth

Grok was consistently the fastest model (11-17 seconds) and cheapest in token
usage, but sacrificed narrative depth.

Characteristics:

- Connection labels are short phrases: "Authenticates user sessions," "Forwards queries"
- Missing security services (no Entra ID or Key Vault in IDP test)
- Used Application Insights instead of Azure Monitor (valid but unconventional)
- Mentioned "streams final response" which is a realistic implementation detail

### GPT-5.2 Codex: Minimal Output

GPT-5.2 Codex consistently produced the fewest workflow steps and sometimes
generated architecturally incorrect connection flows.

Issues observed:

- Document Intelligence connecting directly to Azure OpenAI (bypassing the orchestrator)
- Azure OpenAI connecting directly to Cognitive Search (summaries do not flow directly to search)
- Missing event-driven triggers in the IDP pipeline
- Fewest services and steps across both tests

## Speed vs Quality Tradeoff

| Model | Avg Time | Avg Tokens | Narrative Quality |
|-------|----------|------------|-------------------|
| Grok 4.1 Fast | 14.5s | 2,778 | Low |
| DeepSeek V3.2 Speciale | 19.3s | 3,132 | Medium |
| GPT-5.1 | 17.6s | 4,306 | High |
| GPT-5.2 Codex | 31.5s | 3,397 | Low |
| GPT-5.3 Codex | 31.8s | 4,088 | Medium-High |
| GPT-5.2 | 48.4s | 3,700 | High |
| GPT-5.4 | 52.2s | 3,651 | Highest |

GPT-5.4 takes approximately 3.6x longer than Grok 4.1 Fast but produces
narratives suitable for architecture documentation and stakeholder
presentations. GPT-5.1 offers a strong middle ground: near-Grok speed with
high narrative quality.

## Recommendations

- Use GPT-5.4 when generating diagrams for documentation, presentations, or
  architecture reviews where narrative quality matters
- Use GPT-5.1 for comprehensive architecture exploration where coverage of
  edge cases and batch flows is important
- Use Grok 4.1 Fast for rapid iteration and prototyping where visual layout
  matters more than narrative depth
- Use the Compare Models feature to run all models simultaneously and select
  the best output for each architecture

## Source Data

The raw comparison data is stored in the repository:

- RAG test: `Architecture_workflow_comparison/model-comparison-1772825263628.md`
- IDP test: `Architecture_workflow_comparison/model-comparison-1772825493391.md`
- Individual diagram JSON files are stored alongside the comparison reports

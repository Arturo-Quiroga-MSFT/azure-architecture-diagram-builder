# Model Comparison Report

**Generated:** 2026-05-28T19:50:22.531Z

**Prompt:** A multi-modal AI platform with Azure OpenAI for text and vision, Azure AI Speech for real-time transcription, Azure AI Translator for multilingual support, Event Hubs for streaming ingest, and Application Insights for model observability

**Reasoning Effort:** low

**Models Compared:** 12 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** | 25.9s | 4,497 | 10 | 9 | 5 | 9 |
| **GPT-5.2** | 24.2s | 3,936 | 11 | 11 | 6 | 7 |
| **GPT-5.2 Codex** 🏆 Most Thorough 🔗 Most Detailed | 37.8s | 3,823 | 10 | 13 | 5 | 9 |
| **GPT-5.3 Codex** | 36.0s | 3,779 | 9 | 12 | 5 | 8 |
| **GPT-5.4** | 34.4s | 3,831 | 8 | 9 | 4 | 6 |
| **GPT-5.4 Mini** | 16.4s | 3,469 | 9 | 8 | 4 | 6 |
| **DeepSeek V3.2 Speciale** 📦 Most Services | 14.8s | 3,112 | 12 | 12 | 5 | 7 |
| **DeepSeek V4 Pro** | 33.5s | 2,841 | 8 | 9 | 3 | 7 |
| **Grok 4.1 Fast** ⚡ Fastest 💰 Cheapest | 9.5s | 2,627 | 8 | 9 | 4 | 8 |
| **Grok 4.3** | 34.2s | 4,572 | 5 | 4 | 3 | 5 |
| **Mistral Large 3** | 12.1s | 2,975 | 9 | 10 | 5 | 9 |
| **Kimi K2.5** | 26.2s | 5,613 | 9 | 8 | 4 | 7 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,436 | 3,061 | 4,497 |
| GPT-5.2 | 1,436 | 2,500 | 3,936 |
| GPT-5.2 Codex | 1,436 | 2,387 | 3,823 |
| GPT-5.3 Codex | 1,436 | 2,343 | 3,779 |
| GPT-5.4 | 1,436 | 2,395 | 3,831 |
| GPT-5.4 Mini | 1,436 | 2,033 | 3,469 |
| DeepSeek V3.2 Speciale | 1,462 | 1,650 | 3,112 |
| DeepSeek V4 Pro | 1,459 | 1,382 | 2,841 |
| Grok 4.1 Fast | 1,409 | 1,218 | 2,627 |
| Grok 4.3 | 1,423 | 732 | 4,572 |
| Mistral Large 3 | 1,475 | 1,500 | 2,975 |
| Kimi K2.5 | 1,429 | 4,184 | 5,613 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-app-ai |
| Azure OpenAI | Azure OpenAI | grp-app-ai |
| Speech Services | Speech Services | grp-app-ai |
| Translator | Translator | grp-app-ai |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Application Insights | Application Insights | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Streaming Ingestion, Application & AI Processing, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-event-hubs | svc-functions | Trigger serverless function execution for each incoming multi-modal event | async |
| svc-entra | svc-functions | Issue OAuth tokens and validate caller identity for stream processing operations | sync |
| svc-functions | svc-speech | Send audio segments for low-latency speech-to-text transcription | sync |
| svc-functions | svc-openai | Call text and vision models for contextual understanding and content generation | sync |
| svc-functions | svc-translator | Submit transcribed and generated text for multilingual translation | sync |
| svc-functions | svc-storage | Persist transcripts, translations, and analysis results as structured artifacts | sync |
| svc-functions | svc-az-monitor | Emit execution metrics and logs for centralized monitoring | async |
| svc-az-monitor | svc-app-insights | Forward application performance and model telemetry for observability dashboards | async |
| svc-az-monitor | svc-log-analytics | Stream consolidated platform logs and metrics for querying and alerting | async |

**Workflow:**

1. External producers send multi-modal events (audio, text, metadata) that are ingested into Event Hubs and await processing by Azure Functions. _(svc-event-hubs, svc-functions)_
2. Azure Functions is triggered by Event Hubs messages and validates the caller context and permissions using Microsoft Entra ID issued tokens. _(svc-event-hubs, svc-functions, svc-entra)_
3. Azure Functions extracts audio segments from the event payload and invokes Speech Services to generate real-time transcriptions. _(svc-functions, svc-speech)_
4. Azure Functions submits text and optional images to Azure OpenAI for multi-modal understanding, summarization, and content generation. _(svc-functions, svc-openai)_
5. Azure Functions sends source and generated text to Translator to produce multilingual outputs for supported target languages. _(svc-functions, svc-translator)_
6. Azure Functions aggregates transcripts, translations, and AI analysis metadata and writes them to the Storage Account for downstream consumption. _(svc-functions, svc-storage)_
7. During each function execution, Azure Functions publishes metrics, traces, and custom model events to Azure Monitor for centralized collection. _(svc-functions, svc-az-monitor)_
8. Azure Monitor forwards relevant application and model-level telemetry to Application Insights, enabling detailed observability dashboards and performance analysis. _(svc-az-monitor, svc-app-insights)_
9. Azure Monitor streams consolidated logs and metrics into Log Analytics, where operators can run queries and configure alerts on platform behavior. _(svc-az-monitor, svc-log-analytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-app |
| Azure OpenAI | Azure OpenAI | grp-ai |
| Speech Services | Speech Services | grp-ai |
| Translator | Translator | grp-ai |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-idsec |
| Key Vault | Key Vault | grp-idsec |
| Azure Monitor | Azure Monitor | grp-obs |
| Log Analytics | Log Analytics | grp-obs |
| Application Insights | Application Insights | grp-obs |

**Groups:** Ingress / Streaming, Application / Orchestration, AI Services (Multi-Modal + Language), Data / Storage, Identity / Security, Monitoring / Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-functions | Validate caller identity and authorize API invocations via tokens | sync |
| svc-functions | svc-keyvault | Retrieve AI/service credentials and connection strings at runtime | sync |
| svc-eventhubs | svc-functions | Trigger processing per incoming audio/image event batch/partition | async |
| svc-functions | svc-storage | Persist raw media, transcripts, translations, and enriched outputs | sync |
| svc-functions | svc-speech | Stream audio frames and receive real-time transcription segments | sync |
| svc-functions | svc-translator | Translate transcripts and prompts to requested target languages | sync |
| svc-functions | svc-openai | Submit multimodal prompt (text + image reference) and get generated response | sync |
| svc-functions | svc-eventhubs | Publish enriched transcript/translation/AI insights as downstream events | async |
| svc-functions | svc-azmon | Emit platform metrics and pipeline health signals from the orchestrator | sync |
| svc-azmon | svc-log | Centralize collected telemetry for querying, alerts, and retention | sync |
| svc-azmon | svc-appinsights | Correlate distributed traces and dependency timings for model observability | sync |

**Workflow:**

1. Producers send audio/image events to the streaming ingestion layer; the orchestrator is authorized for protected access. _(svc-eventhubs, svc-functions, svc-entra)_
2. The orchestrator is triggered by new stream events and loads required secrets/configuration. _(svc-eventhubs, svc-functions, svc-keyvault)_
3. Audio content is transcribed in real time and transcript segments are accumulated for downstream processing. _(svc-functions, svc-speech)_
4. Transcripts and/or prompts are translated to the target languages required by consumers or the model prompt strategy. _(svc-functions, svc-translator)_
5. Multimodal inference is performed by combining translated text with image context to generate responses or structured insights. _(svc-functions, svc-openai, svc-storage)_
6. Outputs (transcripts, translations, AI responses) are persisted and optionally published back onto the event stream for downstream systems. _(svc-functions, svc-storage, svc-eventhubs)_
7. End-to-end observability is captured from the orchestrator and centralized for querying and model/pipeline health analysis. _(svc-functions, svc-azmon, svc-appinsights, svc-log)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Speech Services | Speech Services | grp-app |
| Translator | Translator | grp-app |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Application Insights | Application Insights | grp-monitor |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Streaming, Application & AI Services, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-eventhubs | svc-functions | Consume streaming multimodal events for processing | async |
| svc-eventhubs | svc-storage | Capture raw streams for replay and audit | async |
| svc-entra | svc-functions | Authenticate function triggers and service calls | sync |
| svc-functions | svc-speech | Send audio chunks for real-time transcription | sync |
| svc-functions | svc-openai | Submit text and vision prompts for inference | sync |
| svc-functions | svc-translator | Translate transcripts and responses to target languages | sync |
| svc-openai | svc-storage | Persist model responses and embeddings | sync |
| svc-translator | svc-storage | Store translated outputs for downstream use | sync |
| svc-functions | svc-storage | Write normalized transcripts and metadata | sync |
| svc-functions | svc-eventhubs | Publish enriched events back to the stream | async |
| svc-functions | svc-appinsights | Emit traces and model performance metrics | sync |
| svc-appinsights | svc-azmonitor | Forward application telemetry to monitoring hub | sync |
| svc-azmonitor | svc-loganalytics | Store logs and metrics for analysis and alerting | sync |

**Workflow:**

1. Streaming multimodal events are ingested and captured for replay _(svc-eventhubs, svc-storage)_
2. Serverless orchestration consumes the stream for processing _(svc-eventhubs, svc-functions)_
3. Audio is transcribed in real time _(svc-functions, svc-speech)_
4. Text and vision prompts are sent for AI inference _(svc-functions, svc-openai)_
5. Outputs are translated to requested languages _(svc-functions, svc-translator)_
6. Transcripts and AI outputs are persisted for downstream use _(svc-functions, svc-openai, svc-storage)_
7. Enriched events are published back to the stream _(svc-functions, svc-eventhubs)_
8. Telemetry is collected and centralized for observability _(svc-functions, svc-appinsights, svc-azmonitor)_
9. Logs and metrics are stored for analysis and alerting _(svc-azmonitor, svc-loganalytics)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-ingress |
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-app-ai |
| Azure OpenAI | Azure OpenAI | grp-app-ai |
| Speech Services | Speech Services | grp-app-ai |
| Translator | Translator | grp-app-ai |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Application Insights | Application Insights | grp-observability |

**Groups:** Ingress & Streaming, Application & AI Processing, Data Storage, Identity & Access, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-frontdoor | svc-entra | Redirect user sign-in and validate bearer tokens before API access | sync |
| svc-frontdoor | svc-eventhubs | Accept client audio/text stream and publish ingestion events | async |
| svc-frontdoor | svc-functions | Route synchronous multimodal prompt requests to orchestration endpoint | sync |
| svc-eventhubs | svc-functions | Trigger processing function for each queued stream segment | async |
| svc-functions | svc-speech | Send real-time audio chunks for transcription | sync |
| svc-speech | svc-functions | Return timestamped transcript segments to orchestrator | sync |
| svc-functions | svc-translator | Submit transcript text for target-language translation | sync |
| svc-translator | svc-functions | Return multilingual transcript and response variants | sync |
| svc-functions | svc-openai | Invoke text and vision models with normalized multimodal context | sync |
| svc-openai | svc-functions | Return generated answer, reasoning metadata, and vision interpretation | sync |
| svc-functions | svc-storage | Persist transcripts, translations, prompts, and AI outputs for replay | sync |
| svc-functions | svc-appinsights | Emit dependency traces, token usage, and model latency metrics | async |

**Workflow:**

1. User authenticates and receives access token for the multimodal AI platform. _(svc-frontdoor, svc-entra)_
2. Client streams audio/text input through the edge endpoint into the ingestion bus. _(svc-frontdoor, svc-eventhubs)_
3. Event-driven function execution starts for each incoming stream segment. _(svc-eventhubs, svc-functions)_
4. Orchestrator submits audio to speech service and receives real-time transcript output. _(svc-functions, svc-speech)_
5. Transcript is translated into requested languages for multilingual interaction. _(svc-functions, svc-translator)_
6. Translated text and visual context are sent to Azure OpenAI for multimodal inference. _(svc-functions, svc-openai)_
7. Function composes final response and stores processing artifacts for audit and replay. _(svc-functions, svc-storage)_
8. Pipeline emits observability telemetry to monitor model quality, latency, and failures. _(svc-functions, svc-appinsights)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-application |
| App Service | App Service | grp-application |
| Azure OpenAI | Azure OpenAI | grp-application |
| Speech Services | Speech Services | grp-application |
| Translator | Translator | grp-application |
| Storage Account | Storage Account | grp-data |
| Application Insights | Application Insights | grp-monitoring |

**Groups:** Ingress & Streaming, AI Orchestration, Data & Session Storage, Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-eventhubs | svc-functions | Consume streamed audio, image, and text events for preprocessing | async |
| svc-functions | svc-storage | Persist raw media chunks and normalized event payloads | sync |
| svc-functions | svc-speech | Submit live audio frames for real-time transcription | sync |
| svc-speech | svc-translator | Translate interim and final transcripts into target languages | sync |
| svc-functions | svc-appservice | Forward normalized transcripts and media references to session orchestration | async |
| svc-appservice | svc-openai | Send text prompts and image context for multimodal reasoning | sync |
| svc-appservice | svc-translator | Translate user prompts and AI responses for multilingual delivery | sync |
| svc-appservice | svc-storage | Store session artifacts, transcripts, and generated outputs | sync |
| svc-appservice | svc-appinsights | Emit model latency, token usage, and failure telemetry | sync |

**Workflow:**

1. Streaming clients publish multimodal events into the platform intake stream for downstream processing. _(svc-eventhubs, svc-functions)_
2. The stream processor normalizes incoming payloads and stores raw media and event snapshots for replay and auditing. _(svc-functions, svc-storage)_
3. Audio segments are sent for low-latency speech recognition to produce live transcripts. _(svc-functions, svc-speech)_
4. Recognized speech is translated into requested languages before being attached to the active application session. _(svc-speech, svc-translator, svc-appservice)_
5. The application orchestrator submits multilingual text and image context to the multimodal model for reasoning and response generation. _(svc-appservice, svc-openai, svc-translator)_
6. Final transcripts, prompts, and AI outputs are saved, while application and model telemetry is recorded for observability. _(svc-appservice, svc-storage, svc-appinsights)_

---

### GPT-5.4 Mini

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Microsoft Entra ID | Microsoft Entra ID | group-security |
| Event Hubs | Event Hubs | group-ingress |
| Azure Functions | Azure Functions | group-app |
| Azure OpenAI | Azure OpenAI | group-app |
| Speech Services | Speech Services | group-app |
| Translator | Translator | group-app |
| Application Insights | Application Insights | group-monitoring |
| Azure Monitor | Azure Monitor | group-monitoring |
| Log Analytics | Log Analytics | group-monitoring |

**Groups:** Ingress and Streaming Ingest, AI Application and Processing, Monitoring and Observability, Identity and Security

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| entra-id | event-hubs | Issue authenticated access tokens for streaming clients | sync |
| event-hubs | functions | Deliver incoming multimodal events for stream processing | async |
| functions | speech | Send audio payloads for real-time transcription | sync |
| functions | translator | Submit extracted text for multilingual translation | sync |
| functions | openai | Invoke text and vision prompts for model inference | sync |
| functions | appinsights | Emit request traces, latency, and model telemetry | sync |
| appinsights | azure-monitor | Forward application telemetry for platform-wide monitoring | sync |
| azure-monitor | log-analytics | Store metrics and logs for cross-resource analysis | sync |

**Workflow:**

1. Users and streaming producers authenticate before publishing multimodal events into the ingest pipeline. _(entra-id, event-hubs)_
2. Event Hubs receives audio, text, and image payloads and triggers downstream processing. _(event-hubs, functions)_
3. Azure Functions routes audio streams to Speech Services for real-time transcription. _(functions, speech)_
4. Azure Functions sends transcribed and extracted text to Translator for multilingual normalization. _(functions, translator)_
5. Azure Functions invokes Azure OpenAI for text and vision inference to generate model outputs. _(functions, openai)_
6. Application telemetry and model usage metrics flow from the compute layer into the monitoring stack. _(functions, appinsights, azure-monitor, log-analytics)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | edge-ingress |
| App Service | App Service | edge-ingress |
| Azure Functions | Azure Functions | compute-processing |
| Azure OpenAI | Azure OpenAI | compute-processing |
| Speech Services | Speech Services | compute-processing |
| Translator | Translator | compute-processing |
| Storage Account | Storage Account | data-storage |
| Azure Cosmos DB | Azure Cosmos DB | data-storage |
| Key Vault | Key Vault | security-identity |
| Microsoft Entra ID | Microsoft Entra ID | security-identity |
| Application Insights | Application Insights | monitoring-observability |
| Azure Monitor | Azure Monitor | monitoring-observability |

**Groups:** Edge / Ingress, Compute & Processing, Data & Storage, Security & Identity, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-service | event-hubs | Send streaming data | async |
| event-hubs | functions | Trigger function on events | async |
| functions | openai | Call OpenAI for text/vision | sync |
| functions | ai-speech | Transcribe audio | sync |
| functions | ai-translator | Translate text | sync |
| functions | storage | Store raw media and results | async |
| functions | cosmosdb | Save metadata and processed results | sync |
| app-service | entra-id | Authenticate users | sync |
| functions | key-vault | Retrieve secrets (API keys) | sync |
| app-service | app-insights | Send frontend telemetry | async |
| functions | app-insights | Send function telemetry | async |
| app-insights | azure-monitor | Aggregate logs and metrics | async |

**Workflow:**

1. Clients send requests to App Service, which authenticates via Microsoft Entra ID. _(app-service, entra-id)_
2. App Service forwards streaming data (e.g., audio, images, text) to Event Hubs. _(app-service, event-hubs)_
3. Event Hubs triggers an Azure Function to process each incoming event. _(event-hubs, functions)_
4. The Function retrieves secrets (API keys) from Key Vault to call AI services securely. _(functions, key-vault)_
5. The Function orchestrates calls to Azure OpenAI (text/vision), Speech Services (transcription), and Translator (translation) as needed. _(functions, openai, ai-speech, ai-translator)_
6. Processed results and raw data are stored: media in Storage Account, metadata and final outputs in Cosmos DB. _(functions, storage, cosmosdb)_
7. Throughout, App Service and Functions send telemetry to Application Insights, which forwards to Azure Monitor for observability. _(app-service, functions, app-insights, azure-monitor)_

---

### DeepSeek V4 Pro

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | group-ingest |
| Azure OpenAI | Azure OpenAI | group-ai |
| Speech Services | Speech Services | group-ai |
| Translator | Translator | group-ai |
| Computer Vision | Computer Vision | group-ai |
| Application Insights | Application Insights | group-monitor |
| Log Analytics | Log Analytics | group-monitor |
| Azure Monitor | Azure Monitor | group-monitor |

**Groups:** Streaming Ingest, AI Processing, Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | azure-openai | Streams text and vision events for AI inference | async |
| event-hubs | speech-services | Routes audio streams for real-time transcription | async |
| speech-services | translator | Sends transcribed text for multilingual translation | sync |
| translator | azure-openai | Feeds translated text as enriched context to LLM | sync |
| computer-vision | azure-openai | Provides extracted visual features for multi-modal reasoning | sync |
| event-hubs | computer-vision | Forwards image and video frames for analysis | async |
| azure-openai | app-insights | Emits model invocation metrics and token usage telemetry | async |
| app-insights | azure-monitor | Forwards application telemetry to central monitoring hub | async |
| azure-monitor | log-analytics | Routes aggregated logs and metrics for query and analysis | async |

**Workflow:**

1. Multi-modal data (text, audio, images) is ingested into Event Hubs as streaming events. _(event-hubs)_
2. Event Hubs routes audio streams to Speech Services for real-time transcription and image/video frames to Computer Vision for analysis. _(event-hubs, speech-services, computer-vision)_
3. Speech Services transcribes audio and sends the text to Translator for multilingual conversion. _(speech-services, translator)_
4. Translated text and visual features from Computer Vision are sent to Azure OpenAI as enriched context. _(translator, computer-vision, azure-openai)_
5. Azure OpenAI performs multi-modal reasoning combining text, translated content, and visual features to generate a response. _(azure-openai)_
6. Azure OpenAI emits invocation metrics, token usage, and latency data to Application Insights. _(azure-openai, app-insights)_
7. Application Insights forwards telemetry to Azure Monitor, which routes aggregated logs to Log Analytics for querying and dashboarding. _(app-insights, azure-monitor, log-analytics)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | edge-ingress |
| Azure OpenAI | Azure OpenAI | ai-processing |
| Speech Services | Speech Services | ai-processing |
| Translator | Translator | ai-processing |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |
| Microsoft Entra ID | Microsoft Entra ID | identity-security |
| Key Vault | Key Vault | identity-security |

**Groups:** Edge & Streaming Ingress, Multi-Modal AI Processing, Observability & Monitoring, Identity & Security

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | azure-openai | Stream text/vision payloads for inference | async |
| event-hubs | speech-services | Stream audio for real-time transcription | async |
| speech-services | translator | Send transcribed text for translation | sync |
| azure-openai | translator | Pipe vision/text results for multilingual processing | sync |
| azure-openai | app-insights | Emit model inference telemetry | async |
| speech-services | app-insights | Report transcription latency metrics | async |
| app-insights | log-analytics | Aggregate AI observability logs | async |
| entra-id | azure-openai | Authenticate API requests | sync |
| key-vault | azure-openai | Retrieve model deployment keys | optional |

**Workflow:**

1. Ingest multi-modal streams (text, vision, audio) _(event-hubs)_
2. Route streams to parallel AI processors _(event-hubs, azure-openai, speech-services)_
3. Perform real-time speech transcription _(speech-services)_
4. Execute vision/text inference concurrently _(azure-openai)_
5. Translate transcribed and inferred content _(speech-services, azure-openai, translator)_
6. Emit telemetry from AI services _(azure-openai, speech-services, app-insights)_
7. Aggregate observability data for analysis _(app-insights, log-analytics)_
8. Enforce authentication across AI endpoints _(entra-id, azure-openai, speech-services)_

---

### Grok 4.3

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | ingress |
| Speech Services | Speech Services | ai-processing |
| Translator | Translator | ai-processing |
| Azure OpenAI | Azure OpenAI | ai-processing |
| Application Insights | Application Insights | observability |

**Groups:** Streaming Ingress, Multi-Modal AI Processing, Model Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | speech-services | Stream audio for real-time transcription | async |
| speech-services | translator | Send transcribed text for multilingual translation | sync |
| translator | azure-openai | Forward translated text for AI text and vision analysis | sync |
| azure-openai | application-insights | Emit model traces and performance metrics | async |

**Workflow:**

1. Ingest multi-modal streams into Event Hubs for processing _(event-hubs, speech-services)_
2. Transcribe incoming audio in real time with Speech Services _(event-hubs, speech-services)_
3. Translate transcribed text using Translator for multilingual support _(speech-services, translator)_
4. Process text and vision inputs with Azure OpenAI _(translator, azure-openai)_
5. Capture inference metrics and logs in Application Insights _(azure-openai, application-insights)_

---

### Mistral Large 3

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | ingress |
| Azure OpenAI | Azure OpenAI | ai-processing |
| Speech Services | Speech Services | ai-processing |
| Translator | Translator | ai-processing |
| Storage Account | Storage Account | data-storage |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |
| Key Vault | Key Vault | security-identity |
| Microsoft Entra ID | Microsoft Entra ID | security-identity |

**Groups:** Ingress & Streaming, AI Processing, Data & Storage, Observability, Security & Identity

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | speech-services | Stream audio data for real-time transcription | async |
| event-hubs | azure-openai | Stream text and vision data for AI processing | async |
| speech-services | translator | Send transcribed text for multilingual translation | sync |
| speech-services | storage-account | Store transcribed and translated text | async |
| azure-openai | storage-account | Store processed text and vision outputs | async |
| azure-openai | application-insights | Log model performance and telemetry | async |
| application-insights | log-analytics | Aggregate and analyze monitoring data | async |
| key-vault | azure-openai | Retrieve API keys for OpenAI service access | sync |
| key-vault | speech-services | Retrieve API keys for Speech Services access | sync |
| entra-id | azure-openai | Authenticate users and services | sync |

**Workflow:**

1. Multi-modal data (text, audio, vision) is ingested into Event Hubs for streaming _(event-hubs)_
2. Event Hubs streams audio data to Speech Services for real-time transcription _(event-hubs, speech-services)_
3. Transcribed text is sent to Translator for multilingual processing _(speech-services, translator)_
4. Event Hubs streams text and vision data to Azure OpenAI for AI processing _(event-hubs, azure-openai)_
5. Processed outputs from Speech Services and Azure OpenAI are stored in Storage Account _(speech-services, azure-openai, storage-account)_
6. Azure OpenAI logs model performance and telemetry to Application Insights _(azure-openai, application-insights)_
7. Application Insights aggregates monitoring data in Log Analytics for analysis _(application-insights, log-analytics)_
8. Key Vault provides secure access to API keys for AI services _(key-vault, azure-openai, speech-services)_
9. Microsoft Entra ID authenticates users and services accessing the platform _(entra-id, azure-openai)_

---

### Kimi K2.5

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | streaming-ingestion |
| Azure Functions | Azure Functions | ai-processing |
| Azure OpenAI | Azure OpenAI | ai-processing |
| Speech Services | Speech Services | ai-processing |
| Translator | Translator | ai-processing |
| Key Vault | Key Vault | security-identity |
| Microsoft Entra ID | Microsoft Entra ID | security-identity |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |

**Groups:** Streaming Ingestion, AI Processing, Security & Identity, Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | azure-functions | Stream multimodal events for processing | async |
| azure-functions | speech-services | Submit audio for real-time transcription | sync |
| azure-functions | translator | Translate transcribed text content | sync |
| azure-functions | azure-openai | Analyze text and vision inputs | sync |
| key-vault | azure-functions | Retrieve AI service credentials | sync |
| microsoft-entra-id | azure-functions | Authenticate managed identity | sync |
| azure-functions | application-insights | Send model inference telemetry | sync |
| application-insights | log-analytics | Forward aggregated observability data | sync |

**Workflow:**

1. Event Hubs ingests streaming audio, text, and vision data from client applications _(event-hubs)_
2. Azure Functions triggers on Event Hubs stream to process incoming events _(event-hubs, azure-functions)_
3. Azure Functions sends audio payloads to Speech Services for real-time transcription _(azure-functions, speech-services)_
4. Azure Functions sends text content to Translator for multilingual localization _(azure-functions, translator)_
5. Azure Functions sends text and vision data to Azure OpenAI for analysis and generation _(azure-functions, azure-openai)_
6. Azure Functions emits model performance telemetry to Application Insights _(azure-functions, application-insights)_
7. Application Insights forwards aggregated logs and metrics to Log Analytics _(application-insights, log-analytics)_

---


# Model Comparison Report

**Generated:** 2026-03-12T22:25:00.029Z

**Prompt:** A multi-modal AI platform with Azure OpenAI for text and vision, Azure AI Speech for real-time transcription, Azure AI Translator for multilingual support, Event Hubs for streaming ingest, and Application Insights for model observability

**Reasoning Effort:** low

**Models Compared:** 7 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** | 15.6s | 3,829 | 10 | 9 | 4 | 9 |
| **GPT-5.2** 📦 Most Services | 56.3s | 3,927 | 11 | 11 | 5 | 8 |
| **GPT-5.2 Codex** | 27.6s | 3,498 | 8 | 7 | 3 | 7 |
| **GPT-5.3 Codex** | 44.0s | 4,330 | 9 | 13 | 5 | 9 |
| **GPT-5.4** | 63.4s | 4,319 | 9 | 12 | 5 | 8 |
| **DeepSeek V3.2 Speciale** 🏆 Most Thorough 🔗 Most Detailed | 31.8s | 3,264 | 10 | 17 | 5 | 7 |
| **Grok 4.1 Fast** ⚡ Fastest 💰 Cheapest | 12.7s | 2,547 | 8 | 8 | 4 | 7 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,436 | 2,393 | 3,829 |
| GPT-5.2 | 1,436 | 2,491 | 3,927 |
| GPT-5.2 Codex | 1,436 | 2,062 | 3,498 |
| GPT-5.3 Codex | 1,436 | 2,894 | 4,330 |
| GPT-5.4 | 1,436 | 2,883 | 4,319 |
| DeepSeek V3.2 Speciale | 1,462 | 1,802 | 3,264 |
| Grok 4.1 Fast | 1,409 | 1,138 | 2,547 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Speech Services | Speech Services | grp-app |
| Translator | Translator | grp-app |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Application Insights | Application Insights | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Streaming, Application & AI Orchestration, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-event-hubs | svc-functions | Stream incoming audio and text events for real-time AI processing | async |
| svc-functions | svc-speech | Send audio payloads for real-time speech-to-text transcription | sync |
| svc-functions | svc-translator | Submit transcribed text for multilingual translation | sync |
| svc-functions | svc-openai | Invoke multimodal text and vision models for enrichment and reasoning | sync |
| svc-entra | svc-functions | Issue OAuth tokens to authorize serverless function executions | sync |
| svc-functions | svc-keyvault | Retrieve AI service credentials and connection secrets at runtime | sync |
| svc-functions | svc-az-monitor | Emit operational metrics and logs for AI workflows | async |
| svc-az-monitor | svc-app-insights | Forward application traces and dependency telemetry for AI calls | async |
| svc-az-monitor | svc-log-analytics | Ingest consolidated logs and metrics for advanced querying | async |

**Workflow:**

1. Client applications publish audio streams and text events into Event Hubs for processing by the multimodal AI platform. _(svc-event-hubs, svc-functions)_
2. Azure Functions triggers on new Event Hubs messages, authenticates via Microsoft Entra ID, and prepares context for AI processing. _(svc-functions, svc-event-hubs, svc-entra)_
3. Azure Functions retrieves necessary API keys and connection secrets from Key Vault to securely call AI services. _(svc-functions, svc-keyvault)_
4. Azure Functions sends the audio portion of the payload to Speech Services to obtain real-time transcription. _(svc-functions, svc-speech)_
5. Azure Functions submits transcribed text to Translator to generate multilingual outputs as required by the workflow. _(svc-functions, svc-translator)_
6. Azure Functions calls Azure OpenAI with text, vision, and translated inputs to perform multimodal reasoning and enrichment. _(svc-functions, svc-openai)_
7. Azure Functions composes the final response payload, including transcripts, translations, and AI-enriched results, and returns it to downstream clients or systems. _(svc-functions, svc-event-hubs)_
8. Azure Functions sends execution metrics, dependencies, and custom telemetry to Azure Monitor for centralized collection. _(svc-functions, svc-az-monitor)_
9. Azure Monitor routes application telemetry to Application Insights and persists logs and metrics in Log Analytics for model observability and troubleshooting. _(svc-az-monitor, svc-app-insights, svc-log-analytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-app |
| Speech Services | Speech Services | grp-app |
| Translator | Translator | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-idsec |
| Key Vault | Key Vault | grp-idsec |
| Azure Monitor | Azure Monitor | grp-observ |
| Application Insights | Application Insights | grp-observ |
| Log Analytics | Log Analytics | grp-observ |

**Groups:** Ingress / Streaming, Application / AI Orchestration, Data / Storage, Identity / Security, Monitoring / Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-eventhubs | svc-functions | Trigger processing per incoming streaming event batch | async |
| svc-entra | svc-functions | Validate workload identity and acquire access tokens for downstream calls | sync |
| svc-keyvault | svc-functions | Resolve AI service credentials and configuration secrets at runtime | sync |
| svc-functions | svc-speech | Submit audio chunks for real-time speech-to-text transcription | sync |
| svc-functions | svc-translator | Translate transcript and user prompts into target languages | sync |
| svc-functions | svc-openai | Send translated text plus image frames for multimodal completion | sync |
| svc-functions | svc-storage | Persist raw payloads, transcripts, translations, and generated responses | sync |
| svc-functions | svc-eventhubs | Publish enriched events and AI results for downstream consumers | async |
| svc-functions | svc-monitor | Emit platform metrics and processing telemetry for centralized monitoring | sync |
| svc-monitor | svc-appinsights | Route correlated traces, dependency calls, and custom model metrics | sync |
| svc-monitor | svc-loganalytics | Export consolidated logs for querying, alerting, and retention | sync |

**Workflow:**

1. Producers stream audio, text, and image events into the ingestion layer for near-real-time processing. _(svc-eventhubs, svc-functions)_
2. The orchestrator validates identity context and obtains the required access tokens for secured downstream calls. _(svc-entra, svc-functions)_
3. The orchestrator retrieves AI service secrets and runtime configuration needed to process the event safely. _(svc-keyvault, svc-functions)_
4. Audio content is transcribed into text with low latency for immediate downstream reasoning. _(svc-functions, svc-speech)_
5. Transcripts and prompts are translated to support multilingual input and output requirements. _(svc-functions, svc-translator)_
6. Translated text and image frames are sent to the multimodal model to generate responses or structured insights. _(svc-functions, svc-openai)_
7. Outputs and intermediate artifacts are stored for replay, audit, and offline analysis. _(svc-functions, svc-storage)_
8. The orchestrator publishes enriched results for downstream consumers while emitting telemetry for model observability and investigations. _(svc-functions, svc-eventhubs, svc-monitor)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | grp-ingress |
| App Service | App Service | grp-app-ai |
| Speech Services | Speech Services | grp-app-ai |
| Translator | Translator | grp-app-ai |
| Azure OpenAI | Azure OpenAI | grp-app-ai |
| Application Insights | Application Insights | grp-monitor |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress/Streaming, Application & AI Services, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | app-service | Stream multimodal events for processing | async |
| app-service | speech-services | Submit audio streams for real-time transcription | sync |
| app-service | translator | Translate transcripts and AI responses to target languages | sync |
| app-service | azure-openai | Invoke text and vision models for multimodal inference | sync |
| app-service | app-insights | Send model performance and trace telemetry | async |
| app-insights | azure-monitor | Export application metrics to monitoring hub | async |
| azure-monitor | log-analytics | Persist aggregated logs for querying and alerting | async |

**Workflow:**

1. Multimodal events are ingested from producers into the streaming backbone _(event-hubs)_
2. The application layer consumes streaming events to start AI processing _(event-hubs, app-service)_
3. Audio payloads are transcribed into text for downstream analysis _(app-service, speech-services)_
4. Text and image inputs are processed by foundation models for inference _(app-service, azure-openai)_
5. Results are translated into target languages for multilingual delivery _(app-service, translator)_
6. Operational telemetry and model traces are captured for observability _(app-service, app-insights)_
7. Telemetry is centralized and retained for monitoring and analytics _(app-insights, azure-monitor, log-analytics)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| API Management | API Management | grp-ingress |
| Event Hubs | Event Hubs | grp-ingress |
| Azure Functions | Azure Functions | grp-ai |
| Azure OpenAI | Azure OpenAI | grp-ai |
| Speech Services | Speech Services | grp-ai |
| Translator | Translator | grp-ai |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Application Insights | Application Insights | grp-observability |

**Groups:** Ingress & Streaming, Application & AI Processing, Data Storage, Identity & Access, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-api-mgmt | Validate OAuth2/JWT tokens for client API access | sync |
| svc-api-mgmt | svc-event-hubs | Publish incoming multimodal payloads into partitioned streams | async |
| svc-api-mgmt | svc-functions | Invoke low-latency inference route for immediate responses | sync |
| svc-event-hubs | svc-functions | Trigger stream processing per ingested event batch | async |
| svc-functions | svc-speech | Send audio frames for real-time transcription | sync |
| svc-speech | svc-functions | Return timestamped transcript segments | sync |
| svc-functions | svc-translator | Translate transcripts and prompts into requested languages | sync |
| svc-translator | svc-functions | Return multilingual text variants for downstream inference | sync |
| svc-functions | svc-openai | Submit text and image context for multimodal reasoning | sync |
| svc-openai | svc-functions | Return generated answers, captions, and structured outputs | sync |
| svc-functions | svc-storage | Persist transcripts, translations, prompts, and model responses | sync |
| svc-api-mgmt | svc-storage | Retrieve completed session artifacts for client download | sync |
| svc-functions | svc-appinsights | Emit model observability telemetry with latency and token metrics | async |

**Workflow:**

1. Client calls are authenticated and authorized before ingestion. _(svc-entra, svc-api-mgmt)_
2. API layer accepts multimodal input and pushes streaming events for scalable processing. _(svc-api-mgmt, svc-event-hubs)_
3. Event stream triggers orchestration functions to process each session chunk. _(svc-event-hubs, svc-functions)_
4. Audio content is transcribed in real time and transcripts are returned to the orchestrator. _(svc-functions, svc-speech)_
5. Transcripts and user text are translated into target languages for multilingual handling. _(svc-functions, svc-translator)_
6. Prepared multilingual text and visual context are sent for Azure OpenAI multimodal inference. _(svc-functions, svc-openai)_
7. Generated outputs and intermediate artifacts are stored for retrieval and auditing. _(svc-functions, svc-storage)_
8. API returns or serves completed results from storage to downstream consumers. _(svc-api-mgmt, svc-storage)_
9. Function runtime publishes model observability signals for performance and quality monitoring. _(svc-functions, svc-appinsights)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| API Management | API Management | grp-ingress |
| Event Hubs | Event Hubs | grp-ingress |
| App Service | App Service | grp-app-ai |
| Azure OpenAI | Azure OpenAI | grp-app-ai |
| Speech Services | Speech Services | grp-app-ai |
| Translator | Translator | grp-app-ai |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Application Insights | Application Insights | grp-monitor |

**Groups:** Ingress & Streaming, Application & AI Processing, Data & Content Storage, Identity, Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-apim | Issue OAuth tokens for secured multimodal API access | sync |
| svc-entra | svc-appservice | Validate bearer tokens for authenticated session orchestration | sync |
| svc-apim | svc-appservice | Forward authenticated multimodal inference requests for orchestration | sync |
| svc-apim | svc-eventhubs | Route accepted streaming sessions into ingestion partitions | async |
| svc-eventhubs | svc-appservice | Deliver buffered audio and image events for real-time processing | async |
| svc-appservice | svc-speech | Submit live audio chunks for real-time transcription | sync |
| svc-speech | svc-translator | Send transcript segments for multilingual translation | sync |
| svc-speech | svc-openai | Pass timestamped transcript text for semantic reasoning | sync |
| svc-appservice | svc-translator | Request direct translation for user-facing prompts and responses | sync |
| svc-translator | svc-openai | Provide translated text context for multilingual summarization and vision prompts | sync |
| svc-appservice | svc-storage | Persist source media, transcripts, translations, and generated outputs | sync |
| svc-appservice | svc-appinsights | Emit latency, token usage, model quality, and failure telemetry | async |

**Workflow:**

1. Clients authenticate with Microsoft Entra ID and call the secured multimodal platform endpoint through API Management. _(svc-entra, svc-apim)_
2. API Management forwards synchronous inference requests to App Service and routes streaming media sessions into Event Hubs. _(svc-apim, svc-appservice, svc-eventhubs)_
3. Event Hubs delivers buffered audio and image events to App Service for coordinated multimodal processing. _(svc-eventhubs, svc-appservice)_
4. App Service sends live audio to Speech Services, which produces transcript segments for immediate downstream use. _(svc-appservice, svc-speech)_
5. Speech Services sends transcript text to Translator for multilingual conversion and to Azure OpenAI for semantic understanding. _(svc-speech, svc-translator, svc-openai)_
6. App Service combines translated text with Azure OpenAI text-and-vision reasoning to generate multilingual responses and enrichments. _(svc-appservice, svc-translator, svc-openai)_
7. App Service stores media, transcripts, translations, and generated outputs in Storage Account for retrieval and auditability. _(svc-appservice, svc-storage)_
8. App Service emits model and application telemetry to Application Insights for end-to-end observability. _(svc-appservice, svc-appinsights)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | ingest |
| Azure OpenAI | Azure OpenAI | ai-processing |
| Speech Services | Speech Services | ai-processing |
| Translator | Translator | ai-processing |
| Application Insights | Application Insights | monitoring |
| Log Analytics | Log Analytics | monitoring |
| Key Vault | Key Vault | security |
| Microsoft Entra ID | Microsoft Entra ID | security |
| Storage Account | Storage Account | storage |
| Azure Cosmos DB | Azure Cosmos DB | storage |

**Groups:** Ingest & Stream, AI Processing, Storage & Data, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | openai | Streams text/vision data for processing | async |
| event-hubs | speech | Streams audio for real-time transcription | async |
| speech | translator | Sends transcribed text for translation | sync |
| openai | translator | Sends generated text for translation | sync |
| openai | cosmos-db | Stores processed results and metadata | async |
| translator | cosmos-db | Stores translated content | async |
| event-hubs | storage-account | Archives raw streaming data | async |
| openai | app-insights | Emits custom metrics and logs | async |
| speech | app-insights | Emits transcription telemetry | async |
| translator | app-insights | Emits translation telemetry | async |
| app-insights | log-analytics | Sends logs and metrics for analysis | async |
| openai | key-vault | Retrieves API keys and secrets | sync |
| speech | key-vault | Retrieves API keys and secrets | sync |
| translator | key-vault | Retrieves API keys and secrets | sync |
| entra-id | openai | Authenticates requests | sync |
| entra-id | speech | Authenticates requests | sync |
| entra-id | translator | Authenticates requests | sync |

**Workflow:**

1. Data ingestion: Streaming data (audio, text, images) from various sources is ingested via Event Hubs. _(event-hubs)_
2. Raw data archival: Event Hubs archives raw data to Blob Storage for backup and later analysis. _(event-hubs, storage-account)_
3. AI processing: Event Hubs streams audio to Speech Services for transcription, and text/vision data to Azure OpenAI for generation/analysis. _(event-hubs, speech, openai)_
4. Translation: Transcribed text from Speech Services and generated text from Azure OpenAI are sent to Translator for multilingual support. _(speech, openai, translator)_
5. Storage: Processed results, translations, and metadata are stored in Cosmos DB for application use. _(openai, translator, cosmos-db)_
6. Observability: All AI services emit telemetry to Application Insights, which forwards logs to Log Analytics for analysis. _(openai, speech, translator, app-insights, log-analytics)_
7. Security: Azure AI services retrieve keys/secrets from Key Vault and authenticate via Microsoft Entra ID. _(openai, speech, translator, key-vault, entra-id)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Event Hubs | Event Hubs | ingress |
| Azure OpenAI | Azure OpenAI | ai-core |
| Speech Services | Speech Services | ai-core |
| Translator | Translator | ai-core |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |
| Microsoft Entra ID | Microsoft Entra ID | security |
| Key Vault | Key Vault | security |

**Groups:** Data Ingestion, AI Processing, Observability, Identity & Security

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| event-hubs | azure-openai | Stream multimodal payloads for text/vision processing | async |
| event-hubs | speech-services | Stream audio for real-time transcription | async |
| speech-services | translator | Send transcribed text for multilingual translation | sync |
| azure-openai | translator | Forward vision/text results for translation | sync |
| entra-id | event-hubs | Authenticate streaming producers/consumers | optional |
| key-vault | azure-openai | Retrieve AI service API keys | optional |
| azure-openai | app-insights | Emit model inference telemetry and latency metrics | async |
| app-insights | log-analytics | Store aggregated observability data | async |

**Workflow:**

1. Authenticate streaming clients and retrieve API secrets _(entra-id, key-vault)_
2. Ingest multimodal streams (audio/text/vision) _(event-hubs)_
3. Parallel process audio for real-time transcription _(event-hubs, speech-services)_
4. Process text/vision payloads with Azure OpenAI _(event-hubs, azure-openai)_
5. Translate transcribed and AI-generated content _(speech-services, azure-openai, translator)_
6. Emit model telemetry to Application Insights _(azure-openai, app-insights)_
7. Aggregate and store observability metrics _(app-insights, log-analytics)_

---


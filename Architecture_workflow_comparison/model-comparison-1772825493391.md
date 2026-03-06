# Model Comparison Report

**Generated:** 2026-03-06T19:31:33.391Z

**Prompt:** An intelligent document processing pipeline with Azure AI Document Intelligence for OCR, Azure OpenAI for summarization, Cognitive Search for indexing, Cosmos DB for metadata, and Blob Storage for document retention

**Reasoning Effort:** low

**Models Compared:** 7 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** 🔗 Most Detailed | 16.6s | 3,990 | 10 | 13 | 5 | 8 |
| **GPT-5.2** 🏆 Most Thorough 📦 Most Services | 35.2s | 3,322 | 11 | 12 | 5 | 10 |
| **GPT-5.2 Codex** | 36.4s | 3,441 | 9 | 12 | 5 | 6 |
| **GPT-5.3 Codex** 🔗 Most Detailed | 27.2s | 3,880 | 10 | 13 | 5 | 8 |
| **GPT-5.4** 🔗 Most Detailed | 56.0s | 3,863 | 10 | 13 | 5 | 8 |
| **DeepSeek V3.2 Speciale** 🔗 Most Detailed | 18.0s | 3,058 | 10 | 13 | 6 | 8 |
| **Grok 4.1 Fast** ⚡ Fastest 💰 Cheapest | 11.7s | 2,634 | 8 | 10 | 5 | 8 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,429 | 2,561 | 3,990 |
| GPT-5.2 | 1,429 | 1,893 | 3,322 |
| GPT-5.2 Codex | 1,429 | 2,012 | 3,441 |
| GPT-5.3 Codex | 1,429 | 2,451 | 3,880 |
| GPT-5.4 | 1,429 | 2,434 | 3,863 |
| DeepSeek V3.2 Speciale | 1,457 | 1,601 | 3,058 |
| Grok 4.1 Fast | 1,402 | 1,232 | 2,634 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | grp-data-search |
| Azure Functions | Azure Functions | grp-ingress-orchestration |
| Document Intelligence | Document Intelligence | grp-ai-processing |
| Azure OpenAI | Azure OpenAI | grp-ai-processing |
| Azure Cognitive Search | Azure Cognitive Search | grp-data-search |
| Azure Cosmos DB | Azure Cosmos DB | grp-data-search |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Key Vault | Key Vault | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress & Orchestration, AI Processing, Data & Search, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-storage | svc-functions | Trigger serverless function when a new document blob is uploaded | async |
| svc-functions | svc-docintelligence | Submit uploaded document for OCR and layout-aware extraction | sync |
| svc-docintelligence | svc-functions | Return extracted text and structured fields to orchestrator | sync |
| svc-functions | svc-azureopenai | Send extracted text to generate a concise summary and key insights | sync |
| svc-azureopenai | svc-functions | Return generated summary and insights to orchestration logic | sync |
| svc-functions | svc-cosmosdb | Persist document metadata, extracted fields, and summaries | sync |
| svc-functions | svc-cognitivesearch | Push searchable content and metadata for indexing | sync |
| svc-cognitivesearch | svc-storage | Index document blobs as an external data source for content retrieval | sync |
| svc-functions | svc-storage | Write processed document versions or annotations back to blob storage | sync |
| svc-entra | svc-functions | Issue access tokens for secure invocation of downstream Azure services | sync |
| svc-keyvault | svc-functions | Provide secrets, API keys, and connection strings at runtime | sync |
| svc-functions | svc-azuremonitor | Emit processing metrics, custom logs, and dependency telemetry | async |
| svc-azuremonitor | svc-loganalytics | Ingest and store monitoring data for querying and alerts | async |

**Workflow:**

1. A new document is uploaded to blob storage, which triggers the serverless orchestration to start processing. _(svc-storage, svc-functions)_
2. Azure Functions obtains the necessary credentials and configuration to call downstream services securely. _(svc-functions, svc-entra, svc-keyvault)_
3. The orchestrator sends the document to Azure AI Document Intelligence for OCR and structured data extraction, then receives the extracted content. _(svc-functions, svc-docintelligence)_
4. Azure Functions forwards the extracted text to Azure OpenAI to generate a summary and insights, then collects the generated output. _(svc-functions, svc-azureopenai)_
5. The orchestrator writes document metadata, extracted fields, and summaries into Azure Cosmos DB for fast retrieval and auditing. _(svc-functions, svc-cosmosdb)_
6. Azure Functions submits the searchable content and metadata to Azure Cognitive Search and may store processed document variants back into blob storage. _(svc-functions, svc-cognitivesearch, svc-storage)_
7. Azure Cognitive Search connects to blob storage as an external source to index document blobs alongside metadata for rich search. _(svc-cognitivesearch, svc-storage)_
8. During each processing run, Azure Functions sends metrics and logs to Azure Monitor, which forwards them into Log Analytics for analysis and alerting. _(svc-functions, svc-azuremonitor, svc-loganalytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| API Management | API Management | grp-ingress-edge |
| Azure Functions | Azure Functions | grp-app-processing |
| Document Intelligence | Document Intelligence | grp-app-processing |
| Azure OpenAI | Azure OpenAI | grp-app-processing |
| Storage Account | Storage Account | grp-data-index |
| Azure Cosmos DB | Azure Cosmos DB | grp-data-index |
| Azure Cognitive Search | Azure Cognitive Search | grp-data-index |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Key Vault | Key Vault | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress & Upload, Application & Processing, Data, Storage & Indexing, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-api-mgmt | Issue/validate OAuth tokens for callers accessing upload and query APIs | sync |
| svc-api-mgmt | svc-storage | Accept document upload and write raw file to Blob container | sync |
| svc-api-mgmt | svc-functions | Invoke ingestion endpoint to start processing for the uploaded blob URI | sync |
| svc-functions | svc-keyvault | Retrieve API keys/connection secrets for AI services and data stores | sync |
| svc-functions | svc-doc-intel | Submit blob URI for OCR and layout extraction; receive extracted text/fields | sync |
| svc-functions | svc-azure-openai | Send extracted text to generate document summary and key takeaways | sync |
| svc-functions | svc-cosmos | Upsert metadata, processing status, extracted fields, and summary results | sync |
| svc-functions | svc-search | Push enriched content and metadata to search index for retrieval | sync |
| svc-api-mgmt | svc-search | Proxy end-user search queries and return ranked results | sync |
| svc-api-mgmt | svc-cosmos | Fetch document metadata and processing status for document details views | sync |
| svc-functions | svc-azure-monitor | Emit function execution metrics, traces, and dependency telemetry | sync |
| svc-azure-monitor | svc-log-analytics | Route collected telemetry to centralized Log Analytics workspace | sync |

**Workflow:**

1. User authenticates and obtains access token to call the ingestion APIs. _(svc-entra, svc-api-mgmt)_
2. Client uploads a document; API stores the raw file for retention. _(svc-api-mgmt, svc-storage)_
3. API triggers the processing orchestrator with the uploaded blob URI. _(svc-api-mgmt, svc-functions)_
4. Orchestrator retrieves necessary secrets/keys to call downstream services. _(svc-functions, svc-keyvault)_
5. Document Intelligence performs OCR/layout extraction for the stored document. _(svc-functions, svc-doc-intel, svc-storage)_
6. Azure OpenAI summarizes extracted text and produces key insights. _(svc-functions, svc-azure-openai)_
7. Processing results are persisted as document metadata and status. _(svc-functions, svc-cosmos)_
8. Enriched content is indexed to enable full-text search and filtering. _(svc-functions, svc-search)_
9. Users query documents; API returns search results and metadata details. _(svc-api-mgmt, svc-search, svc-cosmos)_
10. Operational telemetry from processing is collected and centralized for troubleshooting and alerts. _(svc-functions, svc-azure-monitor, svc-log-analytics)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Document Intelligence | Document Intelligence | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Azure Cognitive Search | Azure Cognitive Search | grp-app |
| Storage Account | Storage Account | grp-data |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress/Edge, Application/Compute, Data/Storage, Identity/Security, Monitoring/Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-appservice | Authenticate users for upload and search APIs | sync |
| svc-appservice | svc-storage | Upload raw documents to blob storage | sync |
| svc-appservice | svc-docint | Submit document for OCR and extraction | sync |
| svc-docint | svc-storage | Retrieve document content for OCR processing | sync |
| svc-docint | svc-openai | Send extracted text for summarization | sync |
| svc-openai | svc-search | Provide summaries for search enrichment | sync |
| svc-docint | svc-search | Provide extracted fields for indexing | sync |
| svc-search | svc-storage | Index documents and blobs as data source | sync |
| svc-appservice | svc-cosmos | Persist metadata and processing status | sync |
| svc-search | svc-appservice | Return ranked search results to clients | sync |
| svc-appservice | svc-monitor | Emit API telemetry and metrics | sync |
| svc-monitor | svc-log | Store collected logs for analysis | sync |

**Workflow:**

1. User authenticates and submits documents through the API _(svc-entra, svc-appservice)_
2. API stores raw documents and metadata _(svc-appservice, svc-storage, svc-cosmos)_
3. Document Intelligence retrieves documents and performs OCR _(svc-docint, svc-storage)_
4. Extracted text is summarized and enriched _(svc-docint, svc-openai)_
5. Search index is updated with extracted fields and summaries _(svc-docint, svc-openai, svc-search)_
6. Clients query the API and receive search results _(svc-appservice, svc-search)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | grp-ingress |
| Azure Event Grid | Azure Event Grid | grp-ingress |
| Azure Functions | Azure Functions | grp-ingress |
| Document Intelligence | Document Intelligence | grp-ai |
| Azure OpenAI | Azure OpenAI | grp-ai |
| Azure Cognitive Search | Azure Cognitive Search | grp-data |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Orchestration, AI Processing, Data & Indexing, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-functions | Issue and validate workload identity tokens for orchestration runtime | sync |
| svc-storage | svc-eventgrid | Publish blob-created event when a new document lands in retention container | async |
| svc-eventgrid | svc-functions | Trigger document processing function per upload event | async |
| svc-functions | svc-docintel | Submit document URI for OCR and structured extraction | sync |
| svc-docintel | svc-functions | Return extracted text, tables, and key-value output | sync |
| svc-functions | svc-openai | Send extracted content to generate concise summary and highlights | sync |
| svc-openai | svc-functions | Return summarized narrative and key topics | sync |
| svc-functions | svc-search | Upsert searchable chunks and enrichment fields into search index | sync |
| svc-functions | svc-cosmos | Persist metadata, processing state, and summary pointers | sync |
| svc-functions | svc-storage | Write normalized extraction JSON and summary artifacts to Blob storage | sync |
| svc-search | svc-cosmos | Optionally resolve metadata filters and document facets during retrieval | optional |
| svc-functions | svc-azmonitor | Emit execution metrics, latency, and failure telemetry | sync |
| svc-azmonitor | svc-loganalytics | Ingest and retain centralized logs for analysis and alerting | sync |

**Workflow:**

1. A document is uploaded to Blob storage and an event is generated for processing. _(svc-storage, svc-eventgrid)_
2. Event Grid triggers the orchestration function for the specific uploaded document. _(svc-eventgrid, svc-functions)_
3. The function authenticates with Microsoft Entra ID before invoking downstream services. _(svc-functions, svc-entra)_
4. The function sends the document to Document Intelligence and receives OCR plus structured extraction results. _(svc-functions, svc-docintel)_
5. Extracted text is sent to Azure OpenAI to produce a summary and key insights. _(svc-functions, svc-openai)_
6. Processed content is indexed in Azure Cognitive Search for fast semantic and keyword retrieval. _(svc-functions, svc-search)_
7. Metadata and processing status are stored in Cosmos DB, and enriched artifacts are saved back to Blob storage. _(svc-functions, svc-cosmos, svc-storage)_
8. Pipeline telemetry is sent to Azure Monitor and retained in Log Analytics for operational visibility. _(svc-functions, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Azure Functions | Azure Functions | grp-processing |
| Document Intelligence | Document Intelligence | grp-processing |
| Azure OpenAI | Azure OpenAI | grp-processing |
| Storage Account | Storage Account | grp-data |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Azure Cognitive Search | Azure Cognitive Search | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress & Access, Processing & AI, Data & Index, Identity, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-app | Authenticate document processing users and issue access tokens | sync |
| svc-app | svc-func | Submit uploaded document and processing options for orchestration | sync |
| svc-func | svc-storage | Persist original document for durable retention before analysis | sync |
| svc-func | svc-docintel | Send retained document for OCR and structured field extraction | sync |
| svc-docintel | svc-func | Return extracted text, tables, and key-value content to workflow | sync |
| svc-func | svc-openai | Provide extracted text for summarization and insight generation | sync |
| svc-openai | svc-func | Return concise summary and normalized document insights | sync |
| svc-func | svc-cosmos | Write metadata, summary, retention URI, and processing status record | sync |
| svc-func | svc-search | Push extracted content and summary into searchable index | sync |
| svc-app | svc-search | Execute user search queries and retrieve ranked document matches | sync |
| svc-app | svc-cosmos | Fetch document metadata and processing status for application views | sync |
| svc-func | svc-monitor | Emit processing metrics, failures, and execution traces | async |
| svc-monitor | svc-logs | Route aggregated telemetry for retention and investigation | async |

**Workflow:**

1. A user signs in to the web application and starts a new document submission session. _(svc-entra, svc-app)_
2. The application sends the uploaded file to the orchestration layer, which stores the original document for long-term retention. _(svc-app, svc-func, svc-storage)_
3. The orchestration layer submits the retained document to Document Intelligence and receives OCR text and structured extraction results. _(svc-func, svc-docintel, svc-storage)_
4. The extracted text is sent to Azure OpenAI to generate a concise summary and normalized insights for downstream use. _(svc-func, svc-openai, svc-docintel)_
5. The orchestration layer saves metadata, status, summary, and storage references in Cosmos DB. _(svc-func, svc-cosmos, svc-storage)_
6. The orchestration layer publishes extracted content and summaries into Azure Cognitive Search for retrieval. _(svc-func, svc-search, svc-openai)_
7. Users query the application, which retrieves ranked search hits from Cognitive Search and metadata from Cosmos DB. _(svc-app, svc-search, svc-cosmos)_
8. Processing metrics and traces are emitted from the workflow and stored for operational monitoring and troubleshooting. _(svc-func, svc-monitor, svc-logs)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | ingress |
| Document Intelligence | Document Intelligence | processing |
| Azure OpenAI | Azure OpenAI | processing |
| Azure Cosmos DB | Azure Cosmos DB | storage |
| Azure Cognitive Search | Azure Cognitive Search | search |
| Azure Functions | Azure Functions | processing |
| Key Vault | Key Vault | security |
| Microsoft Entra ID | Microsoft Entra ID | security |
| Azure Monitor | Azure Monitor | monitoring |
| Log Analytics | Log Analytics | monitoring |

**Groups:** Document Ingress, AI Processing, Data Storage, Search & Query, Security & Identity, Monitoring

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| blob | function | Triggers on new blob upload | async |
| function | document-intelligence | Sends document for OCR and extraction | sync |
| document-intelligence | function | Returns extracted text and structured data | sync |
| function | openai | Sends extracted text for summarization | sync |
| openai | function | Returns summary and insights | sync |
| function | cosmosdb | Stores metadata, extracted fields, and summary | sync |
| function | cognitive-search | Indexes content and metadata for search | sync |
| blob | function | Retains original and processed files | sync |
| function | keyvault | Retrieves secrets and connection strings | sync |
| entra-id | function | Provides authentication for API access | sync |
| function | monitor | Sends custom metrics and logs | async |
| monitor | log-analytics | Forwards logs for analysis | async |
| cosmosdb | cognitive-search | Data source for indexer (pull changes) | async |

**Workflow:**

1. User uploads document to Blob Storage; Blob trigger invokes Azure Function. _(blob, function)_
2. Function retrieves secrets from Key Vault and authenticates via Microsoft Entra ID. _(function, keyvault, entra-id)_
3. Function sends document to Document Intelligence for OCR and extraction; receives structured data. _(function, document-intelligence)_
4. Function sends extracted text to Azure OpenAI for summarization; receives summary. _(function, openai)_
5. Function stores metadata, extracted fields, and summary in Cosmos DB. _(function, cosmosdb)_
6. Function indexes the content and metadata in Cognitive Search (or Cosmos DB change feed triggers indexer). _(function, cognitive-search, cosmosdb)_
7. Function logs metrics and diagnostics to Azure Monitor, which forwards to Log Analytics. _(function, monitor, log-analytics)_
8. End users query Cognitive Search to retrieve documents and summaries. _(cognitive-search)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | ingress |
| Document Intelligence | Document Intelligence | processing |
| Azure OpenAI | Azure OpenAI | processing |
| Azure Cognitive Search | Azure Cognitive Search | search |
| Azure Cosmos DB | Azure Cosmos DB | storage |
| Azure Functions | Azure Functions | processing |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |

**Groups:** Document Ingestion, AI Processing, Search & Indexing, Data Storage, Monitoring

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| blob-storage | functions | Trigger document processing workflow | async |
| functions | doc-intelligence | Submit documents for OCR extraction | sync |
| doc-intelligence | functions | Return extracted text and structure | sync |
| functions | openai | Send extracted content for summarization | sync |
| openai | functions | Return document summaries | sync |
| functions | cognitive-search | Index extracted text and embeddings | async |
| functions | cosmos-db | Store metadata and summaries | sync |
| functions | app-insights | Send pipeline telemetry | async |
| app-insights | log-analytics | Forward metrics and traces | async |
| cognitive-search | cosmos-db | Store search result metadata | async |

**Workflow:**

1. Documents uploaded to Blob Storage trigger Azure Functions _(blob-storage, functions)_
2. Functions invoke Document Intelligence for OCR extraction _(functions, doc-intelligence)_
3. Extracted content processed by Azure OpenAI for summarization _(functions, openai)_
4. Functions store summaries and metadata in Cosmos DB _(functions, cosmos-db)_
5. Extracted content indexed in Cognitive Search for semantic retrieval _(functions, cognitive-search)_
6. Search index metadata synchronized to Cosmos DB _(cognitive-search, cosmos-db)_
7. Pipeline telemetry collected by Application Insights _(functions, app-insights)_
8. Logs aggregated in Log Analytics for monitoring _(app-insights, log-analytics)_

---


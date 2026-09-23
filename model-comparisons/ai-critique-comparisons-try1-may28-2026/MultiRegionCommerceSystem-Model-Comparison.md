# Model Comparison Report

**Generated:** 2026-05-28T18:39:44.964Z

**Prompt:** A multi-region e-commerce system with Cosmos DB for global product catalog, Azure Front Door for traffic routing, Redis Cache for sessions, and Event Grid for order processing

**Reasoning Effort:** low

**Models Compared:** 10 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** 🏆 Most Thorough 📦 Most Services | 15.4s | 3,699 | 10 | 12 | 5 | 9 |
| **GPT-5.2** 📦 Most Services | 18.7s | 3,469 | 10 | 12 | 5 | 8 |
| **GPT-5.2 Codex** 💰 Cheapest | 10.0s | 2,451 | 6 | 6 | 4 | 5 |
| **GPT-5.3 Codex** 📦 Most Services | 23.5s | 3,781 | 10 | 12 | 5 | 8 |
| **GPT-5.4** 📦 Most Services | 30.0s | 3,775 | 10 | 12 | 4 | 8 |
| **GPT-5.4 Mini** 📦 Most Services | 13.1s | 4,036 | 10 | 12 | 5 | 7 |
| **DeepSeek V3.2 Speciale** 📦 Most Services 🔗 Most Detailed | 12.5s | 2,996 | 10 | 13 | 5 | 7 |
| **DeepSeek V4 Pro** 📦 Most Services | 21.8s | 2,930 | 10 | 9 | 5 | 7 |
| **Grok 4.1 Fast** ⚡ Fastest | 7.9s | 2,618 | 9 | 8 | 5 | 8 |
| **Grok 4.3** | 51.9s | 6,041 | 9 | 9 | 5 | 7 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,425 | 2,274 | 3,699 |
| GPT-5.2 | 1,425 | 2,044 | 3,469 |
| GPT-5.2 Codex | 1,425 | 1,026 | 2,451 |
| GPT-5.3 Codex | 1,425 | 2,356 | 3,781 |
| GPT-5.4 | 1,425 | 2,350 | 3,775 |
| GPT-5.4 Mini | 1,425 | 2,611 | 4,036 |
| DeepSeek V3.2 Speciale | 1,454 | 1,542 | 2,996 |
| DeepSeek V4 Pro | 1,451 | 1,479 | 2,930 |
| Grok 4.1 Fast | 1,398 | 1,220 | 2,618 |
| Grok 4.3 | 1,412 | 1,084 | 6,041 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-ingress |
| App Service | App Service | grp-app |
| Azure Cache for Redis | Azure Cache for Redis | grp-app |
| Azure Functions | Azure Functions | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Storage Account | Storage Account | grp-data |
| Azure Event Grid | Azure Event Grid | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Routing, Application & Compute, Data, Cache & Events, Identity & Access, Monitoring & Diagnostics

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-frontdoor | svc-appservice | Route customer HTTP(S) requests to closest healthy web app region | sync |
| svc-frontdoor | svc-storage | Serve static assets such as images and scripts for product pages | sync |
| svc-appservice | svc-redis | Read and write user session state and shopping cart contents | sync |
| svc-appservice | svc-cosmos | Query global product catalog and persist order records | sync |
| svc-appservice | svc-eventgrid | Publish OrderPlaced and OrderUpdated events for asynchronous processing | async |
| svc-eventgrid | svc-functions | Trigger serverless order workflows when new order events arrive | async |
| svc-functions | svc-cosmos | Update order status, inventory, and audit records after processing | sync |
| svc-functions | svc-storage | Store order-related documents such as invoices or packing slips | sync |
| svc-cosmos | svc-eventgrid | Emit data change notifications for order and catalog updates | async |
| svc-appservice | svc-entra | Redirect users for sign-in and validate tokens for secured APIs | sync |
| svc-appservice | svc-azmonitor | Send application metrics, traces, and request logs | async |
| svc-azmonitor | svc-loganalytics | Ingest consolidated telemetry for querying and alerting | async |

**Workflow:**

1. Customer navigates to the e-commerce site, and Azure Front Door routes the request to the nearest healthy App Service instance. _(svc-frontdoor, svc-appservice)_
2. App Service delegates authentication to Microsoft Entra ID and establishes a user session, optionally using Azure Cache for Redis for session state. _(svc-appservice, svc-entra, svc-redis)_
3. For browsing, App Service retrieves product catalog data from Azure Cosmos DB and static assets from the Storage Account, returning composed product pages. _(svc-appservice, svc-cosmos, svc-storage)_
4. As users add items to the cart, App Service updates shopping cart state in Azure Cache for Redis and records interim data in Azure Cosmos DB if needed. _(svc-appservice, svc-redis, svc-cosmos)_
5. When checkout is completed, App Service writes the order to Azure Cosmos DB and immediately publishes an OrderPlaced event to Azure Event Grid. _(svc-appservice, svc-cosmos, svc-eventgrid)_
6. Azure Event Grid invokes Azure Functions to handle order processing tasks such as inventory checks, payment confirmation, and fulfillment orchestration. _(svc-eventgrid, svc-functions)_
7. Azure Functions updates the order status and inventory documents in Azure Cosmos DB and can store related artifacts such as invoices in the Storage Account. _(svc-functions, svc-cosmos, svc-storage)_
8. Changes to orders or catalog entries in Azure Cosmos DB emit events through Azure Event Grid, enabling further downstream integrations if required. _(svc-cosmos, svc-eventgrid, svc-functions)_
9. Throughout the flow, App Service sends metrics and logs to Azure Monitor, which aggregates telemetry in Log Analytics for troubleshooting and optimization. _(svc-appservice, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-ingress |
| App Service | App Service | grp-app |
| Azure Event Grid | Azure Event Grid | grp-app |
| Azure Functions | Azure Functions | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress / Edge (Multi-region Routing), Application / Compute, Data / Storage (Globally Distributed), Identity & Secrets, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-frontdoor | svc-appservice | Route user traffic to nearest healthy regional web/API endpoint | sync |
| svc-entra | svc-appservice | Issue and validate OAuth/OIDC tokens for authenticated requests | sync |
| svc-keyvault | svc-appservice | Provide secrets and certificates at startup and during key rotation | sync |
| svc-appservice | svc-redis | Read/write user sessions and cart state for low-latency access | sync |
| svc-appservice | svc-cosmos | Query global product catalog and persist cart/checkout metadata | sync |
| svc-appservice | svc-eventgrid | Publish OrderPlaced event after successful checkout submission | async |
| svc-eventgrid | svc-functions | Trigger order-processing function per OrderPlaced event subscription | async |
| svc-functions | svc-cosmos | Create order record and update inventory/reservation state | sync |
| svc-functions | svc-redis | Invalidate session/cart cache after order completion | optional |
| svc-appservice | svc-azuremonitor | Emit application metrics, traces, and dependency telemetry | sync |
| svc-azuremonitor | svc-loganalytics | Centralize collected telemetry into workspace for querying and alerts | sync |
| svc-frontdoor | svc-entra | Redirect users to sign-in and complete authorization code flow | optional |

**Workflow:**

1. Customer hits the e-commerce URL; Azure Front Door routes the request to the nearest healthy region hosting the app. _(svc-frontdoor, svc-appservice)_
2. User signs in; the application uses Microsoft Entra ID for authentication and token validation on protected endpoints. _(svc-entra, svc-appservice, svc-frontdoor)_
3. The application retrieves required secrets (e.g., database keys/connection strings) from Key Vault to access downstream services securely. _(svc-keyvault, svc-appservice)_
4. Browsing and cart actions use Redis for session/cart state and Cosmos DB for global product catalog lookups. _(svc-appservice, svc-redis, svc-cosmos)_
5. On checkout, the application records checkout metadata and publishes an OrderPlaced event for asynchronous processing. _(svc-appservice, svc-cosmos, svc-eventgrid)_
6. Event Grid delivers the OrderPlaced event to an Azure Functions handler to process the order without blocking the user request. _(svc-eventgrid, svc-functions)_
7. The Functions handler writes the final order state to Cosmos DB and optionally invalidates Redis session/cart cache entries. _(svc-functions, svc-cosmos, svc-redis)_
8. Application telemetry is sent to Azure Monitor and stored in Log Analytics for investigation, dashboards, and alerting. _(svc-appservice, svc-azuremonitor, svc-loganalytics)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-ingress |
| App Service | App Service | grp-app |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Azure Event Grid | Azure Event Grid | grp-integration |
| Azure Functions | Azure Functions | grp-integration |

**Groups:** Ingress/Edge, Application/Compute, Data/Storage, Integration/Events

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| frontdoor | appservice | Route user traffic to nearest healthy regional app | sync |
| appservice | redis | Read and update session and cart state | sync |
| appservice | cosmos | Query global product catalog and persist orders | sync |
| appservice | eventgrid | Publish order-created and payment-confirmed events | async |
| eventgrid | functions | Deliver order events to processing handlers | async |
| functions | cosmos | Update order status and inventory reservations | sync |

**Workflow:**

1. Customer traffic is routed to the closest healthy region _(frontdoor, appservice)_
2. Application retrieves session and cart state for the user _(appservice, redis)_
3. Product catalog and pricing are read from the global database _(appservice, cosmos)_
4. Order submission triggers an event for downstream processing _(appservice, eventgrid)_
5. Event-driven functions process the order and update records _(eventgrid, functions, cosmos)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-edge |
| App Service | App Service | grp-app |
| Azure Event Grid | Azure Event Grid | grp-app |
| Azure Functions | Azure Functions | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-security |
| Key Vault | Key Vault | grp-security |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Traffic Routing, Application & Order Processing, Data Layer, Identity & Secrets, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-frontdoor | svc-appservice | Route shopper HTTP requests to healthiest regional app endpoint | sync |
| svc-appservice | svc-entra | Validate user sign-in and acquire access tokens for checkout sessions | sync |
| svc-appservice | svc-keyvault | Retrieve API keys and database credentials at runtime | sync |
| svc-appservice | svc-redis | Read and update cart/session state for active shoppers | sync |
| svc-appservice | svc-cosmos | Query global product catalog and persist order documents | sync |
| svc-appservice | svc-eventgrid | Publish OrderPlaced events after successful checkout | async |
| svc-eventgrid | svc-functions | Trigger serverless order processing handlers per event subscription | async |
| svc-functions | svc-cosmos | Update order status and reserve inventory records | sync |
| svc-functions | svc-eventgrid | Emit OrderProcessed and OrderFailed lifecycle events | async |
| svc-eventgrid | svc-appservice | Deliver order lifecycle notifications to application webhook endpoint | async |
| svc-appservice | svc-azmonitor | Send application performance metrics and request telemetry | sync |
| svc-azmonitor | svc-loganalytics | Ingest and retain platform/application logs for analysis | async |

**Workflow:**

1. Customer traffic enters globally and is sent to the best available regional app instance. _(svc-frontdoor, svc-appservice)_
2. Application authenticates the user and retrieves required secrets before serving commerce actions. _(svc-appservice, svc-entra, svc-keyvault)_
3. Product pages and carts are served using global catalog data and low-latency session cache. _(svc-appservice, svc-cosmos, svc-redis)_
4. On checkout, order data is stored and an OrderPlaced event is published for downstream processing. _(svc-appservice, svc-cosmos, svc-eventgrid)_
5. Event Grid pushes order events to Functions, which execute fulfillment and status logic. _(svc-eventgrid, svc-functions)_
6. Functions write updated order/inventory state and publish lifecycle events for application consumption. _(svc-functions, svc-cosmos, svc-eventgrid)_
7. Application receives lifecycle notifications and exposes updated order state to customers. _(svc-eventgrid, svc-appservice)_
8. Primary application telemetry is centralized for alerting and log analytics. _(svc-appservice, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-edge |
| App Service | App Service | grp-app |
| App Service | App Service | grp-app |
| Azure Event Grid | Azure Event Grid | grp-app |
| Azure Functions | Azure Functions | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Global Routing, Regional Application & Order Processing, Global Data & Session State, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| frontdoor | app-east | Route customer storefront traffic to primary healthy region | sync |
| frontdoor | app-west | Fail over customer sessions to secondary region during degradation | optional |
| app-east | redis-east | Read and update active customer session and cart state | sync |
| app-west | redis-west | Read and update secondary-region session and cart state | sync |
| app-east | cosmos-catalog | Query global product catalog and persist checkout records | sync |
| app-west | cosmos-catalog | Query replicated catalog data and persist regional checkout records | sync |
| app-east | eventgrid-orders | Publish order-created event after successful checkout | async |
| app-west | eventgrid-orders | Publish failover-region order-created event after successful checkout | async |
| eventgrid-orders | order-functions | Trigger asynchronous order workflow for each new order event | async |
| order-functions | cosmos-catalog | Update order processing state and enrich order with catalog details | sync |
| app-east | azure-monitor | Send application performance metrics and request telemetry | sync |
| azure-monitor | log-analytics | Export collected telemetry for centralized analysis and retention | sync |

**Workflow:**

1. Azure Front Door evaluates health and directs shoppers to the primary regional storefront, with the secondary region available for failover. _(frontdoor, app-east, app-west)_
2. The selected regional App Service loads the customer's session and shopping cart from the co-located Redis cache. _(app-east, redis-east, app-west, redis-west)_
3. The regional storefront retrieves product information from the globally distributed Cosmos DB catalog during browsing and checkout. _(app-east, app-west, cosmos-catalog)_
4. After checkout completes, the storefront writes order data and publishes an order-created event to Event Grid. _(app-east, app-west, cosmos-catalog, eventgrid-orders)_
5. Event Grid delivers each order event to Azure Functions for asynchronous order processing. _(eventgrid-orders, order-functions)_
6. Azure Functions updates order status and related metadata in Cosmos DB as processing advances. _(order-functions, cosmos-catalog)_
7. The primary application sends runtime telemetry to Azure Monitor for centralized collection. _(app-east, azure-monitor)_
8. Azure Monitor forwards collected logs and metrics into Log Analytics for troubleshooting and operational analysis. _(azure-monitor, log-analytics)_

---

### GPT-5.4 Mini

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | edge-group |
| App Service | App Service | app-group |
| Azure Functions | Azure Functions | app-group |
| Azure Cosmos DB | Azure Cosmos DB | data-group |
| Azure Cache for Redis | Azure Cache for Redis | data-group |
| Azure Event Grid | Azure Event Grid | app-group |
| Microsoft Entra ID | Microsoft Entra ID | security-group |
| Key Vault | Key Vault | security-group |
| Azure Monitor | Azure Monitor | monitor-group |
| Log Analytics | Log Analytics | monitor-group |

**Groups:** Global Edge, Application & Processing, Data Layer, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| front-door | app-service | Route shopper traffic to the nearest healthy region | sync |
| app-service | entra-id | Redirect users for sign-in and receive authentication tokens | sync |
| app-service | key-vault | Retrieve connection secrets and signing keys at runtime | sync |
| app-service | redis-cache | Read and refresh customer session state for fast checkout | sync |
| app-service | cosmos-db | Read the global product catalog and pricing data | sync |
| app-service | event-grid | Publish order placed events for downstream fulfillment | async |
| event-grid | functions-order | Trigger backend order processing when a new event arrives | async |
| functions-order | cosmos-db | Persist order state and update inventory records | sync |
| functions-order | redis-cache | Invalidate or update cached session and cart data after checkout | sync |
| functions-order | key-vault | Resolve secrets needed for fulfillment integrations | sync |
| app-service | azure-monitor | Emit application telemetry and request metrics | sync |
| azure-monitor | log-analytics | Store logs and diagnostics for operational analysis | sync |

**Workflow:**

1. A shopper enters the site through the global edge and is routed to the healthiest regional application instance. _(front-door, app-service)_
2. The application authenticates the user with Microsoft Entra ID and retrieves runtime secrets from Key Vault. _(app-service, entra-id, key-vault)_
3. The application restores the customer session from Redis Cache and reads the latest product catalog from Cosmos DB. _(app-service, redis-cache, cosmos-db)_
4. When the customer places an order, the application publishes an order event to Event Grid. _(app-service, event-grid)_
5. Event Grid triggers Azure Functions to process the order, update order records, and adjust inventory in Cosmos DB. _(event-grid, functions-order, cosmos-db)_
6. The function app updates cached session and cart data in Redis Cache and resolves any required downstream secrets from Key Vault. _(functions-order, redis-cache, key-vault)_
7. The application emits telemetry to Azure Monitor, which forwards logs to Log Analytics for centralized observability. _(app-service, azure-monitor, log-analytics)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | edge |
| App Service | App Service | compute |
| Azure Functions | Azure Functions | compute |
| Azure Cosmos DB | Azure Cosmos DB | data |
| Azure Cache for Redis | Azure Cache for Redis | data |
| Azure Event Grid | Azure Event Grid | messaging |
| Key Vault | Key Vault | monitoring |
| Microsoft Entra ID | Microsoft Entra ID | monitoring |
| Azure Monitor | Azure Monitor | monitoring |
| Log Analytics | Log Analytics | monitoring |

**Groups:** Edge & Ingress, Application & Compute, Data & Storage, Event Processing, Monitoring & Security

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| frontdoor | appservice | Routes HTTP requests | sync |
| appservice | cosmosdb | Read/write product catalog | sync |
| appservice | rediscache | Cache sessions and product data | sync |
| appservice | eventgrid | Publish order events | async |
| eventgrid | function | Trigger order processing | async |
| function | cosmosdb | Update order status | sync |
| function | rediscache | Invalidate cache on updates | sync |
| appservice | keyvault | Retrieve secrets and connection strings | sync |
| function | keyvault | Retrieve secrets and connection strings | sync |
| appservice | entra | Authenticate users | sync |
| appservice | monitor | Send metrics and logs | async |
| function | monitor | Send metrics and logs | async |
| monitor | loganalytics | Store and analyze logs | async |

**Workflow:**

1. User accesses the e-commerce site. Azure Front Door routes the request to the nearest App Service instance. _(frontdoor, appservice)_
2. App Service authenticates the user via Microsoft Entra ID and retrieves secrets from Key Vault. _(appservice, entra, keyvault)_
3. App Service reads product catalog from Cosmos DB, with Redis Cache as a session store and cache for frequently accessed data. _(appservice, cosmosdb, rediscache)_
4. When a customer places an order, App Service publishes an order event to Event Grid. _(appservice, eventgrid)_
5. Event Grid triggers an Azure Function to process the order asynchronously. _(eventgrid, function)_
6. The Function updates order status in Cosmos DB and invalidates relevant cache entries in Redis. _(function, cosmosdb, rediscache)_
7. All services emit telemetry to Azure Monitor, which forwards logs to Log Analytics for analysis. _(appservice, function, monitor, loganalytics)_

---

### DeepSeek V4 Pro

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | group-edge |
| App Service | App Service | group-compute |
| Azure Event Grid | Azure Event Grid | group-compute |
| Azure Cosmos DB | Azure Cosmos DB | group-data |
| Azure Cache for Redis | Azure Cache for Redis | group-data |
| Storage Account | Storage Account | group-data |
| Key Vault | Key Vault | group-identity |
| Microsoft Entra ID | Microsoft Entra ID | group-identity |
| Azure Monitor | Azure Monitor | group-monitor |
| Log Analytics | Log Analytics | group-monitor |

**Groups:** Global Entry & Traffic Management, Application & Processing, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| frontdoor | appservice | Routes user requests to nearest regional App Service | sync |
| appservice | cosmosdb | Reads product catalog and writes orders | sync |
| appservice | redis | Stores and retrieves user session state | sync |
| appservice | eventgrid | Publishes order placed event | async |
| eventgrid | storage | Persists order receipt upon event trigger | async |
| appservice | keyvault | Retrieves database and cache connection secrets | sync |
| appservice | entraid | Validates user access tokens | sync |
| appservice | monitor | Emits application metrics and traces | async |
| monitor | loganalytics | Streams aggregated diagnostics for analysis | async |

**Workflow:**

1. User request enters via Azure Front Door and is routed to the optimal regional App Service instance. _(frontdoor, appservice)_
2. App Service authenticates the user against Microsoft Entra ID. _(appservice, entraid)_
3. App Service retrieves database and cache connection strings from Key Vault. _(appservice, keyvault)_
4. App Service reads product catalog from Cosmos DB and checks session state in Redis Cache to build the page. _(appservice, cosmosdb, redis)_
5. User places an order; App Service writes the order to Cosmos DB and publishes an OrderPlaced event to Event Grid. _(appservice, cosmosdb, eventgrid)_
6. Event Grid triggers a function or logic app (conceptual) that persists the order receipt to Storage Account for archival. _(eventgrid, storage)_
7. App Service emits application metrics to Azure Monitor, which streams logs to Log Analytics for centralized observability. _(appservice, monitor, loganalytics)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | edge |
| Application Gateway | Application Gateway | edge |
| App Service | App Service | app |
| Azure Cache for Redis | Azure Cache for Redis | data |
| Azure Cosmos DB | Azure Cosmos DB | data |
| Azure Event Grid | Azure Event Grid | events |
| Azure Functions | Azure Functions | events |
| Azure Monitor | Azure Monitor | observability |
| Log Analytics | Log Analytics | observability |

**Groups:** Global Edge & Networking, Application Tier, Data & Storage, Event Processing, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| afd | appgw | Route global traffic to regional gateways | sync |
| appgw | appsvc | Load balance HTTP requests to app service | sync |
| appsvc | cosmos | Query product catalog by SKU | sync |
| appsvc | redis | Read/write customer session state | sync |
| appsvc | eventgrid | Publish new order events | async |
| eventgrid | functions | Trigger order fulfillment workflows | async |
| appsvc | monitor | Send application metrics and traces | async |
| monitor | loganalytics | Aggregate and store telemetry data | async |

**Workflow:**

1. Global traffic enters through Azure Front Door and routes to regional Application Gateways _(afd, appgw)_
2. Application Gateway load balances requests to App Service instances _(appgw, appsvc)_
3. App Service queries Cosmos DB for product catalog data _(appsvc, cosmos)_
4. App Service manages user sessions via Redis Cache _(appsvc, redis)_
5. Customer completes order; App Service publishes event to Event Grid _(appsvc, eventgrid)_
6. Event Grid triggers Azure Functions for order processing _(eventgrid, functions)_
7. App Service emits telemetry to Azure Monitor _(appsvc, monitor)_
8. Azure Monitor aggregates data and forwards to Log Analytics for analysis _(monitor, loganalytics)_

---

### Grok 4.3

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | ingress |
| Azure Functions | Azure Functions | application |
| Azure Event Grid | Azure Event Grid | application |
| Azure Cosmos DB | Azure Cosmos DB | data |
| Azure Cache for Redis | Azure Cache for Redis | data |
| Microsoft Entra ID | Microsoft Entra ID | identity |
| Key Vault | Key Vault | identity |
| Azure Monitor | Azure Monitor | monitoring |
| Log Analytics | Log Analytics | monitoring |

**Groups:** Ingress & Edge, Application Layer, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| frontDoor | functions | Route multi-region HTTP requests to nearest backend | sync |
| functions | redisCache | Store and retrieve user session data | sync |
| functions | cosmosDb | Query and update global product catalog | sync |
| functions | eventGrid | Publish order created and status events | async |
| eventGrid | functions | Trigger order fulfillment and notification handlers | async |
| functions | entraId | Validate JWT tokens for authenticated API access | sync |
| functions | keyVault | Retrieve database connection strings and secrets | sync |
| functions | azureMonitor | Emit application metrics and distributed traces | sync |
| azureMonitor | logAnalytics | Forward collected logs for long-term analysis | async |

**Workflow:**

1. User request arrives and is routed globally by Front Door to the nearest Functions instance _(frontDoor, functions)_
2. Azure Functions validates the user session token against Microsoft Entra ID _(functions, entraId)_
3. Session data and shopping cart state are loaded from Redis Cache _(functions, redisCache)_
4. Product catalog and inventory are read from the globally replicated Cosmos DB _(functions, cosmosDb)_
5. Order is created and an event is published to Event Grid for async processing _(functions, eventGrid)_
6. Event Grid triggers order fulfillment, payment, and notification workflows in Functions _(eventGrid, functions)_
7. Functions emits telemetry to Azure Monitor which forwards logs to Log Analytics _(functions, azureMonitor, logAnalytics)_

---


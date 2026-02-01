# Test Prompts with Pricing Data Coverage

**Purpose:** These prompts generate diagrams using services that have real regional pricing data loaded.

**Last Updated:** January 31, 2026

---

## 1. E-commerce Backend (10 services)

**Services:** App Service, Cosmos DB, Redis Cache, Storage, SQL Database, Functions, Service Bus, Application Gateway, Key Vault, Application Insights

```
Design an e-commerce backend with Azure App Service for the web API, Azure Cosmos DB for product catalog, Redis Cache for sessions, Storage for images, SQL Database for orders, Azure Functions for order processing, Service Bus for async messaging, Application Gateway for load balancing, Key Vault for secrets, and Application Insights for monitoring.
```

---

## 2. Data Analytics Pipeline (8 services)

**Services:** Event Hubs, Stream Analytics, Data Factory, Synapse Analytics, Storage, Machine Learning, Log Analytics, Azure Monitor

```
Build a data analytics pipeline with Event Hubs for ingestion, Stream Analytics for real-time processing, Azure Data Factory for ETL, Azure Synapse Analytics for warehousing, Storage for data lake, Azure Machine Learning for predictions, Log Analytics for monitoring, and Azure Monitor for alerts.
```

---

## 3. AI-Powered Application (9 services)

**Services:** App Service, Azure OpenAI (Foundry Models), Document Intelligence (Foundry Tools), Cosmos DB, Functions, Storage, Redis Cache, Key Vault, Application Insights

```
Create an AI-powered application with Azure App Service frontend, Azure OpenAI for GPT-4 chat, Document Intelligence for PDF extraction, Azure Cosmos DB for conversation history, Azure Functions for orchestration, Storage for files, Redis Cache for caching, Key Vault for API keys, and Application Insights for telemetry.
```

---

## 4. Microservices Architecture (11 services)

**Services:** AKS, Container Registry, API Management, Cosmos DB, SQL Database, Redis Cache, Service Bus, Application Gateway, Azure Firewall, Key Vault, Azure Monitor

```
Design a microservices architecture with Azure Kubernetes Service as the orchestrator, Container Registry for images, API Management for gateway, Azure Cosmos DB and SQL Database for data, Redis Cache for caching, Service Bus for messaging, Application Gateway with Azure Firewall, Key Vault for secrets, and Azure Monitor for observability.
```

---

## 5. Secure Enterprise Application (10 services)

**Services:** App Service, SQL Database, Azure Firewall, Application Gateway, VPN Gateway, Key Vault, Microsoft Defender for Cloud, Log Analytics, Azure Monitor, Backup

```
Build a secure enterprise application with Azure App Service, SQL Database, Azure Firewall, Application Gateway, VPN Gateway for hybrid connectivity, Key Vault, Microsoft Defender for Cloud, Log Analytics, Azure Monitor, and Backup for disaster recovery.
```

---

## 6. IoT Analytics Platform (9 services)

**Services:** Event Hubs, Stream Analytics, Cosmos DB, Storage, Functions, Machine Learning, Azure Monitor, Log Analytics, Container Instances

```
Design an IoT analytics platform with Event Hubs for device telemetry ingestion, Stream Analytics for real-time processing, Azure Cosmos DB for device state, Storage for historical data, Azure Functions for alerts, Azure Machine Learning for anomaly detection, Container Instances for edge processing, and Azure Monitor with Log Analytics for observability.
```

---

## 7. Multi-Region Web App (12 services)

**Services:** App Service, Azure Front Door, Cosmos DB, Redis Cache, Storage, SQL Database, Key Vault, Application Insights, Azure Monitor, CDN, Azure Firewall, Backup

```
Create a globally distributed web application with Azure App Service backends in multiple regions, Azure Front Door for global load balancing, Azure Cosmos DB with multi-region writes, Redis Cache for session affinity, Storage for static assets, SQL Database for transactional data, Content Delivery Network for static content, Azure Firewall for security, Key Vault for secrets, Application Insights and Azure Monitor for observability, and Backup for disaster recovery.
```

---

## 8. Real-time Messaging Platform (8 services)

**Services:** Event Hubs, Service Bus, Functions, Cosmos DB, Redis Cache, Notification Hubs, Application Insights, Key Vault

```
Build a real-time messaging platform with Event Hubs for high-throughput ingestion, Service Bus for reliable message delivery, Azure Functions for message processing, Azure Cosmos DB for message storage, Redis Cache for presence tracking, Notification Hubs for push notifications, Key Vault for encryption keys, and Application Insights for monitoring.
```

---

## 9. DevOps & CI/CD Pipeline (9 services)

**Services:** Azure DevOps, Container Registry, AKS, Key Vault, Azure Monitor, Log Analytics, Application Insights, Storage, Azure Firewall

```
Design a DevOps pipeline with Azure DevOps for CI/CD, Container Registry for Docker images, Azure Kubernetes Service for deployments, Key Vault for secrets and certificates, Storage for artifacts, Azure Firewall for network security, and Azure Monitor with Log Analytics and Application Insights for full observability.
```

---

## 10. Hybrid Cloud Architecture (10 services)

**Services:** VPN Gateway, ExpressRoute, Virtual Network, Azure Firewall, App Service, SQL Database, Key Vault, Azure Monitor, Backup, Microsoft Defender for Cloud

```
Create a hybrid cloud architecture with VPN Gateway and ExpressRoute for connectivity, Virtual Network for isolation, Azure Firewall for perimeter security, Azure App Service for web workloads, SQL Database for data, Key Vault for secrets management, Microsoft Defender for Cloud for security posture, Azure Monitor for observability, and Backup for disaster recovery.
```

---

## Testing Instructions

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Generate diagram:** Paste any prompt above into the AI Architecture Generator

3. **Verify pricing:**
   - Check the cost estimate badge updates
   - Switch regions and verify prices change
   - Open browser console for pricing logs (`📦 Loaded...`, `✅ Found...`)

4. **Services with pricing data (39 files per region):**
   - api_management, application_gateway, application_insights
   - azure_app_service, azure_cosmos_db, azure_data_factory
   - azure_database_for_mysql, azure_database_for_postgresql
   - azure_devops, azure_firewall, azure_front_door_service
   - azure_kubernetes_service, azure_machine_learning, azure_monitor
   - azure_synapse_analytics, backup, container_instances
   - container_registry, content_delivery_network, event_grid
   - event_hubs, expressroute, foundry_models, foundry_tools
   - functions, key_vault, log_analytics, logic_apps
   - microsoft_defender_for_cloud, network_watcher, notification_hubs
   - redis_cache, service_bus, sql_database, storage
   - stream_analytics, virtual_machines, virtual_network, vpn_gateway

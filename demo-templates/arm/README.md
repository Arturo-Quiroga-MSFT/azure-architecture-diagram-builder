# Sample ARM Templates

Demo ARM templates showcasing the **Import ARM** feature of the Azure Architecture Diagram Builder.

## Templates

| File | Description | Services |
|------|-------------|----------|
| `ecommerce-microservices.json` | Black Friday-ready e-commerce with AKS microservices | 14 |
| `iot-realtime-analytics.json` | IoT streaming pipeline with Digital Twins & ML | 15 |
| `enterprise-rag-chatbot.json` | RAG chatbot with Azure OpenAI & Cognitive Search | 15 |
| `multi-region-disaster-recovery.json` | Active-passive DR with SQL failover groups | 17 |
| `hipaa-healthcare-platform.json` | HIPAA-compliant FHIR/DICOM healthcare platform | 21 |
| `multiplayer-gaming-backend.json` | Global gaming backend with SignalR & PlayFab | 18 |

## How to Use

1. Open the Azure Architecture Diagram Builder
2. Click **Import ARM** in the toolbar
3. Select any template from this folder
4. The app will:
   - Parse all Azure resources
   - Auto-detect service types and icons
   - Use AI to create logical groups and connections
   - Generate an interactive diagram

## Architecture Patterns Demonstrated

- **Microservices** - AKS, Service Bus, API Management
- **Event-driven** - Event Hubs, Event Grid, Functions
- **AI/ML Pipelines** - Azure OpenAI, Cognitive Search, ML Workspaces
- **Disaster Recovery** - Failover groups, geo-replication, Traffic Manager
- **Healthcare Compliance** - FHIR, DICOM, Private Endpoints, audit logging
- **Real-time Gaming** - SignalR, Cosmos DB multi-region writes, CDN

## Notes

These templates are designed for **demo purposes** and may not include all production requirements (networking, RBAC, diagnostics settings, etc.). Use Azure Well-Architected Framework guidance for production deployments.

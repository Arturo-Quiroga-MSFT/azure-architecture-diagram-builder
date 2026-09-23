---
title: Demo Templates
description: Curated IaC templates for showcasing the Import Template feature
---

# Demo Templates

This directory contains curated Bicep and Terraform templates designed to exercise
the **Import Template** feature across a range of Azure architecture patterns. Each
template is self-contained and reflects real-world resource combinations at varying
complexity levels.

## Template Catalog

| # | Pattern | Bicep | Terraform | Key Resources |
|---|---------|-------|-----------|---------------|
| 01 | Web App + SQL | `bicep/01-webapp-sql.bicep` | `terraform/01-webapp-sql.tf` | App Service, SQL Server, SQL Database, App Insights |
| 02 | Serverless Event-Driven | `bicep/02-serverless-event-driven.bicep` | `terraform/02-serverless-event-driven.tf` | Function App, Service Bus (queues + topics), Cosmos DB, Storage |
| 03 | AKS Microservices | `bicep/03-aks-microservices.bicep` | `terraform/03-aks-microservices.tf` | AKS, ACR, App Gateway, VNet, NSG, Key Vault, Private Endpoint |
| 04 | AI RAG Architecture | `bicep/04-ai-rag-architecture.bicep` | `terraform/04-ai-rag-architecture.tf` | Azure OpenAI, AI Search, Cosmos DB, Blob Storage, App Service, Static Web App |
| 05 | Hub-Spoke Networking | `bicep/05-hub-spoke-networking.bicep` | `terraform/05-hub-spoke-networking.tf` | Hub & Spoke VNets, Azure Firewall, VPN Gateway, Route Tables, NSGs, VNet Peering |

## Usage

1. Launch the app locally or at the deployed URL.
2. Click **Import Template**.
3. Select one or more files from `bicep/` or `terraform/`.
4. The parser auto-detects the format and generates an architecture diagram.

### Multi-file import

For Bicep: Select multiple `.bicep` files simultaneously — the parser concatenates
them with filename headers so the model can reason about cross-file references.

For Terraform: Select multiple `.tf` files the same way. In a real Terraform
project, resources are often split across several files (`main.tf`, `variables.tf`,
`outputs.tf`), and the import feature handles this by merging content.

## Design rationale

The five patterns were chosen to cover:

- **Simple vs. complex** — template 01 has ~5 resources; template 05 has ~25.
- **Compute diversity** — App Service, Function App (serverless), AKS (containers).
- **Data services** — SQL Database, Cosmos DB, Blob Storage.
- **Networking depth** — from implicit VNet (01) to full hub-spoke with firewall (05).
- **AI workloads** — OpenAI + AI Search + RAG pipeline (04).
- **Cross-format parity** — each pattern exists in both Bicep and Terraform so you
  can compare how the import feature handles each syntax.

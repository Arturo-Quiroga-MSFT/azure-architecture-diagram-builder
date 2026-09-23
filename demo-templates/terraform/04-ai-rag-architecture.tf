# Demo: AI RAG Architecture
# Azure OpenAI + AI Search + Cosmos DB + Blob Storage + App Service API + Static Web App
# Source: Adapted from Azure Terraform examples

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "location" {
  default = "eastus2"
}

variable "project_name" {
  default = "ai-rag-demo"
}

data "azurerm_client_config" "current" {}

# --- Resource Group ---

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-rg"
  location = var.location
}

# --- Azure OpenAI ---

resource "azurerm_cognitive_account" "openai" {
  name                  = "${var.project_name}-openai"
  location              = azurerm_resource_group.main.location
  resource_group_name   = azurerm_resource_group.main.name
  kind                  = "OpenAI"
  sku_name              = "S0"
  custom_subdomain_name = "${var.project_name}-openai"

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_cognitive_deployment" "gpt4o" {
  name                 = "gpt-4o"
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = "gpt-4o"
    version = "2024-08-06"
  }

  sku {
    name     = "Standard"
    capacity = 30
  }
}

resource "azurerm_cognitive_deployment" "embedding" {
  name                 = "text-embedding-ada-002"
  cognitive_account_id = azurerm_cognitive_account.openai.id

  model {
    format  = "OpenAI"
    name    = "text-embedding-ada-002"
    version = "2"
  }

  sku {
    name     = "Standard"
    capacity = 30
  }
}

# --- AI Search ---

resource "azurerm_search_service" "main" {
  name                = "${var.project_name}-search"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "standard"
  replica_count       = 1
  partition_count     = 1
  semantic_search_sku = "standard"

  identity {
    type = "SystemAssigned"
  }
}

# --- Cosmos DB ---

resource "azurerm_cosmosdb_account" "main" {
  name                = "${var.project_name}-cosmos"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "main" {
  name                = "ragdb"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_sql_container" "conversations" {
  name                = "conversations"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/userId"]

  indexing_policy {
    indexing_mode = "consistent"
    included_path {
      path = "/*"
    }
  }
}

# --- Blob Storage (document store) ---

resource "azurerm_storage_account" "documents" {
  name                     = replace("${var.project_name}docs", "-", "")
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  blob_properties {
    cors_rule {
      allowed_headers    = ["*"]
      allowed_methods    = ["GET", "PUT"]
      allowed_origins    = ["*"]
      exposed_headers    = ["*"]
      max_age_in_seconds = 3600
    }
  }
}

resource "azurerm_storage_container" "documents" {
  name                  = "documents"
  storage_account_id    = azurerm_storage_account.documents.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "processed" {
  name                  = "processed"
  storage_account_id    = azurerm_storage_account.documents.id
  container_access_type = "private"
}

# --- App Service (API backend) ---

resource "azurerm_service_plan" "api" {
  name                = "${var.project_name}-api-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}

resource "azurerm_linux_web_app" "api" {
  name                = "${var.project_name}-api"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.api.id
  https_only          = true

  site_config {
    application_stack {
      python_version = "3.11"
    }
    cors {
      allowed_origins = ["https://${azurerm_static_web_app.frontend.default_host_name}"]
    }
  }

  app_settings = {
    "AZURE_OPENAI_ENDPOINT"   = azurerm_cognitive_account.openai.endpoint
    "AZURE_SEARCH_ENDPOINT"   = "https://${azurerm_search_service.main.name}.search.windows.net"
    "COSMOS_ENDPOINT"         = azurerm_cosmosdb_account.main.endpoint
    "STORAGE_ACCOUNT_NAME"    = azurerm_storage_account.documents.name
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.main.connection_string
  }

  identity {
    type = "SystemAssigned"
  }
}

# --- Static Web App (frontend) ---

resource "azurerm_static_web_app" "frontend" {
  name                = "${var.project_name}-frontend"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_tier            = "Standard"
  sku_size            = "Standard"
}

# --- Key Vault ---

resource "azurerm_key_vault" "main" {
  name                       = "${var.project_name}-kv"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  enable_rbac_authorization  = true
}

# --- Monitoring ---

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "main" {
  name                = "${var.project_name}-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
}

# --- Role Assignments ---

resource "azurerm_role_assignment" "api_openai" {
  scope                = azurerm_cognitive_account.openai.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_linux_web_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "api_search" {
  scope                = azurerm_search_service.main.id
  role_definition_name = "Search Index Data Reader"
  principal_id         = azurerm_linux_web_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "api_storage" {
  scope                = azurerm_storage_account.documents.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = azurerm_linux_web_app.api.identity[0].principal_id
}

# --- Outputs ---

output "openai_endpoint" {
  value = azurerm_cognitive_account.openai.endpoint
}

output "search_endpoint" {
  value = "https://${azurerm_search_service.main.name}.search.windows.net"
}

output "api_url" {
  value = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "frontend_url" {
  value = "https://${azurerm_static_web_app.frontend.default_host_name}"
}

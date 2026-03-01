# Demo: Serverless Event-Driven Architecture
# Azure Functions (Consumption) + Service Bus + Cosmos DB (serverless) + Storage
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
  default = "eventdriven-demo"
}

# --- Resource Group ---

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-rg"
  location = var.location
}

# --- Storage Account (for Function App) ---

resource "azurerm_storage_account" "functions" {
  name                     = replace("${var.project_name}func", "-", "")
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
}

# --- Service Bus ---

resource "azurerm_servicebus_namespace" "main" {
  name                = "${var.project_name}-sbns"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "Standard"
}

resource "azurerm_servicebus_queue" "orders" {
  name         = "orders"
  namespace_id = azurerm_servicebus_namespace.main.id

  max_delivery_count  = 10
  lock_duration       = "PT1M"
  dead_lettering_on_message_expiration = true
}

resource "azurerm_servicebus_queue" "notifications" {
  name         = "notifications"
  namespace_id = azurerm_servicebus_namespace.main.id

  max_delivery_count  = 5
  lock_duration       = "PT30S"
}

resource "azurerm_servicebus_topic" "events" {
  name         = "domain-events"
  namespace_id = azurerm_servicebus_namespace.main.id
}

resource "azurerm_servicebus_subscription" "audit" {
  name     = "audit-sub"
  topic_id = azurerm_servicebus_topic.events.id

  max_delivery_count = 10
}

resource "azurerm_servicebus_subscription" "analytics" {
  name     = "analytics-sub"
  topic_id = azurerm_servicebus_topic.events.id

  max_delivery_count = 10
}

# --- Cosmos DB (Serverless) ---

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
  name                = "orderdb"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_sql_container" "orders" {
  name                = "orders"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/customerId"]
}

resource "azurerm_cosmosdb_sql_container" "audit" {
  name                = "auditlog"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name
  partition_key_paths = ["/eventType"]
}

# --- Function App ---

resource "azurerm_service_plan" "functions" {
  name                = "${var.project_name}-funcplan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "Y1"
}

resource "azurerm_linux_function_app" "main" {
  name                = "${var.project_name}-func"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.functions.id

  storage_account_name       = azurerm_storage_account.functions.name
  storage_account_access_key = azurerm_storage_account.functions.primary_access_key

  site_config {
    application_stack {
      node_version = "20"
    }
    application_insights_connection_string = azurerm_application_insights.main.connection_string
  }

  app_settings = {
    "ServiceBusConnection"       = azurerm_servicebus_namespace.main.default_primary_connection_string
    "CosmosDBConnectionString"   = azurerm_cosmosdb_account.main.primary_sql_connection_string
    "FUNCTIONS_WORKER_RUNTIME"   = "node"
  }

  identity {
    type = "SystemAssigned"
  }
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

# --- Outputs ---

output "function_app_url" {
  value = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "cosmos_endpoint" {
  value = azurerm_cosmosdb_account.main.endpoint
}

output "service_bus_namespace" {
  value = azurerm_servicebus_namespace.main.name
}

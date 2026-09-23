# Demo: Basic Web App + SQL Database
# A simple two-tier web application with App Service and Azure SQL Database.
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

variable "app_name" {
  default = "webapp-demo"
}

variable "sql_admin_login" {
  default = "sqladmin"
}

variable "sql_admin_password" {
  sensitive = true
}

# --- Resource Group ---

resource "azurerm_resource_group" "main" {
  name     = "${var.app_name}-rg"
  location = var.location
}

# --- App Service ---

resource "azurerm_service_plan" "main" {
  name                = "${var.app_name}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "S1"
}

resource "azurerm_linux_web_app" "main" {
  name                = "${var.app_name}-web"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true

  site_config {
    application_stack {
      dotnet_version = "8.0"
    }
    ftps_state = "FtpsOnly"
  }

  app_settings = {
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = azurerm_application_insights.main.connection_string
  }

  connection_string {
    name  = "DefaultConnection"
    type  = "SQLAzure"
    value = "Server=tcp:${azurerm_mssql_server.main.fully_qualified_domain_name},1433;Database=${azurerm_mssql_database.main.name};"
  }

  identity {
    type = "SystemAssigned"
  }
}

# --- SQL Server + Database ---

resource "azurerm_mssql_server" "main" {
  name                         = "${var.app_name}-sqlserver"
  resource_group_name          = azurerm_resource_group.main.name
  location                     = azurerm_resource_group.main.location
  version                      = "12.0"
  administrator_login          = var.sql_admin_login
  administrator_login_password = var.sql_admin_password
  minimum_tls_version          = "1.2"
}

resource "azurerm_mssql_database" "main" {
  name      = "${var.app_name}-db"
  server_id = azurerm_mssql_server.main.id
  sku_name  = "S1"
}

resource "azurerm_mssql_firewall_rule" "azure_services" {
  name             = "AllowAzureServices"
  server_id        = azurerm_mssql_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# --- Application Insights ---

resource "azurerm_application_insights" "main" {
  name                = "${var.app_name}-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
}

# --- Outputs ---

output "web_app_url" {
  value = "https://${azurerm_linux_web_app.main.default_hostname}"
}

output "sql_server_fqdn" {
  value = azurerm_mssql_server.main.fully_qualified_domain_name
}

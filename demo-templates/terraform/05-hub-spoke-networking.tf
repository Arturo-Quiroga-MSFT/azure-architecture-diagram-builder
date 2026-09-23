# Demo: Hub-Spoke Network Architecture
# Hub VNet (Firewall + VPN Gateway + Bastion) + 2 Spoke VNets + VNet Peering
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
  default = "hubspoke-demo"
}

# --- Resource Group ---

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-rg"
  location = var.location
}

# ============================================================
# HUB VNET
# ============================================================

resource "azurerm_virtual_network" "hub" {
  name                = "${var.project_name}-hub-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "firewall" {
  name                 = "AzureFirewallSubnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.0.1.0/26"]
}

resource "azurerm_subnet" "gateway" {
  name                 = "GatewaySubnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.0.2.0/27"]
}

resource "azurerm_subnet" "bastion" {
  name                 = "AzureBastionSubnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.0.3.0/26"]
}

resource "azurerm_subnet" "hub_management" {
  name                 = "management"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.hub.name
  address_prefixes     = ["10.0.4.0/24"]
}

# ============================================================
# SPOKE 1 - Workload
# ============================================================

resource "azurerm_virtual_network" "spoke1" {
  name                = "${var.project_name}-spoke1-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.1.0.0/16"]
}

resource "azurerm_subnet" "spoke1_workload" {
  name                 = "workload"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.spoke1.name
  address_prefixes     = ["10.1.1.0/24"]
}

resource "azurerm_subnet" "spoke1_data" {
  name                 = "data"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.spoke1.name
  address_prefixes     = ["10.1.2.0/24"]
}

# --- Spoke 1 NSG ---

resource "azurerm_network_security_group" "spoke1" {
  name                = "${var.project_name}-spoke1-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "AllowHTTPSFromHub"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "10.0.0.0/16"
    destination_address_prefix = "10.1.0.0/16"
  }

  security_rule {
    name                       = "DenyInternetInbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "spoke1_workload" {
  subnet_id                 = azurerm_subnet.spoke1_workload.id
  network_security_group_id = azurerm_network_security_group.spoke1.id
}

# ============================================================
# SPOKE 2 - Dev/Test
# ============================================================

resource "azurerm_virtual_network" "spoke2" {
  name                = "${var.project_name}-spoke2-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = ["10.2.0.0/16"]
}

resource "azurerm_subnet" "spoke2_workload" {
  name                 = "workload"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.spoke2.name
  address_prefixes     = ["10.2.1.0/24"]
}

# --- Spoke 2 NSG ---

resource "azurerm_network_security_group" "spoke2" {
  name                = "${var.project_name}-spoke2-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  security_rule {
    name                       = "AllowHTTPSFromHub"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "10.0.0.0/16"
    destination_address_prefix = "10.2.0.0/16"
  }

  security_rule {
    name                       = "DenyInternetInbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "spoke2_workload" {
  subnet_id                 = azurerm_subnet.spoke2_workload.id
  network_security_group_id = azurerm_network_security_group.spoke2.id
}

# ============================================================
# VNET PEERING
# ============================================================

resource "azurerm_virtual_network_peering" "hub_to_spoke1" {
  name                         = "hub-to-spoke1"
  resource_group_name          = azurerm_resource_group.main.name
  virtual_network_name         = azurerm_virtual_network.hub.name
  remote_virtual_network_id    = azurerm_virtual_network.spoke1.id
  allow_forwarded_traffic      = true
  allow_gateway_transit        = true
  allow_virtual_network_access = true
}

resource "azurerm_virtual_network_peering" "spoke1_to_hub" {
  name                         = "spoke1-to-hub"
  resource_group_name          = azurerm_resource_group.main.name
  virtual_network_name         = azurerm_virtual_network.spoke1.name
  remote_virtual_network_id    = azurerm_virtual_network.hub.id
  allow_forwarded_traffic      = true
  use_remote_gateways          = false
  allow_virtual_network_access = true
}

resource "azurerm_virtual_network_peering" "hub_to_spoke2" {
  name                         = "hub-to-spoke2"
  resource_group_name          = azurerm_resource_group.main.name
  virtual_network_name         = azurerm_virtual_network.hub.name
  remote_virtual_network_id    = azurerm_virtual_network.spoke2.id
  allow_forwarded_traffic      = true
  allow_gateway_transit        = true
  allow_virtual_network_access = true
}

resource "azurerm_virtual_network_peering" "spoke2_to_hub" {
  name                         = "spoke2-to-hub"
  resource_group_name          = azurerm_resource_group.main.name
  virtual_network_name         = azurerm_virtual_network.spoke2.name
  remote_virtual_network_id    = azurerm_virtual_network.hub.id
  allow_forwarded_traffic      = true
  use_remote_gateways          = false
  allow_virtual_network_access = true
}

# ============================================================
# AZURE FIREWALL
# ============================================================

resource "azurerm_public_ip" "firewall" {
  name                = "${var.project_name}-fw-pip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = [1, 2, 3]
}

resource "azurerm_firewall_policy" "main" {
  name                = "${var.project_name}-fw-policy"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"

  dns {
    proxy_enabled = true
  }
}

resource "azurerm_firewall_policy_rule_collection_group" "main" {
  name               = "DefaultRuleCollectionGroup"
  firewall_policy_id = azurerm_firewall_policy.main.id
  priority           = 100

  network_rule_collection {
    name     = "AllowSpokeCommunication"
    priority = 100
    action   = "Allow"

    rule {
      name                  = "SpokeToSpoke"
      protocols             = ["TCP", "UDP"]
      source_addresses      = ["10.1.0.0/16", "10.2.0.0/16"]
      destination_addresses = ["10.1.0.0/16", "10.2.0.0/16"]
      destination_ports     = ["*"]
    }
  }

  application_rule_collection {
    name     = "AllowInternet"
    priority = 200
    action   = "Allow"

    rule {
      name = "AllowMicrosoftUpdates"
      protocols {
        type = "Https"
        port = 443
      }
      source_addresses  = ["10.1.0.0/16", "10.2.0.0/16"]
      destination_fqdns = ["*.microsoft.com", "*.windowsupdate.com"]
    }
  }
}

resource "azurerm_firewall" "main" {
  name                = "${var.project_name}-fw"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "AZFW_VNet"
  sku_tier            = "Standard"
  firewall_policy_id  = azurerm_firewall_policy.main.id
  zones               = [1, 2, 3]

  ip_configuration {
    name                 = "configuration"
    subnet_id            = azurerm_subnet.firewall.id
    public_ip_address_id = azurerm_public_ip.firewall.id
  }
}

# ============================================================
# VPN GATEWAY
# ============================================================

resource "azurerm_public_ip" "vpn" {
  name                = "${var.project_name}-vpn-pip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = [1, 2, 3]
}

resource "azurerm_virtual_network_gateway" "main" {
  name                = "${var.project_name}-vpn-gw"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  type     = "Vpn"
  vpn_type = "RouteBased"
  sku      = "VpnGw1AZ"

  ip_configuration {
    name                 = "vnetGatewayConfig"
    public_ip_address_id = azurerm_public_ip.vpn.id
    subnet_id            = azurerm_subnet.gateway.id
  }
}

# ============================================================
# ROUTE TABLES (force spoke traffic through firewall)
# ============================================================

resource "azurerm_route_table" "spoke1" {
  name                = "${var.project_name}-spoke1-rt"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  route {
    name                   = "ToFirewall"
    address_prefix         = "0.0.0.0/0"
    next_hop_type          = "VirtualAppliance"
    next_hop_in_ip_address = azurerm_firewall.main.ip_configuration[0].private_ip_address
  }
}

resource "azurerm_subnet_route_table_association" "spoke1" {
  subnet_id      = azurerm_subnet.spoke1_workload.id
  route_table_id = azurerm_route_table.spoke1.id
}

resource "azurerm_route_table" "spoke2" {
  name                = "${var.project_name}-spoke2-rt"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  route {
    name                   = "ToFirewall"
    address_prefix         = "0.0.0.0/0"
    next_hop_type          = "VirtualAppliance"
    next_hop_in_ip_address = azurerm_firewall.main.ip_configuration[0].private_ip_address
  }
}

resource "azurerm_subnet_route_table_association" "spoke2" {
  subnet_id      = azurerm_subnet.spoke2_workload.id
  route_table_id = azurerm_route_table.spoke2.id
}

# ============================================================
# MONITORING
# ============================================================

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_monitor_diagnostic_setting" "firewall" {
  name                       = "fw-diagnostics"
  target_resource_id         = azurerm_firewall.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "AzureFirewallApplicationRule"
  }
  enabled_log {
    category = "AzureFirewallNetworkRule"
  }
  metric {
    category = "AllMetrics"
  }
}

# --- Outputs ---

output "hub_vnet_id" {
  value = azurerm_virtual_network.hub.id
}

output "spoke1_vnet_id" {
  value = azurerm_virtual_network.spoke1.id
}

output "spoke2_vnet_id" {
  value = azurerm_virtual_network.spoke2.id
}

output "firewall_private_ip" {
  value = azurerm_firewall.main.ip_configuration[0].private_ip_address
}

output "vpn_gateway_ip" {
  value = azurerm_public_ip.vpn.ip_address
}

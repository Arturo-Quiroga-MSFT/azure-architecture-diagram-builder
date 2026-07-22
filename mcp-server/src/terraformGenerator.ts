// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Terraform generator.
 *
 * Emits deployable Terraform (azurerm provider) from the same
 * {services, connections} shape the other MCP tools use, with the same
 * Well-Architected secure defaults the Bicep generator pre-sets — so the
 * config-level WAF findings that can't be expressed in a diagram are resolved
 * out of the gate:
 *
 *   - App Service:  https_only, TLS 1.2, system-assigned identity, health
 *                   check, autoscale, staging slot
 *   - Key Vault:    soft-delete (90d) + purge protection + RBAC authorization
 *   - Storage:      HTTPS-only, TLS 1.2, public/nested blob access disabled
 *   - Cosmos DB:    automatic failover + continuous backup + Session consistency
 *   - Redis:        TLS 1.2 minimum, non-SSL port disabled
 *   - AI Search / Container Apps / Log Analytics + App Insights: baseline secure
 *
 * Deterministic and design-time only — it never runs `terraform apply`.
 * Returns the HCL plus a structured map of which WAF finding each setting
 * resolves. Services without a template emit a clearly-commented placeholder so
 * nothing is silently dropped; those are reported in `servicesGeneric`.
 *
 * NOTE ON STRINGS: HCL uses `${...}` interpolation, which collides with JS
 * template literals. Every HCL interpolation below is escaped as `\${...}`;
 * `${sym}` / `${nameExpr}` (no backslash) are intentional JS injections.
 */

import { resolveServiceName, SERVICE_CATALOG } from './serviceCatalog.js';

export interface TfService {
  name: string;
  type: string;
  description?: string;
  groupId?: string;
}

export interface TfConnection {
  from: string;
  to: string;
  label?: string;
}

export interface TfFindingResolved {
  ruleId: string;
  pillar: string;
  service: string;
  setting: string;
  terraformAttribute: string;
}

export interface GenerateTerraformResult {
  iacTool: 'terraform';
  terraform: string;
  findingsResolved: TfFindingResolved[];
  servicesCovered: string[];
  servicesGeneric: string[];
  note: string;
}

/** Sanitize a display name into a safe Terraform resource label (snake_case). */
function label(name: string, fallback: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const id = /^[a-z_]/.test(s) ? s : `r_${s}`;
  return id || fallback;
}

/** Short abbreviation used in generated resource names. */
const TYPE_ABBR: Record<string, string> = {
  'App Service': 'app',
  'Functions': 'func',
  'Key Vault': 'kv',
  'Storage Account': 'st',
  'Azure Cosmos DB': 'cosmos',
  'Redis Cache': 'redis',
  'Azure AI Search': 'srch',
  'Container Apps': 'aca',
  'SQL Database': 'sql',
  'Azure Front Door': 'fd',
  'Web Application Firewall': 'waf',
};

interface EmitCtx {
  sym: string;       // terraform resource label (unique)
  nameExpr: string;  // abbreviation used inside the resource name
}

interface Emitted {
  hcl: string;
  findings: TfFindingResolved[];
  /** Full HCL expression yielding this resource's managed-identity principal id. */
  identityPrincipalExpr?: string;
}

// ── Per-service Terraform templates with secure defaults ───────────────

function emitAppService(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'appsvc-https-only', pillar: 'Security', service: svc.name, setting: 'HTTPS-only + TLS 1.2', terraformAttribute: 'https_only / site_config.minimum_tls_version' },
    { ruleId: 'appsvc-managed-identity', pillar: 'Security', service: svc.name, setting: 'System-assigned managed identity', terraformAttribute: 'identity { type = "SystemAssigned" }' },
    { ruleId: 'appsvc-health-check', pillar: 'Reliability', service: svc.name, setting: 'Health check path', terraformAttribute: 'site_config.health_check_path' },
    { ruleId: 'appsvc-autoscale', pillar: 'Performance Efficiency', service: svc.name, setting: 'Autoscale rules', terraformAttribute: 'azurerm_monitor_autoscale_setting' },
    { ruleId: 'appsvc-deploy-slots', pillar: 'Operational Excellence', service: svc.name, setting: 'Staging deployment slot', terraformAttribute: 'azurerm_linux_web_app_slot' },
  ];
  const hcl = `
# ${svc.name} — App Service (HTTPS-only, TLS 1.2, managed identity, health check, autoscale, staging slot)
resource "azurerm_service_plan" "${ctx.sym}" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}

resource "azurerm_linux_web_app" "${ctx.sym}" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.${ctx.sym}.id
  https_only          = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"
    ftps_state          = "FtpsOnly"
    health_check_path   = "/health"
    http2_enabled       = true
  }
}

resource "azurerm_linux_web_app_slot" "${ctx.sym}_staging" {
  name           = "staging"
  app_service_id = azurerm_linux_web_app.${ctx.sym}.id
  https_only     = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    minimum_tls_version = "1.2"
    health_check_path   = "/health"
  }
}

resource "azurerm_monitor_autoscale_setting" "${ctx.sym}_autoscale" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}-autoscale"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  target_resource_id  = azurerm_service_plan.${ctx.sym}.id

  profile {
    name = "cpu-based"
    capacity {
      default = 2
      minimum = 2
      maximum = 10
    }
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.${ctx.sym}.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "GreaterThan"
        threshold          = 70
      }
      scale_action {
        direction = "Increase"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
    rule {
      metric_trigger {
        metric_name        = "CpuPercentage"
        metric_resource_id = azurerm_service_plan.${ctx.sym}.id
        time_grain         = "PT1M"
        statistic          = "Average"
        time_window        = "PT5M"
        time_aggregation   = "Average"
        operator           = "LessThan"
        threshold          = 30
      }
      scale_action {
        direction = "Decrease"
        type      = "ChangeCount"
        value     = "1"
        cooldown  = "PT5M"
      }
    }
  }
}
`;
  return { hcl, findings, identityPrincipalExpr: `azurerm_linux_web_app.${ctx.sym}.identity[0].principal_id` };
}

function emitKeyVault(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'kv-soft-delete', pillar: 'Reliability', service: svc.name, setting: 'Soft-delete 90d + purge protection', terraformAttribute: 'soft_delete_retention_days / purge_protection_enabled' },
    { ruleId: 'kv-rbac', pillar: 'Security', service: svc.name, setting: 'RBAC authorization', terraformAttribute: 'enable_rbac_authorization' },
  ];
  const hcl = `
# ${svc.name} — Key Vault (soft-delete 90d, purge protection, RBAC). NOTE: name must be globally unique (<=24 chars).
resource "azurerm_key_vault" "${ctx.sym}" {
  name                          = substr(replace("\${var.name_prefix}kv", "-", ""), 0, 24)
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  enable_rbac_authorization     = true
  purge_protection_enabled      = true
  soft_delete_retention_days    = 90
  public_network_access_enabled = false
}
`;
  return { hcl, findings };
}

function emitStorage(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'storage-https-only', pillar: 'Security', service: svc.name, setting: 'HTTPS-only + TLS 1.2', terraformAttribute: 'https_traffic_only_enabled / min_tls_version' },
    { ruleId: 'storage-no-public', pillar: 'Security', service: svc.name, setting: 'Public blob access disabled', terraformAttribute: 'allow_nested_items_to_be_public / public_network_access_enabled' },
  ];
  const hcl = `
# ${svc.name} — Storage Account (HTTPS-only, TLS 1.2, no public access). NOTE: name must be globally unique, 3-24 lowercase alnum.
resource "azurerm_storage_account" "${ctx.sym}" {
  name                            = substr(replace("\${var.name_prefix}st", "-", ""), 0, 24)
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  public_network_access_enabled   = false
}
`;
  return { hcl, findings };
}

function emitCosmos(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'cosmos-failover', pillar: 'Reliability', service: svc.name, setting: 'Automatic failover + continuous backup', terraformAttribute: 'automatic_failover_enabled / backup.type = "Continuous"' },
  ];
  const hcl = `
# ${svc.name} — Azure Cosmos DB (automatic failover, continuous backup, Session consistency)
resource "azurerm_cosmosdb_account" "${ctx.sym}" {
  name                          = "\${var.name_prefix}-${ctx.nameExpr}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  offer_type                    = "Standard"
  kind                          = "GlobalDocumentDB"
  automatic_failover_enabled    = true
  public_network_access_enabled = false

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  backup {
    type = "Continuous"
  }
}
`;
  return { hcl, findings };
}

function emitRedis(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'redis-tls', pillar: 'Security', service: svc.name, setting: 'TLS 1.2 minimum, non-SSL port disabled', terraformAttribute: 'minimum_tls_version / non_ssl_port_enabled' },
  ];
  const hcl = `
# ${svc.name} — Azure Cache for Redis (TLS 1.2 minimum, non-SSL port disabled)
resource "azurerm_redis_cache" "${ctx.sym}" {
  name                          = "\${var.name_prefix}-${ctx.nameExpr}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  capacity                      = 1
  family                        = "C"
  sku_name                      = "Standard"
  minimum_tls_version           = "1.2"
  non_ssl_port_enabled          = false
  public_network_access_enabled = false
}
`;
  return { hcl, findings };
}

function emitSearch(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'search-keyless', pillar: 'Security', service: svc.name, setting: 'Local auth disabled + managed identity', terraformAttribute: 'local_authentication_enabled = false / identity' },
  ];
  const hcl = `
# ${svc.name} — Azure AI Search (RBAC/keyless, managed identity, no public network)
resource "azurerm_search_service" "${ctx.sym}" {
  name                          = "\${var.name_prefix}-${ctx.nameExpr}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  sku                           = "standard"
  local_authentication_enabled  = false
  public_network_access_enabled = false

  identity {
    type = "SystemAssigned"
  }
}
`;
  return { hcl, findings, identityPrincipalExpr: `azurerm_search_service.${ctx.sym}.identity[0].principal_id` };
}

function emitContainerApps(svc: TfService, ctx: EmitCtx): Emitted {
  const envSym = `${ctx.sym}_env`;
  const findings: TfFindingResolved[] = [
    { ruleId: 'aca-ingress-secure', pillar: 'Security', service: svc.name, setting: 'Ingress requires HTTPS + managed identity', terraformAttribute: 'ingress.allow_insecure_connections = false / identity' },
  ];
  const hcl = `
# ${svc.name} — Container Apps (managed environment + app, HTTPS-only ingress, managed identity)
resource "azurerm_log_analytics_workspace" "${envSym}_law" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}-env-law"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "${envSym}" {
  name                       = "\${var.name_prefix}-${ctx.nameExpr}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.${envSym}_law.id
}

resource "azurerm_container_app" "${ctx.sym}" {
  name                         = "\${var.name_prefix}-${ctx.nameExpr}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.${envSym}.id
  revision_mode                = "Single"

  identity {
    type = "SystemAssigned"
  }

  ingress {
    external_enabled           = true
    target_port                = 8080
    allow_insecure_connections = false
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    container {
      name   = "${ctx.nameExpr}"
      image  = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
      cpu    = 0.5
      memory = "1Gi"
    }
    min_replicas = 1
    max_replicas = 10
  }
}
`;
  return { hcl, findings, identityPrincipalExpr: `azurerm_container_app.${ctx.sym}.identity[0].principal_id` };
}

function emitMonitoring(svc: TfService, ctx: EmitCtx): Emitted {
  const hcl = `
# ${svc.name} — Log Analytics workspace + Application Insights (workspace-based)
resource "azurerm_log_analytics_workspace" "${ctx.sym}_law" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}-law"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_application_insights" "${ctx.sym}" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}-ai"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.${ctx.sym}_law.id
  application_type    = "web"
}
`;
  return { hcl, findings: [] };
}

type Emitter = (svc: TfService, ctx: EmitCtx) => Emitted;

function emitSqlDatabase(svc: TfService, ctx: EmitCtx): Emitted {
  const findings: TfFindingResolved[] = [
    { ruleId: 'sql-tde', pillar: 'Security', service: svc.name, setting: 'Transparent Data Encryption enabled', terraformAttribute: 'transparent_data_encryption_enabled = true' },
    { ruleId: 'sql-auditing', pillar: 'Security', service: svc.name, setting: 'Extended auditing to Log Analytics', terraformAttribute: 'azurerm_mssql_server_extended_auditing_policy' },
  ];
  const hcl = `
# ${svc.name} — Azure SQL (server + database, TDE on, auditing, TLS 1.2, no public network, Entra-only admin)
resource "azurerm_mssql_server" "${ctx.sym}" {
  name                          = "\${var.name_prefix}-${ctx.nameExpr}-${ctx.sym.replace(/_/g, '-')}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false

  azuread_administrator {
    login_username              = "sql-admins"
    # Replace with your Entra ID admin group/user object ID before deploying.
    object_id                   = "00000000-0000-0000-0000-000000000000"
    tenant_id                   = data.azurerm_client_config.current.tenant_id
    azuread_authentication_only = true
  }
}

resource "azurerm_mssql_database" "${ctx.sym}" {
  name                                = "${ctx.nameExpr}-db"
  server_id                           = azurerm_mssql_server.${ctx.sym}.id
  sku_name                            = "S3"
  transparent_data_encryption_enabled = true
}

resource "azurerm_mssql_server_extended_auditing_policy" "${ctx.sym}" {
  server_id              = azurerm_mssql_server.${ctx.sym}.id
  log_monitoring_enabled = true
}
`;
  return { hcl, findings };
}

function emitFrontDoor(svc: TfService, ctx: EmitCtx): Emitted {
  const hcl = `
# ${svc.name} — Azure Front Door (Premium profile; add endpoints/routes + attach the WAF policy)
resource "azurerm_cdn_frontdoor_profile" "${ctx.sym}" {
  name                = "\${var.name_prefix}-${ctx.nameExpr}"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Premium_AzureFrontDoor"
}
`;
  return { hcl, findings: [] };
}

function emitWaf(svc: TfService, ctx: EmitCtx): Emitted {
  const hcl = `
# ${svc.name} — Front Door WAF policy (Prevention mode, Microsoft managed default rule set)
resource "azurerm_cdn_frontdoor_firewall_policy" "${ctx.sym}" {
  name                = replace("\${var.name_prefix}${ctx.nameExpr}", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Premium_AzureFrontDoor"
  enabled             = true
  mode                = "Prevention"

  managed_rule {
    type    = "Microsoft_DefaultRuleSet"
    version = "2.1"
    action  = "Block"
  }
}
`;
  return { hcl, findings: [] };
}

const EMITTERS: Record<string, Emitter> = {
  'App Service': emitAppService,
  'Key Vault': emitKeyVault,
  'Storage Account': emitStorage,
  'Azure Cosmos DB': emitCosmos,
  'Redis Cache': emitRedis,
  'Azure AI Search': emitSearch,
  'Container Apps': emitContainerApps,
  'SQL Database': emitSqlDatabase,
  'Azure Front Door': emitFrontDoor,
  'Web Application Firewall': emitWaf,
};

const MONITORING_KEYS = new Set(['Azure Monitor', 'Application Insights', 'Log Analytics']);

/**
 * Generate Terraform (azurerm) for the given architecture.
 */
export function generateTerraform(params: {
  services: TfService[];
  connections?: TfConnection[];
  projectName?: string;
  location?: string;
}): GenerateTerraformResult {
  const location = params.location ?? 'eastus2';
  const projectName = params.projectName ?? 'workload';
  const namePrefix = (projectName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 11).toLowerCase() || 'workload');

  const findingsResolved: TfFindingResolved[] = [];
  const servicesCovered: string[] = [];
  const servicesGeneric: string[] = [];
  const bodyParts: string[] = [];
  const usedSyms = new Set<string>();
  const identityExprs: { sym: string; expr: string }[] = [];
  let monitoringEmitted = false;
  let keyVaultSym: string | null = null;

  params.services.forEach((svc, i) => {
    const resolved = resolveServiceName(svc.type);
    const catalogKey = resolved && SERVICE_CATALOG[resolved] ? resolved : null;

    let sym = label(svc.name, `svc${i + 1}`);
    while (usedSyms.has(sym)) sym = `${sym}_${i + 1}`;
    usedSyms.add(sym);

    const abbr = catalogKey ? (TYPE_ABBR[catalogKey] ?? label(catalogKey, 'svc')) : 'svc';
    const ctx: EmitCtx = { sym, nameExpr: abbr };

    if (catalogKey && MONITORING_KEYS.has(catalogKey)) {
      if (monitoringEmitted) { servicesCovered.push(svc.name); return; }
      bodyParts.push(emitMonitoring(svc, ctx).hcl);
      servicesCovered.push(svc.name);
      monitoringEmitted = true;
      return;
    }

    const emitter = catalogKey ? EMITTERS[catalogKey] : undefined;
    if (emitter) {
      const em = emitter(svc, ctx);
      bodyParts.push(em.hcl);
      findingsResolved.push(...em.findings);
      servicesCovered.push(svc.name);
      if (em.identityPrincipalExpr) identityExprs.push({ sym, expr: em.identityPrincipalExpr });
      if (catalogKey === 'Key Vault') keyVaultSym = sym;
      return;
    }

    bodyParts.push(
      `\n# ${svc.name} — ${catalogKey ?? svc.type}: no secure-default Terraform template yet.\n# Add the resource definition here with WAF-aligned attributes.\n`,
    );
    servicesGeneric.push(svc.name);
  });

  // Wire keyless auth: grant each managed identity the Key Vault Secrets User
  // role on the vault (resolves the "connection strings vs managed identity"
  // finding), matching the Bicep generator's role assignments.
  let roleAssignments = '';
  if (keyVaultSym && identityExprs.length > 0) {
    roleAssignments = identityExprs
      .map(
        ({ sym, expr }) => `
resource "azurerm_role_assignment" "${sym}_kv_secrets" {
  scope                = azurerm_key_vault.${keyVaultSym}.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = ${expr}
}`,
      )
      .join('\n');
    findingsResolved.push({
      ruleId: 'appsvc-managed-identity',
      pillar: 'Security',
      service: '(managed-identity wiring)',
      setting: 'Key Vault Secrets User role granted to managed identities',
      terraformAttribute: 'azurerm_role_assignment (Key Vault Secrets User)',
    });
  }

  const header = `# ============================================================================
# Generated by Azure Architecture Diagram Builder MCP — generate_terraform
# Project: ${projectName}
# Well-Architected secure defaults are pre-set (HTTPS-only, TLS 1.2, managed
# identity, Key Vault soft-delete + purge protection, health checks, autoscale,
# staging slots). Review names/SKUs before deploying. Design-time only.
# ============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "name_prefix" {
  type        = string
  description = "Prefix for generated resource names (3-11 chars recommended)."
  default     = "${namePrefix}"
}

variable "location" {
  type        = string
  description = "Azure region for all resources."
  default     = "${location}"
}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "main" {
  name     = "\${var.name_prefix}-rg"
  location = var.location
}
`;

  const terraform = [header, ...bodyParts, roleAssignments]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n';

  const note = servicesGeneric.length
    ? `Generated azurerm Terraform. ${servicesCovered.length} service(s) with secure defaults; ${servicesGeneric.length} emitted as commented placeholders (no template yet): ${servicesGeneric.join(', ')}.`
    : `Generated azurerm Terraform with secure defaults for all ${servicesCovered.length} supported service(s).`;

  return {
    iacTool: 'terraform',
    terraform,
    findingsResolved,
    servicesCovered,
    servicesGeneric,
    note,
  };
}

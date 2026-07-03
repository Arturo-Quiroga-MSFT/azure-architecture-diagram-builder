// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Bicep generator (P0-2).
 *
 * Emits deployable Bicep from the same {services, connections, groups} shape the
 * other MCP tools use, with Well-Architected secure defaults PRE-SET so the
 * config-level WAF findings that can't be "drawn" in a diagram (see
 * SCOUT/test-1.md) are resolved out of the gate:
 *
 *   - App Service:  httpsOnly, minTlsVersion 1.2, system-assigned managed
 *                   identity, health-check path, autoscale rules, staging slot
 *   - Key Vault:    soft-delete (90d) + purge protection + RBAC authorization
 *   - Storage:      HTTPS-only, TLS 1.2, public blob access disabled
 *   - Cosmos DB:    automatic failover + continuous backup
 *   - Redis:        TLS 1.2 minimum
 *   - AI Search / Container Apps / Log Analytics + App Insights: baseline secure
 *
 * The generator is deterministic and design-time only — it never deploys.
 * It returns the Bicep text plus a structured map of which WAF finding each
 * setting resolves, so an agent (Scout) can explain the hardening.
 *
 * Services without a template emit a clearly-commented placeholder so nothing
 * is silently dropped; those are reported in `servicesGeneric`.
 */

import { resolveServiceName, SERVICE_CATALOG } from './serviceCatalog.js';

export interface BicepService {
  name: string;
  type: string;
  description?: string;
  groupId?: string;
}

export interface BicepConnection {
  from: string;
  to: string;
  label?: string;
}

export interface FindingResolved {
  ruleId: string;
  pillar: string;
  service: string;
  setting: string;
  bicepProperty: string;
}

export interface GenerateBicepResult {
  iacTool: 'bicep' | 'terraform';
  bicep: string;
  findingsResolved: FindingResolved[];
  servicesCovered: string[];
  servicesGeneric: string[];
  note: string;
}

/** Sanitize a display name into a safe Bicep symbolic identifier. */
function symbol(name: string, fallback: string): string {
  const s = name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('');
  const id = s.replace(/^[^a-zA-Z_]/, '_');
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
  'Azure Cognitive Search': 'srch',
  'Container Apps': 'aca',
  'SQL Database': 'sql',
};

type Emitter = (svc: BicepService, ctx: EmitContext) => EmittedResource | null;

interface EmittedResource {
  bicep: string;
  covered: true;
  findings: FindingResolved[];
  /** Symbolic name of a managed-identity-bearing resource (for role wiring). */
  identitySymbol?: string;
}

interface EmitContext {
  sym: string;
  nameExpr: string; // Bicep expression producing the resource name
}

const round = (s: string) => s.replace(/\n{3,}/g, '\n\n');

// ── Per-service Bicep templates with secure defaults ───────────────────

function emitAppService(svc: BicepService, ctx: EmitContext): EmittedResource {
  const planSym = `${ctx.sym}Plan`;
  const findings: FindingResolved[] = [
    { ruleId: 'appsvc-https-only', pillar: 'Security', service: svc.name, setting: 'HTTPS-only + TLS 1.2', bicepProperty: 'httpsOnly / siteConfig.minTlsVersion' },
    { ruleId: 'appsvc-managed-identity', pillar: 'Security', service: svc.name, setting: 'System-assigned managed identity', bicepProperty: "identity.type: 'SystemAssigned'" },
    { ruleId: 'appsvc-health-check', pillar: 'Reliability', service: svc.name, setting: 'Health check path', bicepProperty: 'siteConfig.healthCheckPath' },
    { ruleId: 'appsvc-autoscale', pillar: 'Performance Efficiency', service: svc.name, setting: 'Autoscale rules', bicepProperty: 'Microsoft.Insights/autoscaleSettings' },
    { ruleId: 'appsvc-deploy-slots', pillar: 'Operational Excellence', service: svc.name, setting: 'Staging deployment slot', bicepProperty: 'sites/slots' },
  ];
  const bicep = `
// ${svc.name} — App Service (HTTPS-only, TLS 1.2, managed identity, health check, autoscale, staging slot)
resource ${planSym} 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}-plan'
  location: location
  sku: { name: 'P1v3', tier: 'PremiumV3' }
  properties: { reserved: true }
}

resource ${ctx.sym} 'Microsoft.Web/sites@2023-12-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: ${planSym}.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'FtpsOnly'
      healthCheckPath: '/health'
      http20Enabled: true
    }
  }
}

resource ${ctx.sym}Staging 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: ${ctx.sym}
  name: 'staging'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: ${planSym}.id
    httpsOnly: true
    siteConfig: { minTlsVersion: '1.2', healthCheckPath: '/health' }
  }
}

resource ${ctx.sym}Autoscale 'Microsoft.Insights/autoscaleSettings@2022-10-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}-autoscale'
  location: location
  properties: {
    enabled: true
    targetResourceUri: ${planSym}.id
    profiles: [
      {
        name: 'cpu-based'
        capacity: { minimum: '2', maximum: '10', default: '2' }
        rules: [
          {
            metricTrigger: { metricName: 'CpuPercentage', metricResourceUri: ${planSym}.id, timeGrain: 'PT1M', statistic: 'Average', timeWindow: 'PT5M', timeAggregation: 'Average', operator: 'GreaterThan', threshold: 70 }
            scaleAction: { direction: 'Increase', type: 'ChangeCount', value: '1', cooldown: 'PT5M' }
          }
          {
            metricTrigger: { metricName: 'CpuPercentage', metricResourceUri: ${planSym}.id, timeGrain: 'PT1M', statistic: 'Average', timeWindow: 'PT5M', timeAggregation: 'Average', operator: 'LessThan', threshold: 30 }
            scaleAction: { direction: 'Decrease', type: 'ChangeCount', value: '1', cooldown: 'PT5M' }
          }
        ]
      }
    ]
  }
}
`;
  return { bicep, covered: true, findings, identitySymbol: ctx.sym };
}

function emitKeyVault(svc: BicepService, ctx: EmitContext): EmittedResource {
  const findings: FindingResolved[] = [
    { ruleId: 'kv-soft-delete', pillar: 'Reliability', service: svc.name, setting: 'Soft-delete (90d) + purge protection', bicepProperty: 'enableSoftDelete / softDeleteRetentionInDays / enablePurgeProtection' },
  ];
  const bicep = `
// ${svc.name} — Key Vault (soft-delete 90d, purge protection, RBAC authorization)
resource ${ctx.sym} 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: toLower('\${namePrefix}${ctx.nameExpr}\${uniqueString(resourceGroup().id)}')
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    enableRbacAuthorization: true
    publicNetworkAccess: 'Disabled'
  }
}
`;
  return { bicep, covered: true, findings };
}

function emitStorage(svc: BicepService, ctx: EmitContext): EmittedResource {
  const findings: FindingResolved[] = [
    { ruleId: 'storage-https', pillar: 'Security', service: svc.name, setting: 'HTTPS-only + TLS 1.2', bicepProperty: 'supportsHttpsTrafficOnly / minimumTlsVersion' },
    { ruleId: 'storage-private', pillar: 'Security', service: svc.name, setting: 'Public blob access disabled', bicepProperty: 'allowBlobPublicAccess: false' },
  ];
  const bicep = `
// ${svc.name} — Storage Account (HTTPS-only, TLS 1.2, no public blob access)
resource ${ctx.sym} 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower('\${namePrefix}${ctx.nameExpr}\${uniqueString(resourceGroup().id)}')
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Disabled'
  }
}
`;
  return { bicep, covered: true, findings };
}

function emitCosmos(svc: BicepService, ctx: EmitContext): EmittedResource {
  const findings: FindingResolved[] = [
    { ruleId: 'arch-single-database', pillar: 'Reliability', service: svc.name, setting: 'Automatic failover + continuous backup', bicepProperty: 'enableAutomaticFailover / backupPolicy(Continuous)' },
  ];
  const bicep = `
// ${svc.name} — Cosmos DB (automatic failover, continuous backup, TLS enforced)
resource ${ctx.sym} 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: toLower('\${namePrefix}-${ctx.nameExpr}-\${uniqueString(resourceGroup().id)}')
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: true
    minimalTlsVersion: 'Tls12'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [
      { locationName: location, failoverPriority: 0, isZoneRedundant: true }
    ]
    backupPolicy: { type: 'Continuous', continuousModeProperties: { tier: 'Continuous30Days' } }
  }
}
`;
  return { bicep, covered: true, findings };
}

function emitRedis(svc: BicepService, ctx: EmitContext): EmittedResource {
  const bicep = `
// ${svc.name} — Azure Cache for Redis (TLS 1.2 minimum)
resource ${ctx.sym} 'Microsoft.Cache/redis@2024-03-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}'
  location: location
  properties: {
    sku: { name: 'Standard', family: 'C', capacity: 1 }
    minimumTlsVersion: '1.2'
    enableNonSslPort: false
    publicNetworkAccess: 'Disabled'
  }
}
`;
  return { bicep, covered: true, findings: [] };
}

function emitSearch(svc: BicepService, ctx: EmitContext): EmittedResource {
  const bicep = `
// ${svc.name} — Azure AI Search (system-assigned identity, standard tier)
resource ${ctx.sym} 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: toLower('\${namePrefix}-${ctx.nameExpr}-\${uniqueString(resourceGroup().id)}')
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'standard' }
  properties: {
    replicaCount: 1
    partitionCount: 1
    publicNetworkAccess: 'disabled'
  }
}
`;
  return { bicep, covered: true, findings: [], identitySymbol: ctx.sym };
}

function emitContainerApps(svc: BicepService, ctx: EmitContext): EmittedResource {
  const envSym = `${ctx.sym}Env`;
  const bicep = `
// ${svc.name} — Container Apps (managed environment + app with system identity)
resource ${envSym} 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}-env'
  location: location
  properties: {}
}

resource ${ctx.sym} 'Microsoft.App/containerApps@2024-03-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: ${envSym}.id
    configuration: { ingress: { external: true, targetPort: 8080, transport: 'auto', allowInsecure: false } }
    template: {
      containers: [ { name: '${ctx.sym}', image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest', resources: { cpu: json('0.5'), memory: '1Gi' } } ]
      scale: { minReplicas: 1, maxReplicas: 10 }
    }
  }
}
`;
  return { bicep, covered: true, findings: [], identitySymbol: ctx.sym };
}

function emitMonitoring(svc: BicepService, ctx: EmitContext): EmittedResource {
  const laSym = `${ctx.sym}Workspace`;
  const bicep = `
// ${svc.name} — Log Analytics workspace + Application Insights (workspace-based)
resource ${laSym} 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '\${namePrefix}-${ctx.nameExpr}-law'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource ${ctx.sym} 'Microsoft.Insights/components@2020-02-02' = {
  name: '\${namePrefix}-${ctx.nameExpr}-ai'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: ${laSym}.id }
}
`;
  return { bicep, covered: true, findings: [] };
}

// Map a resolved catalog key → emitter.
const EMITTERS: Record<string, Emitter> = {
  'App Service': emitAppService,
  'Key Vault': emitKeyVault,
  'Storage Account': emitStorage,
  'Azure Cosmos DB': emitCosmos,
  'Redis Cache': emitRedis,
  'Azure Cognitive Search': emitSearch,
  'Container Apps': emitContainerApps,
};

// Monitoring services all share one emitter (first one emits the pair).
const MONITORING_KEYS = new Set(['Azure Monitor', 'Application Insights', 'Log Analytics']);

/**
 * Generate Bicep (or a Terraform stub) for the given architecture.
 */
export function generateBicep(params: {
  services: BicepService[];
  connections?: BicepConnection[];
  projectName?: string;
  location?: string;
  iacTool?: string;
}): GenerateBicepResult {
  const iacTool: 'bicep' | 'terraform' = params.iacTool === 'terraform' ? 'terraform' : 'bicep';
  const location = params.location ?? 'eastus2';
  const projectName = params.projectName ?? 'workload';

  if (iacTool === 'terraform') {
    return {
      iacTool,
      bicep: '',
      findingsResolved: [],
      servicesCovered: [],
      servicesGeneric: params.services.map(s => s.name),
      note: 'Terraform output is not implemented yet (P0-2 focuses on Bicep). Re-run with iacTool: bicep.',
    };
  }

  const findingsResolved: FindingResolved[] = [];
  const servicesCovered: string[] = [];
  const servicesGeneric: string[] = [];
  const identitySymbols: string[] = [];
  const bodyParts: string[] = [];
  const usedSymbols = new Set<string>();
  let monitoringEmitted = false;
  let keyVaultSymbol: string | null = null;

  params.services.forEach((svc, i) => {
    const resolved = resolveServiceName(svc.type);
    const catalogKey = resolved && SERVICE_CATALOG[resolved] ? resolved : null;

    let sym = symbol(svc.name, `svc${i + 1}`);
    while (usedSymbols.has(sym)) sym = `${sym}${i + 1}`;
    usedSymbols.add(sym);

    const abbr = catalogKey ? (TYPE_ABBR[catalogKey] ?? symbol(catalogKey, 'svc')) : 'svc';
    const ctx: EmitContext = { sym, nameExpr: abbr };

    if (catalogKey && MONITORING_KEYS.has(catalogKey)) {
      if (monitoringEmitted) { servicesCovered.push(svc.name); return; }
      const em = emitMonitoring(svc, ctx);
      bodyParts.push(em.bicep);
      servicesCovered.push(svc.name);
      monitoringEmitted = true;
      return;
    }

    const emitter = catalogKey ? EMITTERS[catalogKey] : undefined;
    if (emitter) {
      const em = emitter(svc, ctx);
      if (em) {
        bodyParts.push(em.bicep);
        findingsResolved.push(...em.findings);
        servicesCovered.push(svc.name);
        if (em.identitySymbol) identitySymbols.push(em.identitySymbol);
        if (catalogKey === 'Key Vault') keyVaultSymbol = sym;
        return;
      }
    }

    // No template — emit a clearly-commented placeholder so nothing is dropped.
    bodyParts.push(
      `\n// ${svc.name} — ${catalogKey ?? svc.type}: no secure-default Bicep template yet (P0-2 backlog).\n// Add the resource definition here with WAF-aligned properties.\n`,
    );
    servicesGeneric.push(svc.name);
  });

  // Wire managed-identity access: grant each identity-bearing resource the
  // Key Vault Secrets User role on the vault (demonstrates keyless auth,
  // resolving the "connection strings instead of managed identity" finding).
  let roleAssignments = '';
  if (keyVaultSymbol && identitySymbols.length > 0) {
    const kvSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6';
    roleAssignments = identitySymbols
      .map(
        (idSym) => `
resource ${idSym}KvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(${keyVaultSymbol}.id, ${idSym}.id, '${kvSecretsUser}')
  scope: ${keyVaultSymbol}
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '${kvSecretsUser}')
    principalId: ${idSym}.identity.principalId
    principalType: 'ServicePrincipal'
  }
}`,
      )
      .join('\n');
    findingsResolved.push({
      ruleId: 'appsvc-managed-identity',
      pillar: 'Security',
      service: '(managed-identity wiring)',
      setting: 'Key Vault Secrets User role granted to managed identities',
      bicepProperty: 'Microsoft.Authorization/roleAssignments (Key Vault Secrets User)',
    });
  }

  const header = `// ============================================================================
// Generated by Azure Architecture Diagram Builder MCP — generate_bicep (P0-2)
// Project: ${projectName}
// Well-Architected secure defaults are pre-set (HTTPS-only, TLS 1.2, managed
// identity, Key Vault soft-delete + purge protection, health checks, autoscale,
// staging slots). Review names/SKUs before deploying. Design-time only.
// ============================================================================

targetScope = 'resourceGroup'

@description('Prefix for generated resource names (3-11 chars recommended).')
param namePrefix string = '${projectName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 11).toLowerCase() || 'workload'}'

@description('Azure region for all resources.')
param location string = '${location}'
`;

  const bicep = round([header, ...bodyParts, roleAssignments].join('\n')).trim() + '\n';

  return {
    iacTool,
    bicep,
    findingsResolved,
    servicesCovered,
    servicesGeneric,
    note:
      'Bicep with WAF secure defaults pre-set. Validate with `az bicep build`. Names use namePrefix + uniqueString for global uniqueness; review SKUs/regions before deploying. Services without a template are emitted as commented placeholders (see servicesGeneric).',
  };
}

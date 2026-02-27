// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure Well-Architected Framework (WAF) Rules Knowledge Base
 * 
 * Curated checklist of WAF best practices for Azure services, organized by
 * the five WAF pillars. Used by the rule-based validator to provide instant,
 * deterministic findings before (optionally) handing off to the LLM for
 * contextual analysis.
 * 
 * Sources:
 * - https://learn.microsoft.com/azure/architecture/framework/
 * - https://learn.microsoft.com/azure/well-architected/
 * - Azure Architecture Center service guides
 * 
 * Each rule targets one or more Azure service types (matching the keys in
 * serviceIconMapping.ts) and specifies the pillar, severity, and a concrete
 * recommendation.
 */

export type WafPillar =
  | 'Reliability'
  | 'Security'
  | 'Cost Optimization'
  | 'Operational Excellence'
  | 'Performance Efficiency';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface WafRule {
  id: string;
  pillar: WafPillar;
  severity: Severity;
  category: string;
  /** Short issue description shown in findings */
  issue: string;
  /** Actionable recommendation */
  recommendation: string;
  /**
   * Service types this rule applies to (matched against the service `type`
   * field from the diagram). Use '*' for architecture-wide rules.
   */
  appliesTo: string[];
  /**
   * Optional: rule only fires when a specific architectural pattern is
   * detected (checked by the pattern detector).
   */
  pattern?: string;
}

// ---------------------------------------------------------------------------
// Architecture-wide pattern rules (detected by analyzing connections/topology)
// ---------------------------------------------------------------------------

export const ARCHITECTURE_PATTERN_RULES: WafRule[] = [
  // ── Reliability ──────────────────────────────────────────────────────
  {
    id: 'arch-no-redundancy',
    pillar: 'Reliability',
    severity: 'high',
    category: 'High Availability',
    issue: 'Single-region deployment with no failover capability',
    recommendation: 'Deploy across multiple Azure regions or availability zones. Use Azure Traffic Manager or Azure Front Door for global load balancing and automatic failover.',
    appliesTo: ['*'],
    pattern: 'single-region',
  },
  {
    id: 'arch-single-database',
    pillar: 'Reliability',
    severity: 'high',
    category: 'Data Resilience',
    issue: 'Single database instance without replication or geo-redundancy',
    recommendation: 'Enable geo-replication, read replicas, or active-active configuration for your database to ensure data availability during outages.',
    appliesTo: ['*'],
    pattern: 'single-database',
  },
  {
    id: 'arch-no-caching',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Caching',
    issue: 'No caching layer detected between compute and data tiers',
    recommendation: 'Add Azure Cache for Redis or Azure CDN to reduce database load and improve response times for frequently accessed data.',
    appliesTo: ['*'],
    pattern: 'no-cache',
  },
  {
    id: 'arch-no-monitoring',
    pillar: 'Operational Excellence',
    severity: 'high',
    category: 'Observability',
    issue: 'No monitoring or observability services detected in the architecture',
    recommendation: 'Add Azure Monitor, Application Insights, and Log Analytics to track application health, performance, and diagnose issues proactively.',
    appliesTo: ['*'],
    pattern: 'no-monitoring',
  },
  {
    id: 'arch-no-identity',
    pillar: 'Security',
    severity: 'critical',
    category: 'Identity & Access',
    issue: 'No identity provider or authentication service detected',
    recommendation: 'Add Microsoft Entra ID for centralized authentication and authorization. Use managed identities for service-to-service communication to eliminate credential management.',
    appliesTo: ['*'],
    pattern: 'no-identity',
  },
  {
    id: 'arch-no-waf',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'Public-facing application without Web Application Firewall (WAF)',
    recommendation: 'Deploy Azure Front Door with WAF or Application Gateway with WAF to protect against OWASP Top 10 threats, DDoS, and bot attacks.',
    appliesTo: ['*'],
    pattern: 'no-waf',
  },
  {
    id: 'arch-direct-db-access',
    pillar: 'Security',
    severity: 'critical',
    category: 'Network Security',
    issue: 'Frontend service connects directly to a database without an API layer',
    recommendation: 'Place an API layer (App Service, Functions, or API Management) between frontend and database to enforce access control, input validation, and rate limiting.',
    appliesTo: ['*'],
    pattern: 'direct-db-access',
  },
  {
    id: 'arch-no-secrets-management',
    pillar: 'Security',
    severity: 'high',
    category: 'Secrets Management',
    issue: 'No secrets management service (Key Vault) detected in the architecture',
    recommendation: 'Add Azure Key Vault to centrally manage secrets, certificates, and encryption keys. Reference secrets from Key Vault instead of storing them in app configuration.',
    appliesTo: ['*'],
    pattern: 'no-key-vault',
  },
  {
    id: 'arch-no-backup',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Disaster Recovery',
    issue: 'No backup or disaster recovery service detected',
    recommendation: 'Add Azure Backup or configure point-in-time restore for databases. Define and test your RPO/RTO targets with a documented recovery plan.',
    appliesTo: ['*'],
    pattern: 'no-backup',
  },
  {
    id: 'arch-no-api-gateway',
    pillar: 'Security',
    severity: 'medium',
    category: 'API Security',
    issue: 'Multiple backend services exposed without a centralized API gateway',
    recommendation: 'Add Azure API Management to centralize API exposure, enforce authentication, rate limiting, and provide a unified API surface.',
    appliesTo: ['*'],
    pattern: 'no-api-gateway',
  },
];

// ---------------------------------------------------------------------------
// Per-service WAF rules
// ---------------------------------------------------------------------------

export const SERVICE_SPECIFIC_RULES: WafRule[] = [
  // ── App Service ──────────────────────────────────────────────────────
  {
    id: 'appsvc-managed-identity',
    pillar: 'Security',
    severity: 'high',
    category: 'Identity & Access',
    issue: 'App Service should use managed identity instead of connection strings',
    recommendation: 'Enable system-assigned or user-assigned managed identity on App Service and use it for authenticating to Azure SQL, Key Vault, Storage, and other Azure services.',
    appliesTo: ['App Service'],
  },
  {
    id: 'appsvc-https-only',
    pillar: 'Security',
    severity: 'critical',
    category: 'Transport Security',
    issue: 'App Service should enforce HTTPS-only traffic',
    recommendation: 'Enable "HTTPS Only" in App Service configuration. Configure minimum TLS version to 1.2. Redirect all HTTP traffic to HTTPS.',
    appliesTo: ['App Service'],
  },
  {
    id: 'appsvc-autoscale',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Scaling',
    issue: 'App Service should have autoscale rules configured',
    recommendation: 'Configure autoscale rules based on CPU, memory, or HTTP queue length. Use Standard or Premium tier for production workloads with autoscaling support.',
    appliesTo: ['App Service'],
  },
  {
    id: 'appsvc-deploy-slots',
    pillar: 'Operational Excellence',
    severity: 'medium',
    category: 'Deployment Strategy',
    issue: 'App Service should use deployment slots for zero-downtime deployments',
    recommendation: 'Use staging deployment slots with swap operations for zero-downtime deployments. Test in staging before swapping to production.',
    appliesTo: ['App Service'],
  },
  {
    id: 'appsvc-health-check',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Health Monitoring',
    issue: 'App Service should have a health check endpoint configured',
    recommendation: 'Configure the Health Check feature in App Service to automatically remove unhealthy instances from the load balancer rotation.',
    appliesTo: ['App Service'],
  },

  // ── Azure Functions ──────────────────────────────────────────────────
  {
    id: 'func-consumption-plan',
    pillar: 'Cost Optimization',
    severity: 'medium',
    category: 'Compute Pricing',
    issue: 'Azure Functions on Consumption plan may have cold start latency',
    recommendation: 'For latency-sensitive workloads, consider Premium plan with pre-warmed instances. For predictable workloads, Consumption plan offers the best cost efficiency.',
    appliesTo: ['Functions'],
  },
  {
    id: 'func-managed-identity',
    pillar: 'Security',
    severity: 'high',
    category: 'Identity & Access',
    issue: 'Azure Functions should use managed identity for Azure service access',
    recommendation: 'Enable managed identity on Function Apps instead of storing connection strings or API keys. Use Key Vault references for any required secrets.',
    appliesTo: ['Functions'],
  },

  // ── Azure Kubernetes Service (AKS) ──────────────────────────────────
  {
    id: 'aks-rbac',
    pillar: 'Security',
    severity: 'high',
    category: 'Access Control',
    issue: 'AKS cluster should have Azure RBAC and Entra ID integration enabled',
    recommendation: 'Enable Azure RBAC for Kubernetes and integrate with Microsoft Entra ID for centralized authentication. Use namespace-level RBAC for workload isolation.',
    appliesTo: ['Kubernetes Service'],
  },
  {
    id: 'aks-network-policy',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'AKS should have network policies enabled for pod-to-pod traffic control',
    recommendation: 'Enable Azure CNI with network policies (Calico or Azure) to restrict pod-to-pod communication. Implement zero-trust network segmentation.',
    appliesTo: ['Kubernetes Service'],
  },
  {
    id: 'aks-autoscaler',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Scaling',
    issue: 'AKS should have cluster autoscaler and horizontal pod autoscaler enabled',
    recommendation: 'Enable the cluster autoscaler for node-level scaling and configure HPA for pod-level scaling. Set appropriate resource requests and limits.',
    appliesTo: ['Kubernetes Service'],
  },
  {
    id: 'aks-private-cluster',
    pillar: 'Security',
    severity: 'medium',
    category: 'Network Security',
    issue: 'AKS API server should not be publicly accessible in production',
    recommendation: 'Use a private AKS cluster with private API server endpoint. Access the cluster through Azure Bastion, VPN, or ExpressRoute.',
    appliesTo: ['Kubernetes Service'],
  },
  {
    id: 'aks-monitoring',
    pillar: 'Operational Excellence',
    severity: 'medium',
    category: 'Observability',
    issue: 'AKS should have Container Insights enabled for monitoring',
    recommendation: 'Enable Azure Monitor Container Insights for real-time performance monitoring, log collection, and alerting on AKS cluster health.',
    appliesTo: ['Kubernetes Service'],
  },

  // ── Azure SQL Database ────────────────────────────────────────────────
  {
    id: 'sql-tde',
    pillar: 'Security',
    severity: 'critical',
    category: 'Data Protection',
    issue: 'Azure SQL should have Transparent Data Encryption (TDE) enabled',
    recommendation: 'Ensure TDE is enabled (it is by default). For enhanced security, use customer-managed keys stored in Azure Key Vault.',
    appliesTo: ['SQL Database'],
  },
  {
    id: 'sql-auditing',
    pillar: 'Security',
    severity: 'high',
    category: 'Auditing',
    issue: 'Azure SQL should have auditing enabled to track database events',
    recommendation: 'Enable Azure SQL auditing and send audit logs to Log Analytics workspace or Storage Account. Configure threat detection alerts.',
    appliesTo: ['SQL Database'],
  },
  {
    id: 'sql-geo-replication',
    pillar: 'Reliability',
    severity: 'high',
    category: 'High Availability',
    issue: 'Azure SQL should have geo-replication or failover groups configured for production',
    recommendation: 'Configure active geo-replication or auto-failover groups for cross-region disaster recovery. Use zone-redundant deployments for in-region availability.',
    appliesTo: ['SQL Database'],
  },
  {
    id: 'sql-private-endpoint',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'Azure SQL should use private endpoints instead of public access',
    recommendation: 'Disable public network access and use Azure Private Link/Private Endpoints to access Azure SQL securely over the Azure backbone network.',
    appliesTo: ['SQL Database'],
  },

  // ── Azure Cosmos DB ────────────────────────────────────────────────────
  {
    id: 'cosmos-multi-region',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'High Availability',
    issue: 'Cosmos DB should leverage multi-region writes for global applications',
    recommendation: 'Enable multi-region writes in Cosmos DB for active-active global distribution. Configure automatic failover with prioritized regions.',
    appliesTo: ['Azure Cosmos DB'],
  },
  {
    id: 'cosmos-partition-key',
    pillar: 'Performance Efficiency',
    severity: 'high',
    category: 'Data Partitioning',
    issue: 'Cosmos DB performance depends critically on partition key design',
    recommendation: 'Choose a partition key with high cardinality and even distribution. Avoid hot partitions by ensuring queries filter on the partition key.',
    appliesTo: ['Azure Cosmos DB'],
  },
  {
    id: 'cosmos-consistency',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Data Consistency',
    issue: 'Cosmos DB consistency level should be chosen based on application requirements',
    recommendation: 'Use Session consistency for most applications (default). Use Strong consistency only when linearizability is required, as it impacts latency and cost.',
    appliesTo: ['Azure Cosmos DB'],
  },
  {
    id: 'cosmos-provisioned-throughput',
    pillar: 'Cost Optimization',
    severity: 'medium',
    category: 'Compute Pricing',
    issue: 'Cosmos DB throughput model should match workload patterns',
    recommendation: 'Use autoscale throughput for variable workloads and provisioned throughput for predictable workloads. Consider serverless for dev/test and intermittent workloads.',
    appliesTo: ['Azure Cosmos DB'],
  },

  // ── PostgreSQL / MySQL ────────────────────────────────────────────────
  {
    id: 'pg-ha',
    pillar: 'Reliability',
    severity: 'high',
    category: 'High Availability',
    issue: 'Azure Database for PostgreSQL/MySQL should have HA enabled for production',
    recommendation: 'Enable zone-redundant high availability with automatic failover. Use read replicas to offload read-heavy workloads.',
    appliesTo: ['PostgreSQL', 'MySQL'],
  },
  {
    id: 'pg-private-access',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'Database should use private access (VNet integration or Private Endpoint)',
    recommendation: 'Use VNet integration or Private Endpoints for secure database access. Disable public access and use Azure Private Link.',
    appliesTo: ['PostgreSQL', 'MySQL'],
  },
  {
    id: 'pg-backup-retention',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Disaster Recovery',
    issue: 'Database backup retention should be configured according to RPO requirements',
    recommendation: 'Configure backup retention period (up to 35 days) and enable geo-redundant backup storage for cross-region recovery scenarios.',
    appliesTo: ['PostgreSQL', 'MySQL'],
  },

  // ── Storage Account ────────────────────────────────────────────────────
  {
    id: 'storage-https',
    pillar: 'Security',
    severity: 'critical',
    category: 'Transport Security',
    issue: 'Storage Account should require secure transfer (HTTPS)',
    recommendation: 'Enable "Secure transfer required" on Storage Accounts. Set minimum TLS version to 1.2. Disable shared key access when possible.',
    appliesTo: ['Storage Account', 'Data Lake Storage'],
  },
  {
    id: 'storage-redundancy',
    pillar: 'Reliability',
    severity: 'high',
    category: 'Data Resilience',
    issue: 'Storage Account should use appropriate redundancy level',
    recommendation: 'Use GRS or RA-GRS for production data that requires cross-region protection. Use ZRS for in-region zone redundancy. LRS is only suitable for non-critical data.',
    appliesTo: ['Storage Account', 'Data Lake Storage'],
  },
  {
    id: 'storage-private-endpoint',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'Storage Account should use private endpoints for production workloads',
    recommendation: 'Disable public blob access. Use Azure Private Endpoints and configure firewall rules to restrict access to specific VNets and IP ranges.',
    appliesTo: ['Storage Account', 'Data Lake Storage'],
  },
  {
    id: 'storage-lifecycle',
    pillar: 'Cost Optimization',
    severity: 'medium',
    category: 'Storage Tiering',
    issue: 'Storage Account should have lifecycle management policies for cost optimization',
    recommendation: 'Configure lifecycle management rules to move infrequently accessed blobs to Cool or Archive tiers automatically. Delete expired data.',
    appliesTo: ['Storage Account', 'Data Lake Storage'],
  },

  // ── Azure Front Door ──────────────────────────────────────────────────
  {
    id: 'afd-waf-policy',
    pillar: 'Security',
    severity: 'high',
    category: 'Web Protection',
    issue: 'Azure Front Door should have WAF policy attached',
    recommendation: 'Attach a WAF policy with managed rulesets (OWASP, Microsoft Default) to Azure Front Door. Enable bot protection and rate limiting.',
    appliesTo: ['Azure Front Door'],
  },
  {
    id: 'afd-caching',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Caching',
    issue: 'Azure Front Door should leverage caching for static content',
    recommendation: 'Configure caching rules in Azure Front Door for static assets to reduce origin load and improve global response times.',
    appliesTo: ['Azure Front Door'],
  },

  // ── Application Gateway ──────────────────────────────────────────────
  {
    id: 'appgw-waf',
    pillar: 'Security',
    severity: 'high',
    category: 'Web Protection',
    issue: 'Application Gateway should use WAF v2 SKU for production',
    recommendation: 'Use Application Gateway WAF v2 SKU with managed rulesets enabled. Configure custom rules for application-specific protection.',
    appliesTo: ['Application Gateway'],
  },
  {
    id: 'appgw-autoscale',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Scaling',
    issue: 'Application Gateway v2 should have autoscaling configured',
    recommendation: 'Configure autoscaling with minimum and maximum instance counts. Avoid fixed instance count which may lead to under- or over-provisioning.',
    appliesTo: ['Application Gateway'],
  },

  // ── Virtual Machines ──────────────────────────────────────────────────
  {
    id: 'vm-availability',
    pillar: 'Reliability',
    severity: 'high',
    category: 'High Availability',
    issue: 'VMs should use availability sets or availability zones for production',
    recommendation: 'Deploy VMs across availability zones for 99.99% SLA. Use Virtual Machine Scale Sets for automatic scaling and zone distribution.',
    appliesTo: ['Virtual Machines'],
  },
  {
    id: 'vm-managed-disks',
    pillar: 'Reliability',
    severity: 'high',
    category: 'Storage',
    issue: 'VMs should use managed disks with appropriate redundancy',
    recommendation: 'Use managed disks (Premium SSD for production). Enable Azure Backup for VM disaster recovery. Consider Ultra Disk for I/O-intensive workloads.',
    appliesTo: ['Virtual Machines'],
  },
  {
    id: 'vm-update-management',
    pillar: 'Operational Excellence',
    severity: 'medium',
    category: 'Patch Management',
    issue: 'VMs should have automated update/patch management configured',
    recommendation: 'Use Azure Update Manager for automated OS patching. Schedule maintenance windows to minimize impact on production workloads.',
    appliesTo: ['Virtual Machines'],
  },
  {
    id: 'vm-right-sizing',
    pillar: 'Cost Optimization',
    severity: 'medium',
    category: 'Compute Pricing',
    issue: 'VMs should be right-sized based on actual utilization',
    recommendation: 'Use Azure Advisor recommendations to right-size VMs. Consider reserved instances for predictable workloads (up to 72% savings).',
    appliesTo: ['Virtual Machines'],
  },

  // ── Key Vault ──────────────────────────────────────────────────────────
  {
    id: 'kv-soft-delete',
    pillar: 'Reliability',
    severity: 'high',
    category: 'Data Protection',
    issue: 'Key Vault should have soft-delete and purge protection enabled',
    recommendation: 'Enable soft-delete (enabled by default) and purge protection to prevent accidental or malicious deletion of secrets, keys, and certificates.',
    appliesTo: ['Key Vault'],
  },
  {
    id: 'kv-access-policies',
    pillar: 'Security',
    severity: 'high',
    category: 'Access Control',
    issue: 'Key Vault should use Azure RBAC instead of access policies',
    recommendation: 'Use Azure RBAC for Key Vault data plane access instead of vault access policies. Apply principle of least privilege for secret, key, and certificate permissions.',
    appliesTo: ['Key Vault'],
  },
  {
    id: 'kv-private-endpoint',
    pillar: 'Security',
    severity: 'medium',
    category: 'Network Security',
    issue: 'Key Vault should use private endpoints in production',
    recommendation: 'Disable public access and use Azure Private Endpoints for Key Vault access. Configure firewall rules to allow only necessary VNets.',
    appliesTo: ['Key Vault'],
  },

  // ── Azure OpenAI ──────────────────────────────────────────────────────
  {
    id: 'aoai-content-filtering',
    pillar: 'Security',
    severity: 'high',
    category: 'AI Safety',
    issue: 'Azure OpenAI should have content filtering enabled',
    recommendation: 'Enable and configure content filtering policies for Azure OpenAI deployments. Monitor and review flagged content regularly.',
    appliesTo: ['Azure OpenAI'],
  },
  {
    id: 'aoai-rate-limiting',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Throttling',
    issue: 'Azure OpenAI should have rate limiting and retry policies configured',
    recommendation: 'Implement exponential backoff retry logic. Use provisioned throughput units (PTU) for predictable latency. Consider load balancing across multiple deployments.',
    appliesTo: ['Azure OpenAI'],
  },
  {
    id: 'aoai-private-endpoint',
    pillar: 'Security',
    severity: 'medium',
    category: 'Network Security',
    issue: 'Azure OpenAI should use private endpoints for secure access',
    recommendation: 'Disable public network access and use Azure Private Endpoints. Use managed identity for authentication instead of API keys.',
    appliesTo: ['Azure OpenAI'],
  },

  // ── API Management ────────────────────────────────────────────────────
  {
    id: 'apim-policies',
    pillar: 'Security',
    severity: 'high',
    category: 'API Security',
    issue: 'API Management should enforce authentication, rate limiting, and validation policies',
    recommendation: 'Configure JWT validation, rate limiting, IP filtering, and request/response validation policies. Use OAuth 2.0 for API authorization.',
    appliesTo: ['API Management'],
  },
  {
    id: 'apim-caching',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Caching',
    issue: 'API Management should use response caching for frequently accessed APIs',
    recommendation: 'Enable response caching policies for GET requests with stable responses. Use external cache (Redis) for high-volume scenarios.',
    appliesTo: ['API Management'],
  },

  // ── Service Bus ────────────────────────────────────────────────────────
  {
    id: 'sb-premium',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Messaging Reliability',
    issue: 'Service Bus should use Premium tier for production workloads',
    recommendation: 'Use Service Bus Premium tier for production — it provides dedicated resources, zone redundancy, large message support, and geo-disaster recovery.',
    appliesTo: ['Service Bus'],
  },
  {
    id: 'sb-dead-letter',
    pillar: 'Operational Excellence',
    severity: 'medium',
    category: 'Error Handling',
    issue: 'Service Bus should have dead-letter queue monitoring configured',
    recommendation: 'Monitor dead-letter queues with Azure Monitor alerts. Implement dead-letter processing logic to handle poison messages.',
    appliesTo: ['Service Bus'],
  },

  // ── Event Hubs ────────────────────────────────────────────────────────
  {
    id: 'eh-partitions',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Throughput',
    issue: 'Event Hubs partition count should match expected throughput requirements',
    recommendation: 'Set partition count based on expected downstream consumer parallelism. Partitions cannot be changed after creation — plan for peak throughput.',
    appliesTo: ['Event Hubs'],
  },
  {
    id: 'eh-capture',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Data Retention',
    issue: 'Event Hubs should have Capture enabled for long-term event storage',
    recommendation: 'Enable Event Hubs Capture to automatically archive events to Azure Blob Storage or Data Lake for compliance and replay scenarios.',
    appliesTo: ['Event Hubs'],
  },

  // ── Container Apps ────────────────────────────────────────────────────
  {
    id: 'aca-scaling',
    pillar: 'Performance Efficiency',
    severity: 'medium',
    category: 'Scaling',
    issue: 'Container Apps should have scaling rules configured',
    recommendation: 'Configure KEDA-based scaling rules (HTTP concurrent requests, queue length, CPU/memory) with appropriate min/max replicas.',
    appliesTo: ['Container Apps'],
  },
  {
    id: 'aca-managed-identity',
    pillar: 'Security',
    severity: 'high',
    category: 'Identity & Access',
    issue: 'Container Apps should use managed identity for Azure service access',
    recommendation: 'Enable system-assigned or user-assigned managed identity. Avoid storing secrets in environment variables — use managed identity or Key Vault references.',
    appliesTo: ['Container Apps'],
  },

  // ── Virtual Network ───────────────────────────────────────────────────
  {
    id: 'vnet-nsg',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'VNet subnets should have Network Security Groups (NSGs) attached',
    recommendation: 'Attach NSGs to all subnets with deny-by-default rules. Enable NSG flow logs for traffic auditing and anomaly detection.',
    appliesTo: ['Virtual Network'],
  },
  {
    id: 'vnet-segmentation',
    pillar: 'Security',
    severity: 'medium',
    category: 'Network Isolation',
    issue: 'VNet should use subnet segmentation for workload isolation',
    recommendation: 'Separate workloads into dedicated subnets (web, app, data tiers). Use NSGs and Azure Firewall to control traffic between segments.',
    appliesTo: ['Virtual Network'],
  },

  // ── Redis Cache ───────────────────────────────────────────────────────
  {
    id: 'redis-premium',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'High Availability',
    issue: 'Azure Cache for Redis should use Premium or Enterprise tier for production',
    recommendation: 'Use Premium tier for zone redundancy, clustering, and data persistence. Enterprise tier offers active geo-replication for global applications.',
    appliesTo: ['Redis Cache'],
  },
  {
    id: 'redis-private',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'Azure Cache for Redis should use private endpoints',
    recommendation: 'Disable public access. Use Private Endpoints or VNet injection (Premium tier) to ensure Redis is only accessible from your virtual network.',
    appliesTo: ['Redis Cache'],
  },

  // ── Azure Firewall ───────────────────────────────────────────────────
  {
    id: 'fw-threat-intel',
    pillar: 'Security',
    severity: 'high',
    category: 'Threat Protection',
    issue: 'Azure Firewall should have threat intelligence-based filtering enabled',
    recommendation: 'Enable threat intelligence-based filtering in "Alert and deny" mode. Use Azure Firewall Premium for TLS inspection and IDPS capabilities.',
    appliesTo: ['Azure Firewall'],
  },

  // ── Static Web Apps ───────────────────────────────────────────────────
  {
    id: 'swa-custom-domain',
    pillar: 'Security',
    severity: 'medium',
    category: 'Transport Security',
    issue: 'Static Web Apps should use a custom domain with managed SSL certificate',
    recommendation: 'Configure a custom domain with the free managed SSL certificate. Static Web Apps automatically enforce HTTPS.',
    appliesTo: ['Static Web Apps'],
  },

  // ── IoT Hub ──────────────────────────────────────────────────────────
  {
    id: 'iot-dps',
    pillar: 'Operational Excellence',
    severity: 'medium',
    category: 'Device Management',
    issue: 'IoT Hub should use Device Provisioning Service for scalable enrollment',
    recommendation: 'Use IoT Hub Device Provisioning Service (DPS) for zero-touch, at-scale device provisioning with certificate-based authentication.',
    appliesTo: ['IoT Hub'],
  },
  {
    id: 'iot-security',
    pillar: 'Security',
    severity: 'high',
    category: 'IoT Security',
    issue: 'IoT Hub should use per-device authentication with X.509 certificates',
    recommendation: 'Use X.509 certificate authentication instead of symmetric keys. Enable Microsoft Defender for IoT for threat detection.',
    appliesTo: ['IoT Hub'],
  },

  // ── Logic Apps ────────────────────────────────────────────────────────
  {
    id: 'logic-error-handling',
    pillar: 'Reliability',
    severity: 'medium',
    category: 'Error Handling',
    issue: 'Logic Apps should have retry policies and error handling configured',
    recommendation: 'Configure retry policies on HTTP actions. Use Run After settings for error handling branches. Implement dead-letter patterns for failed messages.',
    appliesTo: ['Logic Apps'],
  },

  // ── Data Factory ──────────────────────────────────────────────────────
  {
    id: 'adf-managed-vnet',
    pillar: 'Security',
    severity: 'high',
    category: 'Network Security',
    issue: 'Data Factory should use managed virtual network for integration runtime',
    recommendation: 'Use managed virtual network integration runtime with private endpoints to securely access data stores without exposing them publicly.',
    appliesTo: ['Data Factory'],
  },

  // ── Azure Monitor / App Insights / Log Analytics ──────────────────────
  {
    id: 'monitor-alerts',
    pillar: 'Operational Excellence',
    severity: 'medium',
    category: 'Alerting',
    issue: 'Azure Monitor should have actionable alert rules configured',
    recommendation: 'Configure metric alerts, log alerts, and activity log alerts for critical services. Use action groups with appropriate notification channels (email, Teams, PagerDuty).',
    appliesTo: ['Azure Monitor', 'Application Insights', 'Log Analytics'],
  },
  {
    id: 'monitor-retention',
    pillar: 'Cost Optimization',
    severity: 'low',
    category: 'Data Retention',
    issue: 'Log Analytics workspace retention should balance cost and compliance needs',
    recommendation: 'Set workspace retention period based on compliance requirements (default 30 days, max 730 days). Use Basic logs tier for high-volume, low-query data.',
    appliesTo: ['Log Analytics'],
  },

  // ── Microsoft Entra ID ────────────────────────────────────────────────
  {
    id: 'entra-mfa',
    pillar: 'Security',
    severity: 'critical',
    category: 'Authentication',
    issue: 'Microsoft Entra ID should enforce MFA for all users',
    recommendation: 'Enable MFA for all users via Conditional Access policies. Use phishing-resistant methods (FIDO2, Windows Hello) for privileged accounts.',
    appliesTo: ['Microsoft Entra ID'],
  },
  {
    id: 'entra-conditional-access',
    pillar: 'Security',
    severity: 'high',
    category: 'Access Control',
    issue: 'Microsoft Entra ID should have Conditional Access policies configured',
    recommendation: 'Implement Conditional Access policies for location-based, device-based, and risk-based access control. Block legacy authentication protocols.',
    appliesTo: ['Microsoft Entra ID'],
  },
];

/**
 * All WAF rules combined.
 */
export const ALL_WAF_RULES: WafRule[] = [
  ...ARCHITECTURE_PATTERN_RULES,
  ...SERVICE_SPECIFIC_RULES,
];

/**
 * Get all rules applicable to a specific service type.
 */
export function getRulesForService(serviceType: string): WafRule[] {
  return SERVICE_SPECIFIC_RULES.filter(rule =>
    rule.appliesTo.some(t =>
      t.toLowerCase() === serviceType.toLowerCase() || t === '*'
    )
  );
}

/**
 * Get all architecture-wide pattern rules.
 */
export function getPatternRules(): WafRule[] {
  return ARCHITECTURE_PATTERN_RULES;
}

/**
 * Get rules filtered by pillar.
 */
export function getRulesByPillar(pillar: WafPillar): WafRule[] {
  return ALL_WAF_RULES.filter(rule => rule.pillar === pillar);
}

/**
 * Summary statistics for the knowledge base.
 */
export function getKnowledgeBaseStats() {
  const servicesCovered = new Set(SERVICE_SPECIFIC_RULES.flatMap(r => r.appliesTo));
  const byPillar = ALL_WAF_RULES.reduce((acc, rule) => {
    acc[rule.pillar] = (acc[rule.pillar] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalRules: ALL_WAF_RULES.length,
    patternRules: ARCHITECTURE_PATTERN_RULES.length,
    serviceRules: SERVICE_SPECIFIC_RULES.length,
    servicesCovered: servicesCovered.size,
    byPillar,
  };
}

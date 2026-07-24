// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deployment guide generator.
 *
 * Produces a step-by-step Markdown deployment runbook for an architecture:
 * prerequisites, auth, resource group, IaC deploy (Bicep or Terraform),
 * a post-deploy config-hardening checklist derived from the WAF service-level
 * findings, per-service smoke tests, and teardown.
 *
 * Deterministic, design-time only — it never deploys. Pairs with
 * generate_bicep / generate_terraform (which emit the IaC this guide deploys).
 */

import { detectWafPatterns, groupFindingsByPillar, type ServiceInput, type ConnectionInput } from './wafDetector.js';
import { resolveServiceName } from './serviceCatalog.js';

export interface GuideService {
  name: string;
  type: string;
  groupId?: string;
}

export interface GenerateGuideResult {
  markdown: string;
  iacTool: 'bicep' | 'terraform';
  steps: number;
  checklistItems: number;
}

/** Per-service post-deploy smoke test hints (best-effort by resolved type). */
const SMOKE_TESTS: Record<string, string> = {
  'App Service': 'Browse the app URL; confirm HTTPS redirect and `/health` returns 200.',
  'Container Apps': 'Curl the ingress FQDN over HTTPS; confirm the revision is running.',
  'Azure Kubernetes Service': 'Run `kubectl get nodes` and confirm all nodes are Ready.',
  'Key Vault': 'Confirm RBAC role assignments resolved: `az keyvault secret list` with your identity.',
  'Storage Account': 'Confirm public access is blocked: anonymous blob GET should 409/403.',
  'Azure Cosmos DB': 'Open Data Explorer; confirm the account shows continuous backup + failover.',
  'SQL Database': 'Connect with a least-privilege identity; confirm TDE and auditing are on.',
  'Redis Cache': 'Connect over TLS 6380; confirm the non-SSL 6379 port is refused.',
  'Azure AI Search': 'Query the search endpoint with an AAD token (keys disabled).',
  'API Management': 'Call a published API through the gateway; confirm the WAF/policy applies.',
  'Azure OpenAI': 'Send a completion request via managed identity; confirm no key is embedded.',
  'Application Insights': 'Confirm telemetry is arriving in the Live Metrics blade.',
  'Azure Monitor': 'Confirm diagnostic settings stream to the Log Analytics workspace.',
};

function bicepDeploySteps(projectName: string, location: string): string {
  return `### 4. Deploy the infrastructure (Bicep)

Save the output of \`generate_bicep\` as \`main.bicep\`, then:

\`\`\`bash
# Optional: validate / preview changes first
az deployment group what-if \\
  --resource-group "${projectName}-rg" \\
  --template-file main.bicep \\
  --parameters namePrefix=${projectName} location=${location}

# Deploy
az deployment group create \\
  --resource-group "${projectName}-rg" \\
  --template-file main.bicep \\
  --parameters namePrefix=${projectName} location=${location}
\`\`\``;
}

function terraformDeploySteps(projectName: string, location: string): string {
  return `### 4. Deploy the infrastructure (Terraform)

Save the output of \`generate_terraform\` as \`main.tf\`, then:

\`\`\`bash
terraform init
terraform plan -var "name_prefix=${projectName}" -var "location=${location}" -out tfplan
terraform apply tfplan
\`\`\`

> The generated config already targets the \`azurerm\` provider and creates its
> own resource group (\`${projectName}-rg\`), so you can skip the manual
> resource-group step above when deploying with Terraform.`;
}

/**
 * Generate a Markdown deployment guide for the architecture.
 */
export function generateDeploymentGuide(params: {
  services: GuideService[];
  connections?: ConnectionInput[];
  projectName?: string;
  location?: string;
  iacTool?: string;
}): GenerateGuideResult {
  const iacTool: 'bicep' | 'terraform' = params.iacTool === 'terraform' ? 'terraform' : 'bicep';
  const location = params.location ?? 'eastus2';
  const rawName = params.projectName ?? 'workload';
  const projectName = rawName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20).toLowerCase() || 'workload';

  // Derive the post-deploy config checklist from the WAF service-level findings
  // (these are the settings IaC pre-sets — the guide tells the operator to
  // verify them after deploy).
  const svcInputs: ServiceInput[] = params.services.map(s => ({ name: s.name, type: s.type }));
  const detection = detectWafPatterns(svcInputs, params.connections ?? []);
  const grouped = groupFindingsByPillar(detection.serviceFindings);

  const checklistLines: string[] = [];
  let checklistItems = 0;
  for (const [pillar, findings] of Object.entries(grouped)) {
    checklistLines.push(`\n**${pillar}**`);
    for (const f of findings) {
      checklistItems++;
      const where = f.resources && f.resources.length ? ` _(‑${f.resources.join(', ')})_` : '';
      checklistLines.push(`- [ ] ${f.recommendation}${where}`);
    }
  }
  if (checklistItems === 0) checklistLines.push('- [ ] No config-level findings detected — verify baseline security settings.');

  // Per-service smoke tests (deduped by resolved catalog type).
  const smokeSeen = new Set<string>();
  const smokeLines: string[] = [];
  for (const s of params.services) {
    const key = resolveServiceName(s.type) ?? s.type;
    const hint = SMOKE_TESTS[key];
    if (hint && !smokeSeen.has(key)) {
      smokeSeen.add(key);
      smokeLines.push(`- **${s.name}** (${key}): ${hint}`);
    }
  }
  if (smokeLines.length === 0) smokeLines.push('- Verify each resource reports Healthy in the Azure Portal.');

  const deploySteps = iacTool === 'terraform'
    ? terraformDeploySteps(projectName, location)
    : bicepDeploySteps(projectName, location);

  const groupCount = new Set(params.services.map(s => s.groupId).filter(Boolean)).size;
  const iacTool_label = iacTool === 'terraform' ? 'Terraform (azurerm)' : 'Bicep';
  const teardownCmd = iacTool === 'terraform'
    ? 'terraform destroy -var "name_prefix=' + projectName + '"'
    : `az group delete --name "${projectName}-rg" --yes --no-wait`;

  const markdown = `# Deployment Guide — ${rawName}

Deploy this architecture (${params.services.length} service(s)${groupCount ? `, ${groupCount} group(s)` : ''}) to Azure using **${iacTool_label}**.
Generated by the Azure Architecture Diagram Builder MCP — review before running against a real subscription.

## Prerequisites

- **Azure CLI** ≥ 2.60 (\`az version\`) and an authenticated session.
- **Contributor** (or equivalent) on the target subscription.
${iacTool === 'terraform' ? '- **Terraform** ≥ 1.5 (`terraform version`).' : '- **Bicep** CLI (bundled with recent Azure CLI: `az bicep version`).'}
- Sufficient **quota** in \`${location}\` for the SKUs in the generated IaC.

### 1. Authenticate

\`\`\`bash
az login
az account set --subscription "<your-subscription-id>"
az account show --output table
\`\`\`

### 2. Choose region & naming

- Region: \`${location}\`
- Resource name prefix: \`${projectName}\`

### 3. Create the resource group

\`\`\`bash
az group create --name "${projectName}-rg" --location ${location}
\`\`\`

${deploySteps}

### 5. Post-deploy hardening checklist

These settings are pre-set by the generated IaC — verify each after deploy
(they map to the config-level WAF findings that a diagram can't express):
${checklistLines.join('\n')}

### 6. Smoke tests

${smokeLines.join('\n')}

### 7. Teardown

\`\`\`bash
${teardownCmd}
\`\`\`

---

> **Cost:** run \`estimate_costs\` for a monthly estimate in \`${location}\`.
> **Design-time only:** this guide documents the steps — it does not deploy anything.
`;

  // Steps 1-7 above.
  return { markdown, iacTool, steps: 7, checklistItems };
}

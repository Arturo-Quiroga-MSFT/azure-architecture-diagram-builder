// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deployment Guide Generator Agent
 * Uses GPT-5-2 to generate comprehensive deployment documentation
 * Includes prerequisites, step-by-step instructions, configuration, and troubleshooting
 */

import JSZip from 'jszip';
import { generateModelFilename } from '../utils/modelNaming';
import { getModelSettingsForFeature, getDeploymentName, MODEL_CONFIG } from '../stores/modelSettingsStore';
import { trackAIModelUsage } from './telemetryService';
import { buildRequestBody, parseApiResponse, callAzureOpenAIProxy, describeApiFormat } from './apiHelper';
import { searchMicrosoftDocs, renderGroundingBlock, DocSource } from './docsGroundingService';
import { repairBicep } from '../utils/bicepRepair';

// Non-secret flag indicating the AI backend is wired up. Credentials live
// server-side; all calls go through the /api/openai proxy.
const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;

// Token usage metrics returned from Azure OpenAI API
export interface AIMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  elapsedTimeMs: number;
  model?: string;
}

interface CallResult {
  content: string;
  metrics: AIMetrics;
}

async function callAzureOpenAI(messages: any[], maxTokens: number = 10000): Promise<CallResult> {
  // Get model settings for deployment guide (uses override if set)
  const settings = getModelSettingsForFeature('deploymentGuide');
  const modelConfig = MODEL_CONFIG[settings.model];
  
  let deployment: string;
  try {
    deployment = getDeploymentName(settings.model);
  } catch (e) {
    throw new Error(`No deployment configured for ${settings.model}. Please check your .env file.`);
  }

  if (!endpoint) {
    throw new Error('Azure OpenAI is not configured');
  }

  // Determine API format
  const apiFormat = modelConfig.apiFormat || 'responses';

  console.log(`🌐 Calling Azure OpenAI with ${modelConfig.displayName} | API: ${describeApiFormat(apiFormat)}`);
  
  // Start timing
  const startTime = performance.now();

  // Build request body using the appropriate API format
  const effectiveMaxTokens = Math.min(maxTokens, modelConfig.maxCompletionTokens);
  const requestBody = buildRequestBody({
    deployment,
    messages,
    maxTokens: effectiveMaxTokens,
    apiFormat,
    isReasoning: modelConfig.isReasoning,
    reasoningEffort: settings.reasoningEffort,
    supportsStructuredOutputs: modelConfig.supportsStructuredOutputs,
  });
  
  console.log(`🤖 Using ${modelConfig.displayName}${modelConfig.isReasoning ? ` (reasoning: ${settings.reasoningEffort})` : ''} | max_tokens: ${effectiveMaxTokens} | API: ${describeApiFormat(apiFormat)}`);

  const { ok, status, data, errorText, correlationId } = await callAzureOpenAIProxy({
    apiFormat,
    deployment,
    model: modelConfig.displayName,
    operation: 'deployment_guide',
    body: requestBody,
  });
  
  // Calculate elapsed time
  const elapsedTimeMs = Math.round(performance.now() - startTime);

  if (!ok) {
    console.error('❌ Azure OpenAI API error:', status, errorText);
    throw new Error(`Azure OpenAI API error (${status}): ${errorText}`);
  }
  
  // Parse response using the appropriate API format
  const parsed = parseApiResponse(data, apiFormat);
  let content = parsed.content;
  const metrics: AIMetrics = {
    promptTokens: parsed.promptTokens,
    completionTokens: parsed.completionTokens,
    totalTokens: parsed.totalTokens,
    elapsedTimeMs,
    model: data.model
  };
  
  console.log('📦 API Response:', content.length, 'chars |',
    `Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out (${metrics.totalTokens} total) |`,
    `Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
  
  // Track model usage telemetry
  trackAIModelUsage({
    model: modelConfig.displayName,
    operation: 'deployment_guide',
    reasoningEffort: modelConfig.isReasoning ? settings.reasoningEffort : undefined,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
    totalTokens: metrics.totalTokens,
    elapsedTimeMs: metrics.elapsedTimeMs,
    correlationId,
  });
  
  return { content, metrics };
}

export interface DeploymentStep {
  step: number;
  title: string;
  description: string;
  commands?: string[];
  azurePortalSteps?: string[];
  notes?: string[];
}

export interface BicepModule {
  name: string;
  description: string;
  filename: string;
  content: string;
}

export interface DeploymentGuide {
  title: string;
  overview: string;
  prerequisites: string[];
  estimatedTime: string;
  deploymentSteps: DeploymentStep[];
  configuration: {
    section: string;
    settings: Array<{ name: string; value: string; description: string }>;
  }[];
  postDeployment: string[];
  troubleshooting: Array<{ issue: string; solution: string }>;
  estimatedCost: string;
  timestamp: string;
  bicepTemplates?: BicepModule[];
  metrics?: AIMetrics;
  /** Official Microsoft Learn pages used to ground this guide (Phase 1). */
  groundingSources?: DocSource[];
  /** Result of compiling the templates with the Bicep CLI. */
  bicepCheck?: BicepCheck;
}

export interface BicepDiagnostic {
  file: string;
  line: number;
  column: number;
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface BicepCheck {
  /** passed: 0 errors · failed: errors remain · unavailable: compiler not reachable. */
  status: 'passed' | 'failed' | 'unavailable';
  bicepVersion?: string;
  errorCount: number;
  warningCount: number;
  /** Separators fixed deterministically before compiling. */
  autoFixes: number;
  /** True when compiler errors were sent back to the model and it repaired them. */
  modelRepaired: boolean;
  /** Errors found on the first compile, before the model repair round. */
  initialErrorCount?: number;
  diagnostics: BicepDiagnostic[];
}

const MAX_REPAIR_ROUNDS = 2;

export type DeploymentGuideProgress = 'grounding' | 'writing' | 'compiling' | 'repairing' | 'recompiling';

interface BuildResponse {
  ok: boolean;
  version: string;
  errorCount: number;
  warningCount: number;
  diagnostics: BicepDiagnostic[];
}

async function compileBicep(templates: BicepModule[]): Promise<BuildResponse | null> {
  try {
    const response = await fetch('/api/bicep/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: templates.map((t) => ({ filename: t.filename, content: t.content })) }),
    });
    if (!response.ok) {
      console.warn(`⚠️ Bicep compile check unavailable (HTTP ${response.status})`);
      return null;
    }
    return (await response.json()) as BuildResponse;
  } catch (e) {
    console.warn('⚠️ Bicep compile check unavailable:', e);
    return null;
  }
}

function normalizeTemplates(templates: BicepModule[]): { templates: BicepModule[]; fixes: number } {
  let fixes = 0;
  const out = templates
    .filter((t) => t && typeof t.content === 'string' && typeof t.filename === 'string')
    .map((t) => {
      const repaired = repairBicep(t.content);
      fixes += repaired.fixes;
      return { ...t, filename: t.filename.trim().replace(/^\.\//, ''), content: repaired.content };
    });
  return { templates: out, fixes };
}

const BICEP_REPAIR_PROMPT = `You fix Azure Bicep templates so they compile with the Bicep CLI.
You receive every template file and the compiler's diagnostics. Fix every error with the smallest correct change; keep resources, names and intent.
Rules: one property per line (or comma-separated on one line), never semicolons; scope: and parent: must be resource symbols declared in the same file (declare an 'existing' resource when only a name or ID is passed in), never function calls; module paths must match the given filenames exactly; use real resource types and API versions; name, scope and parent must be computable at deployment start (BCP120/BCP177/BCP178), so never derive them from module outputs or runtime properties: for role assignments use guid() over parameters, resource IDs and the role definition ID, and move the assignment into the module that declares the target resource, passing the principal ID in as a parameter.
Return ONLY valid JSON: {"files":[{"filename":"...","content":"full corrected file"}]} with the full content of each file you changed. Do not include unchanged files.`;

async function repairWithModel(templates: BicepModule[], diagnostics: BicepDiagnostic[]): Promise<BicepModule[] | null> {
  const errors = diagnostics.filter((d) => d.level === 'error').slice(0, 80);
  const files = templates.map((t) => `--- ${t.filename} ---\n${t.content}`).join('\n\n');
  const diag = errors.map((d) => `${d.file}(${d.line},${d.column}) ${d.code}: ${d.message}`).join('\n');
  try {
    const { content } = await callAzureOpenAI([
      { role: 'system', content: BICEP_REPAIR_PROMPT },
      { role: 'user', content: `Compiler errors:\n${diag}\n\nTemplates:\n${files}` },
    ], 32000);
    const parsed = JSON.parse(content) as { files?: Array<{ filename: string; content: string }> };
    if (!Array.isArray(parsed.files)) return null;
    const byName = new Map(parsed.files.filter((f) => f && typeof f.content === 'string').map((f) => [f.filename.replace(/^\.\//, ''), f.content]));
    return templates.map((t) => (byName.has(t.filename) ? { ...t, content: byName.get(t.filename)! } : t));
  } catch (e) {
    console.warn('⚠️ Bicep repair round failed:', e);
    return null;
  }
}

/**
 * Repair, compile and (once) model-repair the guide's Bicep templates.
 * Never throws: the guide is still useful when the compiler is unreachable.
 */
export async function checkAndRepairBicep(
  input: BicepModule[],
  onProgress?: (phase: DeploymentGuideProgress) => void
): Promise<{ templates: BicepModule[]; check: BicepCheck }> {
  const first = normalizeTemplates(input);
  let templates = first.templates;
  let autoFixes = first.fixes;
  onProgress?.('compiling');
  let result = await compileBicep(templates);
  if (!result) {
    return { templates, check: { status: 'unavailable', errorCount: 0, warningCount: 0, autoFixes, modelRepaired: false, diagnostics: [] } };
  }
  const initialErrorCount = result.errorCount;
  let modelRepaired = false;
  // Up to MAX_REPAIR_ROUNDS model rounds, each kept only if it lowers the error count.
  for (let round = 0; round < MAX_REPAIR_ROUNDS && result.errorCount > 0; round++) {
    onProgress?.('repairing');
    const repaired = await repairWithModel(templates, result.diagnostics);
    if (!repaired) break;
    const next = normalizeTemplates(repaired);
    onProgress?.('recompiling');
    const retry = await compileBicep(next.templates);
    if (!retry || retry.errorCount >= result.errorCount) break;
    templates = next.templates;
    autoFixes += next.fixes;
    result = retry;
    modelRepaired = true;
  }
  return {
    templates,
    check: {
      status: result.errorCount === 0 ? 'passed' : 'failed',
      bicepVersion: result.version,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      autoFixes,
      modelRepaired,
      initialErrorCount,
      diagnostics: result.diagnostics.filter((d) => d.level === 'error').slice(0, 20),
    },
  };
}

/**
 * Generate comprehensive deployment guide for the architecture
 */
export async function generateDeploymentGuide(
  services: Array<{ name: string; type: string; category: string; description?: string }>,
  connections: Array<{ from: string; to: string; label: string; type?: string }>,
  _groups?: Array<{ name: string; services?: string[] }>,
  architectureDescription?: string,
  estimatedCost?: number,
  onProgress?: (phase: DeploymentGuideProgress) => void
): Promise<DeploymentGuide> {
  
  if (!endpoint) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }
  
  const settings = getModelSettingsForFeature('deploymentGuide');
  const modelConfig = MODEL_CONFIG[settings.model];

  console.log(`📋 Generating deployment guide with ${modelConfig.displayName}...`);

  // Phase 1 grounding: pull current, citable Microsoft Learn docs for the top
  // services so the guide reflects up-to-date API versions, CLI flags, and
  // Bicep schemas. Best-effort — if it fails we generate ungrounded.
  const topServiceNames = services.slice(0, 6).map((s) => s.name).join(', ');
  const groundingQuery = `Deploy ${topServiceNames} to Azure using Bicep and Azure CLI`;
  let groundingSources: DocSource[] = [];
  onProgress?.('grounding');
  try {
    groundingSources = await searchMicrosoftDocs(groundingQuery, 6);
    console.log(`📚 Grounding: ${groundingSources.length} Microsoft Learn source(s)`);
  } catch (e) {
    console.warn('⚠️ Docs grounding unavailable, proceeding ungrounded:', e);
  }
  const groundingBlock = renderGroundingBlock(groundingSources);

  // Build architecture context (limit to prevent token overflow)
  const servicesList = services.slice(0, 25).map(s => 
    `- ${s.name} (${s.type})`
  ).join('\n');
  
  const connectionsList = connections.slice(0, 20).map(c => 
    `- ${c.from} → ${c.to}: ${c.label}`
  ).join('\n');

  const systemPrompt = `You are an Azure DevOps expert. Create comprehensive deployment guides with Bicep templates.

Generate deployment documentation with:
1. Prerequisites - Azure CLI, permissions, tools
2. Deployment Steps - Azure CLI commands with notes
3. Configuration - Environment variables, settings
4. Post-Deployment - Validation, monitoring
5. Troubleshooting - Common issues and solutions
6. Bicep Templates - Infrastructure as Code files

**Bicep Guidelines:**
- Create main.bicep + module files for each service
- Use parameters for environment, location, naming
- Include outputs for endpoints and connection strings
- Add resource tags and comments

**Bicep syntax (every template is compiled with the Bicep CLI before it is shown):**
- Put each object property and each array item on its own line. If you write a single-line object or array, separate items with commas. Never use semicolons.
- \`scope:\` and \`parent:\` must reference a resource symbol declared in the same file. When a module receives only a name or ID, declare an \`existing\` resource for it. Never use function calls such as resource(...) or resourceId(...) there.
- Module paths in main.bicep must exactly match the filenames of the other templates.
- \`name\`, \`scope\` and \`parent\` must be known when the deployment starts: never build them from module outputs or runtime properties (principalId, properties.*). For role assignments, use \`guid()\` over parameters, resource IDs and the role definition ID, and put the role assignment in the module that declares the target resource (pass the principal ID in as a parameter).
- Use every declared parameter. Never return secrets in outputs (no @secure() values, no listKeys()).
- Use only real resource types and API versions.

**Grounding:**
- If GROUNDING SOURCES (Microsoft Learn) are provided in the request, prefer their guidance for API versions, CLI flags, and Bicep resource schemas.
- Reference the relevant source URLs inline in step notes (e.g. "See: <url>") where they informed a command or template.
- Never invent URLs; only cite URLs that appear in the provided sources.

Return ONLY valid JSON:
{
  "title": "Deploy [Name] to Azure",
  "overview": "Brief description",
  "prerequisites": ["Azure subscription", "Azure CLI 2.50+"],
  "estimatedTime": "45-60 minutes",
  "deploymentSteps": [{"step": 1, "title": "Setup", "description": "...", "commands": ["az login"], "notes": ["tip"]}],
  "configuration": [{"section": "Settings", "settings": [{"name": "KEY", "value": "val", "description": "desc"}]}],
  "postDeployment": ["Verify resources"],
  "troubleshooting": [{"issue": "Error X", "solution": "Do Y"}],
  "estimatedCost": "$100-200/month",
  "bicepTemplates": [{"name": "Main", "description": "Orchestration", "filename": "main.bicep", "content": "// Bicep code here"}]
}`;

  const userPrompt = `Create a deployment guide for this Azure architecture:

**Description:** ${architectureDescription || 'Azure architecture'}

**Services (${services.length}):**
${servicesList}

**Connections (${connections.length}):**
${connectionsList}

${estimatedCost ? `**Est. Monthly Cost:** $${estimatedCost.toFixed(2)}` : ''}

${groundingBlock ? `${groundingBlock}

` : ''}Generate a deployment guide with Azure CLI commands and Bicep templates for this architecture.`;

  try {
    onProgress?.('writing');
    const { content, metrics } = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 32000);

    // Handle empty response
    if (!content || content.length === 0) {
      throw new Error('Empty response from API. The architecture may be too complex. Try with fewer services.');
    }

    // Parse JSON response
    let guide: DeploymentGuide;
    try {
      guide = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response content:', content.substring(0, 500));
      throw new Error('Invalid response format from deployment guide generator. Please try again.');
    }
    guide.timestamp = new Date().toISOString();
    guide.metrics = metrics;
    if (groundingSources.length > 0) {
      guide.groundingSources = groundingSources.map((s) => ({ title: s.title, url: s.url }));
    }

    if (Array.isArray(guide.bicepTemplates) && guide.bicepTemplates.length > 0) {
      const { templates, check } = await checkAndRepairBicep(guide.bicepTemplates, onProgress);
      guide.bicepTemplates = templates;
      guide.bicepCheck = check;
      console.log(`🧪 Bicep compile check: ${check.status} · ${check.errorCount} errors · ${check.autoFixes} auto-fixes${check.modelRepaired ? ' · model-repaired' : ''}`);
    }

    console.log('📋 Deployment guide generated');
    console.log('📝 Steps:', guide.deploymentSteps.length);
    console.log('⚙️ Configuration sections:', guide.configuration.length);
    console.log('🔧 Troubleshooting tips:', guide.troubleshooting.length);
    console.log('📦 Bicep templates:', guide.bicepTemplates?.length || 0);

    return guide;

  } catch (error) {
    console.error('❌ Deployment guide generation failed:', error);
    throw error;
  }
}

/**
 * Format deployment guide as markdown
 */
export function formatDeploymentGuide(guide: DeploymentGuide): string {
  let md = `# ${guide.title}\n\n`;
  
  md += `## Overview\n\n${guide.overview}\n\n`;
  
  md += `**Estimated Time:** ${guide.estimatedTime}\n\n`;
  md += `**Estimated Cost:** ${guide.estimatedCost}\n\n`;
  
  md += `## Prerequisites\n\n`;
  guide.prerequisites.forEach(prereq => {
    md += `- ${prereq}\n`;
  });
  md += `\n`;
  
  md += `## Deployment Steps\n\n`;
  guide.deploymentSteps.forEach(step => {
    md += `### Step ${step.step}: ${step.title}\n\n`;
    md += `${step.description}\n\n`;
    
    if (step.commands && step.commands.length > 0) {
      md += `**Commands:**\n\`\`\`bash\n${step.commands.join('\n')}\n\`\`\`\n\n`;
    }
    
    if (step.azurePortalSteps && step.azurePortalSteps.length > 0) {
      md += `**Azure Portal:**\n`;
      step.azurePortalSteps.forEach(portalStep => {
        md += `- ${portalStep}\n`;
      });
      md += `\n`;
    }
    
    if (step.notes && step.notes.length > 0) {
      md += `**Notes:**\n`;
      step.notes.forEach(note => {
        md += `- 💡 ${note}\n`;
      });
      md += `\n`;
    }
  });
  
  md += `## Configuration\n\n`;
  guide.configuration.forEach(section => {
    md += `### ${section.section}\n\n`;
    md += `| Setting | Value | Description |\n`;
    md += `|---------|-------|-------------|\n`;
    section.settings.forEach(setting => {
      md += `| \`${setting.name}\` | ${setting.value} | ${setting.description} |\n`;
    });
    md += `\n`;
  });
  
  md += `## Post-Deployment Validation\n\n`;
  guide.postDeployment.forEach(task => {
    md += `- [ ] ${task}\n`;
  });
  md += `\n`;
  
  md += `## Troubleshooting\n\n`;
  guide.troubleshooting.forEach(item => {
    md += `**Issue:** ${item.issue}\n\n`;
    md += `**Solution:** ${item.solution}\n\n`;
  });
  
  if (guide.bicepCheck && guide.bicepCheck.status !== 'unavailable') {
    md += `## Bicep Compile Check\n\n`;
    md += guide.bicepCheck.status === 'passed'
      ? `All templates compiled with the Bicep CLI${guide.bicepCheck.bicepVersion ? ` ${guide.bicepCheck.bicepVersion}` : ''}: 0 errors, ${guide.bicepCheck.warningCount} linter warnings.\n\n`
      : `The Bicep CLI reported ${guide.bicepCheck.errorCount} errors. Fix them before deploying.\n\n`;
  }

  if (guide.groundingSources && guide.groundingSources.length > 0) {
    md += `## References (Microsoft Learn)\n\n`;
    guide.groundingSources.forEach(src => {
      md += `- [${src.title}](${src.url})\n`;
    });
    md += `\n`;
  }
  
  md += `---\n\n`;
  md += `*Generated: ${new Date(guide.timestamp).toLocaleString()}*\n`;
  
  return md;
}

/**
 * Export deployment guide as downloadable file
 */
export function downloadDeploymentGuide(guide: DeploymentGuide) {
  const markdown = formatDeploymentGuide(guide);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = generateModelFilename('deployment-guide', 'md');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download a single Bicep template
 */
export function downloadBicepTemplate(template: BicepModule) {
  const blob = new Blob([template.content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = template.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download all Bicep templates as a ZIP file
 */
export async function downloadAllBicepTemplates(guide: DeploymentGuide) {
  if (!guide.bicepTemplates || guide.bicepTemplates.length === 0) {
    console.warn('No Bicep templates available to download');
    return;
  }

  const zip = new JSZip();
  
  // Add README with instructions
  const readme = `# Bicep Templates for ${guide.title}
Generated: ${new Date(guide.timestamp).toLocaleString()}

## Deployment Instructions

1. Review and customize parameters in main.bicep
2. Deploy with Azure CLI:
   \`\`\`bash
   az login
   az group create --name <rg-name> --location <location>
   az deployment group create --resource-group <rg-name> --template-file main.bicep
   \`\`\`

## Compile Check
${guide.bicepCheck && guide.bicepCheck.status !== 'unavailable'
  ? guide.bicepCheck.status === 'passed'
    ? `Compiled with the Bicep CLI${guide.bicepCheck.bicepVersion ? ` ${guide.bicepCheck.bicepVersion}` : ''}: 0 errors, ${guide.bicepCheck.warningCount} linter warnings. Re-check locally with \`az bicep build --file main.bicep\`.`
    : `The Bicep CLI reported ${guide.bicepCheck.errorCount} errors. Run \`az bicep build --file main.bicep\` and fix them before deploying.`
  : 'Not compiled. Run `az bicep build --file main.bicep` before deploying.'}

## Files Included
${guide.bicepTemplates.map(t => `- ${t.filename}: ${t.description}`).join('\n')}
`;
  zip.file('README.md', readme);

  // Add each Bicep template
  guide.bicepTemplates.forEach((template) => {
    zip.file(template.filename, template.content);
  });

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = generateModelFilename('bicep-templates', 'zip');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

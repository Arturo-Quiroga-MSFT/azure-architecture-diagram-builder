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
import { buildApiUrl, buildRequestBody, parseApiResponse } from './apiHelper';

const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;

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

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  // Determine API format
  const apiFormat = modelConfig.apiFormat || 'responses';
  const url = buildApiUrl(endpoint, deployment, apiFormat);

  console.log(`🌐 Calling Azure OpenAI with ${modelConfig.displayName} | API: ${apiFormat === 'chat-completions' ? 'Chat Completions' : 'Responses'}`);
  
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
  });
  
  console.log(`🤖 Using ${modelConfig.displayName}${modelConfig.isReasoning ? ` (reasoning: ${settings.reasoningEffort})` : ''} | max_tokens: ${effectiveMaxTokens} | API: ${apiFormat === 'chat-completions' ? 'Chat Completions' : 'Responses'}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });
  
  // Calculate elapsed time
  const elapsedTimeMs = Math.round(performance.now() - startTime);

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Azure OpenAI API error:', response.status, error);
    throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
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
}

/**
 * Generate comprehensive deployment guide for the architecture
 */
export async function generateDeploymentGuide(
  services: Array<{ name: string; type: string; category: string; description?: string }>,
  connections: Array<{ from: string; to: string; label: string; type?: string }>,
  _groups?: Array<{ name: string; services?: string[] }>,
  architectureDescription?: string,
  estimatedCost?: number
): Promise<DeploymentGuide> {
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }
  
  const settings = getModelSettingsForFeature('deploymentGuide');
  const modelConfig = MODEL_CONFIG[settings.model];

  console.log(`📋 Generating deployment guide with ${modelConfig.displayName}...`);

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

Generate a deployment guide with Azure CLI commands and Bicep templates for this architecture.`;

  try {
    const { content, metrics } = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 16000);

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

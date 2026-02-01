/**
 * Deployment Guide Generator Agent
 * Uses GPT-5-2 to generate comprehensive deployment documentation
 * Includes prerequisites, step-by-step instructions, configuration, and troubleshooting
 */

const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const deployment = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT;

async function callAzureOpenAI(messages: any[], maxTokens: number = 10000): Promise<string> {
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  console.log('🌐 Calling Azure OpenAI API:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages,
      max_completion_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Azure OpenAI API error:', response.status, error);
    throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  console.log('📦 API Response:', data);
  return content;
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
  
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }

  console.log('📋 Generating deployment guide with GPT-4.1...');

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
    const content = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 16000);

    console.log('✅ Deployment guide response received:', content.length, 'characters');

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
  link.download = `deployment-guide-${Date.now()}.md`;
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
 * Download all Bicep templates as a combined file
 */
export function downloadAllBicepTemplates(guide: DeploymentGuide) {
  if (!guide.bicepTemplates || guide.bicepTemplates.length === 0) {
    console.warn('No Bicep templates available to download');
    return;
  }

  // Create a combined file with all templates and instructions
  let combined = `# Bicep Templates for ${guide.title}\n`;
  combined += `# Generated: ${new Date(guide.timestamp).toLocaleString()}\n\n`;
  combined += `# Instructions:\n`;
  combined += `# 1. Create the folder structure as indicated by filenames\n`;
  combined += `# 2. Copy each template section to its respective file\n`;
  combined += `# 3. Run: az deployment group create --resource-group <rg-name> --template-file main.bicep\n\n`;
  combined += `${'='.repeat(80)}\n\n`;

  guide.bicepTemplates.forEach((template) => {
    combined += `# FILE: ${template.filename}\n`;
    combined += `# ${template.description}\n`;
    combined += `${'─'.repeat(80)}\n\n`;
    combined += template.content;
    combined += `\n\n${'='.repeat(80)}\n\n`;
  });

  const blob = new Blob([combined], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bicep-templates-${Date.now()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

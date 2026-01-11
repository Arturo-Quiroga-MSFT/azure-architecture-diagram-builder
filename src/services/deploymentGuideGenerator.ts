/**
 * Deployment Guide Generator Agent
 * Uses GPT-4.1 to generate comprehensive deployment documentation
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
}

/**
 * Generate comprehensive deployment guide for the architecture
 */
export async function generateDeploymentGuide(
  services: Array<{ name: string; type: string; category: string; description?: string }>,
  connections: Array<{ from: string; to: string; label: string; type?: string }>,
  groups?: Array<{ name: string; services?: string[] }>,
  architectureDescription?: string,
  estimatedCost?: number
): Promise<DeploymentGuide> {
  
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }

  console.log('📋 Generating deployment guide with GPT-4.1...');

  // Build architecture context
  const servicesList = services.map(s => 
    `- ${s.name} (${s.type})${s.description ? `: ${s.description}` : ''}`
  ).join('\n');
  
  const connectionsList = connections.map(c => 
    `- ${c.from} → ${c.to}: ${c.label} [${c.type || 'sync'}]`
  ).join('\n');

  const systemPrompt = `You are an Azure DevOps expert specializing in deployment automation and documentation. Your role is to create comprehensive, production-ready deployment guides.

Generate detailed deployment documentation that includes:

1. **Prerequisites** - Azure CLI, subscriptions, permissions, tools
2. **Deployment Steps** - Clear, numbered steps with Azure CLI commands or Portal instructions
3. **Configuration** - Environment variables, connection strings, settings
4. **Post-Deployment** - Validation, testing, monitoring setup
5. **Troubleshooting** - Common issues and solutions

**Guidelines:**
- Provide actual Azure CLI commands when possible
- Include both CLI and Azure Portal approaches
- Add security best practices (use Key Vault, Managed Identity, etc.)
- Reference official Azure documentation links
- Be specific about resource naming conventions
- Include estimated deployment time

Return ONLY valid JSON (no markdown, no code blocks) with this structure:
{
  "title": "Deploy [Architecture Name] to Azure",
  "overview": "2-3 sentence description of what will be deployed",
  "prerequisites": [
    "Azure subscription with Owner or Contributor access",
    "Azure CLI installed (version 2.50+)"
  ],
  "estimatedTime": "45-60 minutes",
  "deploymentSteps": [
    {
      "step": 1,
      "title": "Set up Azure environment",
      "description": "Configure Azure CLI and create resource group",
      "commands": [
        "az login",
        "az account set --subscription 'your-subscription-id'",
        "az group create --name rg-myapp --location eastus2"
      ],
      "notes": [
        "Choose a region close to your users",
        "Use consistent naming conventions"
      ]
    }
  ],
  "configuration": [
    {
      "section": "Application Settings",
      "settings": [
        {
          "name": "DATABASE_CONNECTION_STRING",
          "value": "Retrieve from Azure SQL connection strings",
          "description": "Connection string for primary database"
        }
      ]
    }
  ],
  "postDeployment": [
    "Verify all resources are running",
    "Test endpoints with sample requests",
    "Configure monitoring alerts"
  ],
  "troubleshooting": [
    {
      "issue": "Deployment fails with 'Resource not found'",
      "solution": "Ensure resource group exists and you have proper permissions"
    }
  ],
  "estimatedCost": "$150-200 per month for standard configuration"
}`;

  const userPrompt = `Create a deployment guide for this Azure architecture:

**Architecture Description:**
${architectureDescription || 'Production-ready Azure architecture'}

**Services to Deploy (${services.length}):**
${servicesList}

**Service Connections (${connections.length}):**
${connectionsList}

**Logical Organization:**
${groups ? groups.map(g => `- ${g.name}`).join('\n') : 'Services grouped logically'}

${estimatedCost ? `**Estimated Monthly Cost:** $${estimatedCost.toFixed(2)}` : ''}

Generate a comprehensive, production-ready deployment guide with Azure CLI commands and best practices.`;

  try {
    const content = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 10000);

    console.log('✅ Deployment guide response received:', content.length, 'characters');

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
export function downloadDeploymentGuide(guide: DeploymentGuide, filename: string = 'deployment-guide.md') {
  const markdown = formatDeploymentGuide(guide);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

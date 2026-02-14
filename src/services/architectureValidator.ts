/**
 * Architecture Validator Agent
 * Uses GPT-5-2 to validate architecture against Azure Well-Architected Framework
 * Provides recommendations for reliability, security, performance, cost optimization, and operational excellence
 */

import { getModelSettingsForFeature, getModelSettings, getDeploymentName, MODEL_CONFIG } from '../stores/modelSettingsStore';

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

/**
 * Fallback to Chat Completions API when Responses API doesn't support the model.
 */
async function callChatCompletionsFallback(
  deployment: string,
  messages: any[],
  maxTokens: number
): Promise<{ content: string; usage: any; model: string }> {
  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`;

  const requestBody: any = {
    messages,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };

  console.log(`🔄 Falling back to Chat Completions API | deployment: ${deployment} | max_tokens: ${maxTokens}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Chat Completions fallback error:', response.status, error);
    throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage || {},
    model: data.model,
  };
}

async function callAzureOpenAI(messages: any[], maxTokens: number = 8000): Promise<CallResult> {
  // Re-read settings fresh to pick up any recent UI changes
  const settings = getModelSettingsForFeature('validation');
  const defaultSettings = getModelSettings();
  const modelConfig = MODEL_CONFIG[settings.model];
  
  // Log the full resolution chain so the user can see exactly which model is selected
  const hasOverride = defaultSettings.featureOverrides?.['validation'];
  console.log(`🔧 Validation model resolution: default=${defaultSettings.model}` +
    `${hasOverride ? `, override=${hasOverride.model}` : ', no override'}` +
    ` → using ${settings.model}`);
  
  let deployment: string;
  try {
    deployment = getDeploymentName(settings.model);
  } catch (e) {
    throw new Error(`No deployment configured for ${settings.model}. Please check your .env file.`);
  }

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  // Responses API endpoint
  const url = `${endpoint}openai/v1/responses`;

  console.log(`🌐 Calling Azure OpenAI Responses API with ${modelConfig.displayName}`);
  
  // Start timing
  const startTime = performance.now();

  // Build Responses API request body
  // Pass all messages (including system) as input — json_object format
  // requires the word 'json' to appear in input messages
  const effectiveMaxTokens = Math.min(maxTokens, modelConfig.maxCompletionTokens);
  const requestBody: any = {
    model: deployment,
    input: messages,
    max_output_tokens: effectiveMaxTokens,
    text: { format: { type: 'json_object' } },
    store: false,
  };
  
  // Add reasoning config for reasoning models
  if (modelConfig.isReasoning) {
    requestBody.reasoning = { effort: settings.reasoningEffort };
  }
  
  console.log(`🤖 Using ${modelConfig.displayName}${modelConfig.isReasoning ? ` (reasoning: ${settings.reasoningEffort})` : ''} | max_tokens: ${effectiveMaxTokens} | API: Responses`);

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

    // Auto-fallback to Chat Completions for models that don't support Responses API
    if (response.status === 400 && error.includes('not supported by Responses API')) {
      console.warn(`⚠️ ${modelConfig.displayName} does not support Responses API — falling back to Chat Completions API`);
      const fallback = await callChatCompletionsFallback(deployment, messages, effectiveMaxTokens);
      const fallbackElapsed = Math.round(performance.now() - startTime);
      const usage = fallback.usage;
      return {
        content: fallback.content,
        metrics: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
          elapsedTimeMs: fallbackElapsed,
          model: fallback.model,
        }
      };
    }

    console.error('❌ Azure OpenAI API error:', response.status, error);
    throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  
  // Responses API uses input_tokens/output_tokens
  const usage = data.usage || {};
  const metrics: AIMetrics = {
    promptTokens: usage.input_tokens || 0,
    completionTokens: usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
    elapsedTimeMs,
    model: data.model
  };
  
  // Responses API: extract text from output
  let content = data.output_text || '';
  if (!content && data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const part of item.content) {
          if (part.type === 'output_text') {
            content += part.text;
          }
        }
      }
    }
  }
  
  console.log('📦 API Response:', content.length, 'chars |',
    `Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out (${metrics.totalTokens} total) |`,
    `Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
  
  return { content, metrics };
}

export interface ValidationResult {
  score: number; // 0-100
  pillar: 'Reliability' | 'Security' | 'Cost Optimization' | 'Operational Excellence' | 'Performance Efficiency';
  findings: ValidationFinding[];
}

export interface ValidationFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  resources?: string[];
}

export interface ArchitectureValidation {
  overallScore: number;
  summary: string;
  pillars: ValidationResult[];
  quickWins: ValidationFinding[];
  timestamp: string;
  metrics?: AIMetrics;
  modelUsed?: string;
  diagramImageDataUrl?: string;
}

/**
 * Validate architecture against Azure Well-Architected Framework
 */
export async function validateArchitecture(
  services: Array<{ name: string; type: string; category: string; description?: string }>,
  connections: Array<{ from: string; to: string; label: string }>,
  groups?: Array<{ name: string; services?: string[] }>,
  architectureDescription?: string
): Promise<ArchitectureValidation> {
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }
  
  const settings = getModelSettingsForFeature('validation');
  const modelConfig = MODEL_CONFIG[settings.model];

  console.log(`🔍 Starting architecture validation with ${modelConfig.displayName}...`);

  // Build architecture context
  const servicesList = services.map(s => `- ${s.name} (${s.type})`).join('\n');
  const connectionsList = connections.map(c => `- ${c.from} → ${c.to}: ${c.label}`).join('\n');
  const groupsList = groups ? groups.map(g => `- ${g.name}`).join('\n') : 'No groups';
  const serviceNamesList = services.map(s => s.name);

  const systemPrompt = `You are an Azure Well-Architected Framework expert. Your role is to review Azure architectures and provide actionable recommendations across the five pillars:

1. **Reliability** - Resiliency, availability, disaster recovery
2. **Security** - Identity, data protection, network security
3. **Cost Optimization** - Right-sizing, reserved instances, consumption patterns
4. **Operational Excellence** - Monitoring, automation, DevOps practices
5. **Performance Efficiency** - Scaling, caching, optimization

Analyze the architecture and provide:
- Overall assessment score (0-100)
- Findings for each pillar with severity levels
- Specific, actionable recommendations
- Quick wins that can be implemented immediately

Return ONLY valid JSON (no markdown) with this structure:
{
  "overallScore": 75,
  "summary": "Brief 2-3 sentence overall assessment",
  "pillars": [
    {
      "score": 80,
      "pillar": "Reliability",
      "findings": [
        {
          "severity": "high",
          "category": "High Availability",
          "issue": "Single region deployment without redundancy",
          "recommendation": "Deploy across multiple availability zones or implement geo-replication",
          "resources": ["service-name-1", "service-name-2"]
        }
      ]
    }
  ],
  "quickWins": [
    {
      "severity": "medium",
      "category": "Cost Optimization",
      "issue": "Always-on resources that could use consumption pricing",
      "recommendation": "Switch Azure Functions to Consumption plan for variable workloads",
      "resources": ["Azure Functions"]
    }
  ]
}`;

  const userPrompt = `Review this Azure architecture:

**Architecture Description:**
${architectureDescription || 'Not provided'}

**Services (${services.length}):**
${servicesList}

**Connections (${connections.length}):**
${connectionsList}

**Logical Groups:**
${groupsList}

IMPORTANT: In the "resources" arrays, use EXACTLY the service names as listed above (e.g., "${serviceNamesList.slice(0, 3).join('", "')}"). Do not rename or rephrase them.

Provide a comprehensive Well-Architected Framework assessment with actionable recommendations.`;

  try {
    console.log('📤 Sending validation request to Azure OpenAI...');
    const { content, metrics } = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 8000);

    console.log('✅ Validation response received:', content.length, 'characters');

    // Parse JSON response
    let validation: ArchitectureValidation;
    try {
      validation = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('📄 Full response content:', content);
      throw new Error('Invalid response format from validation agent. Please try again.');
    }
    
    // Validate response structure
    if (!validation.overallScore || !validation.pillars || !validation.summary) {
      console.error('❌ Invalid response structure:', validation);
      throw new Error('Response missing required fields');
    }
    
    validation.timestamp = new Date().toISOString();
    validation.metrics = metrics;
    validation.modelUsed = modelConfig.displayName + (modelConfig.isReasoning ? ` (${settings.reasoningEffort})` : '');

    console.log('🎯 Validation complete. Overall score:', validation.overallScore);
    console.log('📊 Pillars analyzed:', validation.pillars.length);
    console.log('⚡ Quick wins identified:', validation.quickWins.length);

    return validation;

  } catch (error) {
    console.error('❌ Architecture validation failed:', error);
    throw error;
  }
}

/**
 * Format validation results for display
 */
export function formatValidationReport(validation: ArchitectureValidation): string {
  const date = new Date(validation.timestamp).toLocaleString();
  
  let report = `# 🔍 Azure Architecture Validation Report\n\n`;
  report += `**Generated:** ${date}\n\n`;
  
  // Add architecture diagram image reference if available
  if (validation.diagramImageDataUrl) {
    const imageFilename = `architecture-validation-${new Date(validation.timestamp).getTime()}-diagram.png`;
    report += `## 🖼️ Architecture Diagram\n\n`;
    report += `![Architecture Diagram](./${imageFilename})\n\n`;
  }
  
  report += `---\n\n`;
  
  // Executive Summary
  report += `## 📊 Executive Summary\n\n`;
  report += `### Overall Score: ${validation.overallScore}/100\n\n`;
  
  const scoreColor = validation.overallScore >= 80 ? '🟢' : validation.overallScore >= 60 ? '🟡' : '🔴';
  report += `${scoreColor} **Assessment:** ${validation.summary}\n\n`;
  
  // Pillar Scores at a Glance
  report += `### Pillar Scores at a Glance\n\n`;
  report += `| Pillar | Score | Status |\n`;
  report += `|--------|-------|--------|\n`;
  validation.pillars.forEach(pillar => {
    const status = pillar.score >= 80 ? '✅ Good' : pillar.score >= 60 ? '⚠️ Needs Improvement' : '❌ Critical';
    report += `| ${pillar.pillar} | ${pillar.score}/100 | ${status} |\n`;
  });
  report += `\n---\n\n`;
  
  // Detailed Findings by Pillar
  report += `## 🏗️ Detailed Assessment by Pillar\n\n`;
  
  validation.pillars.forEach((pillar, index) => {
    report += `### ${index + 1}. ${pillar.pillar} (${pillar.score}/100)\n\n`;
    
    if (pillar.findings.length === 0) {
      report += `✅ No critical findings for this pillar.\n\n`;
      return;
    }
    
    pillar.findings.forEach((finding) => {
      const emoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢'
      }[finding.severity];
      
      report += `${emoji} **${finding.category}** [${finding.severity.toUpperCase()}]\n\n`;
      report += `**Issue:**  \n${finding.issue}\n\n`;
      report += `**Recommendation:**  \n${finding.recommendation}\n\n`;
      if (finding.resources && finding.resources.length > 0) {
        report += `**Affected Resources:**\n`;
        finding.resources.forEach(resource => {
          report += `- ${resource}\n`;
        });
        report += `\n`;
      }
      report += `---\n\n`;
    });
  });
  
  // Quick Wins Section
  if (validation.quickWins.length > 0) {
    report += `## ⚡ Quick Wins - Immediate Action Items\n\n`;
    report += `These are high-impact, low-effort improvements you can implement right away:\n\n`;
    
    validation.quickWins.forEach((win, index) => {
      report += `### ${index + 1}. ${win.category}\n\n`;
      report += `${win.recommendation}\n\n`;
    });
  }
  
  // Footer
  report += `---\n\n`;
  report += `## 📚 Additional Resources\n\n`;
  report += `- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/architecture/framework/)\n`;
  report += `- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)\n`;
  report += `- [Azure Security Benchmark](https://learn.microsoft.com/security/benchmark/azure/)\n\n`;
  
  report += `---\n\n`;
  report += `*Report generated by Azure Architecture Diagram Builder*  \n`;
  report += `*Powered by ${validation.modelUsed || 'Azure OpenAI'} and Azure Well-Architected Framework*  \n`;
  report += `*Generated: ${new Date(validation.timestamp).toLocaleString()}*\n`;
  
  return report;
}

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Architecture Validator Agent
 * Uses GPT-5-2 to validate architecture against Azure Well-Architected Framework
 * Provides recommendations for reliability, security, performance, cost optimization, and operational excellence
 */

import { getModelSettingsForFeature, getModelSettings, getDeploymentName, MODEL_CONFIG, ModelType, ReasoningEffort } from '../stores/modelSettingsStore';
import { detectWafPatterns, calculatePreliminaryScore } from './wafPatternDetector';
import { getKnowledgeBaseStats } from '../data/wafRules';
import { trackAIModelUsage } from './telemetryService';
import { buildApiUrl, buildRequestBody, parseApiResponse } from './apiHelper';

export interface ValidationModelOverride {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
}

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

async function callAzureOpenAI(messages: any[], maxTokens: number = 8000, modelOverride?: ValidationModelOverride): Promise<CallResult> {
  // Re-read settings fresh to pick up any recent UI changes
  const storeSettings = getModelSettingsForFeature('validation');
  const settings = modelOverride || storeSettings;
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
  const metrics: AIMetrics = {
    promptTokens: parsed.promptTokens,
    completionTokens: parsed.completionTokens,
    totalTokens: parsed.totalTokens,
    elapsedTimeMs,
    model: data.model
  };
  
  const content = parsed.content;
  
  console.log('📦 API Response:', content.length, 'chars |',
    `Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out (${metrics.totalTokens} total) |`,
    `Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
  
  // Track model usage telemetry
  trackAIModelUsage({
    model: modelConfig.displayName,
    operation: 'architecture_validation',
    reasoningEffort: modelConfig.isReasoning ? settings.reasoningEffort : undefined,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
    totalTokens: metrics.totalTokens,
    elapsedTimeMs: metrics.elapsedTimeMs,
  });
  
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
 * Validate architecture against Azure Well-Architected Framework.
 * 
 * Hybrid approach:
 *   1. Run instant, deterministic rule-based checks (~1ms)
 *   2. Send the pre-computed findings + architecture to the LLM for
 *      contextual refinement, scoring, and additional insights
 * 
 * This is ~3-5x faster than sending everything to the LLM from scratch
 * because the LLM prompt is smaller and more focused.
 */
export async function validateArchitecture(
  services: Array<{ name: string; type: string; category: string; description?: string }>,
  connections: Array<{ from: string; to: string; label: string }>,
  groups?: Array<{ name: string; services?: string[] }>,
  architectureDescription?: string,
  modelOverride?: ValidationModelOverride
): Promise<ArchitectureValidation> {
  
  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }
  
  const storeSettings = getModelSettingsForFeature('validation');
  const settings = modelOverride || storeSettings;
  const modelConfig = MODEL_CONFIG[settings.model];

  console.log(`🔍 Starting hybrid WAF validation with ${modelConfig.displayName}...`);

  // ── Phase 1: Instant local rule-based analysis ──────────────────────
  const localResult = detectWafPatterns(services, connections, groups);
  const preliminaryScore = calculatePreliminaryScore(localResult.findings);
  const kbStats = getKnowledgeBaseStats();
  
  console.log(`⚡ Phase 1 (local): ${localResult.findings.length} findings, preliminary score ${preliminaryScore}/100 (${localResult.elapsedMs}ms)`);
  console.log(`  📚 Knowledge base: ${kbStats.totalRules} rules across ${kbStats.servicesCovered} services`);

  // ── Phase 2: LLM contextual refinement ──────────────────────────────
  // Build architecture context
  const servicesList = services.map(s => `- ${s.name} (${s.type})`).join('\n');
  const connectionsList = connections.map(c => `- ${c.from} → ${c.to}: ${c.label}`).join('\n');
  const groupsList = groups ? groups.map(g => `- ${g.name}`).join('\n') : 'No groups';
  const serviceNamesList = services.map(s => s.name);

  // Only send architecture-level pattern findings to the LLM (not per-service
  // best-practice rules, which are generic and would overwhelm the prompt)
  const patternFindingsSummary = localResult.patternFindings.length > 0
    ? localResult.patternFindings.map(f =>
        `- [${f.severity.toUpperCase()}] ${f.category}: ${f.issue}` +
        (f.resources?.length ? ` (affects: ${f.resources.join(', ')})` : '')
      ).join('\n')
    : 'No architecture-level anti-patterns detected.';

  const patternsNote = localResult.patternsDetected.length > 0
    ? `Detected topology patterns: ${localResult.patternsDetected.join(', ')}`
    : 'No common anti-patterns detected.';

  const systemPrompt = `You are an Azure Well-Architected Framework expert. Your role is to review Azure architectures and provide actionable recommendations across the five pillars:

1. **Reliability** - Resiliency, availability, disaster recovery
2. **Security** - Identity, data protection, network security
3. **Cost Optimization** - Right-sizing, reserved instances, consumption patterns
4. **Operational Excellence** - Monitoring, automation, DevOps practices
5. **Performance Efficiency** - Scaling, caching, optimization

A topology pre-scan detected these architecture-level patterns to consider:
${patternsNote}
${patternFindingsSummary}

Use these patterns as hints — validate whether they apply in context, dismiss any that don't, and add your own architecture-specific findings.

SCORING GUIDANCE:
- Score the architecture based on what IS present, not what COULD be added
- A well-connected architecture with appropriate services should score 60-80
- Only score below 50 for architectures with critical gaps (no auth, no monitoring, single points of failure)
- Findings are improvement suggestions, not reasons to penalize the score severely
- Each finding should include a "source" field: "rule-based" (from pre-scan) or "ai-analysis" (your addition)

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
          "issue": "...",
          "recommendation": "...",
          "resources": ["service-name-1"],
          "source": "rule-based"
        }
      ]
    }
  ],
  "quickWins": [
    {
      "severity": "medium",
      "category": "Cost Optimization",
      "issue": "...",
      "recommendation": "...",
      "resources": ["Azure Functions"],
      "source": "ai-analysis"
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
    console.log('📤 Phase 2: Sending focused validation to Azure OpenAI...');
    const { content, metrics } = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 8000, modelOverride);

    console.log('✅ Hybrid validation response received:', content.length, 'characters');

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

    // Attach hybrid metadata
    (validation as any).hybridMetadata = {
      localFindings: localResult.findings.length,
      patternsDetected: localResult.patternsDetected,
      localElapsedMs: localResult.elapsedMs,
      preliminaryScore,
      kbRulesUsed: kbStats.totalRules,
    };

    console.log('🎯 Hybrid validation complete. Overall score:', validation.overallScore);
    console.log('📊 Pillars analyzed:', validation.pillars.length);
    console.log('⚡ Quick wins identified:', validation.quickWins.length);
    console.log(`🔬 Hybrid breakdown: ${localResult.findings.length} local + LLM refinement in ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s total`);

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

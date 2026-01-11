/**
 * Architecture Validator Agent
 * Uses GPT-5-2 to validate architecture against Azure Well-Architected Framework
 * Provides recommendations for reliability, security, performance, cost optimization, and operational excellence
 */

const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const deployment = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT;

async function callAzureOpenAI(messages: any[], maxTokens: number = 8000): Promise<string> {
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
  console.log('📦 Full API Response:', JSON.stringify(data, null, 2));
  console.log('📦 Choices array:', data.choices);
  console.log('📦 First choice:', data.choices?.[0]);
  console.log('📦 Message:', data.choices?.[0]?.message);
  console.log('📦 Content:', data.choices?.[0]?.message?.content);
  
  const content = data.choices[0]?.message?.content || '';
  console.log('📦 Final content length:', content.length);
  return content;
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
  
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI configuration missing. Please check your .env file.');
  }

  console.log('🔍 Starting architecture validation with GPT-4.1...');

  // Build architecture context
  const servicesList = services.map(s => `- ${s.name} (${s.type})`).join('\n');
  const connectionsList = connections.map(c => `- ${c.from} → ${c.to}: ${c.label}`).join('\n');
  const groupsList = groups ? groups.map(g => `- ${g.name}`).join('\n') : 'No groups';

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

Provide a comprehensive Well-Architected Framework assessment with actionable recommendations.`;

  try {
    console.log('📤 Sending validation request to Azure OpenAI...');
    const content = await callAzureOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 8000);

    console.log('✅ Validation response received:', content.length, 'characters');
    console.log('📄 First 200 chars:', content.substring(0, 200));

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
  report += `*Powered by GPT-5.2 and Azure Well-Architected Framework*  \n`;
  report += `*Generated: ${new Date(validation.timestamp).toLocaleString()}*\n`;
  
  return report;
}

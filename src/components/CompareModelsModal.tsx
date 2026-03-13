// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Clock, Zap, CheckCircle, AlertCircle, GitCompare, Download, FileJson, FileText, Brain, MonitorPlay, VideoOff, StopCircle } from 'lucide-react';
import { generateArchitectureWithAI, generateCritique, isAzureOpenAIConfigured, AIMetrics, ModelOverride } from '../services/azureOpenAI';
import { AvatarPresenter, AvatarStatus } from '../services/avatarPresenter';
import {
  MODEL_CONFIG,
  ModelType,
  ReasoningEffort,
  getAvailableModels,
  getModelSettings,
} from '../stores/modelSettingsStore';

/** Abbreviate model name for filenames */
function abbreviateModelForFile(model: ModelType): string {
  const map: Record<string, string> = {
    'gpt-5.1': 'gpt51', 'gpt-5.2': 'gpt52', 'gpt-5.2-codex': 'gpt52codex',
    'gpt-5.3-codex': 'gpt53codex', 'deepseek-v3.2-speciale': 'deepseek', 'grok-4.1-fast': 'grok41fast',
  };
  return map[model] || 'unknown';
}

/** Build a model suffix like "gpt52-medium" or "deepseek" */
function modelSuffix(model: ModelType, effort: ReasoningEffort): string {
  const abbr = abbreviateModelForFile(model);
  return MODEL_CONFIG[model].isReasoning ? `${abbr}-${effort}` : abbr;
}

/** Derive a short PascalCase slug from a prompt for use in filenames */
function promptToSlug(prompt: string): string {
  const stop = new Set([
    'a','an','the','and','or','but','for','with','to','of','in','on','at','by',
    'from','as','is','are','was','were','be','been','have','has','had','do',
    'use','used','using','into','via','per','each','also','only','some','any',
    'all','more','most','other','real','time','based','support','that','this',
    'these','those','its','their','both','such','about','across','through',
  ]);
  return (
    prompt
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !stop.has(w.toLowerCase()))
      .slice(0, 4)
      .map(w => w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('') || 'Architecture'
  );
}
import './CompareModelsModal.css';

interface ComparisonResult {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
  status: 'pending' | 'running' | 'success' | 'error';
  architecture?: any;
  metrics?: AIMetrics;
  error?: string;
  serviceCount?: number;
  connectionCount?: number;
  groupCount?: number;
  workflowSteps?: number;
}

interface CompareModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (architecture: any, prompt: string, sourceModel?: ModelType, sourceReasoningEffort?: ReasoningEffort) => void;
}

const CompareModelsModal: React.FC<CompareModelsModalProps> = ({ isOpen, onClose, onApply }) => {
  const availableModels = getAvailableModels();
  const currentSettings = getModelSettings();
  
  const [selectedModels, setSelectedModels] = useState<Set<ModelType>>(() => {
    const initial = new Set<ModelType>();
    availableModels.forEach(m => initial.add(m));
    return initial;
  });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(currentSettings.reasoningEffort);
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [criticModel, setCriticModel] = useState<ModelType>(() => {
    const avail = getAvailableModels();
    return (avail.includes('gpt-5.4' as ModelType) ? 'gpt-5.4' : avail[avail.length - 1]) as ModelType;
  });
  const [critiqueText, setCritiqueText] = useState<string | null>(null);
  const [critiqueByModel, setCritiqueByModel] = useState<ModelType | null>(null);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);

  // Avatar presenter state
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [captionWords, setCaptionWords] = useState<string[]>([]);
  const [captionWordIdx, setCaptionWordIdx] = useState<number>(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const presenterRef = useRef<AvatarPresenter | null>(null);
  // Speech region is the only build-time signal needed; keyless auth via /api/speech-token
  const isSpeechConfigured = !!import.meta.env.VITE_SPEECH_REGION;

  // Disconnect avatar when the modal closes
  useEffect(() => {
    if (!isOpen) {
      presenterRef.current?.disconnect();
      presenterRef.current = null;
      setAvatarStatus('idle');
      setAvatarError(null);
      setCaptionWords([]);
      setCaptionWordIdx(-1);
    };
  }, [isOpen]);

  /** Strip markdown syntax so TTS reads cleanly */
  const stripMd = (s: string) =>
    s.replace(/\*\*([^*]+)\*\*/g, '$1')
     .replace(/\*([^*]+)\*/g, '$1')
     .replace(/^#+\s*/gm, '')
     .replace(/^[-*]\s/gm, '')
     .trim();

  /** Extract Ranking + Recommendation sections from the critique for TTS */
  const extractPresentationText = (critique: string): string => {
    const rankingMatch = critique.match(/##\s*Overall Ranking\s*([\s\S]*?)(?=\n##|$)/);
    const recommendationMatch = critique.match(/##\s*Recommendation\s*([\s\S]*?)(?=\n##|$)/);
    const parts: string[] = [];
    if (rankingMatch) parts.push('Overall ranking. ' + stripMd(rankingMatch[1]));
    if (recommendationMatch) parts.push('My recommendation: ' + stripMd(recommendationMatch[1]));
    return parts.length > 0 ? parts.join('\n\n') : stripMd(critique.slice(0, 800));
  };

  const handlePresent = async () => {
    if (!critiqueText) return;
    // Set status to 'connecting' first so the panel renders and refs become populated
    setAvatarStatus('connecting');
    // Wait one tick for React to mount the panel and populate the refs
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!videoRef.current || !audioRef.current) return;
    try {
      if (!presenterRef.current?.isConnected) {
        const presenter = new AvatarPresenter({
          character: import.meta.env.VITE_AVATAR_CHARACTER || 'lisa',
          style: import.meta.env.VITE_AVATAR_STYLE || 'casual-sitting',
          voice: import.meta.env.VITE_AVATAR_VOICE || 'en-US-AvaMultilingualNeural',
          onStatus: setAvatarStatus,
          onError: (msg) => setAvatarError(msg),
          onWord: (idx) => setCaptionWordIdx(idx),
        });
        presenterRef.current = presenter;
        await presenter.connect(videoRef.current, audioRef.current);
      }
      const spokenText = extractPresentationText(critiqueText);
      setCaptionWords(spokenText.split(/\s+/).filter(Boolean));
      setCaptionWordIdx(-1);
      await presenterRef.current!.speak(spokenText);
    } catch {
      // Errors surfaced via onError / onStatus callbacks
    }
  };

  const handleStopPresenting = () => presenterRef.current?.stopSpeaking();

  const handleDismissAvatar = () => {
    presenterRef.current?.disconnect();
    presenterRef.current = null;
    setAvatarStatus('idle');
    setAvatarError(null);
    setCaptionWords([]);
    setCaptionWordIdx(-1);
  };

  const toggleModel = (model: ModelType) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) {
        if (next.size > 1) next.delete(model); // keep at least 1
      } else {
        next.add(model);
      }
      return next;
    });
  };

  const runComparison = async () => {
    if (!prompt.trim() || selectedModels.size === 0) return;
    if (!isAzureOpenAIConfigured()) return;

    setIsRunning(true);
    const models = Array.from(selectedModels);

    // Initialize results
    const initial: ComparisonResult[] = models.map(m => ({
      model: m,
      reasoningEffort: MODEL_CONFIG[m].isReasoning ? reasoningEffort : 'medium',
      status: 'pending',
    }));
    setResults(initial);

    // Run all models in parallel
    const promises = models.map(async (model, idx) => {
      // Mark as running
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'running' as const } : r));

      const override: ModelOverride = {
        model,
        reasoningEffort: MODEL_CONFIG[model].isReasoning ? reasoningEffort : 'medium',
      };

      try {
        const result = await generateArchitectureWithAI(prompt, override);
        const arch = result;
        const metrics: AIMetrics = result.metrics;

        const serviceCount = arch.services?.length || 0;
        const connectionCount = arch.connections?.length || 0;
        const groupCount = arch.groups?.length || 0;
        const workflowSteps = arch.workflow?.length || 0;

        setResults(prev => prev.map((r, i) => i === idx ? {
          ...r,
          status: 'success' as const,
          architecture: arch,
          metrics,
          serviceCount,
          connectionCount,
          groupCount,
          workflowSteps,
        } : r));
      } catch (err: any) {
        setResults(prev => prev.map((r, i) => i === idx ? {
          ...r,
          status: 'error' as const,
          error: err.message || 'Unknown error',
        } : r));
      }
    });

    await Promise.allSettled(promises);
    setIsRunning(false);
  };

  const handleApply = (result: ComparisonResult) => {
    if (result.architecture) {
      onApply(result.architecture, prompt, result.model, result.reasoningEffort);
      onClose();
    }
  };

  const buildCritiqueSummary = (): string => {
    const successful = results.filter(r => r.status === 'success');
    return successful.map(r => {
      const name = MODEL_CONFIG[r.model].displayName;
      const services = r.architecture?.services?.map((s: any) => s.name).join(', ') || 'none';
      const groups = r.architecture?.groups?.map((g: any) => g.label || g.id).join(', ') || 'none';
      const syncCount = r.architecture?.connections?.filter((c: any) => !c.type || c.type === 'sync').length || 0;
      const asyncCount = r.architecture?.connections?.filter((c: any) => c.type === 'async').length || 0;
      const optionalCount = r.architecture?.connections?.filter((c: any) => c.type === 'optional').length || 0;
      const workflowLines = r.architecture?.workflow
        ?.map((w: any) => `  ${w.step}. ${w.description}`).join('\n') || '';
      return [
        `### ${name}`,
        `Services (${r.serviceCount}): ${services}`,
        `Groups (${r.groupCount}): ${groups}`,
        `Connections: ${r.connectionCount} total (${syncCount} sync, ${asyncCount} async, ${optionalCount} optional)`,
        `Workflow:`,
        workflowLines,
      ].join('\n');
    }).join('\n\n');
  };

  const runCritique = async () => {
    setCritiqueText(null);
    setCritiqueError(null);
    setIsCritiquing(true);
    const chosenModel = criticModel;
    try {
      const summary = buildCritiqueSummary();
      const override: ModelOverride = {
        model: chosenModel,
        reasoningEffort: MODEL_CONFIG[chosenModel].isReasoning ? reasoningEffort : 'medium',
      };
      const { content } = await generateCritique(summary, prompt, override);
      setCritiqueText(content);
      setCritiqueByModel(chosenModel);
    } catch (err: any) {
      setCritiqueError(err.message || 'Failed to generate critique');
    } finally {
      setIsCritiquing(false);
    }
  };

  /** Download a single JSON blob */
  const downloadJson = (data: object, filename: string) => {
    const json = JSON.stringify(data, null, 2);
    const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
  };

  /** Save each successful result as an individual diagram JSON */
  const saveAllDiagrams = async () => {
    const ts = Date.now();
    const successful = results.filter(r => r.status === 'success' && r.architecture);
    for (let i = 0; i < successful.length; i++) {
      const r = successful[i];
      const suffix = modelSuffix(r.model, r.reasoningEffort);
      const filename = `azure-diagram-${ts}-${suffix}.json`;
      const diagramData = {
        ...r.architecture,
        metadata: {
          prompt,
          model: r.model,
          modelDisplayName: MODEL_CONFIG[r.model].displayName,
          reasoningEffort: r.reasoningEffort,
          metrics: r.metrics,
          savedAt: new Date().toISOString(),
          source: 'model-comparison',
        },
      };
      downloadJson(diagramData, filename);
      // Small delay to avoid browser blocking rapid downloads
      if (i < successful.length - 1) {
        await new Promise(res => setTimeout(res, 150));
      }
    }
  };

  /** Save a single combined comparison report (JSON) */
  const saveComparisonReport = () => {
    const successful = results.filter(r => r.status === 'success');
    const report: Record<string, any> = {
      prompt,
      timestamp: new Date().toISOString(),
      reasoningEffort,
      modelCount: successful.length,
      results: {} as Record<string, any>,
    };
    for (const r of successful) {
      const key = modelSuffix(r.model, r.reasoningEffort);
      report.results[key] = {
        model: r.model,
        displayName: MODEL_CONFIG[r.model].displayName,
        metrics: r.metrics,
        serviceCount: r.serviceCount,
        connectionCount: r.connectionCount,
        groupCount: r.groupCount,
        workflowSteps: r.workflowSteps,
        architecture: r.architecture,
      };
    }
    const slug = promptToSlug(prompt);
    downloadJson(report, `${slug}-Model-Comparison.json`);
  };

  /** Download a markdown string as a .md file */
  const downloadMarkdown = (content: string, filename: string) => {
    const uri = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content);
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
  };

  /** Format the comparison results as a rich markdown report */
  const formatComparisonAsMarkdown = (): string => {
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'error');
    const fastest = successful.length > 0
      ? Math.min(...successful.map(r => r.metrics?.elapsedTimeMs || Infinity))
      : 0;
    const cheapest = successful.length > 0
      ? Math.min(...successful.map(r => r.metrics?.totalTokens || Infinity))
      : 0;
    const mdMostServices = successful.length > 0
      ? Math.max(...successful.map(r => r.serviceCount || 0))
      : 0;
    const mdMostConnections = successful.length > 0
      ? Math.max(...successful.map(r => r.connectionCount || 0))
      : 0;
    const mdMostThorough = successful.length > 0
      ? Math.max(...successful.map(r => (r.serviceCount || 0) + (r.connectionCount || 0) + (r.workflowSteps || 0)))
      : 0;

    let md = '';
    md += '# Model Comparison Report\n\n';
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    md += `**Prompt:** ${prompt}\n\n`;
    md += `**Reasoning Effort:** ${reasoningEffort}\n\n`;
    md += `**Models Compared:** ${successful.length} successful`;
    if (failed.length > 0) md += `, ${failed.length} failed`;
    md += '\n\n';

    // Summary table
    md += '## Summary\n\n';
    md += '| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |\n';
    md += '|-------|------|--------|----------|-------------|--------|----------------|\n';
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      const time = r.metrics?.elapsedTimeMs ? `${(r.metrics.elapsedTimeMs / 1000).toFixed(1)}s` : 'N/A';
      const tokens = r.metrics?.totalTokens?.toLocaleString() ?? 'N/A';
      const badges: string[] = [];
      if (r.metrics?.elapsedTimeMs === fastest) badges.push('⚡ Fastest');
      if (r.metrics?.totalTokens === cheapest) badges.push('💰 Cheapest');
      const thoroughScore = (r.serviceCount || 0) + (r.connectionCount || 0) + (r.workflowSteps || 0);
      if (thoroughScore === mdMostThorough && successful.length > 1) badges.push('🏆 Most Thorough');
      if (r.serviceCount === mdMostServices && successful.length > 1) badges.push('📦 Most Services');
      if (r.connectionCount === mdMostConnections && successful.length > 1) badges.push('🔗 Most Detailed');
      const badgeStr = badges.length > 0 ? ' ' + badges.join(' ') : '';
      md += `| **${name}**${badgeStr} | ${time} | ${tokens} | ${r.serviceCount ?? '-'} | ${r.connectionCount ?? '-'} | ${r.groupCount ?? '-'} | ${r.workflowSteps ?? '-'} |\n`;
    }
    md += '\n';

    // Token usage breakdown
    md += '## Token Usage\n\n';
    md += '| Model | Prompt Tokens | Completion Tokens | Total |\n';
    md += '|-------|--------------|-------------------|-------|\n';
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      const pIn = r.metrics?.promptTokens?.toLocaleString() ?? '-';
      const pOut = r.metrics?.completionTokens?.toLocaleString() ?? '-';
      const pTotal = r.metrics?.totalTokens?.toLocaleString() ?? '-';
      md += `| ${name} | ${pIn} | ${pOut} | ${pTotal} |\n`;
    }
    md += '\n';

    // Per-model details
    md += '## Architecture Details\n\n';
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      md += `### ${name}\n\n`;

      // Services
      if (r.architecture?.services?.length) {
        md += '**Services:**\n\n';
        md += '| Service | Type | Group |\n';
        md += '|---------|------|-------|\n';
        for (const s of r.architecture.services) {
          md += `| ${s.name} | ${s.type || '-'} | ${s.groupId || '-'} |\n`;
        }
        md += '\n';
      }

      // Groups
      if (r.architecture?.groups?.length) {
        md += '**Groups:** ';
        md += r.architecture.groups.map((g: any) => g.label || g.id).join(', ');
        md += '\n\n';
      }

      // Connections
      if (r.architecture?.connections?.length) {
        md += '**Connections:**\n\n';
        md += '| From | To | Label | Type |\n';
        md += '|------|----|-------|------|\n';
        for (const c of r.architecture.connections) {
          md += `| ${c.from} | ${c.to} | ${c.label || '-'} | ${c.type || 'sync'} |\n`;
        }
        md += '\n';
      }

      // Workflow
      if (r.architecture?.workflow?.length) {
        md += '**Workflow:**\n\n';
        for (const w of r.architecture.workflow) {
          md += `${w.step}. ${w.description}`;
          if (w.services?.length) md += ` _(${w.services.join(', ')})_`;
          md += '\n';
        }
        md += '\n';
      }

      md += '---\n\n';
    }

    // Failed models
    if (failed.length > 0) {
      md += '## Failed Models\n\n';
      for (const r of failed) {
        const name = MODEL_CONFIG[r.model].displayName;
        md += `- **${name}**: ${r.error || 'Unknown error'}\n`;
      }
      md += '\n';
    }

    // AI Critique (appended when generated)
    if (critiqueText && critiqueByModel) {
      md += '---\n\n';
      md += '## AI Critique\n\n';
      md += `*Reviewer: ${MODEL_CONFIG[critiqueByModel].displayName} — AI-generated analysis, verify independently.*\n\n`;
      md += critiqueText;
      md += '\n';
    }

    return md;
  };

  /** Save comparison report as Markdown */
  const saveComparisonReportMd = () => {
    const md = formatComparisonAsMarkdown();
    const slug = promptToSlug(prompt);
    downloadMarkdown(md, `${slug}-Model-Comparison.md`);
  };

  /** Save only the AI critique as a standalone Markdown file */
  const saveCritiqueAsMd = () => {
    if (!critiqueText || !critiqueByModel) return;
    const slug = promptToSlug(prompt);
    const reviewer = MODEL_CONFIG[critiqueByModel].displayName;
    const title = prompt.charAt(0).toUpperCase() + prompt.slice(1);
    let md = `# AI Critique — ${title}\n\n`;
    md += `**Generated:** ${new Date().toISOString()}

`;
    md += `**Original Prompt:** ${prompt}

`;
    md += `**Reviewer Model:** ${reviewer}

`;
    md += `*AI-generated analysis — verify independently.*

---

`;
    md += critiqueText;
    downloadMarkdown(md, `${slug}-AI-Critique-by-${reviewer.replace(/[^a-zA-Z0-9]/g, '')}.md`);
  };

  const completedCount = results.filter(r => r.status === 'success' || r.status === 'error').length;
  const hasResults = results.length > 0;

  // Find best metrics for highlighting
  const successResults = results.filter(r => r.status === 'success');
  const fastestTime = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.elapsedTimeMs || Infinity))
    : 0;
  const leastTokens = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.totalTokens || Infinity))
    : 0;
  const mostServices = successResults.length > 0
    ? Math.max(...successResults.map(r => r.serviceCount || 0))
    : 0;
  const mostConnections = successResults.length > 0
    ? Math.max(...successResults.map(r => r.connectionCount || 0))
    : 0;
  const mostThoroughScore = successResults.length > 0
    ? Math.max(...successResults.map(r => (r.serviceCount || 0) + (r.connectionCount || 0) + (r.workflowSteps || 0)))
    : 0;

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compare-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <GitCompare size={20} />
            <h2>Compare Models</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="compare-modal-body">
          {/* Model Selection */}
          <div className="compare-section">
            <h3 className="compare-section-title">Select Models to Compare</h3>
            <div className="compare-model-grid">
              {availableModels.map(model => {
                const config = MODEL_CONFIG[model];
                const isSelected = selectedModels.has(model);
                return (
                  <button
                    key={model}
                    className={`compare-model-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleModel(model)}
                    disabled={isRunning}
                    title={config.description}
                  >
                    <span className="compare-model-chip-name">{config.displayName}</span>
                    {config.isReasoning && <span className="compare-model-chip-tag">reasoning</span>}
                  </button>
                );
              })}
            </div>

            {/* Reasoning effort for reasoning models */}
            {Array.from(selectedModels).some(m => MODEL_CONFIG[m].isReasoning) && (
              <div className="compare-reasoning-row">
                <span>Reasoning Effort (for reasoning models):</span>
                <div className="compare-reasoning-buttons">
                  {(['none', 'low', 'medium', 'high'] as ReasoningEffort[]).map(level => (
                    <button
                      key={level}
                      className={`compare-reasoning-btn ${reasoningEffort === level ? 'active' : ''}`}
                      onClick={() => setReasoningEffort(level)}
                      disabled={isRunning}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="compare-section">
            <h3 className="compare-section-title">Architecture Prompt</h3>
            <div className="compare-sample-prompts">
              {[
                'E-commerce platform with payments and search',
                'Real-time IoT telemetry pipeline with dashboards',
                'Microservices app with API gateway and auth',
                'RAG chatbot with vector search and AI'
              ].map((sample) => (
                <button
                  key={sample}
                  className="compare-sample-chip"
                  onClick={() => setPrompt(sample)}
                  disabled={isRunning}
                >
                  {sample}
                </button>
              ))}
            </div>
            <div className="compare-sample-prompts">
              {[
                'A zero trust enterprise network with Azure Firewall, Application Gateway with WAF, Private Link for PaaS, Bastion for VM access, and Microsoft Entra ID with Conditional Access',
                'An industrial IoT platform with 5,000+ sensors, real-time anomaly detection, IoT Hub for ingestion, Stream Analytics for processing, and Azure ML for predictive models',
                'A healthcare data platform with FHIR API, HIPAA-compliant storage, real-time patient monitoring, Azure Health Data Services, and Power BI for clinical dashboards',
                'A multi-region e-commerce system with Cosmos DB for global product catalog, Azure Front Door for traffic routing, Redis Cache for sessions, and Event Grid for order processing'
              ].map((sample) => (
                <button
                  key={sample}
                  className="compare-sample-chip"
                  onClick={() => setPrompt(sample)}
                  disabled={isRunning}
                >
                  {sample}
                </button>
              ))}
            </div>
            <div className="compare-sample-prompts">
              {[
                'An intelligent document processing pipeline with Azure AI Document Intelligence for OCR, Azure OpenAI for summarization, Cognitive Search for indexing, Cosmos DB for metadata, and Blob Storage for document retention',
                'An enterprise RAG application with Azure AI Foundry for orchestration, Azure AI Search with hybrid vector and keyword retrieval, Azure OpenAI GPT-5 for generation, Azure Cache for Redis for semantic caching, and App Service with Entra ID authentication',
                'A multi-modal AI platform with Azure OpenAI for text and vision, Azure AI Speech for real-time transcription, Azure AI Translator for multilingual support, Event Hubs for streaming ingest, and Application Insights for model observability'
              ].map((sample) => (
                <button
                  key={sample}
                  className="compare-sample-chip"
                  onClick={() => setPrompt(sample)}
                  disabled={isRunning}
                >
                  {sample}
                </button>
              ))}
            </div>
            <textarea
              className="compare-prompt"
              placeholder="Describe the Azure architecture you want to compare across models..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              disabled={isRunning}
            />
          </div>

          {/* Run Button */}
          {!hasResults && (
            <button
              className="btn btn-primary compare-run-btn"
              onClick={runComparison}
              disabled={isRunning || !prompt.trim() || selectedModels.size < 2}
            >
              <GitCompare size={18} />
              Compare {selectedModels.size} Models
            </button>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="compare-progress">
              <Loader2 size={16} className="spinner" />
              <span>Running {completedCount}/{results.length} models...</span>
            </div>
          )}

          {/* Results Grid */}
          {hasResults && (
            <div className="compare-section">
              <h3 className="compare-section-title">
                Results
                {!isRunning && successResults.length > 0 && (
                  <div className="compare-save-actions">
                    <button
                      className="compare-save-btn"
                      onClick={saveAllDiagrams}
                      title="Download each model's diagram as a separate JSON file"
                    >
                      <Download size={14} />
                      Save All Diagrams
                    </button>
                    <button
                      className="compare-save-btn compare-save-report-btn"
                      onClick={saveComparisonReport}
                      title="Download a single JSON with all results for side-by-side analysis"
                    >
                      <FileJson size={14} />
                      Save JSON
                    </button>
                    <button
                      className="compare-save-btn compare-save-report-btn"
                      onClick={saveComparisonReportMd}
                      title="Download a formatted Markdown report for easy reading and sharing"
                    >
                      <FileText size={14} />
                      Save Markdown
                    </button>
                  </div>
                )}
                {!isRunning && (
                  <button
                    className="compare-rerun-btn"
                    onClick={() => { setResults([]); setCritiqueText(null); setCritiqueError(null); setCritiqueByModel(null); handleDismissAvatar(); }}
                    title="Clear results and try again"
                  >
                    New Comparison
                  </button>
                )}
              </h3>
              <div className="compare-results-grid">
                {results.map((result, idx) => (
                  <div key={idx} className={`compare-result-card ${result.status}`}>
                    <div className="compare-result-header">
                      <span className="compare-result-model">{MODEL_CONFIG[result.model].displayName}</span>
                      {result.status === 'running' && <Loader2 size={14} className="spinner" />}
                      {result.status === 'success' && <CheckCircle size={14} className="compare-icon-success" />}
                      {result.status === 'error' && <AlertCircle size={14} className="compare-icon-error" />}
                    </div>

                    {result.status === 'pending' && (
                      <div className="compare-result-pending">Waiting...</div>
                    )}

                    {result.status === 'running' && (
                      <div className="compare-result-running">Generating...</div>
                    )}

                    {result.status === 'error' && (
                      <div className="compare-result-error-msg">{result.error}</div>
                    )}

                    {result.status === 'success' && result.metrics && (
                      <>
                        {/* Metrics */}
                        <div className="compare-result-metrics">
                          <div className={`compare-metric ${result.metrics.elapsedTimeMs === fastestTime ? 'highlight' : ''}`}>
                            <Clock size={12} />
                            <span>{(result.metrics.elapsedTimeMs / 1000).toFixed(1)}s</span>
                            {result.metrics.elapsedTimeMs === fastestTime && <span className="compare-badge">Fastest</span>}
                          </div>
                          <div className={`compare-metric ${result.metrics.totalTokens === leastTokens ? 'highlight' : ''}`}>
                            <Zap size={12} />
                            <span>{result.metrics.totalTokens?.toLocaleString()} tokens</span>
                            {result.metrics.totalTokens === leastTokens && <span className="compare-badge">Cheapest</span>}
                          </div>
                          {((result.serviceCount || 0) + (result.connectionCount || 0) + (result.workflowSteps || 0)) === mostThoroughScore && successResults.length > 1 && (
                            <div className="compare-metric highlight">
                              <span className="compare-badge badge-thorough">Most Thorough</span>
                            </div>
                          )}
                        </div>

                        {/* Architecture Stats */}
                        <div className="compare-result-stats">
                          <div className={`compare-stat ${result.serviceCount === mostServices ? 'highlight' : ''}`}>
                            <span className="compare-stat-value">{result.serviceCount}</span>
                            <span className="compare-stat-label">Services</span>
                            {result.serviceCount === mostServices && successResults.length > 1 && <span className="compare-badge badge-services">Most</span>}
                          </div>
                          <div className={`compare-stat ${result.connectionCount === mostConnections ? 'highlight' : ''}`}>
                            <span className="compare-stat-value">{result.connectionCount}</span>
                            <span className="compare-stat-label">Connections</span>
                            {result.connectionCount === mostConnections && successResults.length > 1 && <span className="compare-badge badge-detailed">Most</span>}
                          </div>
                          <div className="compare-stat">
                            <span className="compare-stat-value">{result.groupCount}</span>
                            <span className="compare-stat-label">Groups</span>
                          </div>
                          <div className="compare-stat">
                            <span className="compare-stat-value">{result.workflowSteps}</span>
                            <span className="compare-stat-label">Workflow Steps</span>
                          </div>
                        </div>

                        {/* Token breakdown */}
                        <div className="compare-result-tokens">
                          <span>{result.metrics.promptTokens?.toLocaleString()} in</span>
                          <span>→</span>
                          <span>{result.metrics.completionTokens?.toLocaleString()} out</span>
                        </div>

                        {/* Apply button */}
                        <button
                          className="btn btn-primary compare-apply-btn"
                          onClick={() => handleApply(result)}
                        >
                          <Sparkles size={14} />
                          Use This Architecture
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Critique section */}
          {!isRunning && successResults.length >= 2 && (
            <div className="compare-section">
              <h3 className="compare-section-title">
                <Brain size={16} style={{ marginRight: 6 }} />
                AI Critique
              </h3>
              <div className="compare-critique-controls">
                <span className="compare-critique-label">Critic model:</span>
                <select
                  className="compare-critique-model-select"
                  value={criticModel}
                  onChange={e => setCriticModel(e.target.value as ModelType)}
                  disabled={isCritiquing}
                >
                  {availableModels.map(m => (
                    <option key={m} value={m}>{MODEL_CONFIG[m].displayName}</option>
                  ))}
                </select>
                <button
                  className="compare-save-btn compare-critique-btn"
                  onClick={runCritique}
                  disabled={isCritiquing}
                >
                  {isCritiquing ? <Loader2 size={14} className="spinner" /> : <Brain size={14} />}
                  {isCritiquing ? 'Analyzing...' : (critiqueText ? 'Regenerate Critique' : 'Generate AI Critique')}
                </button>
                {critiqueText && !isCritiquing && (
                  <button
                    className="compare-save-btn compare-save-report-btn"
                    onClick={saveCritiqueAsMd}
                    title="Save the AI critique as a standalone Markdown file"
                  >
                    <FileText size={14} />
                    Save Critique
                  </button>
                )}
                {critiqueText && !isCritiquing && isSpeechConfigured && (
                  <button
                    className={`compare-save-btn compare-avatar-btn${avatarStatus === 'speaking' ? ' active' : ''}`}
                    onClick={avatarStatus === 'speaking' ? handleStopPresenting : handlePresent}
                    disabled={avatarStatus === 'connecting'}
                    title={avatarStatus === 'speaking' ? 'Stop the avatar presentation' : 'Have an AI avatar present the ranking and recommendation'}
                  >
                    {avatarStatus === 'connecting'
                      ? <Loader2 size={14} className="spinner" />
                      : avatarStatus === 'speaking'
                      ? <StopCircle size={14} />
                      : <MonitorPlay size={14} />}
                    {avatarStatus === 'connecting' ? 'Connecting...' : avatarStatus === 'speaking' ? 'Stop' : 'Present'}
                  </button>
                )}
              </div>
              {critiqueError && (
                <div className="compare-critique-error">{critiqueError}</div>
              )}
              {critiqueText && critiqueByModel && (
                <div className="compare-critique-output">
                  <div className="compare-critique-reviewer">
                    Reviewed by {MODEL_CONFIG[critiqueByModel].displayName}
                  </div>
                  <pre className="compare-critique-text">{critiqueText}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Avatar Presenter Panel — always in DOM so refs are populated */}
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        <div className="compare-avatar-panel" style={avatarStatus === 'idle' ? { display: 'none' } : undefined}>
            <div className="compare-avatar-panel-header">
              <span className="compare-avatar-panel-title">
                {avatarStatus === 'connecting' && <Loader2 size={12} className="spinner" />}
                {avatarStatus === 'connecting' ? ' Connecting...' :
                 avatarStatus === 'speaking' ? '▶ Presenting' :
                 avatarStatus === 'error' ? 'Error' : 'Ready'}
              </span>
              <button className="compare-avatar-dismiss" onClick={handleDismissAvatar} title="Dismiss avatar">
                <VideoOff size={13} />
              </button>
            </div>
            <div className="compare-avatar-video-wrap">
              {avatarStatus === 'connecting' && (
                <div className="compare-avatar-connecting">
                  <Loader2 size={28} className="spinner" />
                  <span>Starting avatar session…</span>
                </div>
              )}
              {avatarStatus === 'error' && (
                <div className="compare-avatar-error-display">{avatarError}</div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="compare-avatar-video"
                style={{ display: avatarStatus === 'connecting' ? 'none' : 'block' }}
              />
              <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
            </div>
            {/* Live closed captions — word-by-word highlight */}
            {captionWords.length > 0 && avatarStatus === 'speaking' && (
              <div className="compare-avatar-captions">
                {captionWords.map((word, i) => (
                  <span
                    key={i}
                    className={`compare-avatar-caption-word${i === captionWordIdx ? ' active' : ''}`}
                  >{word}{' '}</span>
                ))}
              </div>
            )}
            {(avatarStatus === 'ready' || avatarStatus === 'speaking') && critiqueText && (
              <div className="compare-avatar-panel-controls">
                {avatarStatus === 'speaking'
                  ? <button className="compare-avatar-action-btn stop" onClick={handleStopPresenting}><StopCircle size={13} /> Stop</button>
                  : <button className="compare-avatar-action-btn" onClick={handlePresent}><MonitorPlay size={13} /> Re-present</button>}
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default CompareModelsModal;

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Loader2, Clock, Zap, CheckCircle, AlertCircle, GitCompare, FileJson, FileText, Shield, AlertTriangle, Info, Brain, MonitorPlay, StopCircle } from 'lucide-react';
import { isAzureOpenAIConfigured, generateValidationCritique, ModelOverride } from '../services/azureOpenAI';
import { validateArchitecture, ArchitectureValidation, ValidationModelOverride, AIMetrics } from '../services/architectureValidator';
import { buildValidationConsensus, renderConsensusMarkdown, ConsensusResult } from '../services/validationConsensus';
import { trackValidationCompared, trackValidationCritiqueRanked, trackValidationFindings } from '../services/telemetryService';

/** Parse the critique's #1-ranked / recommended model from its Markdown. */
function parseCritiqueWinner(text: string): string | null {
  const rec = text.match(/##\s*Recommendation[\s\S]*?\*\*([^*]+)\*\*/i);
  if (rec) return rec[1].trim();
  const rank = text.match(/(?:^|\n)\s*1\.\s*\*\*([^*]+)\*\*/);
  return rank ? rank[1].trim() : null;
}
import { bandLabel, scoreToBand } from '../services/wafMaturity';
import { useValidationDisplayPrefs } from '../stores/validationDisplayStore';
import { useDraggableResizable } from '../hooks/useDraggableResizable';
import { AvatarPresenter, AvatarStatus } from '../services/avatarPresenter';
import {
  MODEL_CONFIG,
  ModelType,
  ReasoningEffort,
  getAvailableModels,
  getModelSettings,
} from '../stores/modelSettingsStore';
import './CompareValidationModal.css';
// Critique + avatar panel styles live in CompareModelsModal.css (shared compare-* classes).
import './CompareModelsModal.css';

/** Abbreviate model name for filenames */
function abbreviateModelForFile(model: ModelType): string {
  const map: Record<string, string> = {
    'gpt-5.1': 'gpt51', 'gpt-5.2': 'gpt52', 'gpt-5.2-codex': 'gpt52codex',
    'gpt-5.3-codex': 'gpt53codex', 'gpt-5.4': 'gpt54', 'gpt-5.4-mini': 'gpt54mini',
    'deepseek-v3.2-speciale': 'deepseek', 'grok-4.1-fast': 'grok41fast',
    'kimi-k2-5': 'kimik25', 'kimi-k2-7-code': 'kimik27code',
  };
  return map[model] || 'unknown';
}

/** Build a model suffix like "gpt52-medium" or "deepseek" */
function modelSuffix(model: ModelType, effort: ReasoningEffort): string {
  const abbr = abbreviateModelForFile(model);
  return MODEL_CONFIG[model].isReasoning ? `${abbr}-${effort}` : abbr;
}

interface ValidationComparisonResult {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
  status: 'pending' | 'running' | 'success' | 'error';
  validation?: ArchitectureValidation;
  metrics?: AIMetrics;
  error?: string;
  overallScore?: number;
  totalFindings?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  pillarScores?: { pillar: string; score: number }[];
  quickWinCount?: number;
}

interface CompareValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (validation: ArchitectureValidation) => void;
  /** Current architecture data to validate */
  services: Array<{ name: string; type: string; category: string; description?: string }>;
  connections: Array<{ from: string; to: string; label: string }>;
  groups?: Array<{ name: string; services?: string[] }>;
  architectureDescription?: string;
}

const CompareValidationModal: React.FC<CompareValidationModalProps> = ({
  isOpen, onClose, onApply, services, connections, groups, architectureDescription,
}) => {
  const availableModels = getAvailableModels();
  const currentSettings = getModelSettings();

  const [selectedModels, setSelectedModels] = useState<Set<ModelType>>(() => {
    const initial = new Set<ModelType>();
    availableModels.forEach(m => initial.add(m));
    return initial;
  });
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(currentSettings.reasoningEffort);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ValidationComparisonResult[]>([]);

  // Display preference: show raw 0-100 scores alongside maturity bands.
  // Shared with the single-model ValidationModal so the choice is consistent
  // and persists across both surfaces. Ranking logic (Best Score / ⭐) always
  // uses the numeric score regardless of this display toggle.
  const [displayPrefs, setDisplayPrefs] = useValidationDisplayPrefs();

  // --- AI Critique state ---
  const [criticModel, setCriticModel] = useState<ModelType>(() => {
    const avail = getAvailableModels();
    return (avail.includes('gpt-5.4' as ModelType) ? 'gpt-5.4' : avail[avail.length - 1]) as ModelType;
  });
  const [critiqueText, setCritiqueText] = useState<string | null>(null);
  const [critiqueByModel, setCritiqueByModel] = useState<ModelType | null>(null);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [critiqueError, setCritiqueError] = useState<string | null>(null);

  // --- Avatar presenter state ---
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [captionWords, setCaptionWords] = useState<string[]>([]);
  const [captionWordIdx, setCaptionWordIdx] = useState<number>(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const presenterRef = useRef<AvatarPresenter | null>(null);
  const isSpeechConfigured = !!import.meta.env.VITE_SPEECH_REGION;

  const { geom: avatarGeom, onDragStart, onResizeStart, reset: resetAvatarGeom } = useDraggableResizable({
    initial: { x: Math.max(0, window.innerWidth - 420), y: Math.max(0, window.innerHeight - 420), w: 380, h: 360 },
    minW: 260, minH: 220, maxW: 640, maxH: 600,
  });

  // Disconnect avatar when the modal closes
  useEffect(() => {
    if (!isOpen) {
      presenterRef.current?.disconnect();
      presenterRef.current = null;
      setAvatarStatus('idle');
      setAvatarError(null);
      setCaptionWords([]);
      setCaptionWordIdx(-1);
    }
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
    setAvatarStatus('connecting');
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAvatarError(msg);
      setAvatarStatus('error');
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
    resetAvatarGeom();
  };

  const toggleModel = (model: ModelType) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(model)) {
        if (next.size > 1) next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };

  const runComparison = async () => {
    if (selectedModels.size === 0 || services.length === 0) return;
    if (!isAzureOpenAIConfigured()) return;

    setIsRunning(true);
    const models = Array.from(selectedModels);

    const initial: ValidationComparisonResult[] = models.map(m => ({
      model: m,
      reasoningEffort: MODEL_CONFIG[m].isReasoning ? reasoningEffort : 'medium',
      status: 'pending',
    }));
    setResults(initial);
    const collected: ValidationComparisonResult[] = [...initial];

    const promises = models.map(async (model, idx) => {
      setResults(prev => prev.map((r, i) => i === idx ? { ...r, status: 'running' as const } : r));

      const override: ValidationModelOverride = {
        model,
        reasoningEffort: MODEL_CONFIG[model].isReasoning ? reasoningEffort : 'medium',
      };

      try {
        const result = await validateArchitecture(
          services, connections, groups, architectureDescription, override
        );

        // Count findings by severity
        let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
        const pillarScores: { pillar: string; score: number }[] = [];

        for (const pillar of (result.pillars || [])) {
          pillarScores.push({ pillar: pillar.pillar, score: pillar.score });
          for (const f of (pillar.findings || [])) {
            if (f.severity === 'critical') criticalCount++;
            else if (f.severity === 'high') highCount++;
            else if (f.severity === 'medium') mediumCount++;
            else lowCount++;
          }
        }

        const totalFindings = criticalCount + highCount + mediumCount + lowCount;

        const entry: ValidationComparisonResult = {
          ...initial[idx],
          status: 'success',
          validation: result,
          metrics: result.metrics,
          overallScore: result.overallScore,
          totalFindings,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          pillarScores,
          quickWinCount: result.quickWins?.length || 0,
        };
        collected[idx] = entry;
        setResults(prev => prev.map((r, i) => i === idx ? entry : r));
      } catch (err: any) {
        const entry: ValidationComparisonResult = {
          ...initial[idx],
          status: 'error',
          error: err.message || 'Unknown error',
        };
        collected[idx] = entry;
        setResults(prev => prev.map((r, i) => i === idx ? entry : r));
      }
    });

    await Promise.allSettled(promises);
    setIsRunning(false);

    // Telemetry: the model-leaderboard flywheel.
    try {
      const ok = collected.filter(r => r.status === 'success' && r.validation);
      if (ok.length >= 2) {
        const cons = buildValidationConsensus(
          ok.map(r => ({ modelLabel: MODEL_CONFIG[r.model].displayName, validation: r.validation as ArchitectureValidation })),
        );
        const best = ok.reduce((a, b) => (b.overallScore ?? 0) > (a.overallScore ?? 0) ? b : a);
        trackValidationCompared({
          modelCount: ok.length,
          serviceCount: services.length,
          connectionCount: connections.length,
          reasoningEffort,
          perModel: ok.map(r => ({
            model: MODEL_CONFIG[r.model].displayName,
            score: r.overallScore ?? 0,
            findings: r.totalFindings ?? 0,
            high: r.highCount ?? 0,
            critical: r.criticalCount ?? 0,
            timeMs: r.metrics?.elapsedTimeMs ?? 0,
            tokens: r.metrics?.totalTokens ?? 0,
          })),
          consensusTotal: cons.findings.length,
          consensusHighConfidence: cons.highConfidenceCount,
          bestModel: MODEL_CONFIG[best.model].displayName,
          bestScore: best.overallScore ?? 0,
        });
        // Product-analytics signal: the consensus-confirmed gap topics.
        trackValidationFindings({
          source: 'consensus',
          model: 'multi',
          overallScore: best.overallScore ?? 0,
          serviceCount: services.length,
          topics: cons.findings
            .filter(f => f.confidenceBand !== 'exploratory')
            .map(f => ({ id: f.topicId, label: f.label, pillar: f.pillar, severity: f.severity })),
        });
      }
    } catch { /* telemetry must never break the UX */ }
  };

  const handleApply = (result: ValidationComparisonResult) => {
    if (result.validation) {
      onApply(result.validation);
      onClose();
    }
  };

  /** Build a condensed text summary of all validation results for the critic model. */
  const buildCritiqueSummary = (): string => {
    const successful = results.filter(r => r.status === 'success');
    return successful.map(r => {
      const name = MODEL_CONFIG[r.model].displayName;
      const pillars = (r.pillarScores || [])
        .map(p => `${p.pillar} ${p.score}/100`).join(', ') || 'none';
      const sevBreakdown = [
        `${r.criticalCount || 0} critical`,
        `${r.highCount || 0} high`,
        `${r.mediumCount || 0} medium`,
        `${r.lowCount || 0} low`,
      ].join(', ');
      // Top findings (cap to keep within token budget) — list every critical/high, sample mediums.
      const topFindings: string[] = [];
      for (const pillar of (r.validation?.pillars || [])) {
        for (const f of (pillar.findings || [])) {
          if (f.severity === 'critical' || f.severity === 'high') {
            topFindings.push(`  - [${f.severity.toUpperCase()}] (${pillar.pillar}/${f.category}) ${f.issue} → ${f.recommendation}`);
          }
        }
      }
      // If no critical/high, surface a few mediums so the critic has something to evaluate.
      if (topFindings.length === 0) {
        for (const pillar of (r.validation?.pillars || [])) {
          for (const f of (pillar.findings || []).slice(0, 2)) {
            topFindings.push(`  - [${f.severity.toUpperCase()}] (${pillar.pillar}/${f.category}) ${f.issue} → ${f.recommendation}`);
          }
        }
      }
      const findingsBlock = topFindings.length > 0
        ? `Top findings:\n${topFindings.slice(0, 12).join('\n')}`
        : 'Top findings: (none surfaced)';
      const quickWins = (r.validation?.quickWins || [])
        .slice(0, 5)
        .map(qw => `  - (${qw.category}) ${qw.recommendation}`)
        .join('\n');
      const quickWinsBlock = quickWins ? `Quick wins:\n${quickWins}` : 'Quick wins: (none)';
      const summaryLine = r.validation?.summary ? `Summary: ${r.validation.summary}` : '';
      return [
        `### ${name}`,
        `Overall score: ${r.overallScore}/100`,
        `Pillar scores: ${pillars}`,
        `Findings: ${r.totalFindings} total (${sevBreakdown})`,
        summaryLine,
        findingsBlock,
        quickWinsBlock,
      ].filter(Boolean).join('\n');
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
      const { content } = await generateValidationCritique(
        summary,
        architectureDescription || '',
        override
      );
      setCritiqueText(content);
      setCritiqueByModel(chosenModel);
      try {
        trackValidationCritiqueRanked({
          criticModel: MODEL_CONFIG[chosenModel].displayName,
          winnerModel: parseCritiqueWinner(content) || 'unknown',
          modelCount: results.filter(r => r.status === 'success').length,
        });
      } catch { /* telemetry must never break the UX */ }
    } catch (err: any) {
      setCritiqueError(err.message || 'Failed to generate critique');
    } finally {
      setIsCritiquing(false);
    }
  };

  /** Save only the AI critique as a standalone Markdown file. */
  const saveCritiqueAsMd = () => {
    if (!critiqueText || !critiqueByModel) return;
    const ts = Date.now();
    const reviewer = MODEL_CONFIG[critiqueByModel].displayName;
    let md = `# AI Critique — Architecture Validation Comparison\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    if (architectureDescription) {
      md += `**Architecture:** ${architectureDescription}\n\n`;
    }
    md += `**Reviewer Model:** ${reviewer}\n\n`;
    md += `*AI-generated analysis — verify independently.*\n\n---\n\n`;
    md += critiqueText;
    downloadMarkdown(md, `validation-critique-${ts}-by-${reviewer.replace(/[^a-zA-Z0-9]/g, '')}.md`);
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

  /** Download a markdown string as a .md file */
  const downloadMarkdown = (content: string, filename: string) => {
    const uri = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content);
    const a = document.createElement('a');
    a.href = uri;
    a.download = filename;
    a.click();
  };

  /** Save a single combined comparison report */
  const saveComparisonReport = () => {
    const ts = Date.now();
    const successful = results.filter(r => r.status === 'success');
    const report: Record<string, any> = {
      type: 'validation-comparison',
      timestamp: new Date().toISOString(),
      architectureDescription,
      serviceCount: services.length,
      connectionCount: connections.length,
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
        overallScore: r.overallScore,
        totalFindings: r.totalFindings,
        criticalCount: r.criticalCount,
        highCount: r.highCount,
        mediumCount: r.mediumCount,
        lowCount: r.lowCount,
        pillarScores: r.pillarScores,
        quickWinCount: r.quickWinCount,
        validation: r.validation,
      };
    }
    downloadJson(report, `validation-comparison-${ts}.json`);
  };

  /** Format the comparison results as a markdown report */
  const formatComparisonAsMarkdown = (): string => {
    const successful = results.filter(r => r.status === 'success');
    const date = new Date().toLocaleString();

    let md = `# 🔍 Architecture Validation Comparison Report\n\n`;
    md += `**Generated:** ${date}\n`;
    md += `**Reasoning Effort:** ${reasoningEffort}\n`;
    md += `**Models Compared:** ${successful.length}\n\n`;

    if (architectureDescription) {
      md += `## Architecture\n\n${architectureDescription}\n\n`;
    }
    md += `**Services:** ${services.length} | **Connections:** ${connections.length}\n\n`;
    md += `---\n\n`;

    // Summary table
    md += `## 📊 Overall Comparison\n\n`;
    md += `| Model | Maturity | Score | Findings | Critical | High | Medium | Low | Quick Wins | Time | Tokens |\n`;
    md += `|-------|----------|-------|----------|----------|------|--------|-----|------------|------|--------|\n`;
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      const scoreIcon = (r.overallScore || 0) >= 80 ? '🟢' : (r.overallScore || 0) >= 60 ? '🟡' : '🔴';
      const maturity = bandLabel(r.overallScore || 0);
      const time = r.metrics ? `${(r.metrics.elapsedTimeMs / 1000).toFixed(1)}s` : '-';
      const tokens = r.metrics?.totalTokens?.toLocaleString() || '-';
      const best = r.overallScore === highestScore ? ' ⭐' : '';
      md += `| ${name}${best} | ${maturity} | ${scoreIcon} ${r.overallScore}/100 | ${r.totalFindings} | ${r.criticalCount} | ${r.highCount} | ${r.mediumCount} | ${r.lowCount} | ${r.quickWinCount} | ${time} | ${tokens} |\n`;
    }
    md += `\n`;

    // Pillar comparison table
    const allPillars = successful[0]?.pillarScores?.map(p => p.pillar) || [];
    if (allPillars.length > 0) {
      md += `## 🏗️ Pillar Score Comparison\n\n`;
      md += `| Pillar | ${successful.map(r => MODEL_CONFIG[r.model].displayName).join(' | ')} |\n`;
      md += `|--------|${successful.map(() => '------').join('|')}|\n`;
      for (const pillar of allPillars) {
        const scores = successful.map(r => {
          const ps = r.pillarScores?.find(p => p.pillar === pillar);
          const score = ps?.score || 0;
          const icon = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
          return `${icon} ${score}/100`;
        });
        md += `| ${pillar} | ${scores.join(' | ')} |\n`;
      }
      md += `\n`;
    }

    // Performance comparison
    md += `## ⚡ Performance Comparison\n\n`;
    md += `| Model | Elapsed Time | Prompt Tokens | Completion Tokens | Total Tokens |\n`;
    md += `|-------|-------------|---------------|-------------------|--------------|\n`;
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      const time = r.metrics ? `${(r.metrics.elapsedTimeMs / 1000).toFixed(1)}s` : '-';
      const prompt = r.metrics?.promptTokens?.toLocaleString() || '-';
      const completion = r.metrics?.completionTokens?.toLocaleString() || '-';
      const total = r.metrics?.totalTokens?.toLocaleString() || '-';
      const fastest = r.metrics?.elapsedTimeMs === fastestTime ? ' 🏆' : '';
      const cheapest = r.metrics?.totalTokens === leastTokens ? ' 💰' : '';
      md += `| ${name}${fastest}${cheapest} | ${time} | ${prompt} | ${completion} | ${total} |\n`;
    }
    md += `\n`;

    // Detailed findings per model
    md += `---\n\n`;
    md += `## 📋 Detailed Findings by Model\n\n`;
    for (const r of successful) {
      const name = MODEL_CONFIG[r.model].displayName;
      md += `### ${name} — ${bandLabel(r.overallScore || 0)} (${r.overallScore}/100)\n\n`;

      if (r.validation?.summary) {
        md += `**Summary:** ${r.validation.summary}\n\n`;
      }

      for (const pillar of (r.validation?.pillars || [])) {
        if (pillar.findings.length === 0) continue;
        md += `#### ${pillar.pillar} (${pillar.score}/100)\n\n`;
        for (const f of pillar.findings) {
          const emoji: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
          md += `${emoji[f.severity] || '⚪'} **${f.category}** [${f.severity.toUpperCase()}]\n\n`;
          md += `- **Issue:** ${f.issue}\n`;
          md += `- **Recommendation:** ${f.recommendation}\n`;
          if (f.resources && f.resources.length > 0) {
            md += `- **Resources:** ${f.resources.join(', ')}\n`;
          }
          md += `\n`;
        }
      }

      // Quick wins
      if (r.validation?.quickWins && r.validation.quickWins.length > 0) {
        md += `#### ⚡ Quick Wins\n\n`;
        for (const qw of r.validation.quickWins) {
          md += `- **${qw.category}:** ${qw.recommendation}\n`;
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }

    // Consensus findings (confidence-weighted across all models)
    if (consensus && consensus.findings.length > 0) {
      md += renderConsensusMarkdown(consensus);
      md += `\n---\n\n`;
    }

    // AI Critique (appended when generated)
    if (critiqueText && critiqueByModel) {
      md += `---\n\n`;
      md += `## 🧠 AI Critique\n\n`;
      md += `*Reviewer: ${MODEL_CONFIG[critiqueByModel].displayName} — AI-generated analysis, verify independently.*\n\n`;
      md += critiqueText;
      md += `\n\n`;
    }

    // Footer
    md += `*Report generated by Azure Architecture Diagram Builder*  \n`;
    md += `*Powered by Azure OpenAI and Azure Well-Architected Framework*  \n`;
    md += `*Generated: ${date}*\n`;

    return md;
  };

  /** Save comparison report as markdown */
  const saveComparisonReportMd = () => {
    const ts = Date.now();
    const md = formatComparisonAsMarkdown();
    downloadMarkdown(md, `validation-comparison-${ts}.md`);
  };

  const completedCount = results.filter(r => r.status === 'success' || r.status === 'error').length;
  const hasResults = results.length > 0;

  const successResults = results.filter(r => r.status === 'success');
  const highestScore = successResults.length > 0
    ? Math.max(...successResults.map(r => r.overallScore || 0))
    : 0;
  const fastestTime = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.elapsedTimeMs || Infinity))
    : 0;
  const leastTokens = successResults.length > 0
    ? Math.min(...successResults.map(r => r.metrics?.totalTokens || Infinity))
    : 0;
  const mostFindings = successResults.length > 0
    ? Math.max(...successResults.map(r => r.totalFindings || 0))
    : 0;

  // Confidence-weighted consensus across all successful model reviews.
  const consensus = useMemo<ConsensusResult | null>(() => {
    const inputs = results
      .filter(r => r.status === 'success' && r.validation)
      .map(r => ({ modelLabel: MODEL_CONFIG[r.model].displayName, validation: r.validation as ArchitectureValidation }));
    return inputs.length >= 2 ? buildValidationConsensus(inputs) : null;
  }, [results]);

  if (!isOpen) return null;

  const scoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const scoreLabel = (score: number) => {
    if (score >= 80) return '🟢';
    if (score >= 60) return '🟡';
    return '🔴';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="compare-modal cv-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header cv-header">
          <div className="modal-title">
            <Shield size={20} />
            <h2>Compare Validation Across Models</h2>
          </div>
          <div className="cv-header-actions">
            <label className="score-toggle" title="Show the underlying 0-100 numeric scores alongside the maturity bands">
              <input
                type="checkbox"
                checked={displayPrefs.showNumericScore}
                onChange={(e) => setDisplayPrefs({ showNumericScore: e.target.checked })}
              />
              <span>Show numeric score</span>
            </label>
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="compare-modal-body">
          {/* Architecture summary */}
          <div className="compare-section cv-arch-summary">
            <h3 className="compare-section-title">
              <Info size={16} />
              Architecture Being Validated
            </h3>
            <div className="cv-arch-info">
              <span className="cv-arch-stat">{services.length} services</span>
              <span className="cv-arch-dot">•</span>
              <span className="cv-arch-stat">{connections.length} connections</span>
              <span className="cv-arch-dot">•</span>
              <span className="cv-arch-stat">{groups?.length || 0} groups</span>
              {architectureDescription && (
                <>
                  <span className="cv-arch-dot">•</span>
                  <span className="cv-arch-desc">{architectureDescription.slice(0, 80)}{architectureDescription.length > 80 ? '...' : ''}</span>
                </>
              )}
            </div>
          </div>

          {/* WAF Pillars Info */}
          <div className="cv-waf-info">
            <p className="cv-waf-intro">
              Each model validates your architecture against the <strong>Azure Well-Architected Framework</strong> — 
              Microsoft's set of guiding tenets for improving the quality of cloud workloads across five pillars:
            </p>
            <div className="cv-waf-pillars">
              <span className="cv-waf-pillar"><strong>Cost Optimization</strong></span>
              <span className="cv-waf-pillar"><strong>Operational Excellence</strong></span>
              <span className="cv-waf-pillar"><strong>Performance Efficiency</strong></span>
              <span className="cv-waf-pillar"><strong>Reliability</strong></span>
              <span className="cv-waf-pillar"><strong>Security</strong></span>
            </div>
          </div>

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

          {/* Run Button */}
          {!hasResults && (
            <button
              className="btn btn-primary compare-run-btn"
              onClick={runComparison}
              disabled={isRunning || services.length === 0 || selectedModels.size < 2}
            >
              <GitCompare size={18} />
              Compare Validation Across {selectedModels.size} Models
            </button>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="compare-progress">
              <Loader2 size={16} className="spinner" />
              <span>Validating with {completedCount}/{results.length} models...</span>
            </div>
          )}

          {/* Results Grid */}
          {hasResults && (
            <div className="compare-section">
              <h3 className="compare-section-title">
                Validation Results
                {!isRunning && successResults.length > 0 && (
                  <div className="compare-save-actions">
                    <button
                      className="compare-save-btn compare-save-report-btn"
                      onClick={saveComparisonReport}
                      title="Download a single JSON with all validation results for analysis"
                    >
                      <FileJson size={14} />
                      Save JSON
                    </button>
                    <button
                      className="compare-save-btn compare-save-report-btn"
                      onClick={saveComparisonReportMd}
                      title="Download a formatted markdown report of the comparison"
                    >
                      <FileText size={14} />
                      Save Markdown
                    </button>
                  </div>
                )}
                {!isRunning && (
                  <button
                    className="compare-rerun-btn"
                    onClick={() => {
                      setResults([]);
                      setCritiqueText(null);
                      setCritiqueError(null);
                      setCritiqueByModel(null);
                      handleDismissAvatar();
                    }}
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
                      <div className="compare-result-running">Validating...</div>
                    )}

                    {result.status === 'error' && (
                      <div className="compare-result-error-msg">{result.error}</div>
                    )}

                    {result.status === 'success' && result.metrics && (
                      <>
                        {/* Overall WAF Score */}
                        <div className={`cv-score-display ${result.overallScore === highestScore ? 'cv-score-best' : ''}`}>
                          <div className="cv-score-circle" style={{ borderColor: scoreColor(result.overallScore || 0) }}>
                            {displayPrefs.showNumericScore ? (
                              <>
                                <span className="cv-score-value">{result.overallScore}</span>
                                <span className="cv-score-label">/ 100</span>
                              </>
                            ) : (
                              <span
                                className="cv-score-band-mark"
                                style={{ color: scoreColor(result.overallScore || 0) }}
                              >
                                {scoreToBand(result.overallScore || 0).short}
                              </span>
                            )}
                          </div>
                          <span className="cv-score-band" style={{ color: scoreColor(result.overallScore || 0) }}>
                            {bandLabel(result.overallScore || 0)}
                          </span>
                          {result.overallScore === highestScore && (
                            <span className="compare-badge cv-badge-score">Best Score</span>
                          )}
                        </div>

                        {/* Pillar Scores */}
                        <div className="cv-pillar-grid">
                          {result.pillarScores?.map((p, i) => (
                            <div key={i} className="cv-pillar-item">
                              <span className="cv-pillar-score" style={{ color: scoreColor(p.score) }}>
                                {displayPrefs.showNumericScore
                                  ? `${scoreLabel(p.score)} ${p.score}`
                                  : `${scoreLabel(p.score)} ${scoreToBand(p.score).short}`}
                              </span>
                              <span className="cv-pillar-name">{p.pillar}</span>
                            </div>
                          ))}
                        </div>

                        {/* Finding severity breakdown */}
                        <div className="cv-findings-bar">
                          <div className="cv-findings-header">
                            <AlertTriangle size={13} />
                            <span>{result.totalFindings} findings</span>
                            {result.totalFindings === mostFindings && result.totalFindings! > 0 && (
                              <span className="compare-badge cv-badge-findings">Most Thorough</span>
                            )}
                          </div>
                          <div className="cv-severity-row">
                            {result.criticalCount! > 0 && (
                              <span className="cv-sev cv-sev-critical">{result.criticalCount} critical</span>
                            )}
                            {result.highCount! > 0 && (
                              <span className="cv-sev cv-sev-high">{result.highCount} high</span>
                            )}
                            {result.mediumCount! > 0 && (
                              <span className="cv-sev cv-sev-medium">{result.mediumCount} medium</span>
                            )}
                            {result.lowCount! > 0 && (
                              <span className="cv-sev cv-sev-low">{result.lowCount} low</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Wins */}
                        {result.quickWinCount! > 0 && (
                          <div className="cv-quickwins">
                            ⚡ {result.quickWinCount} quick win{result.quickWinCount! > 1 ? 's' : ''}
                          </div>
                        )}

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
                          <Shield size={14} />
                          Use This Validation
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Consensus findings */}
          {!isRunning && consensus && consensus.findings.length > 0 && (
            <div className="compare-section cv-consensus">
              <h3 className="compare-section-title">
                🤝 Consensus Findings
                <span className="cv-consensus-sub">{consensus.totalModels} models · {consensus.highConfidenceCount} high-confidence</span>
              </h3>
              <p className="cv-consensus-intro">
                Merged across all models. Confidence = the share of models that independently flagged
                each topic — the more models agree, the more you can trust it. Single-model items are
                kept as <em>exploratory</em> so unique risks aren't lost.
              </p>
              <div className="cv-consensus-list">
                {consensus.findings.map(f => (
                  <div key={f.topicId} className={`cv-consensus-card band-${f.confidenceBand}`}>
                    <div className="cv-consensus-head">
                      <span className={`cv-conf-pill band-${f.confidenceBand}`}>
                        {f.confidenceBand === 'high' ? 'High' : f.confidenceBand === 'medium' ? 'Medium' : 'Exploratory'} · {f.modelCount}/{f.totalModels}
                      </span>
                      <span className={`cv-sev-badge sev-${f.severity}`}>{f.severity.toUpperCase()}</span>
                      <span className="cv-consensus-pillar">{f.pillar}</span>
                    </div>
                    <div className="cv-conf-bar"><span style={{ width: `${Math.round(f.confidence * 100)}%` }} /></div>
                    <div className="cv-consensus-label">{f.label}</div>
                    <div className="cv-consensus-issue">{f.issue}</div>
                    <div className="cv-consensus-rec"><strong>Fix:</strong> {f.recommendation}</div>
                    {f.resources.length > 0 && (
                      <div className="cv-consensus-resources">
                        {f.resources.map((r, i) => <span key={i} className="cv-res-chip">{r}</span>)}
                      </div>
                    )}
                    <div className="cv-consensus-models">Flagged by: {f.models.join(', ')}</div>
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
        <div
          className="compare-avatar-panel"
          style={avatarStatus === 'idle' ? { display: 'none' } : {
            left: avatarGeom.x,
            top: avatarGeom.y,
            width: avatarGeom.w,
            height: avatarGeom.h,
          }}
        >
          <div className="compare-avatar-panel-header" onPointerDown={onDragStart}>
            <span className="compare-avatar-panel-title">
              {avatarStatus === 'connecting' && <Loader2 size={12} className="spinner" />}
              {avatarStatus === 'connecting' ? ' Connecting...' :
               avatarStatus === 'speaking' ? '▶ Presenting' :
               avatarStatus === 'error' ? 'Error' : 'Ready'}
            </span>
            <button
              className="compare-avatar-dismiss"
              onClick={handleDismissAvatar}
              onPointerDown={e => e.stopPropagation()}
              title="Close"
            >
              ✕
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
          <div className="avatar-resize-handle" onPointerDown={onResizeStart} title="Drag to resize" />
        </div>
      </div>
    </div>
  );
};

export default CompareValidationModal;

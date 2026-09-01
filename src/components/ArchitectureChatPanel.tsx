// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, AlertCircle, AlertTriangle, MessageSquare, ChevronDown, ChevronUp, Shield, Activity, DollarSign, Wrench, Zap, Lightbulb, type LucideIcon } from 'lucide-react';
import { generateArchitectureWithAI, generateFollowUpSuggestions, isAzureOpenAIConfigured } from '../services/azureOpenAI';
import { useModelSettings, MODEL_CONFIG } from '../stores/modelSettingsStore';
import {
  buildModificationPrompt,
  CurrentArchitecture,
} from '../services/modificationPrompt';
import {
  removeUnrequestedServices,
  reviewRefinement,
  summarizeRefinementReview,
  type RefinementReview,
} from '../services/refinementGuard';
import './ArchitectureChatPanel.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  ts: number;
}

interface PendingRefinement {
  before: CurrentArchitecture;
  result: any;
  request: string;
  recentRequests: string[];
  review: RefinementReview;
}

interface ArchitectureChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentArchitecture: CurrentArchitecture;
  /** Bump to discard the conversation; the panel stays mounted when closed. */
  resetSignal?: number;
  /** Applies a generated architecture to the canvas (App's handleAIGenerate). */
  onApply: (architecture: any, prompt: string, autoSnapshot?: boolean) => void | Promise<void>;
}

// Cold start: when the canvas is empty, offer complete starter architectures
// so Chat works as a first-class entry point (not just a refinement tool).
const STARTER_SUGGESTIONS = [
  'Customer-facing web app on App Service with Azure SQL and Redis, fronted by Azure Front Door with a WAF policy and Application Insights',
  'Order-processing pipeline: Service Bus queue to Azure Functions to Cosmos DB, with dead-lettering and secrets in Key Vault',
  'Internal REST API on Container Apps backed by Azure SQL, secured with Entra ID and API Management',
  'Document-processing workflow: Blob Storage triggers Functions to run Azure AI Document Intelligence, results in Cosmos DB',
  'Private AI assistant on Microsoft Foundry: App Service uses VNet Integration to reach Azure OpenAI and Key Vault through their own private endpoints',
  'Microsoft Fabric analytics: Eventstream lands telemetry in an Eventhouse and Lakehouse, modeled in a Warehouse and published as a Power BI Report',
];

// Cold start (advanced): richer, enterprise-grade patterns revealed behind a
// "More ideas" toggle so first-timers aren't overwhelmed but power users can
// see the tool's ceiling.
const ADVANCED_STARTER_SUGGESTIONS = [
  'Multi-region active-active e-commerce platform: Front Door, AKS in paired regions, geo-replicated Cosmos DB, and Service Bus for order events',
  'Zero-trust data platform: App Service with VNet Integration reaching SQL Database, Key Vault, and Storage Account through one private endpoint each, with Azure DNS private zones',
  'HIPAA-compliant healthcare data platform: private-endpoint ingestion, AKS clinical workloads, Azure Health Data Services FHIR service, and Purview governance',
  'Enterprise landing zone: hub-and-spoke with Azure Firewall, Bastion, private DNS zones, and centralized Log Analytics',
  'Real-time fraud detection: Event Hubs to Stream Analytics to Azure Machine Learning scoring to Cosmos DB, with Event Grid alerting',
  'RAG knowledge platform: Microsoft Foundry with Azure OpenAI and AI Search over Cosmos DB, ingestion via Functions, all reached through private endpoints with Entra ID',
  'Connected factory: IoT Hub ingestion, Azure Digital Twins modeling, Stream Analytics hot path, Data Lake Storage cold path, and Azure Managed Grafana dashboards',
  'Fabric lakehouse medallion: Fabric Data Pipeline ingests to OneLake, Fabric Notebook and Spark Job curate the Lakehouse, and a Semantic Model drives a Real-Time Dashboard',
  'Event-driven microservices on AKS: KEDA autoscaling from Service Bus, Key Vault CSI driver, and private-link Container Registry',
];

// Warm start: once a diagram exists, offer incremental refinements. Used as a
// fallback when no context-aware "what's missing" suggestions apply.
const REFINE_SUGGESTIONS = [
  'Add Azure Front Door with a WAF policy for the application tier',
  'Make it zone-redundant for high availability',
  'Add a Redis cache between the API and the database',
  'Add monitoring with Application Insights and Log Analytics',
  'Give each data service its own private endpoint',
];

// Context-aware refinement suggestions: inspect the services already on the
// canvas and propose the most valuable *missing* Well-Architected additions
// (security, reliability, observability). Falls back to the static list when
// nothing obvious is missing so the panel is never empty.
function computeRefineSuggestions(nodes: any[]): string[] {
  const labels = nodes
    .filter((n) => n?.type === 'azureNode')
    .map((n) => String(n?.data?.label || '').toLowerCase());
  const has = (...needles: string[]) =>
    labels.some((l) => needles.some((needle) => l.includes(needle)));

  const suggestions: string[] = [];

  // Security / identity
  if (!has('key vault')) {
    suggestions.push('Add Key Vault and use managed identities for secrets');
  }
  if (!has('private endpoint', 'private link')) {
    suggestions.push('Give each data service its own private endpoint');
  } else if (!has('virtual network', 'vnet')) {
    suggestions.push('Add a Virtual Network and use VNet Integration for outbound private access');
  } else if (!has('dns')) {
    // Private endpoints only resolve to private IPs with a linked private DNS zone.
    suggestions.push('Add Azure DNS private zones so private endpoints resolve correctly');
  }
  if (!has('front door', 'application gateway', 'firewall', 'waf')) {
    suggestions.push('Add Azure Front Door with a WAF policy for the application tier');
  }
  // Observability
  if (!has('application insights', 'monitor', 'log analytics')) {
    suggestions.push('Add monitoring with Application Insights and Log Analytics');
  }
  // Reliability
  suggestions.push('Make it zone-redundant for high availability');
  if (has('sql database', 'cosmos', 'storage account', 'postgresql', 'mysql') && !has('backup')) {
    suggestions.push('Add Azure Backup for the data tier');
  }
  if (!has('redis', 'cache')) {
    suggestions.push('Add a Redis cache between the API and the database');
  }

  const deduped = Array.from(new Set(suggestions));
  if (deduped.length >= 3) return deduped.slice(0, 5);
  // Pad with static defaults if the diagram already covers most pillars.
  return Array.from(new Set([...deduped, ...REFINE_SUGGESTIONS])).slice(0, 5);
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Well-Architected pillar tagging for suggestion chips (Tier 4). Heuristic
// keyword match maps each suggestion to a pillar so chips carry a small icon.
type Pillar = 'security' | 'reliability' | 'cost' | 'operations' | 'performance';
const PILLAR_META: Record<Pillar, { label: string; Icon: LucideIcon; className: string }> = {
  security: { label: 'Security', Icon: Shield, className: 'pillar-security' },
  reliability: { label: 'Reliability', Icon: Activity, className: 'pillar-reliability' },
  cost: { label: 'Cost', Icon: DollarSign, className: 'pillar-cost' },
  operations: { label: 'Operations', Icon: Wrench, className: 'pillar-operations' },
  performance: { label: 'Performance', Icon: Zap, className: 'pillar-performance' },
};
function pillarFor(text: string): Pillar {
  const t = text.toLowerCase();
  if (/(private|key vault|waf|firewall|defender|encrypt|rbac|identity|secret|auth|ddos|network isolation)/.test(t)) return 'security';
  if (/(zone|redundan|availability|failover|backup|geo|replica|resilien|disaster|multi-region|sla)/.test(t)) return 'reliability';
  if (/(cost|budget|reserved|spot|right-?siz|cheaper|save money|lower tier)/.test(t)) return 'cost';
  if (/(cache|redis|cdn|front door|latency|throughput|scale out|accelerat|performance)/.test(t)) return 'performance';
  return 'operations';
}

const ArchitectureChatPanel: React.FC<ArchitectureChatPanelProps> = ({
  isOpen,
  onClose,
  currentArchitecture,
  resetSignal = 0,
  onApply,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Suggestions the user has already picked this session, so follow-up chips
  // keep advancing instead of re-offering the same ideas.
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
  // Tier 3: change-specific follow-ups from a fast model, keyed to the assistant
  // turn they were generated for. Null until (and unless) they arrive.
  const [modelFollowUps, setModelFollowUps] = useState<{ forMsgId: string; items: string[] } | null>(null);
  // Tier 4: loading flags for the background follow-up fetch and the
  // "What would you add?" single-best-recommendation button.
  const [followUpsLoading, setFollowUpsLoading] = useState(false);
  const [askingBest, setAskingBest] = useState(false);
  const [pendingRefinement, setPendingRefinement] = useState<PendingRefinement | null>(null);
  const [modelSettings] = useModelSettings();

  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const configured = isAzureOpenAIConfigured();
  const hasDiagram = currentArchitecture.nodes.some((n) => n.type === 'azureNode');
  const modelName = MODEL_CONFIG[modelSettings.model]?.displayName || modelSettings.model;

  const markUsed = (s: string) =>
    setUsedSuggestions((prev) => (prev.has(s) ? prev : new Set(prev).add(s)));

  // Live, context-aware follow-ups shown under the latest reply during an active
  // chat. Recomputed from the current (post-change) canvas, so they evolve as the
  // diagram grows; already-picked ideas are filtered out.
  const staticFollowUps = hasDiagram
    ? computeRefineSuggestions(currentArchitecture.nodes)
        .filter((s) => !usedSuggestions.has(s))
        .slice(0, 3)
    : [];
  // Tier 3: prefer the model's change-specific follow-ups when available; fall
  // back to the static rule-based chips otherwise.
  const dynamicFollowUps = (modelFollowUps?.items || [])
    .filter((s) => !usedSuggestions.has(s))
    .slice(0, 3);
  const followUps = dynamicFollowUps.length ? dynamicFollowUps : staticFollowUps;

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (resetSignal === 0) return;
    setMessages([]);
    setInput('');
    setUsedSuggestions(new Set());
    setModelFollowUps(null);
    setPendingRefinement(null);
    setShowAdvanced(false);
  }, [resetSignal]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const applyReviewedResult = useCallback(async (
    before: CurrentArchitecture,
    result: any,
    request: string,
    recentRequests: string[],
    approvedProposals: boolean,
  ) => {
    await onApply(result, request, true);

    const review = reviewRefinement(before, result, request);
    const summary = summarizeRefinementReview(review, approvedProposals);
    const asstId = uid();
    setMessages((prev) => [
      ...prev,
      { id: asstId, role: 'assistant', text: summary, ts: Date.now() },
    ]);

    const nextServices = Array.isArray(result?.services)
      ? result.services
          .map((service: any) => String(service?.label ?? service?.name ?? service?.service ?? '').trim())
          .filter(Boolean)
      : [];
    setModelFollowUps(null);
    setFollowUpsLoading(true);
    void generateFollowUpSuggestions({
      services: nextServices,
      lastChange: summary,
      recentRequests,
      source: 'automatic_after_change',
    })
      .then((items) => {
        if (items.length) setModelFollowUps({ forMsgId: asstId, items });
      })
      .catch(() => { /* fall back to static chips */ })
      .finally(() => setFollowUpsLoading(false));
  }, [onApply]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isSending) return;

      setInput('');
      const userMsg: ChatMessage = { id: uid(), role: 'user', text, ts: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      // Snapshot the canvas state BEFORE applying so we can diff for a summary.
      const before: CurrentArchitecture = {
        nodes: currentArchitecture.nodes,
        edges: currentArchitecture.edges,
        architectureName: currentArchitecture.architectureName,
      };

      // Recent user instructions help the model resolve references.
      const recentRequests = [...messages, userMsg]
        .filter((m) => m.role === 'user')
        .slice(-5)
        .map((m) => m.text);

      try {
        const prompt = buildModificationPrompt(before, text, recentRequests.slice(0, -1));
        const result = await generateArchitectureWithAI(prompt);
        const review = reviewRefinement(before, result, text);
        if (review.isRefinement && review.unrequestedAdditions.length > 0) {
          setPendingRefinement({ before, result, request: text, recentRequests, review });
        } else {
          await applyReviewedResult(before, result, text, recentRequests, false);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'error',
            text: err?.message || 'Something went wrong updating the diagram. Please try again.',
            ts: Date.now(),
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages, currentArchitecture, applyReviewedResult],
  );

  const keepCurrentArchitecture = () => {
    if (!pendingRefinement) return;
    const proposed = pendingRefinement.review.unrequestedAdditions.map((change) => change.name).join(', ');
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        text: `No changes applied. The AI proposed service types outside your request: ${proposed}.`,
        ts: Date.now(),
      },
    ]);
    setPendingRefinement(null);
  };

  const applyPendingRefinement = async (includeProposals: boolean) => {
    if (!pendingRefinement) return;
    const pending = pendingRefinement;
    setPendingRefinement(null);
    setIsSending(true);
    try {
      const result = includeProposals
        ? pending.result
        : removeUnrequestedServices(pending.result, pending.review);
      await applyReviewedResult(
        pending.before,
        result,
        pending.request,
        pending.recentRequests,
        includeProposals,
      );
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'error',
          text: err?.message || 'Something went wrong updating the diagram. Please try again.',
          ts: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Tier 4: "What would you add?" — ask the model for the single highest-impact
  // next step (from the current canvas) and apply it like a chip click.
  const handleAskBest = async () => {
    if (isSending || askingBest || !configured) return;
    setAskingBest(true);
    try {
      const services = currentArchitecture.nodes
        .filter((n) => n.type === 'azureNode')
        .map((n) => String(n.data?.label || '').trim())
        .filter(Boolean);
      const recent = messages.filter((m) => m.role === 'user').slice(-4).map((m) => m.text);
      const best = await generateFollowUpSuggestions({
        services,
        lastChange: '',
        recentRequests: recent,
        count: 1,
        source: 'what_would_you_add',
      });
      if (best[0]) {
        markUsed(best[0]);
        await send(best[0]);
      }
    } finally {
      setAskingBest(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="arch-chat-panel" role="complementary" aria-label="Guided Chat">
      <div className="arch-chat-header">
        <div className="arch-chat-title">
          <MessageSquare size={18} />
          <span>Guided Chat</span>
        </div>
        <button className="arch-chat-close" onClick={onClose} title="Close chat" aria-label="Close chat">
          <X size={18} />
        </button>
      </div>

      <div className="arch-chat-subhead">
        <Sparkles size={13} />
        <span>
          {hasDiagram
            ? <>Refine your diagram in plain English · <strong>{modelName}</strong></>
            : <>Describe it, I’ll draw it — then refine in plain English · <strong>{modelName}</strong></>}
        </span>
      </div>

      <div className="arch-chat-thread" ref={threadRef}>
        {messages.length === 0 && (
          <div className="arch-chat-empty">
            <p className="arch-chat-empty-title">
              {hasDiagram
                ? 'Describe a change and I’ll update the diagram.'
                : 'Start by describing what you want to build — I’ll draw the first version, then we refine it together.'}
            </p>
            <p className="arch-chat-empty-sub">
              {hasDiagram
                ? 'Every change is saved to version history, so you can experiment freely.'
                : 'Pick a starter below or type your own. Every step is saved to version history.'}
            </p>
            <div className="arch-chat-suggestions">
              {(hasDiagram ? computeRefineSuggestions(currentArchitecture.nodes) : STARTER_SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  className="arch-chat-chip"
                  disabled={isSending || !configured}
                  onClick={() => { markUsed(s); send(s); }}
                >
                  {s}
                </button>
              ))}

              {!hasDiagram && showAdvanced && ADVANCED_STARTER_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="arch-chat-chip arch-chat-chip-advanced"
                  disabled={isSending || !configured}
                  onClick={() => { markUsed(s); send(s); }}
                >
                  {s}
                </button>
              ))}

              {!hasDiagram && (
                <button
                  type="button"
                  className="arch-chat-more-toggle"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                >
                  {showAdvanced
                    ? <><ChevronUp size={15} /> Fewer ideas</>
                    : <><ChevronDown size={15} /> More ideas — enterprise patterns</>}
                </button>
              )}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`arch-chat-msg arch-chat-msg-${m.role}`}>
            {m.role === 'error' && <AlertCircle size={15} className="arch-chat-msg-icon" />}
            {m.role === 'assistant' && <Sparkles size={15} className="arch-chat-msg-icon" />}
            <div className="arch-chat-bubble">{m.text}</div>
          </div>
        ))}

        {isSending && (
          <div className="arch-chat-msg arch-chat-msg-assistant">
            <Loader2 size={15} className="arch-chat-msg-icon spin" />
            <div className="arch-chat-bubble arch-chat-bubble-pending">Updating the diagram…</div>
          </div>
        )}

        {messages.length > 0 && configured && !isSending && (hasDiagram ? followUps.length > 0 : true) && (
          <div className="arch-chat-followups">
            <div className="arch-chat-followups-label">
              <Sparkles size={12} />
              {hasDiagram
                ? (followUpsLoading && dynamicFollowUps.length === 0
                    ? <>Finding tailored suggestions… <Loader2 size={11} className="spin" /></>
                    : <>Suggested next steps</>)
                : <>Start a new architecture</>}
            </div>
            <div
              className="arch-chat-suggestions arch-chat-suggestions-inline"
              role="group"
              aria-label={hasDiagram ? 'Suggested follow-ups' : 'Starter architectures'}
            >
              {(hasDiagram ? followUps : STARTER_SUGGESTIONS).map((s) => {
                const meta = hasDiagram ? PILLAR_META[pillarFor(s)] : null;
                const Icon = meta?.Icon;
                return (
                  <button
                    key={s}
                    className={`arch-chat-chip arch-chat-chip-followup${meta ? ` ${meta.className}` : ''}`}
                    disabled={isSending || !configured}
                    title={meta ? `${meta.label} improvement` : undefined}
                    onClick={() => { markUsed(s); send(s); }}
                  >
                    {Icon && <Icon size={12} className="arch-chat-chip-icon" />}
                    {s}
                  </button>
                );
              })}

              {hasDiagram && (
                <button
                  type="button"
                  className="arch-chat-chip arch-chat-chip-ask"
                  disabled={isSending || askingBest || !configured}
                  title="Ask the model for the single highest-impact improvement"
                  onClick={handleAskBest}
                >
                  {askingBest
                    ? <Loader2 size={12} className="spin arch-chat-chip-icon" />
                    : <Lightbulb size={12} className="arch-chat-chip-icon" />}
                  What would you add?
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {pendingRefinement && (
        <div className="arch-chat-review-backdrop">
          <div className="arch-chat-review" role="dialog" aria-modal="true" aria-labelledby="arch-chat-review-title">
            <div className="arch-chat-review-heading">
              <AlertTriangle size={20} />
              <div>
                <h2 id="arch-chat-review-title">Review extra services</h2>
                <p>The diagram has not changed. AI proposed services that were not part of your request.</p>
              </div>
            </div>
            <div className="arch-chat-review-request">
              <strong>Requested change</strong>
              <span>{pendingRefinement.request}</span>
            </div>
            <ul className="arch-chat-review-services">
              {pendingRefinement.review.unrequestedAdditions.map((change) => (
                <li key={change.canonicalName}>
                  <strong>{change.name}</strong>
                  <span>AI-proposed; not explicitly requested</span>
                </li>
              ))}
            </ul>
            <div className="arch-chat-review-actions">
              <button type="button" className="arch-chat-review-keep" onClick={keepCurrentArchitecture} autoFocus>
                Keep current architecture
              </button>
              <button type="button" onClick={() => void applyPendingRefinement(false)}>
                Apply requested changes only
              </button>
              <button type="button" className="arch-chat-review-all" onClick={() => void applyPendingRefinement(true)}>
                Apply all changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="arch-chat-composer">
        {!configured && (
          <div className="arch-chat-warning">
            <AlertCircle size={14} /> Azure OpenAI is not configured.
          </div>
        )}
        <div className="arch-chat-input-row">
          <textarea
            ref={inputRef}
            className="arch-chat-input"
            placeholder={hasDiagram ? 'e.g. add a load balancer in front of the VMs' : 'Describe your architecture…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isSending || !configured || pendingRefinement !== null}
          />
          <button
            className="arch-chat-send"
            onClick={() => send(input)}
            disabled={isSending || !configured || pendingRefinement !== null || !input.trim()}
            title="Send (Enter)"
            aria-label="Send"
          >
            {isSending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
        <div className="arch-chat-hint">Enter to send · Shift+Enter for a new line · each change is auto-saved to version history</div>
      </div>
    </div>
  );
};

export default ArchitectureChatPanel;

// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, AlertCircle, MessageSquare, ChevronDown, ChevronUp, Shield, Activity, DollarSign, Wrench, Zap, Lightbulb, type LucideIcon } from 'lucide-react';
import { generateArchitectureWithAI, generateFollowUpSuggestions, isAzureOpenAIConfigured } from '../services/azureOpenAI';
import { useModelSettings, MODEL_CONFIG } from '../stores/modelSettingsStore';
import {
  buildModificationPrompt,
  summarizeArchitectureChange,
  CurrentArchitecture,
} from '../services/modificationPrompt';
import './ArchitectureChatPanel.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'error';
  text: string;
  ts: number;
}

interface ArchitectureChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentArchitecture: CurrentArchitecture;
  /** Applies a generated architecture to the canvas (App's handleAIGenerate). */
  onApply: (architecture: any, prompt: string, autoSnapshot?: boolean) => void | Promise<void>;
}

// Cold start: when the canvas is empty, offer complete starter architectures
// so Chat works as a first-class entry point (not just a refinement tool).
const STARTER_SUGGESTIONS = [
  'Customer-facing web app on App Service with Azure SQL and Redis, fronted by Front Door with WAF and Application Insights',
  'Order-processing pipeline: Service Bus queue to Azure Functions to Cosmos DB, with dead-lettering and secrets in Key Vault',
  'Internal REST API on Container Apps backed by Azure SQL, secured with Entra ID and API Management',
  'Document-processing workflow: Blob Storage triggers Functions to run Azure AI Document Intelligence, results in Cosmos DB',
  'Secure AI assistant: Azure OpenAI behind private endpoints, exposed through API Management with managed identity',
];

// Cold start (advanced): richer, enterprise-grade patterns revealed behind a
// "More ideas" toggle so first-timers aren't overwhelmed but power users can
// see the tool's ceiling.
const ADVANCED_STARTER_SUGGESTIONS = [
  'Multi-region active-active e-commerce platform: Front Door, AKS in paired regions, geo-replicated Cosmos DB, and Service Bus for order events',
  'HIPAA-compliant healthcare data platform: private-endpoint ingestion, AKS clinical workloads, Azure API for FHIR, and Purview governance',
  'Enterprise landing zone: hub-and-spoke with Azure Firewall, Bastion, private DNS zones, and centralized Log Analytics',
  'Real-time fraud detection: Event Hubs to Stream Analytics to Azure ML scoring to Cosmos DB, with Event Grid alerting',
  'RAG knowledge platform: Azure OpenAI + AI Search + Cosmos DB, ingestion via Functions, all behind private endpoints with Entra ID',
  'Event-driven microservices on AKS: KEDA autoscaling from Service Bus, Key Vault CSI driver, and private-link Container Registry',
];

// Warm start: once a diagram exists, offer incremental refinements. Used as a
// fallback when no context-aware "what's missing" suggestions apply.
const REFINE_SUGGESTIONS = [
  'Add Azure Front Door with WAF in front of the web tier',
  'Make it zone-redundant for high availability',
  'Add a Redis cache between the API and the database',
  'Add monitoring with Application Insights and Log Analytics',
  'Put private endpoints on the data services',
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
    suggestions.push('Put private endpoints on the data services');
  }
  if (!has('front door', 'application gateway', 'firewall', 'waf')) {
    suggestions.push('Add Azure Front Door with a WAF in front of the web tier');
  }
  // Observability
  if (!has('application insights', 'monitor', 'log analytics')) {
    suggestions.push('Add monitoring with Application Insights and Log Analytics');
  }
  // Reliability
  suggestions.push('Make it zone-redundant for high availability');
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

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

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

        await onApply(result, text, true);

        const summary = summarizeArchitectureChange(before, result);
        const asstId = uid();
        setMessages((prev) => [
          ...prev,
          { id: asstId, role: 'assistant', text: summary, ts: Date.now() },
        ]);

        // Tier 3: fetch change-specific follow-ups in the background (non-blocking).
        // The static rule-based chips render immediately; these replace them when
        // they arrive. Uses result.services (post-change) to avoid stale state.
        const nextServices = Array.isArray((result as any)?.services)
          ? (result as any).services
              .map((s: any) => String(s?.label ?? s?.name ?? s?.service ?? '').trim())
              .filter(Boolean)
          : [];
        setModelFollowUps(null);
        setFollowUpsLoading(true);
        void generateFollowUpSuggestions({ services: nextServices, lastChange: summary, recentRequests })
          .then((items) => {
            if (items.length) setModelFollowUps({ forMsgId: asstId, items });
          })
          .catch(() => { /* fall back to static chips */ })
          .finally(() => setFollowUpsLoading(false));
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
    [isSending, messages, currentArchitecture, onApply],
  );

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
    <div className="arch-chat-panel" role="complementary" aria-label="Architecture chat">
      <div className="arch-chat-header">
        <div className="arch-chat-title">
          <MessageSquare size={18} />
          <span>Architecture Chat</span>
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
            disabled={isSending || !configured}
          />
          <button
            className="arch-chat-send"
            onClick={() => send(input)}
            disabled={isSending || !configured || !input.trim()}
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

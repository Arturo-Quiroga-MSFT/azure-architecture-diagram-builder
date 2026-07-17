// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Loader2, Clock, Zap, Brain, Network, PenTool, Layers } from 'lucide-react';
import { generateArchitectureWithAI, isAzureOpenAIConfigured, AIMetrics, analyzeArchitectureDiagramImage, ModelOverride } from '../services/azureOpenAI';import { generateReferenceArchitectureWithAI } from '../services/referenceArchitectureAI';
import { generateBlueprintArchitectureWithAI } from '../services/blueprintArchitectureAI';
import { generateComponentManifest, ComponentManifest } from '../services/componentManifestAI';
import { exportReferenceArchitectureAsPng } from '../utils/exportReferencePng';
import { exportBlueprintArchitectureAsPng } from '../utils/exportBlueprintPng';
import ImageUploader from './ImageUploader';
import { useModelSettings, MODEL_CONFIG, getAvailableModels, ModelType, ReasoningEffort, FEATURE_CONFIG, isModelAvailable } from '../stores/modelSettingsStore';
import { trackImageImport } from '../services/telemetryService';
import { buildModificationPrompt } from '../services/modificationPrompt';
import './AIArchitectureGenerator.css';

type GenerationMode = 'topology' | 'reference' | 'blueprint' | 'both';

// After a successful generation the modal stays open this long so the user can
// review metrics or type a follow-up modification, then auto-closes. Typing a
// modification or regenerating cancels the pending close (see scheduleAutoClose).
const AUTO_CLOSE_MS = 45000;

// Blueprint diagrams require general-purpose OpenAI models.
// - Non-OpenAI partner deployments (DeepSeek, Grok, Mistral, Kimi, etc. —
//   identified by apiFormat: 'chat-completions') run under stricter Azure AI
//   Content Safety configurations that block the blueprint system prompt as
//   adversarial.
// - Codex-tuned variants (e.g. gpt-5.2-codex, gpt-5.3-codex) are optimized for
//   coding tasks and tend to refuse non-code architecture-diagram prompts with
//   "I'm sorry, ..." responses.
const isBlueprintCapableModel = (m: ModelType): boolean =>
  MODEL_CONFIG[m].apiFormat !== 'chat-completions' && !m.includes('codex');
const modeRequiresOpenAI = (m: GenerationMode): boolean =>
  m === 'blueprint' || m === 'both';

interface AIArchitectureGeneratorProps {
  onGenerate: (architecture: any, prompt: string, autoSnapshot: boolean, referenceImageUrl?: string) => void;
  /**
   * Called when a Reference Architecture has been generated. Reference mode
   * intentionally does NOT push a topology onto the canvas (the transformed
   * topology is low-fidelity and confuses users); the PNG is the deliverable.
   * App uses this to stash the ref so the toolbar can re-export the PNG.
   */
  onReferenceArchitecture?: (ref: any) => void;
  /**
   * Called when a Blueprint Architecture has been generated. Like reference
   * mode, blueprint mode does NOT push a topology onto the canvas; the PNG is
   * the deliverable. App stashes the blueprint so the toolbar can re-export.
   */
  onBlueprintArchitecture?: (bp: any) => void;
  currentArchitecture?: {
    nodes: any[];
    edges: any[];
    architectureName: string;
  };
}

const AIArchitectureGenerator: React.FC<AIArchitectureGeneratorProps> = ({ onGenerate, onReferenceArchitecture, onBlueprintArchitecture, currentArchitecture }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>(() => {
    const saved = localStorage.getItem('aiGenerator.mode');
    if (saved === 'blueprint' || saved === 'both') return saved;
    // Reference mode is hidden in the UI; migrate any stale persisted value.
    if (saved === 'reference') return 'blueprint';
    return 'topology';
  });

  // When mode === 'both', run topology + blueprint generations in parallel
  // (default) or sequentially. Persisted.
  const [bothInParallel, setBothInParallel] = useState<boolean>(() => {
    const saved = localStorage.getItem('aiGenerator.bothInParallel');
    return saved === null ? true : JSON.parse(saved);
  });
  const handleBothInParallelChange = (checked: boolean) => {
    setBothInParallel(checked);
    localStorage.setItem('aiGenerator.bothInParallel', JSON.stringify(checked));
  };

  const handleModeChange = (m: GenerationMode) => {
    setMode(m);
    localStorage.setItem('aiGenerator.mode', m);
  };

  // Pending auto-close timer. Tracked in a ref so we can cancel it when the
  // user starts typing a modification or regenerates (which previously stacked
  // timers and could close the modal mid-edit), and clean it up on unmount.
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAutoClose = () => {
    if (autoCloseTimer.current) {
      clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
  };
  const scheduleAutoClose = () => {
    cancelAutoClose();
    autoCloseTimer.current = setTimeout(() => {
      autoCloseTimer.current = null;
      setIsOpen(false);
      setAiMetrics(null);
      setUploadedImageUrl(null);
    }, AUTO_CLOSE_MS);
  };
  // Clear any pending timer when the component unmounts.
  useEffect(() => cancelAutoClose, []);


  // Opt-in: also download an editorial PNG when generating in reference mode.
  // Model settings from reactive hook (stays in sync with dropdown)
  const [modelSettings, updateModelSettings] = useModelSettings();

  // When mode requires OpenAI (blueprint/both) and the current model is a
  // non-OpenAI partner deployment, auto-switch to the first OpenAI model.
  useEffect(() => {
    if (!modeRequiresOpenAI(mode)) return;
    if (isBlueprintCapableModel(modelSettings.model)) return;
    const fallback = getAvailableModels().find(isBlueprintCapableModel);
    if (!fallback) return;
    const cfg = MODEL_CONFIG[fallback];
    updateModelSettings({
      model: fallback,
      reasoningEffort: cfg.isReasoning
        ? (cfg.defaultReasoningEffort ?? modelSettings.reasoningEffort)
        : modelSettings.reasoningEffort,
    });
  }, [mode, modelSettings.model, updateModelSettings]);
  
  // Auto-snapshot preference (stored in localStorage)
  const [autoSnapshot, setAutoSnapshot] = useState<boolean>(() => {
    const saved = localStorage.getItem('aiGenerator.autoSnapshot');
    return saved === null ? true : JSON.parse(saved); // Default to true
  });

  // Blueprint legend position preference (stored in localStorage). 'auto'
  // picks bottom vs right based on aspect ratio.
  const [legendPosition, setLegendPosition] = useState<'auto' | 'bottom' | 'right'>(() => {
    const saved = localStorage.getItem('aiGenerator.blueprintLegendPosition');
    if (saved === 'bottom' || saved === 'right' || saved === 'auto') return saved;
    return 'auto';
  });
  const handleLegendPositionChange = (v: 'auto' | 'bottom' | 'right') => {
    setLegendPosition(v);
    localStorage.setItem('aiGenerator.blueprintLegendPosition', v);
  };

  // Save preference to localStorage when it changes
  const handleAutoSnapshotChange = (checked: boolean) => {
    setAutoSnapshot(checked);
    localStorage.setItem('aiGenerator.autoSnapshot', JSON.stringify(checked));
  };

  // Handle image analysis result
  const handleImageAnalyzed = (analyzedDescription: string) => {
    // Prepend or replace the description with the analyzed content
    const prefix = '🖼️ [Analyzed from uploaded diagram]\n\n';
    setDescription(prefix + analyzedDescription);
    setImageAnalyzed(true);
    trackImageImport();
  };

  // Wrapper to pass to ImageUploader
  const handleAnalyzeImage = async (base64: string, mimeType: string) => {
    const result = await analyzeArchitectureDiagramImage(base64, mimeType);
    return { description: result.description };
  };

  const categorizedPrompts = [
    {
      category: 'Web & Microservices',
      color: '#3b82f6',
      prompts: [
        "A web application with a React frontend, Node.js backend API, PostgreSQL database, and blob storage for images",
        "A microservices architecture with container apps, API gateway, message queue, and Redis cache",
      ],
    },
    {
      category: 'Security & Networking',
      color: '#ef4444',
      prompts: [
        "A zero trust enterprise network with Azure Firewall, Application Gateway with WAF, Private Link for PaaS services, Bastion for VM access, Microsoft Entra ID with Conditional Access, and Microsoft Defender for Cloud — segmented into DMZ, application, and data tiers",
        "A security operations center architecture with Microsoft Sentinel for SIEM, Log Analytics, Microsoft Defender for Cloud, Azure Key Vault, Azure Monitor, automation playbooks with Logic Apps, and integration with Microsoft Entra ID for identity threat detection",
      ],
    },
    {
      category: 'AI & Cognitive',
      color: '#8b5cf6',
      prompts: [
        "A machine learning pipeline with data ingestion, training, and inference endpoints",
        "An intelligent customer service chatbot using Azure OpenAI for conversations, Language for sentiment analysis, Speech Services for voice input/output, and Translator for multi-language support, with chat history in Cosmos DB and API Management for external access",
        "A smart document processing platform that uses Computer Vision to analyze uploaded images, Document Intelligence to extract form data, Language to classify and summarize content, all coordinated through Azure Functions with results stored in Cosmos DB and searchable via Cognitive Search",
        "A content moderation system for social media using Computer Vision to scan images, Language for text analysis and content safety checks, Azure OpenAI for context understanding, with real-time processing via Event Hubs and results stored in SQL Database with API Management exposing moderation APIs",
      ],
    },
    {
      category: 'E-commerce',
      color: '#f59e0b',
      prompts: [
        "A Black Friday-ready e-commerce platform handling 50,000 orders/hour peak with real-time inventory sync across 12 regional warehouses, ML-powered fraud detection scoring each transaction in under 200ms, personalized recommendations engine, multi-currency payment processing with PCI-DSS compliance, abandoned cart recovery workflows, using Azure Kubernetes Service for microservices, Cosmos DB for product catalog with global distribution, Redis Cache for session and cart state, Service Bus for order orchestration, Azure Functions for inventory webhooks, Cognitive Search for faceted product search, and CDN with dynamic site acceleration",
      ],
    },
    {
      category: 'Healthcare',
      color: '#22c55e',
      prompts: [
        "A HIPAA-compliant healthcare data platform integrating EHR systems via HL7 FHIR R4 APIs, medical imaging PACS with DICOM support storing 500TB of radiology images, real-time clinical decision support, patient portal with secure messaging, audit logging for all PHI access, disaster recovery with 15-minute RPO, using Azure API for FHIR, Azure Health Data Services for DICOM, Blob Storage with immutable retention for images, Cosmos DB for patient timelines, Azure Functions for HL7v2 to FHIR transformation, Logic Apps for clinical workflows, Key Vault for encryption key management, and Microsoft Defender for Cloud for continuous compliance monitoring",
        "An eventing architecture for healthcare imaging with high throughput (50,000-75,000 events/sec), large payloads up to 10MB, strict message ordering, cloud-to-on-prem bridging via VPN Gateway, managed services only (no self-managed Kafka), 99.99% availability SLO, supporting 250M studies, 2.5M daily volume, 5M daily notifications, with Event Hubs for ingestion, Service Bus for routing, Azure Functions for processing, Cosmos DB for metadata, Blob Storage for images, and Log Analytics for monitoring",
      ],
    },
    {
      category: 'Data & Analytics',
      color: '#06b6d4',
      prompts: [
        "A data lakehouse with Azure Data Lake Storage, Synapse Analytics for SQL and Spark queries, Data Factory for ETL pipelines, and Power BI for dashboards",
        "A real-time analytics pipeline using Event Hubs for ingestion, Stream Analytics for windowed aggregations, Cosmos DB for serving layer, and Azure Monitor for pipeline health",
        "A data warehouse with Azure SQL Database, Data Factory for scheduled imports from multiple sources, Purview for data governance and cataloging, and Power BI embedded reports",
      ],
    },
    {
      category: 'Microsoft Fabric',
      color: '#0d9488',
      prompts: [
        "A Microsoft Fabric medallion lakehouse: Data Factory ingestion into OneLake, Bronze/Silver/Gold Lakehouses processed with Fabric Notebooks and Dataflow Gen2, a Warehouse for curated marts, and a Power BI Report via a Direct Lake Semantic Model, running on a Fabric Capacity F2",
        "An end-to-end Microsoft Fabric analytics platform: ingest on-prem SQL via a Fabric Data Pipeline and Mirrored Database, stream IoT telemetry through an Eventstream into an Eventhouse with a KQL Database, land data in OneLake, build Bronze/Silver/Gold Lakehouses, expose a Semantic Model to a Power BI Report and a Real-Time Dashboard, and add a Fabric Data Agent for natural-language Q&A — on a Fabric Capacity F64",
        "A real-time intelligence solution in Microsoft Fabric: Eventstream ingestion into an Eventhouse and KQL Database, a Real-Time Dashboard for live KPIs, and a Lakehouse plus Power BI Report for historical analysis, on a Fabric Capacity",
      ],
    },
    {
      category: 'IoT',
      color: '#14b8a6',
      prompts: [
        "An industrial IoT predictive maintenance platform for a manufacturing facility with 5,000+ sensors generating telemetry every 5 seconds, requiring real-time anomaly detection with sub-second latency, batch analytics for trend analysis, secure device provisioning and management, OT/IT network segregation with Private Link, 99.9% uptime SLA, 6-month hot storage and 7-year cold retention, using IoT Hub for ingestion, Stream Analytics for real-time processing, Azure ML for predictive models, Data Lake for raw storage, Synapse Analytics for reporting, Time Series Insights for dashboards, and Digital Twins for facility modeling",
      ],
    },
  ];

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please describe your architecture');
      return;
    }

    if (!isAzureOpenAIConfigured()) {
      setError('Azure OpenAI is not configured. Please check your environment variables.');
      return;
    }

    // Regenerating cancels any pending auto-close so a stale timer from the
    // previous run can't close the modal mid-generation or stack up.
    cancelAutoClose();
    setIsGenerating(true);
    setError('');
    setAiMetrics(null); // Clear previous metrics
    
    // Use the dropdown-selected model directly from the reactive hook state
    // (bypasses per-feature overrides which can silently override the dropdown)
    const currentModelSettings: ModelOverride = {
      model: modelSettings.model,
      reasoningEffort: modelSettings.reasoningEffort
    };
    console.log(`🎯 Generate clicked: dropdown model=${modelSettings.model}, reasoning=${modelSettings.reasoningEffort}, overrides=${JSON.stringify(modelSettings.featureOverrides)}`);

    // Blueprint diagrams default to the fast, cost-efficient model recommended
    // for the feature (GPT-5.4 Mini) unless the user set an explicit blueprint
    // override in Model Settings. Topology and other features keep the
    // toolbar-selected model. Falls back to the toolbar model if the
    // recommended one isn't deployed/available.
    const blueprintModelSettings: ModelOverride = (() => {
      const override = modelSettings.featureOverrides?.blueprint;
      if (override && isBlueprintCapableModel(override.model)) {
        const cfg = MODEL_CONFIG[override.model];
        return {
          model: override.model,
          reasoningEffort: cfg.isReasoning
            ? (override.reasoningEffort || modelSettings.reasoningEffort)
            : modelSettings.reasoningEffort,
        };
      }
      const rec = FEATURE_CONFIG.blueprint.recommendedModel;
      if (isModelAvailable(rec) && isBlueprintCapableModel(rec)) {
        const cfg = MODEL_CONFIG[rec];
        return {
          model: rec,
          reasoningEffort: cfg.isReasoning
            ? (FEATURE_CONFIG.blueprint.recommendedReasoning || modelSettings.reasoningEffort)
            : modelSettings.reasoningEffort,
        };
      }
      return currentModelSettings;
    })();
    console.log(`📐 Blueprint model: ${blueprintModelSettings.model} (reasoning=${blueprintModelSettings.reasoningEffort})`);

    try {
      // ── Reference (Editorial) mode — PNG is the sole deliverable.
      // We deliberately do NOT push a topology onto the canvas: the
      // transformed network-flow view is low fidelity for editorial inputs
      // and confuses users. Instead we notify App so it can enable the
      // toolbar “Export Editorial PNG” action, then render + download.
      if (mode === 'reference') {
        const ref = await generateReferenceArchitectureWithAI(description, currentModelSettings);
        if (ref.metrics) setAiMetrics(ref.metrics);

        // Stash the ref for the toolbar re-export button (if App provided it).
        onReferenceArchitecture?.(ref);

        // Always export the PNG — it is the only artifact produced in this mode.
        try {
          await exportReferenceArchitectureAsPng(ref);
        } catch (err) {
          console.warn('Reference architecture PNG export failed:', err);
          setError('PNG export failed. See console for details.');
        }

        setDescription('');
        scheduleAutoClose();
        return;
      }

      // ── Blueprint (Whiteboard) mode — PNG is the sole deliverable.
      // Hand-drawn / sketchnote-style nested zones with numbered, labeled
      // arrows. Like reference mode, we do not touch the ReactFlow canvas.
      if (mode === 'blueprint') {
        const bp = await generateBlueprintArchitectureWithAI(description, blueprintModelSettings);
        if (bp.metrics) setAiMetrics(bp.metrics);

        onBlueprintArchitecture?.(bp);

        try {
          await exportBlueprintArchitectureAsPng(bp, { legendPosition });
        } catch (err) {
          console.warn('Blueprint architecture PNG export failed:', err);
          setError('PNG export failed. See console for details.');
        }

        setDescription('');
        scheduleAutoClose();
        return;
      }

      // ── Both mode — generate topology AND blueprint from the same prompt.
      // Topology renders on the canvas (via onGenerate); blueprint is stashed
      // and (when autoSnapshot is on) auto-downloaded as PNG. The toolbar's
      // "Export Blueprint PNG" remains available either way.
      if (mode === 'both') {
        // Build the same enriched context the topology branch uses below.
        let bothContextPrompt = description;
        if (currentArchitecture && currentArchitecture.nodes.length > 0) {
          const groups = currentArchitecture.nodes
            .filter((n) => n.type === 'groupNode')
            .map((n) => ({ name: n.data.label, id: n.id }));
          const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));
          const services = currentArchitecture.nodes
            .filter((n) => n.type === 'azureNode')
            .map((n) => {
              const groupName = n.parentNode ? groupNameMap.get(n.parentNode) : null;
              return { name: n.data.label, group: groupName || null };
            });
          const connections = currentArchitecture.edges.map((e) => {
            const fromNode = currentArchitecture.nodes.find((n) => n.id === e.source);
            const toNode = currentArchitecture.nodes.find((n) => n.id === e.target);
            return `${fromNode?.data.label || e.source} → ${toNode?.data.label || e.target}${e.label ? ` (${e.label})` : ''}`;
          });
          const servicesList = services.map((s) => `${s.name}${s.group ? ` [${s.group}]` : ''}`).join(', ');
          bothContextPrompt = `MODIFY EXISTING ARCHITECTURE: "${currentArchitecture.architectureName}"\nServices: ${servicesList}\n${groups.length > 0 ? `Groups: ${groups.map((g) => g.name).join(', ')}` : ''}\n${connections.length > 0 ? `Connections: ${connections.join('; ')}` : ''}\n\nCHANGE REQUESTED: ${description}\n\nIMPORTANT: Return the COMPLETE architecture JSON (all services, groups, connections, workflow). Keep everything unchanged EXCEPT what the user requested. Only add, modify, or remove what was asked.`;
        }

        const topoCall = (m?: ComponentManifest) => generateArchitectureWithAI(bothContextPrompt, currentModelSettings, m);
        const bpCall = (m?: ComponentManifest) => generateBlueprintArchitectureWithAI(description, blueprintModelSettings, m);

        const t0 = performance.now();
        // Pre-pass: extract a canonical component manifest so topology and
        // blueprint agree on the set of services, zones, and on-prem actors.
        let manifest: ComponentManifest | undefined;
        try {
          manifest = await generateComponentManifest(description, currentModelSettings);
          console.log(
            `📋 Manifest: ${manifest.components.length} components across ${manifest.zones.length} zones (${manifest.metrics?.totalTokens ?? '?'} tokens, ${Math.round((manifest.metrics?.elapsedTimeMs ?? 0) / 100) / 10}s)`,
          );
        } catch (err) {
          console.warn('Component manifest pre-pass failed; falling back to independent generation:', err);
          manifest = undefined;
        }

        let topoResult: any;
        let bpResult: any;
        if (bothInParallel) {
          [topoResult, bpResult] = await Promise.all([topoCall(manifest), bpCall(manifest)]);
        } else {
          topoResult = await topoCall(manifest);
          bpResult = await bpCall(manifest);
        }
        const wallElapsed = performance.now() - t0;

        // Combined metrics: sum tokens (including manifest); wall-clock
        // elapsed reflects actual perceived time (manifest + max(topo, bp)
        // for parallel; manifest + topo + bp for sequential).
        const tm = topoResult.metrics;
        const bm = bpResult.metrics;
        const mm = manifest?.metrics;
        if (tm || bm || mm) {
          setAiMetrics({
            elapsedTimeMs: Math.round(wallElapsed),
            promptTokens: (tm?.promptTokens || 0) + (bm?.promptTokens || 0) + (mm?.promptTokens || 0),
            completionTokens: (tm?.completionTokens || 0) + (bm?.completionTokens || 0) + (mm?.completionTokens || 0),
            totalTokens: (tm?.totalTokens || 0) + (bm?.totalTokens || 0) + (mm?.totalTokens || 0),
          } as AIMetrics);
        }

        // Push topology to canvas first.
        // Inject the manifest title (when available) so the canvas banner /
        // title block stop reading "Untitled Architecture" after generation.
        if (manifest?.title && topoResult && typeof topoResult === 'object') {
          if (!topoResult.architectureName || /untitled/i.test(String(topoResult.architectureName))) {
            topoResult.architectureName = manifest.title;
          }
        }
        onGenerate(topoResult, description, autoSnapshot, uploadedImageUrl || undefined);
        // Stash blueprint for the toolbar re-export button.
        onBlueprintArchitecture?.(bpResult);

        // Auto-download the blueprint PNG when the user has autoSnapshot on
        // (matches the existing "auto" behavior they're already used to).
        if (autoSnapshot) {
          try {
            await exportBlueprintArchitectureAsPng(bpResult, { legendPosition });
          } catch (err) {
            console.warn('Blueprint architecture PNG export failed:', err);
            setError('Blueprint PNG export failed. See console for details.');
          }
        }

        setDescription('');
        scheduleAutoClose();
        return;
      }

      // Build context about existing architecture if present
      let contextPrompt = description;
      
      if (currentArchitecture && currentArchitecture.nodes.length > 0) {
        contextPrompt = buildModificationPrompt(currentArchitecture, description);
      }
      
      // Call Azure OpenAI to generate architecture
      const result = await generateArchitectureWithAI(contextPrompt, currentModelSettings);
      
      // Store AI metrics if available
      if (result.metrics) {
        setAiMetrics(result.metrics);
      }
      
      onGenerate(result, description, autoSnapshot, uploadedImageUrl || undefined);
      setDescription('');
      
      // Close modal shortly after successful generation
      scheduleAutoClose(); // Give user 45s to review results or type a modification
    } catch (err: any) {
      setError(err.message || 'Failed to generate architecture. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const useExample = (example: string) => {
    setDescription(example);
  };

  return (
    <>
      <button
        className="btn btn-ai btn-generate-ai"
        onClick={() => {
          setIsOpen(true);
          // Reset state when opening modal
          setError('');
          setImageAnalyzed(false);
        }}
        title="Generate architecture with AI"
      >
        <Sparkles size={18} />
        Generate with AI
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content ai-architecture-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Sparkles size={20} />
                <h2>AI Architecture Generator</h2>
              </div>
              <button className="modal-close" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
             <div className="modal-body-grid">
              <div className="modal-col modal-col-left">
              <p className="modal-description">
                {mode === 'reference' ? (
                  <>Describe the workload in plain English and AI will generate a <strong>publication-style reference architecture</strong> with stages (Ingest → Process → Serve), a foundation strip, and cross-cutting governance rails — in the style of the Azure Architecture Center.</>
                ) : mode === 'blueprint' ? (
                  <>Describe the workload and AI will sketch a <strong>whiteboard-style blueprint</strong> with nested zones (Azure / VNet / On-prem) and numbered, labeled arrows showing the end-to-end flow — like an architect explaining a system at a whiteboard.</>
                ) : mode === 'both' ? (
                  <>Generate <strong>both</strong> a deployable topology (on the canvas) and a whiteboard-style blueprint (PNG) from the same prompt. Useful when you want a working diagram to edit and a polished visual to share.</>
                ) : (
                  <>Describe your Azure architecture in plain English, and AI will automatically
                  generate a diagram with the appropriate services and connections.
                  You can also <strong>upload an existing diagram</strong> (screenshot, whiteboard photo, or export from other tools)
                  and AI will analyze it to create your architecture.</>
                )}
              </p>

              <div className="form-group">
                <label htmlFor="architecture-description">Architecture Description or Modification</label>
                <textarea
                  id="architecture-description"
                  className="form-textarea"
                  placeholder={imageAnalyzed 
                    ? "AI has analyzed your diagram. Review the description above, make any adjustments, then click Generate." 
                    : "Describe a new architecture or request changes to the current diagram. Example: I need a web app with a frontend, API backend, SQL database, and blob storage..."}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    // Typing a modification cancels the pending auto-close so
                    // the modal doesn't disappear mid-edit.
                    cancelAutoClose();
                    // Clear imageAnalyzed flag if user clears the text
                    if (!e.target.value.includes('[Analyzed from uploaded diagram]')) {
                      setImageAnalyzed(false);
                    }
                  }}
                  rows={imageAnalyzed ? 10 : 6}
                  disabled={isGenerating || isAnalyzingImage}
                />
              </div>

              <ImageUploader
                onImageAnalyzed={handleImageAnalyzed}
                onImageDataUrl={setUploadedImageUrl}
                onAnalyzing={setIsAnalyzingImage}
                onError={setError}
                disabled={isGenerating}
                analyzeImage={handleAnalyzeImage}
              />

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {aiMetrics && (
                <div className="similar-architectures">
                  <h3>✓ Architecture generated successfully!</h3>
                  <div className="ai-metrics">
                    <span className="metric">
                      <Clock size={14} />
                      {(aiMetrics.elapsedTimeMs / 1000).toFixed(1)}s
                    </span>
                    <span className="metric">
                      <Zap size={14} />
                      {aiMetrics.promptTokens.toLocaleString()} in → {aiMetrics.completionTokens.toLocaleString()} out ({aiMetrics.totalTokens.toLocaleString()} total)
                    </span>
                  </div>
                </div>
              )}
              </div>
              <div className="modal-col modal-col-right">
              <div className="mode-toggle" role="tablist" aria-label="Generation mode">
                <button
                  role="tab"
                  aria-selected={mode === 'topology'}
                  className={`mode-toggle-btn ${mode === 'topology' ? 'active' : ''}`}
                  onClick={() => handleModeChange('topology')}
                  disabled={isGenerating}
                  type="button"
                >
                  <Network size={16} />
                  <span className="mode-label">Topology</span>
                  <span className="mode-sub">Deployable network diagram</span>
                </button>
                {/* Reference (swim-lane) mode hidden — Blueprint replaces it. Code path kept for now in case we want to restore. */}
                <button
                  role="tab"
                  aria-selected={mode === 'blueprint'}
                  className={`mode-toggle-btn ${mode === 'blueprint' ? 'active' : ''}`}
                  onClick={() => handleModeChange('blueprint')}
                  disabled={isGenerating}
                  type="button"
                >
                  <PenTool size={16} />
                  <span className="mode-label">Blueprint <span className="mode-badge-beta">BETA</span></span>
                  <span className="mode-sub">Hand-drawn whiteboard diagram</span>
                </button>
                <button
                  role="tab"
                  aria-selected={mode === 'both'}
                  className={`mode-toggle-btn ${mode === 'both' ? 'active' : ''}`}
                  onClick={() => handleModeChange('both')}
                  disabled={isGenerating}
                  type="button"
                >
                  <Layers size={16} />
                  <span className="mode-label">Both <span className="mode-badge-beta">BETA</span></span>
                  <span className="mode-sub">Topology + Blueprint</span>
                </button>
              </div>
              <div className="example-prompts">
                <h3>Example Prompts</h3>
                <div className="example-list">
                  {categorizedPrompts.map((group) => (
                    <div key={group.category} className="example-category">
                      <div className="example-category-label" style={{ color: group.color }}>
                        <span className="example-category-dot" style={{ backgroundColor: group.color }} />
                        {group.category}
                      </div>
                      {group.prompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          className="example-button"
                          style={{ borderLeftColor: group.color }}
                          onClick={() => useExample(prompt)}
                          disabled={isGenerating}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              </div>
             </div>
            </div>

            <div className="modal-footer">
              <div className="ai-modal-active-model">
                <Brain size={20} />
                <span className="ai-modal-model-label">Model:</span>
                <select
                  className="ai-modal-model-select"
                  value={modelSettings.model}
                  onChange={(e) => {
                    const next = e.target.value as ModelType;
                    const cfg = MODEL_CONFIG[next];
                    updateModelSettings({
                      model: next,
                      reasoningEffort: cfg.isReasoning
                        ? (cfg.defaultReasoningEffort ?? modelSettings.reasoningEffort)
                        : modelSettings.reasoningEffort,
                    });
                  }}
                  disabled={isGenerating}
                  aria-label="Select AI model"
                >
                  {getAvailableModels()
                    .filter((m) => !modeRequiresOpenAI(mode) || isBlueprintCapableModel(m))
                    .map((m) => (
                    <option key={m} value={m}>
                      {MODEL_CONFIG[m].displayName}
                    </option>
                  ))}
                </select>
                {MODEL_CONFIG[modelSettings.model].isReasoning && (
                  <>
                    <span className="ai-modal-model-label">Reasoning:</span>
                    <select
                      className="ai-modal-model-select"
                      value={modelSettings.reasoningEffort}
                      onChange={(e) =>
                        updateModelSettings({ reasoningEffort: e.target.value as ReasoningEffort })
                      }
                      disabled={isGenerating}
                      aria-label="Select reasoning effort"
                    >
                      <option value="none">none</option>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </>
                )}
                <span className="model-change-hint">
                  {modeRequiresOpenAI(mode)
                    ? 'Blueprint mode supports general-purpose OpenAI models only (partner and Codex models are filtered out).'
                    : 'Also configurable in toolbar → AI Model'}
                </span>
              </div>
              {currentArchitecture && currentArchitecture.nodes.length > 0 && (
                <div className="auto-snapshot-option">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoSnapshot}
                      onChange={(e) => handleAutoSnapshotChange(e.target.checked)}
                      disabled={isGenerating}
                    />
                    <span>Auto-save snapshot before regenerating</span>
                  </label>
                  <p className="checkbox-hint">
                    Automatically saves your current diagram to version history before generating a new one
                  </p>
                </div>
              )}
              {mode === 'both' && (
                <div className="auto-snapshot-option">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={bothInParallel}
                      onChange={(e) => handleBothInParallelChange(e.target.checked)}
                      disabled={isGenerating}
                    />
                    <span>Run topology and blueprint in parallel</span>
                  </label>
                  <p className="checkbox-hint">
                    Parallel ≈ half the wall-time (recommended on high-quota deployments). Uncheck to run sequentially if your model deployment has tight rate limits.
                  </p>
                </div>
              )}
              {(mode === 'blueprint' || mode === 'both') && (
                <div className="auto-snapshot-option">
                  <label className="checkbox-label" style={{ alignItems: 'center', gap: 8 }}>
                    <span>Blueprint legend position:</span>
                    <select
                      className="ai-modal-model-select"
                      value={legendPosition}
                      onChange={(e) => handleLegendPositionChange(e.target.value as 'auto' | 'bottom' | 'right')}
                      disabled={isGenerating}
                      aria-label="Blueprint legend position"
                    >
                      <option value="auto">Auto (by aspect ratio)</option>
                      <option value="bottom">Bottom (full-width canvas)</option>
                      <option value="right">Right (taller canvas)</option>
                    </select>
                  </label>
                  <p className="checkbox-hint">
                    Auto picks "bottom" for wide diagrams and "right" for square / tall ones.
                  </p>
                </div>
              )}
              <div className="modal-footer-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={isGenerating}
                >
                  {aiMetrics ? 'Close' : 'Cancel'}
                </button>
                <button
                  className="btn btn-primary btn-generate-ai"
                  onClick={handleGenerate}
                  disabled={isGenerating || isAnalyzingImage || !description.trim()}
                  style={{ display: aiMetrics ? 'none' : 'flex' }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="spinner" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Architecture
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIArchitectureGenerator;

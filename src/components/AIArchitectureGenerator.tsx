import React, { useState } from 'react';
import { Sparkles, X, Loader2, Clock, Zap, Brain } from 'lucide-react';
import { generateArchitectureWithAI, isAzureOpenAIConfigured, AIMetrics, analyzeArchitectureDiagramImage, ModelOverride } from '../services/azureOpenAI';
import ImageUploader from './ImageUploader';
import { useModelSettings, MODEL_CONFIG } from '../stores/modelSettingsStore';
import './AIArchitectureGenerator.css';

interface AIArchitectureGeneratorProps {
  onGenerate: (architecture: any, prompt: string, autoSnapshot: boolean) => void;
  currentArchitecture?: {
    nodes: any[];
    edges: any[];
    architectureName: string;
  };
}

const AIArchitectureGenerator: React.FC<AIArchitectureGeneratorProps> = ({ onGenerate, currentArchitecture }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);
  
  // Model settings from reactive hook (stays in sync with dropdown)
  const [modelSettings] = useModelSettings();
  
  // Auto-snapshot preference (stored in localStorage)
  const [autoSnapshot, setAutoSnapshot] = useState<boolean>(() => {
    const saved = localStorage.getItem('aiGenerator.autoSnapshot');
    return saved === null ? true : JSON.parse(saved); // Default to true
  });

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
  };

  // Wrapper to pass to ImageUploader
  const handleAnalyzeImage = async (base64: string, mimeType: string) => {
    const result = await analyzeArchitectureDiagramImage(base64, mimeType);
    return { description: result.description };
  };

  const examplePrompts = [
    "A web application with a React frontend, Node.js backend API, PostgreSQL database, and blob storage for images",
    "An industrial IoT predictive maintenance platform for a manufacturing facility with 5,000+ sensors generating telemetry every 5 seconds, requiring real-time anomaly detection with sub-second latency, batch analytics for trend analysis, secure device provisioning and management, OT/IT network segregation with Private Link, 99.9% uptime SLA, 6-month hot storage and 7-year cold retention, using IoT Hub for ingestion, Stream Analytics for real-time processing, Azure ML for predictive models, Data Lake for raw storage, Synapse Analytics for reporting, Time Series Insights for dashboards, and Digital Twins for facility modeling",
    "A microservices architecture with container apps, API gateway, message queue, and Redis cache",
    "A machine learning pipeline with data ingestion, training, and inference endpoints",
    "An intelligent customer service chatbot using Azure OpenAI for conversations, Language for sentiment analysis, Speech Services for voice input/output, and Translator for multi-language support, with chat history in Cosmos DB and API Management for external access",
    "A smart document processing platform that uses Computer Vision to analyze uploaded images, Document Intelligence to extract form data, Language to classify and summarize content, all coordinated through Azure Functions with results stored in Cosmos DB and searchable via Cognitive Search",
    "A content moderation system for social media using Computer Vision to scan images, Language for text analysis and content safety checks, Azure OpenAI for context understanding, with real-time processing via Event Hubs and results stored in SQL Database with API Management exposing moderation APIs",
    "A global multiplayer game backend supporting 500,000+ concurrent players across 5 regions with sub-50ms latency requirements, real-time matchmaking with skill-based ranking, persistent player profiles and inventory, anti-cheat telemetry processing, live events and seasonal content delivery, social features including friends lists and chat, using PlayFab for game services, Cosmos DB with multi-region writes for player data, SignalR Service for real-time websockets, Event Hubs for gameplay telemetry, Azure Functions for game logic, CDN for asset delivery, API Management with rate limiting, and Application Insights with custom gaming metrics",
    "A Black Friday-ready e-commerce platform handling 50,000 orders/hour peak with real-time inventory sync across 12 regional warehouses, ML-powered fraud detection scoring each transaction in under 200ms, personalized recommendations engine, multi-currency payment processing with PCI-DSS compliance, abandoned cart recovery workflows, using Azure Kubernetes Service for microservices, Cosmos DB for product catalog with global distribution, Redis Cache for session and cart state, Service Bus for order orchestration, Azure Functions for inventory webhooks, Cognitive Search for faceted product search, and CDN with dynamic site acceleration",
    "A HIPAA-compliant healthcare data platform integrating EHR systems via HL7 FHIR R4 APIs, medical imaging PACS with DICOM support storing 500TB of radiology images, real-time clinical decision support, patient portal with secure messaging, audit logging for all PHI access, disaster recovery with 15-minute RPO, using Azure API for FHIR, Azure Health Data Services for DICOM, Blob Storage with immutable retention for images, Cosmos DB for patient timelines, Azure Functions for HL7v2 to FHIR transformation, Logic Apps for clinical workflows, Key Vault for encryption key management, and Microsoft Defender for Cloud for continuous compliance monitoring",
    "An eventing architecture for healthcare imaging with high throughput (50,000-75,000 events/sec), large payloads up to 10MB, strict message ordering, cloud-to-on-prem bridging via VPN Gateway, managed services only (no self-managed Kafka), 99.99% availability SLO, supporting 250M studies, 2.5M daily volume, 5M daily notifications, with Event Hubs for ingestion, Service Bus for routing, Azure Functions for processing, Cosmos DB for metadata, Blob Storage for images, and Log Analytics for monitoring"
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

    try {
      // Build context about existing architecture if present
      let contextPrompt = description;
      
      if (currentArchitecture && currentArchitecture.nodes.length > 0) {
        const groups = currentArchitecture.nodes
          .filter(n => n.type === 'groupNode')
          .map(n => ({
            name: n.data.label,
            id: n.id
          }));
        
        // Build a group ID → name map for resolving parentNode references
        const groupNameMap = new Map(groups.map(g => [g.id, g.name]));
        
        const services = currentArchitecture.nodes
          .filter(n => n.type === 'azureNode')
          .map(n => {
            const groupName = n.parentNode ? groupNameMap.get(n.parentNode) : null;
            return {
              name: n.data.label,
              type: n.data.serviceName || n.data.service || n.data.label,
              group: groupName || null
            };
          });
        
        const connections = currentArchitecture.edges
          .map(e => {
            const fromNode = currentArchitecture.nodes.find(n => n.id === e.source);
            const toNode = currentArchitecture.nodes.find(n => n.id === e.target);
            return `${fromNode?.data.label || e.source} → ${toNode?.data.label || e.target}${e.label ? ` (${e.label})` : ''}`;
          });
        
        // Build a compact representation for modifications
        const servicesList = services.map(s => 
          `${s.name}${s.group ? ` [${s.group}]` : ''}`
        ).join(', ');
        
        contextPrompt = `MODIFY EXISTING ARCHITECTURE: "${currentArchitecture.architectureName}"
Services: ${servicesList}
${groups.length > 0 ? `Groups: ${groups.map(g => g.name).join(', ')}` : ''}
${connections.length > 0 ? `Connections: ${connections.join('; ')}` : ''}

CHANGE REQUESTED: ${description}

IMPORTANT: Return the COMPLETE architecture JSON (all services, groups, connections, workflow). Keep everything unchanged EXCEPT what the user requested. Only add, modify, or remove what was asked.`;
      }
      
      // Call Azure OpenAI to generate architecture
      const result = await generateArchitectureWithAI(contextPrompt, currentModelSettings);
      
      // Store AI metrics if available
      if (result.metrics) {
        setAiMetrics(result.metrics);
      }
      
      onGenerate(result, description, autoSnapshot);
      setDescription('');
      
      // Close modal after successful generation
      setTimeout(() => {
        setIsOpen(false);
        setAiMetrics(null);
      }, 25000); // Give user 25 seconds to see the success message
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              <p className="modal-description">
                Describe your Azure architecture in plain English, and AI will automatically
                generate a diagram with the appropriate services and connections.
                You can also <strong>upload an existing diagram</strong> (screenshot, whiteboard photo, or export from other tools)
                and AI will analyze it to create your architecture.
              </p>

              <ImageUploader
                onImageAnalyzed={handleImageAnalyzed}
                onAnalyzing={setIsAnalyzingImage}
                onError={setError}
                disabled={isGenerating}
                analyzeImage={handleAnalyzeImage}
              />

              <div className="form-group">
                <label htmlFor="architecture-description">Architecture Description</label>
                <textarea
                  id="architecture-description"
                  className="form-textarea"
                  placeholder={imageAnalyzed 
                    ? "AI has analyzed your diagram. Review the description above, make any adjustments, then click Generate." 
                    : "Example: I need a web app with a frontend, API backend, SQL database, and blob storage..."}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    // Clear imageAnalyzed flag if user clears the text
                    if (!e.target.value.includes('[Analyzed from uploaded diagram]')) {
                      setImageAnalyzed(false);
                    }
                  }}
                  rows={imageAnalyzed ? 10 : 6}
                  disabled={isGenerating || isAnalyzingImage}
                />
              </div>

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

              <div className="example-prompts">
                <h3>Example Prompts</h3>
                <div className="example-list">
                  {examplePrompts.map((example, index) => (
                    <button
                      key={index}
                      className="example-button"
                      onClick={() => useExample(example)}
                      disabled={isGenerating}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="ai-modal-active-model">
                <Brain size={14} />
                <span>Using: <span className="model-badge">{MODEL_CONFIG[modelSettings.model].displayName}</span></span>
                {MODEL_CONFIG[modelSettings.model].isReasoning && (
                  <span className="model-badge">({modelSettings.reasoningEffort})</span>
                )}
                <span className="model-change-hint">Change in toolbar → AI Model</span>
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

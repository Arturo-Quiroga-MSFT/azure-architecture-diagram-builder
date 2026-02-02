import React, { useState } from 'react';
import { Sparkles, X, Loader2, Clock, Zap } from 'lucide-react';
import { generateArchitectureWithAI, isAzureOpenAIConfigured, AIMetrics } from '../services/azureOpenAI';
import { initializeReferenceArchitectures } from '../services/referenceArchitectureService';
import ModelSelector from './ModelSelector';
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
  const [similarArchitectures, setSimilarArchitectures] = useState<any[]>([]);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  
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
    setSimilarArchitectures([]); // Clear previous results
    setAiMetrics(null); // Clear previous metrics

    try {
      // Build context about existing architecture if present
      let contextPrompt = description;
      
      if (currentArchitecture && currentArchitecture.nodes.length > 0) {
        const services = currentArchitecture.nodes
          .filter(n => n.type === 'azureNode')
          .map(n => ({
            name: n.data.label,
            type: n.data.serviceName || n.data.service || n.data.label,
            group: n.parentNode || 'none'
          }));
        
        const groups = currentArchitecture.nodes
          .filter(n => n.type === 'groupNode')
          .map(n => ({
            name: n.data.label,
            id: n.id
          }));
        
        const connections = currentArchitecture.edges
          .map(e => ({
            from: services.find(s => currentArchitecture.nodes.find(n => n.id === e.source)?.data.label === s.name)?.name || e.source,
            to: services.find(s => currentArchitecture.nodes.find(n => n.id === e.target)?.data.label === s.name)?.name || e.target,
            label: e.label || ''
          }));
        
        contextPrompt = `EXISTING ARCHITECTURE: "${currentArchitecture.architectureName}"

Current services:
${services.map(s => `- ${s.name} (${s.type})${s.group !== 'none' ? ` in group "${s.group}"` : ''}`).join('\n')}

${groups.length > 0 ? `Current groups:\n${groups.map(g => `- ${g.name}`).join('\n')}\n` : ''}
${connections.length > 0 ? `Current connections:\n${connections.map(c => `- ${c.from} → ${c.to}${c.label ? ` (${c.label})` : ''}`).join('\n')}\n` : ''}

USER REQUEST: ${description}

IMPORTANT: The user wants to MODIFY the existing architecture above. Keep all existing services, groups, and connections unless the user explicitly asks to remove them. Only add, modify, or remove what the user requested.`;
      }
      
      // Call Azure OpenAI to generate architecture
      const result = await generateArchitectureWithAI(contextPrompt);
      
      // Store similar architectures if available
      if (result.similarArchitectures) {
        setSimilarArchitectures(result.similarArchitectures);
      }
      
      // Store AI metrics if available
      if (result.metrics) {
        setAiMetrics(result.metrics);
      }
      
      onGenerate(result, description, autoSnapshot);
      setDescription('');
      
      // Close modal after successful generation
      setTimeout(() => {
        setIsOpen(false);
        setSimilarArchitectures([]);
        setAiMetrics(null);
      }, 10000); // Give user 10 seconds to see the success message and links
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
          setSimilarArchitectures([]);
          setError('');
          // Initialize embeddings in background
          initializeReferenceArchitectures().catch(console.error);
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
              </p>

              <div className="form-group">
                <label htmlFor="architecture-description">Architecture Description</label>
                <textarea
                  id="architecture-description"
                  className="form-textarea"
                  placeholder="Example: I need a web app with a frontend, API backend, SQL database, and blob storage..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  disabled={isGenerating}
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {similarArchitectures.length > 0 && (
                <div className="similar-architectures">
                  <h3>✓ Architecture generated successfully!</h3>
                  {aiMetrics && (
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
                  )}
                  <p>Your architecture is similar to these Microsoft reference architectures. Click to learn more about best practices:</p>
                  <ul>
                    {similarArchitectures.map((arch, i) => (
                      <li key={i}>
                        <a href={arch.url} target="_blank" rel="noopener noreferrer">
                          {arch.name}
                        </a>
                      </li>
                    ))}
                  </ul>
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
              <div className="model-selector-wrapper">
                <ModelSelector compact />
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
                  onClick={() => {
                    setIsOpen(false);
                    setSimilarArchitectures([]);
                  }}
                  disabled={isGenerating}
                >
                  {similarArchitectures.length > 0 ? 'Close' : 'Cancel'}
                </button>
                <button
                  className="btn btn-primary btn-generate-ai"
                  onClick={handleGenerate}
                  disabled={isGenerating || !description.trim()}
                  style={{ display: similarArchitectures.length > 0 ? 'none' : 'flex' }}
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

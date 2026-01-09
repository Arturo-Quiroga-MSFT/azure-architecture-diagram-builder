import React, { useState } from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { generateArchitectureWithAI, isAzureOpenAIConfigured } from '../services/azureOpenAI';
import { initializeReferenceArchitectures } from '../services/referenceArchitectureService';
import './AIArchitectureGenerator.css';

interface AIArchitectureGeneratorProps {
  onGenerate: (architecture: any, prompt: string) => void;
}

const AIArchitectureGenerator: React.FC<AIArchitectureGeneratorProps> = ({ onGenerate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [similarArchitectures, setSimilarArchitectures] = useState<any[]>([]);

  const examplePrompts = [
    "A web application with a React frontend, Node.js backend API, PostgreSQL database, and blob storage for images",
    "An IoT solution that collects data from devices, processes it with Azure Functions, stores in Cosmos DB, and visualizes with Power BI",
    "A microservices architecture with container apps, API gateway, message queue, and Redis cache",
    "A machine learning pipeline with data ingestion, training, and inference endpoints",
    "A multiplayer gaming backend with real-time communication, player matchmaking, leaderboards, and game asset delivery via CDN",
    "An e-commerce platform with product catalog, shopping cart, order processing, payment integration, and inventory management",
    "A healthcare data platform with FHIR API for patient records, medical imaging storage, and health analytics with compliance logging",
    "An intelligent document processing system using Computer Vision for image analysis, Document Intelligence for form extraction, Speech Services for audio transcription, and Text Analytics for sentiment analysis, with API keys and secrets managed in Key Vault, results stored in Cosmos DB and exposed via API Management"
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

    try {
      // Call Azure OpenAI to generate architecture
      const result = await generateArchitectureWithAI(description);
      
      // Store similar architectures if available
      if (result.similarArchitectures) {
        setSimilarArchitectures(result.similarArchitectures);
      }
      
      onGenerate(result, description);
      setDescription('');
      
      // Close modal after successful generation
      setTimeout(() => {
        setIsOpen(false);
        setSimilarArchitectures([]);
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
        className="btn btn-ai"
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
        AI Generate
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
                className="btn btn-primary"
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
      )}
    </>
  );
};

export default AIArchitectureGenerator;

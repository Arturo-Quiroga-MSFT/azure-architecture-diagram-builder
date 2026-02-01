# Azure Architecture Diagram Builder

<div align="center">

![Azure](https://img.shields.io/badge/Azure-0078D4?style=for-the-badge&logo=microsoft-azure&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![GPT-5.2](https://img.shields.io/badge/GPT--5.2-412991?style=for-the-badge&logo=openai&logoColor=white)

**A professional AI-powered tool for designing, validating, and deploying Azure cloud architectures**

[Live Demo](https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io) • [Documentation](DOCS/ARCHITECTURE.md) • [Report Bug](../../issues)

</div>

---

## 👤 Author

**Arturo Quiroga**  
*Senior Partner Solutions Architect (PSA) - Microsoft*

---

## 📖 Overview

Azure Architecture Diagram Builder is an enterprise-grade web application that empowers cloud architects to design, visualize, validate, and deploy Azure solutions. Leveraging **GPT-5.2** (Azure OpenAI's latest reasoning model), it transforms natural language descriptions into professional architecture diagrams while providing real-time cost estimates, Well-Architected Framework validation, and Infrastructure as Code generation.

### Why This Tool?

- **Speed**: Go from idea to deployable architecture in minutes, not hours
- **Accuracy**: Official Azure icons, real-time pricing from Azure Retail Prices API
- **Best Practices**: Built-in WAF validation ensures your architecture follows Microsoft recommendations
- **Actionable Output**: Generate deployment guides with Bicep/ARM templates ready for production

---

## ✨ Key Features

### 🤖 AI-Powered Architecture Generation
Describe your architecture in plain English and let GPT-5.2 automatically create a complete, professionally organized diagram with logical service groupings.

```
"Create a microservices e-commerce platform with high availability"
→ Generates: AKS, API Management, Cosmos DB, Redis Cache, Service Bus, and more
```

### 📋 ARM Template Import
Import existing ARM templates and automatically visualize your current infrastructure. The AI parses resource dependencies and creates meaningful diagrams.

### 🎯 Well-Architected Framework Validation
Validate your architecture against all five WAF pillars:
- **Security** - Identity, encryption, network isolation
- **Reliability** - High availability, disaster recovery
- **Performance** - Scaling, caching, optimization
- **Cost Optimization** - Right-sizing, reserved instances
- **Operational Excellence** - Monitoring, automation

Select specific recommendations and automatically regenerate an improved architecture.

### 📄 Deployment Guide Generation with Bicep
Generate comprehensive deployment documentation including:
- Prerequisites and Azure resource requirements
- Step-by-step deployment instructions
- **Bicep templates** for each service (Infrastructure as Code)
- Post-deployment verification steps
- Security configuration recommendations

### 💰 Real-Time Multi-Region Cost Estimation
Get instant cost estimates across **5 Azure regions**:
- East US 2, Canada Central, Brazil South, West Europe, Sweden Central

Features include:
- Color-coded legend (green/yellow/red based on cost thresholds)
- Export cost breakdown to CSV
- SKU and tier information for each service

### 🏗️ Reference Architecture Library
Start from proven patterns:
- Basic Web Application
- Machine Learning Pipeline
- IoT Analytics
- Microservices with AKS
- Event-Driven Architecture
- Enterprise Data Warehouse
- Hybrid Integration
- CI/CD Pipeline (DevOps)

### 📦 Version History & Snapshots
- Save named snapshots with descriptions
- Browse and restore previous versions
- Track architecture evolution over time
- Cloud sync with shareable URLs

### 🎨 Professional Diagramming
- **400+ Official Azure Icons** - Complete service library
- **Smart Grouping** - Logical organization (Frontend, Backend, Data, Security)
- **Editable Connections** - Labels, animations, custom styling
- **Alignment Tools** - Professional layout assistance
- **Title Block & Legend** - Document-ready diagrams

### 📤 Export Options
| Format | Use Case |
|--------|----------|
| **PNG** | Documentation, presentations |
| **SVG** | Scalable vector graphics |
| **Draw.io** | Edit in diagrams.net |
| **JSON** | Backup, version control |
| **CSV** | Cost analysis in Excel |

---

## 🏗️ Architecture

### Application Flow

```mermaid
flowchart TD
    subgraph User["👤 User Interface"]
        A[Natural Language Input] --> B[AI Generator]
        C[ARM Template Upload] --> D[Template Parser]
        E[Drag & Drop Icons] --> F[Manual Design]
    end

    subgraph AI["🤖 AI Services (GPT-5.2)"]
        B --> G[Architecture Generation]
        D --> G
        G --> H[Diagram Specification]
    end

    subgraph Core["⚙️ Core Engine"]
        H --> I[React Flow Canvas]
        F --> I
        I --> J[Node Manager]
        I --> K[Connection Manager]
        I --> L[Group Manager]
    end

    subgraph Services["🔧 Services"]
        J --> M[Cost Estimation]
        J --> N[WAF Validation]
        J --> O[Deployment Guide]
        M --> P[Azure Pricing API]
        N --> Q[AI Validator]
        O --> R[Bicep Generator]
    end

    subgraph Export["📤 Export"]
        I --> S[PNG/SVG]
        I --> T[Draw.io XML]
        I --> U[JSON Backup]
        M --> V[CSV Cost Report]
        O --> W[Deployment Docs]
        R --> X[Bicep Templates]
    end

    style AI fill:#412991,color:#fff
    style Core fill:#0078D4,color:#fff
    style Services fill:#50E6FF,color:#000
    style Export fill:#00A36C,color:#fff
```

### Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant AI as Azure OpenAI
    participant P as Pricing API
    participant S as Storage

    U->>UI: Describe architecture
    UI->>AI: Generate request (GPT-5.2)
    AI-->>UI: Diagram specification (JSON)
    UI->>UI: Render nodes & connections
    UI->>P: Fetch regional pricing
    P-->>UI: Cost data (5 regions)
    UI->>UI: Display cost legend
    
    U->>UI: Validate architecture
    UI->>AI: WAF validation request
    AI-->>UI: Recommendations by pillar
    U->>UI: Select improvements
    UI->>AI: Regenerate with improvements
    AI-->>UI: Updated architecture
    
    U->>UI: Generate deployment guide
    UI->>AI: Documentation request
    AI-->>UI: Guide + Bicep templates
    
    U->>UI: Save/Share
    UI->>S: Store diagram
    S-->>UI: Shareable URL
```

### Component Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (React + TypeScript)"]
        App[App.tsx]
        App --> Canvas[React Flow Canvas]
        App --> Palette[Icon Palette]
        App --> AIGen[AI Generator Modal]
        App --> Validation[Validation Modal]
        App --> Deploy[Deployment Guide Modal]
        App --> Version[Version History]
        
        Canvas --> AzureNode[Azure Node Component]
        Canvas --> GroupNode[Group Node Component]
        Canvas --> EditableEdge[Editable Edge]
        Canvas --> Legend[Cost Legend]
        Canvas --> TitleBlock[Title Block]
    end

    subgraph Services["Services Layer"]
        azureOpenAI[azureOpenAI.ts]
        costService[costEstimationService.ts]
        validator[architectureValidator.ts]
        deployGen[deploymentGuideGenerator.ts]
        pricing[regionalPricingService.ts]
        drawio[drawioExporter.ts]
        refArch[referenceArchitectureService.ts]
    end

    subgraph External["External APIs"]
        OpenAI[Azure OpenAI API]
        PricingAPI[Azure Retail Prices API]
        BlobStorage[Azure Blob Storage]
        CosmosDB[Cosmos DB]
    end

    AIGen --> azureOpenAI
    Validation --> validator
    Deploy --> deployGen
    Legend --> costService
    costService --> pricing
    
    azureOpenAI --> OpenAI
    pricing --> PricingAPI
    Version --> BlobStorage
    Version --> CosmosDB

    style Frontend fill:#61DAFB,color:#000
    style Services fill:#3178C6,color:#fff
    style External fill:#0078D4,color:#fff
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm** or **yarn**
- **Azure OpenAI** resource with GPT model deployment

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/azure-diagrams.git
cd azure-diagrams
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root:

```bash
# Azure OpenAI Configuration (Required)
VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
VITE_AZURE_OPENAI_API_KEY=your-api-key-here
VITE_AZURE_OPENAI_DEPLOYMENT=gpt-5.2-2025-12-11

# Reasoning model configuration
VITE_REASONING_EFFORT=medium  # low | medium | high

# Optional: Cloud storage for sharing
AZURE_COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
COSMOS_DATABASE_ID=diagrams
COSMOS_CONTAINER_ID=diagrams
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5173`

### Docker Deployment

```bash
# Build the image
docker build -t azure-diagram-builder .

# Run locally
docker run -p 80:80 \
  -e VITE_AZURE_OPENAI_ENDPOINT="..." \
  -e VITE_AZURE_OPENAI_API_KEY="..." \
  -e VITE_AZURE_OPENAI_DEPLOYMENT="..." \
  azure-diagram-builder
```

---

## 📚 Usage Guide

### Creating Diagrams

#### Method 1: AI Generation (Recommended)
1. Click **"AI Generate"** in the toolbar
2. Describe your architecture in natural language
3. Optionally select a reference architecture as starting point
4. Click **Generate** and watch the magic happen

#### Method 2: ARM Template Import
1. Click **"Import ARM"** in the toolbar
2. Paste your ARM template JSON
3. AI parses and visualizes your existing infrastructure

#### Method 3: Manual Design
1. Browse the icon palette (left sidebar)
2. Drag services onto the canvas
3. Connect services by clicking and dragging between them
4. Double-click labels to edit

### Validating Architecture

1. Design or generate your architecture
2. Click **"Validate"** in the toolbar
3. Review recommendations by WAF pillar
4. Check the improvements you want to implement
5. Click **"Regenerate with Selected"** to apply

### Generating Deployment Guide

1. Complete your architecture design
2. Click **"Deployment Guide"** in the toolbar
3. Review the generated documentation:
   - Prerequisites
   - Deployment steps
   - Bicep templates (expandable)
   - Security recommendations
4. Download individual Bicep files or all as ZIP

### Working with Costs

- Costs update automatically as you add services
- Use the **Region Selector** to compare pricing
- Legend shows color-coded cost ranges
- Export to CSV for detailed analysis

---

## 🛠️ Technology Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 18, TypeScript, React Flow, Vite |
| **AI** | Azure OpenAI (GPT-5.2), Reasoning Models |
| **Styling** | CSS3, html-to-image |
| **Backend** | Node.js, Express (optional API server) |
| **Storage** | Azure Cosmos DB, Azure Blob Storage |
| **APIs** | Azure Retail Prices API |
| **Export** | JSZip, Draw.io XML format |
| **Deployment** | Docker, Azure Container Apps |

---

## 📁 Project Structure

```
azure-diagrams/
├── src/
│   ├── components/           # React components
│   │   ├── AIArchitectureGenerator.tsx
│   │   ├── ValidationModal.tsx
│   │   ├── DeploymentGuideModal.tsx
│   │   ├── IconPalette.tsx
│   │   ├── AzureNode.tsx
│   │   ├── GroupNode.tsx
│   │   ├── Legend.tsx
│   │   └── ...
│   ├── services/             # Business logic
│   │   ├── azureOpenAI.ts    # AI integration
│   │   ├── architectureValidator.ts
│   │   ├── deploymentGuideGenerator.ts
│   │   ├── costEstimationService.ts
│   │   └── ...
│   ├── data/                 # Static data
│   │   ├── pricing/          # Regional pricing data
│   │   └── referenceArchitectures.json
│   └── App.tsx               # Main application
├── server/                   # Backend API (optional)
├── Azure_Public_Service_Icons/  # Official Azure icons
├── DOCS/                     # Documentation
└── Dockerfile               # Container configuration
```

---

## 📖 Documentation

- **[System Architecture](DOCS/ARCHITECTURE.md)** - Technical deep-dive
- **[Regional Pricing](DOCS/REGIONAL_PRICING_IMPLEMENTATION.md)** - Cost estimation details
- **[Services Pricing](DOCS/services_pricing.md)** - Supported services and tiers
- **[Icon Mapping](DOCS/ICON_MAPPING.md)** - Service to icon reference

---

## 🌟 What's New

### February 2026
- **GPT-5.2 Integration** - Latest Azure OpenAI reasoning model
- **Bicep Templates** - IaC generation in deployment guides
- **Node 20** - Updated runtime for better performance
- **Reasoning Effort** - Configurable AI thinking depth

### January 2026
- **WAF Validation** - Well-Architected Framework checks
- **Iterative Improvement** - Select and apply recommendations
- **Version History** - Snapshots and time travel
- **Draw.io Export** - Edit in diagrams.net
- **5 Azure Regions** - Expanded pricing coverage

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project uses the official Microsoft Azure icon library. Please refer to [Microsoft's usage guidelines](https://docs.microsoft.com/en-us/azure/architecture/icons/) for the icons.

---

<div align="center">

**Built with ❤️ for the Azure community**

*Empowering cloud architects to design better solutions faster*

</div>

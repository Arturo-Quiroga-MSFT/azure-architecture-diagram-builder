# Azure Architecture Diagram Builder

A professional web-based tool for creating Azure architecture diagrams using the official Azure icon library.

## Features

- 🤖 **AI-Powered Generation**: Describe your architecture in plain English and let AI automatically create the diagram
- 🎨 **Official Azure Icons**: Complete library of Azure service icons organized by category
- 🖱️ **Drag & Drop Interface**: Intuitive drag-and-drop functionality for placing services
- 🔗 **Smart Connections**: Connect services with animated arrows to show data flow
- ✏️ **Editable Labels**: Double-click any service to edit its label
- 💾 **Save & Load**: Save your diagrams as JSON files and load them later
- 📸 **Export**: Export diagrams as PNG images for documentation
- 🗺️ **Mini Map**: Navigate large diagrams easily with the mini map
- 🔍 **Search**: Quickly find Azure services across all categories

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure Azure OpenAI (required for AI generation feature):

Create a `.env` file in the project root:

```bash
VITE_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
VITE_AZURE_OPENAI_API_KEY=your-api-key-here
VITE_AZURE_OPENAI_DEPLOYMENT=your-deployment-name
```

To get these values:
- **Endpoint**: From your Azure OpenAI resource in Azure Portal
- **API Key**: Found in "Keys and Endpoint" section of your resource
- **Deployment**: The name of your GPT-4 or GPT-4o deployment

3. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

## Usage

### Manual Diagram Creation

1. **Browse Icons**: Expand categories in the left panel to see available Azure services
2. **Add Services**: Drag icons from the palette onto the canvas
3. **Connect Services**: Click and drag from one service to another to create connections
4. **Edit Labels**: Double-click on any service label to edit it
5. **Export**: Use the "Export PNG" button to save your diagram as an image
6. **Save/Load**: Save your work as JSON and reload it later

### AI-Powered Generation

1. **Open AI Generator**: Click the "AI Generate" button in the top toolbar
2. **DescribeIArchitectureGenerator.tsx  # AI-powered diagram generation
│   │   ├── AIArchitectureGenerator.css  # AI modal styling
│   │   ├── AzureNode.tsx                # Custom node component for Azure services
│   │   ├── AzureNode.css                # Node styling
│   │   ├── IconPalette.tsx              # Icon library sidebar
│   │   └── IconPalette.css              # Palette styling
│   ├── utils/
│   │   └── iconLoader.ts                # Icon loading utilities
│   ├── App.tsx                          # Main application component
│   ├── App.css                          # Application styling
│   ├── main.tsx                         # Application entry point
│   └── index.css                        # Global styles
├── Azure_Public_Service_Icons/        
## Project Structure

```
├── src/
│   ├── components/
│   │   ├── AzureNode.tsx        # Custom node component for Azure services
│   │   ├── AzureNode.css        # Node styling
│   │   ├── IconPalette.tsx      # Icon library sidebar
│   │   └── IconPalette.css      # Palette styling
│   ├── utils/
│   │   └── iconLoader.ts        # Icon loading utilities
│   ├── App.tsx                  # Main application component
│   ├── App.css                  # Application styling
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── Azure_Public_Service_Icons/  # Azure icon library
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Technologies Used

- **React 18**: UI framework
- **TypeScript**: Type-safe development
- **ReactFlow**: Diagram and flowchart library
- **Vite**: Fast build tool and dev server
- **Azure OpenAI**: GPT-4/GPT-4o for intelligent architecture generation
- **@azure/openai**: Official Azure OpenAI SDK
- **html-to-image**: Diagram export functionality

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

This project uses the official Microsoft Azure icon library. Please refer to Microsoft's usage guidelines for the icons.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

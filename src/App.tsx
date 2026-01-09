import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import html2canvas from 'html2canvas';
import { Download, Save, Upload } from 'lucide-react';
import IconPalette from './components/IconPalette';
import AzureNode from './components/AzureNode';
import GroupNode from './components/GroupNode';
import AIArchitectureGenerator from './components/AIArchitectureGenerator';
import TitleBlock from './components/TitleBlock';
import Legend from './components/Legend';
import EditableEdge from './components/EditableEdge';
import AlignmentToolbar from './components/AlignmentToolbar';
import WorkflowPanel from './components/WorkflowPanel';
import RegionSelector from './components/RegionSelector';
import { loadIconsFromCategory } from './utils/iconLoader';
import { initializeNodePricing, calculateCostBreakdown } from './services/costEstimationService';
import { prefetchCommonServices } from './services/azurePricingService';
import { preloadCommonServices, setActiveRegion, getActiveRegion, AzureRegion } from './services/regionalPricingService';
import { formatMonthlyCost } from './utils/pricingHelpers';
import './App.css';

const nodeTypes = {
  azureNode: AzureNode,
  groupNode: GroupNode,
};

const edgeTypes = {
  editableEdge: EditableEdge,
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [architecturePrompt, setArchitecturePrompt] = useState<string>('');
  const [promptBannerPosition, setPromptBannerPosition] = useState({ x: 0, y: 0 });
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isUploadingARM, setIsUploadingARM] = useState(false);
  const [workflow, setWorkflow] = useState<any[]>([]);
  // const [showWorkflow, setShowWorkflow] = useState(false);
  const [highlightedServices, setHighlightedServices] = useState<string[]>([]);
  const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
  const [titleBlockData, setTitleBlockData] = useState({
    architectureName: 'Untitled Architecture',
    author: 'Azure Architect',
    version: '1.0',
    date: new Date().toLocaleDateString(),
  });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const addGroupBox = useCallback(() => {
    const newNode: Node = {
      id: `group-${Date.now()}`,
      type: 'groupNode',
      position: { x: 250, y: 150 },
      data: { 
        label: 'Group Label',
      },
      style: {
        width: 400,
        height: 300,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Preload pricing data on mount
  useEffect(() => {
    preloadCommonServices().catch(err => 
      console.warn('Failed to preload regional pricing:', err)
    );
    prefetchCommonServices('eastus2').catch(err => 
      console.warn('Failed to prefetch API pricing:', err)
    );
  }, []);

  // Recalculate total cost whenever nodes change
  useEffect(() => {
    const breakdown = calculateCostBreakdown(nodes);
    setTotalMonthlyCost(breakdown.totalMonthlyCost);
  }, [nodes]);

  // Handle region change
  const handleRegionChange = useCallback(async (region: AzureRegion) => {
    console.log(`🌍 Region changed to ${region}, updating all node pricing...`);
    
    // Update all nodes with new regional pricing
    const updatedNodes = await Promise.all(
      nodes.map(async (node) => {
        if (node.type === 'azureNode' && node.data.label) {
          const newPricing = await initializeNodePricing(node.data.label, region);
          if (newPricing) {
            return { ...node, data: { ...node.data, pricing: newPricing } };
          }
        }
        return node;
      })
    );
    
    setNodes(updatedNodes);
  }, [nodes, setNodes]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingBanner) {
        setPromptBannerPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingBanner(false);
    };

    if (isDraggingBanner) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingBanner, dragOffset]);

  const handleEdgeLabelChange = useCallback((edgeId: string, newLabel: string) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            label: newLabel,
            data: { ...edge.data, onLabelChange: handleEdgeLabelChange },
          };
        }
        return edge;
      })
    );
  }, [setEdges]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      type: 'editableEdge',
      label: '',
      data: { onLabelChange: handleEdgeLabelChange },
    }, eds)),
    [setEdges, handleEdgeLabelChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const iconPath = event.dataTransfer.getData('iconPath');
      const iconName = event.dataTransfer.getData('iconName');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position,
        data: { 
          label: iconName,
          iconPath: iconPath,
        },
      };

      setNodes((nds) => nds.concat(newNode));

      // Initialize pricing asynchronously with current region
      const currentRegion = getActiveRegion();
      initializeNodePricing(iconName, currentRegion).then(pricing => {
        if (pricing) {
          setNodes((nds) => 
            nds.map(n => 
              n.id === newNode.id 
                ? { ...n, data: { ...n.data, pricing } }
                : n
            )
          );
        }
      }).catch(err => console.warn('Failed to initialize pricing:', err));
    },
    [reactFlowInstance, setNodes]
  );

  const exportDiagram = useCallback(async () => {
    if (!reactFlowWrapper.current || !reactFlowInstance) {
      return;
    }

    // Fit all nodes into view with no animation for immediate rendering
    reactFlowInstance.fitView({ padding: 0.2, duration: 0 });

    // Wait longer for complete rendering including edges
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(reactFlowWrapper.current as HTMLElement, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
          ignoreElements: (element) => {
            // Only exclude controls and minimap, KEEP title block and legend
            return (
              element.classList?.contains('react-flow__minimap') ||
              element.classList?.contains('react-flow__controls') ||
              element.classList?.contains('react-flow__attribution')
            );
          },
        });

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `azure-diagram-${Date.now()}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          }
        });
      } catch (err) {
        console.error('Error exporting diagram:', err);
        alert('Failed to export diagram. Please try again.');
      }
    }, 800);
  }, [reactFlowInstance]);

  const exportAsSvg = useCallback(async () => {
    if (!reactFlowWrapper.current || !reactFlowInstance) {
      return;
    }

    // Fit all nodes into view with no animation for immediate rendering
    reactFlowInstance.fitView({ padding: 0.2, duration: 0 });

    // Wait longer for complete rendering including edges
    setTimeout(async () => {
      try {
        // Use html2canvas to capture the diagram as an image first
        const canvas = await html2canvas(reactFlowWrapper.current as HTMLElement, {
          backgroundColor: '#f8fafc',
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
          ignoreElements: (element) => {
            // Exclude controls, minimap, and panels
            return (
              element.classList?.contains('react-flow__minimap') ||
              element.classList?.contains('react-flow__controls') ||
              element.classList?.contains('react-flow__attribution') ||
              element.classList?.contains('info-panel') ||
              element.classList?.contains('workflow-panel') ||
              element.classList?.contains('alignment-toolbar') ||
              element.classList?.contains('icon-palette')
            );
          },
        });

        // Convert canvas to data URL
        const imgData = canvas.toDataURL('image/png');
        
        // Create SVG with embedded image
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}" xlink:href="${imgData}"/>
</svg>`;

        // Create blob and download
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `azure-diagram-${Date.now()}.svg`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error exporting SVG:', err);
        alert('Failed to export SVG. Please try again.');
      }
    }, 800);
  }, [reactFlowInstance]);

  const saveDiagram = useCallback(() => {
    const flow = reactFlowInstance?.toObject();
    const dataStr = JSON.stringify(flow, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `azure-diagram-${Date.now()}.json`);
    link.click();
  }, [reactFlowInstance]);

  const loadDiagram = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flow = JSON.parse(e.target?.result as string);
        if (flow.nodes) setNodes(flow.nodes || []);
        if (flow.edges) setEdges(flow.edges || []);
        if (flow.viewport && reactFlowInstance) {
          reactFlowInstance.setViewport(flow.viewport);
        }
      } catch (error) {
        console.error('Error loading diagram:', error);
        alert('Error loading diagram file');
      }
    };
    reader.readAsText(file);
  }, [setNodes, setEdges, reactFlowInstance]);

  const handleAIGenerate = useCallback(async (architecture: any, prompt: string) => {
    try {
      console.log('Generating architecture from:', architecture);
      const { services, connections, groups, workflow: workflowSteps } = architecture;
      
      if (!services || services.length === 0) {
        alert('No services were identified in your description. Please try a more detailed description.');
        return;
      }

      console.log(`Processing ${services.length} services, ${connections?.length || 0} connections, ${groups?.length || 0} groups`);

      // Clear existing diagram when generating new architecture
      setNodes([]);
      setEdges([]);
      setArchitecturePrompt('');
      setWorkflow([]);
      // setShowWorkflow(false);

      // Store the prompt and workflow for display
      setArchitecturePrompt(prompt);
      if (workflowSteps && workflowSteps.length > 0) {
        setWorkflow(workflowSteps);
        // setShowWorkflow(true); // Automatically show workflow panel for new generations
      } else {
        setWorkflow([]);
      }

      const newNodes: Node[] = [];
      const serviceMap = new Map();

    // Load all required icons first
    const iconCache = new Map();
    for (const service of services) {
      const icons = await loadIconsFromCategory(service.category);
      if (icons.length > 0) {
        // Try to find the best matching icon
        const icon = icons.find(i => 
          i.name.toLowerCase().includes(service.type.toLowerCase().split(' ')[0])
        ) || icons[0]; // Fallback to first icon in category
        iconCache.set(service.id, icon);
      }
    }

    // Create group nodes first if they exist
    if (groups && groups.length > 0) {
      groups.forEach((group: any) => {
        const groupNode: Node = {
          id: group.id,
          type: 'groupNode',
          position: group.position || { x: 100, y: 100 },
          data: {
            label: group.label,
          },
          style: {
            width: group.width || 400,
            height: group.height || 300,
          },
        };
        newNodes.push(groupNode);
      });
    }

    // Create service nodes
    services.forEach((service: any) => {
      const icon = iconCache.get(service.id);
      
      // If service belongs to a group, position it relative to the group
      let position = { x: 150, y: 150 };
      
      if (service.groupId) {
        const group = groups?.find((g: any) => g.id === service.groupId);
        if (group) {
          // Position service inside the group with more spacing
          const groupIndex = services.filter((s: any) => s.groupId === service.groupId).indexOf(service);
          const servicesInGroup = services.filter((s: any) => s.groupId === service.groupId).length;
          const cols = Math.min(3, servicesInGroup);
          const row = Math.floor(groupIndex / cols);
          const col = groupIndex % cols;
          
          position = {
            x: group.position.x + 80 + (col * 200),
            y: group.position.y + 80 + (row * 180),
          };
        }
      } else {
        // For services not in a group, use a simple grid with generous spacing
        const ungroupedServices = services.filter((s: any) => !s.groupId);
        const index = ungroupedServices.indexOf(service);
        const cols = Math.ceil(Math.sqrt(ungroupedServices.length));
        const row = Math.floor(index / cols);
        const col = index % cols;
        position = {
          x: 150 + (col * 250),
          y: 600 + (row * 200),
        };
      }
      
      const node: Node = {
        id: service.id,
        type: 'azureNode',
        position,
        data: {
          label: service.name,
          iconPath: icon?.path || '',
        },
      };

      newNodes.push(node);
      serviceMap.set(service.id, node);
    });

    // Helper function to determine best connection positions based on node positions
    const getConnectionPositions = (sourceId: string, targetId: string, conn: any) => {
      // If AI specified positions, use them
      if (conn.sourcePosition && conn.targetPosition) {
        return {
          sourceHandle: conn.sourcePosition,
          targetHandle: conn.targetPosition,
        };
      }

      // Otherwise, intelligently determine based on node positions
      const sourceNode = serviceMap.get(sourceId);
      const targetNode = serviceMap.get(targetId);
      
      if (!sourceNode || !targetNode) {
        return { sourceHandle: 'right', targetHandle: 'left' }; // Default
      }

      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      
      // Determine primary direction based on larger delta
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal flow is dominant
        if (dx > 0) {
          return { sourceHandle: 'right', targetHandle: 'left' };
        } else {
          return { sourceHandle: 'left', targetHandle: 'right' };
        }
      } else {
        // Vertical flow is dominant
        if (dy > 0) {
          return { sourceHandle: 'bottom', targetHandle: 'top' };
        } else {
          return { sourceHandle: 'top', targetHandle: 'bottom' };
        }
      }
    };

    // Create edges from connections
    const newEdges: Edge[] = connections.map((conn: any, index: number) => {
      const positions = getConnectionPositions(conn.from, conn.to, conn);
      
      // Determine edge style based on connection type
      const connectionType = conn.type || 'sync';
      let edgeStyle = {};
      let animated = true;
      
      switch (connectionType) {
        case 'async':
          // Dashed line for asynchronous
          edgeStyle = { strokeDasharray: '5, 5' };
          animated = true;
          break;
        case 'optional':
          // Dotted line for optional
          edgeStyle = { strokeDasharray: '2, 4', opacity: 0.6 };
          animated = false;
          break;
        case 'sync':
        default:
          // Solid line for synchronous (default)
          edgeStyle = {};
          animated = true;
          break;
      }
      
      return {
        id: `edge-${index}`,
        source: conn.from,
        target: conn.to,
        sourceHandle: positions.sourceHandle,
        targetHandle: positions.targetHandle,
        animated,
        type: 'editableEdge',
        label: conn.label || '',
        labelStyle: { fontSize: 14, fill: '#666', fontWeight: 'bold' },
        labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        style: edgeStyle,
        data: { connectionType, onLabelChange: handleEdgeLabelChange },
      };
    });

    // Add the new nodes and edges
    console.log(`Setting ${newNodes.length} nodes and ${newEdges.length} edges`);
    setNodes(newNodes);
    setEdges(newEdges);

    // Initialize pricing for all service nodes asynchronously (uses active region)
    Promise.all(
      services.map(async (service: any) => {
        const pricing = await initializeNodePricing(service.type);
        return { id: service.id, pricing };
      })
    ).then(pricingResults => {
      setNodes((nds) => 
        nds.map(node => {
          const result = pricingResults.find(r => r.id === node.id);
          if (result?.pricing) {
            return { ...node, data: { ...node.data, pricing: result.pricing } };
          }
          return node;
        })
      );
    }).catch(err => console.warn('Failed to initialize pricing for AI nodes:', err));

    // Fit view after a short delay to allow nodes to render
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 });
      }
    }, 100);
    } catch (error) {
      console.error('Error in handleAIGenerate:', error);
      alert('Failed to generate diagram. Check console for details.');
    }
  }, [setNodes, setEdges, reactFlowInstance]);

  const uploadARMTemplate = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingARM(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const armTemplate = JSON.parse(e.target?.result as string);
        
        // Validate it's an ARM template
        if (!armTemplate.$schema || !armTemplate.resources) {
          alert('Invalid ARM template. Must contain $schema and resources.');
          setIsUploadingARM(false);
          return;
        }

        // Import the ARM parsing function
        const { generateArchitectureFromARM } = await import('./services/azureOpenAI');
        const result = await generateArchitectureFromARM(armTemplate);
        
        handleAIGenerate(result, `ARM Template: ${file.name}`);
      } catch (error: any) {
        console.error('ARM template parsing error:', error);
        alert(`Failed to parse ARM template: ${error.message}`);
      } finally {
        setIsUploadingARM(false);
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [handleAIGenerate]);

  const handleAlign = useCallback((type: string) => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length < 2) return;

    const updatedNodes = [...nodes];
    
    switch (type) {
      case 'left': {
        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        selectedNodes.forEach(node => {
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, x: minX } };
        });
        break;
      }
      case 'right': {
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.width || 150)));
        selectedNodes.forEach(node => {
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          const nodeWidth = node.width || 150;
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, x: maxX - nodeWidth } };
        });
        break;
      }
      case 'center-h': {
        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.width || 150)));
        const centerX = (minX + maxX) / 2;
        selectedNodes.forEach(node => {
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          const nodeWidth = node.width || 150;
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, x: centerX - nodeWidth / 2 } };
        });
        break;
      }
      case 'top': {
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        selectedNodes.forEach(node => {
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, y: minY } };
        });
        break;
      }
      case 'bottom': {
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.height || 100)));
        selectedNodes.forEach(node => {
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          const nodeHeight = node.height || 100;
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, y: maxY - nodeHeight } };
        });
        break;
      }
      case 'center-v': {
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.height || 100)));
        const centerY = (minY + maxY) / 2;
        selectedNodes.forEach(node => {
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          const nodeHeight = node.height || 100;
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, y: centerY - nodeHeight / 2 } };
        });
        break;
      }
      case 'distribute-h': {
        const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
        const minX = sorted[0].position.x;
        const maxX = sorted[sorted.length - 1].position.x;
        const spacing = (maxX - minX) / (sorted.length - 1);
        sorted.forEach((node, i) => {
          if (i === 0 || i === sorted.length - 1) return;
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, x: minX + spacing * i } };
        });
        break;
      }
      case 'distribute-v': {
        const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
        const minY = sorted[0].position.y;
        const maxY = sorted[sorted.length - 1].position.y;
        const spacing = (maxY - minY) / (sorted.length - 1);
        sorted.forEach((node, i) => {
          if (i === 0 || i === sorted.length - 1) return;
          const idx = updatedNodes.findIndex(n => n.id === node.id);
          updatedNodes[idx] = { ...updatedNodes[idx], position: { ...updatedNodes[idx].position, y: minY + spacing * i } };
        });
        break;
      }
    }

    setNodes(updatedNodes);
  }, [nodes, setNodes]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Azure Architecture Diagram Builder</h1>
          <div className="header-actions">
            <RegionSelector onRegionChange={handleRegionChange} />
            {totalMonthlyCost > 0 && (
              <div className="cost-indicator" title="Total estimated monthly cost for all services">
                💰 {formatMonthlyCost(totalMonthlyCost)}
              </div>
            )}
            <button onClick={addGroupBox} className="btn btn-secondary" title="Add grouping box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 4" />
              </svg>
              Add Group
            </button>
            <AIArchitectureGenerator onGenerate={handleAIGenerate} />
            <label className="btn btn-secondary" title="Upload ARM template to generate diagram">
              <Upload size={18} />
              {isUploadingARM ? 'Parsing...' : 'Import ARM'}
              <input
                type="file"
                accept=".json"
                onChange={uploadARMTemplate}
                style={{ display: 'none' }}
                disabled={isUploadingARM}
              />
            </label>
            <button onClick={exportDiagram} className="btn btn-primary" title="Export as PNG">
              <Download size={18} />
              Export PNG
            </button>
            <button onClick={exportAsSvg} className="btn btn-primary" title="Export as SVG (vector format)">
              <Download size={18} />
              Export SVG
            </button>
            <button onClick={saveDiagram} className="btn btn-secondary" title="Save diagram">
              <Save size={18} />
              Save
            </button>
            <label className="btn btn-secondary" title="Load diagram">
              <Upload size={18} />
              Load
              <input
                type="file"
                accept=".json"
                onChange={loadDiagram}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </header>
      
      <div className="workspace">
        <IconPalette />
        
        <div className="canvas-container" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid={true}
            snapGrid={[20, 20]}
            selectionOnDrag={true}
            panOnDrag={[1, 2]}
            attributionPosition="bottom-left"
          >
            <Controls />
            <MiniMap />
            <Background 
              variant={BackgroundVariant.Dots} 
              gap={20} 
              size={2.5} 
              color="#60a5fa"
              style={{ backgroundColor: '#f8fafc' }}
            />
            <style>
              {highlightedServices.map(id => 
                `.react-flow__node[data-id="${id}"] {
                  filter: drop-shadow(0 0 8px rgba(0, 120, 212, 1)) drop-shadow(0 0 16px rgba(0, 120, 212, 0.8)) !important;
                  z-index: 1000 !important;
                  animation: pulse-glow 1.5s ease-in-out infinite;
                }
                @keyframes pulse-glow {
                  0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 120, 212, 1)) drop-shadow(0 0 16px rgba(0, 120, 212, 0.8)); }
                  50% { filter: drop-shadow(0 0 12px rgba(0, 120, 212, 1)) drop-shadow(0 0 24px rgba(0, 120, 212, 0.9)); }
                }`
              ).join('\n')}
            </style>
            {architecturePrompt && (
              <div
                className="prompt-banner draggable"
                style={{
                  position: 'absolute',
                  left: promptBannerPosition.x === 0 ? '50%' : `${promptBannerPosition.x}px`,
                  top: promptBannerPosition.y === 0 ? '10px' : `${promptBannerPosition.y}px`,
                  transform: promptBannerPosition.x === 0 ? 'translateX(-50%)' : 'none',
                  cursor: isDraggingBanner ? 'grabbing' : 'grab',
                  zIndex: 1000,
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  // Calculate offset from mouse position to element's top-left corner
                  setDragOffset({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                  // Store the current absolute position
                  if (promptBannerPosition.x === 0) {
                    // First time dragging - calculate initial center position
                    const initialX = window.innerWidth / 2 - rect.width / 2;
                    setPromptBannerPosition({ x: initialX, y: 10 });
                  }
                  setIsDraggingBanner(true);
                }}
              >
                <div className="prompt-text">
                  <strong>Generated from:</strong> {architecturePrompt}
                </div>
              </div>
            )}
            <Panel position="top-right" className="info-panel">
              <div className="info-text">
                Drag icons from the left panel onto the canvas. 
                Connect nodes by dragging from one node to another.
              </div>
            </Panel>
            <TitleBlock
              architectureName={titleBlockData.architectureName}
              author={titleBlockData.author}
              version={titleBlockData.version}
              date={titleBlockData.date}
              onUpdate={(data) => setTitleBlockData({ ...titleBlockData, ...data })}
            />
            <Legend />
          </ReactFlow>
          <AlignmentToolbar 
            selectedNodes={nodes.filter(n => n.selected)}
            onAlign={handleAlign}
          />
        </div>
        {workflow.length > 0 && (
          <WorkflowPanel 
            workflow={workflow}
            onServiceHover={(serviceIds) => setHighlightedServices(serviceIds)}
            onServiceLeave={() => setHighlightedServices([])}
          />
        )}
      </div>
    </div>
  );
}

export default App;

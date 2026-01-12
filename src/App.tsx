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
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import html2canvas from 'html2canvas';
import { Download, Save, Upload, DollarSign, Shield, FileText } from 'lucide-react';
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
import ValidationModal from './components/ValidationModal';
import DeploymentGuideModal from './components/DeploymentGuideModal';
import { loadIconsFromCategory } from './utils/iconLoader';
import { getServiceIconMapping } from './data/serviceIconMapping';
import { layoutArchitecture } from './utils/layoutEngine';
import { initializeNodePricing, calculateCostBreakdown, exportCostBreakdownCSV } from './services/costEstimationService';
import { prefetchCommonServices } from './services/azurePricingService';
import { preloadCommonServices, getActiveRegion, AzureRegion } from './services/regionalPricingService';
import { formatMonthlyCost } from './utils/pricingHelpers';
import { validateArchitecture, ArchitectureValidation } from './services/architectureValidator';
import { generateDeploymentGuide, DeploymentGuide } from './services/deploymentGuideGenerator';
import { generateArchitectureWithAI } from './services/azureOpenAI';
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
  const [isApplyingRecommendations, setIsApplyingRecommendations] = useState(false);
  const [workflow, setWorkflow] = useState<any[]>([]);
  // const [showWorkflow, setShowWorkflow] = useState(false);
  const [highlightedServices, setHighlightedServices] = useState<string[]>([]);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [totalMonthlyCost, setTotalMonthlyCost] = useState(0);
  const [titleBlockData, setTitleBlockData] = useState({
    architectureName: 'Untitled Architecture',
    author: 'Azure Architect',
    version: '1.0',
    date: new Date().toLocaleDateString(),
  });
  
  // Premium Features State
  const [validationResult, setValidationResult] = useState<ArchitectureValidation | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [deploymentGuide, setDeploymentGuide] = useState<DeploymentGuide | null>(null);
  const [isDeploymentGuideModalOpen, setIsDeploymentGuideModalOpen] = useState(false);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  
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
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0078d4' },
      labelStyle: { fontSize: 14, fill: '#333', fontWeight: 'bold' },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9, stroke: '#000', strokeWidth: 1.5 },
      data: { onLabelChange: handleEdgeLabelChange, direction: 'forward' },
    }, eds)),
    [setEdges, handleEdgeLabelChange]
  );

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setEdgeContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, []);

  const closeEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu(null);
  }, []);

  const setEdgeDirection = useCallback((edgeId: string, direction: 'forward' | 'reverse' | 'bidirectional') => {
    setEdges((eds) => eds.map((edge) => {
      if (edge.id === edgeId) {
        const updatedEdge = { ...edge, data: { ...edge.data, direction } };
        
        switch (direction) {
          case 'forward':
            updatedEdge.markerEnd = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            updatedEdge.markerStart = undefined;
            break;
          case 'reverse':
            updatedEdge.markerStart = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            updatedEdge.markerEnd = undefined;
            break;
          case 'bidirectional':
            updatedEdge.markerEnd = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            updatedEdge.markerStart = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            break;
        }
        
        return updatedEdge;
      }
      return edge;
    }));
    closeEdgeContextMenu();
  }, [setEdges, closeEdgeContextMenu]);

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

      // Check if dropped inside a group
      let parentGroup: Node | undefined = undefined;
      const currentNodes = reactFlowInstance.getNodes();
      
      for (const node of currentNodes) {
        if (node.type === 'group') {
          // Check if position is within group bounds
          const groupX = node.position.x;
          const groupY = node.position.y;
          const groupWidth = (node.style?.width as number) || (node.width || 400);
          const groupHeight = (node.style?.height as number) || (node.height || 300);
          
          if (
            position.x >= groupX &&
            position.x <= groupX + groupWidth &&
            position.y >= groupY &&
            position.y <= groupY + groupHeight
          ) {
            parentGroup = node;
            break; // Use first matching group
          }
        }
      }

      const newNode: Node = {
        id: `${Date.now()}`,
        type,
        position: parentGroup ? {
          // If inside group, position relative to group
          x: position.x - parentGroup.position.x,
          y: position.y - parentGroup.position.y,
        } : position,
        data: { 
          label: iconName,
          iconPath: iconPath,
        },
        parentNode: parentGroup?.id,
        extent: parentGroup ? 'parent' : undefined,
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

  const exportCostBreakdown = useCallback(() => {
    // Calculate the cost breakdown
    const breakdown = calculateCostBreakdown(nodes);
    
    // Check if there's any cost data
    if (breakdown.byService.length === 0 || breakdown.totalMonthlyCost === 0) {
      alert('No costing information available. Please ensure your diagram contains Azure services with pricing data.');
      return;
    }

    // Export as CSV
    const csvData = exportCostBreakdownCSV(breakdown, nodes);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `azure-cost-breakdown-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

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
    
    // Category correction map - AI categorizes services differently than icon folders
    const correctCategory = (serviceType: string, aiCategory: string): string => {
      const corrections: Record<string, string> = {
        'Azure Functions': 'compute',
        'Logic Apps': 'integration',
        'API Management': 'integration',
      };
      return corrections[serviceType] || aiCategory;
    };
    
    // Load icons in parallel with timeout protection
    console.log(`⏳ Loading icons for ${services.length} services...`);
    const iconLoadingPromises = services.map(async (service: any) => {
      try {
        // FIRST: Try using serviceIconMapping for exact matches
        const mapping = getServiceIconMapping(service.type);
        if (mapping) {
          console.log(`  🎯 Found mapping for "${service.type}": ${mapping.iconFile}`);
          const iconPath = `/Azure_Public_Service_Icons/Icons/${mapping.category}/${mapping.iconFile}.svg`;
          return { 
            serviceId: service.id, 
            icon: {
              name: mapping.displayName,
              path: iconPath,
              category: mapping.category
            }
          };
        }
        
        // SECOND: Fall back to category search if no mapping found
        const correctedCategory = correctCategory(service.type, service.category);
        const icons = await Promise.race([
          loadIconsFromCategory(correctedCategory),
          new Promise<any[]>((_, reject) => 
            setTimeout(() => reject(new Error('Icon loading timeout')), 5000)
          )
        ]);
        
        console.log(`🎨 Loaded ${icons.length} icons for: ${service.name} (${correctedCategory})`);
        
        if (icons.length > 0) {
          // Try to find the best matching icon
          let icon = null;
          
          console.log(`  🔍 Searching for: "${service.type}"`);
          
          // First: Try exact match (case-insensitive)
          icon = icons.find(i => 
            i.name.toLowerCase() === service.type.toLowerCase()
          );
          if (icon) console.log(`  ✅ Exact match: ${icon.name}`);
          
          // Third: Try to match all significant words (skip common words like "Azure", "Service")
          if (!icon) {
            const serviceWords = service.type.toLowerCase()
              .split(/[\s-]+/)
              .filter((w: string) => !['azure', 'service', 'microsoft'].includes(w));
            
            icon = icons.find(i => {
              const iconWords = i.name.toLowerCase().split(/[\s-]+/);
              return serviceWords.every((word: string) => 
                iconWords.some((iw: string) => iw.includes(word) || word.includes(iw))
              );
            });
            if (icon) console.log(`  ✅ Multi-word match: ${icon.name}`);
          }
          
          // Fourth: Try matching just the primary word (first meaningful word)
          if (!icon) {
            const primaryWord = service.type.toLowerCase()
              .split(/[\s-]+/)
              .find((w: string) => !['azure', 'microsoft', 'service'].includes(w));
            
            if (primaryWord) {
              icon = icons.find(i => 
                i.name.toLowerCase().includes(primaryWord)
              );
              if (icon) console.log(`  ✅ Primary word match: ${icon.name}`);
            }
          }
          
          // Fifth: Fallback to first icon in category
          if (!icon) {
            icon = icons[0];
            console.log(`  ⚠️ Using fallback: ${icon.name}`);
          }
          
          return { serviceId: service.id, icon };
        } else {
          console.warn(`  ❌ No icons found for: ${service.name}`);
          return { serviceId: service.id, icon: null };
        }
      } catch (error) {
        console.error(`  ❌ Error loading icon for ${service.name}:`, error);
        return { serviceId: service.id, icon: null };
      }
    });
    
    // Wait for all icon loading with overall timeout
    const iconResults = await Promise.race([
      Promise.all(iconLoadingPromises),
      new Promise<any[]>((_, reject) => 
        setTimeout(() => reject(new Error('Overall icon loading timeout')), 15000)
      )
    ]).catch(error => {
      console.error('Icon loading failed:', error);
      return services.map((s: any) => ({ serviceId: s.id, icon: null }));
    });
    
    // Build icon cache from results
    iconResults.forEach((result: any) => {
      if (result.icon) {
        iconCache.set(result.serviceId, result.icon);
      }
    });
    
    console.log(`✅ Icon loading complete. Loaded ${iconCache.size}/${services.length} icons`);

    // ============================================================================
    // LAYOUT ENGINE: Calculate optimal positions using Dagre algorithm
    // ============================================================================
    console.log('📐 Calculating layout with Dagre algorithm...');
    const { services: positionedServices, groups: positionedGroups } = layoutArchitecture(
      services,
      connections,
      groups || [],
      { direction: 'LR' } // Left-to-right data flow
    );

    // Create group nodes with calculated positions and sizes
    if (positionedGroups && positionedGroups.length > 0) {
      positionedGroups.forEach((group: any) => {
        const groupNode: Node = {
          id: group.id,
          type: 'groupNode',
          position: group.position,
          data: {
            label: group.label,
          },
          style: {
            width: group.width,
            height: group.height,
          },
        };
        newNodes.push(groupNode);
      });
    }

    // Create service nodes with calculated positions
    positionedServices.forEach((service: any) => {
      const icon = iconCache.get(service.id);
      
      const node: Node = {
        id: service.id,
        type: 'azureNode',
        position: service.position,  // ✅ Use position from layout engine
        data: {
          label: service.name,
          iconPath: icon?.path || '',
        },
        parentNode: service.groupId || undefined,  // Link to group if exists
        extent: service.groupId ? 'parent' : undefined,  // Keep within parent bounds
      };

      newNodes.push(node);
      serviceMap.set(service.id, node);
    });

    // Helper function to determine best connection positions based on node positions
    const getConnectionPositions = (sourceId: string, targetId: string, conn: any) => {
      // If AI specified positions, use them (but validate they're valid)
      if (conn.sourcePosition && conn.targetPosition) {
        const validSourcePositions = ['right', 'bottom'];
        const validTargetPositions = ['left', 'top'];
        const sourcePos = validSourcePositions.includes(conn.sourcePosition) ? conn.sourcePosition : 'right';
        const targetPos = validTargetPositions.includes(conn.targetPosition) ? conn.targetPosition : 'left';
        return {
          sourceHandle: sourcePos,
          targetHandle: targetPos,
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
      // Source handles can only be 'right' or 'bottom'
      // Target handles can only be 'left' or 'top'
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal flow is dominant - use left/right
        return { sourceHandle: 'right', targetHandle: 'left' };
      } else {
        // Vertical flow is dominant - use top/bottom
        return { sourceHandle: 'bottom', targetHandle: 'top' };
      }
    };

    // Function to determine arrow direction based on edge label
    const determineEdgeDirection = (label: string): { direction: 'forward' | 'reverse' | 'bidirectional', markerEnd?: any, markerStart?: any } => {
      const lowerLabel = label.toLowerCase();
      
      // Keywords that indicate reverse flow
      const reverseKeywords = ['response', 'callback', 'return', 'acknowledge', 'ack', 'reply'];
      
      // Keywords that indicate bidirectional flow
      const bidirectionalKeywords = ['sync', 'bidirectional', 'two-way', 'exchange', 'communicate'];
      
      // Check for bidirectional
      if (bidirectionalKeywords.some(keyword => lowerLabel.includes(keyword))) {
        return {
          direction: 'bidirectional',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#0078d4' },
          markerStart: { type: MarkerType.ArrowClosed, color: '#0078d4' }
        };
      }
      
      // Check for reverse
      if (reverseKeywords.some(keyword => lowerLabel.includes(keyword))) {
        return {
          direction: 'reverse',
          markerStart: { type: MarkerType.ArrowClosed, color: '#0078d4' },
          markerEnd: undefined
        };
      }
      
      // Default to forward
      return {
        direction: 'forward',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0078d4' },
        markerStart: undefined
      };
    };

    // Create edges from connections
    const newEdges: Edge[] = connections.map((conn: any, index: number) => {
      const positions = getConnectionPositions(conn.from, conn.to, conn);
      
      // Determine edge direction based on label
      const edgeDirection = determineEdgeDirection(conn.label || '');
      
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
        markerEnd: edgeDirection.markerEnd,
        markerStart: edgeDirection.markerStart,
        labelStyle: { fontSize: 14, fill: '#333', fontWeight: 'bold' },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9, stroke: '#000', strokeWidth: 1.5 },
        style: edgeStyle,
        data: { connectionType, direction: edgeDirection.direction, onLabelChange: handleEdgeLabelChange },
      };
    });

    // Add the new nodes and edges
    console.log(`Setting ${newNodes.length} nodes and ${newEdges.length} edges`);
    setNodes(newNodes);
    setEdges(newEdges);

    // Initialize pricing for all service nodes asynchronously (uses active region)
    const currentRegion = getActiveRegion();
    console.log(`💰 Initializing pricing for ${services.length} services in region: ${currentRegion}`);
    
    const pricingPromises = services.map(async (service: any) => {
      console.log(`  → Fetching pricing for: ${service.name} (type: ${service.type}, ID: ${service.id})`);
      const pricing = await initializeNodePricing(service.name, currentRegion);
      console.log(`  ${pricing ? '✅' : '❌'} Pricing result for ${service.name}:`, pricing ? 'Found' : 'Not found');
      return { id: service.id, pricing };
    });
    
    Promise.all(pricingPromises)
      .then(pricingResults => {
        console.log(`📊 Pricing results ready, updating ${pricingResults.length} nodes`);
        const resultsWithPricing = pricingResults.filter(r => r.pricing);
        console.log(`  → ${resultsWithPricing.length}/${pricingResults.length} nodes have pricing data`);
        
        setNodes((nds) => 
          nds.map(node => {
            const result = pricingResults.find(r => r.id === node.id);
            if (result?.pricing) {
              console.log(`  💵 Adding pricing to node ${node.id}:`, result.pricing.estimatedCost);
              return { ...node, data: { ...node.data, pricing: result.pricing } };
            }
            return node;
          })
        );
        console.log(`✅ Pricing initialization complete`);
      })
      .catch(err => console.error('❌ Failed to initialize pricing for AI nodes:', err));

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

  // Premium Feature Handlers
  const handleValidateArchitecture = useCallback(async () => {
    if (nodes.length === 0) {
      alert('Please create an architecture diagram first.');
      return;
    }

    setIsValidating(true);
    setIsValidationModalOpen(true);

    try {
      // Extract services data
      const services = nodes
        .filter(n => n.type === 'azureNode')
        .map(n => ({
          name: n.data.label || n.data.serviceName || 'Unknown Service',
          type: n.data.serviceName || n.data.label || 'Unknown',
          category: n.data.category || 'General',
        }));

      // Extract connections
      const connections = edges.map(e => ({
        from: nodes.find(n => n.id === e.source)?.data?.label || e.source,
        to: nodes.find(n => n.id === e.target)?.data?.label || e.target,
        label: String(e.label || ''),
      }));

      // Extract groups
      const groups = nodes
        .filter(n => n.type === 'groupNode')
        .map(n => ({
          name: n.data.label || 'Group',
          services: nodes
            .filter(child => child.parentNode === n.id)
            .map(child => child.data.label || child.data.serviceName || 'Unknown'),
        }));

      const result = await validateArchitecture(
        services,
        connections,
        groups,
        architecturePrompt || titleBlockData.architectureName
      );

      setValidationResult(result);
    } catch (error: any) {
      console.error('Validation error:', error);
      alert(`Failed to validate architecture: ${error.message}`);
      setIsValidationModalOpen(false);
    } finally {
      setIsValidating(false);
    }
  }, [nodes, edges, architecturePrompt, titleBlockData.architectureName]);

  const handleGenerateDeploymentGuide = useCallback(async () => {
    if (nodes.length === 0) {
      alert('Please create an architecture diagram first.');
      return;
    }

    setIsGeneratingGuide(true);
    setIsDeploymentGuideModalOpen(true);

    try {
      // Extract services data
      const services = nodes
        .filter(n => n.type === 'azureNode')
        .map(n => ({
          name: n.data.label || n.data.serviceName || 'Unknown Service',
          type: n.data.serviceName || n.data.label || 'Unknown',
          category: n.data.category || 'General',
        }));

      // Extract connections
      const connections = edges.map(e => ({
        from: nodes.find(n => n.id === e.source)?.data?.label || e.source,
        to: nodes.find(n => n.id === e.target)?.data?.label || e.target,
        label: String(e.label || ''),
      }));

      // Extract groups
      const groups = nodes
        .filter(n => n.type === 'groupNode')
        .map(n => ({
          name: n.data.label || 'Group',
          services: nodes
            .filter(child => child.parentNode === n.id)
            .map(child => child.data.label || child.data.serviceName || 'Unknown'),
        }));

      const guide = await generateDeploymentGuide(
        services,
        connections,
        groups,
        architecturePrompt || titleBlockData.architectureName,
        totalMonthlyCost
      );

      setDeploymentGuide(guide);
    } catch (error: any) {
      console.error('Guide generation error:', error);
      alert(`Failed to generate deployment guide: ${error.message}`);
      setIsDeploymentGuideModalOpen(false);
    } finally {
      setIsGeneratingGuide(false);
    }
  }, [nodes, edges, architecturePrompt, titleBlockData.architectureName, totalMonthlyCost]);

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
            <button onClick={exportCostBreakdown} className="btn btn-primary" title="Export cost breakdown" disabled={totalMonthlyCost === 0}>
              <DollarSign size={18} />
              Export Costs
            </button>
            <button 
              onClick={handleValidateArchitecture} 
              className="btn btn-premium" 
              title="Validate architecture against Azure Well-Architected Framework"
              disabled={nodes.length === 0}
            >
              <Shield size={18} />
              Validate Architecture
            </button>
            <button 
              onClick={handleGenerateDeploymentGuide} 
              className="btn btn-premium" 
              title="Generate comprehensive deployment guide"
              disabled={nodes.length === 0}
            >
              <FileText size={18} />
              Deployment Guide
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
            onEdgeContextMenu={onEdgeContextMenu}
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
            {/* Loading banner for applying recommendations */}
            {isApplyingRecommendations && (
              <div
                className="prompt-banner loading-banner"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '10px',
                  transform: 'translateX(-50%)',
                  zIndex: 1001,
                  backgroundColor: '#3b82f6',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                <div className="prompt-text">
                  <strong>⏳ Applying recommendations...</strong> Regenerating architecture with improvements
                </div>
              </div>
            )}

            {/* Architecture generation prompt banner */}
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
        
        {/* Edge Context Menu */}
        {edgeContextMenu && (
          <>
            <div 
              className="edge-context-menu-overlay"
              onClick={closeEdgeContextMenu}
            />
            <div 
              className="edge-context-menu"
              style={{
                position: 'fixed',
                top: edgeContextMenu.y,
                left: edgeContextMenu.x,
                zIndex: 10000,
              }}
            >
              <div className="context-menu-header">Edge Direction</div>
              <button
                className="context-menu-item"
                onClick={() => setEdgeDirection(edgeContextMenu.edgeId, 'forward')}
              >
                <span className="menu-icon">→</span>
                <span>One-way (Forward)</span>
              </button>
              <button
                className="context-menu-item"
                onClick={() => setEdgeDirection(edgeContextMenu.edgeId, 'reverse')}
              >
                <span className="menu-icon">←</span>
                <span>One-way (Reverse)</span>
              </button>
              <button
                className="context-menu-item"
                onClick={() => setEdgeDirection(edgeContextMenu.edgeId, 'bidirectional')}
              >
                <span className="menu-icon">↔</span>
                <span>Bidirectional</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Premium Feature Modals */}
      <ValidationModal
        validation={validationResult}
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        isLoading={isValidating}
        onApplyRecommendations={async (selectedFindings) => {
          console.log('📝 User selected recommendations to apply:', selectedFindings);
          
          // Close validation modal and show loading state
          setIsValidationModalOpen(false);
          setIsApplyingRecommendations(true);
          
          // Get current architecture state
          const currentServices = nodes
            .filter(n => n.type === 'serviceNode')
            .map(n => ({
              id: n.id,
              name: n.data.label,
              type: n.data.service || n.data.label,
              category: n.data.category || 'general',
              description: n.data.description || '',
            }));
          
          const currentConnections = edges.map(e => ({
            from: e.source,
            to: e.target,
            label: e.label || '',
            type: e.data?.type || 'sync'
          }));
          
          const currentGroups = nodes
            .filter(n => n.type === 'groupNode')
            .map(n => ({
              id: n.id,
              label: n.data.label,
            }));
          
          // Format recommendations for the prompt
          const recommendationsText = selectedFindings
            .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.category}: ${f.recommendation}`)
            .join('\n');
          
          // Build regeneration prompt
          const regenerationPrompt = `You are regenerating an existing Azure architecture with improvements based on Well-Architected Framework recommendations.

CURRENT ARCHITECTURE:
Services: ${currentServices.map(s => `${s.name} (${s.type})`).join(', ')}
Connections: ${currentConnections.length} connections
Groups: ${currentGroups.map(g => g.label).join(', ')}

SELECTED RECOMMENDATIONS TO APPLY:
${recommendationsText}

CRITICAL INSTRUCTIONS:
1. Keep all existing services that are working well and not affected by recommendations
2. Add new services recommended (e.g., Azure DevOps, Azure Monitor, Application Insights, Azure Front Door, Redis Cache, etc.)
3. **IMPORTANT**: Place ALL new services into appropriate logical groups:
   - DevOps/CI/CD services → "DevOps & Deployment" or "CI/CD Pipeline" group
   - Monitoring services → Add to existing monitoring group or create "Monitoring & Observability" group
   - Security services → Add to existing security group or create "Security & Compliance" group
   - Caching services → Add to "Data & Cache" or similar group
   - Never leave services ungrouped unless they are truly standalone
4. Update connections to reflect security improvements, monitoring, and best practices
5. Maintain and extend the logical grouping structure - create new groups as needed for new service categories
6. Ensure the architecture implements the selected recommendations

Return the IMPROVED architecture in the same JSON format as before with proper group assignments.`;

          console.log('🔄 Regenerating architecture with recommendations...');
          console.log('📋 Prompt:', regenerationPrompt);
          
          // Call Azure OpenAI to regenerate
          try {
            const improvedArchitecture = await generateArchitectureWithAI(regenerationPrompt);
            
            if (improvedArchitecture) {
              // Detect newly added services
              const existingServiceNames = new Set(currentServices.map(s => s.name.toLowerCase()));
              const newServices = improvedArchitecture.services
                .filter((s: any) => !existingServiceNames.has(s.name.toLowerCase()))
                .map((s: any) => s.name);
              
              // Build descriptive banner text
              let bannerText = `Original architecture improved with ${selectedFindings.length} WAF recommendation${selectedFindings.length > 1 ? 's' : ''}`;
              if (newServices.length > 0) {
                bannerText += `. Added: ${newServices.join(', ')}`;
              }
              
              // Apply the improved architecture
              await handleAIGenerate(improvedArchitecture, bannerText);
              
              setIsApplyingRecommendations(false);
              alert(`✅ Architecture regenerated successfully!\n\nApplied ${selectedFindings.length} recommendations.\n${newServices.length > 0 ? `\nAdded ${newServices.length} new services: ${newServices.join(', ')}` : ''}`);
            }
          } catch (error) {
            console.error('❌ Failed to regenerate architecture:', error);
            setIsApplyingRecommendations(false);
            alert('Failed to regenerate architecture. Please try again.');
          }
        }}
      />
      <DeploymentGuideModal
        guide={deploymentGuide}
        isOpen={isDeploymentGuideModalOpen}
        onClose={() => setIsDeploymentGuideModalOpen(false)}
        isLoading={isGeneratingGuide}
      />
    </div>
  );
}

export default App;

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
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import html2canvas from 'html2canvas';
import { Download, Save, Upload, DollarSign, Shield, FileText, ChevronDown, Clock, Camera, Loader, GitCompare, RefreshCw } from 'lucide-react';
import IconPalette from './components/IconPalette';
import AzureNode from './components/AzureNode';
import GroupNode from './components/GroupNode';
import AIArchitectureGenerator from './components/AIArchitectureGenerator';
import TitleBlock from './components/TitleBlock';
import ModelBadge from './components/ModelBadge';
import Legend from './components/Legend';
import EditableEdge from './components/EditableEdge';
import AlignmentToolbar from './components/AlignmentToolbar';
import WorkflowPanel from './components/WorkflowPanel';
import RegionSelector from './components/RegionSelector';
import ValidationModal from './components/ValidationModal';
import DeploymentGuideModal from './components/DeploymentGuideModal';
import VersionHistoryModal from './components/VersionHistoryModal';
import SaveSnapshotModal from './components/SaveSnapshotModal';
import ModelSettingsPopover from './components/ModelSettingsPopover';
import CompareModelsModal from './components/CompareModelsModal';
import { loadIconsFromCategory } from './utils/iconLoader';
import { getServiceIconMapping } from './data/serviceIconMapping';
import { layoutArchitecture } from './utils/layoutEngine';
import { layoutArchitecture as elkLayoutArchitecture } from './utils/elkLayoutEngine';
import { initializeNodePricing, calculateCostBreakdown, exportCostBreakdownCSV } from './services/costEstimationService';
import { prefetchCommonServices } from './services/azurePricingService';
import { preloadCommonServices, getActiveRegion, AzureRegion } from './services/regionalPricingService';
import { formatMonthlyCost } from './utils/pricingHelpers';
import { validateArchitecture, ArchitectureValidation } from './services/architectureValidator';
import { generateDeploymentGuide, DeploymentGuide } from './services/deploymentGuideGenerator';
import { generateArchitectureWithAI } from './services/azureOpenAI';
import { MODEL_CONFIG } from './stores/modelSettingsStore';
import { createSnapshot, DiagramVersion } from './services/versionStorageService';
import { exportAndDownloadDrawio } from './services/drawioExporter';
import {
  applyLayoutPreset,
  type LayoutPreset,
  type LayoutSpacing,
  type LayoutEdgeStyle,
  type LayoutEngineType,
} from './utils/layoutPresets';
import { generateModelFilename } from './utils/modelNaming';
import microsoftLogoWhite from './assets/microsoft-logo-white.avif';
import './App.css';

const nodeTypes = {
  azureNode: AzureNode,
  groupNode: GroupNode,
};

const edgeTypes = {
  editableEdge: EditableEdge,
};

type ExportHistoryKind = 'png' | 'svg' | 'costs' | 'json' | 'drawio';

type ExportHistoryItem = {
  id: string;
  kind: ExportHistoryKind;
  fileName: string;
  createdAt: number;
};

const EXPORT_HISTORY_STORAGE_KEY = 'azure-diagram-builder.exportHistory.v1';

function App() {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [architecturePrompt, setArchitecturePrompt] = useState<string>('');
  const [promptBannerPosition, setPromptBannerPosition] = useState({ x: 0, y: 0 });
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [isUploadingARM, setIsUploadingARM] = useState(false);
  const [isApplyingRecommendations, setIsApplyingRecommendations] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  const onNodesChange = useCallback((changes: any[]) => {
    onNodesChangeBase(changes);
  }, [onNodesChangeBase]);

  
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
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  // Premium Features State
  const [validationResult, setValidationResult] = useState<ArchitectureValidation | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [deploymentGuide, setDeploymentGuide] = useState<DeploymentGuide | null>(null);
  const [isDeploymentGuideModalOpen, setIsDeploymentGuideModalOpen] = useState(false);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [generatedWithModel, setGeneratedWithModel] = useState<{ name: string; timeMs?: number } | null>(null);

  // Version History State
  const [isVersionHistoryModalOpen, setIsVersionHistoryModalOpen] = useState(false);
  const [isSaveSnapshotModalOpen, setIsSaveSnapshotModalOpen] = useState(false);
  const [isCompareModelsOpen, setIsCompareModelsOpen] = useState(false);
  const [panelsCollapsedSignal, setPanelsCollapsedSignal] = useState(0);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);

  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('flow-lr');
  const [layoutSpacing, setLayoutSpacing] = useState<LayoutSpacing>('comfortable');
  const [layoutEdgeStyle, setLayoutEdgeStyle] = useState<LayoutEdgeStyle>('smooth');
  const [layoutEmphasizePrimaryPath, setLayoutEmphasizePrimaryPath] = useState(false);
  const [layoutEngine, setLayoutEngine] = useState<LayoutEngineType>('dagre');
  
  const [isBulkSelectMenuOpen, setIsBulkSelectMenuOpen] = useState(false);
  const bulkSelectMenuRef = useRef<HTMLDivElement | null>(null);
  
  const [isStylePresetMenuOpen, setIsStylePresetMenuOpen] = useState(false);
  const stylePresetMenuRef = useRef<HTMLDivElement | null>(null);

  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
  const modelSettingsRef = useRef<HTMLDivElement | null>(null);
  const [stylePreset, setStylePreset] = useState<'detailed' | 'minimal' | 'presentation'>('detailed');



  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(EXPORT_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((v) => v && typeof v === 'object')
        .slice(0, 25) as ExportHistoryItem[];
    } catch {
      return [];
    }
  });
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(EXPORT_HISTORY_STORAGE_KEY, JSON.stringify(exportHistory.slice(0, 25)));
    } catch {
      // ignore
    }
  }, [exportHistory]);

  const recordExport = useCallback((kind: ExportHistoryKind, fileName: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: ExportHistoryItem = { id, kind, fileName, createdAt: Date.now() };
    setExportHistory((prev) => [item, ...prev].slice(0, 25));
  }, []);

  const formatTimeAgo = useCallback((ts: number) => {
    const diffMs = Date.now() - ts;
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }, []);

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!isExportMenuOpen && !isLayoutMenuOpen && !isBulkSelectMenuOpen && !isStylePresetMenuOpen && !isModelSettingsOpen) return;
      const target = e.target as unknown as globalThis.Node | null;
      if (!target) return;

      if (isExportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }

      if (isLayoutMenuOpen && layoutMenuRef.current && !layoutMenuRef.current.contains(target)) {
        setIsLayoutMenuOpen(false);
      }

      if (isBulkSelectMenuOpen && bulkSelectMenuRef.current && !bulkSelectMenuRef.current.contains(target)) {
        setIsBulkSelectMenuOpen(false);
      }

      if (isStylePresetMenuOpen && stylePresetMenuRef.current && !stylePresetMenuRef.current.contains(target)) {
        setIsStylePresetMenuOpen(false);
      }

      if (isModelSettingsOpen && modelSettingsRef.current && !modelSettingsRef.current.contains(target)) {
        setIsModelSettingsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isExportMenuOpen && !isLayoutMenuOpen && !isBulkSelectMenuOpen && !isStylePresetMenuOpen && !isModelSettingsOpen) return;
      if (e.key === 'Escape') {
        setIsExportMenuOpen(false);
        setIsLayoutMenuOpen(false);
        setIsBulkSelectMenuOpen(false);
        setIsStylePresetMenuOpen(false);
        setIsModelSettingsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen, isLayoutMenuOpen, isBulkSelectMenuOpen, isStylePresetMenuOpen, isModelSettingsOpen]);

  // Keyboard shortcuts: Delete and Ctrl+D (duplicate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete key - remove selected nodes and edges
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();
          
          // Remove selected nodes
          if (selectedNodes.length > 0) {
            const nodeIdsToRemove = selectedNodes.map(n => n.id);
            setNodes(nds => nds.filter(n => !nodeIdsToRemove.includes(n.id)));
            
            // Also remove edges connected to deleted nodes
            setEdges(eds => eds.filter(edge => 
              !nodeIdsToRemove.includes(edge.source) && !nodeIdsToRemove.includes(edge.target)
            ));
          }
          
          // Remove selected edges
          if (selectedEdges.length > 0) {
            const edgeIdsToRemove = selectedEdges.map(e => e.id);
            setEdges(eds => eds.filter(e => !edgeIdsToRemove.includes(e.id)));
          }
        }
      }

      // Ctrl+D or Cmd+D - duplicate selected nodes
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        const selectedNodes = nodes.filter(n => n.selected);
        
        if (selectedNodes.length > 0) {
          e.preventDefault();
          
          const duplicatedNodes = selectedNodes.map(node => {
            const newId = `${Date.now()}-${Math.random()}`;
            return {
              ...node,
              id: newId,
              position: {
                x: node.position.x + 50, // Offset by 50px
                y: node.position.y + 50,
              },
              selected: true, // Select the new nodes
            };
          });
          
          // Deselect original nodes
          setNodes(nds => [
            ...nds.map(n => ({ ...n, selected: false })),
            ...duplicatedNodes
          ]);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, edges, setNodes, setEdges]);

  // Keep edge rendering style in sync even without re-layout.
  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: { ...(e.data ?? {}), pathStyle: layoutEdgeStyle },
      }))
    );
  }, [layoutEdgeStyle, setEdges]);

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

  // Apply dark mode class to body and persist preference
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Apply dark mode class to body and persist preference
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

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

  const handleEdgeLabelOffsetChange = useCallback((edgeId: string, offsetX: number, offsetY: number) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          return {
            ...edge,
            data: { 
              ...edge.data, 
              labelOffsetX: offsetX, 
              labelOffsetY: offsetY,
              onLabelChange: handleEdgeLabelChange,
              onLabelOffsetChange: handleEdgeLabelOffsetChange,
            },
          };
        }
        return edge;
      })
    );
  }, [setEdges, handleEdgeLabelChange]);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: false,
      type: 'editableEdge',
      label: '',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0078d4' },
      labelStyle: { fontSize: 14, fill: '#333', fontWeight: 'bold' },
      labelBgStyle: { fill: 'white', fillOpacity: 0.9, stroke: '#000', strokeWidth: 1.5 },
      data: {
        onLabelChange: handleEdgeLabelChange,
        onLabelOffsetChange: handleEdgeLabelOffsetChange,
        connectionType: 'sync',
        direction: 'forward',
        baseFlowAnimated: true,
        flowAnimated: true,
        flowMode: 'directional',
        pathStyle: layoutEdgeStyle,
        labelOffsetX: 0,
        labelOffsetY: 0,
      },
    }, eds)),
    [setEdges, handleEdgeLabelChange, handleEdgeLabelOffsetChange, layoutEdgeStyle]
  );

  // Bulk select operations
  const selectAllNodesOfType = useCallback((serviceType: string) => {
    setNodes((nds) => 
      nds.map(node => ({
        ...node,
        selected: node.type === 'azureNode' && node.data.label === serviceType
      }))
    );
    setIsBulkSelectMenuOpen(false);
  }, [setNodes]);

  const selectAllNodes = useCallback(() => {
    setNodes((nds) => nds.map(node => ({ ...node, selected: true })));
    setIsBulkSelectMenuOpen(false);
  }, [setNodes]);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map(node => ({ ...node, selected: false })));
    setEdges((eds) => eds.map(edge => ({ ...edge, selected: false })));
    setIsBulkSelectMenuOpen(false);
  }, [setNodes, setEdges]);

  // Get unique service types from current diagram
  const getServiceTypes = useCallback(() => {
    const types = new Set<string>();
    nodes.forEach((node) => {
      if (node.type === 'azureNode' && node.data.label) {
        types.add(node.data.label);
      }
    });
    return Array.from(types).sort();
  }, [nodes]);

  // Style preset functions
  const applyStylePreset = useCallback((preset: 'detailed' | 'minimal' | 'presentation') => {
    setStylePreset(preset);

    // Update nodes with style data
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          stylePreset: preset,
        },
      }))
    );

    // Update edges based on preset (non-destructive: don't wipe labels)
    setEdges((eds) =>
      eds.map((edge) => {
        const nextStyle: any = { ...(edge.style ?? {}) };
        const nextLabelStyle: any = { ...(edge.labelStyle ?? {}) };
        const nextLabelBgStyle: any = { ...(edge.labelBgStyle ?? {}) };

        switch (preset) {
          case 'minimal':
            nextStyle.strokeWidth = 1;
            nextLabelStyle.opacity = 0;
            nextLabelBgStyle.fillOpacity = 0;
            nextLabelBgStyle.strokeWidth = 0;
            break;
          case 'presentation':
            nextStyle.strokeWidth = 2;
            nextLabelStyle.opacity = 1;
            nextLabelBgStyle.fillOpacity = 0.95;
            nextLabelBgStyle.strokeWidth = 1.5;
            break;
          case 'detailed':
          default:
            delete nextStyle.strokeWidth;
            nextLabelStyle.opacity = 1;
            nextLabelBgStyle.fillOpacity = 0.9;
            nextLabelBgStyle.strokeWidth = 1.5;
            break;
        }

        return {
          ...edge,
          style: nextStyle,
          labelStyle: nextLabelStyle,
          labelBgStyle: nextLabelBgStyle,
        };
      })
    );

    setIsStylePresetMenuOpen(false);
  }, [setEdges, setNodes]);

  const applyLayout = useCallback(async () => {
    const selectedAzureNodeId = nodes.find((n) => n.type === 'azureNode' && (n as any).selected)?.id;
    const shouldEmphasize =
      layoutEmphasizePrimaryPath && (layoutPreset === 'flow-lr' || layoutPreset === 'flow-tb');

    const result = await applyLayoutPreset(nodes as any, edges as any, {
      preset: layoutPreset,
      spacing: layoutSpacing,
      edgeStyle: layoutEdgeStyle,
      emphasizePrimaryPath: shouldEmphasize,
      selectedNodeId: selectedAzureNodeId,
      layoutEngine,
    });

    setNodes(result.nodes as any);
    setEdges(result.edges as any);

    requestAnimationFrame(() => {
      reactFlowInstance?.fitView?.({ padding: 0.2, duration: 250 });
    });
  }, [
    nodes,
    edges,
    layoutPreset,
    layoutSpacing,
    layoutEdgeStyle,
    layoutEmphasizePrimaryPath,
    layoutEngine,
    reactFlowInstance,
    setNodes,
    setEdges,
  ]);

  const layoutPresetLabel: Record<LayoutPreset, string> = {
    'flow-lr': 'Flow (L→R)',
    'flow-tb': 'Flow (Top→Bottom)',
    swimlanes: 'Swimlanes by Group',
    radial: 'Radial',
  };

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => {
        // Remove the old edge and add the new connection
        const filtered = eds.filter(e => e.id !== oldEdge.id);
        return addEdge({
          ...newConnection,
          animated: false,
          type: oldEdge.type,
          label: oldEdge.label,
          markerEnd: oldEdge.markerEnd,
          markerStart: (oldEdge as any).markerStart,
          labelStyle: oldEdge.labelStyle,
          labelBgStyle: oldEdge.labelBgStyle,
          data: oldEdge.data,
        }, filtered);
      });
    },
    [setEdges]
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
        let markerEnd: any = undefined;
        let markerStart: any = undefined;
        const baseFlowAnimated = Boolean(edge.data?.baseFlowAnimated ?? edge.data?.flowAnimated ?? true);
        const flowAnimated = baseFlowAnimated;
        const flowMode = direction === 'bidirectional' ? 'pulse' : 'directional';
        
        switch (direction) {
          case 'forward':
            markerEnd = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            break;
          case 'reverse':
            markerStart = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            break;
          case 'bidirectional':
            markerEnd = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            markerStart = { type: MarkerType.ArrowClosed, color: '#0078d4' };
            break;
        }
        
        return {
          ...edge,
          markerEnd,
          markerStart,
          animated: false,
          data: { 
            ...edge.data, 
            direction, 
            baseFlowAnimated, 
            flowAnimated, 
            flowMode,
            onLabelChange: handleEdgeLabelChange,
            onLabelOffsetChange: handleEdgeLabelOffsetChange,
          }
        };
      }
      return edge;
    }));
    closeEdgeContextMenu();
  }, [setEdges, closeEdgeContextMenu]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

// Remove node from its parent group
  // @ts-ignore - Reserved for future use in context menu
  const _ungroupNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === nodeId && node.parentNode) {
        // Find the parent group to get its absolute position
        const parentGroup = nds.find(n => n.id === node.parentNode);
        
        if (parentGroup) {
          // Convert from parent-relative to absolute canvas coordinates
          const absolutePosition = {
            x: parentGroup.position.x + node.position.x,
            y: parentGroup.position.y + node.position.y,
          };
          
          return {
            ...node,
            parentNode: undefined,
            position: absolutePosition,
            // Remove extent constraint when ungrouping
            extent: undefined,
          };
        }
        
        // Fallback: just remove parent if parent not found
        return {
          ...node,
          parentNode: undefined,
          extent: undefined,
        };
      }
      return node;
    }));
  }, []);

  // Handle node deletion - convert child nodes to absolute positions when parent group is deleted
  const onNodesDelete = useCallback((deleted: any[]) => {
    const deletedGroupIds = deleted.filter(n => n.type === 'groupNode').map(n => n.id);
    
    if (deletedGroupIds.length > 0) {
      setNodes((nds) => nds.map((node) => {
        // If this node's parent is being deleted, convert to absolute position
        if (node.parentNode && deletedGroupIds.includes(node.parentNode)) {
          const parentGroup = deleted.find(n => n.id === node.parentNode);
          
          if (parentGroup) {
            // Convert from parent-relative to absolute canvas coordinates
            const absolutePosition = {
              x: parentGroup.position.x + node.position.x,
              y: parentGroup.position.y + node.position.y,
            };
            
            return {
              ...node,
              parentNode: undefined,
              position: absolutePosition,
              extent: undefined,
            };
          }

          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
          };
        }
        return node;
      }));
    }
  }, [setNodes]);

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
        if (node.type === 'groupNode') {
          // Check if position is within group bounds
          const groupX = node.position.x;
          const groupY = node.position.y;
          // Get dimensions from style first, then measured width/height, then defaults
          const groupWidth = (node.style?.width as number) || node.width || 400;
          const groupHeight = (node.style?.height as number) || node.height || 300;
          
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
            const fileName = generateModelFilename('azure-diagram', 'png');
            link.download = fileName;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            recordExport('png', fileName);
          }
        });
      } catch (err) {
        console.error('Error exporting diagram:', err);
        alert('Failed to export diagram. Please try again.');
      }
    }, 800);
  }, [reactFlowInstance, recordExport]);

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
        const fileName = generateModelFilename('azure-diagram', 'svg');
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        recordExport('svg', fileName);
      } catch (err) {
        console.error('Error exporting SVG:', err);
        alert('Failed to export SVG. Please try again.');
      }
    }, 800);
  }, [reactFlowInstance, recordExport]);

  const exportAsDrawio = useCallback(async () => {
    try {
      const diagramName = titleBlockData.architectureName || 'Azure Architecture';
      const fileName = await exportAndDownloadDrawio(nodes, edges, diagramName);
      recordExport('drawio', fileName);
    } catch (err) {
      console.error('Error exporting Draw.io:', err);
      alert('Failed to export Draw.io file. Please try again.');
    }
  }, [nodes, edges, titleBlockData.architectureName, recordExport]);

  const saveDiagram = useCallback(() => {
    const flow = reactFlowInstance?.toObject();
    const diagramData = {
      ...flow,
      metadata: {
        ...titleBlockData,
        savedAt: new Date().toISOString(),
      },
      workflow: workflow.length > 0 ? workflow : undefined,
      architecturePrompt: architecturePrompt || undefined,
    };
    const dataStr = JSON.stringify(diagramData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    const fileName = generateModelFilename('azure-diagram', 'json');
    link.setAttribute('download', fileName);
    link.click();
    recordExport('json', fileName);
  }, [reactFlowInstance, recordExport, titleBlockData, workflow, architecturePrompt]);

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
    const fileName = generateModelFilename('azure-cost-breakdown', 'csv');
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    recordExport('costs', fileName);
  }, [nodes, recordExport]);

  const applyFlowObject = useCallback(
    (flow: any) => {
      if (!flow || typeof flow !== 'object') {
        throw new Error('Invalid diagram payload');
      }

      if (flow.nodes) setNodes(flow.nodes || []);
      if (flow.edges) setEdges(flow.edges || []);

      if (flow.viewport && reactFlowInstance?.setViewport) {
        reactFlowInstance.setViewport(flow.viewport);
      }

      // Restore metadata if present
      if (flow.metadata && typeof flow.metadata === 'object') {
        setTitleBlockData({
          architectureName: flow.metadata.architectureName || 'Untitled Architecture',
          author: flow.metadata.author || 'Azure Architect',
          version: flow.metadata.version || '1.0',
          date: flow.metadata.date || new Date().toLocaleDateString(),
        });
      }

      // Restore workflow if present
      if (flow.workflow && Array.isArray(flow.workflow)) {
        setWorkflow(flow.workflow);
      } else {
        setWorkflow([]);
      }

      // Restore architecture prompt if present
      if (flow.architecturePrompt) {
        setArchitecturePrompt(flow.architecturePrompt);
      }
    },
    [setNodes, setEdges, reactFlowInstance]
  );



  // Load version from URL hash (for "Open in New Tab" feature)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#version-')) {
      try {
        const encodedData = hash.substring(9); // Remove '#version-'
        const decodedData = atob(encodedData);
        const diagramData = JSON.parse(decodedData);
        
        // Apply the diagram data
        applyFlowObject(diagramData);
        
        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (error) {
        console.error('Failed to load version from URL:', error);
      }
    }
  }, [applyFlowObject]);



  const loadDiagram = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flow = JSON.parse(e.target?.result as string);
        applyFlowObject(flow);
      } catch (error) {
        console.error('Error loading diagram:', error);
        alert('Error loading diagram file');
      }
    };
    reader.readAsText(file);
  }, [applyFlowObject]);

  // Restore a version from history
  const restoreVersion = useCallback((version: DiagramVersion) => {
    try {
      setNodes(version.nodes);
      setEdges(version.edges);
      
      if (version.titleBlockData) {
        setTitleBlockData(version.titleBlockData);
      }
      
      if (version.workflow) {
        setWorkflow(version.workflow);
      }
      
      if (version.architecturePrompt) {
        setArchitecturePrompt(version.architecturePrompt);
      }
      
      console.log('✅ Version restored successfully');
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert('Failed to restore version');
    }
  }, []);

  // Manual snapshot save handler
  const handleSaveSnapshot = useCallback(async (notes: string) => {
    try {
      await createSnapshot(
        nodes,
        edges,
        titleBlockData.architectureName,
        {
          architecturePrompt,
          validationScore: validationResult?.overallScore,
          notes: notes || 'Manual snapshot',
          metadata: titleBlockData,
          workflow,
        }
      );
      console.log('✅ Manual snapshot saved successfully');
    } catch (error) {
      console.error('Failed to save manual snapshot:', error);
      throw error;
    }
  }, [nodes, edges, titleBlockData, architecturePrompt, validationResult, workflow]);

  const handleAIGenerate = useCallback(async (architecture: any, prompt: string, autoSnapshot: boolean = true) => {
    try {
      console.log('Generating architecture from:', architecture);
      const { services, connections, groups, workflow: workflowSteps } = architecture;
      
      if (!services || services.length === 0) {
        alert('No services were identified in your description. Please try a more detailed description.');
        return;
      }

      console.log(`Processing ${services.length} services, ${connections?.length || 0} connections, ${groups?.length || 0} groups`);

      // Auto-save snapshot before regenerating (if enabled and there are existing nodes)
      if (autoSnapshot && nodes.length > 0) {
        console.log('📸 Auto-saving snapshot before regeneration...');
        console.log(`Current state: ${nodes.length} nodes, ${edges.length} edges, name: "${titleBlockData.architectureName}"`);
        try {
          await createSnapshot(
            nodes,
            edges,
            titleBlockData.architectureName,
            {
              architecturePrompt: architecturePrompt || 'Previous version',
              validationScore: validationResult?.overallScore,
              notes: 'Auto-saved before AI regeneration',
              metadata: titleBlockData,
              workflow,
            }
          );
          console.log('✅ Snapshot saved successfully!');
        } catch (err) {
          console.error('❌ Failed to save snapshot:', err);
        }
      } else {
        console.log('ℹ️ No existing nodes to snapshot');
      }

      // Clear existing diagram when generating new architecture
      setNodes([]);
      setEdges([]);
      setArchitecturePrompt('');
      setWorkflow([]);
      setGeneratedWithModel(null);
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
      // Check SERVICE_ICON_MAP first for authoritative category
      const mapping = getServiceIconMapping(serviceType);
      if (mapping) return mapping.category;
      
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
        // Try service.name first (preferred), then service.type
        let mapping = getServiceIconMapping(service.name);
        if (!mapping) {
          mapping = getServiceIconMapping(service.type);
        }
        if (mapping) {
          console.log(`  🎯 Found mapping for "${service.name}" (type: ${service.type}): ${mapping.iconFile}`);
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
    // LAYOUT ENGINE: Calculate optimal positions using selected algorithm
    // ============================================================================
    const engineLabel = layoutEngine === 'elk' ? 'ELK' : 'Dagre';
    console.log(`📐 Calculating layout with ${engineLabel} algorithm...`);
    console.log('📦 Groups before layout:', groups);

    let positionedServices: any[];
    let positionedGroups: any[];

    if (layoutEngine === 'elk') {
      const result = await elkLayoutArchitecture(
        services,
        connections,
        groups || [],
        { direction: 'LR' }
      );
      positionedServices = result.services;
      positionedGroups = result.groups;
    } else {
      const result = layoutArchitecture(
        services,
        connections,
        groups || [],
        { direction: 'LR' }
      );
      positionedServices = result.services;
      positionedGroups = result.groups;
    }
    console.log('📦 Positioned groups after layout:', positionedGroups);

    // Create group nodes with calculated positions and sizes
    if (positionedGroups && positionedGroups.length > 0) {
      positionedGroups.forEach((group: any) => {
        const groupNode: Node = {
          id: group.id,
          type: 'groupNode',
          position: group.position,
          data: {
            label: group.label || group.id || 'Unnamed Group',
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

    // Build absolute position map for smart edge routing
    // Services inside groups have relative positions, so we add the group's position
    const absolutePositions = new Map<string, { x: number; y: number }>();
    const groupPositionMap = new Map<string, { x: number; y: number }>();
    positionedGroups.forEach((g: any) => groupPositionMap.set(g.id, g.position));

    positionedServices.forEach((service: any) => {
      if (service.groupId && groupPositionMap.has(service.groupId)) {
        const gp = groupPositionMap.get(service.groupId)!;
        absolutePositions.set(service.id, {
          x: gp.x + service.position.x,
          y: gp.y + service.position.y,
        });
      } else {
        absolutePositions.set(service.id, service.position);
      }
    });

    // Smart handle selection based on relative node positions
    // Picks handles that create the shortest, least-crossing edge paths
    const getConnectionPositions = (sourceId: string, targetId: string, _conn: any) => {
      const srcPos = absolutePositions.get(sourceId);
      const tgtPos = absolutePositions.get(targetId);

      if (!srcPos || !tgtPos) {
        return { sourceHandle: 'right', targetHandle: 'left' };
      }

      const dx = tgtPos.x - srcPos.x;
      const dy = tgtPos.y - srcPos.y;

      // Use the dominant axis to pick handles
      if (Math.abs(dx) >= Math.abs(dy)) {
        // Primarily horizontal
        if (dx >= 0) {
          // Target is to the right → standard L-R flow
          return { sourceHandle: 'right', targetHandle: 'left' };
        } else {
          // Target is to the left → reverse direction
          return { sourceHandle: 'left-source', targetHandle: 'right-target' };
        }
      } else {
        // Primarily vertical
        if (dy >= 0) {
          // Target is below
          return { sourceHandle: 'bottom', targetHandle: 'top' };
        } else {
          // Target is above
          return { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
        }
      }
    };

    // Function to determine arrow direction based on edge label
    const determineEdgeDirection = (label: string): { direction: 'forward' | 'reverse' | 'bidirectional', markerEnd?: any, markerStart?: any, flowMode: 'directional' | 'pulse' } => {
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
          markerStart: { type: MarkerType.ArrowClosed, color: '#0078d4' },
          flowMode: 'pulse',
        };
      }
      
      // Check for reverse
      if (reverseKeywords.some(keyword => lowerLabel.includes(keyword))) {
        return {
          direction: 'reverse',
          markerStart: { type: MarkerType.ArrowClosed, color: '#0078d4' },
          markerEnd: undefined,
          flowMode: 'directional',
        };
      }
      
      // Default to forward
      return {
        direction: 'forward',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0078d4' },
        markerStart: undefined,
        flowMode: 'directional',
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
      let baseFlowAnimated = true;
      
      switch (connectionType) {
        case 'async':
          // Dashed line for asynchronous
          edgeStyle = { strokeDasharray: '5, 5' };
          baseFlowAnimated = true;
          break;
        case 'optional':
          // Dotted line for optional
          edgeStyle = { strokeDasharray: '2, 4', opacity: 0.6 };
          baseFlowAnimated = false;
          break;
        case 'sync':
        default:
          // Solid line for synchronous (default)
          edgeStyle = {};
          baseFlowAnimated = true;
          break;
      }

      const flowAnimated = baseFlowAnimated;
      
      return {
        id: `edge-${index}`,
        source: conn.from,
        target: conn.to,
        sourceHandle: positions.sourceHandle,
        targetHandle: positions.targetHandle,
        animated: false,
        type: 'editableEdge',
        label: conn.label || '',
        markerEnd: edgeDirection.markerEnd,
        markerStart: edgeDirection.markerStart,
        labelStyle: { fontSize: 14, fill: '#333', fontWeight: 'bold' },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9, stroke: '#000', strokeWidth: 1.5 },
        style: edgeStyle,
        data: {
          connectionType,
          direction: edgeDirection.direction,
          baseFlowAnimated,
          flowAnimated,
          flowMode: edgeDirection.flowMode,
          onLabelChange: handleEdgeLabelChange,
          onLabelOffsetChange: handleEdgeLabelOffsetChange,
          labelOffsetX: 0,
          labelOffsetY: 0,
        },
      };
    });

    // Add the new nodes and edges
    console.log(`Setting ${newNodes.length} nodes and ${newEdges.length} edges`);
    setNodes(newNodes);
    setEdges(newEdges);

    // Set the model badge from metrics
    if (architecture.metrics) {
      const modelKey = Object.keys(MODEL_CONFIG).find(
        k => MODEL_CONFIG[k as keyof typeof MODEL_CONFIG].deploymentEnvVar &&
             import.meta.env[MODEL_CONFIG[k as keyof typeof MODEL_CONFIG].deploymentEnvVar] === architecture.metrics.model
      );
      const displayName = modelKey
        ? MODEL_CONFIG[modelKey as keyof typeof MODEL_CONFIG].displayName
        : architecture.metrics.model || 'AI';
      setGeneratedWithModel({ name: displayName, timeMs: architecture.metrics.elapsedTimeMs });
    }

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

    // Collapse all panels to maximize diagram view
    setPanelsCollapsedSignal(prev => prev + 1);

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
  }, [setNodes, setEdges, reactFlowInstance, nodes, edges, titleBlockData, architecturePrompt, validationResult, workflow]);

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

    // Capture diagram snapshot BEFORE opening the modal overlay
    let diagramImageDataUrl: string | undefined;
    if (reactFlowWrapper.current && reactFlowInstance) {
      try {
        reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
        // Brief delay for fitView to settle before capture
        await new Promise(resolve => setTimeout(resolve, 400));
        const isDark = document.body.classList.contains('dark-mode');
        const canvas = await html2canvas(reactFlowWrapper.current, {
          backgroundColor: isDark ? '#1a1a2e' : '#f8fafc',
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          foreignObjectRendering: false,
          ignoreElements: (element) => {
            return (
              element.classList?.contains('react-flow__minimap') ||
              element.classList?.contains('react-flow__controls') ||
              element.classList?.contains('react-flow__attribution')
            );
          },
        });
        diagramImageDataUrl = canvas.toDataURL('image/png');
        console.log('\uD83D\uDCF8 Diagram snapshot captured for validation report');
      } catch (err) {
        console.warn('Could not capture diagram snapshot:', err);
      }
    }

    // Now show the modal and start validation
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

      // Attach diagram snapshot to results
      if (diagramImageDataUrl) {
        result.diagramImageDataUrl = diagramImageDataUrl;
      }
      setValidationResult(result);
      // Collapse panels to maximize diagram view
      setPanelsCollapsedSignal(prev => prev + 1);
    } catch (error: any) {
      console.error('Validation error:', error);
      alert(`Failed to validate architecture: ${error.message}`);
      setIsValidationModalOpen(false);
    } finally {
      setIsValidating(false);
    }
  }, [nodes, edges, architecturePrompt, titleBlockData.architectureName, reactFlowInstance]);

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
          <div className="header-brand">
            <img src={microsoftLogoWhite} alt="Microsoft" className="microsoft-logo" />
            <h1>Azure Architecture Diagram Builder</h1>
          </div>
          <div className="header-actions-wrapper">
            {/* Row 1: Project-level actions */}
            <div className="header-actions">
              <div className="toolbar-group">
                <RegionSelector onRegionChange={handleRegionChange} />
                {totalMonthlyCost > 0 && (
                  <div className="cost-indicator" title="Total estimated monthly cost for all services">
                    💰 {formatMonthlyCost(totalMonthlyCost)}
                  </div>
                )}
              </div>

              <div className="toolbar-group">
                <button onClick={addGroupBox} className="btn btn-secondary" title="Add grouping box">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 4" />
                  </svg>
                  Add Group
                </button>
                <AIArchitectureGenerator 
                  onGenerate={handleAIGenerate}
                  currentArchitecture={{
                    nodes,
                    edges,
                    architectureName: titleBlockData.architectureName
                  }}
                />
                <button
                  className="btn btn-compare-models"
                  onClick={() => setIsCompareModelsOpen(true)}
                  title="Compare architecture output across multiple AI models"
                >
                  <GitCompare size={18} />
                  Compare Models
                </button>
                <label className={`btn btn-secondary${isUploadingARM ? ' btn-parsing' : ''}`} title="Upload ARM template to generate diagram">
                  {isUploadingARM ? <Loader size={18} className="spin-icon" /> : <Upload size={18} />}
                  {isUploadingARM ? 'Parsing...' : 'Import ARM'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={uploadARMTemplate}
                    style={{ display: 'none' }}
                    disabled={isUploadingARM}
                  />
                </label>
              </div>

              <div className="toolbar-group">
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

              <div className="toolbar-group">
                <div className="toolbar-dropdown" ref={exportMenuRef}>
                  <button
                    onClick={() => setIsExportMenuOpen((v) => !v)}
                    className="btn btn-primary"
                    title="Export"
                    aria-haspopup="menu"
                    aria-expanded={isExportMenuOpen}
                  >
                    <Download size={18} />
                    Export
                    <ChevronDown size={16} style={{ marginLeft: 2 }} />
                  </button>

                  {isExportMenuOpen && (
                    <div className="toolbar-dropdown-menu" role="menu" aria-label="Export options">
                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          exportDiagram();
                        }}
                        title="Export as PNG"
                      >
                        <Download size={18} />
                        Export PNG
                      </button>
                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          exportAsSvg();
                        }}
                        title="Export as SVG (vector format)"
                      >
                        <Download size={18} />
                        Export SVG
                      </button>
                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          exportAsDrawio();
                        }}
                        title="Export for Draw.io / diagrams.net (editable format)"
                      >
                        <Download size={18} />
                        Export Draw.io
                      </button>
                      <div className="toolbar-dropdown-separator" role="separator" />
                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        disabled={totalMonthlyCost === 0}
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          exportCostBreakdown();
                        }}
                        title={totalMonthlyCost === 0 ? 'Add services to estimate costs first' : 'Export cost breakdown'}
                      >
                        <DollarSign size={18} />
                        Export Costs
                      </button>

                      <div className="toolbar-dropdown-separator" role="separator" />

                      <div className="toolbar-dropdown-heading">Recent exports</div>
                      {exportHistory.length === 0 ? (
                        <div className="toolbar-dropdown-hint toolbar-dropdown-hint--muted">No exports yet</div>
                      ) : (
                        <div className="toolbar-dropdown-history">
                          {exportHistory.slice(0, 6).map((item) => (
                            <div key={item.id} className="toolbar-dropdown-history-item">
                              <div className="toolbar-dropdown-history-file">{item.fileName}</div>
                              <div className="toolbar-dropdown-history-meta">
                                {item.kind.toUpperCase()} • {formatTimeAgo(item.createdAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="toolbar-group">
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)} 
                  className="btn btn-secondary" 
                  title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  style={{ fontSize: '20px', padding: '0.5rem 1rem' }}
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Start a fresh session? This will clear the current diagram and all unsaved changes.')) {
                      setNodes([]);
                      setEdges([]);
                      setArchitecturePrompt('');
                      setWorkflow([]);
                      setGeneratedWithModel(null);
                      setValidationResult(null);
                      setDeploymentGuide(null);
                      setTitleBlockData({ architectureName: 'Untitled Architecture', author: 'Azure Architect', date: new Date().toISOString().split('T')[0], version: '1.0' });
                    }
                  }}
                  className="btn btn-secondary"
                  title="Clear diagram and start fresh"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {/* Row 2: Canvas tools & AI settings */}
            <div className="header-actions">
              <div className="toolbar-group">
                <button 
                  onClick={() => setIsVersionHistoryModalOpen(true)} 
                  className="btn btn-secondary" 
                  title="View version history"
                >
                  <Clock size={18} />
                  History
                </button>
                <button 
                  onClick={() => setIsSaveSnapshotModalOpen(true)} 
                  className="btn btn-secondary" 
                  title="Save current diagram as snapshot"
                  disabled={nodes.length === 0}
                >
                  <Camera size={18} />
                  Snapshot
                </button>
              </div>

              <div className="toolbar-group">
                <div className="toolbar-dropdown" ref={layoutMenuRef}>
                  <button
                    onClick={() => setIsLayoutMenuOpen((v) => !v)}
                    className="btn btn-secondary"
                    title="Layout presets"
                    aria-haspopup="menu"
                    aria-expanded={isLayoutMenuOpen}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h7v7H4z" />
                      <path d="M13 4h7v7h-7z" />
                      <path d="M4 13h7v7H4z" />
                      <path d="M13 13h7v7h-7z" />
                    </svg>
                    Layout
                    <ChevronDown size={16} style={{ marginLeft: 2 }} />
                  </button>

                  {isLayoutMenuOpen && (
                    <div className="toolbar-dropdown-menu toolbar-dropdown-menu--layout" role="menu" aria-label="Layout options">
                      <div className="toolbar-dropdown-heading">Preset</div>
                      <select
                        className="toolbar-dropdown-select"
                        value={layoutPreset}
                        onChange={(e) => setLayoutPreset(e.target.value as LayoutPreset)}
                        aria-label="Layout preset"
                      >
                        <option value="flow-lr">Flow (L→R)</option>
                        <option value="flow-tb">Flow (Top→Bottom)</option>
                        <option value="swimlanes">Swimlanes by Group</option>
                        <option value="radial">Radial</option>
                      </select>

                      <div className="toolbar-dropdown-separator" role="separator" />

                      <div className="toolbar-dropdown-row">
                        <label className="toolbar-dropdown-label" htmlFor="layoutEngine">
                          Engine
                        </label>
                        <select
                          id="layoutEngine"
                          className="toolbar-dropdown-select"
                          value={layoutEngine}
                          onChange={(e) => setLayoutEngine(e.target.value as LayoutEngineType)}
                        >
                          <option value="dagre">Dagre</option>
                          <option value="elk">ELK</option>
                        </select>
                      </div>

                      <div className="toolbar-dropdown-separator" role="separator" />

                      <div className="toolbar-dropdown-row">
                        <label className="toolbar-dropdown-label" htmlFor="layoutSpacing">
                          Spacing
                        </label>
                        <select
                          id="layoutSpacing"
                          className="toolbar-dropdown-select"
                          value={layoutSpacing}
                          onChange={(e) => setLayoutSpacing(e.target.value as LayoutSpacing)}
                        >
                          <option value="compact">Compact</option>
                          <option value="comfortable">Comfortable</option>
                        </select>
                      </div>

                      <div className="toolbar-dropdown-row">
                        <label className="toolbar-dropdown-label" htmlFor="edgeStyle">
                          Edge style
                        </label>
                        <select
                          id="edgeStyle"
                          className="toolbar-dropdown-select"
                          value={layoutEdgeStyle}
                          onChange={(e) => setLayoutEdgeStyle(e.target.value as LayoutEdgeStyle)}
                        >
                          <option value="straight">Straight</option>
                          <option value="smooth">Smooth</option>
                          <option value="orthogonal">Orthogonal</option>
                        </select>
                      </div>

                      <label className="toolbar-dropdown-checkbox">
                        <input
                          type="checkbox"
                          checked={layoutEmphasizePrimaryPath}
                          onChange={(e) => setLayoutEmphasizePrimaryPath(e.target.checked)}
                          disabled={!(layoutPreset === 'flow-lr' || layoutPreset === 'flow-tb')}
                        />
                        Emphasize primary path
                      </label>

                      <div className="toolbar-dropdown-hint">
                        Current: {layoutPresetLabel[layoutPreset]} • Engine: {layoutEngine === 'elk' ? 'ELK' : 'Dagre'}
                        {layoutPreset === 'radial' ? ' (centers on selected node when possible)' : ''}
                      </div>

                      <div className="toolbar-dropdown-separator" role="separator" />

                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        disabled={nodes.length === 0}
                        onClick={() => {
                          setIsLayoutMenuOpen(false);
                          applyLayout();
                        }}
                        title={nodes.length === 0 ? 'Add services first' : 'Apply selected layout preset'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 1 1-9-9" />
                          <path d="M21 3v9h-9" />
                        </svg>
                        Apply Layout
                      </button>
                    </div>
                  )}
                </div>

                <div className="toolbar-dropdown" ref={bulkSelectMenuRef}>
                  <button
                    onClick={() => setIsBulkSelectMenuOpen((v) => !v)}
                    className="btn btn-secondary"
                    title="Bulk select operations"
                    aria-haspopup="menu"
                    aria-expanded={isBulkSelectMenuOpen}
                    disabled={nodes.length === 0}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Select
                    <ChevronDown size={16} style={{ marginLeft: 2 }} />
                  </button>

                  {isBulkSelectMenuOpen && (
                    <div className="toolbar-dropdown-menu" role="menu" aria-label="Bulk select options">
                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        onClick={selectAllNodes}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                        Select All Nodes
                      </button>
                      <button
                        className="toolbar-dropdown-item"
                        role="menuitem"
                        onClick={deselectAll}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                        </svg>
                        Deselect All
                      </button>
                      
                      {getServiceTypes().length > 0 && (
                        <>
                          <div className="toolbar-dropdown-separator" role="separator" />
                          <div className="toolbar-dropdown-heading">Select by Service Type</div>
                          {getServiceTypes().map(serviceType => (
                            <button
                              key={serviceType}
                              className="toolbar-dropdown-item"
                              role="menuitem"
                              onClick={() => selectAllNodesOfType(serviceType)}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                              </svg>
                              {serviceType}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="toolbar-dropdown" ref={stylePresetMenuRef}>
                  <button
                    onClick={() => setIsStylePresetMenuOpen((v) => !v)}
                    className="btn btn-secondary"
                    title="Change diagram style"
                    aria-haspopup="menu"
                    aria-expanded={isStylePresetMenuOpen}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                    </svg>
                    Style
                    <ChevronDown size={16} style={{ marginLeft: 2 }} />
                  </button>

                  {isStylePresetMenuOpen && (
                    <div className="toolbar-dropdown-menu" role="menu" aria-label="Style preset options">
                      <div className="toolbar-dropdown-heading">Visual Style</div>
                      <button
                        className={`toolbar-dropdown-item ${stylePreset === 'detailed' ? 'active' : ''}`}
                        role="menuitem"
                        onClick={() => applyStylePreset('detailed')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M3 15h18M9 3v18" />
                        </svg>
                        Detailed (Default)
                      </button>
                      <button
                        className={`toolbar-dropdown-item ${stylePreset === 'minimal' ? 'active' : ''}`}
                        role="menuitem"
                        onClick={() => applyStylePreset('minimal')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                        Minimal (Clean)
                      </button>
                      <button
                        className={`toolbar-dropdown-item ${stylePreset === 'presentation' ? 'active' : ''}`}
                        role="menuitem"
                        onClick={() => applyStylePreset('presentation')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <path d="M8 21h8M12 17v4" />
                        </svg>
                        Presentation (Professional)
                      </button>
                      <div className="toolbar-dropdown-separator" role="separator" />
                      <div className="toolbar-dropdown-hint">
                        {stylePreset === 'detailed' && 'Shows all labels, pricing, and details'}
                        {stylePreset === 'minimal' && 'Hides labels and pricing for cleaner view'}
                        {stylePreset === 'presentation' && 'Professional look with bold connections'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="toolbar-group">
                <ModelSettingsPopover
                  ref={modelSettingsRef}
                  isOpen={isModelSettingsOpen}
                  onToggle={() => setIsModelSettingsOpen(v => !v)}
                />
                <button 
                  onClick={handleValidateArchitecture} 
                  className="btn btn-premium" 
                  title="Validate architecture against Azure Well-Architected Framework"
                  disabled={nodes.length === 0}
                >
                  <Shield size={18} />
                  Validate Architecture
                </button>
                {validationResult && (
                  <button
                    onClick={() => setIsValidationModalOpen(true)}
                    className="btn btn-secondary"
                    title="Open last validation results"
                  >
                    <Shield size={18} />
                    Validation {validationResult.overallScore}/100
                  </button>
                )}
                <button 
                  onClick={handleGenerateDeploymentGuide} 
                  className="btn btn-premium" 
                  title="Generate comprehensive deployment guide"
                  disabled={nodes.length === 0}
                >
                  <FileText size={18} />
                  Deployment Guide
                </button>
                {deploymentGuide && (
                  <button
                    onClick={() => setIsDeploymentGuideModalOpen(true)}
                    className="btn btn-secondary"
                    title="Open last deployment guide"
                  >
                    <FileText size={18} />
                    View Guide
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <div className="workspace">
        <IconPalette forceCollapsed={panelsCollapsedSignal > 0 ? panelsCollapsedSignal : undefined} />
        
        <div className="canvas-container" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={onNodesDelete}
            onConnect={onConnect}
            onReconnect={onReconnect}
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
            elevateNodesOnSelect={false}
            reconnectRadius={20}
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
                  filter: drop-shadow(0 0 12px rgba(96, 165, 250, 1)) drop-shadow(0 0 24px rgba(96, 165, 250, 0.9)) drop-shadow(0 0 36px rgba(96, 165, 250, 0.6)) !important;
                  z-index: 1000 !important;
                  animation: pulse-glow 1.5s ease-in-out infinite;
                }
                @keyframes pulse-glow {
                  0%, 100% { filter: drop-shadow(0 0 12px rgba(96, 165, 250, 1)) drop-shadow(0 0 24px rgba(96, 165, 250, 0.9)) drop-shadow(0 0 36px rgba(96, 165, 250, 0.6)); }
                  50% { filter: drop-shadow(0 0 18px rgba(96, 165, 250, 1)) drop-shadow(0 0 32px rgba(96, 165, 250, 1)) drop-shadow(0 0 48px rgba(96, 165, 250, 0.8)); }
                }
                
                body:not(.dark-mode) .react-flow__node[data-id="${id}"] {
                  filter: drop-shadow(0 0 8px rgba(0, 120, 212, 1)) drop-shadow(0 0 16px rgba(0, 120, 212, 0.8)) !important;
                }
                body:not(.dark-mode) @keyframes pulse-glow {
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
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
                  border: '2px solid #60a5fa',
                  padding: '1rem 2.5rem',
                  borderRadius: '12px',
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 60px rgba(59, 130, 246, 0.2)',
                  maxWidth: '700px',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              >
                <div className="prompt-text" style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '0.3px' }}>
                  <strong style={{ fontSize: '1.2rem' }}>⏳ Applying recommendations...</strong> Regenerating architecture with improvements
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

            <TitleBlock
              architectureName={titleBlockData.architectureName}
              author={titleBlockData.author}
              version={titleBlockData.version}
              date={titleBlockData.date}
              onUpdate={(data) => setTitleBlockData({ ...titleBlockData, ...data })}
            />
            {generatedWithModel && (
              <ModelBadge
                modelName={generatedWithModel.name}
                elapsedTimeMs={generatedWithModel.timeMs}
              />
            )}
            <Legend forceCollapsed={panelsCollapsedSignal > 0 ? panelsCollapsedSignal : undefined} />
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
            forceCollapsed={panelsCollapsedSignal > 0 ? panelsCollapsedSignal : undefined}
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
        onRevalidate={handleValidateArchitecture}
        onApplyRecommendations={async (selectedFindings) => {
          console.log('📝 User selected recommendations to apply:', selectedFindings);
          
          // Close validation modal and show loading state
          setIsValidationModalOpen(false);
          setIsApplyingRecommendations(true);
          
          // Get current architecture state
          const currentServices = nodes
            .filter(n => n.type === 'azureNode')
            .map(n => ({
              id: n.id,
              name: n.data.label,
              type: n.data.serviceName || n.data.service || n.data.label,
              category: n.data.category || 'General',
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

SERVICE MAPPING — CRITICAL:
- When adding private endpoints or Private Link, add "Azure Private Link" as an explicit service node AND "Azure DNS" for private DNS resolution. Connect source services → Azure Private Link → target PaaS services.
- When adding WAF capabilities, add "Web Application Firewall" as a service node if not already covered by Application Gateway or Azure Front Door.
- When adding SIEM/security monitoring, add "Microsoft Sentinel" as a service node.
- Always use exact service names from the known services list in the system prompt.

LAYOUT RULES:
7. Limit total connections to 12-18. Only show primary data/control flow, not obvious implicit relationships. Show only 1 representative Key Vault edge, not one per service.
8. For monitoring: connect ONLY the primary compute service to Azure Monitor, then a SINGLE edge to Log Analytics. Maximum 2-3 monitoring edges total.
9. Arrange groups in directional flow: Ingress → Application → Data (left-to-right). Security at bottom-left, Monitoring at bottom-right.
10. Minimize cross-group edges. Place tightly-coupled services in the SAME group. Aim for 1-2 outgoing edges per group.
11. Total service count: 8-12 max. Only add security/identity services when the recommendations explicitly require them.

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
      <VersionHistoryModal
        isOpen={isVersionHistoryModalOpen}
        onClose={() => setIsVersionHistoryModalOpen(false)}
        onRestoreVersion={restoreVersion}
        currentDiagramName={titleBlockData.architectureName}
      />
      <SaveSnapshotModal
        isOpen={isSaveSnapshotModalOpen}
        onClose={() => setIsSaveSnapshotModalOpen(false)}
        onSave={handleSaveSnapshot}
        diagramName={titleBlockData.architectureName}
        serviceCount={nodes.filter(n => n.type === 'azureNode').length}
      />
      <CompareModelsModal
        isOpen={isCompareModelsOpen}
        onClose={() => setIsCompareModelsOpen(false)}
        onApply={(architecture, prompt) => handleAIGenerate(architecture, prompt, true)}
      />
    </div>
  );
}

export default App;

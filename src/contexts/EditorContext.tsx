/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { EditorContextValue, EditorMode, EditorState, EditorTheme, InlineTextSelectionState, InteractionMode, SidebarPanelId } from '@sabi-canvas/types/editor';

// Default to Instagram Post size (1080x1080)
const defaultState: EditorState = {
  theme: { mode: 'dark' },
  isDrawerOpen: false,
  isPropertyPanelOpen: false,
  isEffectsPanelOpen: false,
  activeTool: 'select',
  activeNavItem: 'home',
  zoom: 100,
  interactionMode: 'select',
  activeSidebarPanel: null,
  activeToolPanel: null,
  canvasSize: { width: 1080, height: 1080 },
  editingTextId: null,
  editingShapeTextId: null,
  editingTableCell: null,
  selectedTableCells: [],
  isCropMode: false,
  lastGraphicsSearch: '',
  lastIconsSearch: '',
  lastPhotosSearch: '',
  lastBackgroundPhotosSearch: '',
  lastElementsCategory: 'Shapes',
  inlineTextSelectionState: null,
  drawTool: 'pen',
  drawColor: '#2563EB',
  drawSize: 4,
  drawTension: 0.5,
  replacingImageId: null,
  editorMode: 'mockup-design',
  isMockupEnabled: false,
};

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

export interface EditorProviderProps {
  children: React.ReactNode;
  initialState?: Partial<EditorState>;
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ 
  children, 
  initialState = {} 
}) => {
  const [state, setState] = useState<EditorState>({
    ...defaultState,
    ...initialState,
  });

  const setTheme = useCallback((theme: EditorTheme) => {
    setState(prev => ({ ...prev, theme }));
    document.documentElement.classList.toggle('dark', theme.mode === 'dark');
  }, []);

  const toggleDrawer = useCallback(() => {
    setState(prev => ({ ...prev, isDrawerOpen: !prev.isDrawerOpen }));
  }, []);

  const togglePropertyPanel = useCallback(() => {
    setState(prev => ({ ...prev, isPropertyPanelOpen: !prev.isPropertyPanelOpen }));
  }, []);

  const toggleEffectsPanel = useCallback(() => {
    setState(prev => ({ ...prev, isEffectsPanelOpen: !prev.isEffectsPanelOpen }));
  }, []);

  const setActiveTool = useCallback((toolId: string | null) => {
    setState(prev => {
      // Sync interaction mode with select/hand/draw tool
      let interactionMode = prev.interactionMode;
      let activeToolPanel = prev.activeToolPanel;
      if (toolId === 'select') { interactionMode = 'select'; if (activeToolPanel === 'draw') activeToolPanel = null; }
      else if (toolId === 'hand') { interactionMode = 'pan'; if (activeToolPanel === 'draw') activeToolPanel = null; }
      else if (toolId === 'draw') { interactionMode = 'draw'; }

      return { ...prev, activeTool: toolId, interactionMode, activeToolPanel };
    });
  }, []);

  const setActiveNavItem = useCallback((navId: string) => {
    setState(prev => ({ ...prev, activeNavItem: navId }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState(prev => ({ ...prev, zoom: Math.max(10, Math.min(400, zoom)) }));
  }, []);

  const setInteractionMode = useCallback((mode: InteractionMode) => {
    setState(prev => {
      // Sync active tool with interaction mode
      let activeTool = prev.activeTool;
      let activeToolPanel = prev.activeToolPanel;
      if (mode === 'select') { activeTool = 'select'; if (activeToolPanel === 'draw') activeToolPanel = null; }
      else if (mode === 'pan') { activeTool = 'hand'; if (activeToolPanel === 'draw') activeToolPanel = null; }
      else if (mode === 'draw') { activeTool = 'draw'; }

      return { ...prev, interactionMode: mode, activeTool, activeToolPanel };
    });
  }, []);

  const setActiveSidebarPanel = useCallback((panelId: SidebarPanelId) => {
    setState(prev => ({ ...prev, activeSidebarPanel: panelId }));
  }, []);

  const toggleSidebarPanel = useCallback((panelId: SidebarPanelId) => {
    setState(prev => ({
      ...prev,
      activeSidebarPanel: prev.activeSidebarPanel === panelId ? null : panelId,
    }));
  }, []);

  const setActiveToolPanel = useCallback((panelId: SidebarPanelId) => {
    setState(prev => ({ ...prev, activeToolPanel: panelId }));
  }, []);

  const toggleToolPanel = useCallback((panelId: SidebarPanelId) => {
    setState(prev => ({
      ...prev,
      activeToolPanel: prev.activeToolPanel === panelId ? null : panelId,
    }));
  }, []);

  const setCanvasSize = useCallback((size: { width: number; height: number }) => {
    setState(prev => ({ ...prev, canvasSize: size }));
  }, []);

  const startTextEdit = useCallback((id: string) => {
    setState(prev => ({ ...prev, editingTextId: id, editingTableCell: null }));
  }, []);

  const stopTextEdit = useCallback(() => {
    setState(prev => ({ ...prev, editingTextId: null }));
  }, []);

  const startShapeTextEdit = useCallback((id: string) => {
    setState(prev => ({ ...prev, editingShapeTextId: id, editingTextId: null, editingTableCell: null }));
  }, []);

  const stopShapeTextEdit = useCallback(() => {
    setState(prev => ({ ...prev, editingShapeTextId: null }));
  }, []);

  const startTableCellEdit = useCallback((tableId: string, row: number, col: number) => {
    setState(prev => ({ ...prev, editingTableCell: { tableId, row, col }, editingTextId: null }));
  }, []);

  const stopTableCellEdit = useCallback(() => {
    setState(prev => ({ ...prev, editingTableCell: null }));
  }, []);

  const setSelectedTableCells = useCallback((cells: { tableId: string; row: number; col: number }[]) => {
    setState(prev => ({ ...prev, selectedTableCells: cells }));
  }, []);

  const setIsCropMode = useCallback((isCropMode: boolean) => {
    setState(prev => ({ ...prev, isCropMode }));
  }, []);

  const setLastGraphicsSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, lastGraphicsSearch: query }));
  }, []);

  const setLastIconsSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, lastIconsSearch: query }));
  }, []);

  const setLastPhotosSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, lastPhotosSearch: query }));
  }, []);

  const setLastBackgroundPhotosSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, lastBackgroundPhotosSearch: query }));
  }, []);

  const setLastElementsCategory = useCallback((category: string) => {
    setState(prev => ({ ...prev, lastElementsCategory: category }));
  }, []);

  const setInlineTextSelectionState = useCallback((state: InlineTextSelectionState | null) => {
    setState(prev => ({ ...prev, inlineTextSelectionState: state }));
  }, []);

  // Stable ref for the "apply inline format" function registered by EditorCanvas
  const applyInlineStyleFnRef = useRef<((cmd: string, value?: string) => void) | null>(null);

  const registerApplyInlineStyleFn = useCallback((fn: ((cmd: string, value?: string) => void) | null) => {
    applyInlineStyleFnRef.current = fn;
  }, []);

  const applyInlineTextStyle = useCallback((command: string, value?: string) => {
    applyInlineStyleFnRef.current?.(command, value);
  }, []);

  // Stable ref for crop action handlers registered by EditorCanvas
  const cropActionsRef = useRef<{ apply: () => void; reset: () => void; cancel: () => void } | null>(null);

  const registerCropActions = useCallback((actions: { apply: () => void; reset: () => void; cancel: () => void } | null) => {
    cropActionsRef.current = actions;
  }, []);

  const cropApply = useCallback(() => { cropActionsRef.current?.apply(); }, []);
  const cropReset = useCallback(() => { cropActionsRef.current?.reset(); }, []);
  const cropCancel = useCallback(() => { cropActionsRef.current?.cancel(); }, []);

  const DRAW_TOOL_DEFAULTS = {
    pen:         { drawColor: '#2563EB', drawSize: 4,  drawTension: 0.5 },
    marker:      { drawColor: '#DC2626', drawSize: 10, drawTension: 0.4 },
    highlighter: { drawColor: '#FFFF00', drawSize: 36, drawTension: 0.3 },
  } as const;

  const setDrawTool = useCallback((tool: 'pen' | 'marker' | 'highlighter') => {
    setState(prev => ({ ...prev, drawTool: tool, ...DRAW_TOOL_DEFAULTS[tool] }));
  }, []);

  const setDrawColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, drawColor: color }));
  }, []);

  const setDrawSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, drawSize: size }));
  }, []);

  const setDrawTension = useCallback((tension: number) => {
    setState(prev => ({ ...prev, drawTension: tension }));
  }, []);

  const setReplacingImageId = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, replacingImageId: id }));
  }, []);

  const setEditorMode = useCallback((mode: EditorMode) => {
    setState(prev => ({ ...prev, editorMode: mode }));
  }, []);

  const toggleMockupEnabled = useCallback(() => {
    setState(prev => ({ ...prev, isMockupEnabled: !prev.isMockupEnabled, editorMode: 'mockup-design' }));
  }, []);

  const setMockupEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, isMockupEnabled: enabled, editorMode: 'mockup-design' }));
  }, []);

  const value = useMemo<EditorContextValue>(() => ({
    ...state,
    setTheme,
    toggleDrawer,
    togglePropertyPanel,
    toggleEffectsPanel,
    setActiveTool,
    setActiveNavItem,
    setZoom,
    setInteractionMode,
    setActiveSidebarPanel,
    toggleSidebarPanel,
    setActiveToolPanel,
    toggleToolPanel,
    setCanvasSize,
    startTextEdit,
    stopTextEdit,
    startShapeTextEdit,
    stopShapeTextEdit,
    startTableCellEdit,
    stopTableCellEdit,
    setSelectedTableCells,
    setIsCropMode,
    setLastGraphicsSearch,
    setLastIconsSearch,
    setLastPhotosSearch,
    setLastBackgroundPhotosSearch,
    setLastElementsCategory,
    setInlineTextSelectionState,
    registerApplyInlineStyleFn,
    applyInlineTextStyle,
    setDrawTool,
    setDrawColor,
    setDrawSize,
    setDrawTension,
    setReplacingImageId,
    setEditorMode,
    toggleMockupEnabled,
    setMockupEnabled,
    registerCropActions,
    cropApply,
    cropReset,
    cropCancel,
  }), [state, setTheme, toggleDrawer, togglePropertyPanel, toggleEffectsPanel, setActiveTool, setActiveNavItem, setZoom, setInteractionMode, setActiveSidebarPanel, toggleSidebarPanel, setActiveToolPanel, toggleToolPanel, setCanvasSize, startTextEdit, stopTextEdit, startShapeTextEdit, stopShapeTextEdit, startTableCellEdit, stopTableCellEdit, setSelectedTableCells, setIsCropMode, setLastGraphicsSearch, setLastIconsSearch, setLastPhotosSearch, setLastBackgroundPhotosSearch, setLastElementsCategory, setInlineTextSelectionState, registerApplyInlineStyleFn, applyInlineTextStyle, setDrawTool, setDrawColor, setDrawSize, setDrawTension, setReplacingImageId, setEditorMode, toggleMockupEnabled, setMockupEnabled, registerCropActions, cropApply, cropReset, cropCancel]);

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = (): EditorContextValue => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};

export default EditorContext;

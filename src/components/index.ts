// Sabi Canvas Component Exports
// This file serves as the main entry point for the editor package

export { AppBar } from './AppBar';
export { BottomToolbar } from './BottomToolbar';
export { EditorDrawer } from './EditorDrawer';
export { Toolbar, defaultTools } from './Toolbar';
export { PropertyPanel } from './PropertyPanel';
export { CanvasContainer } from './CanvasContainer';
export { EditorDialog } from './EditorDialog';
export { EditorLayout } from './EditorLayout';
export { EditorModal } from './EditorModal';
export { DownloadDialog } from './DownloadDialog';
export { ResizePanel } from './panels';

// Canvas exports
export { 
  EditorCanvas, 
  SafeArea,
  useStageResize,
  usePanZoom,
  DEFAULT_STAGE_CONFIG,
  ZOOM_CONFIG,
  PRINT_PRESETS,
} from './canvas';

// Re-export types
export type {
  AppBarProps,
  AppBarAction,
  EditorDrawerProps,
  ToolbarProps,
  ToolItem,
  PropertyPanelProps,
  CanvasContainerProps,
  EditorDialogProps,
  EditorState,
  EditorContextValue,
  EditorTheme,
  InteractionMode as EditorInteractionMode,
  SidebarPanelId,
} from '@sabi-canvas/types/editor';

// Re-export canvas types
export type {
  StageConfig,
  ViewportDimensions,
  PanZoomState,
  TouchState,
  InteractionMode,
  EditorCanvasProps,
  SafeAreaProps,
} from '@sabi-canvas/types/canvas';

// Re-export context and hooks
export { EditorProvider, useEditor } from '@sabi-canvas/contexts/EditorContext';
export { 
  useMediaQuery, 
  useBreakpoint, 
  useIsMobile, 
  useIsTablet, 
  useIsDesktop,
  useResponsiveValue,
} from '@sabi-canvas/hooks/useMediaQuery';

// Constants
export { BREAKPOINTS, LAYOUT_RULES } from '@sabi-canvas/types/editor';

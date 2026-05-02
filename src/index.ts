/**
 * Sabi Canvas — Public API
 *
 * A powerful, open-source canvas design editor framework
 * built with React and Konva.
 *
 * @packageDocumentation
 */

// ─── Main Entry Component ─────────────────────────────────────────────────────
export { EditorLayout } from './components/EditorLayout';

// ─── Top-level Editor Components ──────────────────────────────────────────────
export { AppBar } from './components/AppBar';
export { BottomToolbar } from './components/BottomToolbar';
export { DesktopToolbar } from './components/DesktopToolbar';
export { EditorDrawer } from './components/EditorDrawer';
export { Toolbar, defaultTools } from './components/Toolbar';
export { PropertyPanel } from './components/PropertyPanel';
export { EffectsPanel } from './components/EffectsPanel';
export { CanvasContainer } from './components/CanvasContainer';
export { EditorDialog } from './components/EditorDialog';
export { EditorModal } from './components/EditorModal';
export { DownloadDialog } from './components/DownloadDialog';
export { RemoveBgDialog } from './components/RemoveBgDialog';

// ─── Panels ───────────────────────────────────────────────────────────────────
export {
  BackgroundPanel,
  ElementsPanel,
  LayersPanel,
  MyFontsPanel,
  PhotosPanel,
  ProjectsPanel,
  ResizePanel,
  TemplatesPanel,
} from './components/panels';

// ─── Canvas Components ────────────────────────────────────────────────────────
export {
  EditorCanvas,
  SafeArea,
  SafeAreaOverlay,
  CanvasShape,
  CanvasImage,
  CanvasTransformer,
  CanvasObjects,
  CursorModeToggle,
  ContextualToolbar,
} from './components/canvas';

// ─── Contexts & Providers ─────────────────────────────────────────────────────
export { EditorProvider, useEditor } from './contexts/EditorContext';
export { CanvasObjectsProvider, useCanvasObjects } from './contexts/CanvasObjectsContext';
export { CustomFontsProvider, useCustomFonts } from './contexts/CustomFontsContext';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useCanvasActions } from './hooks/useCanvasActions';
export { useCanvasExport } from './hooks/useCanvasExport';
export { loadAllProjects, getProject, saveProject, deleteProject, getLastProjectId, setLastProjectId } from './hooks/useProjectManager';
export { useAutoSave } from './hooks/useAutoSave';
export { useSelectedObject } from './hooks/useSelectedObject';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export { useSmartAlignment } from './hooks/useSmartAlignment';
export { usePanZoom } from './hooks/usePanZoom';
export { useStageResize } from './hooks/useStageResize';
export { useDragDropImages } from './hooks/useDragDropImages';
export { useImageUpload } from './hooks/useImageUpload';
export { useBackgroundRemoval } from './hooks/useBackgroundRemoval';
export { useAIWrite } from './hooks/useAIWrite';
export { usePixabayGraphics } from './hooks/usePixabayGraphics';
export { usePhotosQuery } from './hooks/usePhotosQuery';
export { useIconsQuery } from './hooks/useIconsQuery';
export { useRecentUploads } from './hooks/useRecentUploads';
export { useMediaQuery, useBreakpoint, useIsMobile, useIsTablet, useIsDesktop } from './hooks/useMediaQuery';
export { useDebounce } from './hooks/use-debounce';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  // Editor state
  EditorState,
  EditorContextValue,
  EditorTheme,
  EditorMode,
  SidebarPanelId,
  InteractionMode as EditorInteractionMode,
  AppBarProps,
  AppBarAction,
  ToolbarProps,
  ToolItem,
  EditorDrawerProps,
  PropertyPanelProps,
  CanvasContainerProps,
  EditorDialogProps,
  BREAKPOINTS,
  LAYOUT_RULES,
} from './types/editor';

export type {
  // Canvas objects
  CanvasObject,
  BaseCanvasObject,
  TextObject,
  ImageObject,
  GroupObject,
  TableObject,
  TextSpan,
  TableCell,
} from './types/canvas-objects';

export type {
  // Canvas config
  StageConfig,
  ViewportDimensions,
  PanZoomState,
  TouchState,
  InteractionMode,
  EditorCanvasProps,
  SafeAreaProps,
} from './types/canvas';

export { DEFAULT_STAGE_CONFIG, ZOOM_CONFIG, PRINT_PRESETS } from './types/canvas';

export type { CanvasPage, CanvasBackground } from './types/pages';
export type { Project, ProjectPage } from './types/project';
export type { CustomFont } from './types/custom-fonts';
export type { DesignTemplate, TemplateCategory } from './types/design-templates';

// ─── Design Templates ─────────────────────────────────────────────────────────
export { DESIGN_TEMPLATES, TEMPLATE_CATEGORIES } from './design-templates';
export type { TemplateCategoryItem } from './design-templates';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { cn } from './lib/utils';
export { convertPolotnoDesign } from './lib/polotnoConverter';
export { loadFontFamily, getFontFallbackStack, isFontLoaded, preloadFonts } from './lib/fontLoader';
export { getGoogleFontCatalog, getFontDefinition, GOOGLE_FONT_CATALOG } from './lib/fontCatalog';
export { spansToHtml, spansToPlainText } from './lib/richText';
export { extractSvgPalette, applySvgColorReplacements } from './lib/svgColorUtils';

// ─── Config ───────────────────────────────────────────────────────────────────
export { shapeCategories, getAllShapes, getShapeById } from './config/shapesConfig';

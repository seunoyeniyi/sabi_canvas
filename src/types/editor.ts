// Sabi Canvas Type Definitions
// These types define the component API shapes for the editor package

export interface EditorTheme {
  mode: 'light' | 'dark';
}

// App Bar Types
export interface AppBarProps {
  logo?: React.ReactNode;
  title?: string;
  onTitleChange?: (title: string) => void;
  onMenuToggle?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  actions?: AppBarAction[];
  centerContent?: React.ReactNode;
  className?: string;
  hideTitle?: boolean;
  /**
   * When provided, clicking the theme toggle calls this instead of the
   * editor's internal toggle. Wire to your app's theme system to keep the
   * canvas in sync with the rest of your UI.
   */
  onThemeToggle?: () => void;
}

export interface AppBarAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// Bottom Navigation Types
export interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  className?: string;
}

export interface BottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

// Drawer Types
export interface EditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  children?: React.ReactNode;
  className?: string;
  /**
   * Custom logo to display in the drawer header. Pass any React node
   * (e.g. <img>, SVG, or a styled component). When omitted, a default
   * text-based placeholder is shown.
   */
  logo?: React.ReactNode;
  /** App/brand name shown next to the logo in the drawer header. Defaults to "Sabi Canvas". */
  title?: string;
  onOpenProject?: (project: import('./project').Project) => void;
  onNewProject?: () => void;
  /**
   * External projects list. When provided, the Projects panel displays these
   * instead of reading from localStorage. Pass an empty array while loading.
   */
  externalProjects?: import('./project').Project[];
  /** Show a loading spinner in the Projects panel while fetching. */
  isLoadingProjects?: boolean;
  /**
   * Called when the user confirms deletion of a project from the panel.
   * The host app is responsible for removing it from `externalProjects`.
   */
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  /** Called once on panel mount (and on manual refresh) to trigger a fetch. */
  onRefreshProjects?: () => void;
  /**
   * When provided, clicking a project in the panel calls this instead of
   * loading the project into the current canvas. Use this to navigate to
   * a different design from the host application.
   */
  onSelectProject?: (project: import('./project').Project) => void;
}

// Toolbar Types
export interface ToolbarProps {
  tools: ToolItem[];
  activeToolId: string | null;
  onToolSelect: (id: string) => void;
  orientation?: 'vertical' | 'horizontal';
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export interface ToolItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  group?: string;
}

// Property Panel Types
export interface PropertyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

// Canvas Container Types
export interface CanvasContainerProps {
  children?: React.ReactNode;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  showGrid?: boolean;
  className?: string;
}

// Modal/Dialog Types
export interface EditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

// Template Picker Types
export interface TemplateCategoryProps {
  id: string;
  name: string;
  templates: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  name: string;
  thumbnail: string;
  dimensions: { width: number; height: number };
  category: string;
}

// Inline text selection formatting state (for toolbar active indicators)
export interface InlineTextSelectionState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
}

// Canvas interaction mode type
export type InteractionMode = 'select' | 'pan' | 'draw' | 'text' | 'shape';

// Print-on-demand editor mode
export type EditorMode = 'mockup-design' | 'customer';

// Active sidebar panel type
export type SidebarPanelId = 'home' | 'templates' | 'elements' | 'text' | 'photos' | 'upload' | 'background' | 'layers' | 'projects' | 'uploads' | 'favorites' | 'resize' | 'settings' | 'help' | 'draw' | null;

// Editor Context Types
export interface EditorState {
  theme: EditorTheme;
  isDrawerOpen: boolean;
  isPropertyPanelOpen: boolean;
  isEffectsPanelOpen: boolean;
  activeTool: string | null;
  activeNavItem: string;
  zoom: number;

  interactionMode: InteractionMode;
  activeSidebarPanel: SidebarPanelId;
  activeToolPanel: SidebarPanelId;
  canvasSize: { width: number; height: number };
  editingTextId: string | null;
  editingShapeTextId: string | null;
  editingTableCell: { tableId: string; row: number; col: number } | null;
  selectedTableCells: { tableId: string; row: number; col: number }[];
  isCropMode: boolean;
  lastGraphicsSearch: string;
  lastIconsSearch: string;
  lastPhotosSearch: string;
  lastBackgroundPhotosSearch: string;
  lastElementsCategory: string;
  inlineTextSelectionState: InlineTextSelectionState | null;
  // Draw tool settings
  drawTool: 'pen' | 'marker' | 'highlighter';
  drawColor: string;
  drawSize: number;
  drawTension: number;
  // Image replace mode — ID of the image object currently being replaced, null otherwise
  replacingImageId: string | null;
  // Print-on-demand editor mode
  editorMode: EditorMode;
  // POD mockup feature — off by default, must be manually enabled
  isMockupEnabled: boolean;
}

export interface EditorContextValue extends EditorState {
  setTheme: (theme: EditorTheme) => void;
  toggleDrawer: () => void;
  togglePropertyPanel: () => void;
  toggleEffectsPanel: () => void;
  setActiveTool: (toolId: string | null) => void;
  setActiveNavItem: (navId: string) => void;
  setZoom: (zoom: number) => void;

  setInteractionMode: (mode: InteractionMode) => void;
  setActiveSidebarPanel: (panelId: SidebarPanelId) => void;
  toggleSidebarPanel: (panelId: SidebarPanelId) => void;
  setActiveToolPanel: (panelId: SidebarPanelId) => void;
  toggleToolPanel: (panelId: SidebarPanelId) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  startTextEdit: (id: string) => void;
  stopTextEdit: () => void;
  startShapeTextEdit: (id: string) => void;
  stopShapeTextEdit: () => void;
  startTableCellEdit: (tableId: string, row: number, col: number) => void;
  stopTableCellEdit: () => void;
  setSelectedTableCells: (cells: { tableId: string; row: number; col: number }[]) => void;
  setIsCropMode: (isCropMode: boolean) => void;
  setLastGraphicsSearch: (query: string) => void;
  setLastIconsSearch: (query: string) => void;
  setLastPhotosSearch: (query: string) => void;
  setLastBackgroundPhotosSearch: (query: string) => void;
  setLastElementsCategory: (category: string) => void;
  setInlineTextSelectionState: (state: InlineTextSelectionState | null) => void;
  applyInlineTextStyle: (command: string, value?: string) => void;
  registerApplyInlineStyleFn: (fn: ((cmd: string, value?: string) => void) | null) => void;
  setDrawTool: (tool: 'pen' | 'marker' | 'highlighter') => void;
  setDrawColor: (color: string) => void;
  setDrawSize: (size: number) => void;
  setDrawTension: (tension: number) => void;
  setReplacingImageId: (id: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  toggleMockupEnabled: () => void;
  setMockupEnabled: (enabled: boolean) => void;
  registerCropActions: (actions: { apply: () => void; reset: () => void; cancel: () => void } | null) => void;
  cropApply: () => void;
  cropReset: () => void;
  cropCancel: () => void;
}

// Breakpoint constants for responsive design
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Layout behavior rules
export const LAYOUT_RULES = {
  // Bottom nav visible on mobile, hidden on desktop
  bottomNav: {
    visibleBelow: 'lg',
  },
  // Left toolbar hidden on mobile, visible on desktop
  leftToolbar: {
    visibleAbove: 'md',
    collapsedBelow: 'lg',
  },
  // Right property panel
  propertyPanel: {
    visibleAbove: 'lg',
    overlayBelow: 'lg',
  },
  // Drawer behavior
  drawer: {
    persistentAbove: 'xl',
    miniAbove: 'lg',
  },
} as const;

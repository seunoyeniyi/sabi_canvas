import type { Project } from './project';

// Sabi Canvas Type Definitions
// These types define the component API shapes for the editor package

export interface EditorTheme {
  mode: 'light' | 'dark';
}

// App Bar Types
export interface AppBarProps {
  /**
   * At the very start of the bar, before the menu button and the title, e.g.
   * a back arrow out of an editor opened over another page.
   */
  start?: React.ReactNode;
  logo?: React.ReactNode;
  title?: string;
  onTitleChange?: (title: string) => void;
  onMenuToggle?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  actions?: AppBarAction[];
  /**
   * When provided, renders a primary action button just before the Download
   * button. Designed for Save / Publish workflows.
   */
  saveAction?: AppBarSaveAction;
  /** How Download looks and where it goes on phones. See `DownloadButtonOptions`. */
  downloadButton?: DownloadButtonOptions;
  /** Passed to `saveAction.onClick`. EditorLayout provides it. */
  saveActionContext?: SaveActionContext;
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

/** What the editor hands the save action when it's clicked. */
export interface SaveActionContext {
  /**
   * The design exactly as it is on screen, with a thumbnail captured now
   * (sized by `config.thumbnail`, as auto-save makes it): what auto-save
   * would send next, even if it hasn't run yet. Saves nothing. `id` is empty
   * when the design hasn't been saved yet. `thumbnail` is missing if the
   * capture failed.
   */
  snapshot: () => Promise<Project>;
  /** Pictures of the design's pages, e.g. proofs and print files. See `ExportPagesOptions`. */
  exportPages: (options?: ExportPagesOptions) => Promise<ExportedPage[]>;
}

/** What `exportPages` makes for each page. */
export interface ExportPagesOptions {
  /** Pages to export, by id. Default: every page. */
  pageIds?: string[];
  /**
   * A picture of each whole page with the product picture: a proof. Its
   * longest side is `maxSide` pixels (default 1600). On a print on demand
   * page the design takes the picture's light, bends with its folds and
   * follows its shape (the print area's `realism`), as on a real product;
   * `realistic: false` draws it flat, as in the editor. Left out when not set.
   */
  preview?: {
    maxSide?: number;
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    realistic?: boolean;
    /** Leave out the page's background (PNG or WebP keep the see-through parts). Not for product pages. */
    transparent?: boolean;
  };
  /**
   * A print file for each page: only what the customer added, inside the
   * print area, on a transparent background, at the size returned in pixels
   * (keep the print area's shape). Return nothing to skip a page. A page
   * without a print area exports the whole page. Left out when not set.
   */
  printFile?: (page: import('./project').ProjectPage) => { width: number; height: number } | null | undefined;
  /**
   * The largest print file in pixels (width × height); bigger ones are made
   * smaller, keeping their shape. Default 16,777,216, the most iPhones and
   * iPads can draw.
   */
  maxPixels?: number;
}

export interface ExportedPage {
  pageId: string;
  name: string;
  /** True when the customer hasn't added anything to this page (customer mode), or it has nothing at all. */
  isEmpty: boolean;
  preview?: Blob;
  printFile?: Blob;
  /** The print file's size in pixels, after any `maxPixels` limit. */
  printFileSize?: { width: number; height: number };
}

/**
 * Whether the design has changes that would be lost on leaving. Counted
 * from the first touch, click or key press after a design is opened, so what
 * the editor does by itself while opening (laying out text once fonts load,
 * reading picture sizes) never counts as a change.
 */
export interface EditorSaveState {
  /** Something was changed since the design was opened (or since `markSaved`). */
  edited: boolean;
  /**
   * Changes `onSave` hasn't saved yet: waiting to be saved, being saved, or
   * a save that failed. False again once a save of the latest design succeeds.
   */
  unsaved: boolean;
  /** An auto-save is waiting or under way. */
  saving: boolean;
}

/**
 * What a host can do with an open editor, through `editorRef` on
 * `EditorLayout`. Available once the editor has mounted.
 */
export interface EditorApi {
  /** The design as it is right now (see `SaveActionContext.snapshot`). */
  snapshot: () => Promise<Project>;
  /** Pictures of the design's pages (see `ExportPagesOptions`). Shows each page while it's drawn, then returns to the page that was open. */
  exportPages: (options?: ExportPagesOptions) => Promise<ExportedPage[]>;
  /**
   * Print on demand: shows another product picture on a side, e.g. when the
   * customer picks another colour. Their design and undo history stay. Use a
   * picture of the same shape as the one it replaces.
   */
  replaceMockupPicture: (pageId: string, src: string) => void;
  /**
   * The same, with that picture's own print area (fractions of the page) when
   * it differs, e.g. a colour photographed a little differently, and the
   * side's preview settings (`realism`). The customer's items move and scale
   * with the print area.
   */
  replaceMockup: (pageId: string, change: import('@sabi-canvas/lib/printOnDemand').MockupChange) => void;
  /**
   * Whether leaving now would lose changes, e.g. to ask "Leave the editor?"
   * only when it would. With auto-save (`onSave`) check `unsaved`; when the
   * design is only saved by your own button, check `edited` and call
   * `markSaved` after saving.
   */
  saveState: () => EditorSaveState;
  /** The design as it is now counts as saved, e.g. after your own "Save" step. */
  markSaved: () => void;
}

/**
 * Configuration for the primary save/publish action button rendered in the
 * AppBar just before the Download button. The label and behaviour are fully
 * controlled by the host application , a typical pattern is "Publish" when the
 * item is a draft and "Save" when it is already published.
 */
/**
 * How the top bar shows Download. Pass to `<EditorLayout downloadButton={…} />`.
 * Every field is optional.
 */
export interface DownloadButtonOptions {
  /**
   * The button's look on wide screens. Default: filled, unless your
   * `saveAction` is filled (`variant: "default"`), then outlined, so only one
   * button stands out.
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Default "Download". */
  label?: string;
  /**
   * On phones: in the "⋯" menu (`menu`, the default, which leaves the bar room
   * for your main action) or as an icon in the bar (`bar`).
   */
  phone?: 'menu' | 'bar';
}

export interface AppBarSaveAction {
  /** Button label text, e.g. "Save", "Publish", "Save & Publish". */
  label: string;
  /**
   * Called with the design as it is right now (see `SaveActionContext`).
   * Return a promise to keep the button busy (a spinner, and further clicks
   * ignored) until it settles, e.g. while you capture a snapshot.
   */
  onClick: (context: SaveActionContext) => void | Promise<void>;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
  /**
   * Shows the label on phones too. By default phones show only the icon,
   * which suits short, familiar actions ("Save") but not a step's name
   * ("Review design").
   */
  labelOnPhones?: boolean;
  disabled?: boolean;
  /**
   * shadcn/ui Button variant. Defaults to `"outline"`.
   * Pass any valid variant (e.g. `"default"`, `"secondary"`, `"ghost"`, `"destructive"`).
   */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Extra Tailwind classes merged on top of the base button classes. */
  className?: string;
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
// A built-in panel's id, or a custom tool's (`EditorCustomTool.id`)
export type SidebarPanelId = 'home' | 'templates' | 'elements' | 'text' | 'photos' | 'upload' | 'background' | 'layers' | 'projects' | 'uploads' | 'favorites' | 'resize' | 'settings' | 'help' | 'draw' | (string & {}) | null;

/**
 * Your own button in the editor's side toolbar (the bottom bar on phones),
 * opening your own panel. Pass a list to `<EditorLayout customTools={…} />`,
 * made once (a constant or `useMemo`), so its panels keep their state.
 */
export interface EditorCustomTool {
  /** Unique, and not a built-in tool's: templates, elements, text, photos, upload, background, layers, resize. */
  id: string;
  /** Under the icon, and the panel's title unless `title` is set. Keep it short. */
  label: string;
  /** About 20px, e.g. `<FolderOpen className="h-5 w-5" />`. */
  icon: React.ReactNode;
  /**
   * The panel's content, shown inside the editor, so the editor's hooks work
   * there (`useCanvasObjects`, `useApplyTemplate`…). Call `onClose` to close
   * it, e.g. after adding something to the design.
   */
  panel: React.ComponentType<{ onClose: () => void }>;
  /** Above the panel. Default: `label`. */
  title?: string;
  /** Where the button goes: before or after another tool (by id), or at the start or end. Default `end`. */
  placement?: 'start' | 'end' | { before: string } | { after: string };
  /** `customer`: only while a customer designs on a product; `editor`: never then. Default `all`. */
  showIn?: 'all' | 'editor' | 'customer';
}

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
  // Image replace mode , ID of the image object currently being replaced, null otherwise
  replacingImageId: string | null;
  // Print-on-demand editor mode
  editorMode: EditorMode;
  // POD mockup feature , off by default, must be manually enabled
  isMockupEnabled: boolean;
}

/**
 * Selecting several items on touch screens, where one finger moves the view.
 * Pass to `<EditorLayout touchSelection={…} />`. Every field is optional.
 */
export interface TouchSelectionOptions {
  /**
   * Press and hold, then drag, to draw a selection box (a quick drag still
   * moves the view). Default true.
   */
  pressAndHold?: boolean;
  /** How long to hold before a drag draws the box, in milliseconds. Default 400. */
  holdMs?: number;
  /**
   * A "Select more" button over the selection: while it's on, each tap adds
   * or removes an item. Default true.
   */
  selectMore?: boolean;
  /** A one-time tip about press and hold, once there are two or more items. Default true. */
  showTip?: boolean;
}

export interface EditorContextValue extends EditorState {
  /** Your own toolbar tools (`EditorLayout`'s `customTools`). */
  customTools: EditorCustomTool[];
  /** Tools left out of the toolbar, by id (`EditorLayout`'s `hideTools`). */
  hiddenTools: string[];
  /** Touch selection settings, every field filled in. */
  touchSelection: Required<TouchSelectionOptions>;
  /** "Select more" on touch screens: each tap adds or removes an item. */
  isSelectMoreMode: boolean;
  setSelectMoreMode: (on: boolean) => void;
  setTheme: (theme: EditorTheme) => void;
  toggleDrawer: () => void;
  closeDrawer: () => void;
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

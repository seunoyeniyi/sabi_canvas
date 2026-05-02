import React, { useState, useRef, useCallback, useEffect } from 'react';
import Konva from 'konva';
import { Download, FileCode2, FileDown, FileUp, Share2, Printer, Frame } from 'lucide-react';
import { convertPolotnoDesign } from '@sabi-canvas/lib/polotnoConverter';
import { toast } from 'sonner';
import { EditorProvider, useEditor } from '@sabi-canvas/contexts/EditorContext';
import { CanvasObjectsProvider, useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { CustomFontsProvider, useCustomFonts } from '@sabi-canvas/contexts/CustomFontsContext';
import { SabiCanvasProvider, useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import type { SabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { TopPropertiesBarWrapper } from './canvas/TopPropertiesBarWrapper';
import { AppBar } from './AppBar';
import { BottomToolbar } from './BottomToolbar';
import { EditorDrawer } from './EditorDrawer';
import { DesktopToolbar } from './DesktopToolbar';
import { PropertyPanel } from './PropertyPanel';
import { EffectsPanel } from './EffectsPanel';
import { CanvasContainer } from './CanvasContainer';
import { DownloadDialog } from './DownloadDialog';
import { cn } from '@sabi-canvas/lib/utils';
import { AppBarAction } from '@sabi-canvas/types/editor';
import { useKeyboardShortcuts } from '@sabi-canvas/hooks/useKeyboardShortcuts';
import { useAutoSave } from '@sabi-canvas/hooks/useAutoSave';
import { getLastProjectId, getProject, setLastProjectId } from '@sabi-canvas/hooks/useProjectManager';
import { DEFAULT_PROJECT_TITLE, projectPageToCanvasPage } from '@sabi-canvas/types/project';
import { createPrintAreaObject } from '@sabi-canvas/types/canvas-objects';
import { DESIGN_TEMPLATES } from '@sabi-canvas/design-templates';
import type { Project } from '@sabi-canvas/types/project';
import type { CanvasPage } from '@sabi-canvas/types/pages';

export interface EditorLayoutProps {
  children?: React.ReactNode;
  className?: string;
  enableJsonDevTools?: boolean;
  templateId?: string;
  isBlank?: boolean;
  hideTitle?: boolean;
  /**
   * Optional: pass API keys directly on <EditorLayout> instead of wrapping
   * your app with <SabiCanvasProvider>. When provided, this overrides any
   * ancestor SabiCanvasProvider for the editor subtree.
   */
  config?: SabiCanvasConfig;
}

const EditorLayoutContent: React.FC<EditorLayoutProps> = ({ children, className, enableJsonDevTools = false, templateId, isBlank, hideTitle }) => {
  useKeyboardShortcuts();

  const {
    isDrawerOpen,
    toggleDrawer,
    isPropertyPanelOpen,
    togglePropertyPanel,
    isEffectsPanelOpen,
    toggleEffectsPanel,
    zoom,
    setZoom,
    interactionMode,
    setInteractionMode,
    canvasSize,
    editorMode,
    setEditorMode,
    isMockupEnabled,
    toggleMockupEnabled,
    setMockupEnabled,
  } = useEditor();

  const {
    pages,
    activePage,
    activePageId,
    canUndo,
    canRedo,
    exportActivePageJson,
    importActivePageJson,
    loadProjectData,
    undo,
    redo,
    selectedIds,
    addObject,
  } = useCanvasObjects();

  const { customFonts, loadProjectFonts } = useCustomFonts();

  const hasSelection = selectedIds && selectedIds.length > 0;

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>(DEFAULT_PROJECT_TITLE);
  const stageRef = useRef<React.RefObject<Konva.Stage> | null>(null);
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);
  const polotnoImportInputRef = useRef<HTMLInputElement | null>(null);

  // Load last project on mount
  useEffect(() => {
    // 0. Handle intentional blank canvas creation
    if (isBlank) {
      handleNewProject();
      return;
    }

    // 1. Handle template initialization if a valid templateId is passed.
    if (templateId) {
      const template = DESIGN_TEMPLATES.find((t) => t.id === templateId);
      if (template) {
        const pageId = `page_${Date.now()}`;
        const templateSize = { width: template.canvasWidth, height: template.canvasHeight };
        const canvasPages: CanvasPage[] = [
          {
            id: pageId,
            name: template.pageName || template.name,
            order: 0,
            size: templateSize,
            objects: template.objects || [],
            background: template.background || { type: 'solid', color: '#ffffff' },
            viewState: template.viewState || { zoom: 1, position: { x: 0, y: 0 } },
            selectedIds: [],
            past: [],
            future: [],
          },
        ];

        loadProjectData(canvasPages, pageId, templateSize);
        setProjectId(null); // Treat as new project
        setProjectTitle(template.name);
        setMockupEnabled(false);
        return; // Skip loading from localStorage
      }
    }

    // 2. Fallback: Load last project from local storage
    const lastId = getLastProjectId();
    if (!lastId) return;
    const project = getProject(lastId);
    if (!project) return;
    const canvasPages = project.pages.map(projectPageToCanvasPage);
    loadProjectData(canvasPages, project.activePageId, project.canvasSize);
    setProjectId(project.id);
    setProjectTitle(project.title);
    setMockupEnabled(project.isMockupEnabled ?? false);
    if (project.customFonts?.length) {
      loadProjectFonts(project.customFonts);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const getStage = useCallback((): Konva.Stage | null => {
    return stageRef.current?.current ?? null;
  }, []);

  useAutoSave({
    pages,
    activePageId,
    projectId,
    projectTitle,
    getStage,
    onProjectCreated: setProjectId,
    customFonts,
    isMockupEnabled,
  });

  const handleOpenProject = useCallback(
    (project: Project) => {
      const canvasPages = project.pages.map(projectPageToCanvasPage);
      loadProjectData(canvasPages, project.activePageId);
      setProjectId(project.id);
      setProjectTitle(project.title);
      setLastProjectId(project.id);
      setMockupEnabled(project.isMockupEnabled ?? false);
      if (project.customFonts?.length) {
        loadProjectFonts(project.customFonts);
      }
    },
    [loadProjectData, loadProjectFonts, setMockupEnabled]
  );

  const handleNewProject = useCallback(() => {
    const freshPage: CanvasPage = {
      id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      name: 'Page 1',
      order: 0,
      size: canvasSize,
      objects: [],
      selectedIds: [],
      past: [],
      future: [],
      viewState: { zoom: 1, position: { x: 0, y: 0 } },
      background: { type: 'solid', color: '#ffffff' },
    };
    loadProjectData([freshPage], freshPage.id);
    setProjectId(null);
    setProjectTitle(DEFAULT_PROJECT_TITLE);
    setLastProjectId(null);
    setMockupEnabled(false);
  }, [loadProjectData, canvasSize, setMockupEnabled]);

  const handleStageRefReady = useCallback((ref: React.RefObject<Konva.Stage>) => {
    stageRef.current = ref;
  }, []);

  const handleExportJson = useCallback(() => {
    const payload = exportActivePageJson();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    const safePageName = activePage.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    anchor.href = url;
    anchor.download = `${safePageName || 'canvas-design'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success('Design JSON exported.');
  }, [activePage.name, exportActivePageJson]);

  const handleOpenImportPicker = useCallback(() => {
    jsonImportInputRef.current?.click();
  }, []);

  const handleOpenPolotnoImportPicker = useCallback(() => {
    polotnoImportInputRef.current?.click();
  }, []);

  const handleImportPolotnoFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text) as unknown;
        const result = convertPolotnoDesign(json);

        if ('error' in result) {
          toast.error(result.error);
          return;
        }

        loadProjectData(result.pages, result.pages[0].id, { width: result.width, height: result.height });
        setProjectTitle('Polotno Import');
        setProjectId(null);

        const totalObjects = result.pages.reduce((sum, p) => sum + p.objects.length, 0);
        toast.success(
          `Imported ${result.pages.length} page(s) with ${totalObjects} object(s) from Polotno design.`,
        );
      } catch {
        toast.error('Failed to read or parse the Polotno JSON file.');
      }
    },
    [loadProjectData],
  );

  const handleImportJsonFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const result = importActivePageJson(payload);

      if (!result.success) {
        toast.error(result.error ?? 'Unable to import JSON file.');
        return;
      }

      toast.success(`Imported ${result.importedCount ?? 0} object(s) to active page.`);
    } catch {
      toast.error('Invalid JSON file.');
    }
  }, [importActivePageJson]);

  const handleAddPrintArea = useCallback(() => {
    const cx = canvasSize.width / 2;
    const cy = canvasSize.height / 2;
    const w = Math.round(canvasSize.width * 0.6);
    const h = Math.round(canvasSize.height * 0.6);
    const printArea = createPrintAreaObject(
      { x: cx - w / 2, y: cy - h / 2 },
      { width: w, height: h }
    );
    addObject(printArea);
  }, [addObject, canvasSize]);

  // AppBar center: mode toggle + add print area — only shown when mockup feature is enabled
  const appBarCenterContent = isMockupEnabled ? (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-full border border-border bg-muted p-0.5 text-sm">
        <button
          onClick={() => setEditorMode('mockup-design')}
          className={cn(
            'rounded-full px-3 py-1 transition-colors',
            editorMode === 'mockup-design'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Mockup Design
        </button>
        <button
          onClick={() => setEditorMode('customer')}
          className={cn(
            'rounded-full px-3 py-1 transition-colors',
            editorMode === 'customer'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          User View
        </button>
      </div>
      {editorMode === 'mockup-design' && (
        <button
          onClick={handleAddPrintArea}
          title="Add Print Area"
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Frame className="h-3.5 w-3.5" />
          Print Area
        </button>
      )}
    </div>
  ) : undefined;

  // App bar actions
  const appBarActions: AppBarAction[] = [
    { id: 'download', icon: <Download className="h-4.5 w-4.5" />, label: 'Download', onClick: () => setIsDownloadOpen(true) },
    { id: 'share', icon: <Share2 className="h-4.5 w-4.5" />, label: 'Share', onClick: () => console.log('Share') },
    { id: 'mockup-toggle', icon: <Printer className={cn('h-4.5 w-4.5', isMockupEnabled && 'text-primary')} />, label: isMockupEnabled ? 'Disable Mockup' : 'Enable Mockup', onClick: toggleMockupEnabled },
    ...(enableJsonDevTools
      ? [
        {
          id: 'export-json-dev',
          icon: <FileDown className="h-4.5 w-4.5" />,
          label: 'Export JSON (Dev)',
          onClick: handleExportJson,
        },
        {
          id: 'import-json-dev',
          icon: <FileUp className="h-4.5 w-4.5" />,
          label: 'Import JSON (Dev)',
          onClick: handleOpenImportPicker,
        },
        {
          id: 'import-polotno-json-dev',
          icon: <FileCode2 className="h-4.5 w-4.5" />,
          label: 'Import Polotno Design',
          onClick: handleOpenPolotnoImportPicker,
        },
      ]
      : []),
  ];

  return (
    <div className={cn('flex flex-col h-dvh w-full overflow-hidden bg-background', className)}>
      {/* App Bar */}
      <AppBar
        title={projectTitle}
        onTitleChange={setProjectTitle}
        onMenuToggle={toggleDrawer}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        actions={appBarActions}
        centerContent={appBarCenterContent}
        hideTitle={hideTitle}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Drawer (Desktop: persistent mini/expanded) */}
        <EditorDrawer
          isOpen={isDrawerOpen}
          onClose={toggleDrawer}
          side="left"
          onOpenProject={handleOpenProject}
          onNewProject={handleNewProject}
        >
          {/* Additional drawer content can go here */}
        </EditorDrawer>

        {/* Canvas Area with Overlay Toolbar */}
        <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 z-50">
            <TopPropertiesBarWrapper />
          </div>
          <CanvasContainer
            zoom={zoom}
            onZoomChange={setZoom}
            showGrid={false}
            interactionMode={interactionMode}
            onInteractionModeChange={setInteractionMode}
            stageConfig={{
              designWidth: canvasSize.width,
              designHeight: canvasSize.height,
            }}
            onStageRefReady={handleStageRefReady}
          >
            {children}
          </CanvasContainer>

          {/* Floating Desktop Toolbar */}
          <div className={cn(
            "absolute left-4 bottom-4 z-10 hidden md:flex transition-all duration-300 ease-in-out",
            hasSelection || interactionMode === 'draw' ? "top-[128px]" : "top-20"
          )}>
            <DesktopToolbar />
          </div>
        </div>

        {/* Right Property Panel */}
        <PropertyPanel
          isOpen={isPropertyPanelOpen}
          onClose={togglePropertyPanel}
          title="Properties"
        />

        {/* Right Effects Panel */}
        <EffectsPanel
          isOpen={isEffectsPanelOpen}
          onClose={toggleEffectsPanel}
        />
      </div>

      {/* Bottom Editor Toolbar (Mobile only) */}
      <BottomToolbar />

      <input
        ref={jsonImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJsonFile}
      />
      <input
        ref={polotnoImportInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportPolotnoFile}
      />

      {/* Download Dialog */}
      <DownloadDialog
        isOpen={isDownloadOpen}
        onClose={() => setIsDownloadOpen(false)}
        stageRef={stageRef.current}
      />
    </div>
  );
};

export const EditorLayout: React.FC<EditorLayoutProps> = ({ config, ...props }) => {
  const ancestorConfig = useSabiCanvasConfig();
  // Use the prop-level config if provided, otherwise fall through to ancestor provider
  const resolvedConfig = config ?? ancestorConfig;

  return (
    <SabiCanvasProvider config={resolvedConfig}>
      <EditorProvider>
        <CanvasObjectsProvider>
          <CustomFontsProvider>
            <EditorLayoutContent {...props} />
          </CustomFontsProvider>
        </CanvasObjectsProvider>
      </EditorProvider>
    </SabiCanvasProvider>
  );
};

export default EditorLayout;


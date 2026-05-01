import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import Konva from 'konva';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { CanvasContainerProps } from '@sabi-canvas/types/editor';
import { InteractionMode, StageConfig } from '@sabi-canvas/types/canvas';
import { Button } from '@sabi-canvas/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import { cn } from '@sabi-canvas/lib/utils';
import { EditorCanvas, EditorCanvasHandle } from './canvas/EditorCanvas';
import { CursorModeToggle } from './canvas/CursorModeToggle';
import { PageNavigation } from './canvas/PageNavigation';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useIsMobile } from '@sabi-canvas/hooks/use-mobile';

interface ExtendedCanvasContainerProps extends CanvasContainerProps {
  stageConfig?: Partial<StageConfig>;
  interactionMode?: InteractionMode;
  onInteractionModeChange?: (mode: InteractionMode) => void;
  onStageRefReady?: (stageRef: React.RefObject<Konva.Stage>) => void;
}

const DEFAULT_POSITION = { x: 0, y: 0 };

export const CanvasContainer: React.FC<ExtendedCanvasContainerProps> = ({
  children,
  showGrid = true,
  stageConfig,
  interactionMode = 'select',
  onInteractionModeChange,
  onStageRefReady,
  className,
}) => {
  const [mode, setMode] = useState<InteractionMode>(interactionMode);
  const canvasRef = useRef<EditorCanvasHandle>(null);
  const stageRefForwarderCalled = useRef(false);
  const { activePage, updatePageViewState, selectedIds } = useCanvasObjects();
  const isMobile = useIsMobile();
  const hasSelection = selectedIds && selectedIds.length > 0;

  // Sync mode with external interactionMode prop
  useEffect(() => {
    setMode(interactionMode);
  }, [interactionMode]);

  // Read zoom and position from active page, fallback to defaults
  const currentZoom = activePage?.viewState?.zoom ?? 1;
  const currentPosition = useMemo(
    () => activePage?.viewState?.position ?? DEFAULT_POSITION,
    [activePage?.viewState?.position]
  );
  const latestViewRef = useRef({ zoom: currentZoom, position: currentPosition });

  useEffect(() => {
    latestViewRef.current = { zoom: currentZoom, position: currentPosition };
  }, [currentZoom, currentPosition]);
  
  // Percent base zoom for the zoom overlay UI
  const displayZoom = Math.round(currentZoom * 100);

  const handleZoomChange = useCallback((newZoom: number) => {
    latestViewRef.current = {
      ...latestViewRef.current,
      zoom: newZoom,
    };
    updatePageViewState(newZoom, latestViewRef.current.position);
  }, [updatePageViewState]);

  const handlePositionChange = useCallback((newPos: { x: number; y: number }) => {
    latestViewRef.current = {
      ...latestViewRef.current,
      position: newPos,
    };
    updatePageViewState(latestViewRef.current.zoom, newPos);
  }, [updatePageViewState]);

  const handleZoomIn = () => handleZoomChange(Math.min(4, currentZoom + 0.1));
  const handleZoomOut = () => handleZoomChange(Math.max(0.1, currentZoom - 0.1));
  const handleZoomFit = () => {
    latestViewRef.current = {
      zoom: 1,
      position: { x: 0, y: 0 },
    };
    updatePageViewState(1, { x: 0, y: 0 });
  };

  return (
    <div className={cn(
      'relative flex-1 overflow-hidden',
      'bg-canvas-bg',
      className
    )}>
      {/* Bottom controls live in a reserved strip so they do not block canvas handles */}
      <div className={cn("absolute inset-x-0 bottom-0 z-20 pointer-events-none", isMobile ? "h-32" : "h-20")}>
        <div className={cn("absolute left-1/2 -translate-x-1/2 pointer-events-auto", isMobile ? "bottom-20" : "bottom-4")}>
          <PageNavigation />
        </div>
      </div>

      {/* Konva Canvas Stage */}
      <EditorCanvas
        ref={canvasRef}
        config={stageConfig}
        zoom={currentZoom}
        position={currentPosition}
        onZoomChange={handleZoomChange}
        onPositionChange={handlePositionChange}
        mode={mode}
        showGrid={showGrid}
        showSafeArea={true}
        className="absolute inset-0"
        onStageRefReady={(ref) => {
          if (!stageRefForwarderCalled.current && onStageRefReady) {
            stageRefForwarderCalled.current = true;
            onStageRefReady(ref);
          }
        }}
      >
        {children}
      </EditorCanvas>

      {/* Cursor Mode Toggle (Desktop only) */}
      {!isMobile && (
        <CursorModeToggle
          mode={mode}
          onModeChange={(newMode) => {
            setMode(newMode);
            onInteractionModeChange?.(newMode);
          }}
          className={cn(
            "absolute z-20 left-4 transition-all duration-300 ease-in-out",
            hasSelection || mode === 'draw' ? "top-[64px]" : "top-4"
          )}
        />
      )}

      {/* Zoom UI (Desktop only) */}
      {!isMobile && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 p-1 rounded-lg bg-card border border-panel-border shadow-editor-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <button
          onClick={handleZoomFit}
          className="min-w-[50px] px-2 py-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          {displayZoom}%
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-panel-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomFit}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to Screen</TooltipContent>
        </Tooltip>
      </div>
      )}
    </div>
  );
};

export default CanvasContainer;

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import Konva from 'konva';
import { Copy, Trash2, Lock, Unlock, PenSquare, Crop, Group, Ungroup } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { cn } from '@sabi-canvas/lib/utils';
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useToolbarState } from './hooks/useToolbarState';
import { ToolbarTooltip, PositionAlignButton, AIWriteButton } from './shared/ContextualTools';

// --- Types ---

interface ContextualToolbarProps {
  stageRef: React.RefObject<Konva.Stage>;
  containerRef: React.RefObject<HTMLDivElement>;
  selectedObject: CanvasObject | null;
  safeAreaRect: { x: number; y: number; width: number; height: number };
  designSize: { width: number; height: number };
  className?: string;
  onCropModeToggle?: () => void;
  onTextEdit?: (id: string) => void;
}

interface ToolbarPosition {
  x: number;
  y: number;
  placement: 'above' | 'below';
}


const POSITION_EPSILON = 0.5;

// --- Constants ---

const TOOLBAR_HEIGHT = 44;
const TOOLBAR_OFFSET = 12;
const ROTATION_HANDLE_OFFSET = 48;
const EDGE_PADDING = 8;



// --- Main Component ---

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  stageRef,
  containerRef,
  selectedObject,
  safeAreaRect,
  designSize,
  className,
  onCropModeToggle,
  onTextEdit,
}) => {
  const { selectedIds } = useCanvasObjects();
  const toolbarState = useToolbarState({ selectedObject, designSize, onTextEdit });

  const {
    isMultiSelect,
    isText,
    allLocked,
    handleDuplicate,
    handleDelete,
    handleLockToggle,
    handleTextEdit,
    handleAlign,
    handleLayers,
    isImage,
    isSvgImage,
    isCropMode,
    handleCropModeToggle,
    shouldShowGroupAction,
    isGroupActionUngroup,
    handleGroupAction,
    canShowAIWrite,
    isAIWriteRunning,
    handleAIWriteAction,
  } = toolbarState;

  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Sticky state for Position popover
  const [isPositionOpen, setIsPositionOpen] = useState(false);
  const [isAIWriteOpen, setIsAIWriteOpen] = useState(false);
  const isPositionOpenRef = useRef(false);
  const isAIWriteOpenRef = useRef(false);

  const setPositionIfChanged = useCallback((next: ToolbarPosition | null) => {
    setPosition((prev) => {
      if (prev === null && next === null) return prev;
      if (prev === null || next === null) return next;

      const samePlacement = prev.placement === next.placement;
      const sameX = Math.abs(prev.x - next.x) < POSITION_EPSILON;
      const sameY = Math.abs(prev.y - next.y) < POSITION_EPSILON;

      if (samePlacement && sameX && sameY) {
        return prev;
      }

      return next;
    });
  }, []);

  // --- Positioning Logic ---

  const updatePosition = useCallback(() => {
    // If position popover is open, don't move the toolbar!
    if (isPositionOpenRef.current || isAIWriteOpenRef.current) return;

    if ((!selectedObject && !isMultiSelect) || !stageRef.current || !containerRef.current) {
      setPositionIfChanged(null);
      return;
    }

    const stage = stageRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    let overallBox: any = null;
    let anyNodeFound = false;
    let fallbackRotation = 0;

    const idsToFind = isMultiSelect ? selectedIds : (selectedObject ? [selectedObject.id] : []);

    idsToFind.forEach((id) => {
      const node = stage.findOne(`.${id}`);
      if (node) {
        anyNodeFound = true;
        fallbackRotation = node.rotation();
        const box = node.getClientRect({ relativeTo: stage });
        if (!overallBox) {
          overallBox = box;
        } else {
          const x1 = Math.min(overallBox.x, box.x);
          const y1 = Math.min(overallBox.y, box.y);
          const x2 = Math.max(overallBox.x + overallBox.width, box.x + box.width);
          const y2 = Math.max(overallBox.y + overallBox.height, box.y + box.height);
          overallBox = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
        }
      }
    });

    if (!anyNodeFound || !overallBox) {
      setPositionIfChanged(null);
      return;
    }

    const stagePos = stage.position();
    const screenX = containerRect.left + overallBox.x + stagePos.x;
    const screenY = containerRect.top + overallBox.y + stagePos.y;
    const screenHeight = overallBox.height;
    const screenWidth = overallBox.width;

    let toolbarX = screenX + screenWidth / 2;
    const toolbarWidth = toolbarRef.current?.offsetWidth || 300;

    const minX = containerRect.left + EDGE_PADDING + toolbarWidth / 2;
    const maxX = containerRect.right - EDGE_PADDING - toolbarWidth / 2;
    toolbarX = Math.max(minX, Math.min(maxX, toolbarX));

    // Account for the top properties bar so the contextual toolbar never overlaps it
    const propertiesBarEl = document.getElementById('top-properties-bar');
    const topBoundary = propertiesBarEl
      ? propertiesBarEl.getBoundingClientRect().bottom
      : containerRect.top;

    const spaceAbove = screenY - topBoundary;
    const spaceBelow = containerRect.bottom - (screenY + screenHeight);

    // Normalize rotation between 0 and 360
    const normalizedRotation = isMultiSelect ? 0 : ((fallbackRotation % 360) + 360) % 360;

    // When the shape is upside down (between 90 and 270 degrees), 
    // the transformer's rotation anchor moves to the bottom
    const isUpsideDown = normalizedRotation > 90 && normalizedRotation < 270;
    const effectiveTopOffset = isUpsideDown ? TOOLBAR_OFFSET : ROTATION_HANDLE_OFFSET;
    const effectiveBottomOffset = isUpsideDown ? ROTATION_HANDLE_OFFSET : TOOLBAR_OFFSET;

    let placement: 'above' | 'below';
    let toolbarY: number;

    if (spaceAbove >= TOOLBAR_HEIGHT + effectiveTopOffset) {
      placement = 'above';
      toolbarY = screenY - effectiveTopOffset - TOOLBAR_HEIGHT;
    } else if (spaceBelow >= TOOLBAR_HEIGHT + effectiveBottomOffset) {
      placement = 'below';
      toolbarY = screenY + screenHeight + effectiveBottomOffset;
    } else {
      placement = 'above';
      toolbarY = Math.max(topBoundary + EDGE_PADDING, screenY - effectiveTopOffset - TOOLBAR_HEIGHT);
    }

    toolbarY = Math.max(topBoundary + EDGE_PADDING, toolbarY);
    toolbarY = Math.min(containerRect.bottom - TOOLBAR_HEIGHT - EDGE_PADDING, toolbarY);

    setPositionIfChanged({
      x: toolbarX,
      y: toolbarY,
      placement,
    });
  }, [selectedObject, isMultiSelect, selectedIds, stageRef, containerRef, setPositionIfChanged]);

  // Close position popover whenever the selection changes
  const selectionKey = selectedObject?.id ?? selectedIds.join(',');
  useEffect(() => {
    setIsPositionOpen(false);
  }, [selectionKey]);

  // Sync ref for callback access
  useEffect(() => {
    isPositionOpenRef.current = isPositionOpen;
    isAIWriteOpenRef.current = isAIWriteOpen;
    // If we close the popover, force an update to snap to new position
    if (!isPositionOpen && !isAIWriteOpen) {
      updatePosition();
    }
  }, [isPositionOpen, isAIWriteOpen, updatePosition]);

  useEffect(() => {
    updatePosition();
    const stage = stageRef.current;
    if (stage) {
      stage.on('dragmove', updatePosition);
      stage.on('transform', updatePosition);
      stage.on('wheel', updatePosition);
    }
    window.addEventListener('resize', updatePosition);
    let rafId: number;
    const tick = () => {
      updatePosition();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (stage) {
        stage.off('dragmove', updatePosition);
        stage.off('transform', updatePosition);
        stage.off('wheel', updatePosition);
      }
      window.removeEventListener('resize', updatePosition);
      cancelAnimationFrame(rafId);
    };
  }, [updatePosition, stageRef]);




  const popoverSide = position?.placement === 'above' ? 'top' : 'bottom';

  if ((!selectedObject && !isMultiSelect) || !position) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className={cn(
        'fixed z-[150] flex items-center gap-1 rounded-md shadow-xl',
        'bg-card/95 backdrop-blur-md border border-panel-border px-0.5 py-0.5',
        'transition-all duration-150',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-50%)',
        width: 'max-content'
      }}
    >
      {isText && !isMultiSelect && (
        <ToolbarTooltip label="Edit Text" side={popoverSide}>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleTextEdit}>
            <PenSquare className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
      )}

      {canShowAIWrite && (
        <AIWriteButton
          side={popoverSide}
          open={isAIWriteOpen}
          onOpenChange={setIsAIWriteOpen}
          isLoading={isAIWriteRunning}
          onAction={handleAIWriteAction}
        />
      )}

      <ToolbarTooltip label={allLocked ? 'Unlock' : 'Lock'} side={popoverSide}>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 flex-shrink-0", allLocked && "text-muted-foreground")}
          onClick={handleLockToggle}
        >
          {allLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </Button>
      </ToolbarTooltip>

      {isImage && !isSvgImage && !isMultiSelect && (
        <ToolbarTooltip label="Crop" side={popoverSide}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Crop"
            onClick={handleCropModeToggle}
            className={cn("h-8 w-8 flex-shrink-0", isCropMode && "bg-secondary text-secondary-foreground")}
          >
            <Crop className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
      )}

      <PositionAlignButton
        onAlign={handleAlign}
        onLayersChange={handleLayers}
        side={popoverSide}
        open={isPositionOpen}
        onOpenChange={setIsPositionOpen}
      />

      {shouldShowGroupAction && (
        <Button variant="ghost" className="h-8 px-2 flex-shrink-0 text-xs font-medium" onClick={handleGroupAction}>
          {isGroupActionUngroup ? <Ungroup className="h-4 w-4" /> : <Group className="h-4 w-4" />}
          {isGroupActionUngroup ? 'Ungroup' : 'Group'}
        </Button>
      )}

      <ToolbarTooltip label="Duplicate" side={popoverSide}>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleDuplicate}>
          <Copy className="h-4 w-4" />
        </Button>
      </ToolbarTooltip>

      <div className="w-px h-4 bg-border mx-1 my-1" />

      <ToolbarTooltip label="Delete" side={popoverSide}>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </ToolbarTooltip>
    </div>
  );
};

export default ContextualToolbar;

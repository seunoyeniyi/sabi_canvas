/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { Stage, Layer, Group, Rect, Line } from 'react-konva';
import Konva from 'konva';
import { cn } from '@sabi-canvas/lib/utils';
import { EditorCanvasProps, DEFAULT_STAGE_CONFIG, ZOOM_CONFIG } from '@sabi-canvas/types/canvas';
import { useStageResize } from '@sabi-canvas/hooks/useStageResize';
import { usePanZoom } from '@sabi-canvas/hooks/usePanZoom';
import { SafeArea } from './SafeArea';
import { SafeAreaOverlay } from './SafeAreaOverlay';
import { CanvasObjects } from './CanvasObjects';
import { CanvasTransformer } from './CanvasTransformer';
import { ContextualToolbar } from './ContextualToolbar';
import { CanvasContextMenu } from './CanvasContextMenu';
import { KonvaCropOverlay, type CropRatio } from './KonvaCropOverlay';
import { AlignmentGuides } from './AlignmentGuides';
import { Button } from '@sabi-canvas/ui/button';
import { Check, RotateCcw, X } from 'lucide-react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useSelectedObject } from '@sabi-canvas/hooks/useSelectedObject';
import { useSmartAlignment } from '@sabi-canvas/hooks/useSmartAlignment';
import { useTheme } from '@sabi-canvas/providers/theme-provider';
import { ImageObject, TextObject } from '@sabi-canvas/types/canvas-objects';
import { createDrawObject } from '@sabi-canvas/types/canvas-objects';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { getFontFallbackStack, loadFontFamily } from '@sabi-canvas/lib/fontLoader';
import { isSvgSrc } from '@sabi-canvas/lib/svgColorUtils';
import { getListContinuationPrefix, applyListStyleToSpans, stripListStyleFromSpans } from './hooks/useToolbarState';
import { useIsMobile } from '@sabi-canvas/hooks/use-mobile';
import { domToSpans, spansToHtml, isPlainSpans, spansToPlainText, normalizeSpans } from '@sabi-canvas/lib/richText';
import { useDragDropImages } from '@sabi-canvas/hooks/useDragDropImages';
import type { TextSpan } from '@sabi-canvas/types/canvas-objects';

interface ExtendedEditorCanvasProps extends EditorCanvasProps {
  onStageRefReady?: (stageRef: React.RefObject<Konva.Stage>) => void;
}

export interface EditorCanvasHandle {
  stage: Konva.Stage | null;
  resetView: () => void;
}

const MOBILE_STAGE_PAN_TOUCH_SLOP = 8;

export const EditorCanvas = forwardRef<EditorCanvasHandle, ExtendedEditorCanvasProps>(({
  config: userConfig,
  zoom: externalZoom,
  position: externalPosition,
  onPositionChange,
  onZoomChange,
  mode = 'select',
  interactive = true,
  showGrid = true,
  showSafeArea = true,
  className,
  children,
  onStageReady,
  onStageRefReady,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const { selectedIds, updateObject, objects, selectObjects, deselectAll, activePage, addObject } = useCanvasObjects();
  const selectedObject = useSelectedObject();
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const { editingTextId, startTextEdit, stopTextEdit, editingShapeTextId, startShapeTextEdit, stopShapeTextEdit, isCropMode, setIsCropMode, setActiveSidebarPanel, setActiveToolPanel, editingTableCell, startTableCellEdit, stopTableCellEdit, setSelectedTableCells, setInlineTextSelectionState, registerApplyInlineStyleFn, registerCropActions, drawColor, drawSize, drawTension, drawTool, editorMode, isMockupEnabled } = useEditor();
  const [isObjectDragging, setIsObjectDragging] = useState(false);
  const [isTouchStagePanning, setIsTouchStagePanning] = useState(false);
  const [isStageZooming, setIsStageZooming] = useState(false);
  const [editingValue, setEditingValue] = useState('');
  const [editingOriginalValue, setEditingOriginalValue] = useState('');
  const [editingOriginalRichText, setEditingOriginalRichText] = useState<TextSpan[] | undefined>(undefined);
  const [editingCellValue, setEditingCellValue] = useState('');
  const [editingCellOriginalValue, setEditingCellOriginalValue] = useState('');
  const [editingShapeTextValue, setEditingShapeTextValue] = useState('');
  const [editingShapeTextOriginalValue, setEditingShapeTextOriginalValue] = useState('');
  const [editingShapeTextOriginalRichText, setEditingShapeTextOriginalRichText] = useState<TextSpan[] | undefined>(undefined);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const cellTextareaRef = useRef<HTMLTextAreaElement>(null);
  const shapeContentEditableRef = useRef<HTMLDivElement>(null);
  const shapeSavedSelectionRef = useRef<Range | null>(null);
  const cellBlurTimeoutRef = useRef<number | null>(null);
  const contentBlurTimeoutRef = useRef<number | null>(null);
  const shapeBlurTimeoutRef = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const [isTouchGestureLocked, setIsTouchGestureLocked] = useState(false);
  const zoomHideTimeoutRef = useRef<number | null>(null);
  const previousZoomRef = useRef<number | null>(null);
  const singleTouchStagePanRef = useRef<{
    active: boolean;
    moved: boolean;
    startPoint: { x: number; y: number } | null;
    lastPoint: { x: number; y: number } | null;
  }>({
    active: false,
    moved: false,
    startPoint: null,
    lastPoint: null,
  });
  const positionRef = useRef({ x: 0, y: 0 });
  const suppressTapSelectionUntilRef = useRef(0);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [liveDrawPoints, setLiveDrawPoints] = useState<number[]>([]);
  const isDrawingRef = useRef(false);
  const liveDrawPointsRef = useRef<number[]>([]);

  // Crop mode ratio state — lifted here so the Konva layer and HTML buttons share it
  const [cropRatio, setCropRatio] = useState<CropRatio | null>(null);

  // Drag-drop images functionality
  const { isDropActive } = useDragDropImages({
    containerRef,
    stageRef,
    onImageAdded: () => {
      // Optional callback when image is dropped
    },
  });

  const triggerStageZooming = useCallback(() => {
    setIsStageZooming(true);

    if (zoomHideTimeoutRef.current !== null) {
      window.clearTimeout(zoomHideTimeoutRef.current);
    }

    zoomHideTimeoutRef.current = window.setTimeout(() => {
      setIsStageZooming(false);
      zoomHideTimeoutRef.current = null;
    }, 180);
  }, []);

  // Multi-select state
  const [selectionRect, setSelectionRect] = useState<{
    visible: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }>({
    visible: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const config = { ...DEFAULT_STAGE_CONFIG, ...userConfig };

  // Pan/zoom state management
  const {
    zoom: internalZoom,
    position,
    setZoom,
    setPosition,
    resetView,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDragStart,
    handleDragEnd,
    isDragging,
  } = usePanZoom({
    initialZoom: externalZoom ?? 1,
    initialPosition: externalPosition ?? { x: 0, y: 0 },
    onPositionChange,
    onZoomChange,
  });

  // Expose resetView and stage via ref
  useImperativeHandle(ref, () => ({
    stage: stageRef.current,
    resetView: () => {
      resetView();
    }
  }), [resetView]);

  // Use external zoom if provided
  const currentZoom = externalZoom ?? internalZoom;

  // Smart Alignment Hooks
  const { alignmentLines, handleDragMove: handleObjectDragMove, handleDragEnd: handleObjectDragEnd } = useSmartAlignment(
    objects,
    selectedIds,
    { width: config.designWidth, height: config.designHeight },
    currentZoom
  );

  // Responsive stage sizing
  const { dimensions, safeAreaRect } = useStageResize({
    config,
    containerRef,
    zoom: currentZoom,
    safeAreaTopInset: isMobile ? 40 : 40,
    safeAreaBottomInset: isMobile ? 200 : 50,
    safeAreaLeftInset: isMobile ? 0 : 30,
  });

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (previousZoomRef.current === null) {
      previousZoomRef.current = currentZoom;
      return;
    }

    if (Math.abs(currentZoom - previousZoomRef.current) > 0.0001) {
      triggerStageZooming();
      previousZoomRef.current = currentZoom;
    }
  }, [currentZoom, triggerStageZooming]);

  useEffect(() => {
    return () => {
      if (zoomHideTimeoutRef.current !== null) {
        window.clearTimeout(zoomHideTimeoutRef.current);
      }
    };
  }, []);

  // Initialize cropRatio whenever crop mode is entered (or the target image changes)
  useEffect(() => {
    if (isCropMode && selectedObject?.type === 'image') {
      const obj = selectedObject as ImageObject;
      const nw = obj.naturalWidth || 1;
      const nh = obj.naturalHeight || 1;
      if (obj.cropX != null && obj.cropY != null && obj.cropWidth && obj.cropHeight) {
        setCropRatio({ x: obj.cropX / nw, y: obj.cropY / nh, width: obj.cropWidth / nw, height: obj.cropHeight / nh });
      } else {
        setCropRatio({ x: 0, y: 0, width: 1, height: 1 });
      }
    } else {
      setCropRatio(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCropMode, selectedObject?.id]);

  const handleCropApply = useCallback(() => {
    if (!cropRatio || !selectedObject || selectedObject.type !== 'image') return;
    const obj = selectedObject as ImageObject;
    const nw = obj.naturalWidth || obj.width;
    const nh = obj.naturalHeight || obj.height;
    const cropX = Math.round(cropRatio.x * nw);
    const cropY = Math.round(cropRatio.y * nh);
    const cropWidth = Math.round(cropRatio.width * nw);
    const cropHeight = Math.round(cropRatio.height * nh);
    const prevSourceW = obj.cropWidth || nw;
    const displayScale = obj.width / prevSourceW;
    const imgDisplayW = nw * displayScale;
    const imgDisplayH = nh * displayScale;

    // Crop selection top-left in the image's LOCAL space (relative to rotation pivot obj.x,y)
    const expandOffsetX = (obj.cropX || 0) * displayScale;
    const expandOffsetY = (obj.cropY || 0) * displayScale;
    const localX = -expandOffsetX + cropRatio.x * imgDisplayW;
    const localY = -expandOffsetY + cropRatio.y * imgDisplayH;

    // Transform local offset to design space using the image's rotation
    const angle = (obj.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const newX = obj.x + localX * cos - localY * sin;
    const newY = obj.y + localX * sin + localY * cos;

    updateObject(obj.id, {
      x: newX,
      y: newY,
      cropX, cropY, cropWidth, cropHeight,
      width: Math.round(cropWidth * displayScale),
      height: Math.round(cropHeight * displayScale),
    });
    setIsCropMode(false);
  }, [cropRatio, selectedObject, updateObject, setIsCropMode]);

  const handleCropReset = useCallback(() => {
    if (!selectedObject || selectedObject.type !== 'image') return;
    const obj = selectedObject as ImageObject;
    const nw = obj.naturalWidth || obj.width;
    const nh = obj.naturalHeight || obj.height;
    const prevSourceW = obj.cropWidth || nw;
    const displayScale = obj.width / prevSourceW;

    // Full image top-left in the image's LOCAL space (relative to rotation pivot obj.x,y)
    const expandOffsetX = (obj.cropX || 0) * displayScale;
    const expandOffsetY = (obj.cropY || 0) * displayScale;

    // Transform local offset to design space using the image's rotation
    const angle = (obj.rotation || 0) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const newX = obj.x + (-expandOffsetX) * cos - (-expandOffsetY) * sin;
    const newY = obj.y + (-expandOffsetX) * sin + (-expandOffsetY) * cos;

    updateObject(selectedObject.id, {
      x: newX,
      y: newY,
      width: Math.round(nw * displayScale),
      height: Math.round(nh * displayScale),
      cropX: undefined,
      cropY: undefined,
      cropWidth: undefined,
      cropHeight: undefined,
    });
    setIsCropMode(false);
  }, [selectedObject, updateObject, setIsCropMode]);

  const handleCropCancel = useCallback(() => setIsCropMode(false), [setIsCropMode]);

  // Register crop action handlers so TopPropertiesBar can call them via context
  useEffect(() => {
    registerCropActions({ apply: handleCropApply, reset: handleCropReset, cancel: handleCropCancel });
    return () => registerCropActions(null);
  }, [registerCropActions, handleCropApply, handleCropReset, handleCropCancel]);

  // Keyboard shortcuts for crop mode
  useEffect(() => {
    if (!isCropMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleCropApply(); }
      else if (e.key === 'Escape') { e.preventDefault(); handleCropCancel(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCropMode, handleCropApply, handleCropCancel]);

  const isNodeWithinSelection = useCallback((node: Konva.Node | null) => {
    let current: Konva.Node | null = node;

    while (current) {
      const nodeName = current.name();
      if (nodeName && selectedIds.includes(nodeName)) {
        return true;
      }

      current = current.getParent() as Konva.Node | null;
    }

    return false;
  }, [selectedIds]);

  const resolveSelectableId = useCallback((id: string): string => {
    const objectMap = new Map(objects.map((object) => [object.id, object]));
    let targetId = id;
    let cursor = objectMap.get(id)?.parentId;

    while (cursor) {
      const parent = objectMap.get(cursor);
      if (!parent || parent.type !== 'group') break;
      targetId = parent.id;
      cursor = parent.parentId;
    }

    return targetId;
  }, [objects]);

  const cancelActiveObjectDrags = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const nodesToStop = new Map<string, Konva.Node>();

    if (typeof stage.isDragging === 'function' && stage.isDragging()) {
      nodesToStop.set(stage._id.toString(), stage);
    }

    selectedIds.forEach((id) => {
      const node = stage.findOne(`.${id}`);
      if (node) {
        nodesToStop.set(node._id.toString(), node);
      }
    });

    nodesToStop.forEach((node) => {
      try {
        if (typeof node.isDragging === 'function' && node.isDragging()) {
          node.stopDrag();
        }
      } catch {
        // Ignore stopDrag failures to keep pinch lock robust on mobile gesture transitions.
      }
    });
  }, [selectedIds]);

  const handleCanvasObjectDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setIsObjectDragging((prev) => (prev ? prev : true));
    handleObjectDragMove(e);
  }, [handleObjectDragMove]);

  const handleCanvasObjectDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setIsObjectDragging(false);
    handleObjectDragEnd();
  }, [handleObjectDragEnd]);

  const shouldSuppressTapSelection = useCallback(() => {
    return Date.now() < suppressTapSelectionUntilRef.current;
  }, []);

  const handleStageWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    const isModifiedZoom = e.evt.ctrlKey || e.evt.metaKey;

    if (!isModifiedZoom) {
      handleWheel(e);
      return;
    }

    e.evt.preventDefault();
    triggerStageZooming();

    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    if (safeAreaRect.width <= 0 || safeAreaRect.height <= 0 || currentZoom <= 0) {
      return;
    }

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextZoomRaw = direction > 0
      ? currentZoom * (1 + ZOOM_CONFIG.step)
      : currentZoom / (1 + ZOOM_CONFIG.step);
    const nextZoom = Math.max(ZOOM_CONFIG.min, Math.min(ZOOM_CONFIG.max, nextZoomRaw));
    const zoomRatio = nextZoom / currentZoom;

    if (!Number.isFinite(zoomRatio) || zoomRatio <= 0) return;

    const safeCenterX = safeAreaRect.x + safeAreaRect.width / 2;
    const safeCenterY = safeAreaRect.y + safeAreaRect.height / 2;

    const nextSafeWidth = safeAreaRect.width * zoomRatio;
    const nextSafeHeight = safeAreaRect.height * zoomRatio;
    const nextSafeX = safeCenterX - nextSafeWidth / 2;
    const nextSafeY = safeCenterY - nextSafeHeight / 2;

    const pointerU = (pointer.x - position.x - safeAreaRect.x) / safeAreaRect.width;
    const pointerV = (pointer.y - position.y - safeAreaRect.y) / safeAreaRect.height;

    const nextPosition = {
      x: pointer.x - (nextSafeX + pointerU * nextSafeWidth),
      y: pointer.y - (nextSafeY + pointerV * nextSafeHeight),
    };

    setZoom(nextZoom);
    setPosition(nextPosition);
  }, [
    currentZoom,
    handleWheel,
    position.x,
    position.y,
    safeAreaRect.height,
    safeAreaRect.width,
    safeAreaRect.x,
    safeAreaRect.y,
    setPosition,
    setZoom,
    triggerStageZooming,
  ]);

  const editingTextObject = React.useMemo(() => {
    if (!editingTextId) return null;
    const object = objects.find((candidate) => candidate.id === editingTextId);
    return object?.type === 'text' ? object as TextObject : null;
  }, [editingTextId, objects]);

  const editingShapeTextObject = React.useMemo(() => {
    if (!editingShapeTextId) return null;
    return objects.find((candidate) => candidate.id === editingShapeTextId) ?? null;
  }, [editingShapeTextId, objects]);

  const editingCellTable = React.useMemo(() => {
    if (!editingTableCell) return null;
    const object = objects.find((o) => o.id === editingTableCell.tableId);
    return object?.type === 'table' ? object as import('@sabi-canvas/types/canvas-objects').TableObject : null;
  }, [editingTableCell, objects]);

  const getEditingTextareaMinHeight = useCallback((textObject: TextObject) => {
    return Math.max(1, Math.ceil(textObject.fontSize * (textObject.lineHeight ?? 1.2) * dimensions.scale));
  }, [dimensions.scale]);

  const startInlineTextEdit = useCallback((id: string) => {
    const object = objects.find((candidate) => candidate.id === id);
    if (!object || object.type !== 'text') return;

    setEditingOriginalValue(object.text);
    setEditingOriginalRichText(object.richText);
    setEditingValue(object.text);
    startTextEdit(id);
  }, [objects, startTextEdit]);

  const startInlineShapeTextEdit = useCallback((id: string) => {
    const object = objects.find((candidate) => candidate.id === id);
    if (!object) return;

    const currentText = object.innerText ?? '';
    const currentRichText = (object as any).innerRichText as TextSpan[] | undefined;
    setEditingShapeTextOriginalValue(currentText);
    setEditingShapeTextOriginalRichText(currentRichText);
    setEditingShapeTextValue(currentText);
    startShapeTextEdit(id);
  }, [objects, startShapeTextEdit]);

  const commitInlineShapeTextEdit = useCallback(() => {
    if (!editingShapeTextObject) {
      stopShapeTextEdit();
      setInlineTextSelectionState(null);
      registerApplyInlineStyleFn(null);
      return;
    }

    const el = shapeContentEditableRef.current;
    let nextText = editingShapeTextValue; // fallback
    let nextRichText: TextSpan[] | undefined;

    if (el) {
      const spans = normalizeSpans(domToSpans(el));
      nextText = spansToPlainText(spans);
      nextRichText = isPlainSpans(spans) ? undefined : spans;
    }

    const updates: Partial<import('@sabi-canvas/types/canvas-objects').CanvasObject> = {
      innerText: nextText || undefined,
      innerRichText: nextRichText,
    };
    if (nextText && !editingShapeTextObject.innerTextFontSize) {
      // Set sensible defaults on first text entry
      updates.innerTextFontSize = 24;
      updates.innerTextFill = '#000000';
      updates.innerTextAlign = 'center';
      updates.innerTextVerticalAlign = 'middle';
    }
    updateObject(editingShapeTextObject.id, updates);
    stopShapeTextEdit();
    setInlineTextSelectionState(null);
    registerApplyInlineStyleFn(null);
  }, [editingShapeTextObject, editingShapeTextValue, stopShapeTextEdit, updateObject, setInlineTextSelectionState, registerApplyInlineStyleFn]);

  const cancelInlineShapeTextEdit = useCallback(() => {
    if (editingShapeTextObject) {
      updateObject(editingShapeTextObject.id, {
        innerText: editingShapeTextOriginalValue || undefined,
        innerRichText: editingShapeTextOriginalRichText,
      });
    }
    stopShapeTextEdit();
    setInlineTextSelectionState(null);
    registerApplyInlineStyleFn(null);
  }, [editingShapeTextObject, editingShapeTextOriginalValue, editingShapeTextOriginalRichText, stopShapeTextEdit, updateObject, setInlineTextSelectionState, registerApplyInlineStyleFn]);

  const startInlineCellEdit = useCallback((tableId: string, row: number, col: number) => {
    const tableObject = objects.find((o) => o.id === tableId);
    if (!tableObject || tableObject.type !== 'table') return;
    const currentText = tableObject.cells[row]?.[col]?.text ?? '';
    setEditingCellOriginalValue(currentText);
    setEditingCellValue(currentText);
    startTableCellEdit(tableId, row, col);
  }, [objects, startTableCellEdit]);

  const commitInlineCellEdit = useCallback((nextText: string) => {
    if (!editingTableCell) {
      stopTableCellEdit();
      return;
    }
    const { tableId, row, col } = editingTableCell;
    const tableObject = objects.find((o) => o.id === tableId);
    if (tableObject && tableObject.type === 'table') {
      const newCells = tableObject.cells.map((rowArr, rIdx) =>
        rowArr.map((cell, cIdx) => {
          if (rIdx === row && cIdx === col) {
            return { ...cell, text: nextText };
          }
          return cell;
        })
      );
      updateObject(tableId, { cells: newCells });
    }
    stopTableCellEdit();
  }, [editingTableCell, objects, updateObject, stopTableCellEdit]);

  const cancelInlineCellEdit = useCallback(() => {
    if (editingTableCell) {
      commitInlineCellEdit(editingCellOriginalValue);
    } else {
      stopTableCellEdit();
    }
  }, [editingTableCell, editingCellOriginalValue, commitInlineCellEdit, stopTableCellEdit]);

  const commitInlineTextEdit = useCallback((_nextText?: string) => {
    if (!editingTextObject) {
      stopTextEdit();
      setInlineTextSelectionState(null);
      registerApplyInlineStyleFn(null);
      return;
    }

    const el = contentEditableRef.current;
    let nextText = _nextText ?? editingValue;
    let nextRichText: TextSpan[] | undefined;

    if (el) {
      const spans = normalizeSpans(domToSpans(el));
      nextText = spansToPlainText(spans);
      nextRichText = isPlainSpans(spans) ? undefined : spans;
    }

    updateObject(editingTextObject.id, {
      text: nextText,
      richText: nextRichText,
    });

    stopTextEdit();
    setInlineTextSelectionState(null);
    registerApplyInlineStyleFn(null);
  }, [editingTextObject, editingValue, stopTextEdit, updateObject, setInlineTextSelectionState, registerApplyInlineStyleFn]);

  const cancelInlineTextEdit = useCallback(() => {
    if (editingTextObject) {
      updateObject(editingTextObject.id, {
        text: editingOriginalValue,
        richText: editingOriginalRichText,
      });
    }
    stopTextEdit();
    setInlineTextSelectionState(null);
    registerApplyInlineStyleFn(null);
  }, [editingOriginalValue, editingOriginalRichText, editingTextObject, stopTextEdit, updateObject, setInlineTextSelectionState, registerApplyInlineStyleFn]);

  // Initialize the contentEditable div when editing starts
  useEffect(() => {
    if (!editingTextObject) return;

    selectObjects([editingTextObject.id], false);

    const el = contentEditableRef.current;
    if (!el) return;

    // Populate initial HTML from richText or plain text
    const initialHtml = editingTextObject.richText && editingTextObject.richText.length > 0
      ? spansToHtml(editingTextObject.richText)
      : editingTextObject.text.replace(/\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/&lt;br&gt;/g, '<br>'); // crude but needed after escaping

    // Re-escape: simpler direct approach
    const safeHtml = editingTextObject.richText && editingTextObject.richText.length > 0
      ? spansToHtml(editingTextObject.richText)
      : editingTextObject.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
    void initialHtml; // discard first attempt
    el.innerHTML = safeHtml;

    el.focus();

    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    // Register inline style applier
    const applyFn = (cmd: string, value?: string) => {
      // Capture the range BEFORE focus — el.focus() may fire selectionchange
      // synchronously and overwrite savedSelectionRef.current before we can use it.
      const rangeToRestore = savedSelectionRef.current;
      el.focus();
      const sel = window.getSelection();
      if (sel && rangeToRestore) {
        try {
          sel.removeAllRanges();
          sel.addRange(rangeToRestore);
        } catch {
          // Range may be temporarily invalid; execCommand will apply to current position
        }
      }

      if (cmd === 'listStyle') {
        // Apply list-style toggling to the entire contentEditable content and
        // persist both the DOM update and the object's listStyle/text/richText.
        const nextListStyle = (value || 'none') as 'none' | 'disc' | 'ordered';
        const currentSpans = normalizeSpans(domToSpans(el));
        const nextSpans = nextListStyle === 'none'
          ? stripListStyleFromSpans(currentSpans)
          : applyListStyleToSpans(currentSpans, nextListStyle);
        el.innerHTML = spansToHtml(nextSpans);
        // Move cursor to end
        const endRange = document.createRange();
        endRange.selectNodeContents(el);
        endRange.collapse(false);
        const endSel = window.getSelection();
        endSel?.removeAllRanges();
        endSel?.addRange(endRange);
        savedSelectionRef.current = endRange.cloneRange();
        // Persist changes to the object
        const nextText = spansToPlainText(nextSpans);
        const nextRichText = isPlainSpans(nextSpans) ? undefined : nextSpans;
        updateObject(editingTextObject.id, {
          listStyle: nextListStyle,
          text: nextText,
          richText: nextRichText,
        });
        return;
      }

      if (cmd === 'fontFamily') {
        // Use CSS-based wrapping so walkNode can extract font-family from inline styles
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('fontName', false, value);
        document.execCommand('styleWithCSS', false, 'false');
      } else {
        document.execCommand(cmd, false, value);
      }
      // Update selection state after applying
      requestAnimationFrame(() => {
        setInlineTextSelectionState({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikethrough: document.queryCommandState('strikeThrough'),
          color: document.queryCommandValue('foreColor') || null,
        });
      });
    };
    registerApplyInlineStyleFn(applyFn);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTextObject?.id]);

  // Listen for selection changes while text editing is active
  useEffect(() => {
    if (!editingTextObject) return;

    const handleSelectionChange = () => {
      const el = contentEditableRef.current;
      if (!el) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      if (!el.contains(selection.anchorNode)) return;

      // Save the range for restoring after toolbar interactions
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();

      setInlineTextSelectionState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        color: document.queryCommandValue('foreColor') || null,
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editingTextObject, setInlineTextSelectionState]);

  useEffect(() => {
    if (!editingTextObject) return;
    loadFontFamily(editingTextObject.fontFamily, { timeoutMs: 2400 });
  }, [editingTextObject]);

  // Listen for selection changes while shape text editing is active
  useEffect(() => {
    if (!editingShapeTextObject) return;

    const handleSelectionChange = () => {
      const el = shapeContentEditableRef.current;
      if (!el) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      if (!el.contains(selection.anchorNode)) return;

      shapeSavedSelectionRef.current = selection.getRangeAt(0).cloneRange();

      setInlineTextSelectionState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikethrough: document.queryCommandState('strikeThrough'),
        color: document.queryCommandValue('foreColor') || null,
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [editingShapeTextObject, setInlineTextSelectionState]);

  useEffect(() => {
    if (!editingShapeTextObject) return;

    selectObjects([editingShapeTextObject.id], false);

    const el = shapeContentEditableRef.current;
    if (!el) return;

    // Populate initial HTML from innerRichText or plain text
    const richText = (editingShapeTextObject as any).innerRichText as TextSpan[] | undefined;
    const safeHtml = richText && richText.length > 0
      ? spansToHtml(richText)
      : (editingShapeTextObject.innerText ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
    el.innerHTML = safeHtml;

    el.focus();

    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    // Register inline style applier
    const applyFn = (cmd: string, value?: string) => {
      // Capture the range BEFORE focus — el.focus() may fire selectionchange
      // synchronously and overwrite shapeSavedSelectionRef.current before we can use it.
      const rangeToRestore = shapeSavedSelectionRef.current;
      el.focus();
      const sel = window.getSelection();
      if (sel && rangeToRestore) {
        try {
          sel.removeAllRanges();
          sel.addRange(rangeToRestore);
        } catch {
          // Range may be temporarily invalid
        }
      }

      if (cmd === 'listStyle') {
        const nextListStyle = (value || 'none') as 'none' | 'disc' | 'ordered';
        const currentSpans = normalizeSpans(domToSpans(el));
        const nextSpans = nextListStyle === 'none'
          ? stripListStyleFromSpans(currentSpans)
          : applyListStyleToSpans(currentSpans, nextListStyle);
        el.innerHTML = spansToHtml(nextSpans);
        // Move cursor to end
        const endRange = document.createRange();
        endRange.selectNodeContents(el);
        endRange.collapse(false);
        const endSel = window.getSelection();
        endSel?.removeAllRanges();
        endSel?.addRange(endRange);
        shapeSavedSelectionRef.current = endRange.cloneRange();
        // Persist changes
        const nextText = spansToPlainText(nextSpans);
        const nextRichText = isPlainSpans(nextSpans) ? undefined : nextSpans;
        updateObject(editingShapeTextObject.id, {
          innerTextListStyle: nextListStyle,
          innerText: nextText || undefined,
          innerRichText: nextRichText,
        });
        return;
      }

      if (cmd === 'fontFamily') {
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('fontName', false, value);
        document.execCommand('styleWithCSS', false, 'false');
      } else {
        document.execCommand(cmd, false, value);
      }
      requestAnimationFrame(() => {
        setInlineTextSelectionState({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          strikethrough: document.queryCommandState('strikeThrough'),
          color: document.queryCommandValue('foreColor') || null,
        });
      });
    };
    registerApplyInlineStyleFn(applyFn);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingShapeTextObject?.id]);

  useEffect(() => {
    if (!editingTableCell || !editingCellTable) return;
    const textarea = cellTextareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [editingTableCell, editingCellTable]);

  // Sync external zoom changes
  useEffect(() => {
    if (externalZoom !== undefined && externalZoom !== internalZoom) {
      setZoom(externalZoom);
    }
  }, [externalZoom, internalZoom, setZoom]);

  // Notify when stage is ready
  useEffect(() => {
    if (stageRef.current && onStageReady) {
      onStageReady(stageRef.current);
    }
  }, [onStageReady]);

  // Expose stage ref
  useEffect(() => {
    if (stageRef.current && onStageRefReady) {
      onStageRefReady(stageRef);
    }
  }, [onStageRefReady]);

  // Prevent default touch behaviors on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefaults = (e: TouchEvent) => {
      // Allow default for single touch (for scrolling outside canvas)
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventDefaults, { passive: false });
    container.addEventListener('gesturestart', (e) => e.preventDefault());
    container.addEventListener('gesturechange', (e) => e.preventDefault());

    return () => {
      container.removeEventListener('touchmove', preventDefaults);
    };
  }, []);

  // Handle stage drag (for panning)
  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const nativeEvent = e.evt as MouseEvent | TouchEvent | undefined;
    const isModifiedPan = Boolean((nativeEvent as MouseEvent | undefined)?.ctrlKey || (nativeEvent as MouseEvent | undefined)?.metaKey);

    if (mode === 'pan' || isModifiedPan) {
      setPosition({ x: e.target.x(), y: e.target.y() });
    }
    setIsTouchStagePanning(false);
    handleDragEnd();
  }, [mode, setPosition, handleDragEnd]);

  // Determine if stage should be draggable
  const isDraggable = (mode === 'pan' || isDragging) && !editingTextId && !editingShapeTextId && !editingTableCell && !isDrawing;

  // Multi-select handlers
  const selectionRectRef = useRef<Konva.Rect>(null);

  const handlePointerDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (editingTextId) {
      commitInlineTextEdit();
    }

    if (editingShapeTextId) {
      commitInlineShapeTextEdit();
    }

    if (editingTableCell) {
      commitInlineCellEdit(editingCellValue);
    }

    // Close any open sidebar panels or tool panels when clicking on the stage
    setActiveSidebarPanel(null);
    setActiveToolPanel(null);

    // Route two-finger touch input exclusively to viewport pan/zoom.
    if (e.type === 'touchstart' && interactive && handleTouchStart) {
      const touchEvent = e.evt as TouchEvent;
      if (touchEvent.touches.length >= 2) {
        cancelActiveObjectDrags();
        setIsObjectDragging(false);
        setIsTouchStagePanning(false);
        setIsTouchGestureLocked(true);
        setSelectionRect(prev => ({ ...prev, visible: false }));
        singleTouchStagePanRef.current = { active: false, moved: false, startPoint: null, lastPoint: null };
        handleTouchStart(e as Konva.KonvaEventObject<TouchEvent>);
        return;
      }

      if (isTouchGestureLocked) {
        return;
      }

      if (isMobile && mode === 'select' && touchEvent.touches.length === 1) {
        const touch = touchEvent.touches[0];
        const startedOnSelectedObject = isNodeWithinSelection(e.target as Konva.Node);

        if (!startedOnSelectedObject) {
          setIsTouchStagePanning(false);
          singleTouchStagePanRef.current = {
            active: true,
            moved: false,
            startPoint: { x: touch.clientX, y: touch.clientY },
            lastPoint: { x: touch.clientX, y: touch.clientY },
          };
          setSelectionRect(prev => ({ ...prev, visible: false }));
          return;
        }

        singleTouchStagePanRef.current = { active: false, moved: false, startPoint: null, lastPoint: null };
      }

      handleTouchStart(e as Konva.KonvaEventObject<TouchEvent>);
    }

    if (mode !== 'select' && mode !== 'draw') return;

    // Draw mode: start recording a stroke
    if (mode === 'draw') {
      // Only allow left click / single touch
      if (e.evt instanceof MouseEvent && e.evt.button !== 0) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      // Convert stage coordinates to canvas coordinates
      const cx = (pos.x - safeAreaRect.x) / dimensions.scale;
      const cy = (pos.y - safeAreaRect.y) / dimensions.scale;
      isDrawingRef.current = true;
      liveDrawPointsRef.current = [cx, cy];
      setIsDrawing(true);
      setLiveDrawPoints([cx, cy]);
      deselectAll();
      return;
    }

    // Only allow left click for selection
    if (e.evt instanceof MouseEvent && e.evt.button !== 0) return;

    const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'safe-area' || e.target.name() === 'safe-area-overlay';
    if (!clickedOnEmpty) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    setSelectionRect({
      visible: true,
      startX: pos.x,
      startY: pos.y,
      currentX: pos.x,
      currentY: pos.y,
    });
  }, [editingTextId, editingValue, commitInlineTextEdit, editingShapeTextId, commitInlineShapeTextEdit, mode, interactive, handleTouchStart, isTouchGestureLocked, isMobile, isNodeWithinSelection, cancelActiveObjectDrags, safeAreaRect, dimensions, deselectAll]);

  const handlePointerMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (editingTextId) return; // move events are fine to skip — the pointerDown already committed the edit

    // While locked, only pinch/pan viewport and skip object/selection interactions.
    if (e.type === 'touchmove' && interactive && handleTouchMove) {
      if (isTouchGestureLocked) {
        handleTouchMove(e as Konva.KonvaEventObject<TouchEvent>);
        return;
      }

      const touchEvent = e.evt as TouchEvent;
      if (isMobile && mode === 'select' && singleTouchStagePanRef.current.active && touchEvent.touches.length === 1) {
        const touch = touchEvent.touches[0];
        const lastPoint = singleTouchStagePanRef.current.lastPoint;
        const startPoint = singleTouchStagePanRef.current.startPoint;

        if (lastPoint && startPoint) {
          const dx = touch.clientX - lastPoint.x;
          const dy = touch.clientY - lastPoint.y;

          if (!singleTouchStagePanRef.current.moved) {
            const totalDx = touch.clientX - startPoint.x;
            const totalDy = touch.clientY - startPoint.y;
            const totalDistance = Math.hypot(totalDx, totalDy);

            if (totalDistance >= MOBILE_STAGE_PAN_TOUCH_SLOP) {
              singleTouchStagePanRef.current.moved = true;
              setIsTouchStagePanning(true);
              suppressTapSelectionUntilRef.current = Date.now() + 260;
            }
          }

          if (singleTouchStagePanRef.current.moved) {
            touchEvent.preventDefault();
            singleTouchStagePanRef.current.moved = true;
            const nextPosition = {
              x: positionRef.current.x + dx,
              y: positionRef.current.y + dy,
            };

            positionRef.current = nextPosition;
            setPosition(nextPosition);
          }
        }

        singleTouchStagePanRef.current.lastPoint = {
          x: touch.clientX,
          y: touch.clientY,
        };
        return;
      }

      handleTouchMove(e as Konva.KonvaEventObject<TouchEvent>);
    }

    // Draw mode: append points to live stroke
    if (mode === 'draw' && isDrawingRef.current) {
      const stage = e.target.getStage();
      if (!stage) return;
      const pos = stage.getRelativePointerPosition();
      if (!pos) return;
      const cx = (pos.x - safeAreaRect.x) / dimensions.scale;
      const cy = (pos.y - safeAreaRect.y) / dimensions.scale;
      liveDrawPointsRef.current = [...liveDrawPointsRef.current, cx, cy];
      setLiveDrawPoints([...liveDrawPointsRef.current]);
      return;
    }

    if (!selectionRect.visible) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    setSelectionRect(prev => ({
      ...prev,
      currentX: pos.x,
      currentY: pos.y,
    }));
  }, [editingTextId, selectionRect.visible, interactive, handleTouchMove, isTouchGestureLocked, isMobile, mode, setPosition, safeAreaRect, dimensions]);

  const handlePointerUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (editingTextId) return; // up events are fine to skip — the pointerDown already committed the edit

    // Keep gesture lock active until all fingers are lifted.
    if ((e.type === 'touchend' || e.type === 'touchcancel') && interactive && handleTouchEnd) {
      const touchEvent = e.evt as TouchEvent;
      // touchcancel clears the touches list — treat as zero remaining fingers
      const remainingTouches = e.type === 'touchcancel' ? 0 : touchEvent.touches.length;
      const wasSingleTouchStagePanActive = singleTouchStagePanRef.current.active;
      const didSingleTouchStagePanMove = singleTouchStagePanRef.current.moved;

      if (remainingTouches < 2) {
        handleTouchEnd();
      }

      if (wasSingleTouchStagePanActive && didSingleTouchStagePanMove) {
        suppressTapSelectionUntilRef.current = Date.now() + 260;
      }

      if (remainingTouches === 0) {
        setIsTouchGestureLocked(false);
        setIsTouchStagePanning(false);
        setIsObjectDragging(false);
        singleTouchStagePanRef.current = { active: false, moved: false, startPoint: null, lastPoint: null };
      }

      if (wasSingleTouchStagePanActive) {
        return;
      }

      if (isTouchGestureLocked) {
        setSelectionRect(prev => ({ ...prev, visible: false }));
        return;
      }
    }

    // Draw mode: finalize and save the stroke
    if (mode === 'draw' && isDrawingRef.current) {
      isDrawingRef.current = false;
      setIsDrawing(false);
      const pts = liveDrawPointsRef.current;
      liveDrawPointsRef.current = [];
      setLiveDrawPoints([]);
      // Need at least 2 points (4 values) to make a visible stroke
      if (pts.length >= 4) {
        const isHighlighter = drawTool === 'highlighter';
        const drawObj = createDrawObject(pts, {
          stroke: drawColor,
          strokeWidth: drawSize,
          lineCap: isHighlighter ? 'square' : 'round',
          lineJoin: isHighlighter ? 'miter' : 'round',
          tension: drawTension,
          opacity: isHighlighter ? 0.45 : 1,
          drawTool: drawTool,
        });
        addObject(drawObj);
      }
      return;
    }

    if (!selectionRect.visible) return;

    const stage = e.target.getStage();
    if (!stage) return;

    // Use the absolute current pointer position instead of relying on state which might be delayed
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;

    // The selection rect in Stage's relative coordinates
    const sx = Math.min(selectionRect.startX, pos.x);
    const sy = Math.min(selectionRect.startY, pos.y);
    const ex = Math.max(selectionRect.startX, pos.x);
    const ey = Math.max(selectionRect.startY, pos.y);

    // Transform to absolute window coordinates so we can compare with getClientRect
    const transform = stage.getAbsoluteTransform();
    const p1 = transform.point({ x: sx, y: sy });
    const p2 = transform.point({ x: ex, y: ey });

    const box = {
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      width: Math.abs(p2.x - p1.x),
      height: Math.abs(p2.y - p1.y),
    };

    const selectedObjIds: string[] = [];

    objects.forEach(obj => {
      // In customer mode, mockup objects are not selectable via rubber-band
      if (isMockupEnabled && editorMode === 'customer' && obj.objectRole !== 'customer') return;

      const node = stage.findOne(`.${obj.id}`);
      if (node) {
        const nodeBox = node.getClientRect();
        if (Konva.Util.haveIntersection(box, nodeBox)) {
          selectedObjIds.push(resolveSelectableId(obj.id));
        }
      }
    });

    const isShiftKey = (e.evt as MouseEvent).shiftKey || false;

    if (selectedObjIds.length > 0) {
      selectObjects(Array.from(new Set(selectedObjIds)), isShiftKey);
    } else {
      // If we clicked/dragged on empty space with shift, don't clear the current selection
      if (!isShiftKey) {
        deselectAll();
      }
    }

    setSelectionRect(prev => ({ ...prev, visible: false }));
  }, [editingTextId, selectionRect.startX, selectionRect.startY, selectionRect.visible, objects, selectObjects, deselectAll, interactive, handleTouchEnd, isTouchGestureLocked, resolveSelectableId, mode, drawColor, drawSize, drawTension, drawTool, addObject, safeAreaRect, dimensions, editorMode, isMockupEnabled]);

  const handleContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const clickedOnEmpty = e.target === stage || e.target.name() === 'safe-area' || e.target.name() === 'safe-area-overlay';
    if (clickedOnEmpty) return;

    const nodeName = e.target.name() || e.target.id();
    if (!nodeName) return;

    // In customer mode, mockup objects cannot be selected
    const clickedObj = objects.find(o => o.id === nodeName);
    if (isMockupEnabled && editorMode === 'customer' && clickedObj && clickedObj.objectRole !== 'customer') return;

    const selectableId = resolveSelectableId(nodeName);
    if (selectableId && !selectedIds.includes(selectableId)) {
      selectObjects([selectableId], false);
    }
  }, [editorMode, isMockupEnabled, objects, resolveSelectableId, selectedIds, selectObjects]);

  const shouldHideContextualToolbar = isDragging || isObjectDragging || isTouchStagePanning || isStageZooming;

  return (
    <CanvasContextMenu>
      <div
        ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden',
        'bg-canvas-bg touch-none',
        isDragging && 'cursor-grabbing',
        mode === 'pan' && !isDragging && 'cursor-grab',
        mode === 'draw' && 'cursor-crosshair',
        className
      )}
      style={{
        // Prevent iOS overscroll
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'auto',
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={1}
          scaleY={1}
          x={position.x}
          y={position.y}
          draggable={isDraggable && interactive && !selectionRect.visible}
          onWheel={interactive ? handleStageWheel : undefined}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
          onDragStart={handleDragStart}
          onDragEnd={handleStageDragEnd}
          onContextMenu={handleContextMenu}
          style={{
            touchAction: 'none',
          }}
        >
          {/* Content Layer - Safe Area, Objects, and legacy children */}
          <Layer>
            {/* Safe Area - Grid and Border */}
            {showSafeArea && (
              <SafeArea
                x={safeAreaRect.x}
                y={safeAreaRect.y}
                width={safeAreaRect.width}
                height={safeAreaRect.height}
                showBorder={true}
                showGrid={showGrid && config.showGrid}
                gridSize={config.gridSize * dimensions.scale * (isMobile ? 2 : 1)}
                fillColor={config.safeAreaColor}
                borderColor="hsl(217, 91%, 60%)"
                background={activePage.background}
              />
            )}

            {/* Canvas Objects - Main user content */}
            <CanvasObjects
              stageRef={stageRef}
              scale={dimensions.scale}
              offsetX={safeAreaRect.x}
              offsetY={safeAreaRect.y}
              clipWidth={config.designWidth}
              clipHeight={config.designHeight}
              mode={mode}
              cropTargetId={isCropMode && selectedObject?.type === 'image' ? selectedObject.id : undefined}
              onDragMove={handleCanvasObjectDragMove}
              onDragEnd={handleCanvasObjectDragEnd}
              onHover={setHoveredId}
              onImageDoubleClick={(id) => {
                const obj = objects.find(o => o.id === id);
                if (obj?.type === 'image' && !isSvgSrc((obj as ImageObject).src ?? '')) {
                  setIsCropMode(true);
                }
              }}
              editingTextId={editingTextId}
              editingShapeTextId={editingShapeTextId}
              editingTableCell={editingTableCell}
              onTextEditRequest={startInlineTextEdit}
              onShapeTextEditRequest={startInlineShapeTextEdit}
              onCellTextEditRequest={startInlineCellEdit}
              onCellSelection={(tableId, cells) => setSelectedTableCells(cells.map((c) => ({ tableId, ...c })))}
              onObjectSelect={() => {
                if (editingTextId) {
                  commitInlineTextEdit();
                }
                if (editingShapeTextId) {
                  commitInlineShapeTextEdit();
                }
                if (editingTableCell) {
                  commitInlineCellEdit(editingCellValue);
                }
              }}
              isInteractionLocked={isTouchGestureLocked}
              dragSelectedOnly={isMobile && mode === 'select'}
              shouldSuppressTapSelection={shouldSuppressTapSelection}
            />

            {/* Legacy children - for backward compatibility */}
            {children && (
              <Group
                x={safeAreaRect.x}
                y={safeAreaRect.y}
                scaleX={dimensions.scale}
                scaleY={dimensions.scale}
              >
                {children}
              </Group>
            )}

            {/* Live draw preview */}
            {isDrawing && liveDrawPoints.length >= 4 && (
              <Group
                x={safeAreaRect.x}
                y={safeAreaRect.y}
                scaleX={dimensions.scale}
                scaleY={dimensions.scale}
                listening={false}
              >
                <Line
                  points={liveDrawPoints}
                  stroke={drawColor}
                  strokeWidth={drawSize}
                  lineCap={drawTool === 'highlighter' ? 'square' : 'round'}
                  lineJoin={drawTool === 'highlighter' ? 'miter' : 'round'}
                  tension={drawTension}
                  opacity={drawTool === 'highlighter' ? 0.45 : 1}
                  globalCompositeOperation="source-over"
                  perfectDrawEnabled={false}
                />
              </Group>
            )}
          </Layer>

          <Layer>
            {/* Alignment Guides */}
            <Group x={safeAreaRect.x} y={safeAreaRect.y} scaleX={dimensions.scale} scaleY={dimensions.scale} listening={false}>
              <AlignmentGuides lines={editingTextId ? [] : alignmentLines} />
            </Group>

            {/* Selection Rectangle */}
            {selectionRect.visible && (
              <Rect
                ref={selectionRectRef}
                fill="rgba(45,110,255,0.2)"
                stroke="rgba(45,110,255,0.8)"
                strokeWidth={1}
                x={Math.min(selectionRect.startX, selectionRect.currentX)}
                y={Math.min(selectionRect.startY, selectionRect.currentY)}
                width={Math.abs(selectionRect.currentX - selectionRect.startX)}
                height={Math.abs(selectionRect.currentY - selectionRect.startY)}
                listening={false}
              />
            )}

            {/* Overlay - dims everything outside the safe area */}
            {showSafeArea && (
              <SafeAreaOverlay
                stageWidth={dimensions.width}
                stageHeight={dimensions.height}
                safeAreaX={safeAreaRect.x}
                safeAreaY={safeAreaRect.y}
                safeAreaWidth={safeAreaRect.width}
                safeAreaHeight={safeAreaRect.height}
                overlayColor={resolvedTheme === 'dark' ? "rgba(0, 0, 0, 0.95)" : "rgba(227, 228, 234, 0.96)"}
              />
            )}

            {/* Transformer - Must be interactive */}
            {mode !== 'pan' && !isTouchGestureLocked && (
              <CanvasTransformer
                selectedIds={selectedIds}
                objects={objects}
                stageRef={stageRef}
                onTransformEnd={updateObject}
                locked={selectedObject?.locked || false}
                isMobile={isMobile}
                viewportScale={dimensions.scale}
              />
            )}

            {/* Hover Transformer - non-interactive, just visual */}
            {mode !== 'pan' && !editingTextId && !isTouchGestureLocked && hoveredId && !selectedIds.includes(hoveredId) && (
              <CanvasTransformer
                selectedIds={[hoveredId]}
                objects={objects}
                stageRef={stageRef}
                isHover={true}
                locked={true}
                isMobile={isMobile}
                viewportScale={dimensions.scale}
              />
            )}
          </Layer>

          {/* Crop overlay — rendered as a Konva Layer so it lives inside the canvas */}
          {isCropMode && selectedObject?.type === 'image' && cropRatio && (
            <KonvaCropOverlay
              object={selectedObject as ImageObject}
              safeAreaRect={safeAreaRect}
              scale={dimensions.scale}
              stageRef={stageRef}
              cropRatio={cropRatio}
              onCropRatioChange={setCropRatio}
              onApply={handleCropApply}
            />
          )}
        </Stage>
      )}

      {/* Drag-drop overlay */}
      {isDropActive && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none z-50">
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm font-medium text-primary">Drop images or SVGs here</div>
            <div className="text-xs text-muted-foreground">to add them to your canvas</div>
          </div>
        </div>
      )}

      {/* Canvas info overlay */}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-card/90 backdrop-blur-sm border border-panel-border shadow-sm pointer-events-none">
        <span className="text-xs font-mono text-muted-foreground">
          {config.designWidth} × {config.designHeight}px
        </span>
      </div>

      {/* Contextual Toolbar for selected object */}
      {mode === 'select' && !shouldHideContextualToolbar && !isCropMode && (
        <ContextualToolbar
          stageRef={stageRef}
          containerRef={containerRef}
          selectedObject={selectedObject}
          safeAreaRect={safeAreaRect}
          designSize={{ width: config.designWidth, height: config.designHeight }}
          onTextEdit={startInlineTextEdit}
          onCropModeToggle={() => {
            if (selectedObject?.type === 'image') {
              setIsCropMode(!isCropMode);
            }
          }}
        />
      )}

      {editingTextObject && (
        <div
          ref={contentEditableRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => {
            const el = event.currentTarget;
            const rect = el.getBoundingClientRect();
            const nextObjectHeight = rect.height / dimensions.scale;
            if (Math.abs(nextObjectHeight - editingTextObject.height) > 0.5) {
              // Parse current spans for plain text sync
              const spans = normalizeSpans(domToSpans(el));
              const plainText = spansToPlainText(spans);
              const nextRichText = isPlainSpans(spans) ? undefined : spans;
              updateObject(editingTextObject.id, {
                text: plainText,
                richText: nextRichText,
                height: nextObjectHeight,
              });
            }
          }}
          onFocus={() => {
            if (contentBlurTimeoutRef.current !== null) {
              clearTimeout(contentBlurTimeoutRef.current);
              contentBlurTimeoutRef.current = null;
            }
          }}
          onBlur={(e) => {
            const target = e.relatedTarget as HTMLElement | null;
            if (target) {
              const bar = document.getElementById('top-properties-bar');
              if (bar?.contains(target)) return;
              // Radix popovers render in a portal; the popper content wrapper is identifiable
              if (target.closest?.('[data-radix-popper-content-wrapper]')) return;
            } else {
              // null relatedTarget: likely a Radix portal opening — defer to let focus settle
              contentBlurTimeoutRef.current = window.setTimeout(() => {
                contentBlurTimeoutRef.current = null;
                commitInlineTextEdit();
              }, 200);
              return;
            }
            commitInlineTextEdit();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelInlineTextEdit();
            }

            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              commitInlineTextEdit();
            }

            if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
              const listStyle = (editingTextObject as any).listStyle || 'none';
              if (listStyle !== 'none') {
                event.preventDefault();
                const el = event.currentTarget;
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0);
                  const preRange = document.createRange();
                  preRange.setStart(el, 0);
                  try { preRange.setEnd(range.startContainer, range.startOffset); } catch {}
                  const preText = preRange.toString();
                  const linesBefore = (preText.match(/\n/g) || []).length + 1;
                  const prefix = getListContinuationPrefix(listStyle, linesBefore);
                  const safePrefix = prefix.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                  document.execCommand('insertHTML', false, `<br>${safePrefix}`);
                }
              }
            }
          }}
          data-disable-shortcuts="true"
          style={{
            position: 'absolute',
            left: position.x + safeAreaRect.x + (editingTextObject.x * dimensions.scale),
            top: position.y + safeAreaRect.y + (editingTextObject.y * dimensions.scale),
            width: Math.max(40, editingTextObject.width * dimensions.scale),
            minHeight: getEditingTextareaMinHeight(editingTextObject),
            fontSize: editingTextObject.fontSize * dimensions.scale,
            fontFamily: getFontFallbackStack(editingTextObject.fontFamily),
            fontStyle: editingTextObject.fontStyle.includes('italic') ? 'italic' : 'normal',
            fontWeight: editingTextObject.fontStyle.includes('bold') ? 700 : 400,
            lineHeight: String(editingTextObject.lineHeight ?? 1.2),
            letterSpacing: `${(editingTextObject.letterSpacing ?? 0) * dimensions.scale}px`,
            textDecoration:
              editingTextObject.textDecoration === 'line-through'
                ? 'line-through'
                : editingTextObject.textDecoration === 'underline'
                  ? 'underline'
                  : editingTextObject.textDecoration === 'underline line-through'
                    ? 'underline line-through'
                    : 'none',
            color: editingTextObject.fill,
            textAlign: editingTextObject.align,
            opacity: editingTextObject.opacity,
            border: 'none',
            outline: 'none',
            overflow: 'visible',
            background: 'transparent',
            transform: `rotate(${editingTextObject.rotation}deg)`,
            transformOrigin: 'top left',
            padding: 0,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            cursor: 'text',
            userSelect: 'text',
            caretColor: editingTextObject.fill,
          }}
        />
      )}

      {editingShapeTextObject && (() => {
        const shapeObj = editingShapeTextObject;
        const fontSize = shapeObj.innerTextFontSize ?? 24;
        const fontFamily = getFontFallbackStack(shapeObj.innerTextFontFamily ?? 'Inter');
        const fontStyleStr = shapeObj.innerTextFontStyle ?? 'normal';
        const textColor = shapeObj.innerTextFill ?? '#000000';
        const textAlign = (shapeObj.innerTextAlign ?? 'center') as React.CSSProperties['textAlign'];
        const verticalAlign = shapeObj.innerTextVerticalAlign ?? 'middle';
        const lineHeight = shapeObj.innerTextLineHeight ?? 1.2;
        const letterSpacing = shapeObj.innerTextLetterSpacing ?? 0;
        const textDecoration = shapeObj.innerTextDecoration ?? 'none';
        const flexJustify = verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start';

        // Compute position using Konva node absolute transform for pixel-perfect positioning
        let domLeft = position.x + safeAreaRect.x + shapeObj.x * dimensions.scale;
        let domTop = position.y + safeAreaRect.y + shapeObj.y * dimensions.scale;
        let pixelWidth = shapeObj.width * dimensions.scale;
        let pixelHeight = shapeObj.height * dimensions.scale;

        const shapeNode = stageRef.current?.findOne<Konva.Group>('.' + shapeObj.id);
        if (shapeNode) {
          const absTransform = shapeNode.getAbsoluteTransform();
          const absScale = shapeNode.getAbsoluteScale();

          // For center-origin shapes, the group position IS the center
          let localOriginX = 0;
          let localOriginY = 0;

          if (shapeObj.type === 'circle') {
            const radius = Math.min(shapeObj.width, shapeObj.height) / 2;
            localOriginX = -radius;
            localOriginY = -radius;
          } else if (shapeObj.type === 'ellipse') {
            localOriginX = -(shapeObj as import('@sabi-canvas/types/canvas-objects').EllipseObject).radiusX;
            localOriginY = -(shapeObj as import('@sabi-canvas/types/canvas-objects').EllipseObject).radiusY;
          } else if (shapeObj.type === 'triangle' || shapeObj.type === 'polygon' || shapeObj.type === 'star') {
            localOriginX = -shapeObj.width / 2;
            localOriginY = -shapeObj.height / 2;
          }

          const stagePos = absTransform.point({ x: localOriginX, y: localOriginY });
          domLeft = stagePos.x;
          domTop = stagePos.y;
          pixelWidth = shapeObj.width * absScale.x;
          pixelHeight = shapeObj.height * absScale.y;
        }

        const scaledFontSize = fontSize * (shapeNode ? shapeNode.getAbsoluteScale().x / dimensions.scale : 1) * dimensions.scale;
        const scaledPadding = (shapeObj.innerTextPadding ?? 10) * (shapeNode ? shapeNode.getAbsoluteScale().x : 1);
        const scaledLetterSpacing = letterSpacing * dimensions.scale;

        return (
          <div
            style={{
              position: 'absolute',
              left: domLeft,
              top: domTop,
              width: pixelWidth,
              height: pixelHeight,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: flexJustify,
              alignItems: 'stretch',
              border: '2px solid #3b82f6',
              borderRadius: 4,
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              transform: `rotate(${shapeObj.rotation}deg)`,
              transformOrigin: 'top left',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
          >
            <div
              ref={shapeContentEditableRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => {
                const el = event.currentTarget;
                const spans = normalizeSpans(domToSpans(el));
                const nextText = spansToPlainText(spans);
                const nextRichText = isPlainSpans(spans) ? undefined : spans;
                setEditingShapeTextValue(nextText);
                updateObject(shapeObj.id, {
                  innerText: nextText || undefined,
                  innerRichText: nextRichText,
                });
              }}
              onFocus={() => {
                if (shapeBlurTimeoutRef.current !== null) {
                  clearTimeout(shapeBlurTimeoutRef.current);
                  shapeBlurTimeoutRef.current = null;
                }
              }}
              onBlur={(e) => {
                const target = e.relatedTarget as HTMLElement | null;
                if (target) {
                  const bar = document.getElementById('top-properties-bar');
                  if (bar?.contains(target)) return;
                  if (target.closest?.('[data-radix-popper-content-wrapper]')) return;
                } else {
                  shapeBlurTimeoutRef.current = window.setTimeout(() => {
                    shapeBlurTimeoutRef.current = null;
                    commitInlineShapeTextEdit();
                  }, 200);
                  return;
                }
                commitInlineShapeTextEdit();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelInlineShapeTextEdit();
                }

                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  commitInlineShapeTextEdit();
                }

                if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                  const listStyle = (shapeObj as any).innerTextListStyle || 'none';
                  if (listStyle !== 'none') {
                    event.preventDefault();
                    const el = event.currentTarget;
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      const preRange = document.createRange();
                      preRange.setStart(el, 0);
                      try { preRange.setEnd(range.startContainer, range.startOffset); } catch {}
                      const preText = preRange.toString();
                      const linesBefore = (preText.match(/\n/g) || []).length + 1;
                      const prefix = getListContinuationPrefix(listStyle, linesBefore);
                      const safePrefix = prefix.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                      document.execCommand('insertHTML', false, `<br>${safePrefix}`);
                    }
                  }
                }
              }}
              data-disable-shortcuts="true"
              style={{
                width: '100%',
                minHeight: scaledFontSize * lineHeight,
                fontSize: scaledFontSize,
                fontFamily,
                fontStyle: fontStyleStr.includes('italic') ? 'italic' : 'normal',
                fontWeight: fontStyleStr.includes('bold') ? 700 : 400,
                lineHeight: String(lineHeight),
                letterSpacing: `${scaledLetterSpacing}px`,
                textDecoration:
                  textDecoration === 'line-through'
                    ? 'line-through'
                    : textDecoration === 'underline'
                      ? 'underline'
                      : textDecoration === 'underline line-through'
                        ? 'underline line-through'
                        : 'none',
                color: textColor,
                caretColor: textColor,
                textAlign,
                padding: `${scaledPadding}px`,
                border: 'none',
                outline: 'none',
                overflow: 'visible',
                background: 'transparent',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                boxSizing: 'border-box',
                cursor: 'text',
                userSelect: 'text',
              }}
            />
          </div>
        );
      })()}

      {editingTableCell && editingCellTable && (() => {
        const { row, col } = editingTableCell;
        const table = editingCellTable;
        const colOffset = table.colWidths.slice(0, col).reduce((s, w) => s + w, 0);
        const rowOffset = table.rowHeights.slice(0, row).reduce((s, h) => s + h, 0);

        // Use Konva's absolute transform for pixel-perfect positioning
        // (handles pan, zoom, scaleX/scaleY, rotation all at once)
        let domLeft = position.x + safeAreaRect.x + (table.x + colOffset) * dimensions.scale;
        let domTop = position.y + safeAreaRect.y + (table.y + rowOffset) * dimensions.scale;
        let cellPixelWidth = table.colWidths[col] * dimensions.scale;
        let cellPixelHeight = table.rowHeights[row] * dimensions.scale;

        const tableNode = stageRef.current?.findOne<Konva.Group>('.' + table.id);
        const absScale = tableNode?.getAbsoluteScale() ?? { x: dimensions.scale, y: dimensions.scale };
        if (tableNode) {
          // getAbsoluteTransform already includes Stage x/y (pan), Group scale/offset, table rotation — use directly as DOM coords
          const stagePos = tableNode.getAbsoluteTransform().point({ x: colOffset, y: rowOffset });
          domLeft = stagePos.x;
          domTop = stagePos.y;
          cellPixelWidth = table.colWidths[col] * absScale.x;
          cellPixelHeight = table.rowHeights[row] * absScale.y;
        }

        const cell = table.cells[row]?.[col];
        const absScaleForFont = absScale.x;
        const rawFontFamily = cell?.fontFamily ?? table.defaultFontFamily ?? 'Inter';
        const fontSize = (cell?.fontSize ?? table.defaultFontSize) * absScaleForFont;
        const fontFamily = getFontFallbackStack(rawFontFamily);
        const textColor = cell?.textColor ?? table.defaultTextColor ?? '#000000';
        const textAlign = (cell?.textAlign ?? table.defaultTextAlign ?? 'left') as React.CSSProperties['textAlign'];
        const fontStyleStr = cell?.fontStyle ?? 'normal';
        const padding = table.cellPadding * absScaleForFont;
        const cellVerticalAlign = cell?.verticalAlign ?? table.defaultVerticalAlign ?? 'top';
        const flexJustify = cellVerticalAlign === 'middle' ? 'center' : cellVerticalAlign === 'bottom' ? 'flex-end' : 'flex-start';
        return (
          <div
            style={{
              position: 'absolute',
              left: domLeft,
              top: domTop,
              width: cellPixelWidth,
              height: cellPixelHeight,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: flexJustify,
              border: '2px solid #3b82f6',
              boxSizing: 'border-box',
              background: cell?.fill ?? table.defaultCellFill ?? '#ffffff',
              transform: `rotate(${table.rotation}deg)`,
              transformOrigin: 'top left',
              overflow: 'hidden',
            }}
          >
          <textarea
            ref={cellTextareaRef}
            rows={1}
            value={editingCellValue}
            onChange={(e) => {
              setEditingCellValue(e.target.value);
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
            }}
            onBlur={(e) => {
              const target = e.relatedTarget as HTMLElement | null;
              if (target) {
                const bar = document.getElementById('top-properties-bar');
                if (bar?.contains(target)) return;
                // Radix portals (popover, select, dialog, etc.) are inside [data-radix-portal]
                if (target.closest?.('[data-radix-portal]')) return;
              } else {
                // null relatedTarget: might be opening a Radix portal — defer to let focus settle
                cellBlurTimeoutRef.current = window.setTimeout(() => {
                  cellBlurTimeoutRef.current = null;
                  commitInlineCellEdit(editingCellValue);
                }, 200);
                return;
              }
              commitInlineCellEdit(editingCellValue);
            }}
            onFocus={() => {
              if (cellBlurTimeoutRef.current !== null) {
                clearTimeout(cellBlurTimeoutRef.current);
                cellBlurTimeoutRef.current = null;
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancelInlineCellEdit(); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitInlineCellEdit(editingCellValue); }
            }}
            data-disable-shortcuts="true"
            style={{
              width: '100%',
              height: 'auto',
              fontSize,
              fontFamily,
              fontStyle: fontStyleStr.includes('italic') ? 'italic' : 'normal',
              fontWeight: fontStyleStr.includes('bold') ? 700 : 400,
              lineHeight: '1.2',
              color: textColor,
              textAlign,
              padding,
              border: 'none',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              background: 'transparent',
              margin: 0,
              whiteSpace: 'pre-wrap',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          />
          </div>
        );
      })()}

      {/* Crop action buttons — HTML positioned inside the container, below the crop rect */}
      {isCropMode && selectedObject?.type === 'image' && cropRatio && (() => {
        const obj = selectedObject as ImageObject;
        const nw = obj.naturalWidth || obj.width;
        const nh = obj.naturalHeight || obj.height;
        const ds = obj.cropWidth ? obj.width / obj.cropWidth : obj.width / nw;
        const expandOffsetSX = (obj.cropX || 0) * ds * dimensions.scale;
        const expandOffsetSY = (obj.cropY || 0) * ds * dimensions.scale;
        const imgSW = nw * ds * dimensions.scale;
        const imgSH = nh * ds * dimensions.scale;
        const cropLocalX = -expandOffsetSX + cropRatio.x * imgSW;
        const cropLocalY = -expandOffsetSY + cropRatio.y * imgSH;
        const cropLocalW = cropRatio.width * imgSW;
        const cropLocalH = cropRatio.height * imgSH;
        const pivotSX = safeAreaRect.x + obj.x * dimensions.scale;
        const pivotSY = safeAreaRect.y + obj.y * dimensions.scale;
        const angle = (obj.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const panX = stageRef.current?.x() ?? 0;
        const panY = stageRef.current?.y() ?? 0;

        // Find the bottommost point and horizontal center of the rotated crop selection
        const corners: [number, number][] = [
          [cropLocalX, cropLocalY],
          [cropLocalX + cropLocalW, cropLocalY],
          [cropLocalX, cropLocalY + cropLocalH],
          [cropLocalX + cropLocalW, cropLocalY + cropLocalH],
        ];
        let maxStageY = -Infinity;
        let sumStageX = 0;
        for (const [lx, ly] of corners) {
          sumStageX += pivotSX + lx * cos - ly * sin;
          maxStageY = Math.max(maxStageY, pivotSY + lx * sin + ly * cos);
        }
        const centerStageX = sumStageX / 4;
        const hasCrop = obj.cropX != null && obj.cropWidth != null && (obj.cropWidth ?? 0) > 0;
        return (
          <div
            className="absolute z-10 flex gap-2 pointer-events-auto"
            style={{
              left: panX + centerStageX,
              top: panY + maxStageY + 12,
              transform: 'translateX(-50%)',
            }}
          >
            <Button size="sm" variant="default" className="h-8 gap-1.5 shadow-lg" onClick={handleCropApply}>
              <Check className="h-3.5 w-3.5" />
              Apply
            </Button>
            {hasCrop && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 shadow-lg bg-card" onClick={handleCropReset}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shadow-lg bg-card" onClick={handleCropCancel}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        );
      })()}
    </div>
    </CanvasContextMenu>
  );
});

EditorCanvas.displayName = 'EditorCanvas';

export default EditorCanvas;

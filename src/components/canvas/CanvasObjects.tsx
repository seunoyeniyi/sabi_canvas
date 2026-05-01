import React from 'react';
import { Group } from 'react-konva';
import Konva from 'konva';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { CanvasObject, DrawObject, PrintAreaObject, TableObject } from '@sabi-canvas/types/canvas-objects';
import { CanvasShape } from './CanvasShape';
import { CanvasImage } from './CanvasImage';
import { CachedGroupWrapper } from './CachedGroupWrapper';
import { CanvasTable } from './CanvasTable';
import { CanvasDraw } from './CanvasDraw';
import { CanvasPrintArea } from './CanvasPrintArea';
import { InteractionMode } from '@sabi-canvas/types/canvas';

interface CanvasObjectsProps {
  stageRef: React.RefObject<Konva.Stage>;
  scale: number;
  offsetX: number;
  offsetY: number;
  clipWidth: number;
  clipHeight: number;
  mode: InteractionMode;
  cropTargetId?: string;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  onImageDoubleClick?: (id: string) => void;
  editingTextId?: string | null;
  editingShapeTextId?: string | null;
  editingTableCell?: { tableId: string; row: number; col: number } | null;
  onTextEditRequest?: (id: string) => void;
  onShapeTextEditRequest?: (id: string) => void;
  onCellTextEditRequest?: (tableId: string, row: number, col: number) => void;
  onCellSelection?: (tableId: string, cells: { row: number; col: number }[]) => void;
  onObjectSelect?: () => void;
  isInteractionLocked?: boolean;
  dragSelectedOnly?: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

export const CanvasObjects: React.FC<CanvasObjectsProps> = ({
  stageRef,
  scale,
  offsetX,
  offsetY,
  clipWidth,
  clipHeight,
  mode,
  cropTargetId,
  onDragMove,
  onDragEnd,
  onHover,
  onImageDoubleClick,
  editingTextId,
  editingShapeTextId,
  editingTableCell,
  onTextEditRequest,
  onShapeTextEditRequest,
  onCellTextEditRequest,
  onCellSelection,
  onObjectSelect,
  isInteractionLocked = false,
  dragSelectedOnly = false,
  shouldSuppressTapSelection,
}) => {
  const {
    objects,
    selectedIds,
    selectObject,
    duplicateForDrag,
    updateObject,
  } = useCanvasObjects();

  const { editorMode, isMockupEnabled } = useEditor();

  // Find the first print area object (used for customer drag constraints)
  const printAreaObj = React.useMemo(() => {
    return objects.find((o) => o.type === 'print-area') as PrintAreaObject | undefined;
  }, [objects]);

  const altKeyPressedRef = React.useRef(false);
  const altDragSessionRef = React.useRef<{
    active: boolean;
    primaryId: string | null;
    duplicatedRootIds: string[];
    startNodePositions: Record<string, { x: number; y: number }>;
    pointerStart: { x: number; y: number } | null;
  }>({
    active: false,
    primaryId: null,
    duplicatedRootIds: [],
    startNodePositions: {},
    pointerStart: null,
  });

  const objectMap = React.useMemo(() => {
    return new Map(objects.map((object) => [object.id, object]));
  }, [objects]);

  const clearAltDragSession = React.useCallback(() => {
    altDragSessionRef.current = {
      active: false,
      primaryId: null,
      duplicatedRootIds: [],
      startNodePositions: {},
      pointerStart: null,
    };
  }, []);

  const toObjectPosition = React.useCallback((obj: CanvasObject, x: number, y: number) => {
    if (obj.type === 'circle') {
      const radius = Math.min(obj.width, obj.height) / 2;
      return { x: x - radius, y: y - radius };
    }

    if (obj.type === 'ellipse') {
      return { x: x - obj.radiusX, y: y - obj.radiusY };
    }

    if (obj.type === 'triangle' || obj.type === 'polygon' || obj.type === 'star') {
      return { x: x - obj.width / 2, y: y - obj.height / 2 };
    }

    return { x, y };
  }, []);

  const toNodePosition = React.useCallback((obj: CanvasObject, x: number, y: number) => {
    if (obj.type === 'circle') {
      const radius = Math.min(obj.width, obj.height) / 2;
      return { x: x + radius, y: y + radius };
    }

    if (obj.type === 'ellipse') {
      return { x: x + obj.radiusX, y: y + obj.radiusY };
    }

    if (obj.type === 'triangle' || obj.type === 'polygon' || obj.type === 'star') {
      return { x: x + obj.width / 2, y: y + obj.height / 2 };
    }

    return { x, y };
  }, []);

  React.useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altKeyPressedRef.current = true;
      }
    };

    const handleWindowKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') {
        altKeyPressedRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      if (!altKeyPressedRef.current) return;
      altKeyPressedRef.current = false;
    };

    const handleWindowMouseMove = (event: MouseEvent) => {
      const session = altDragSessionRef.current;
      if (!session.active || !session.pointerStart) return;

      const stage = stageRef.current;
      if (!stage) return;

      const deltaX = (event.clientX - session.pointerStart.x) / scale;
      const deltaY = (event.clientY - session.pointerStart.y) / scale;

      session.duplicatedRootIds.forEach((id) => {
        const start = session.startNodePositions[id];
        if (!start) return;

        const node = stage.findOne(`.${id}`);
        if (!node) return;

        node.x(start.x + deltaX);
        node.y(start.y + deltaY);
      });

      stage.batchDraw();
    };

    const handleWindowPointerUp = (event: MouseEvent | TouchEvent) => {
      const session = altDragSessionRef.current;
      if (!session.active) {
        clearAltDragSession();
        return;
      }

      const stage = stageRef.current;
      if (stage) {
        session.duplicatedRootIds.forEach((id) => {
          const object = objectMap.get(id);
          if (!object) return;

          const node = stage.findOne(`.${id}`);
          if (!node) return;

          const next = toObjectPosition(object, node.x(), node.y());
          updateObject(id, next);
        });
      }

      clearAltDragSession();
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('keyup', handleWindowKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowPointerUp);
    window.addEventListener('touchend', handleWindowPointerUp);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowPointerUp);
      window.removeEventListener('touchend', handleWindowPointerUp);
    };
  }, [clearAltDragSession, objectMap, scale, stageRef, toObjectPosition, updateObject]);

  const childrenMap = React.useMemo(() => {
    const map = new Map<string, CanvasObject[]>();

    objects.forEach((object) => {
      if (!object.parentId) return;

      const current = map.get(object.parentId) ?? [];
      current.push(object);
      map.set(object.parentId, current);
    });

    return map;
  }, [objects]);

  const topLevelObjects = React.useMemo(() => {
    return objects.filter((object) => !object.parentId);
  }, [objects]);

  const getSelectableId = React.useCallback((id: string): string => {
    let targetId = id;
    let cursor = objectMap.get(id)?.parentId;

    while (cursor) {
      const parent = objectMap.get(cursor);
      if (!parent || parent.type !== 'group') break;
      targetId = parent.id;
      cursor = parent.parentId;
    }

    return targetId;
  }, [objectMap]);

  const handleSelect = React.useCallback((id: string, addToSelection?: boolean) => {
    const obj = objectMap.get(id);
    // In customer mode, only objects explicitly tagged as 'customer' are selectable
    if (editorMode === 'customer' && obj && obj.objectRole !== 'customer') return;
    onObjectSelect?.();
    selectObject(getSelectableId(id), addToSelection);
  }, [editorMode, getSelectableId, objectMap, onObjectSelect, selectObject]);

  const handleCanvasObjectDragMove = React.useCallback((event: Konva.KonvaEventObject<DragEvent>) => {
    if (altDragSessionRef.current.active) {
      return;
    }

    onDragMove?.(event);
  }, [onDragMove]);

  const handleCanvasObjectDragEnd = React.useCallback((event: Konva.KonvaEventObject<DragEvent>) => {
    if (altDragSessionRef.current.active) {
      onDragEnd?.(event);
      return;
    }

    clearAltDragSession();
    onDragEnd?.(event);
  }, [clearAltDragSession, onDragEnd]);

  const createDragStartHandler = React.useCallback((object: CanvasObject) => {
    return (event: Konva.KonvaEventObject<DragEvent>) => {
      if (altDragSessionRef.current.active || isInteractionLocked) return;

      const nativeEvent = event.evt;
      if (!(nativeEvent instanceof MouseEvent)) return;

      const isAltGesture = nativeEvent.altKey || altKeyPressedRef.current;
      if (!isAltGesture) return;

      const stage = stageRef.current ?? event.target.getStage();
      if (!stage) return;

      const sourceRootIds = selectedIds.includes(object.id) ? undefined : [object.id];
      const duplicateResult = duplicateForDrag(sourceRootIds);
      if (!duplicateResult) return;

      const duplicateRootId = duplicateResult.rootIdMap[object.id] ?? duplicateResult.duplicatedRootIds[0];
      if (!duplicateRootId) return;

      const pointerStart = { x: nativeEvent.clientX, y: nativeEvent.clientY };
      const nextStartPositions: Record<string, { x: number; y: number }> = {};

      Object.entries(duplicateResult.rootIdMap).forEach(([sourceId, duplicateId]) => {
        const sourceObject = objectMap.get(sourceId);
        if (!sourceObject) return;

        nextStartPositions[duplicateId] = toNodePosition(sourceObject, sourceObject.x, sourceObject.y);
      });

      altDragSessionRef.current = {
        active: true,
        primaryId: duplicateRootId,
        duplicatedRootIds: duplicateResult.duplicatedRootIds,
        startNodePositions: nextStartPositions,
        pointerStart,
      };

      try {
        event.target.stopDrag();
      } catch {
        clearAltDragSession();
      }
    };
  }, [clearAltDragSession, duplicateForDrag, isInteractionLocked, objectMap, selectedIds, stageRef, toNodePosition]);

  const renderObject = React.useCallback((object: CanvasObject): React.ReactNode => {
    // In mockup-design mode, customer objects are hidden so the designer sees only the mockup
    if (isMockupEnabled && editorMode === 'mockup-design' && object.objectRole === 'customer') return null;

    const isSelected = selectedIds.includes(object.id);
    const isMockupLocked = isMockupEnabled && editorMode === 'customer' && object.objectRole !== 'customer';
    const canDragNode = !object.parentId && object.draggable && !object.locked && (!dragSelectedOnly || isSelected) && !isInteractionLocked && !isMockupLocked;

    // Wrap non-print-area mockup objects in a non-listening Group so ALL Konva events
    // (click, hover, drag, tap) are blocked for customers. Konva propagates listening=false
    // from a container down to every descendant (Node._isListening() walks the parent chain).
    const withMockupLock = (node: React.ReactNode): React.ReactNode => {
      if (!isMockupLocked) return node;
      return <Group key={object.id} listening={false}>{node}</Group>;
    };

    // Print area: dedicated renderer — handles its own listening/interaction per mode
    if (object.type === 'print-area') {
      const handleObjectDragStart = createDragStartHandler(object);
      return (
        <CanvasPrintArea
          key={object.id}
          object={object as PrintAreaObject}
          isSelected={isSelected}
          editorMode={editorMode}
          onSelect={handleSelect}
          onUpdate={updateObject}
          onDragStart={handleObjectDragStart}
          onDragMove={handleCanvasObjectDragMove}
          onDragEnd={handleCanvasObjectDragEnd}
          onHover={onHover}
          isDragEnabled={canDragNode}
          shouldSuppressTapSelection={shouldSuppressTapSelection}
        />
      );
    }

    if (object.type === 'group') {
      const groupChildren = childrenMap.get(object.id) ?? [];
      const handleObjectDragStart = createDragStartHandler(object);

      const cacheKey = [object, ...groupChildren]
        .map((o) => `${o.id}:${o.x},${o.y},${o.scaleX},${o.scaleY},${o.rotation},${o.opacity},${o.visible}`)
        .join('|');

      return withMockupLock(
        <CachedGroupWrapper
          key={object.id}
          x={object.x}
          y={object.y}
          rotation={object.rotation}
          scaleX={object.scaleX}
          scaleY={object.scaleY}
          opacity={object.opacity}
          visible={object.visible}
          draggable={canDragNode}
          name={object.id}
          isSelected={isSelected}
          cacheKey={cacheKey}
          onClick={(evt) => {
            evt.cancelBubble = true;
            if (shouldSuppressTapSelection?.()) return;
            const isMultiSelect = evt.evt.shiftKey || evt.evt.metaKey || evt.evt.ctrlKey;
            handleSelect(object.id, isMultiSelect);
          }}
          onTap={(evt) => {
            evt.cancelBubble = true;
            if (shouldSuppressTapSelection?.()) return;
            handleSelect(object.id);
          }}
          onDragStart={handleObjectDragStart}
          onDragMove={handleCanvasObjectDragMove}
          onDragEnd={(evt) => {
            handleCanvasObjectDragEnd(evt);
            if (!altDragSessionRef.current.active) {
              updateObject(object.id, {
                x: evt.target.x(),
                y: evt.target.y(),
              });
            }
          }}
          onMouseEnter={() => onHover?.(object.id)}
          onMouseLeave={() => onHover?.(null)}
        >
          {groupChildren.map((child) => renderObject(child))}
        </CachedGroupWrapper>
      );
    }

    if (object.type === 'image') {
      const handleObjectDragStart = createDragStartHandler(object);
      return withMockupLock(
        <CanvasImage
          key={object.id}
          object={object}
          isSelected={isSelected}
          isCropMode={object.id === cropTargetId}
          onSelect={handleSelect}
          onUpdate={updateObject}
          onDragStart={handleObjectDragStart}
          onDragMove={handleCanvasObjectDragMove}
          onDragEnd={handleCanvasObjectDragEnd}
          onHover={onHover}
          onDoubleClick={onImageDoubleClick}
          isDragEnabled={canDragNode}
          shouldSuppressTapSelection={shouldSuppressTapSelection}
        />
      );
    }

    if (object.type === 'table') {
      const handleObjectDragStart = createDragStartHandler(object);
      return withMockupLock(
        <CanvasTable
          key={object.id}
          object={object as TableObject}
          isSelected={isSelected}
          editingCell={editingTableCell ?? null}
          onSelect={handleSelect}
          onUpdate={updateObject}
          onDragStart={handleObjectDragStart}
          onDragMove={handleCanvasObjectDragMove}
          onDragEnd={handleCanvasObjectDragEnd}
          onHover={onHover}
          onCellTextEditRequest={onCellTextEditRequest ?? (() => {})}
          onCellSelection={onCellSelection}
          isDragEnabled={canDragNode}
          shouldSuppressTapSelection={shouldSuppressTapSelection}
        />
      );
    }

    if (object.type === 'draw') {
      const handleObjectDragStart = createDragStartHandler(object);
      return withMockupLock(
        <CanvasDraw
          key={object.id}
          object={object as DrawObject}
          isSelected={isSelected}
          onSelect={handleSelect}
          onUpdate={updateObject}
          onDragStart={handleObjectDragStart}
          onDragMove={handleCanvasObjectDragMove}
          onDragEnd={handleCanvasObjectDragEnd}
          onHover={onHover}
          isDragEnabled={canDragNode}
          shouldSuppressTapSelection={shouldSuppressTapSelection}
        />
      );
    }

    const handleObjectDragStart = createDragStartHandler(object);

    return withMockupLock(
      <CanvasShape
        key={object.id}
        object={object}
        isSelected={isSelected}
        isEditingText={editingTextId === object.id}
        isEditingShapeText={editingShapeTextId === object.id}
        canClickToEdit={selectedIds.length === 1 && selectedIds[0] === object.id}
        onSelect={handleSelect}
        onUpdate={updateObject}
        onDragStart={handleObjectDragStart}
        onDragMove={handleCanvasObjectDragMove}
        onDragEnd={handleCanvasObjectDragEnd}
        onHover={onHover}
        onTextEditRequest={onTextEditRequest}
        onShapeTextEditRequest={onShapeTextEditRequest}
        isDragEnabled={canDragNode}
        shouldSuppressTapSelection={shouldSuppressTapSelection}
      />
    );
  }, [
    childrenMap,
    createDragStartHandler,
    cropTargetId,
    dragSelectedOnly,
    editorMode,
    isMockupEnabled,
    editingShapeTextId,
    editingTableCell,
    editingTextId,
    handleCanvasObjectDragEnd,
    handleCanvasObjectDragMove,
    handleSelect,
    isInteractionLocked,
    onCellSelection,
    onCellTextEditRequest,
    onHover,
    onImageDoubleClick,
    onShapeTextEditRequest,
    onTextEditRequest,
    selectedIds,
    shouldSuppressTapSelection,
    updateObject,
  ]);

  // In customer mode: split objects into two layers.
  // Mockup layer (listening=false, no interaction) and customer layer (interactive, clipped to print area).
  if (isMockupEnabled && editorMode === 'customer') {
    const mockupObjects = topLevelObjects.filter((o) => o.objectRole !== 'customer');
    const customerObjects = topLevelObjects.filter((o) => o.objectRole === 'customer');
    const pa = printAreaObj;

    return (
      <>
        {/* Mockup layer: fully locked, zero events */}
        <Group name="canvas-mockup-layer" x={offsetX} y={offsetY} scaleX={scale} scaleY={scale} listening={false}>
          {mockupObjects.map((object) => renderObject(object))}
        </Group>
        {/* Customer layer: interactive, clipped to print area when one exists */}
        <Group
          name="canvas-customer-layer"
          x={offsetX}
          y={offsetY}
          scaleX={scale}
          scaleY={scale}
          listening={mode !== 'pan' && !isInteractionLocked}
          {...(pa ? { clipX: pa.x, clipY: pa.y, clipWidth: pa.width, clipHeight: pa.height } : {})}
        >
          {customerObjects.map((object) => renderObject(object))}
        </Group>
      </>
    );
  }

  return (
    <>
      <Group
        x={offsetX}
        y={offsetY}
        scaleX={scale}
        scaleY={scale}
        listening={mode !== 'pan' && !isInteractionLocked}
      >
        {topLevelObjects.map((object) => renderObject(object))}
      </Group>
    </>
  );
};

export default CanvasObjects;

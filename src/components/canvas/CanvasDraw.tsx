import React, { useRef, useEffect, useCallback } from 'react';
import { Group, Line } from 'react-konva';
import Konva from 'konva';
import { DrawObject, CanvasObject } from '@sabi-canvas/types/canvas-objects';

interface CanvasDrawProps {
  object: DrawObject;
  isSelected: boolean;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  isDragEnabled?: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

export const CanvasDraw: React.FC<CanvasDrawProps> = ({
  object,
  isSelected,
  onSelect,
  onUpdate,
  onDragStart,
  onDragMove,
  onDragEnd,
  onHover,
  isDragEnabled = true,
  shouldSuppressTapSelection,
}) => {
  const lineRef = useRef<Konva.Line>(null);

  // Apply blur filter when filterBlur changes
  useEffect(() => {
    const node = lineRef.current;
    if (!node) return;
    const blurValue = object.filterBlur ?? 0;
    if (blurValue > 0) {
      node.cache();
      node.filters([Konva.Filters.Blur]);
      node.blurRadius(blurValue);
    } else {
      node.clearCache();
      node.filters([]);
    }
    node.getLayer()?.batchDraw();
  }, [object.filterBlur]);

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    onSelect(object.id, isMultiSelect);
  }, [object.id, onSelect, shouldSuppressTapSelection]);

  const handleTap = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    onSelect(object.id);
  }, [object.id, onSelect, shouldSuppressTapSelection]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd?.(e);
    onUpdate(object.id, { x: e.target.x(), y: e.target.y() });
  }, [object.id, onDragEnd, onUpdate]);

  const hasShadow = (object.shadowBlur ?? 0) > 0;

  return (
    <Group
      name={object.id}
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      scaleX={object.scaleX}
      scaleY={object.scaleY}
      opacity={object.opacity}
      visible={object.visible}
      draggable={isDragEnabled && object.draggable && !object.locked}
      onClick={handleClick}
      onTap={handleTap}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => onHover?.(object.id)}
      onMouseLeave={() => onHover?.(null)}
      shadowEnabled={hasShadow}
      shadowColor={hasShadow ? (object.shadowColor ?? 'rgba(0,0,0,0.5)') : undefined}
      shadowBlur={hasShadow ? (object.shadowBlur ?? 0) : 0}
      shadowOffsetX={hasShadow ? (object.shadowOffsetX ?? 0) : 0}
      shadowOffsetY={hasShadow ? (object.shadowOffsetY ?? 0) : 0}
      shadowOpacity={hasShadow ? (object.shadowOpacity ?? 0.5) : 0}
    >
      <Line
        ref={lineRef}
        points={object.points}
        stroke={object.stroke}
        strokeWidth={object.strokeWidth}
        lineCap={object.lineCap}
        lineJoin={object.lineJoin}
        tension={object.tension}
        globalCompositeOperation="source-over"
        perfectDrawEnabled={false}
        listening={true}
        hitStrokeWidth={Math.max(object.strokeWidth, 12)}
      />
    </Group>
  );
};

export default CanvasDraw;

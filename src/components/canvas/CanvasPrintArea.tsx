import React from 'react';
import { Rect, Text } from 'react-konva';
import Konva from 'konva';
import { PrintAreaObject } from '@sabi-canvas/types/canvas-objects';
import { EditorMode } from '@sabi-canvas/types/editor';

interface CanvasPrintAreaProps {
  object: PrintAreaObject;
  isSelected: boolean;
  editorMode: EditorMode;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<PrintAreaObject>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  isDragEnabled: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

export const CanvasPrintArea: React.FC<CanvasPrintAreaProps> = ({
  object,
  isSelected,
  editorMode,
  onSelect,
  onUpdate,
  onDragStart,
  onDragMove,
  onDragEnd,
  onHover,
  isDragEnabled,
  shouldSuppressTapSelection,
}) => {
  const isDesignMode = editorMode === 'mockup-design';
  const w = object.width * object.scaleX;
  const h = object.height * object.scaleY;

  const borderColor = isSelected && isDesignMode ? '#2563EB' : object.borderColor;

  return (
    <>
      {/* Primary element: named Rect that the Transformer attaches to */}
      <Rect
        id="print-area-frame"
        name={object.id}
        x={object.x}
        y={object.y}
        width={w}
        height={h}
        rotation={object.rotation}
        opacity={object.opacity}
        visible={object.visible}
        fill="transparent"
        stroke={borderColor}
        strokeWidth={object.borderWidth}
        dash={object.borderDash}
        draggable={isDragEnabled && isDesignMode}
        listening={isDesignMode}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={(e) => {
          onDragEnd?.(e);
          onUpdate(object.id, { x: e.target.x(), y: e.target.y() });
        }}
        onClick={(e) => {
          e.cancelBubble = true;
          if (shouldSuppressTapSelection?.()) return;
          const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
          onSelect(object.id, isMultiSelect);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          if (shouldSuppressTapSelection?.()) return;
          onSelect(object.id);
        }}
        onMouseEnter={() => onHover?.(object.id)}
        onMouseLeave={() => onHover?.(null)}
      />
      {/* Label: sibling element, not part of the Rect's hit area or bounding box */}
      {object.label && isDesignMode && (
        <Text
          id="print-area-label"
          x={object.x + 4}
          y={object.y - 18}
          text={object.label}
          fontSize={11}
          fontFamily="sans-serif"
          fill="#888888"
          listening={false}
          visible={object.visible}
        />
      )}
    </>
  );
};

export default CanvasPrintArea;

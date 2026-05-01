import React, { useCallback } from 'react';
import { Group, Rect, Circle, Ellipse, Line, Arrow, Star, Path, RegularPolygon, Text, Shape } from 'react-konva';
import Konva from 'konva';
import { DEFAULT_FONT_FAMILY } from '@sabi-canvas/lib/fontCatalog';
import { getFontFallbackStack } from '@sabi-canvas/lib/fontLoader';
import { layoutRichText, drawRichText } from '@sabi-canvas/lib/richText';
import {
  CanvasObject,
  RectangleObject,
  CircleObject,
  EllipseObject,
  TriangleObject,
  PolygonObject,
  StarObject,
  LineObject,
  ArrowObject,
  PathObject,
  TextObject,
  TextSpan,
} from '@sabi-canvas/types/canvas-objects';
import { CanvasText } from './CanvasText';

interface CanvasShapeProps {
  object: CanvasObject;
  isSelected: boolean;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onTransformEnd?: (id: string, updates: Partial<CanvasObject>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  onTextEditRequest?: (id: string) => void;
  onShapeTextEditRequest?: (id: string) => void;
  isEditingText?: boolean;
  isEditingShapeText?: boolean;
  canClickToEdit?: boolean;
  isDragEnabled?: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

// Shape types that support inner text
const SHAPE_TYPES_WITH_TEXT = new Set([
  'rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'star', 'path',
]);

export const CanvasShape: React.FC<CanvasShapeProps> = ({
  object,
  isSelected,
  onSelect,
  onUpdate,
  onTransformEnd,
  onDragStart,
  onDragMove,
  onDragEnd,
  onHover,
  onTextEditRequest,
  onShapeTextEditRequest,
  isEditingText = false,
  isEditingShapeText = false,
  canClickToEdit = false,
  isDragEnabled = true,
  shouldSuppressTapSelection,
}) => {

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const container = e.target.getStage()?.container();
    if (container) {
      container.style.cursor = '';
    }

    if (onDragEnd) {
      onDragEnd(e);
    }

    let newX = e.target.x();
    let newY = e.target.y();

    // Revert visual offsets for center-origin shapes so bounding box coordinate is accurate
    if (object.type === 'circle') {
      const radius = Math.min(object.width, object.height) / 2;
      newX -= radius;
      newY -= radius;
    } else if (object.type === 'ellipse') {
      const ellipse = object as EllipseObject;
      newX -= ellipse.radiusX;
      newY -= ellipse.radiusY;
    } else if (
      object.type === 'triangle' ||
      object.type === 'polygon' ||
      object.type === 'star'
    ) {
      newX -= object.width / 2;
      newY -= object.height / 2;
    }

    onUpdate(object.id, {
      x: newX,
      y: newY,
    });
  };

  const handleClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    onSelect(object.id, isMultiSelect);
  };

  const handleTap = (e: Konva.KonvaEventObject<TouchEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    onSelect(object.id);
  };

  const handleMouseEnter = () => {
    if (onHover) {
      onHover(object.id);
    }
  };

  const handleNodeMouseEnter = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    handleMouseEnter();
  };

  const handleMouseLeave = () => {
    if (onHover) {
      onHover(null);
    }
  };

  const handleNodeMouseLeave = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    handleMouseLeave();
  };

  const handleDragStart = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (onDragStart) {
      onDragStart(e);
    }

    const container = e.target.getStage()?.container();
    if (container) {
      container.style.cursor = 'move';
    }
  };

  const handleShapeDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (isSelected && onShapeTextEditRequest) {
      onShapeTextEditRequest(object.id);
    }
  }, [isSelected, object.id, onShapeTextEditRequest]);

  const handleShapeDblTap = useCallback((e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    if (isSelected && onShapeTextEditRequest) {
      onShapeTextEditRequest(object.id);
    }
  }, [isSelected, object.id, onShapeTextEditRequest]);

  // Shadow props if defined
  const shadowProps = object.shadowBlur ? {
    shadowColor: object.shadowColor || 'rgba(0,0,0,0.5)',
    shadowBlur: object.shadowBlur,
    shadowOffsetX: object.shadowOffsetX || 0,
    shadowOffsetY: object.shadowOffsetY || 0,
    shadowOpacity: object.shadowOpacity || 0.5,
  } : {};

  const commonProps = {
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    opacity: object.opacity,
    draggable: object.draggable && !object.locked && isDragEnabled,
    visible: object.visible,
    // Skips the extra internal draw pass Konva uses to correct minor
    // anti-aliasing artifacts on shapes with both fill and stroke.
    // Measurably cheaper on mobile/low-end GPUs.
    perfectDrawEnabled: false,
    onClick: handleClick,
    onTap: handleTap,
    onDragMove: onDragMove,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onMouseEnter: handleNodeMouseEnter,
    onMouseLeave: handleNodeMouseLeave,
    name: object.id,
    ...shadowProps,
  };

  // Check if this shape has inner text or supports it
  const supportsInnerText = SHAPE_TYPES_WITH_TEXT.has(object.type);
  const innerRichText = (object as any).innerRichText as TextSpan[] | undefined;
  const hasInnerText = supportsInnerText && (object.innerText || (innerRichText && innerRichText.length > 0));

  // Compute the inner Text node for shapes that have innerText
  const renderInnerText = useCallback((
    textX: number,
    textY: number,
    textWidth: number,
    textHeight: number,
  ) => {
    if (!hasInnerText) return null;
    const fontSize = object.innerTextFontSize ?? 24;
    const fontFamily = getFontFallbackStack(object.innerTextFontFamily ?? DEFAULT_FONT_FAMILY);
    const fontStyle = object.innerTextFontStyle ?? 'normal';
    const fill = object.innerTextFill ?? '#000000';
    const align = (object.innerTextAlign ?? 'center') as 'left' | 'center' | 'right';
    const verticalAlign = object.innerTextVerticalAlign ?? 'middle';
    const padding = object.innerTextPadding ?? 10;
    const lineHeight = object.innerTextLineHeight ?? 1.2;
    const letterSpacing = object.innerTextLetterSpacing ?? 0;
    const textDecoration = object.innerTextDecoration ?? 'none';

    // Counter-scale the text against the parent's scaleX/scaleY
    const sx = object.scaleX || 1;
    const sy = object.scaleY || 1;

    // --- Rich text path ---
    if (innerRichText && innerRichText.length > 0) {
      const richLayout = layoutRichText(innerRichText, {
        maxWidth: textWidth - 2 * padding,
        baseFontSize: fontSize,
        baseFontFamily: fontFamily,
        baseColor: fill,
        baseBold: fontStyle.includes('bold'),
        baseItalic: fontStyle.includes('italic'),
        baseUnderline: textDecoration.includes('underline'),
        baseStrikethrough: textDecoration.includes('line-through'),
        lineHeight,
        letterSpacing,
        align,
      });

      const availableHeight = textHeight - 2 * padding;
      let yOffset = 0;
      if (verticalAlign === 'middle') {
        yOffset = Math.max(0, (availableHeight - richLayout.totalHeight) / 2);
      } else if (verticalAlign === 'bottom') {
        yOffset = Math.max(0, availableHeight - richLayout.totalHeight);
      }

      return (
        <Shape
          name={`_innerText_${object.id}`}
          x={textX / sx}
          y={textY / sy}
          width={textWidth}
          height={textHeight}
          scaleX={1 / sx}
          scaleY={1 / sy}
          listening={false}
          visible={!isEditingShapeText}
          perfectDrawEnabled={false}
          sceneFunc={(ctx, _shape) => {
            const nativeCtx = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
            nativeCtx.save();
            nativeCtx.translate(padding, padding + yOffset);
            drawRichText(nativeCtx, richLayout, letterSpacing);
            nativeCtx.restore();
          }}
          hitFunc={(ctx, shape) => {
            ctx.beginPath();
            (ctx as unknown as CanvasRenderingContext2D & { rect: (x: number, y: number, w: number, h: number) => void }).rect(0, 0, textWidth, textHeight);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
        />
      );
    }

    // --- Plain text path ---
    return (
      <Text
        name={`_innerText_${object.id}`}
        x={textX / sx}
        y={textY / sy}
        width={textWidth}
        height={textHeight}
        padding={padding}
        text={object.innerText}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={fontStyle}
        fill={fill}
        align={align}
        verticalAlign={verticalAlign}
        lineHeight={lineHeight}
        letterSpacing={letterSpacing}
        textDecoration={textDecoration}
        wrap="word"
        listening={false}
        // Counter-scale to prevent text distortion during transform
        scaleX={1 / sx}
        scaleY={1 / sy}
        visible={!isEditingShapeText}
        perfectDrawEnabled={false}
      />
    );
  }, [hasInnerText, innerRichText, object, isEditingShapeText]);

  // For shapes that support inner text, we need double-click handlers on the shape node
  const shapeInteractionProps = supportsInnerText ? {
    onDblClick: handleShapeDblClick,
    onDblTap: handleShapeDblTap,
  } : {};

  switch (object.type) {
    case 'rectangle': {
      const rect = object as RectangleObject;
      return (
        <Group {...commonProps} {...shapeInteractionProps}>
          <Rect
            width={rect.width}
            height={rect.height}
            fill={rect.fill}
            stroke={rect.stroke}
            strokeWidth={rect.strokeWidth}
            cornerRadius={rect.cornerRadius}
            perfectDrawEnabled={false}
          />
          {renderInnerText(0, 0, rect.width, rect.height)}
        </Group>
      );
    }

    case 'circle': {
      const circle = object as CircleObject;
      const radius = Math.min(circle.width, circle.height) / 2;
      return (
        <Group
          {...commonProps}
          x={circle.x + radius}
          y={circle.y + radius}
          {...shapeInteractionProps}
        >
          <Circle
            radius={radius}
            fill={circle.fill}
            stroke={circle.stroke}
            strokeWidth={circle.strokeWidth}
            perfectDrawEnabled={false}
          />
          {renderInnerText(-radius, -radius, radius * 2, radius * 2)}
        </Group>
      );
    }

    case 'ellipse': {
      const ellipse = object as EllipseObject;
      return (
        <Group
          {...commonProps}
          x={ellipse.x + ellipse.radiusX}
          y={ellipse.y + ellipse.radiusY}
          {...shapeInteractionProps}
        >
          <Ellipse
            radiusX={ellipse.radiusX}
            radiusY={ellipse.radiusY}
            fill={ellipse.fill}
            stroke={ellipse.stroke}
            strokeWidth={ellipse.strokeWidth}
            perfectDrawEnabled={false}
          />
          {renderInnerText(-ellipse.radiusX, -ellipse.radiusY, ellipse.radiusX * 2, ellipse.radiusY * 2)}
        </Group>
      );
    }

    case 'triangle': {
      const triangle = object as TriangleObject;
      return (
        <Group
          {...commonProps}
          x={triangle.x + triangle.width / 2}
          y={triangle.y + triangle.height / 2}
          {...shapeInteractionProps}
        >
          <RegularPolygon
            sides={3}
            radius={Math.min(triangle.width, triangle.height) / 2}
            fill={triangle.fill}
            stroke={triangle.stroke}
            strokeWidth={triangle.strokeWidth}
            perfectDrawEnabled={false}
          />
          {renderInnerText(-triangle.width / 2, -triangle.height / 2, triangle.width, triangle.height)}
        </Group>
      );
    }

    case 'polygon': {
      const polygon = object as PolygonObject;
      return (
        <Group
          {...commonProps}
          x={polygon.x + polygon.width / 2}
          y={polygon.y + polygon.height / 2}
          {...shapeInteractionProps}
        >
          <RegularPolygon
            sides={polygon.sides}
            radius={Math.min(polygon.width, polygon.height) / 2}
            fill={polygon.fill}
            stroke={polygon.stroke}
            strokeWidth={polygon.strokeWidth}
            perfectDrawEnabled={false}
          />
          {renderInnerText(-polygon.width / 2, -polygon.height / 2, polygon.width, polygon.height)}
        </Group>
      );
    }

    case 'star': {
      const star = object as StarObject;
      return (
        <Group
          {...commonProps}
          x={star.x + star.width / 2}
          y={star.y + star.height / 2}
          {...shapeInteractionProps}
        >
          <Star
            numPoints={star.numPoints}
            innerRadius={star.innerRadius}
            outerRadius={star.outerRadius}
            fill={star.fill}
            stroke={star.stroke}
            strokeWidth={star.strokeWidth}
            perfectDrawEnabled={false}
          />
          {renderInnerText(-star.width / 2, -star.height / 2, star.width, star.height)}
        </Group>
      );
    }

    case 'line': {
      const line = object as LineObject;
      return (
        <Line
          {...commonProps}
          points={line.points}
          stroke={line.stroke}
          strokeWidth={line.strokeWidth}
          lineCap={line.lineCap || 'round'}
          lineJoin={line.lineJoin || 'round'}
          dash={line.dash}
        />
      );
    }

    case 'arrow': {
      const arrow = object as ArrowObject;
      return (
        <Arrow
          {...commonProps}
          points={arrow.points}
          stroke={arrow.stroke}
          strokeWidth={arrow.strokeWidth}
          fill={arrow.fill}
          pointerLength={arrow.pointerLength}
          pointerWidth={arrow.pointerWidth}
          pointerAtBeginning={arrow.pointerAtBeginning}
          pointerAtEnding={arrow.pointerAtEnding !== false}
        />
      );
    }

    case 'path': {
      const path = object as PathObject;
      return (
        <Group {...commonProps} {...shapeInteractionProps}>
          <Path
            data={path.data}
            fill={path.fill}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            perfectDrawEnabled={false}
          />
          {renderInnerText(0, 0, path.width, path.height)}
        </Group>
      );
    }

    case 'text': {
      const text = object as TextObject;
      return (
        <CanvasText
          object={text}
          isEditing={isEditingText}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onHover={onHover}
          isDragEnabled={isDragEnabled}
          shouldSuppressTapSelection={shouldSuppressTapSelection}
          onStartEditing={(id, source) => {
            const shouldStartFromClick = source === 'click' && isSelected && canClickToEdit;
            const shouldStartFromDouble = source === 'double' && isSelected;

            if (shouldStartFromClick || shouldStartFromDouble) {
              onTextEditRequest?.(id);
            }
          }}
        />
      );
    }

    default:
      return null;
  }
};

export default CanvasShape;

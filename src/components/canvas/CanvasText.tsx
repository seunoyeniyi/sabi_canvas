import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, Shape, Rect, Group } from 'react-konva';
import Konva from 'konva';
import { CanvasObject, TextObject } from '@sabi-canvas/types/canvas-objects';
import { getFontFallbackStack, loadFontFamily } from '@sabi-canvas/lib/fontLoader';
import { layoutRichText, drawRichText } from '@sabi-canvas/lib/richText';

interface CanvasTextProps {
  object: TextObject;
  isEditing: boolean;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  onStartEditing?: (id: string, source: 'click' | 'double') => void;
  isDragEnabled?: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

export const CanvasText: React.FC<CanvasTextProps> = ({
  object,
  isEditing,
  onSelect,
  onUpdate,
  onDragMove,
  onDragEnd,
  onHover,
  onStartEditing,
  isDragEnabled = true,
  shouldSuppressTapSelection,
}) => {
  const textRef = useRef<Konva.Text>(null);
  const shapeRef = useRef<Konva.Shape>(null);

  const setStageCursor = useCallback((e: Konva.KonvaEventObject<MouseEvent | DragEvent>, cursor: string) => {
    const container = e.target.getStage()?.container();
    if (container) {
      container.style.cursor = cursor;
    }
  }, []);

  // --- Plain text height measurement ---
  const updateMeasuredHeight = useCallback(() => {
    const node = textRef.current;
    if (!node) return;

    const nextHeight = Math.max(1, node.height());
    if (Math.abs(nextHeight - object.height) > 0.5) {
      onUpdate(object.id, { height: nextHeight });
    }
  }, [object.height, object.id, onUpdate]);

  useEffect(() => {
    if (object.richText) return; // rich text height handled separately
    if (isEditing) return; // height is managed live by onInput during editing
    if (Math.abs(object.textCurve ?? 0) >= 1) return; // curved height handled separately
    updateMeasuredHeight();
  }, [
    isEditing,
    object.richText,
    object.text,
    object.width,
    object.fontSize,
    object.fontFamily,
    object.fontStyle,
    object.lineHeight,
    object.letterSpacing,
    object.textCurve,
    updateMeasuredHeight,
  ]);

  // --- Curved text height measurement ---
  const updateCurvedTextHeight = useCallback(() => {
    const c = object.textCurve ?? 0;
    if (!object.text || Math.abs(c) < 1) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseBold = object.fontStyle.includes('bold');
    const baseItalic = object.fontStyle.includes('italic');

    const buildFont = (bold: boolean, italic: boolean, family: string) => {
      const parts: string[] = [];
      if (italic) parts.push('italic');
      if (bold) parts.push('bold');
      parts.push(`${object.fontSize}px`);
      parts.push(getFontFallbackStack(family));
      return parts.join(' ');
    };

    // Measure total width respecting per-span fonts (rich text) or base font (plain)
    let textWidth = 0;
    if (object.richText && object.richText.length > 0) {
      for (const span of object.richText) {
        ctx.font = buildFont(span.bold ?? baseBold, span.italic ?? baseItalic, span.fontFamily ?? object.fontFamily);
        textWidth += ctx.measureText(span.text).width;
      }
    } else {
      ctx.font = buildFont(baseBold, baseItalic, object.fontFamily);
      textWidth = ctx.measureText(object.text).width;
    }

    const absC = Math.max(1, Math.abs(c));
    const arcAngle = (absC / 100) * Math.PI;
    const radius = textWidth / Math.max(arcAngle, 0.001);
    const sag = radius * (1 - Math.cos(arcAngle / 2));
    const baselineOffset = object.fontSize * 0.85;

    const nextHeight = Math.max(1, baselineOffset + sag + object.fontSize * 0.25);
    if (Math.abs(nextHeight - object.height) > 0.5) {
      onUpdate(object.id, { height: nextHeight });
    }
  }, [
    object.text, object.richText, object.textCurve, object.fontSize, object.fontFamily,
    object.fontStyle, object.height, object.id, onUpdate,
  ]);

  // --- Rich text layout (memoized) ---
  const richLayout = useMemo(() => {
    if (!object.richText || object.richText.length === 0) return null;
    return layoutRichText(object.richText, {
      maxWidth: object.width,
      baseFontSize: object.fontSize,
      baseFontFamily: getFontFallbackStack(object.fontFamily),
      baseColor: object.fill,
      baseBold: object.fontStyle.includes('bold'),
      baseItalic: object.fontStyle.includes('italic'),
      baseUnderline: object.textDecoration?.includes('underline') ?? false,
      baseStrikethrough: object.textDecoration?.includes('line-through') ?? false,
      lineHeight: object.lineHeight ?? 1.2,
      letterSpacing: object.letterSpacing ?? 0,
      align: object.align,
    });
  }, [
    object.richText,
    object.width,
    object.fontSize,
    object.fontFamily,
    object.fill,
    object.fontStyle,
    object.textDecoration,
    object.lineHeight,
    object.letterSpacing,
    object.align,
  ]);

  // Sync rich-text height to canvas object
  useEffect(() => {
    if (!richLayout) return;
    if (isEditing) return; // height is managed live by onInput during editing
    if (Math.abs(object.textCurve ?? 0) >= 1) return; // curved height takes priority
    const nextHeight = Math.max(1, richLayout.totalHeight);
    if (Math.abs(nextHeight - object.height) > 0.5) {
      onUpdate(object.id, { height: nextHeight });
    }
  }, [isEditing, richLayout, object.textCurve, object.height, object.id, onUpdate]);

  // Sync curved text height to canvas object
  useEffect(() => {
    if (isEditing) return;
    updateCurvedTextHeight();
  }, [isEditing, updateCurvedTextHeight]);

  // Trigger layer redraw when rich layout or curve changes
  useEffect(() => {
    shapeRef.current?.getLayer()?.batchDraw();
  }, [richLayout, object.textCurve, object.text, object.fill, object.fontSize, object.textStrokeColor, object.textStrokeWidth]);

  // --- Font loading ---
  useEffect(() => {
    let cancelled = false;

    const syncFont = async () => {
      const result = await loadFontFamily(object.fontFamily, { timeoutMs: 2400 });
      if (cancelled || result.status !== 'loaded') return;

      textRef.current?.getLayer()?.batchDraw();
      shapeRef.current?.getLayer()?.batchDraw();
      updateMeasuredHeight();
    };

    syncFont();
    return () => { cancelled = true; };
  }, [object.fontFamily, object.fontStyle, object.fontSize, updateMeasuredHeight]);

  // --- Event handlers ---
  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setStageCursor(e, '');
    onDragEnd?.(e);
    onUpdate(object.id, { x: e.target.x(), y: e.target.y() });
  }, [object.id, onDragEnd, onUpdate, setStageCursor]);

  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setStageCursor(e, 'move');
  }, [setStageCursor]);

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    onSelect(object.id, isMultiSelect);
    if (!isMultiSelect && onStartEditing) {
      onStartEditing(object.id, 'click');
    }
  }, [object.id, onSelect, onStartEditing, shouldSuppressTapSelection]);

  const handleTap = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    onSelect(object.id);
  }, [object.id, onSelect, shouldSuppressTapSelection]);

  const handleDoubleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onStartEditing?.(object.id, 'double');
  }, [object.id, onStartEditing]);

  const handleDoubleTap = useCallback((e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    onStartEditing?.(object.id, 'double');
  }, [object.id, onStartEditing]);

  const handleMouseEnter = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    onHover?.(object.id);
  }, [object.id, onHover]);

  const handleMouseLeave = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    onHover?.(null);
  }, [onHover]);

  const shadowProps = object.shadowBlur ? {
    shadowColor: object.shadowColor || 'rgba(0,0,0,0.5)',
    shadowBlur: object.shadowBlur,
    shadowOffsetX: object.shadowOffsetX || 0,
    shadowOffsetY: object.shadowOffsetY || 0,
    shadowOpacity: object.shadowOpacity || 0.5,
  } : {};

  const commonEventProps = {
    onClick: handleClick,
    onTap: handleTap,
    onDblClick: handleDoubleClick,
    onDblTap: handleDoubleTap,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onDragStart: handleDragStart,
    onDragMove,
    onDragEnd: handleDragEnd,
  };

  const commonTransformProps = {
    rotation: object.rotation,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    opacity: object.opacity,
  };

  const isDraggable = object.draggable && !object.locked && !isEditing && isDragEnabled;

  // --- Derived text effect flags ---
  const curve = object.textCurve ?? 0;
  const isCurved = !isEditing && Math.abs(curve) >= 1;
  const hasBg = !!(object.textBgColor);
  const bgPadding = object.textBgPadding ?? 8;
  const lsParam = object.letterSpacing ?? 0;

  // --- Curved text sceneFunc ---
  const curvedSceneFunc = useCallback((ctx: Konva.Context, _shape: Konva.Shape) => {
    const nativeCtx = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
    const c = object.textCurve ?? 0;
    if (!object.text || Math.abs(c) < 1) return;

    const baseBold = object.fontStyle.includes('bold');
    const baseItalic = object.fontStyle.includes('italic');

    // Build a canvas font string from style components
    const buildFont = (bold: boolean, italic: boolean, family: string) => {
      const parts: string[] = [];
      if (italic) parts.push('italic');
      if (bold) parts.push('bold');
      parts.push(`${object.fontSize}px`);
      parts.push(getFontFallbackStack(family));
      return parts.join(' ');
    };

    // Flatten spans (or plain text) into per-character draw entries
    interface CharEntry { char: string; font: string; color: string; underline: boolean; strikethrough: boolean; }
    let chars: CharEntry[];

    if (object.richText && object.richText.length > 0) {
      chars = [];
      for (const span of object.richText) {
        const bold = span.bold ?? baseBold;
        const italic = span.italic ?? baseItalic;
        const family = span.fontFamily ?? object.fontFamily;
        const color = span.color ?? object.fill;
        const font = buildFont(bold, italic, family);
        for (const char of span.text) {
          chars.push({ char, font, color, underline: span.underline ?? false, strikethrough: span.strikethrough ?? false });
        }
      }
    } else {
      const baseFont = buildFont(baseBold, baseItalic, object.fontFamily);
      chars = [...object.text].map(char => ({
        char, font: baseFont, color: object.fill, underline: false, strikethrough: false,
      }));
    }

    nativeCtx.textBaseline = 'alphabetic';

    // Measure total text width with per-character fonts for accurate arc radius
    let totalTextWidth = 0;
    for (const entry of chars) {
      nativeCtx.font = entry.font;
      totalTextWidth += nativeCtx.measureText(entry.char).width;
    }

    const absC = Math.max(1, Math.abs(c));
    const arcAngle = (absC / 100) * Math.PI; // max 180° arc span
    const radius = totalTextWidth / Math.max(arcAngle, 0.001);
    const totalAngle = arcAngle;

    // Positive power = arch (upward curve), negative = frown (downward curve)
    const isArch = c > 0;
    const cx = object.width / 2;
    const baselineOffset = object.fontSize * 0.85;
    const cy = isArch
      ? radius + baselineOffset                              // arch: center char at top, baseline = baselineOffset
      : baselineOffset - radius * Math.cos(totalAngle / 2); // frown: endpoint chars at top, center dips to baselineOffset+sag
    const baseAngle = isArch ? -Math.PI / 2 : Math.PI / 2;
    let charAngle = isArch
      ? baseAngle - totalAngle / 2
      : baseAngle + totalAngle / 2;

    for (const entry of chars) {
      nativeCtx.font = entry.font;
      const charW = nativeCtx.measureText(entry.char).width;
      const halfStep = charW / (2 * radius);
      const midA = isArch ? charAngle + halfStep : charAngle - halfStep;

      nativeCtx.save();
      nativeCtx.translate(cx + radius * Math.cos(midA), cy + radius * Math.sin(midA));
      nativeCtx.rotate(isArch ? midA + Math.PI / 2 : midA - Math.PI / 2);

      nativeCtx.fillStyle = entry.color;
      if (object.textStrokeColor && (object.textStrokeWidth ?? 0) > 0) {
        nativeCtx.strokeStyle = object.textStrokeColor;
        nativeCtx.lineWidth = object.textStrokeWidth ?? 2;
        nativeCtx.strokeText(entry.char, -charW / 2, 0);
      }
      nativeCtx.fillText(entry.char, -charW / 2, 0);

      // Underline / strikethrough drawn in the rotated char coordinate space
      if (entry.underline || entry.strikethrough) {
        const lineW = Math.max(1, object.fontSize * 0.05);
        nativeCtx.lineWidth = lineW;
        nativeCtx.strokeStyle = entry.color;
        if (entry.underline) {
          nativeCtx.beginPath();
          nativeCtx.moveTo(-charW / 2, object.fontSize * 0.12);
          nativeCtx.lineTo(charW / 2, object.fontSize * 0.12);
          nativeCtx.stroke();
        }
        if (entry.strikethrough) {
          nativeCtx.beginPath();
          nativeCtx.moveTo(-charW / 2, -object.fontSize * 0.25);
          nativeCtx.lineTo(charW / 2, -object.fontSize * 0.25);
          nativeCtx.stroke();
        }
      }

      nativeCtx.restore();

      if (isArch) {
        charAngle += charW / radius;
      } else {
        charAngle -= charW / radius;
      }
    }
  }, [
    object.text, object.richText, object.textCurve, object.fontSize, object.fontFamily,
    object.fontStyle, object.fill, object.width,
    object.textStrokeColor, object.textStrokeWidth,
  ]);

  // --- Render: always wrap in Group so background Rect can be added ---
  const groupContent = (() => {
    if (isCurved) {
      return (
        <Shape
          ref={shapeRef}
          x={0}
          y={0}
          width={object.width}
          height={object.height}
          sceneFunc={curvedSceneFunc}
          hitFunc={(ctx, shape) => {
            ctx.beginPath();
            (ctx as unknown as CanvasRenderingContext2D & { rect: (...a: number[]) => void }).rect(0, 0, object.width, object.height);
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
        />
      );
    }

    if (richLayout) {
      return (
        <Shape
          ref={shapeRef}
          x={0}
          y={0}
          width={object.width}
          height={Math.max(1, isEditing ? object.height : richLayout.totalHeight)}
          sceneFunc={(ctx, _shape) => {
            if (!richLayout) return;
            const nativeCtx = (ctx as unknown as { _context: CanvasRenderingContext2D })._context;
            drawRichText(nativeCtx, richLayout, lsParam);
          }}
          hitFunc={(ctx, shape) => {
            ctx.beginPath();
            (ctx as unknown as CanvasRenderingContext2D & { rect: (...a: number[]) => void }).rect(0, 0, object.width, Math.max(1, richLayout.totalHeight));
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
        />
      );
    }

    return (
      <Text
        ref={textRef}
        x={0}
        y={0}
        width={object.width}
        height={isEditing ? object.height : undefined}
        text={object.text}
        fontSize={object.fontSize}
        fontFamily={getFontFallbackStack(object.fontFamily)}
        fontStyle={object.fontStyle}
        fill={object.fill}
        align={object.align}
        wrap="word"
        verticalAlign="top"
        lineHeight={object.lineHeight ?? 1.2}
        letterSpacing={object.letterSpacing ?? 0}
        textDecoration={object.textDecoration === 'none' ? '' : (object.textDecoration ?? '')}
        stroke={object.textStrokeColor}
        strokeWidth={object.textStrokeWidth ?? 0}
        strokeEnabled={!!(object.textStrokeColor && (object.textStrokeWidth ?? 0) > 0)}
      />
    );
  })();

  return (
    <Group
      x={object.x}
      y={object.y}
      {...commonTransformProps}
      {...shadowProps}
      draggable={isDraggable}
      visible={object.visible}
      listening={!isEditing}
      name={object.id}
      {...commonEventProps}
    >
      {hasBg && (
        <Rect
          x={-bgPadding}
          y={-bgPadding}
          width={object.width + bgPadding * 2}
          height={object.height + bgPadding * 2}
          fill={object.textBgColor}
          opacity={object.textBgOpacity ?? 1}
          cornerRadius={object.textBgCornerRadius ?? 0}
          listening={false}
        />
      )}
      {isEditing && (
        // Transparent placeholder keeps the Group's bounding box at the correct
        // size while the Konva text content is hidden during inline editing.
        // Without this the Group collapses to 0×0 and the Transformer draws at
        // the wrong position.
        <Rect
          x={0}
          y={0}
          width={object.width}
          height={object.height}
          fill="transparent"
          listening={false}
        />
      )}
      {!isEditing && groupContent}
    </Group>
  );
};

export default CanvasText;

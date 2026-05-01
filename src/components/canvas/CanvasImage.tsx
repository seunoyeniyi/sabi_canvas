import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { isSvgSrc, extractSvgPalette, applySvgColorReplacements } from '@sabi-canvas/lib/svgColorUtils';
import { Image, Group, Rect, Arc, Circle, Line } from 'react-konva';
import Konva from 'konva';
import type { Filter } from 'konva/lib/Node';
import { ImageObject, CanvasObject, ImageMaskShape } from '@sabi-canvas/types/canvas-objects';

interface CanvasImageProps {
  object: ImageObject;
  isSelected: boolean;
  isCropMode?: boolean;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  onDoubleClick?: (id: string) => void;
  isDragEnabled?: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

/**
 * Get a clip function for a given mask shape.
 * The clip function draws within (0, 0, width, height).
 */
const getClipFunc = (
  maskShape: ImageMaskShape,
  width: number,
  height: number
): ((ctx: Konva.Context) => void) | undefined => {
  if (!maskShape || maskShape === 'none') return undefined;

  switch (maskShape) {
    case 'circle': {
      const radius = Math.min(width, height) / 2;
      const cx = width / 2;
      const cy = height / 2;
      return (ctx: Konva.Context) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
        ctx.closePath();
      };
    }
    case 'ellipse': {
      const rx = width / 2;
      const ry = height / 2;
      return (ctx: Konva.Context) => {
        ctx.beginPath();
        ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.closePath();
      };
    }
    case 'triangle': {
      return (ctx: Konva.Context) => {
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
      };
    }
    case 'star': {
      const cx = width / 2;
      const cy = height / 2;
      const outerRadius = Math.min(width, height) / 2;
      const innerRadius = outerRadius * 0.4;
      const points = 5;
      return (ctx: Konva.Context) => {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          const angle = (Math.PI / points) * i - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };
    }
    case 'hexagon': {
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) / 2;
      return (ctx: Konva.Context) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };
    }
    case 'rounded-rect': {
      const r = Math.min(width, height) * 0.15;
      return (ctx: Konva.Context) => {
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(width - r, 0);
        ctx.quadraticCurveTo(width, 0, width, r);
        ctx.lineTo(width, height - r);
        ctx.quadraticCurveTo(width, height, width - r, height);
        ctx.lineTo(r, height);
        ctx.quadraticCurveTo(0, height, 0, height - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
      };
    }
    default:
      return undefined;
  }
};

export const CanvasImage: React.FC<CanvasImageProps> = ({
  object,
  isSelected,
  isCropMode = false,
  onSelect,
  onUpdate,
  onDragStart,
  onDragMove,
  onDragEnd,
  onHover,
  onDoubleClick,
  isDragEnabled = true,
  shouldSuppressTapSelection,
}) => {
  const imageRef = useRef<Konva.Image>(null);
  const spinnerRef = useRef<Konva.Arc>(null);

  // Apply SVG color replacements when the original src is an SVG and user has
  // set per-color overrides.  removedBgSrc (a PNG) bypasses SVG color editing.
  const displaySrc = useMemo(() => {
    if (
      !object.removedBgSrc &&
      isSvgSrc(object.src) &&
      object.svgColors &&
      Object.keys(object.svgColors).length > 0
    ) {
      return applySvgColorReplacements(object.src, object.svgColors);
    }
    return object.removedBgSrc ?? object.src;
  }, [object.removedBgSrc, object.src, object.svgColors]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    displaySrc ? 'loading' : 'error'
  );

  useEffect(() => {
    if (!displaySrc) {
      setImage(null);
      setStatus('error');
      return;
    }

    setImage(null);
    setStatus('loading');

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setStatus('loaded');

      const updates: Partial<ImageObject> = {};

      // Always store natural dimensions
      if (!object.naturalWidth || !object.naturalHeight) {
        updates.naturalWidth = img.naturalWidth;
        updates.naturalHeight = img.naturalHeight;
      }

      // Update dimensions if not set
      if (object.width === 0 || object.height === 0) {
        updates.width = img.width;
        updates.height = img.height;
      }

      // Extract SVG color palette once on the original source
      if (!object.removedBgSrc && isSvgSrc(object.src) && !object.svgPalette) {
        const palette = extractSvgPalette(object.src);
        if (palette.length > 0) {
          updates.svgPalette = palette;
        }
      }

      if (Object.keys(updates).length > 0) {
        onUpdate(object.id, updates as Partial<CanvasObject>);
      }

      // Dispatch an event so the transformer knows the image mounted on the canvas
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.dispatchEvent(new Event('canvas_image_mounted'));
        }, 50);
      }
    };
    img.onerror = () => {
      setImage(null);
      setStatus('error');
    };
    img.src = displaySrc;
  }, [displaySrc, object.id, object.src, object.removedBgSrc, object.svgPalette, object.width, object.height, object.naturalWidth, object.naturalHeight, onUpdate]);

  // Apply Konva filters whenever relevant props change
  useEffect(() => {
    if (status !== 'loaded' || !imageRef.current || !image) return;

    const node = imageRef.current;
    const filters: Filter[] = [];

    const hasColorFilter = object.colorFilter && object.colorFilter !== 'none';
    const hasBlur = (object.filterBlur ?? 0) > 0;
    const hasBrightness = (object.filterBrightness ?? 0) !== 0 || (object.filterWhites ?? 0) !== 0 || (object.filterBlacks ?? 0) !== 0 || (object.filterShadows ?? 0) !== 0;
    const hasContrast = (object.filterContrast ?? 0) !== 0;
    const hasSaturation = (object.filterSaturation ?? 0) !== 0 || (object.filterVibrance ?? 0) !== 0;
    const hasTemperature = (object.filterTemperature ?? 0) !== 0;
    const hasRGBAPreset = object.colorFilter === 'cold' || object.colorFilter === 'warm' || object.colorFilter === 'natural';

    const needsAny = hasColorFilter || hasBlur || hasBrightness || hasContrast || hasSaturation || hasTemperature;

    if (!needsAny) {
      node.filters([]);
      node.clearCache();
      node.getLayer()?.batchDraw();
      return;
    }

    // ── Color presets ───────────────────────────────────────────────
    if (object.colorFilter === 'grayscale') {
      filters.push(Konva.Filters.Grayscale);
    } else if (object.colorFilter === 'sepia') {
      filters.push(Konva.Filters.Sepia);
    } else if (hasRGBAPreset) {
      // cold/warm/natural handled via RGBA below
    }

    // ── Blur ────────────────────────────────────────────────────────
    if (hasBlur) {
      filters.push(Konva.Filters.Blur);
      node.blurRadius(object.filterBlur ?? 0);
    }

    // ── Brightness (combines filterBrightness + Whites + Blacks) ────
    if (hasBrightness) {
      filters.push(Konva.Filters.Brighten);
      // Whites lifts highlights, Blacks clips shadows, Shadows lifts/crushes shadow tones
      const combined =
        ((object.filterBrightness ?? 0) +
          (object.filterWhites ?? 0) * 0.5 +
          (object.filterShadows ?? 0) * 0.35 +
          (object.filterBlacks ?? 0) * 0.2) /
        100;
      node.brightness(Math.max(-1, Math.min(1, combined)));
    }

    // ── Contrast ────────────────────────────────────────────────────
    if (hasContrast) {
      filters.push(Konva.Filters.Contrast);
      node.contrast(object.filterContrast ?? 0);
    }

    // ── Saturation / Vibrance via HSL ───────────────────────────────
    if (hasSaturation) {
      filters.push(Konva.Filters.HSL);
      const satCombined = ((object.filterSaturation ?? 0) + (object.filterVibrance ?? 0) * 0.7) / 100;
      node.saturation(Math.max(-2, Math.min(10, satCombined)));
    }

    // ── Temperature + RGBA presets ──────────────────────────────────
    // Konva RGBA filter multiplies each channel by value/255.
    // Adjustments expressed as offsets from 255 (0 = no change, negative = darken channel).
    const tempVal = object.filterTemperature ?? 0;
    let rAdj = 0, gAdj = 0, bAdj = 0;

    if (object.colorFilter === 'cold') { rAdj = -60; gAdj = -30; }
    else if (object.colorFilter === 'warm') { gAdj = -22; bAdj = -72; }
    else if (object.colorFilter === 'natural') { bAdj = -10; }

    // Temperature slider: warm positive = reduce blue; cool negative = reduce red
    const t = tempVal / 100;
    if (t > 0) { bAdj += Math.round(-t * 75); gAdj += Math.round(-t * 18); }
    else if (t < 0) { rAdj += Math.round(t * 75); }

    if (rAdj !== 0 || gAdj !== 0 || bAdj !== 0) {
      filters.push(Konva.Filters.RGBA);
      node.red(Math.max(0, Math.min(255, 255 + rAdj)));
      node.green(Math.max(0, Math.min(255, 255 + gAdj)));
      node.blue(Math.max(0, Math.min(255, 255 + bAdj)));
      node.alpha(1);
    }

    node.cache();
    node.filters(filters);
    node.getLayer()?.batchDraw();
  }, [
    status, image,
    object.colorFilter, object.filterBlur, object.filterBrightness,
    object.filterContrast, object.filterSaturation, object.filterTemperature,
    object.filterVibrance, object.filterWhites, object.filterShadows, object.filterBlacks,
  ]);

  // Spinner RAF animation
  useEffect(() => {
    if (status !== 'loading') return;
    let rafId: number;
    let angle = 0;
    const animate = () => {
      angle = (angle + 4) % 360;
      if (spinnerRef.current) {
        spinnerRef.current.rotation(angle);
        spinnerRef.current.getLayer()?.batchDraw();
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  const setStageCursor = useCallback((e: Konva.KonvaEventObject<MouseEvent | DragEvent>, cursor: string) => {
    const container = e.target.getStage()?.container();
    if (container) {
      container.style.cursor = cursor;
    }
  }, []);

  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    onDragStart?.(e);
    setStageCursor(e, 'move');
  }, [onDragStart, setStageCursor]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    setStageCursor(e, '');

    if (onDragEnd) {
      onDragEnd(e);
    }
    onUpdate(object.id, {
      x: e.target.x(),
      y: e.target.y(),
    });
  }, [onDragEnd, onUpdate, object.id, setStageCursor]);

  const handleClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
    onSelect(object.id, isMultiSelect);
  }, [onSelect, object.id, shouldSuppressTapSelection]);

  const handleTap = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    e.cancelBubble = true;
    if (shouldSuppressTapSelection?.()) return;
    onSelect(object.id);
  }, [onSelect, object.id, shouldSuppressTapSelection]);

  const handleMouseEnter = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (onHover) onHover(object.id);
  }, [onHover, object.id]);

  const handleMouseLeave = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (onHover) onHover(null);
  }, [onHover]);

  const handleDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    if (onDoubleClick) onDoubleClick(object.id);
  }, [onDoubleClick, object.id]);

  const handleDblTap = useCallback((e: Konva.KonvaEventObject<Event>) => {
    e.cancelBubble = true;
    // Disable crop mode on mobile/touch — double-tap misbehaves on touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;
    if (onDoubleClick) onDoubleClick(object.id);
  }, [onDoubleClick, object.id]);

  // ── Placeholder (loading or error) ──────────────────────────────────────
  if (status !== 'loaded' || !image) {
    const pw = object.width || 150;
    const ph = object.height || 150;
    const isLoading = status === 'loading';

    // Spinner sizing
    const spinnerR = Math.min(Math.max(Math.min(pw, ph) * 0.1, 10), 30);
    const spinnerSW = Math.max(2, spinnerR * 0.28);

    // Broken-image icon sizing
    const iconS = Math.min(Math.max(Math.min(pw, ph) * 0.35, 20), 80);
    const iconSW = Math.max(1.5, iconS * 0.06);
    const iconX = (pw - iconS) / 2;
    const iconY = (ph - iconS) / 2;
    // Sun in top-right quarter of frame
    const sunCx = iconX + iconS * 0.72;
    const sunCy = iconY + iconS * 0.28;
    // Mountain polyline: bottom-left peak, mid valley, right peak
    const mtnPts = [
      iconX + iconS * 0.08,  iconY + iconS * 0.82,
      iconX + iconS * 0.38,  iconY + iconS * 0.50,
      iconX + iconS * 0.58,  iconY + iconS * 0.68,
      iconX + iconS * 0.78,  iconY + iconS * 0.40,
      iconX + iconS * 0.95,  iconY + iconS * 0.82,
    ];

    const maskShape = object.maskShape || 'none';
    const clipFunc = getClipFunc(maskShape, pw, ph);

    const placeholderContent = (
      <>
        {/* Background */}
        <Rect width={pw} height={ph} fill="#e9ecef" />

        {isLoading ? (
          <>
            {/* Track ring */}
            <Arc
              x={pw / 2}
              y={ph / 2}
              innerRadius={spinnerR - spinnerSW / 2}
              outerRadius={spinnerR + spinnerSW / 2}
              angle={360}
              fill="#c4c9d4"
            />
            {/* Spinner arc */}
            <Arc
              ref={spinnerRef}
              x={pw / 2}
              y={ph / 2}
              innerRadius={spinnerR - spinnerSW / 2}
              outerRadius={spinnerR + spinnerSW / 2}
              angle={280}
              fill="#6b7280"
            />
          </>
        ) : (
          <>
            {/* Broken-image icon: frame */}
            <Rect
              x={iconX}
              y={iconY}
              width={iconS}
              height={iconS}
              stroke="#9ca3af"
              strokeWidth={iconSW}
              cornerRadius={iconS * 0.08}
            />
            {/* Sun */}
            <Circle
              x={sunCx}
              y={sunCy}
              radius={iconS * 0.12}
              stroke="#9ca3af"
              strokeWidth={iconSW}
            />
            {/* Mountains */}
            <Line
              points={mtnPts}
              stroke="#9ca3af"
              strokeWidth={iconSW}
              lineCap="round"
              lineJoin="round"
            />
            {/* Diagonal slash */}
            <Line
              points={[iconX, iconY, iconX + iconS, iconY + iconS]}
              stroke="#9ca3af"
              strokeWidth={iconSW}
            />
          </>
        )}
      </>
    );

    if (clipFunc) {
      return (
        <Group
          x={object.x}
          y={object.y}
          width={pw}
          height={ph}
          rotation={object.rotation}
          scaleX={object.scaleX}
          scaleY={object.scaleY}
          opacity={object.opacity}
          draggable={object.draggable && !object.locked && isDragEnabled}
          visible={object.visible}
          onClick={handleClick}
          onTap={handleTap}
          onDblClick={handleDblClick}
          onDblTap={handleDblTap}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onDragStart={handleDragStart}
          onDragMove={onDragMove}
          onDragEnd={handleDragEnd}
          name={object.id}
          clipFunc={clipFunc}
        >
          {placeholderContent}
        </Group>
      );
    }

    return (
      <Group
        x={object.x}
        y={object.y}
        width={pw}
        height={ph}
        rotation={object.rotation}
        scaleX={object.scaleX}
        scaleY={object.scaleY}
        opacity={object.opacity}
        draggable={object.draggable && !object.locked && isDragEnabled}
        visible={object.visible}
        onClick={handleClick}
        onTap={handleTap}
        onDblClick={handleDblClick}
        onDblTap={handleDblTap}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragStart={handleDragStart}
        onDragMove={onDragMove}
        onDragEnd={handleDragEnd}
        name={object.id}
      >
        {placeholderContent}
      </Group>
    );
  }

  // ── Loaded image ─────────────────────────────────────────────────────────
  // When in crop mode, show the FULL uncropped image at its ORIGINAL display size
  const hasCrop = !isCropMode && object.cropX != null && object.cropY != null &&
    object.cropWidth != null && object.cropHeight != null &&
    object.cropWidth > 0 && object.cropHeight > 0;

  const cropProps = hasCrop
    ? {
        crop: {
          x: object.cropX!,
          y: object.cropY!,
          width: object.cropWidth!,
          height: object.cropHeight!,
        },
      }
    : {};

  // In crop mode: compute the full image display size and position
  // so the full image "expands" around the current crop region
  const nw = object.naturalWidth || object.width;
  const nh = object.naturalHeight || object.height;

  let displayX = object.x;
  let displayY = object.y;
  let displayW = object.width;
  let displayH = object.height;
  // Local offsets used when rendering inside a rotated Group in crop mode
  let expandOffsetX = 0;
  let expandOffsetY = 0;

  if (isCropMode && object.cropWidth && object.cropHeight) {
    // Display scale: how many display px per natural px
    const displayScale = object.width / object.cropWidth;
    // Full image display size
    displayW = nw * displayScale;
    displayH = nh * displayScale;
    // How far the full image is offset behind the crop region (in local/design space)
    expandOffsetX = (object.cropX || 0) * displayScale;
    expandOffsetY = (object.cropY || 0) * displayScale;
    displayX = object.x - expandOffsetX;
    displayY = object.y - expandOffsetY;
  }

  // Mask shape clipping (not applied during crop mode)
  const maskShape = (!isCropMode && object.maskShape) || 'none';
  const clipFunc = getClipFunc(maskShape, object.width, object.height);

  // Border / stroke overlay (suppressed in crop mode)
  const hasBorder = !isCropMode && !!object.stroke && (object.strokeWidth ?? 0) > 0;
  const borderRect = hasBorder ? (
    <Rect
      x={0}
      y={0}
      width={object.width}
      height={object.height}
      fill="transparent"
      stroke={object.stroke}
      strokeWidth={object.strokeWidth}
      listening={false}
      perfectDrawEnabled={false}
    />
  ) : null;

  // When there is a clip mask OR a border, use a Group wrapper so both the
  // image and any overlay (border / clip) share the same transform.
  const needsGroup = !!(clipFunc || hasBorder);

  const imageNode = (
    <Image
      ref={imageRef}
      image={image}
      // In crop mode (always non-group): anchor the image at the rotation pivot (object.x/y)
      // and use offsetX/offsetY to shift the full image behind the crop region. This keeps the
      // Konva node type as Image throughout so the transformer never loses its attachment.
      x={needsGroup ? 0 : object.x}
      y={needsGroup ? 0 : object.y}
      offsetX={needsGroup ? 0 : (isCropMode ? expandOffsetX : 0)}
      offsetY={needsGroup ? 0 : (isCropMode ? expandOffsetY : 0)}
      width={displayW}
      height={displayH}
      rotation={needsGroup ? 0 : object.rotation}
      scaleX={needsGroup ? 1 : object.scaleX}
      scaleY={needsGroup ? 1 : object.scaleY}
      opacity={needsGroup ? 1 : object.opacity}
      draggable={needsGroup ? false : (object.draggable && !object.locked && isDragEnabled && !isCropMode)}
      visible={object.visible}
      onClick={needsGroup ? undefined : handleClick}
      onTap={needsGroup ? undefined : handleTap}
      onDblClick={needsGroup ? undefined : handleDblClick}
      onDblTap={needsGroup ? undefined : handleDblTap}
      onMouseEnter={needsGroup ? undefined : handleMouseEnter}
      onMouseLeave={needsGroup ? undefined : handleMouseLeave}
      onDragStart={needsGroup ? undefined : handleDragStart}
      onDragMove={needsGroup ? undefined : onDragMove}
      onDragEnd={needsGroup ? undefined : handleDragEnd}
      name={needsGroup ? undefined : object.id}
      {...cropProps}
    />
  );

  if (needsGroup) {
    return (
      <Group
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        rotation={object.rotation}
        scaleX={object.scaleX}
        scaleY={object.scaleY}
        opacity={object.opacity}
        draggable={object.draggable && !object.locked && isDragEnabled}
        visible={object.visible}
        onClick={handleClick}
        onTap={handleTap}
        onDblClick={handleDblClick}
        onDblTap={handleDblTap}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragStart={handleDragStart}
        onDragMove={onDragMove}
        onDragEnd={handleDragEnd}
        name={object.id}
        clipFunc={clipFunc}
      >
        {imageNode}
        {borderRect}
      </Group>
    );
  }

  return imageNode;
};

export default CanvasImage;

import React, { useMemo, useState, useEffect } from 'react';
import { Rect, Group, Line } from 'react-konva';
import { SafeAreaProps } from '@sabi-canvas/types/canvas';
import type { CanvasBackground } from '@sabi-canvas/types/pages';

// Helper: compute linear gradient stops for Konva ([offset, color, offset, color, ...])
function linearGradientColorStops(colors: string[]): (string | number)[] {
  if (colors.length === 0) return [0, '#ffffff', 1, '#ffffff'];
  if (colors.length === 1) return [0, colors[0], 1, colors[0]];
  return colors.flatMap((c, i) => [i / (colors.length - 1), c]);
}

// Helper: compute gradient start/end points from angle (degrees), width, height
function linearGradientPoints(
  angle: number,
  width: number,
  height: number
): { startX: number; startY: number; endX: number; endY: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = width / 2;
  const cy = height / 2;
  // Project to half-diagonal so gradient always spans full rect
  const len =
    Math.abs(cos) * width / 2 + Math.abs(sin) * height / 2;
  return {
    startX: cx - cos * len,
    startY: cy - sin * len,
    endX: cx + cos * len,
    endY: cy + sin * len,
  };
}

// Helper: derive fill props from a CanvasBackground value
function resolveFillProps(
  bg: CanvasBackground | undefined,
  fallbackColor: string,
  width: number,
  height: number,
  patternImage: HTMLImageElement | null
): Record<string, unknown> {
  if (!bg || bg.type === 'solid') {
    const solidColor = bg?.type === 'solid' ? bg.color : fallbackColor;
    return { fill: solidColor };
  }

  if (bg.type === 'transparent') {
    return { fill: 'transparent' };
  }

  if (bg.type === 'linear-gradient') {
    const pts = linearGradientPoints(bg.angle ?? 0, width, height);
    return {
      fillLinearGradientStartPoint: { x: pts.startX, y: pts.startY },
      fillLinearGradientEndPoint: { x: pts.endX, y: pts.endY },
      fillLinearGradientColorStops: linearGradientColorStops(bg.colors),
    };
  }

  if (bg.type === 'radial-gradient') {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.max(width, height) / 2;
    return {
      fillRadialGradientStartPoint: { x: cx, y: cy },
      fillRadialGradientEndPoint: { x: cx, y: cy },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: r,
      fillRadialGradientColorStops: linearGradientColorStops(bg.colors),
    };
  }

  if (bg.type === 'image' && patternImage) {
    // Cover-scale: scale pattern so that it covers the rect entirely
    const scaleX = width / patternImage.naturalWidth;
    const scaleY = height / patternImage.naturalHeight;
    const scale = Math.max(scaleX, scaleY);
    const offsetX = (patternImage.naturalWidth * scale - width) / 2;
    const offsetY = (patternImage.naturalHeight * scale - height) / 2;
    return {
      fillPatternImage: patternImage,
      fillPatternScaleX: scale,
      fillPatternScaleY: scale,
      fillPatternOffsetX: offsetX / scale,
      fillPatternOffsetY: offsetY / scale,
    };
  }

  // Fallback (image not loaded yet)
  return { fill: fallbackColor };
}

export const SafeArea: React.FC<SafeAreaProps> = ({
  x,
  y,
  width,
  height,
  showBorder = true,
  showGrid = true,
  gridSize = 20,
  fillColor = '#ffffff',
  borderColor = '#3b82f6',
  background,
}) => {
  // Load background image when bg.type === 'image'
  const [patternImage, setPatternImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!background || background.type !== 'image') {
      setPatternImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setPatternImage(img);
    img.onerror = () => setPatternImage(null);
    img.src = background.src;
  }, [background]);

  // Generate grid lines
  const gridLines = useMemo(() => {
    if (!showGrid || width <= 0 || height <= 0) return [];
    
    const lines: React.ReactNode[] = [];
    const gridColor = 'rgba(0, 0, 0, 0.05)';
    
    // Vertical lines
    for (let i = gridSize; i < width; i += gridSize) {
      lines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, height]}
          stroke={gridColor}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    
    // Horizontal lines
    for (let i = gridSize; i < height; i += gridSize) {
      lines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, width, i]}
          stroke={gridColor}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    
    return lines;
  }, [showGrid, width, height, gridSize]);

  const fillProps = useMemo(
    () => resolveFillProps(background, fillColor, width, height, patternImage),
    [background, fillColor, width, height, patternImage]
  );

  if (width <= 0 || height <= 0) return null;

  const isTransparent = background?.type === 'transparent';

  return (
    <Group name="safe-area" x={x} y={y} clipX={0} clipY={0} clipWidth={width} clipHeight={height}>
      {/* Safe area background */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        {...(fillProps as object)}
        shadowColor={isTransparent ? undefined : 'rgba(0, 0, 0, 0.15)'}
        shadowBlur={isTransparent ? 0 : 20}
        shadowOffsetX={0}
        shadowOffsetY={isTransparent ? 0 : 4}
        listening={false}
      />
      
      {/* Grid lines */}
      {gridLines}
      
      {/* Border */}
      {showBorder && (
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke={borderColor}
          strokeWidth={2}
          listening={false}
        />
      )}
      
      {/* Corner handles (visual indicators) */}
      {showBorder && (
        <>
          {/* Top-left */}
          <Rect x={-2} y={-2} width={12} height={3} fill={borderColor} listening={false} />
          <Rect x={-2} y={-2} width={3} height={12} fill={borderColor} listening={false} />
          
          {/* Top-right */}
          <Rect x={width - 10} y={-2} width={12} height={3} fill={borderColor} listening={false} />
          <Rect x={width - 1} y={-2} width={3} height={12} fill={borderColor} listening={false} />
          
          {/* Bottom-left */}
          <Rect x={-2} y={height - 1} width={12} height={3} fill={borderColor} listening={false} />
          <Rect x={-2} y={height - 10} width={3} height={12} fill={borderColor} listening={false} />
          
          {/* Bottom-right */}
          <Rect x={width - 10} y={height - 1} width={12} height={3} fill={borderColor} listening={false} />
          <Rect x={width - 1} y={height - 10} width={3} height={12} fill={borderColor} listening={false} />
        </>
      )}
    </Group>
  );
};

export default SafeArea;

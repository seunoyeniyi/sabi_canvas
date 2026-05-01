import { useCallback, useState, useRef } from 'react';
import Konva from 'konva';
import { jsPDF } from 'jspdf';
import { ensureFontFamiliesReady } from '@sabi-canvas/lib/fontLoader';
import type { CanvasBackground } from '@sabi-canvas/types/pages';

// ─── Background rendering helpers (mirror of SafeArea.tsx helpers) ────────────

function gradientColorStops(colors: string[]): (string | number)[] {
  if (colors.length === 0) return [0, '#ffffff', 1, '#ffffff'];
  if (colors.length === 1) return [0, colors[0], 1, colors[0]];
  return colors.flatMap((c, i) => [i / (colors.length - 1), c]);
}

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
  const len = Math.abs(cos) * width / 2 + Math.abs(sin) * height / 2;
  return { startX: cx - cos * len, startY: cy - sin * len, endX: cx + cos * len, endY: cy + sin * len };
}

/**
 * Adds a background Rect to the given layer matching the page's CanvasBackground.
 * Returns a Promise to support async image loading.
 */
async function addExportBackground(
  layer: Konva.Layer,
  background: CanvasBackground | undefined,
  width: number,
  height: number,
  transparentBackground: boolean
): Promise<void> {
  // Dialog's "Transparent background" toggle overrides everything
  if (transparentBackground) return;

  // Transparent page background → no fill
  if (!background || background.type === 'transparent') return;

  if (background.type === 'solid') {
    layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: background.color }));
    return;
  }

  if (background.type === 'linear-gradient') {
    const pts = linearGradientPoints(background.angle ?? 0, width, height);
    layer.add(new Konva.Rect({
      x: 0, y: 0, width, height,
      fillLinearGradientStartPoint: { x: pts.startX, y: pts.startY },
      fillLinearGradientEndPoint: { x: pts.endX, y: pts.endY },
      fillLinearGradientColorStops: gradientColorStops(background.colors),
    }));
    return;
  }

  if (background.type === 'radial-gradient') {
    const cx = width / 2;
    const cy = height / 2;
    layer.add(new Konva.Rect({
      x: 0, y: 0, width, height,
      fillRadialGradientStartPoint: { x: cx, y: cy },
      fillRadialGradientEndPoint: { x: cx, y: cy },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: Math.max(width, height) / 2,
      fillRadialGradientColorStops: gradientColorStops(background.colors),
    }));
    return;
  }

  if (background.type === 'image') {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new window.Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = background.src;
    });
    if (img) {
      const scaleX = width / img.naturalWidth;
      const scaleY = height / img.naturalHeight;
      const scale = Math.max(scaleX, scaleY);
      layer.add(new Konva.Rect({
        x: 0, y: 0, width, height,
        fillPatternImage: img,
        fillPatternScaleX: scale,
        fillPatternScaleY: scale,
        fillPatternOffsetX: (img.naturalWidth * scale - width) / 2 / scale,
        fillPatternOffsetY: (img.naturalHeight * scale - height) / 2 / scale,
      }));
    } else {
      // Fallback white if image fails to load
      layer.add(new Konva.Rect({ x: 0, y: 0, width, height, fill: '#ffffff' }));
    }
  }
}

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  quality: number; // 0-100
  sizeMultiplier: number; // 1, 2, 3, 4
  transparentBackground: boolean;
  fileName?: string;
  /** When set, crops the export to this region and forces a transparent background */
  printAreaBounds?: { x: number; y: number; width: number; height: number };
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'png',
  quality: 92,
  sizeMultiplier: 1,
  transparentBackground: false,
  fileName: 'design',
};

const MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

export interface UseCanvasExportReturn {
  exportCanvas: (options?: Partial<ExportOptions>) => Promise<void>;
  generatePreview: (options?: Partial<ExportOptions>) => Promise<string | null>;
  isExporting: boolean;
}

/**
 * Hook for exporting Konva canvas content to various image formats.
 * Renders only the safe-area (design area) content at the specified resolution.
 */
export const useCanvasExport = (
  stageRef: React.RefObject<Konva.Stage> | null,
  canvasSize: { width: number; height: number },
  pageBackground?: CanvasBackground
): UseCanvasExportReturn => {
  const [isExporting, setIsExporting] = useState(false);
  const abortRef = useRef(false);

  /**
   * Finds the safe-area rectangle coordinates from the stage.
   * The safe area is the main design content area rendered inside the stage.
   */
  const findSafeAreaRect = useCallback((stage: Konva.Stage) => {
    // Look for SafeArea group/rect: it's the white rectangle in the first layer
    const layers = stage.getLayers();
    if (layers.length === 0) return null;

    const contentLayer = layers[0];
    // The SafeArea rect is the first Rect with fillColor matching safeAreaColor
    // We find it by looking at the Group children
    const children = contentLayer.getChildren();
    
    for (const child of children) {
      if (child instanceof Konva.Group) {
        const groupChildren = child.getChildren();
        for (const gc of groupChildren) {
          if (gc instanceof Konva.Rect && gc.fill() === '#ffffff') {
            return {
              x: child.x() + gc.x(),
              y: child.y() + gc.y(),
              width: gc.width() * (child.scaleX() || 1),
              height: gc.height() * (child.scaleY() || 1),
              scale: child.scaleX() || 1,
            };
          }
        }
      }
    }
    
    return null;
  }, []);

  /**
   * Creates a clean clone of the stage content for export.
   * Only includes the content within the safe area bounds.
   */
  const createExportStage = useCallback((
    stage: Konva.Stage,
    options: ExportOptions
  ): { container: HTMLDivElement; exportStage: Konva.Stage } | null => {
    const { sizeMultiplier, transparentBackground } = options;
    const { width: designWidth, height: designHeight } = canvasSize;

    const exportWidth = designWidth * sizeMultiplier;
    const exportHeight = designHeight * sizeMultiplier;

    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    // Create export stage at the exact design dimensions
    const exportStage = new Konva.Stage({
      container,
      width: exportWidth,
      height: exportHeight,
    });

    const exportLayer = new Konva.Layer();
    exportStage.add(exportLayer);

    // Add background rect if not transparent
    if (!transparentBackground) {
      const bgRect = new Konva.Rect({
        x: 0,
        y: 0,
        width: exportWidth,
        height: exportHeight,
        fill: '#ffffff',
      });
      exportLayer.add(bgRect);
    }

    // Find the safe area to get the offset and scale
    const safeAreaInfo = findSafeAreaRect(stage);
    if (!safeAreaInfo) {
      // Fallback: just use the stage as-is
      container.remove();
      return null;
    }

    // Clone the content from the original stage's first layer
    // We need to find the CanvasObjects group (the second Group in the content layer)
    const contentLayer = stage.getLayers()[0];
    const children = contentLayer.getChildren();

    // Create a group that transforms from the original coordinate system
    // to our export coordinate system
    const contentGroup = new Konva.Group({
      x: 0,
      y: 0,
      scaleX: sizeMultiplier,
      scaleY: sizeMultiplier,
      clipX: 0,
      clipY: 0,
      clipWidth: designWidth,
      clipHeight: designHeight,
    });

    // Clone each object from the objects group
    for (const child of children) {
      if (child instanceof Konva.Group) {
        const firstChild = child.getChildren()[0];
        // Skip the SafeArea group (identified by its Rect fill)
        if (firstChild instanceof Konva.Rect && firstChild.fill() === '#ffffff') {
          continue;
        }
        // This is the content group - clone its children
        // The content group has offset and scale applied
        const originalScale = child.scaleX() || 1;
        const originalOffsetX = child.x();
        const originalOffsetY = child.y();

        // Clone each actual canvas object
        for (const objNode of child.getChildren()) {
          const cloned = objNode.clone();
          // Adjust position: remove the original offset and work in design coordinates
          contentGroup.add(cloned);
        }

        // Transfer the group's transform
        contentGroup.x(0);
        contentGroup.y(0);
        // The objects inside are already in design coordinates (scaled by originalScale)
        // We need to keep that scale relationship
        contentGroup.scaleX((originalScale / originalScale) * sizeMultiplier);
        contentGroup.scaleY((originalScale / originalScale) * sizeMultiplier);
      }
    }

    exportLayer.add(contentGroup);
    exportLayer.draw();

    return { container, exportStage };
  }, [canvasSize, findSafeAreaRect]);

  /**
   * Alternative simpler export approach: use toDataURL with clipping
   */
  const exportUsingClipping = useCallback(async (
    stage: Konva.Stage,
    options: ExportOptions
  ): Promise<string | null> => {
    const { format, quality, sizeMultiplier, transparentBackground, printAreaBounds } = options;
    const { width: designWidth, height: designHeight } = canvasSize;

    const textNodes = stage.find('Text');
    const stageFontFamilies = Array.from(new Set(textNodes
      .map((node) => {
        if (!(node instanceof Konva.Text)) return '';
        return node.fontFamily().split(',')[0]?.replace(/["']/g, '').trim() ?? '';
      })
      .filter(Boolean)));

    await ensureFontFamiliesReady(stageFontFamilies, {
      concurrency: 4,
      maxFonts: 300,
      timeoutMs: 2600,
    });

    // Determine output region: full canvas or cropped to print area
    const refX = printAreaBounds?.x ?? 0;
    const refY = printAreaBounds?.y ?? 0;
    const refWidth = printAreaBounds?.width ?? designWidth;
    const refHeight = printAreaBounds?.height ?? designHeight;

    // Print-area exports are always transparent (customer design only, no mockup bg)
    const useTransparentBg = transparentBackground || !!printAreaBounds;

    const exportWidth = refWidth * sizeMultiplier;
    const exportHeight = refHeight * sizeMultiplier;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    document.body.appendChild(container);

    const exportStage = new Konva.Stage({
      container,
      width: exportWidth,
      height: exportHeight,
    });

    const exportLayer = new Konva.Layer();
    exportStage.add(exportLayer);

    // Content group: offset to print-area origin and scaled to output resolution.
    // clipX/clipY/clipWidth/clipHeight are in LOCAL (design) coordinates.
    const exportContentGroup = new Konva.Group({
      x: -refX * sizeMultiplier,
      y: -refY * sizeMultiplier,
      scaleX: sizeMultiplier,
      scaleY: sizeMultiplier,
      clipX: refX,
      clipY: refY,
      clipWidth: refWidth,
      clipHeight: refHeight,
    });

    const contentLayer = stage.getLayers()[0];
    const children = contentLayer?.getChildren() ?? [];

    const isSafeAreaGroup = (group: Konva.Group) => group.name() === 'safe-area';
    const isPrintAreaNode = (node: Konva.Node) => {
      const nodeId = node.id();
      return nodeId === 'print-area-frame' || nodeId === 'print-area-label';
    };

    for (const child of children) {
      if (!(child instanceof Konva.Group)) continue;
      if (isSafeAreaGroup(child)) continue;
      // For print-area export, skip the mockup layer — only customer objects are exported
      if (printAreaBounds && child.name() === 'canvas-mockup-layer') continue;

      for (const node of child.getChildren()) {
        if (isPrintAreaNode(node)) continue;
        exportContentGroup.add(node.clone());
      }
    }

    // Render background before content
    await addExportBackground(exportLayer, pageBackground, exportWidth, exportHeight, useTransparentBg);

    exportLayer.add(exportContentGroup);
    exportLayer.draw();

    try {
      // For PDF, always render as high-quality PNG first
      const mimeType = format === 'pdf' ? 'image/png' : MIME_TYPES[format];
      const imgQuality = (format === 'png' || format === 'pdf') ? undefined : quality / 100;

      const dataUrl = exportStage.toDataURL({
        mimeType,
        quality: imgQuality,
      });

      return dataUrl;
    } finally {
      exportStage.destroy();
      container.remove();
    }
  }, [canvasSize, pageBackground]);

  const generatePreview = useCallback(async (
    partialOptions?: Partial<ExportOptions>
  ): Promise<string | null> => {
    const stage = stageRef?.current;
    if (!stage) return null;

    const options: ExportOptions = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...partialOptions,
      sizeMultiplier: 1, // Always 1× for preview
    };

    return exportUsingClipping(stage, options);
  }, [stageRef, exportUsingClipping]);

  const exportCanvas = useCallback(async (
    partialOptions?: Partial<ExportOptions>
  ) => {
    const stage = stageRef?.current;
    if (!stage || isExporting) return;

    const options: ExportOptions = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...partialOptions,
    };

    setIsExporting(true);
    abortRef.current = false;

    try {
      const dataUrl = await exportUsingClipping(stage, options);
      if (!dataUrl || abortRef.current) return;

      if (options.format === 'pdf') {
        // Generate PDF with embedded high-res image
        const { width: designWidth, height: designHeight } = canvasSize;
        const pxWidth = designWidth * options.sizeMultiplier;
        const pxHeight = designHeight * options.sizeMultiplier;

        // Convert px to mm at 72 DPI (1 inch = 25.4mm, 1 inch = 72 px at base)
        const DPI = 72 * options.sizeMultiplier;
        const mmWidth = (pxWidth / DPI) * 25.4;
        const mmHeight = (pxHeight / DPI) * 25.4;

        const orientation = mmWidth > mmHeight ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
          orientation,
          unit: 'mm',
          format: [mmWidth, mmHeight],
          compress: true,
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
        pdf.save(`${options.fileName || 'design'}.pdf`);
      } else {
        // Trigger image download
        const link = document.createElement('a');
        link.download = `${options.fileName || 'design'}.${options.format}`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [stageRef, isExporting, exportUsingClipping]);

  return {
    exportCanvas,
    generatePreview,
    isExporting,
  };
};

export default useCanvasExport;

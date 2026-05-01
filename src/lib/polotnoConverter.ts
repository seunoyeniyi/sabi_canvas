/**
 * Converts a Polotno JSON export (from polotno.com) into Canvas Architect pages + canvas size.
 *
 * Supported Polotno object types:
 *   - image  → ImageObject
 *   - svg    → ImageObject (with colorsReplace applied inline to the base64 SVG)
 *   - text   → TextObject
 *
 * Unknown types are skipped with a console.warn.
 */

import { CanvasObject, ImageObject, TextObject, generateObjectId } from '@sabi-canvas/types/canvas-objects';
import { CanvasBackground, CanvasPage } from '@sabi-canvas/types/pages';

// ─── Polotno JSON types ───────────────────────────────────────────────────────

interface PolotnoBase {
  id: string;
  type: string;
  name?: string;
  opacity?: number;
  visible?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  // Filters
  blurEnabled?: boolean;
  blurRadius?: number;
  brightnessEnabled?: boolean;
  brightness?: number;
  sepiaEnabled?: boolean;
  grayscaleEnabled?: boolean;
  // Shadow
  shadowEnabled?: boolean;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowColor?: string;
  shadowOpacity?: number;
}

interface PolotnoImageObject extends PolotnoBase {
  type: 'image';
  src: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  flipX?: boolean;
  flipY?: boolean;
  borderColor?: string;
  borderSize?: number;
  cornerRadius?: number;
}

interface PolotnoSvgObject extends PolotnoBase {
  type: 'svg';
  src: string; // data:image/svg+xml;base64,...
  colorsReplace?: Record<string, string>;
  maskSrc?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  flipX?: boolean;
  flipY?: boolean;
  borderColor?: string;
  borderSize?: number;
  cornerRadius?: number;
}

interface PolotnoTextObject extends PolotnoBase {
  type: 'text';
  text: string;
  placeholder?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;       // 'normal' | 'italic'
  fontWeight?: string;      // 'normal' | 'bold'
  textDecoration?: string;  // '' | 'underline' | 'line-through'
  textTransform?: string;
  fill?: string;
  align?: string;           // 'left' | 'center' | 'right'
  verticalAlign?: string;
  lineHeight?: number;
  letterSpacing?: number;
  strokeWidth?: number;
  stroke?: string;
  backgroundEnabled?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundCornerRadius?: number;
  backgroundPadding?: number;
}

type PolotnoObject =
  | PolotnoImageObject
  | PolotnoSvgObject
  | PolotnoTextObject
  | (PolotnoBase & { type: string });

interface PolotnoPage {
  id: string;
  children: PolotnoObject[];
  background?: string;
  width?: string | number;
  height?: string | number;
}

interface PolotnoDesignJson {
  width: number;
  height: number;
  pages: PolotnoPage[];
}

// ─── Public result types ──────────────────────────────────────────────────────

export interface PolotnoImportResult {
  pages: CanvasPage[];
  width: number;
  height: number;
}

export interface PolotnoImportError {
  error: string;
}

// ─── SVG color replacement ─────────────────────────────────────────────────────

function applySvgColorReplacements(
  src: string,
  colorsReplace: Record<string, string>,
): string {
  const PREFIX = 'data:image/svg+xml;base64,';
  if (!src.startsWith(PREFIX)) return src;

  try {
    const base64Part = src.slice(PREFIX.length);
    let svgText = atob(base64Part);

    for (const [from, to] of Object.entries(colorsReplace)) {
      // Simple string split/join replace – avoids regex escaping issues with
      // color strings that contain parens, dots, etc.
      svgText = svgText.split(from).join(to);
    }

    return PREFIX + btoa(svgText);
  } catch {
    return src;
  }
}

// ─── Base field mapping ────────────────────────────────────────────────────────

function mapBaseFields(polotno: PolotnoBase): Omit<CanvasObject, 'type'> {
  const base: Record<string, unknown> = {
    id: generateObjectId(),
    x: polotno.x,
    y: polotno.y,
    width: polotno.width,
    height: polotno.height,
    rotation: polotno.rotation ?? 0,
    scaleX: 1,
    scaleY: 1,
    opacity: polotno.opacity ?? 1,
    visible: polotno.visible ?? true,
    draggable: true,
    locked: false,
    name: polotno.name ?? '',
  };

  // Filters
  if (polotno.blurEnabled && polotno.blurRadius) {
    base.filterBlur = polotno.blurRadius;
  }
  if (polotno.brightnessEnabled && typeof polotno.brightness === 'number') {
    base.filterBrightness = polotno.brightness;
  }
  if (polotno.grayscaleEnabled) base.colorFilter = 'grayscale';
  if (polotno.sepiaEnabled) base.colorFilter = 'sepia';

  // Shadow (only map if enabled)
  if (polotno.shadowEnabled) {
    base.shadowBlur = polotno.shadowBlur ?? 5;
    base.shadowOffsetX = polotno.shadowOffsetX ?? 0;
    base.shadowOffsetY = polotno.shadowOffsetY ?? 0;
    base.shadowColor = polotno.shadowColor ?? 'black';
    base.shadowOpacity = polotno.shadowOpacity ?? 1;
  }

  return base as unknown as Omit<CanvasObject, 'type'>;
}

// ─── Object converters ────────────────────────────────────────────────────────

function convertImageObject(polotno: PolotnoImageObject): ImageObject {
  const result: ImageObject = {
    ...mapBaseFields(polotno),
    type: 'image',
    src: polotno.src,
    // Polotno cropX/Y/Width/Height are normalized 0-1 values; our canvas expects
    // natural pixel coordinates for Konva's crop prop. Omitting them displays
    // the full image, which matches Polotno's default (cropWidth=1, cropHeight=1).
  };
  if (typeof polotno.borderSize === 'number' && polotno.borderSize > 0 && polotno.borderColor) {
    result.stroke = polotno.borderColor;
    result.strokeWidth = polotno.borderSize;
  }
  return result;
}

function convertSvgObject(polotno: PolotnoSvgObject): ImageObject {
  let src = polotno.src;
  if (polotno.colorsReplace && Object.keys(polotno.colorsReplace).length > 0) {
    src = applySvgColorReplacements(src, polotno.colorsReplace);
  }

  const result: ImageObject = {
    ...mapBaseFields(polotno),
    type: 'image',
    src,
    // Polotno cropX/Y/Width/Height are normalized 0-1 values; omit them to
    // display the full SVG, matching Polotno's default full-crop behavior.
  };
  if (typeof polotno.borderSize === 'number' && polotno.borderSize > 0 && polotno.borderColor) {
    result.stroke = polotno.borderColor;
    result.strokeWidth = polotno.borderSize;
  }
  return result;
}

function convertTextObject(polotno: PolotnoTextObject): TextObject {
  // Polotno splits into fontStyle (normal/italic) and fontWeight (normal/bold);
  // Canvas Architect combines them into a single fontStyle field.
  const isBold = polotno.fontWeight === 'bold';
  const isItalic = polotno.fontStyle === 'italic';
  let fontStyle: TextObject['fontStyle'] = 'normal';
  if (isBold && isItalic) fontStyle = 'bold italic';
  else if (isBold) fontStyle = 'bold';
  else if (isItalic) fontStyle = 'italic';

  // textDecoration: Polotno can send an empty string or missing for "none"
  let textDecoration: TextObject['textDecoration'] = 'none';
  if (polotno.textDecoration === 'underline') textDecoration = 'underline';
  else if (polotno.textDecoration === 'line-through') textDecoration = 'line-through';

  // align
  const align: TextObject['align'] =
    polotno.align === 'left' || polotno.align === 'center' || polotno.align === 'right'
      ? polotno.align
      : 'left';

  const result: TextObject = {
    ...mapBaseFields(polotno),
    type: 'text',
    text: polotno.text,
    fontSize: polotno.fontSize ?? 24,
    fontFamily: polotno.fontFamily ?? 'Arial',
    fontStyle,
    textDecoration,
    lineHeight: polotno.lineHeight,
    letterSpacing: polotno.letterSpacing,
    fill: polotno.fill ?? '#000000',
    align,
  };

  // Text background (only mapped if explicitly enabled in Polotno)
  if (polotno.backgroundEnabled && polotno.backgroundColor) {
    result.textBgColor = polotno.backgroundColor;
    result.textBgOpacity = polotno.backgroundOpacity ?? 1;
    result.textBgCornerRadius = polotno.backgroundCornerRadius ?? 0;
    result.textBgPadding = polotno.backgroundPadding ?? 0;
  }

  // Text stroke
  if (typeof polotno.strokeWidth === 'number' && polotno.strokeWidth > 0) {
    result.textStrokeWidth = polotno.strokeWidth;
    result.textStrokeColor = polotno.stroke ?? '#000000';
  }

  return result;
}

// ─── Page background ──────────────────────────────────────────────────────────

function parsePageBackground(bg: string | undefined): CanvasBackground {
  if (!bg || bg === 'transparent') return { type: 'transparent' };
  // Polotno stores CSS color strings: rgba(...), hex, etc.
  return { type: 'solid', color: bg };
}

// ─── Object dispatch ──────────────────────────────────────────────────────────

function convertPolotnoObject(polotno: PolotnoObject): CanvasObject | null {
  switch (polotno.type) {
    case 'image':
      return convertImageObject(polotno as PolotnoImageObject);
    case 'svg':
      return convertSvgObject(polotno as PolotnoSvgObject);
    case 'text':
      return convertTextObject(polotno as PolotnoTextObject);
    default:
      console.warn(`[polotnoConverter] Unsupported object type "${polotno.type}", skipping.`);
      return null;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function convertPolotnoPage(polotnoPage: PolotnoPage, index: number): CanvasPage {
  const objects = (polotnoPage.children || [])
    .map(convertPolotnoObject)
    .filter((o): o is CanvasObject => o !== null);

  return {
    id: generateObjectId(),
    name: `Page ${index + 1}`,
    order: index,
    objects,
    selectedIds: [],
    past: [],
    future: [],
    viewState: { zoom: 1, position: { x: 0, y: 0 } },
    background: parsePageBackground(polotnoPage.background),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function convertPolotnoDesign(
  json: unknown,
): PolotnoImportResult | PolotnoImportError {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { error: 'Invalid Polotno JSON: expected an object.' };
  }

  const design = json as Record<string, unknown>;

  if (typeof design.width !== 'number' || typeof design.height !== 'number') {
    return { error: 'Invalid Polotno JSON: missing or invalid width/height.' };
  }

  if (!Array.isArray(design.pages) || design.pages.length === 0) {
    return { error: 'Invalid Polotno JSON: no pages found.' };
  }

  const pages = (design as unknown as PolotnoDesignJson).pages.map(
    (page, index) => convertPolotnoPage(page, index),
  );

  return {
    pages,
    width: design.width,
    height: design.height,
  };
}

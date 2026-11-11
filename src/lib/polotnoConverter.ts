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

/**
 * Text objects here have no text-transform setting, so the casing Polotno
 * shows is written into the text itself.
 */
function applyTextTransform(text: string, transform: string | undefined): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text.replace(/(^|\s)(\S)/g, (_match, space: string, letter: string) => space + letter.toUpperCase());
    default:
      return text;
  }
}

function convertTextObject(polotno: PolotnoTextObject): TextObject {
  // Polotno splits into fontStyle (normal/italic) and fontWeight ('normal',
  // 'bold' or a number such as '700'); Canvas Architect combines them into a
  // single fontStyle field.
  const numericWeight = Number(polotno.fontWeight);
  const isBold = polotno.fontWeight === 'bold' || (Number.isFinite(numericWeight) && numericWeight >= 600);
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

  const fontSize = polotno.fontSize ?? 24;

  const result: TextObject = {
    ...mapBaseFields(polotno),
    type: 'text',
    text: applyTextTransform(polotno.text ?? '', polotno.textTransform),
    fontSize,
    fontFamily: polotno.fontFamily ?? 'Arial',
    fontStyle,
    textDecoration,
    lineHeight: typeof polotno.lineHeight === 'number' ? polotno.lineHeight : undefined,
    // Polotno stores letter spacing as a share of the font size (0.1 = 10%);
    // here it is in pixels.
    letterSpacing: (polotno.letterSpacing ?? 0) * fontSize,
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

// Polotno keeps a page background in one string: a CSS colour, an image
// address, or a CSS gradient.

const IMAGE_SOURCE_PATTERN = /^(https?:\/\/|\/\/|data:image\/|blob:)/i;

/** Splits on commas that are not inside brackets, e.g. inside rgba(...). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const DIRECTION_ANGLES: Record<string, number> = {
  'to top': 0,
  'to top right': 45,
  'to right top': 45,
  'to right': 90,
  'to bottom right': 135,
  'to right bottom': 135,
  'to bottom': 180,
  'to bottom left': 225,
  'to left bottom': 225,
  'to left': 270,
  'to top left': 315,
  'to left top': 315,
};

/** Reads a CSS angle ("135deg", "0.25turn", "1.5rad", "to right"); null if it isn't one. */
function parseGradientAngle(token: string): number | null {
  const value = token.trim().toLowerCase().replace(/\s+/g, ' ');
  if (value in DIRECTION_ANGLES) return DIRECTION_ANGLES[value];
  const match = /^(-?\d*\.?\d+)(deg|turn|rad|grad)?$/.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'turn': return amount * 360;
    case 'rad': return (amount * 180) / Math.PI;
    case 'grad': return amount * 0.9;
    default: return amount;
  }
}

/** "rgba(1,2,3,1) 40%" → "rgba(1,2,3,1)". Stop positions aren't kept: stops are spread evenly here. */
function stripStopPosition(stop: string): string {
  return stop.replace(/(\s+-?\d*\.?\d+(%|px)?)+$/, '').trim();
}

const RADIAL_SHAPE_PATTERN = /\b(circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|at)\b/i;

function parseGradient(bg: string): CanvasBackground | null {
  const match = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/i.exec(bg.trim());
  if (!match) return null;

  const kind = match[2].toLowerCase();
  const parts = splitTopLevel(match[3]);
  if (parts.length === 0) return null;

  if (kind === 'linear') {
    const angle = parseGradientAngle(parts[0]);
    const stops = (angle === null ? parts : parts.slice(1)).map(stripStopPosition).filter(Boolean);
    if (stops.length === 0) return null;
    return { type: 'linear-gradient', colors: stops, angle: angle ?? 180 };
  }

  const stops = (RADIAL_SHAPE_PATTERN.test(parts[0]) ? parts.slice(1) : parts)
    .map(stripStopPosition)
    .filter(Boolean);
  if (stops.length === 0) return null;
  return { type: 'radial-gradient', colors: stops };
}

function parsePageBackground(bg: string | undefined): CanvasBackground {
  const value = bg?.trim();
  if (!value || value === 'transparent') return { type: 'transparent' };

  // url("...") as written in CSS, or a plain image address.
  const cssUrl = /^url\(\s*['"]?(.*?)['"]?\s*\)$/i.exec(value);
  if (cssUrl) return { type: 'image', src: cssUrl[1] };
  if (IMAGE_SOURCE_PATTERN.test(value)) return { type: 'image', src: value };

  const gradient = parseGradient(value);
  if (gradient) return gradient;

  return { type: 'solid', color: value };
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

/**
 * Converts a Polotno design (the JSON that polotno.com and the Polotno SDK
 * export) into Sabi Canvas pages.
 *
 * Built from Polotno's public JSON schema documentation
 * (https://polotno.com/docs/schema), not from Polotno's code.
 *
 * Two entry points:
 *   - `importPolotnoDesign(json)` (async, recommended) also fetches what the
 *     JSON only points to: picture sizes (needed for crops), SVGs stored as
 *     links, and the design's own font files.
 *   - `convertPolotnoDesign(json)` (sync) does everything else. Picture crops
 *     and colours of linked SVGs are left out, and fonts are only listed.
 *
 * Element types:
 *   - text   → TextObject (HTML text becomes rich text)
 *   - image, gif → ImageObject (crop, flip, rounded corners, border, filters)
 *   - svg    → ImageObject (colour swaps kept as editable SVG colours)
 *   - line   → LineObject, or ArrowObject when an end is an arrow
 *   - figure → RectangleObject, EllipseObject, or an SVG picture of the shape
 *   - group  → its elements, placed on the page (Polotno groups carry no
 *              position of their own)
 * Anything else is left out and listed in `notes`.
 */

import {
  ArrowObject,
  CanvasObject,
  EllipseObject,
  ImageObject,
  LineObject,
  RectangleObject,
  TextObject,
  TextSpan,
  generateObjectId,
} from '@sabi-canvas/types/canvas-objects';
import { CanvasBackground, CanvasPage } from '@sabi-canvas/types/pages';
import { domToSpans, isPlainSpans, normalizeSpans, spansToPlainText } from '@sabi-canvas/lib/richText';
import { normalizeColor } from '@sabi-canvas/lib/svgColorUtils';

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
  // Locks
  draggable?: boolean;
  resizable?: boolean;
  alwaysOnTop?: boolean;
  showInExport?: boolean;
  blendMode?: string;
  animations?: unknown[];
  // Filters
  blurEnabled?: boolean;
  blurRadius?: number;
  brightnessEnabled?: boolean;
  brightness?: number;
  sepiaEnabled?: boolean;
  grayscaleEnabled?: boolean;
  filters?: Record<string, { intensity?: number } | undefined>;
  // Shadow
  shadowEnabled?: boolean;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowColor?: string;
  shadowOpacity?: number;
}

interface PolotnoImageObject extends PolotnoBase {
  type: 'image' | 'gif';
  src: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  flipX?: boolean;
  flipY?: boolean;
  clipSrc?: string;
  borderColor?: string;
  borderSize?: number;
  cornerRadius?: number;
}

interface PolotnoSvgObject extends Omit<PolotnoImageObject, 'type'> {
  type: 'svg';
  colorsReplace?: Record<string, string>;
  maskSrc?: string;
  keepRatio?: boolean;
}

interface PolotnoTextObject extends PolotnoBase {
  type: 'text';
  text: string;
  placeholder?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  textTransform?: string;
  fill?: string;
  align?: string;
  verticalAlign?: string;
  lineHeight?: number | string;
  letterSpacing?: number;
  strokeWidth?: number;
  stroke?: string;
  backgroundEnabled?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundCornerRadius?: number;
  backgroundPadding?: number;
  borderColor?: string;
  borderSize?: number;
  curveEnabled?: boolean;
  curvePower?: number;
}

interface PolotnoLineObject extends PolotnoBase {
  type: 'line';
  color?: string;
  dash?: number[];
  startHead?: string;
  endHead?: string;
}

interface PolotnoFigureObject extends PolotnoBase {
  type: 'figure';
  subType?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  dash?: number[];
}

interface PolotnoGroupObject {
  id: string;
  type: 'group';
  opacity?: number;
  visible?: boolean;
  children?: PolotnoObject[];
}

type PolotnoObject =
  | PolotnoImageObject
  | PolotnoSvgObject
  | PolotnoTextObject
  | PolotnoLineObject
  | PolotnoFigureObject
  | PolotnoGroupObject
  | (PolotnoBase & { type: string });

interface PolotnoPage {
  id: string;
  children?: PolotnoObject[];
  background?: string;
  width?: string | number;
  height?: string | number;
}

interface PolotnoFontStyle {
  src?: string;
  fontStyle?: string;
  fontWeight?: string;
}

interface PolotnoFont {
  fontFamily?: string;
  url?: string;
  styles?: PolotnoFontStyle[];
}

interface PolotnoDesignJson {
  width: number;
  height: number;
  pages: PolotnoPage[];
  fonts?: PolotnoFont[];
  audios?: unknown[];
}

// ─── Public result types ──────────────────────────────────────────────────────

/** A font the design brings with it (not a Google font). */
export interface PolotnoFontSource {
  family: string;
  url: string;
}

/** A downloaded design font, ready to add to the project's own fonts. */
export interface PolotnoFontFile {
  family: string;
  file: File;
}

export interface PolotnoImportResult {
  pages: CanvasPage[];
  width: number;
  height: number;
  /** Fonts the design brings with it. */
  fonts: PolotnoFontSource[];
  /** Downloaded font files (only from `importPolotnoDesign`). */
  fontFiles?: PolotnoFontFile[];
  /** What couldn't be brought over exactly, in plain words. */
  notes: string[];
}

export interface PolotnoImportError {
  error: string;
}

export interface PolotnoImportOptions {
  /** How long to wait for each picture, SVG or font download. Default 15s. */
  timeoutMs?: number;
}

// ─── Conversion context ───────────────────────────────────────────────────────

/** Work that needs a download: picture sizes for crops, linked SVGs. */
interface AssetTask {
  object: ImageObject;
  /** Crop as fractions of the original picture; undefined when uncropped. */
  crop?: { x: number; y: number; width: number; height: number };
  /** For an SVG stored as a link: what to do once its text is fetched. */
  svg?: { colorsReplace?: Record<string, string>; stretch: boolean };
}

class ConversionContext {
  readonly tasks: AssetTask[] = [];
  private readonly counts = new Map<string, number>();
  private readonly examples = new Map<string, Set<string>>();

  note(key: string, example?: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
    if (example) {
      const set = this.examples.get(key) ?? new Set<string>();
      set.add(example);
      this.examples.set(key, set);
    }
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  examplesOf(key: string): string[] {
    return [...(this.examples.get(key) ?? [])];
  }
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const buildNotes = (ctx: ConversionContext): string[] => {
  const notes: string[] = [];
  const skippedTypes = ctx.examplesOf('skipped-type');
  if (skippedTypes.length) {
    notes.push(`Left out ${plural(ctx.count('skipped-type'), 'element', 'elements')} of a kind that isn't supported yet (${skippedTypes.join(', ')}).`);
  }
  const skippedShapes = ctx.examplesOf('skipped-figure');
  if (skippedShapes.length) {
    notes.push(`Left out ${plural(ctx.count('skipped-figure'), 'shape', 'shapes')} with no matching shape yet (${skippedShapes.join(', ')}).`);
  }
  if (ctx.count('clip')) {
    notes.push(`${plural(ctx.count('clip'), 'picture is', 'pictures are')} cut to a custom shape or faded in Polotno; ${ctx.count('clip') === 1 ? 'it is' : 'they are'} shown whole here.`);
  }
  if (ctx.count('blend')) {
    notes.push(`${plural(ctx.count('blend'), 'element uses', 'elements use')} a blend mode, shown as normal here.`);
  }
  if (ctx.count('text-border')) {
    notes.push(`${plural(ctx.count('text-border'), 'text has', 'texts have')} a border around ${ctx.count('text-border') === 1 ? 'its' : 'their'} box, which isn't shown.`);
  }
  if (ctx.count('line-head')) {
    notes.push(`${plural(ctx.count('line-head'), 'line end is', 'line ends are')} a circle, square or bar in Polotno, shown as a plain end here.`);
  }
  if (ctx.count('figure-dash')) {
    notes.push(`${plural(ctx.count('figure-dash'), 'rectangle or circle has', 'rectangles or circles have')} a dashed outline, shown as solid here.`);
  }
  if (ctx.count('export-hidden')) {
    notes.push(`${plural(ctx.count('export-hidden'), 'element is', 'elements are')} kept out of downloads in Polotno but will be included in downloads here.`);
  }
  if (ctx.count('animation')) {
    notes.push('Animations and audio are not imported.');
  }
  return notes;
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const lineHeightOf = (value: number | string | undefined): number =>
  isFiniteNumber(value) && value > 0 ? value : 1.2;

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const base64ToUtf8 = (base64: string): string => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const utf8ToBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const SVG_DATA_URL_PATTERN = /^data:image\/svg\+xml((?:;[^,]*)?),/i;

/** The SVG text inside a data URL, or null if `src` isn't an SVG data URL. */
const decodeSvgDataUrl = (src: string): string | null => {
  const match = SVG_DATA_URL_PATTERN.exec(src);
  if (!match) return null;
  const payload = src.slice(match[0].length);
  try {
    return /;base64/i.test(match[1]) ? base64ToUtf8(payload) : decodeURIComponent(payload);
  } catch {
    return null;
  }
};

const encodeSvgDataUrl = (svgText: string): string => `data:image/svg+xml;base64,${utf8ToBase64(svgText)}`;

const isRemoteUrl = (src: string): boolean => /^(https?:)?\/\//i.test(src);

/** A box rotated about its top-left corner (Polotno) → its centre point. */
const rotatedCenter = (x: number, y: number, width: number, height: number, rotation: number) => {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: x + (width / 2) * cos - (height / 2) * sin,
    y: y + (width / 2) * sin + (height / 2) * cos,
  };
};

// ─── SVG preparation ──────────────────────────────────────────────────────────

/**
 * Gives the root <svg> a width and height (Firefox can't draw an SVG picture
 * without them) and, when the element stretches, `preserveAspectRatio="none"`
 * so the drawing fills its box the way Polotno shows it.
 */
const prepareSvgText = (svgText: string, stretch: boolean): string => {
  const rootMatch = /<svg\b[^>]*>/i.exec(svgText);
  if (!rootMatch) return svgText;

  let root = rootMatch[0];
  const viewBox = /\sviewBox\s*=\s*["']([^"']+)["']/i.exec(root)?.[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const hasViewBox = viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0;

  const setAttr = (name: string, value: string) => {
    const pattern = new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`, 'i');
    root = pattern.test(root)
      ? root.replace(pattern, ` ${name}="${value}"`)
      : root.replace(/^<svg\b/i, `<svg ${name}="${value}"`);
  };
  const attrValue = (name: string) =>
    new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root)?.[1];

  if (hasViewBox) {
    const width = attrValue('width');
    const height = attrValue('height');
    if (!width || width.trim().endsWith('%')) setAttr('width', String(viewBox![2]));
    if (!height || height.trim().endsWith('%')) setAttr('height', String(viewBox![3]));
  }
  if (stretch) setAttr('preserveAspectRatio', 'none');

  return svgText.slice(0, rootMatch.index) + root + svgText.slice(rootMatch.index + rootMatch[0].length);
};

/**
 * Polotno's colour swaps → the editor's own SVG colour edits (original colour
 * → new colour), so they stay editable in the colour panel. Swaps the editor
 * can't key by colour (see-through originals) are written into the SVG text.
 */
const applyColorsReplace = (
  svgText: string,
  colorsReplace: Record<string, string> | undefined,
): { svgText: string; svgColors?: Record<string, string> } => {
  if (!colorsReplace || Object.keys(colorsReplace).length === 0) return { svgText };

  const svgColors: Record<string, string> = {};
  let text = svgText;
  for (const [from, to] of Object.entries(colorsReplace)) {
    const key = normalizeColor(from);
    if (key) {
      svgColors[key] = normalizeColor(to) ?? to;
    } else {
      text = text.split(from).join(to);
    }
  }
  return { svgText: text, svgColors: Object.keys(svgColors).length ? svgColors : undefined };
};

// ─── Base field mapping ───────────────────────────────────────────────────────

interface Inherited {
  opacity: number;
  visible: boolean;
}

function mapBaseFields(polotno: PolotnoBase, inherited: Inherited, ctx: ConversionContext): Omit<CanvasObject, 'type'> {
  const base: Record<string, unknown> = {
    id: generateObjectId(),
    x: polotno.x ?? 0,
    y: polotno.y ?? 0,
    width: polotno.width ?? 100,
    height: polotno.height ?? 100,
    rotation: polotno.rotation ?? 0,
    scaleX: 1,
    scaleY: 1,
    opacity: (polotno.opacity ?? 1) * inherited.opacity,
    visible: (polotno.visible ?? true) && inherited.visible,
    // Polotno's lock turns off moving and resizing together.
    draggable: polotno.draggable !== false,
    locked: polotno.draggable === false && polotno.resizable === false,
    name: polotno.name ?? '',
  };

  if (polotno.blendMode && polotno.blendMode !== 'normal') ctx.note('blend');
  if (polotno.showInExport === false) ctx.note('export-hidden');
  if (Array.isArray(polotno.animations) && polotno.animations.length > 0) ctx.note('animation');

  // Filters. Polotno's values run -1…1; the editor's run -100…100.
  if (polotno.blurEnabled && polotno.blurRadius) {
    base.filterBlur = polotno.blurRadius;
  }
  if (polotno.brightnessEnabled && isFiniteNumber(polotno.brightness)) {
    base.filterBrightness = clamp(polotno.brightness * 100, -100, 100);
  }
  if (polotno.grayscaleEnabled) base.colorFilter = 'grayscale';
  if (polotno.sepiaEnabled) base.colorFilter = 'sepia';

  const filters = polotno.filters ?? {};
  const intensity = (name: string): number | undefined => {
    const entry = filters[name];
    if (!entry) return undefined;
    return isFiniteNumber(entry.intensity) ? entry.intensity : 1;
  };
  for (const preset of ['cold', 'natural', 'warm'] as const) {
    if (intensity(preset) !== undefined) base.colorFilter = preset;
  }
  const adjustments: Array<[string, string]> = [
    ['temperature', 'filterTemperature'],
    ['contrast', 'filterContrast'],
    ['saturation', 'filterSaturation'],
    ['vibrance', 'filterVibrance'],
    ['shadows', 'filterShadows'],
    ['white', 'filterWhites'],
    ['black', 'filterBlacks'],
  ];
  for (const [name, field] of adjustments) {
    const value = intensity(name);
    if (value !== undefined) base[field] = clamp(value * 100, -100, 100);
  }

  if (polotno.shadowEnabled) {
    const offsetX = polotno.shadowOffsetX ?? 0;
    const offsetY = polotno.shadowOffsetY ?? 0;
    const blur = polotno.shadowBlur ?? 5;
    // A blur of 0 means "no shadow" in the editor, so a sharp Polotno shadow
    // keeps the smallest blur instead.
    const hasShadow = blur > 0 || offsetX !== 0 || offsetY !== 0;
    if (hasShadow) {
      base.shadowBlur = blur > 0 ? blur : 0.5;
      base.shadowOffsetX = offsetX;
      base.shadowOffsetY = offsetY;
      base.shadowColor = polotno.shadowColor ?? 'black';
      base.shadowOpacity = polotno.shadowOpacity ?? 1;
    }
  }

  return base as unknown as Omit<CanvasObject, 'type'>;
}

// ─── Pictures and SVGs ────────────────────────────────────────────────────────

const cropOf = (polotno: PolotnoImageObject | PolotnoSvgObject): AssetTask['crop'] => {
  const crop = {
    x: clamp(polotno.cropX ?? 0, 0, 1),
    y: clamp(polotno.cropY ?? 0, 0, 1),
    width: clamp(polotno.cropWidth ?? 1, 0, 1),
    height: clamp(polotno.cropHeight ?? 1, 0, 1),
  };
  const isWhole = crop.x <= 0.0005 && crop.y <= 0.0005 && crop.width >= 0.9995 && crop.height >= 0.9995;
  return isWhole || crop.width <= 0 || crop.height <= 0 ? undefined : crop;
};

function convertPictureFields(
  polotno: PolotnoImageObject | PolotnoSvgObject,
  result: ImageObject,
  ctx: ConversionContext,
): void {
  if (polotno.flipX) result.flipX = true;
  if (polotno.flipY) result.flipY = true;
  if (isFiniteNumber(polotno.cornerRadius) && polotno.cornerRadius > 0) result.cornerRadius = polotno.cornerRadius;
  if (isFiniteNumber(polotno.borderSize) && polotno.borderSize > 0 && polotno.borderColor) {
    result.stroke = polotno.borderColor;
    result.strokeWidth = polotno.borderSize;
  }
  if (polotno.clipSrc || (polotno as PolotnoSvgObject).maskSrc) ctx.note('clip');
}

function convertImageObject(polotno: PolotnoImageObject, inherited: Inherited, ctx: ConversionContext): ImageObject {
  const result: ImageObject = {
    ...mapBaseFields(polotno, inherited, ctx),
    type: 'image',
    src: polotno.src,
  };
  convertPictureFields(polotno, result, ctx);

  const crop = cropOf(polotno);
  if (crop) ctx.tasks.push({ object: result, crop });
  return result;
}

function convertSvgObject(polotno: PolotnoSvgObject, inherited: Inherited, ctx: ConversionContext): ImageObject {
  const result: ImageObject = {
    ...mapBaseFields(polotno, inherited, ctx),
    type: 'image',
    src: polotno.src,
  };
  convertPictureFields(polotno, result, ctx);

  // keepRatio false: the drawing stretches to fill its box.
  const stretch = polotno.keepRatio === false;
  const svgText = decodeSvgDataUrl(polotno.src);
  if (svgText !== null) {
    const recoloured = applyColorsReplace(prepareSvgText(svgText, stretch), polotno.colorsReplace);
    result.src = encodeSvgDataUrl(recoloured.svgText);
    if (recoloured.svgColors) result.svgColors = recoloured.svgColors;
  }

  const crop = cropOf(polotno);
  const needsFetch = svgText === null && isRemoteUrl(polotno.src);
  if (crop || needsFetch) {
    ctx.tasks.push({
      object: result,
      crop,
      svg: needsFetch ? { colorsReplace: polotno.colorsReplace, stretch } : undefined,
    });
  }
  return result;
}

// ─── Text ─────────────────────────────────────────────────────────────────────

const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i;
const HTML_ENTITY_PATTERN = /&(#\d+|#x[0-9a-f]+|[a-z]+);/i;

/** Polotno text may hold HTML (rich text). Returns spans, or null for plain text. */
function htmlToSpans(text: string): TextSpan[] | null {
  if (!HTML_TAG_PATTERN.test(text) && !HTML_ENTITY_PATTERN.test(text)) return null;

  if (typeof DOMParser === 'undefined') {
    const plain = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>\s*(?=.)/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
    return [{ text: plain }];
  }

  // A parsed document is inert: no scripts run and nothing loads.
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return normalizeSpans(domToSpans(doc.body));
}

/** Text objects have no text-transform setting, so the casing is written into the text. */
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

function convertTextObject(polotno: PolotnoTextObject, inherited: Inherited, ctx: ConversionContext): TextObject {
  // Polotno splits into fontStyle (normal/italic) and fontWeight ('normal',
  // 'bold' or a number such as '700'); text objects here combine them.
  const numericWeight = Number(polotno.fontWeight);
  const isBold = polotno.fontWeight === 'bold' || (Number.isFinite(numericWeight) && numericWeight >= 600);
  const isItalic = polotno.fontStyle === 'italic';
  let fontStyle: TextObject['fontStyle'] = 'normal';
  if (isBold && isItalic) fontStyle = 'bold italic';
  else if (isBold) fontStyle = 'bold';
  else if (isItalic) fontStyle = 'italic';

  const decoration = polotno.textDecoration ?? '';
  const hasUnderline = decoration.includes('underline');
  const hasLineThrough = decoration.includes('line-through');
  let textDecoration: TextObject['textDecoration'] = 'none';
  if (hasUnderline && hasLineThrough) textDecoration = 'underline line-through';
  else if (hasUnderline) textDecoration = 'underline';
  else if (hasLineThrough) textDecoration = 'line-through';

  // Polotno's default is centre. There's no justify here: it shows left-aligned.
  const align: TextObject['align'] =
    polotno.align === 'left' || polotno.align === 'justify' ? 'left' : polotno.align === 'right' ? 'right' : 'center';

  const fontSize = isFiniteNumber(polotno.fontSize) && polotno.fontSize > 0 ? polotno.fontSize : 14;
  const lineHeight = lineHeightOf(polotno.lineHeight);

  const spans = htmlToSpans(polotno.text ?? '');
  const transformedSpans = spans?.map((span) => ({ ...span, text: applyTextTransform(span.text, polotno.textTransform) }));
  const plainText = transformedSpans
    ? spansToPlainText(transformedSpans)
    : applyTextTransform(polotno.text ?? '', polotno.textTransform);

  const result: TextObject = {
    ...mapBaseFields(polotno, inherited, ctx),
    type: 'text',
    text: plainText,
    fontSize,
    fontFamily: polotno.fontFamily || 'Roboto',
    fontStyle,
    textDecoration,
    lineHeight,
    // Polotno stores letter spacing as a share of the font size; here it is pixels.
    letterSpacing: (polotno.letterSpacing ?? 0) * fontSize,
    fill: polotno.fill ?? '#000000',
    align,
  };

  if (transformedSpans && !isPlainSpans(transformedSpans)) {
    result.richText = transformedSpans;
  }

  // Background. Polotno gives padding and corner radius as shares of half
  // the line height; here they are pixels.
  if (polotno.backgroundEnabled && polotno.backgroundColor) {
    const halfLine = (fontSize * lineHeight) / 2;
    result.textBgColor = polotno.backgroundColor;
    result.textBgOpacity = polotno.backgroundOpacity ?? 1;
    result.textBgPadding = (polotno.backgroundPadding ?? 0.5) * halfLine;
    result.textBgCornerRadius = (polotno.backgroundCornerRadius ?? 0.5) * halfLine;
  }

  if (isFiniteNumber(polotno.strokeWidth) && polotno.strokeWidth > 0) {
    result.textStrokeWidth = polotno.strokeWidth;
    result.textStrokeColor = polotno.stroke ?? '#000000';
  }

  // Curve: Polotno's power runs -1…1, the editor's curve -100…100.
  if (polotno.curveEnabled && isFiniteNumber(polotno.curvePower)) {
    const curve = clamp(Math.round(polotno.curvePower * 100), -100, 100);
    if (Math.abs(curve) >= 1) result.textCurve = curve;
  }

  if (isFiniteNumber(polotno.borderSize) && polotno.borderSize > 0) ctx.note('text-border');

  return result;
}

// ─── Lines ────────────────────────────────────────────────────────────────────

const ARROW_HEADS = new Set(['arrow', 'triangle']);
const OTHER_HEADS = new Set(['circle', 'square', 'bar']);

function convertLineObject(polotno: PolotnoLineObject, inherited: Inherited, ctx: ConversionContext): LineObject | ArrowObject {
  // The element's height is the line's thickness; the line runs along the
  // middle of its box.
  const thickness = Math.max(1, polotno.height || 1);
  const length = Math.max(0, polotno.width || 0);
  const color = polotno.color ?? 'black';
  const points = [0, thickness / 2, length, thickness / 2];
  const base = mapBaseFields(polotno, inherited, ctx);

  const startHead = polotno.startHead ?? '';
  const endHead = polotno.endHead ?? '';
  if (OTHER_HEADS.has(startHead)) ctx.note('line-head');
  if (OTHER_HEADS.has(endHead)) ctx.note('line-head');

  if (ARROW_HEADS.has(startHead) || ARROW_HEADS.has(endHead)) {
    return {
      ...base,
      type: 'arrow',
      height: thickness,
      points,
      stroke: color,
      strokeWidth: thickness,
      fill: color,
      pointerLength: thickness * 3,
      pointerWidth: thickness * 3,
      pointerAtBeginning: ARROW_HEADS.has(startHead),
      pointerAtEnding: ARROW_HEADS.has(endHead),
    };
  }

  return {
    ...base,
    type: 'line',
    height: thickness,
    points,
    stroke: color,
    strokeWidth: thickness,
    lineCap: 'butt',
    // Dash lengths are taken as multiples of the line's thickness.
    dash: polotno.dash?.length ? polotno.dash.map((value) => value * thickness) : undefined,
  };
}

// ─── Figures ──────────────────────────────────────────────────────────────────

type Point = [number, number];

/** Stretches points to fill the 0…1 box exactly, as Polotno shapes fill their box. */
const fitToUnitBox = (points: Point[]): Point[] => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1;
  const spanY = Math.max(...ys) - minY || 1;
  return points.map(([x, y]) => [(x - minX) / spanX, (y - minY) / spanY]);
};

const regularPolygon = (sides: number): Point[] =>
  fitToUnitBox(Array.from({ length: sides }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return [Math.cos(angle), Math.sin(angle)] as Point;
  }));

const starPoints = (points: number, innerRatio: number): Point[] =>
  fitToUnitBox(Array.from({ length: points * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const radius = i % 2 === 0 ? 1 : innerRatio;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as Point;
  }));

const rotatePoints = (points: Point[], quarterTurns: number): Point[] =>
  points.map(([x, y]) => {
    switch (((quarterTurns % 4) + 4) % 4) {
      case 1: return [1 - y, x];
      case 2: return [1 - x, 1 - y];
      case 3: return [y, 1 - x];
      default: return [x, y];
    }
  });

const RIGHT_ARROW: Point[] = [[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]];

/** Outlines in a 0…1 box, as polygons. */
const FIGURE_POLYGONS: Record<string, () => Point[]> = {
  triangle: () => [[0.5, 0], [1, 1], [0, 1]],
  rightTriangle: () => [[0, 0], [1, 1], [0, 1]],
  diamond: () => [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  pentagon: () => regularPolygon(5),
  hexagon: () => regularPolygon(6),
  star: () => starPoints(5, 0.45),
  cross: () => [
    [1 / 3, 0], [2 / 3, 0], [2 / 3, 1 / 3], [1, 1 / 3], [1, 2 / 3], [2 / 3, 2 / 3],
    [2 / 3, 1], [1 / 3, 1], [1 / 3, 2 / 3], [0, 2 / 3], [0, 1 / 3], [1 / 3, 1 / 3],
  ],
  rightArrow: () => RIGHT_ARROW,
  downArrow: () => rotatePoints(RIGHT_ARROW, 1),
  leftArrow: () => rotatePoints(RIGHT_ARROW, 2),
  upArrow: () => rotatePoints(RIGHT_ARROW, 3),
};

/** Outlines in a 0…1 box, as SVG path commands with x/y pairs in that box. */
const FIGURE_PATHS: Record<string, Array<[string, ...number[]]>> = {
  heart1: [
    ['M', 0.5, 0.25],
    ['C', 0.5, 0.1, 0.3, 0, 0.2, 0],
    ['C', 0.05, 0, 0, 0.15, 0, 0.3],
    ['C', 0, 0.55, 0.25, 0.75, 0.5, 1],
    ['C', 0.75, 0.75, 1, 0.55, 1, 0.3],
    ['C', 1, 0.15, 0.95, 0, 0.8, 0],
    ['C', 0.7, 0, 0.5, 0.1, 0.5, 0.25],
    ['Z'],
  ],
  speechBubble: [
    ['M', 0.1, 0],
    ['L', 0.9, 0],
    ['Q', 1, 0, 1, 0.1],
    ['L', 1, 0.7],
    ['Q', 1, 0.8, 0.9, 0.8],
    ['L', 0.4, 0.8],
    ['L', 0.2, 1],
    ['L', 0.22, 0.8],
    ['L', 0.1, 0.8],
    ['Q', 0, 0.8, 0, 0.7],
    ['L', 0, 0.1],
    ['Q', 0, 0, 0.1, 0],
    ['Z'],
  ],
};

/** An SVG picture of a Polotno figure, drawn to fill its box. */
function figureSvg(subType: string, width: number, height: number, polotno: PolotnoFigureObject): string | null {
  const strokeWidth = Math.max(0, polotno.strokeWidth ?? 0);
  // Keep the outline inside the box so it isn't cut off at the edges.
  const inset = strokeWidth / 2;
  const innerWidth = Math.max(0, width - strokeWidth);
  const innerHeight = Math.max(0, height - strokeWidth);
  const at = (x: number, y: number) => `${(inset + x * innerWidth).toFixed(2)} ${(inset + y * innerHeight).toFixed(2)}`;

  let d: string | null = null;
  const polygon = FIGURE_POLYGONS[subType];
  if (polygon) {
    d = polygon().map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${at(x, y)}`).join(' ') + ' Z';
  } else if (FIGURE_PATHS[subType]) {
    d = FIGURE_PATHS[subType]
      .map(([command, ...values]) => {
        const pairs: string[] = [];
        for (let i = 0; i < values.length; i += 2) pairs.push(at(values[i], values[i + 1]));
        return [command, ...pairs].join(' ');
      })
      .join(' ');
  }
  if (!d) return null;

  const fill = polotno.fill ?? 'rgb(0, 161, 255)';
  const stroke = strokeWidth > 0 ? polotno.stroke ?? 'black' : 'none';
  const dash = strokeWidth > 0 && polotno.dash?.length
    ? ` stroke-dasharray="${polotno.dash.map((value) => value * strokeWidth).join(' ')}"`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">` +
    `<path d="${d}" fill="${escapeAttr(fill)}" stroke="${escapeAttr(stroke)}" stroke-width="${strokeWidth}" stroke-linejoin="round"${dash}/>` +
    '</svg>'
  );
}

function convertFigureObject(polotno: PolotnoFigureObject, inherited: Inherited, ctx: ConversionContext): CanvasObject | null {
  const subType = polotno.subType ?? 'rect';
  const width = Math.max(1, polotno.width || 1);
  const height = Math.max(1, polotno.height || 1);
  const fill = polotno.fill ?? 'rgb(0, 161, 255)';
  const strokeWidth = Math.max(0, polotno.strokeWidth ?? 0);
  const stroke = polotno.stroke ?? 'black';
  const base = mapBaseFields(polotno, inherited, ctx);

  if (subType === 'rect') {
    if (strokeWidth > 0 && polotno.dash?.length) ctx.note('figure-dash');
    const rect: RectangleObject = {
      ...base,
      type: 'rectangle',
      fill,
      stroke,
      strokeWidth,
      cornerRadius: Math.max(0, polotno.cornerRadius ?? 0),
    };
    return rect;
  }

  if (subType === 'circle' || subType === 'ellipse') {
    if (strokeWidth > 0 && polotno.dash?.length) ctx.note('figure-dash');
    // Ellipses here are placed by their centre and turn about it; Polotno turns
    // the box about its top-left corner, so place it by the turned centre.
    const center = rotatedCenter(base.x, base.y, width, height, base.rotation);
    const ellipse: EllipseObject = {
      ...base,
      type: 'ellipse',
      x: center.x - width / 2,
      y: center.y - height / 2,
      fill,
      stroke,
      strokeWidth,
      radiusX: width / 2,
      radiusY: height / 2,
    };
    return ellipse;
  }

  const svg = figureSvg(subType, width, height, polotno);
  if (!svg) {
    ctx.note('skipped-figure', subType);
    return null;
  }
  const picture: ImageObject = {
    ...base,
    type: 'image',
    src: encodeSvgDataUrl(svg),
    naturalWidth: width,
    naturalHeight: height,
  };
  return picture;
}

// ─── Object dispatch ──────────────────────────────────────────────────────────

function convertPolotnoObjects(
  children: PolotnoObject[] | undefined,
  inherited: Inherited,
  ctx: ConversionContext,
): CanvasObject[] {
  // Polotno draws "always on top" elements last.
  const ordered = [...(children ?? [])].sort(
    (a, b) => Number(!!(a as PolotnoBase).alwaysOnTop) - Number(!!(b as PolotnoBase).alwaysOnTop),
  );

  const objects: CanvasObject[] = [];
  for (const child of ordered) {
    if (!child || typeof child !== 'object') continue;
    switch (child.type) {
      case 'group': {
        // Groups have no position of their own: their elements go on the page.
        const group = child as PolotnoGroupObject;
        objects.push(
          ...convertPolotnoObjects(group.children, {
            opacity: inherited.opacity * (group.opacity ?? 1),
            visible: inherited.visible && (group.visible ?? true),
          }, ctx),
        );
        break;
      }
      case 'image':
      case 'gif':
        objects.push(convertImageObject(child as PolotnoImageObject, inherited, ctx));
        break;
      case 'svg':
        objects.push(convertSvgObject(child as PolotnoSvgObject, inherited, ctx));
        break;
      case 'text':
        objects.push(convertTextObject(child as PolotnoTextObject, inherited, ctx));
        break;
      case 'line':
        objects.push(convertLineObject(child as PolotnoLineObject, inherited, ctx));
        break;
      case 'figure': {
        const figure = convertFigureObject(child as PolotnoFigureObject, inherited, ctx);
        if (figure) objects.push(figure);
        break;
      }
      default:
        ctx.note('skipped-type', String(child.type));
    }
  }
  return objects;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

function convertPolotnoPage(
  polotnoPage: PolotnoPage,
  index: number,
  designSize: { width: number; height: number },
  ctx: ConversionContext,
): CanvasPage {
  // A page may have its own size; 'auto' means the design's size.
  const size = {
    width: isFiniteNumber(polotnoPage.width) && polotnoPage.width > 0 ? polotnoPage.width : designSize.width,
    height: isFiniteNumber(polotnoPage.height) && polotnoPage.height > 0 ? polotnoPage.height : designSize.height,
  };

  return {
    id: generateObjectId(),
    name: `Page ${index + 1}`,
    order: index,
    size,
    objects: convertPolotnoObjects(polotnoPage.children, { opacity: 1, visible: true }, ctx),
    selectedIds: [],
    past: [],
    future: [],
    viewState: { zoom: 1, position: { x: 0, y: 0 } },
    background: parsePageBackground(polotnoPage.background),
  };
}

// ─── Fonts ────────────────────────────────────────────────────────────────────

/** "url('https://…/a.woff2') format('woff2')" → "https://…/a.woff2". */
const fontSourceUrl = (src: string | undefined): string | null => {
  if (!src) return null;
  const cssUrl = /url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(src);
  const url = (cssUrl ? cssUrl[1] : src).trim();
  return url || null;
};

/** Each family's regular face (a font here has one face per family). */
function collectFonts(fonts: PolotnoFont[] | undefined): PolotnoFontSource[] {
  const result: PolotnoFontSource[] = [];
  const seen = new Set<string>();
  for (const font of fonts ?? []) {
    const family = font?.fontFamily?.trim();
    if (!family || seen.has(family)) continue;

    let url = fontSourceUrl(font.url);
    if (!url && font.styles?.length) {
      const isRegular = (style: PolotnoFontStyle) =>
        (!style.fontStyle || style.fontStyle === 'normal') &&
        (!style.fontWeight || style.fontWeight === 'normal' || style.fontWeight === '400');
      const regular = font.styles.find(isRegular) ?? font.styles[0];
      url = fontSourceUrl(regular?.src);
    }
    if (!url) continue;

    seen.add(family);
    result.push({ family, url });
  }
  return result;
}

// ─── Conversion ───────────────────────────────────────────────────────────────

type ConversionOutcome =
  | { error: string }
  | { result: PolotnoImportResult; ctx: ConversionContext };

function convert(json: unknown): ConversionOutcome {
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

  const typed = design as unknown as PolotnoDesignJson;
  const ctx = new ConversionContext();
  const designSize = { width: typed.width, height: typed.height };
  const pages = typed.pages.map((page, index) => convertPolotnoPage(page, index, designSize, ctx));
  if (Array.isArray(typed.audios) && typed.audios.length > 0) ctx.note('animation');

  return {
    ctx,
    result: {
      pages,
      width: typed.width,
      height: typed.height,
      fonts: collectFonts(typed.fonts),
      notes: [],
    },
  };
}

/**
 * Converts a Polotno design without downloading anything. Picture crops and
 * the colours of SVGs stored as links need downloads, so they are left out;
 * use `importPolotnoDesign` to keep them.
 */
export function convertPolotnoDesign(json: unknown): PolotnoImportResult | PolotnoImportError {
  const outcome = convert(json);
  if ('error' in outcome) return { error: outcome.error };
  return { ...outcome.result, notes: buildNotes(outcome.ctx) };
}

// ─── Downloads ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
};

/** A picture's original size. Reading the size works without CORS. */
const loadNaturalSize = (src: string, timeoutMs: number): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });

const FONT_MIME_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  otf: 'font/otf',
  ttf: 'font/ttf',
};

async function downloadFont(font: PolotnoFontSource, timeoutMs: number): Promise<PolotnoFontFile | null> {
  try {
    const response = await fetchWithTimeout(font.url, timeoutMs);
    const blob = await response.blob();
    const extension = /\.(woff2|woff|otf|ttf)(\?|#|$)/i.exec(font.url)?.[1]?.toLowerCase() ?? 'ttf';
    const mimeType = blob.type && blob.type.startsWith('font/') ? blob.type : FONT_MIME_TYPES[extension];
    const fileName = `${font.family.replace(/[^\w-]+/g, '-')}.${extension}`;
    return { family: font.family, file: new File([blob], fileName, { type: mimeType }) };
  } catch {
    return null;
  }
}

async function runAssetTask(task: AssetTask, timeoutMs: number): Promise<{ cropLost: boolean; svgLost: boolean }> {
  const { object } = task;
  let svgLost = false;

  if (task.svg) {
    try {
      const response = await fetchWithTimeout(object.src, timeoutMs);
      const svgText = await response.text();
      const recoloured = applyColorsReplace(prepareSvgText(svgText, task.svg.stretch), task.svg.colorsReplace);
      object.src = encodeSvgDataUrl(recoloured.svgText);
      if (recoloured.svgColors) object.svgColors = recoloured.svgColors;
    } catch {
      // The link stays; the drawing shows in its own colours.
      svgLost = !!task.svg.colorsReplace && Object.keys(task.svg.colorsReplace).length > 0;
    }
  }

  if (!task.crop) return { cropLost: false, svgLost };

  const size = await loadNaturalSize(object.src, timeoutMs);
  if (!size) return { cropLost: true, svgLost };

  object.naturalWidth = size.width;
  object.naturalHeight = size.height;
  object.cropX = task.crop.x * size.width;
  object.cropY = task.crop.y * size.height;
  object.cropWidth = task.crop.width * size.width;
  object.cropHeight = task.crop.height * size.height;
  return { cropLost: false, svgLost };
}

/**
 * Converts a Polotno design, downloading what the JSON only points to:
 * picture sizes (for crops), SVGs stored as links (for their colours), and
 * the design's own fonts (returned in `fontFiles` to add to the project).
 */
export async function importPolotnoDesign(
  json: unknown,
  options: PolotnoImportOptions = {},
): Promise<PolotnoImportResult | PolotnoImportError> {
  const outcome = convert(json);
  if ('error' in outcome) return { error: outcome.error };

  const { result, ctx } = outcome;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const [taskResults, fontFiles] = await Promise.all([
    Promise.all(ctx.tasks.map((task) => runAssetTask(task, timeoutMs))),
    Promise.all(result.fonts.map((font) => downloadFont(font, timeoutMs))),
  ]);

  const notes = buildNotes(ctx);
  const cropsLost = taskResults.filter((outcome) => outcome.cropLost).length;
  if (cropsLost) {
    notes.push(`${plural(cropsLost, "picture couldn't", "pictures couldn't")} be loaded to apply ${cropsLost === 1 ? 'its' : 'their'} crop; ${cropsLost === 1 ? 'it shows' : 'they show'} uncropped.`);
  }
  const svgsLost = taskResults.filter((outcome) => outcome.svgLost).length;
  if (svgsLost) {
    notes.push(`${plural(svgsLost, "graphic couldn't", "graphics couldn't")} be loaded to apply ${svgsLost === 1 ? 'its' : 'their'} colours.`);
  }
  const downloaded = fontFiles.filter((font): font is PolotnoFontFile => font !== null);
  const fontsLost = result.fonts.length - downloaded.length;
  if (fontsLost) {
    notes.push(`${plural(fontsLost, "font couldn't", "fonts couldn't")} be downloaded, so a similar font is shown instead.`);
  }

  return { ...result, fontFiles: downloaded, notes };
}

/**
 * SVG Color Utilities
 *
 * Provides tools to detect SVG sources, extract all unique CSS colors
 * from an SVG, and apply color replacements for per-color editing.
 *
 * Handles:
 *  - Presentation attributes (fill, stroke, …)
 *  - Inline style="…" declarations
 *  - <style> CSS block rules
 *  - Implicit default fill (#000000) for shape elements that carry no
 *    explicit fill anywhere in their ancestor chain
 */

// Presentation attributes that carry color values in SVG
const SVG_COLOR_ATTRS = [
  'fill',
  'stroke',
  'color',
  'stop-color',
  'flood-color',
  'lighting-color',
] as const;

// Same values as a Set for O(1) lookup against inline-style property names
const SVG_COLOR_PROPS = new Set(SVG_COLOR_ATTRS as unknown as string[]);

// Values to skip
const SKIP_VALUES = new Set([
  'none',
  'transparent',
  'currentcolor',
  'inherit',
  'initial',
  'unset',
]);

// SVG elements that paint with fill by default (SVG spec fill default = black)
const SHAPE_ELEMENTS = new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'text',
  'textpath',
  'tspan',
  'use',
]);

// ─── Detect SVG source ────────────────────────────────────────────────────────

export function isSvgSrc(src: string): boolean {
  if (!src) return false;
  return (
    src.startsWith('data:image/svg+xml') ||
    src.toLowerCase().split('?')[0].endsWith('.svg')
  );
}

// ─── Color normalization ──────────────────────────────────────────────────────

let _normCanvas: HTMLCanvasElement | null = null;
let _normCtx: CanvasRenderingContext2D | null = null;

function getNormCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_normCanvas) {
    _normCanvas = document.createElement('canvas');
    _normCanvas.width = _normCanvas.height = 1;
    _normCtx = _normCanvas.getContext('2d');
  }
  return _normCtx;
}

/**
 * Normalize any CSS color string to lowercase #rrggbb hex.
 * Returns null for invalid, skippable, or transparent colors.
 */
export function normalizeColor(color: string): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!trimmed || trimmed.startsWith('url(')) return null;
  if (SKIP_VALUES.has(trimmed.toLowerCase())) return null;

  const ctx = getNormCtx();
  if (!ctx) return null;

  const sentinel = 'rgba(1, 2, 3, 0.502)';
  ctx.fillStyle = sentinel;
  ctx.fillStyle = trimmed;
  const result = ctx.fillStyle;

  if (result === sentinel) return null;

  if (result.startsWith('rgba(')) {
    const m = result.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (!m) return null;
    if (parseFloat(m[4]) < 0.99) return null;
    return rgbToHex(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
  }

  return result.toLowerCase();
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// ─── Decode / encode SVG data URLs ───────────────────────────────────────────

function decodeSvgSrc(src: string): string | null {
  try {
    if (src.startsWith('data:image/svg+xml;base64,')) {
      return atob(src.slice('data:image/svg+xml;base64,'.length));
    }
    if (src.startsWith('data:image/svg+xml,')) {
      return decodeURIComponent(src.slice('data:image/svg+xml,'.length));
    }
    if (src.startsWith('data:image/svg+xml;utf8,')) {
      return src.slice('data:image/svg+xml;utf8,'.length);
    }
  } catch {
    // decode failure
  }
  return null;
}

function encodeSvgSrc(svgText: string): string {
  try {
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
  } catch {
    return 'data:image/svg+xml;base64,' + btoa(svgText);
  }
}

// ─── Helpers for implicit fill detection ─────────────────────────────────────

function isSvgShapeElement(el: Element): boolean {
  return SHAPE_ELEMENTS.has(el.tagName.toLowerCase());
}

/** True if the element itself has an explicit fill via attribute or style. */
function elementHasExplicitFill(el: Element): boolean {
  if (el.hasAttribute('fill')) return true;
  const style = el.getAttribute('style');
  return !!style && /\bfill\s*:/i.test(style);
}

/**
 * True if any ancestor of el (up to and including root) has an explicit fill.
 * This means el's fill is inherited, not the SVG-spec default black.
 */
function ancestorHasExplicitFill(el: Element, root: Element): boolean {
  let p = el.parentElement;
  while (p) {
    if (elementHasExplicitFill(p)) return true;
    if (p === root) break;
    p = p.parentElement;
  }
  return false;
}

// ─── <style> block helpers ────────────────────────────────────────────────────

/** Yield every color value found in fill/stroke declarations inside a CSS text. */
function* styleBlockColorValues(css: string): Generator<string> {
  // Matches: fill: <value> or stroke: <value> (inside rules or inline)
  const re = /\b(?:fill|stroke)\s*:\s*([^;}"'\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    yield m[1];
  }
}

/** Replace fill/stroke color values inside a CSS text block. */
function replaceStyleBlockColors(
  css: string,
  colorMap: Record<string, string>,
): string {
  return css.replace(
    /(\b(?:fill|stroke)\s*:\s*)([^;}"'\s]+)/gi,
    (_, prop: string, val: string) => {
      const norm = normalizeColor(val);
      if (norm && colorMap[norm]) return prop + colorMap[norm];
      return _ as string;
    },
  );
}

// ─── Color collection ─────────────────────────────────────────────────────────

function collectColors(
  el: Element,
  root: Element,
  collector: (rawValue: string) => void,
): void {
  const tag = el.tagName.toLowerCase();

  // <style> blocks: scan CSS text for fill/stroke values
  if (tag === 'style') {
    for (const v of styleBlockColorValues(el.textContent ?? '')) {
      collector(v);
    }
    return; // no further processing for <style>
  }

  // Presentation attributes
  for (const attr of SVG_COLOR_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) collector(val);
  }

  // Inline style
  const style = el.getAttribute('style');
  if (style) {
    for (const decl of style.split(';')) {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const val = decl.slice(colonIdx + 1).trim();
      if (SVG_COLOR_PROPS.has(prop) && val) collector(val);
    }
  }

  // Implicit default fill: shape elements with no fill set anywhere in their
  // ancestor chain render as black per the SVG spec.
  if (
    isSvgShapeElement(el) &&
    !elementHasExplicitFill(el) &&
    !ancestorHasExplicitFill(el, root)
  ) {
    collector('black'); // SVG fill default
  }

  for (let i = 0; i < el.children.length; i++) {
    collectColors(el.children[i], root, collector);
  }
}

// ─── Color replacement ────────────────────────────────────────────────────────

function replaceColors(
  el: Element,
  root: Element,
  colorMap: Record<string, string>,
): void {
  const tag = el.tagName.toLowerCase();

  // <style> blocks: rewrite fill/stroke values in the CSS text
  if (tag === 'style' && el.textContent) {
    el.textContent = replaceStyleBlockColors(el.textContent, colorMap);
    return;
  }

  // Presentation attributes
  for (const attr of SVG_COLOR_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) {
      const norm = normalizeColor(val);
      if (norm && colorMap[norm]) el.setAttribute(attr, colorMap[norm]);
    }
  }

  // Inline style
  const style = el.getAttribute('style');
  if (style) {
    const newDecls = style.split(';').map((decl) => {
      const colonIdx = decl.indexOf(':');
      if (colonIdx === -1) return decl;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const val = decl.slice(colonIdx + 1).trim();
      if (!SVG_COLOR_PROPS.has(prop) || !val) return decl;
      const norm = normalizeColor(val);
      if (norm && colorMap[norm]) {
        return `${decl.slice(0, colonIdx + 1)} ${colorMap[norm]}`;
      }
      return decl;
    });
    el.setAttribute('style', newDecls.join(';'));
  }

  // Implicit default fill: inject an explicit attribute so the replacement
  // takes effect (the SVG-spec default black cannot be overridden otherwise).
  if (
    isSvgShapeElement(el) &&
    !elementHasExplicitFill(el) &&
    !ancestorHasExplicitFill(el, root)
  ) {
    const black = normalizeColor('black')!; // '#000000'
    if (colorMap[black]) {
      el.setAttribute('fill', colorMap[black]);
    }
  }

  for (let i = 0; i < el.children.length; i++) {
    replaceColors(el.children[i], root, colorMap);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract all unique, opaque colors from an SVG data-URI source.
 * Returns an array of normalized lowercase hex colors (#rrggbb).
 * The order is document order (first encounter).
 *
 * Covers presentation attributes, inline styles, <style> CSS blocks, and
 * the implicit SVG default fill (black) for shape elements with no
 * explicit fill on themselves or any ancestor.
 */
export function extractSvgPalette(src: string): string[] {
  const svgText = decodeSvgSrc(src);
  if (!svgText) return [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName === 'parsererror') return [];

    const seen = new Set<string>();
    const ordered: string[] = [];

    collectColors(root, root, (rawValue) => {
      const norm = normalizeColor(rawValue);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        ordered.push(norm);
      }
    });

    return ordered;
  } catch {
    return [];
  }
}

/**
 * Apply color replacements to an SVG data-URI source.
 *
 * @param src       The original SVG data-URI
 * @param colorMap  Map of original-normalized-hex → replacement-hex
 * @returns         A new SVG data-URI with colors replaced, or the original
 *                  src if decoding fails or the map is empty.
 */
export function applySvgColorReplacements(
  src: string,
  colorMap: Record<string, string>,
): string {
  if (!colorMap || Object.keys(colorMap).length === 0) return src;

  const svgText = decodeSvgSrc(src);
  if (!svgText) return src;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName === 'parsererror') return src;

    replaceColors(root, root, colorMap);

    const serializer = new XMLSerializer();
    const newSvgText = serializer.serializeToString(doc);
    return encodeSvgSrc(newSvgText);
  } catch {
    return src;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Rich text utilities for inline text styling.
 * Handles DOM ↔ TextSpan[] conversion and canvas layout.
 */

import type { TextSpan } from '@sabi-canvas/types/canvas-objects';

export type { TextSpan };

// ---------------------------------------------------------------------------
// DOM → TextSpan[] serialization
// ---------------------------------------------------------------------------

interface StyleStack {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string | null;
  fontFamily: string | null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function parseColor(str: string | undefined | null): string | null {
  if (!str) return null;
  const s = str.trim();
  if (s === '' || s === 'inherit' || s === 'initial' || s === 'transparent') return null;

  // rgb(r, g, b)
  const rgbMatch = s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]);
    const g = parseInt(rgbMatch[2]);
    const b = parseInt(rgbMatch[3]);
    // Treat black as "no color override" since it's the default
    if (r === 0 && g === 0 && b === 0) return null;
    return rgbToHex(r, g, b);
  }
  if (s.startsWith('#')) {
    if (s === '#000000') return null; // default black
    return s;
  }
  return null;
}

function walkNode(node: Node, style: StyleStack, spans: TextSpan[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) {
      const span: TextSpan = { text };
      if (style.bold) span.bold = true;
      if (style.italic) span.italic = true;
      if (style.underline) span.underline = true;
      if (style.strikethrough) span.strikethrough = true;
      if (style.color) span.color = style.color;
      if (style.fontFamily) span.fontFamily = style.fontFamily;
      spans.push(span);
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    spans.push({ text: '\n' });
    return;
  }

  const newStyle = { ...style };

  if (tag === 'b' || tag === 'strong') newStyle.bold = true;
  if (tag === 'i' || tag === 'em') newStyle.italic = true;
  if (tag === 'u') newStyle.underline = true;
  if (tag === 's' || tag === 'del' || tag === 'strike') newStyle.strikethrough = true;

  const cs = el.style;
  const fw = cs.fontWeight;
  if (fw === 'bold' || fw === '700' || fw === '800' || fw === '900') newStyle.bold = true;
  if (['100', '200', '300', '400', '500', '600', 'normal'].includes(fw)) newStyle.bold = false;
  if (cs.fontStyle === 'italic') newStyle.italic = true;
  if (cs.fontStyle === 'normal') newStyle.italic = false;

  const td = cs.textDecoration || (cs as any).textDecorationLine || '';
  if (td.includes('underline')) newStyle.underline = true;
  if (td.includes('line-through')) newStyle.strikethrough = true;

  const colorFromStyle = parseColor(cs.color);
  if (colorFromStyle) newStyle.color = colorFromStyle;

  // <font color="..."> produced by execCommand('foreColor') uses an HTML attribute, not a style property
  if (tag === 'font') {
    const colorAttr = el.getAttribute('color');
    if (colorAttr) {
      const c = parseColor(colorAttr);
      if (c) newStyle.color = c;
    }
  }

  const ff = cs.fontFamily;
  if (ff) {
    // Take the first font name in the stack and strip surrounding quotes
    const first = ff.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (first) newStyle.fontFamily = first;
  }

  // Block elements produce a newline before their content (except the very first line)
  const isBlock = tag === 'div' || tag === 'p';
  if (isBlock && spans.length > 0) {
    const last = spans[spans.length - 1];
    if (!last.text.endsWith('\n')) {
      spans.push({ text: '\n' });
    }
  }

  for (const child of Array.from(el.childNodes)) {
    walkNode(child, newStyle, spans);
  }

  // Closing block element: don't add trailing newline here (leading newline handles it next time)
}

/** Convert a contentEditable DOM element to a TextSpan array. */
export function domToSpans(container: HTMLElement): TextSpan[] {
  const spans: TextSpan[] = [];
  const base: StyleStack = { bold: false, italic: false, underline: false, strikethrough: false, color: null, fontFamily: null };

  for (const child of Array.from(container.childNodes)) {
    walkNode(child, base, spans);
  }

  // Remove all phantom trailing newlines browsers add to contentEditable
  while (spans.length > 0) {
    const last = spans[spans.length - 1];
    if (last.text === '\n') {
      spans.pop();
    } else if (last.text.endsWith('\n')) {
      spans[spans.length - 1] = { ...last, text: last.text.slice(0, -1) };
      break;
    } else {
      break;
    }
  }

  return normalizeSpans(spans);
}

/** Merge adjacent spans that have identical styling. Remove empty spans. */
export function normalizeSpans(spans: TextSpan[]): TextSpan[] {
  const result: TextSpan[] = [];
  for (const span of spans) {
    if (!span.text) continue;
    if (result.length === 0) {
      result.push({ ...span });
      continue;
    }
    const prev = result[result.length - 1];
    if (
      !!prev.bold === !!span.bold &&
      !!prev.italic === !!span.italic &&
      !!prev.underline === !!span.underline &&
      !!prev.strikethrough === !!span.strikethrough &&
      (prev.color ?? null) === (span.color ?? null) &&
      (prev.fontFamily ?? null) === (span.fontFamily ?? null)
    ) {
      result[result.length - 1] = { ...prev, text: prev.text + span.text };
    } else {
      result.push({ ...span });
    }
  }
  return result;
}

/** Return the plain-text content of a spans array. */
export function spansToPlainText(spans: TextSpan[]): string {
  return spans.map(s => s.text).join('');
}

/** Returns true when none of the spans carry any inline styling. */
export function isPlainSpans(spans: TextSpan[]): boolean {
  return spans.every(s => !s.bold && !s.italic && !s.underline && !s.strikethrough && !s.color && !s.fontFamily);
}

// ---------------------------------------------------------------------------
// TextSpan[] → HTML (for reinitializing contentEditable)
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert a TextSpan array to an HTML string suitable for contentEditable innerHTML. */
export function spansToHtml(spans: TextSpan[]): string {
  let html = '';

  for (const span of spans) {
    const lines = span.text.split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) html += '<br>';
      if (!line) return;

      let content = escapeHtml(line);
      // Wrap inner to outer (innermost tags are applied last so they wrap tightest)
      if (span.fontFamily) content = `<span style="font-family:${span.fontFamily}">${content}</span>`;
      if (span.color) content = `<span style="color:${span.color}">${content}</span>`;
      if (span.strikethrough) content = `<s>${content}</s>`;
      if (span.underline) content = `<u>${content}</u>`;
      if (span.italic) content = `<i>${content}</i>`;
      if (span.bold) content = `<b>${content}</b>`;
      html += content;
    });
  }

  return html;
}

// ---------------------------------------------------------------------------
// Canvas layout engine
// ---------------------------------------------------------------------------

export interface LayoutRun {
  text: string;
  x: number;
  y: number;
  width: number;
  font: string;
  color: string;
  underline: boolean;
  strikethrough: boolean;
  fontSize: number;
}

export interface LayoutResult {
  runs: LayoutRun[];
  totalHeight: number;
  lineCount: number;
}

function buildFont(bold: boolean, italic: boolean, fontSize: number, fontFamily: string): string {
  const style = italic ? 'italic' : 'normal';
  const weight = bold ? 'bold' : 'normal';
  return `${style} ${weight} ${fontSize}px ${fontFamily}`;
}

let _measureCanvas: HTMLCanvasElement | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!_measureCanvas) {
    _measureCanvas = document.createElement('canvas');
    _measureCanvas.width = 1;
    _measureCanvas.height = 1;
  }
  return _measureCanvas.getContext('2d')!;
}

function measureText(text: string, font: string, letterSpacing: number): number {
  const ctx = getMeasureCtx();
  ctx.font = font;
  const baseWidth = ctx.measureText(text).width;
  return baseWidth + letterSpacing * text.length;
}

interface Token {
  text: string;
  isNewline: boolean;
  span: TextSpan;
}

function tokenize(spans: TextSpan[]): Token[] {
  const tokens: Token[] = [];
  for (const span of spans) {
    // Split on newlines and whitespace groups, keeping delimiters
    const parts = span.text.split(/(\n| +)/);
    for (const part of parts) {
      if (!part) continue;
      tokens.push({
        text: part,
        isNewline: part === '\n',
        span,
      });
    }
  }
  return tokens;
}

/**
 * Layout a rich text span array into positioned runs for canvas drawing.
 * The returned run coordinates are relative to the top-left of the text bounding box.
 */
export function layoutRichText(
  spans: TextSpan[],
  opts: {
    maxWidth: number;
    baseFontSize: number;
    baseFontFamily: string;
    baseColor: string;
    baseBold: boolean;
    baseItalic: boolean;
    baseUnderline?: boolean;
    baseStrikethrough?: boolean;
    lineHeight: number;
    letterSpacing: number;
    align: 'left' | 'center' | 'right';
  }
): LayoutResult {
  const {
    maxWidth,
    baseFontSize,
    baseFontFamily,
    baseColor,
    baseBold,
    baseItalic,
    baseUnderline = false,
    baseStrikethrough = false,
    lineHeight,
    letterSpacing,
    align,
  } = opts;

  const lineHeightPx = baseFontSize * lineHeight;
  const tokens = tokenize(spans);

  interface LineItem {
    token: Token;
    width: number;
  }

  const lines: LineItem[][] = [[]];
  let currentLineWidth = 0;

  for (const token of tokens) {
    if (token.isNewline) {
      lines.push([]);
      currentLineWidth = 0;
      continue;
    }

    const bold = !!(token.span.bold || baseBold);
    const italic = !!(token.span.italic || baseItalic);
    const effectiveFontFamily = token.span.fontFamily || baseFontFamily;
    const font = buildFont(bold, italic, baseFontSize, effectiveFontFamily);
    const w = measureText(token.text, font, letterSpacing);

    const currentLine = lines[lines.length - 1];
    const isSpace = /^\s+$/.test(token.text);

    if (maxWidth > 0 && currentLineWidth + w > maxWidth && currentLine.length > 0 && !isSpace) {
      lines.push([{ token, width: w }]);
      currentLineWidth = w;
    } else {
      currentLine.push({ token, width: w });
      currentLineWidth += w;
    }
  }

  const runs: LayoutRun[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Trim leading whitespace on wrapped lines (not the first)
    const trimmed = lineIdx === 0
      ? line
      : line.filter((item, i) => i > 0 || !/^\s+$/.test(item.token.text));

    const lineWidth = trimmed.reduce((sum, item) => sum + item.width, 0);

    let xOffset = 0;
    if (align === 'center') xOffset = Math.max(0, (maxWidth - lineWidth) / 2);
    else if (align === 'right') xOffset = Math.max(0, maxWidth - lineWidth);

    let x = xOffset;
    // Center y within the line slot to match Konva's Text rendering (textBaseline='middle')
    const y = lineIdx * lineHeightPx + lineHeightPx / 2;

    for (const { token, width } of trimmed) {
      const bold = !!(token.span.bold || baseBold);
      const italic = !!(token.span.italic || baseItalic);
      const effectiveFontFamily = token.span.fontFamily || baseFontFamily;
      const font = buildFont(bold, italic, baseFontSize, effectiveFontFamily);
      const color = token.span.color ?? baseColor;

      runs.push({
        text: token.text,
        x,
        y,
        width,
        font,
        color,
        underline: !!(token.span.underline || baseUnderline),
        strikethrough: !!(token.span.strikethrough || baseStrikethrough),
        fontSize: baseFontSize,
      });

      x += width;
    }
  }

  // Exclude trailing empty lines from the height calculation
  let lineCountForHeight = lines.length;
  while (lineCountForHeight > 1 && lines[lineCountForHeight - 1].length === 0) {
    lineCountForHeight--;
  }

  return {
    runs,
    totalHeight: lineCountForHeight * lineHeightPx,
    lineCount: lines.length,
  };
}

/**
 * Draw a LayoutResult onto a CanvasRenderingContext2D.
 * The context should be pre-transformed so (0,0) is the top-left of the text box.
 */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  result: LayoutResult,
  letterSpacing: number
): void {
  const prevBaseline = ctx.textBaseline;
  const prevFont = ctx.font;
  const prevFill = ctx.fillStyle;

  ctx.textBaseline = 'middle';

  for (const run of result.runs) {
    ctx.font = run.font;
    ctx.fillStyle = run.color;

    if (letterSpacing !== 0) {
      // Draw character by character to honour letter spacing
      let cx = run.x;
      for (const char of run.text) {
        ctx.fillText(char, cx, run.y);
        const cw = ctx.measureText(char).width;
        cx += cw + letterSpacing;
      }
    } else {
      ctx.fillText(run.text, run.x, run.y);
    }

    if (run.underline) {
      // run.y is center of em; bottom of em ≈ run.y + fontSize/2
      const lineY = run.y + run.fontSize * 0.5 + 1;
      ctx.fillRect(run.x, lineY, run.width, Math.max(1, run.fontSize / 14));
    }
    if (run.strikethrough) {
      // Strikethrough through x-height center ≈ slightly above em center
      const lineY = run.y - run.fontSize * 0.08;
      ctx.fillRect(run.x, lineY, run.width, Math.max(1, run.fontSize / 14));
    }
  }

  ctx.textBaseline = prevBaseline;
  ctx.font = prevFont;
  ctx.fillStyle = prevFill;
}

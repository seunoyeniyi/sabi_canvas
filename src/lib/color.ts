import type { CanvasPage } from '@sabi-canvas/types/pages';

/** A colour as 0–255 channels and 0–1 alpha. */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

let parseContext: CanvasRenderingContext2D | null | undefined;

const getParseContext = (): CanvasRenderingContext2D | null => {
  if (parseContext !== undefined) return parseContext;
  if (typeof document === 'undefined') return null;
  parseContext = document.createElement('canvas').getContext('2d');
  return parseContext;
};

const clampChannel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));
const clampAlpha = (value: number): number => Math.min(1, Math.max(0, Math.round(value * 100) / 100));

/**
 * Reads any CSS colour (hex with or without alpha, rgb/rgba, hsl/hsla, a name,
 * 'transparent') the way the browser does. Null if it isn't a colour.
 */
export function parseCssColor(input: string | null | undefined): RgbaColor | null {
  const value = input?.trim();
  if (!value) return null;
  if (value.toLowerCase() === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const ctx = getParseContext();
  if (!ctx) return null;

  // The browser leaves fillStyle unchanged when a value isn't a colour.
  const sentinel = 'rgba(1, 2, 3, 0.25)';
  ctx.fillStyle = sentinel;
  ctx.fillStyle = value;
  const parsed = String(ctx.fillStyle);
  if (parsed === sentinel && value.replace(/\s/g, '') !== sentinel.replace(/\s/g, '')) return null;

  if (parsed.startsWith('#')) {
    return {
      r: parseInt(parsed.slice(1, 3), 16),
      g: parseInt(parsed.slice(3, 5), 16),
      b: parseInt(parsed.slice(5, 7), 16),
      a: 1,
    };
  }
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(parsed);
  if (!match) return null;
  return {
    r: clampChannel(Number(match[1])),
    g: clampChannel(Number(match[2])),
    b: clampChannel(Number(match[3])),
    a: match[4] === undefined ? 1 : clampAlpha(Number(match[4])),
  };
}

/** '#rrggbb' for the colour's channels, ignoring alpha. */
export function toHex6({ r, g, b }: Pick<RgbaColor, 'r' | 'g' | 'b'>): string {
  return `#${[r, g, b].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The string stored on objects: '#rrggbb' when opaque (as before), otherwise
 * 'rgba(r, g, b, a)', which every part of the editor and Konva reads.
 */
export function formatColor(color: RgbaColor): string {
  const alpha = clampAlpha(color.a);
  if (alpha >= 1) return toHex6(color);
  return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${alpha})`;
}

export function isSameColor(a: RgbaColor | null, b: RgbaColor | null): boolean {
  if (!a || !b) return false;
  return (
    clampChannel(a.r) === clampChannel(b.r) &&
    clampChannel(a.g) === clampChannel(b.g) &&
    clampChannel(a.b) === clampChannel(b.b) &&
    clampAlpha(a.a) === clampAlpha(b.a)
  );
}

/** Reads a typed hex value ('f80', 'ff8800', '#ff8800'); null until it's complete. */
export function parseHexInput(input: string): Pick<RgbaColor, 'r' | 'g' | 'b'> | null {
  const hex = input.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  if (full.length !== 6) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Swatches offered in every colour picker unless the host sets `colorSwatches`. */
export const DEFAULT_COLOR_SWATCHES: string[] = [
  '#000000', '#434343', '#737373', '#a6a6a6', '#d9d9d9', '#ffffff', '#ff3131', '#ff5757',
  '#ff66c4', '#cb6ce6', '#8c52ff', '#5e17eb', '#0097b2', '#0cc0df', '#5ce1e6', '#38b6ff',
  '#5271ff', '#004aad', '#00bf63', '#7ed957', '#c1ff72', '#ffde59', '#ffbd59', '#ff914d',
];

/**
 * Colours already used in the design (fills, outlines, text, backgrounds),
 * most used first, as stored strings. Fully see-through colours are left out.
 */
export function collectDesignColors(pages: CanvasPage[], limit = 16): string[] {
  const counts = new Map<string, number>();
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const parsed = parseCssColor(value);
    if (!parsed || parsed.a === 0) return;
    const key = formatColor(parsed);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const page of pages) {
    const background = page.background;
    if (background?.type === 'solid') add(background.color);
    if (background?.type === 'linear-gradient' || background?.type === 'radial-gradient') background.colors.forEach(add);

    for (const object of page.objects) {
      const record = object as unknown as Record<string, unknown>;
      ['fill', 'stroke', 'textStrokeColor', 'textBgColor', 'innerTextFill', 'colorOverlay'].forEach((key) => add(record[key]));
      if (Array.isArray(record.gradientColors)) record.gradientColors.forEach(add);
      if (Array.isArray(record.richText)) (record.richText as Array<{ color?: string }>).forEach((span) => add(span.color));
      // A graphic shows its palette with any swapped colours replaced.
      const swaps = (record.svgColors && typeof record.svgColors === 'object' ? record.svgColors : {}) as Record<string, string>;
      if (Array.isArray(record.svgPalette)) {
        (record.svgPalette as string[]).forEach((original) => add(swaps[original] ?? original));
      } else {
        Object.values(swaps).forEach(add);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([color]) => color);
}

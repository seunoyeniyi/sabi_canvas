/**
 * Realistic product previews, made the way Photoshop mockup templates and
 * print on demand mockup generators make them:
 *
 * - **Light and texture**: the product picture's shadows darken the design
 *   (multiply) and its highlights lighten it (screen), so folds, creases and
 *   the fabric's weave show through instead of being covered.
 * - **Folds**: a smoothed map of the picture's light moves the design's pixels
 *   (a displacement map), so the design bends with the creases.
 * - **Shape**: the design can follow a curved edge (pouches, bags) or a round
 *   surface (mugs, bottles, tumblers).
 *
 * Everything is read from the plain product picture, so a business only
 * uploads the picture. Print files never go through this: they stay flat.
 */

import type { MockupRealism } from '@sabi-canvas/types/canvas-objects';

export type { MockupRealism };

/** Name of the live light-and-shadow pictures over a customer's design in the editor; never exported. */
export const MOCKUP_LIGHTING_NAME = 'mockup-lighting';

export const DEFAULT_MOCKUP_REALISM: Required<MockupRealism> = {
  shading: 1,
  folds: 0.5,
  roundness: 0,
  curveTop: 0,
  curveBottom: 0,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/** Every field filled in and kept in range. */
export function resolveMockupRealism(value?: MockupRealism | null): Required<MockupRealism> {
  const d = DEFAULT_MOCKUP_REALISM;
  return {
    shading: clamp(finite(value?.shading, d.shading), 0, 1),
    folds: clamp(finite(value?.folds, d.folds), 0, 1),
    roundness: clamp(finite(value?.roundness, d.roundness), 0, 1),
    curveTop: clamp(finite(value?.curveTop, d.curveTop), -1, 1),
    curveBottom: clamp(finite(value?.curveBottom, d.curveBottom), -1, 1),
  };
}

/** Whether the design is reshaped (curved or round), not only lit. */
export function changesShape(realism?: MockupRealism | null): boolean {
  const r = resolveMockupRealism(realism);
  return r.roundness > 0 || r.curveTop !== 0 || r.curveBottom !== 0;
}

/** The light read from part of a product picture, one value per pixel. */
export interface MockupLightMap {
  width: number;
  height: number;
  /** How much darker than the product's own colour, 0 (not at all) to 1 (black). */
  shadow: Float32Array;
  /** How much lighter, 0 (not at all) to 1 (white). */
  highlight: Float32Array;
  /** Smoothed rise (+) and dip (−) of the surface, about −1 to 1, for bending the design. */
  relief: Float32Array;
}

/** Softens shadows on dark products, where small changes in light are large in proportion. */
const DARK_FLOOR = 0.12;
const MAX_SHADOW = 0.85;
const HIGHLIGHT_GAIN = 1.25;
const MAX_HIGHLIGHT = 0.5;
/**
 * Pixels this far from the product's typical brightness are taken for the
 * background behind it (a white studio wall behind a red T-shirt): they
 * neither light nor bend the design. Real folds stay well within it.
 */
const BACKGROUND_GAP = 0.5;

/** Box blur, run three times: close to a Gaussian blur, at any radius, in linear time. */
function blur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius < 1) return values;
  let src: Float32Array = values;
  let dst: Float32Array = new Float32Array(values.length);
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    const lines = horizontal ? height : width;
    const length = horizontal ? width : height;
    const step = horizontal ? 1 : width;
    const size = radius * 2 + 1;
    for (let line = 0; line < lines; line += 1) {
      const start = horizontal ? line * width : line;
      // Edges repeat the nearest value
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) sum += from[start + clamp(k, 0, length - 1) * step];
      for (let i = 0; i < length; i += 1) {
        to[start + i * step] = sum / size;
        sum += from[start + Math.min(length - 1, i + radius + 1) * step] - from[start + Math.max(0, i - radius) * step];
      }
    }
  };
  for (let n = 0; n < 3; n += 1) {
    pass(src, dst, true);
    [src, dst] = [dst, src];
    pass(src, dst, false);
    [src, dst] = [dst, src];
  }
  return src;
}

/**
 * Reads the light from a product picture's pixels (usually the print area
 * and a little around it). The product's typical brightness counts as
 * "no light change", so the result suits white, coloured and black products
 * alike. See-through pixels count as flat.
 */
export function readMockupLight(pixels: ImageData): MockupLightMap {
  const { width, height, data } = pixels;
  const count = width * height;
  const lum = new Float32Array(count);
  const solid = new Uint8Array(count);
  const histogram = new Uint32Array(256);
  let solidCount = 0;

  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    if (data[o + 3] < 128) continue;
    const value = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    lum[i] = value;
    solid[i] = 1;
    solidCount += 1;
    histogram[Math.min(255, Math.round(value * 255))] += 1;
  }

  const shadow = new Float32Array(count);
  const highlight = new Float32Array(count);
  if (!solidCount) return { width, height, shadow, highlight, relief: new Float32Array(count) };

  // The median brightness stands for the product's own colour under even light
  let seen = 0;
  let median = 0.5;
  for (let level = 0; level < 256; level += 1) {
    seen += histogram[level];
    if (seen >= solidCount / 2) {
      median = level / 255;
      break;
    }
  }

  for (let i = 0; i < count; i += 1) {
    if (!solid[i] || Math.abs(lum[i] - median) > BACKGROUND_GAP) {
      lum[i] = median;
      continue;
    }
    const value = lum[i];
    shadow[i] = clamp(1 - (value + DARK_FLOOR) / (median + DARK_FLOOR), 0, MAX_SHADOW);
    highlight[i] = clamp((value - median) * HIGHLIGHT_GAIN, 0, MAX_HIGHLIGHT);
  }

  // Folds are broad: smooth away the weave and noise so only they bend the design
  const smooth = blur(lum, width, height, Math.max(1, Math.round(Math.max(width, height) * 0.02)));
  const relief = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    relief[i] = clamp((smooth[i] - median) / (median + DARK_FLOOR), -1, 1);
  }

  return { width, height, shadow, highlight, relief };
}

/**
 * Two see-through pictures the size of the light map, for live previews:
 * black where the picture is shadowed and white where it's lit. Drawn over
 * the design with `source-atop` (only on the design's own pixels), they give
 * the same light as `composeRealisticMockup`, without bending.
 */
export function mockupLightOverlays(light: MockupLightMap): { shadow: HTMLCanvasElement; highlight: HTMLCanvasElement } {
  const make = (values: Float32Array, tone: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = light.width;
    canvas.height = light.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const image = ctx.createImageData(light.width, light.height);
    for (let i = 0; i < values.length; i += 1) {
      const o = i * 4;
      image.data[o] = tone;
      image.data[o + 1] = tone;
      image.data[o + 2] = tone;
      image.data[o + 3] = Math.round(values[i] * 255);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  };
  return { shadow: make(light.shadow, 0), highlight: make(light.highlight, 255) };
}

export interface ComposeMockupOptions {
  /** The product without the design (picture, background…), at the output size. Not changed. */
  base: HTMLCanvasElement;
  /** The design over the print area, see-through where empty, at any resolution (twice the output is sharpest). Stretched to `area`. */
  design: HTMLCanvasElement;
  /** The print area on `base`, in its pixels. */
  area: { x: number; y: number; width: number; height: number };
  realism?: MockupRealism | null;
  /**
   * `composite` (default): the product with the design on it. `design`: only
   * the lit, bent design on a see-through canvas the size of `base`, e.g. to
   * lay over the product and move it while a print area is dragged.
   */
  output?: 'composite' | 'design';
}

/** Largest dip or arch of a curved edge, as a share of the print area's height. */
const CURVE_DEPTH = 0.12;
/** Largest bend from folds, as a share of the print area's shorter side. */
const FOLD_DEPTH = 0.025;
/** At full roundness, the half of the surface that shows turns this far (radians). */
const MAX_TURN = 1.25;

/**
 * The product with the design on it, lit by the picture, bent by its folds
 * and shaped to its surface. Returns a new canvas the size of `base`.
 */
export function composeRealisticMockup({ base, design, area, realism, output = 'composite' }: ComposeMockupOptions): HTMLCanvasElement {
  const r = resolveMockupRealism(realism);
  const designOnly = output === 'design';
  const out = document.createElement('canvas');
  out.width = base.width;
  out.height = base.height;
  const outCtx = out.getContext('2d', { willReadFrequently: true });
  if (!outCtx) throw new Error('This browser can’t draw the preview.');
  // The light is always read from the product, even when only the design is returned
  const baseCtx = designOnly ? base.getContext('2d', { willReadFrequently: true }) : outCtx;
  if (!baseCtx) throw new Error('This browser can’t draw the preview.');
  if (!designOnly) outCtx.drawImage(base, 0, 0);

  const areaW = Math.max(1, area.width);
  const areaH = Math.max(1, area.height);
  const curvePx = CURVE_DEPTH * areaH;
  const foldPx = r.folds * FOLD_DEPTH * Math.min(areaW, areaH);
  const padY = Math.ceil(Math.max(Math.abs(r.curveTop), Math.abs(r.curveBottom)) * curvePx + foldPx) + 2;
  const padX = Math.ceil(foldPx) + 2;

  // The part of the picture the design can reach
  const left = clamp(Math.floor(area.x - padX), 0, base.width);
  const top = clamp(Math.floor(area.y - padY), 0, base.height);
  const right = clamp(Math.ceil(area.x + areaW + padX), 0, base.width);
  const bottom = clamp(Math.ceil(area.y + areaH + padY), 0, base.height);
  const outerW = right - left;
  const outerH = bottom - top;
  if (outerW <= 0 || outerH <= 0) return out;

  const pixels = baseCtx.getImageData(left, top, outerW, outerH);
  const light = readMockupLight(pixels);
  // Only the design: a see-through layer, the light still read from the product
  const layer = designOnly ? outCtx.createImageData(outerW, outerH) : pixels;

  // The design's own pixels, at whatever resolution it was drawn (twice the
  // output is sharpest); samples are scaled to it
  const designW = Math.max(1, design.width);
  const designH = Math.max(1, design.height);
  const designCtx = design.getContext('2d', { willReadFrequently: true });
  if (!designCtx) return out;
  const designPixels = designCtx.getImageData(0, 0, designW, designH);
  const toDesignX = designW / areaW;
  const toDesignY = designH / areaH;
  const src = designPixels.data;
  const dst = layer.data;

  const turn = r.roundness * MAX_TURN;
  const sinTurn = Math.sin(turn);

  for (let oy = 0; oy < outerH; oy += 1) {
    const y = top + oy + 0.5;
    const v = (y - area.y) / areaH;
    const vc = clamp(v, 0, 1);
    const curve = r.curveTop * (1 - vc) + r.curveBottom * vc;

    for (let ox = 0; ox < outerW; ox += 1) {
      const x = left + ox + 0.5;
      const u = (x - area.x) / areaW;
      const across = 2 * u - 1;

      // Round surfaces: the design's middle faces the camera, its sides turn away
      let su = u;
      if (turn > 0) {
        if (across <= -1 || across >= 1) continue;
        su = (Math.asin(across * sinTurn) / turn + 1) / 2;
      }
      // Curved edges, strongest in the middle
      let sv = v - (curve * curvePx * (1 - across * across)) / areaH;

      const i = oy * outerW + ox;
      const lift = light.relief[i] * foldPx;
      let sx = (su * areaW + lift) * toDesignX;
      let sy = (sv * areaH + lift) * toDesignY;

      // Bilinear sample, premultiplied; outside the design is see-through,
      // which also smooths the design's edges
      sx -= 0.5;
      sy -= 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < -1 || y0 < -1 || x0 >= designW || y0 >= designH) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      let a = 0;
      let cr = 0;
      let cg = 0;
      let cb = 0;
      for (let k = 0; k < 4; k += 1) {
        const px = x0 + (k & 1);
        const py = y0 + (k >> 1);
        if (px < 0 || py < 0 || px >= designW || py >= designH) continue;
        const w = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy);
        const o = (py * designW + px) * 4;
        const alpha = (src[o + 3] / 255) * w;
        if (!alpha) continue;
        a += alpha;
        cr += src[o] * alpha;
        cg += src[o + 1] * alpha;
        cb += src[o + 2] * alpha;
      }
      if (a <= 0.002) continue;

      // The picture's light on the design: shadows multiply, highlights screen
      const keep = 1 - r.shading * light.shadow[i];
      const brighten = r.shading * light.highlight[i];
      let red = (cr / a) * keep;
      let green = (cg / a) * keep;
      let blue = (cb / a) * keep;
      red += (255 - red) * brighten;
      green += (255 - green) * brighten;
      blue += (255 - blue) * brighten;

      const o = i * 4;
      const coverage = Math.min(1, a);
      if (designOnly) {
        dst[o] = red;
        dst[o + 1] = green;
        dst[o + 2] = blue;
        dst[o + 3] = coverage * 255;
        continue;
      }
      dst[o] = red * coverage + dst[o] * (1 - coverage);
      dst[o + 1] = green * coverage + dst[o + 1] * (1 - coverage);
      dst[o + 2] = blue * coverage + dst[o + 2] * (1 - coverage);
    }
  }

  outCtx.putImageData(layer, left, top);
  return out;
}

const pictureCache = new Map<string, Promise<HTMLImageElement>>();

/** Loads a picture so its pixels can be read (it must allow other sites, as Cloudinary does). */
export function loadReadablePicture(src: string): Promise<HTMLImageElement> {
  const cached = pictureCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The picture couldn’t be loaded.'));
    image.src = src;
  });
  pictureCache.set(src, promise);
  promise.catch(() => pictureCache.delete(src));
  if (pictureCache.size > 24) pictureCache.delete(pictureCache.keys().next().value as string);
  return promise;
}

/**
 * The light over part of a picture, read at up to `maxSide` pixels.
 * `region` is in the picture's own pixels. Null when the picture can't be read.
 */
export async function readPictureLight(
  src: string,
  region: { x: number; y: number; width: number; height: number },
  maxSide = 800,
): Promise<MockupLightMap | null> {
  try {
    const picture = await loadReadablePicture(src);
    const scale = Math.min(1, maxSide / Math.max(1, region.width, region.height));
    const width = Math.max(1, Math.round(region.width * scale));
    const height = Math.max(1, Math.round(region.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(picture, region.x, region.y, region.width, region.height, 0, 0, width, height);
    return readMockupLight(ctx.getImageData(0, 0, width, height));
  } catch {
    // A picture from a site that doesn't allow reading: no light, the design stays as it is
    return null;
  }
}

/**
 * The light over the part of a placed picture that a print area covers.
 * `picture` and `area` are in the same units (a page's). Returns the light
 * and the part of the area it covers (the area cut to the picture), or null
 * when the picture can't be read or doesn't reach the area.
 */
export async function readPlacedPictureLight(
  src: string,
  picture: { x: number; y: number; width: number; height: number },
  area: { x: number; y: number; width: number; height: number },
  maxSide = 800,
): Promise<{ light: MockupLightMap; area: { x: number; y: number; width: number; height: number } } | null> {
  if (!(picture.width > 0 && picture.height > 0)) return null;
  const left = Math.max(area.x, picture.x);
  const top = Math.max(area.y, picture.y);
  const right = Math.min(area.x + area.width, picture.x + picture.width);
  const bottom = Math.min(area.y + area.height, picture.y + picture.height);
  if (right - left < 1 || bottom - top < 1) return null;
  try {
    const image = await loadReadablePicture(src);
    const sx = image.naturalWidth / picture.width;
    const sy = image.naturalHeight / picture.height;
    const light = await readPictureLight(
      src,
      { x: (left - picture.x) * sx, y: (top - picture.y) * sy, width: (right - left) * sx, height: (bottom - top) * sy },
      maxSide,
    );
    return light ? { light, area: { x: left, y: top, width: right - left, height: bottom - top } } : null;
  } catch {
    return null;
  }
}

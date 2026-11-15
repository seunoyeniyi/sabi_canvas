import React, { useEffect, useState } from 'react';
import { Image as KonvaImage } from 'react-konva';
import type { ImageObject, PrintAreaObject } from '@sabi-canvas/types/canvas-objects';
import {
  MOCKUP_LIGHTING_NAME,
  mockupLightOverlays,
  readPlacedPictureLight,
  resolveMockupRealism,
} from '@sabi-canvas/lib/mockupRealism';

interface MockupLightingProps {
  /** The product picture under the print area. */
  picture?: ImageObject;
  printArea: PrintAreaObject;
}

type Overlays = {
  shadow: HTMLCanvasElement;
  highlight: HTMLCanvasElement;
  area: { x: number; y: number; width: number; height: number };
};

/** Light read from a picture, kept so switching pages or colours back is instant. */
const overlayCache = new Map<string, Promise<Overlays | null>>();

function overlaysFor(key: string, read: () => Promise<Overlays | null>): Promise<Overlays | null> {
  const cached = overlayCache.get(key);
  if (cached) return cached;
  const promise = read();
  overlayCache.set(key, promise);
  promise.then((result) => { if (!result) overlayCache.delete(key); }, () => overlayCache.delete(key));
  if (overlayCache.size > 16) overlayCache.delete(overlayCache.keys().next().value as string);
  return promise;
}

/**
 * The product picture's light and shadows over the customer's design, live
 * while they edit: folds, creases and the fabric's texture show through the
 * design instead of being covered. Drawn with `source-atop`, so it falls on
 * the design's own pixels only; it must be the last thing in a layer that
 * holds nothing but the customer's design. Never exported: proofs get the
 * full treatment (light, folds and shape) from `composeRealisticMockup`.
 */
export const MockupLighting: React.FC<MockupLightingProps> = ({ picture, printArea }) => {
  const realism = resolveMockupRealism(printArea.realism);
  const area = {
    x: printArea.x,
    y: printArea.y,
    width: printArea.width * (printArea.scaleX || 1),
    height: printArea.height * (printArea.scaleY || 1),
  };
  const box = picture
    ? { x: picture.x, y: picture.y, width: picture.width * (picture.scaleX || 1), height: picture.height * (picture.scaleY || 1) }
    : null;
  const src = picture?.src;
  const key = src && box && realism.shading > 0
    ? [src, box.x, box.y, box.width, box.height, area.x, area.y, area.width, area.height].map((n) => (typeof n === 'number' ? Math.round(n) : n)).join('|')
    : '';

  const [overlays, setOverlays] = useState<{ key: string; value: Overlays } | null>(null);

  useEffect(() => {
    if (!key || !src || !box) return;
    let cancelled = false;
    overlaysFor(key, async () => {
      const read = await readPlacedPictureLight(src, box, area, 1024);
      if (!read) return null;
      return { ...mockupLightOverlays(read.light), area: read.area };
    }).then((value) => {
      if (!cancelled && value) setOverlays({ key, value });
    });
    return () => {
      cancelled = true;
    };
    // `key` covers the picture, its place and the print area
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key || !overlays || overlays.key !== key) return null;
  const { shadow, highlight, area: lit } = overlays.value;

  return (
    <>
      <KonvaImage
        name={MOCKUP_LIGHTING_NAME}
        image={shadow}
        x={lit.x}
        y={lit.y}
        width={lit.width}
        height={lit.height}
        opacity={realism.shading}
        globalCompositeOperation="source-atop"
        listening={false}
        perfectDrawEnabled={false}
      />
      <KonvaImage
        name={MOCKUP_LIGHTING_NAME}
        image={highlight}
        x={lit.x}
        y={lit.y}
        width={lit.width}
        height={lit.height}
        opacity={realism.shading}
        globalCompositeOperation="source-atop"
        listening={false}
        perfectDrawEnabled={false}
      />
    </>
  );
};

export default MockupLighting;

import { useEffect, useMemo, useState } from 'react';
import Konva from 'konva';
import {
  isFontLoaded,
  loadFontFamily,
  normalizeFontFamily,
  onFontsLoaded,
} from '@sabi-canvas/lib/fontLoader';

const toFamiliesKey = (families: ReadonlyArray<string | null | undefined>): string =>
  Array.from(new Set(families.map((family) => normalizeFontFamily(family ?? '')).filter(Boolean)))
    .sort()
    .join('\n');

/**
 * Loads `families` and returns a number that goes up each time one of them
 * finishes loading.
 *
 * Text drawn before its font arrives is measured with a fallback font, so its
 * line breaks and height are wrong. Anything that lays out text should do it
 * again when this number changes (see `relayoutText`).
 */
export const useFontLoadVersion = (families: ReadonlyArray<string | null | undefined>): number => {
  const key = toFamiliesKey(families);
  const [version, setVersion] = useState(0);

  // Which fonts were ready when the text was laid out during render.
  const loadedAtRender = useMemo(
    () => new Set(key ? key.split('\n').filter((family) => isFontLoaded(family)) : []),
    [key],
  );

  useEffect(() => {
    if (!key) return;

    const wanted = key.split('\n');
    const wantedLower = new Set(wanted.map((family) => family.toLowerCase()));
    const bump = () => setVersion((current) => current + 1);

    const stopListening = onFontsLoaded((loaded) => {
      for (const family of loaded) {
        if (wantedLower.has(family.toLowerCase())) {
          bump();
          return;
        }
      }
    });

    // A font that finished between render and now was announced before we listened.
    if (wanted.some((family) => isFontLoaded(family) && !loadedAtRender.has(family))) {
      bump();
    }

    wanted.forEach((family) => {
      void loadFontFamily(family, { timeoutMs: 2400 });
    });

    return stopListening;
  }, [key, loadedAtRender]);

  return version;
};

/**
 * Lays out a Konva Text (or every Text inside a container) again with the
 * fonts available now, refreshes any cached parent group, and redraws.
 */
export const relayoutText = (target: Konva.Text | Konva.Container | null | undefined): void => {
  if (!target) return;

  const texts = target instanceof Konva.Text ? [target] : target.find<Konva.Text>('Text');
  if (texts.length === 0) return;
  texts.forEach((text) => text._setTextData());

  // A cached group draws from a bitmap taken earlier, so take it again.
  let parent = target.getParent();
  while (parent) {
    if (parent.isCached()) {
      parent.clearCache();
      parent.cache();
    }
    parent = parent.getParent();
  }

  target.getLayer()?.batchDraw();
};

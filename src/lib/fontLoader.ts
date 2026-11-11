/* eslint-disable no-useless-escape */
import { DEFAULT_FONT_FAMILY, getFontDefinition, getGoogleFontCatalog } from '@sabi-canvas/lib/fontCatalog';

type LoadStatus = 'loaded' | 'failed';

interface FontLoadResult {
  family: string;
  status: LoadStatus;
}

interface WaitOptions {
  timeoutMs?: number;
}

interface PreloadOptions {
  concurrency?: number;
  maxFonts?: number;
  timeoutMs?: number;
}

const FONT_LINK_ATTR = 'data-canvas-font-family';
const FONT_LINK_STATE_ATTR = 'data-canvas-font-state';
/** How long a load keeps going in the background after callers stop waiting. */
const BACKGROUND_LOAD_LIMIT_MS = 20000;
const loadedFamilies = new Set<string>([
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  DEFAULT_FONT_FAMILY,
]);
const failedFamilies = new Set<string>();
/** Loads in progress. They are not cut short by a caller's timeout. */
const inflightLoads = new Map<string, Promise<FontLoadResult>>();

const FALLBACK_STACK = `${DEFAULT_FONT_FAMILY}, Arial, Helvetica, sans-serif`;

const clampTimeout = (timeoutMs: number | undefined): number => {
  if (!timeoutMs || Number.isNaN(timeoutMs)) return 2200;
  return Math.min(10000, Math.max(400, timeoutMs));
};

const normalizeFamily = (family: string): string => {
  return family.trim().replace(/["']/g, '');
};

// ─── Font-ready notifications ─────────────────────────────────────────────────
//
// Canvas text is laid out (wrapped into lines) when it is drawn. If its font has
// not arrived yet, the browser measures it with a fallback font, and the lines
// stay wrong after the real font arrives. Anything that lays out text listens
// here and lays it out again once its font is ready.

export type FontsLoadedListener = (families: ReadonlySet<string>) => void;

const fontsLoadedListeners = new Set<FontsLoadedListener>();
let isFontSetListenerAttached = false;

const notifyFontsLoaded = (families: Iterable<string>): void => {
  const loaded = new Set<string>();
  for (const family of families) {
    const clean = normalizeFamily(family);
    if (clean) loaded.add(clean);
  }
  if (loaded.size === 0) return;

  fontsLoadedListeners.forEach((listener) => {
    try {
      listener(loaded);
    } catch {
      // One listener failing must not stop the others.
    }
  });
};

/**
 * Also catches fonts loaded outside this module, such as the host app's own
 * stylesheets or fonts the browser fetched on first use.
 */
const attachFontSetListener = (): void => {
  if (isFontSetListenerAttached) return;
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  isFontSetListenerAttached = true;

  document.fonts.addEventListener('loadingdone', (event) => {
    const faces = (event as FontFaceSetLoadEvent).fontfaces ?? [];
    notifyFontsLoaded(faces.map((face) => face.family));
  });
};

/**
 * Calls `listener` with the families that just finished loading. Returns a
 * function that stops listening.
 */
export const onFontsLoaded = (listener: FontsLoadedListener): (() => void) => {
  attachFontSetListener();
  fontsLoadedListeners.add(listener);
  return () => {
    fontsLoadedListeners.delete(listener);
  };
};

export const normalizeFontFamily = normalizeFamily;

const toGoogleFamilyQuery = (family: string, weights: number[]): string => {
  const encodedFamily = family.replace(/\s+/g, '+');
  const uniqueWeights = [...new Set(weights)].sort((a, b) => a - b);

  if (uniqueWeights.length === 0) {
    return `family=${encodedFamily}`;
  }

  return `family=${encodedFamily}:wght@${uniqueWeights.join(';')}`;
};

const findExistingLink = (family: string): HTMLLinkElement | null => {
  return document.querySelector(`link[${FONT_LINK_ATTR}="${CSS.escape(family)}"]`);
};

const ensureLink = (family: string, weights: number[]): HTMLLinkElement => {
  const existingLink = findExistingLink(family);
  if (existingLink) return existingLink;

  const link = document.createElement('link');
  const query = toGoogleFamilyQuery(family, weights);
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  link.setAttribute(FONT_LINK_ATTR, family);
  // Remember the outcome so a later load doesn't wait for events that already fired.
  link.addEventListener('load', () => link.setAttribute(FONT_LINK_STATE_ATTR, 'loaded'), { once: true });
  link.addEventListener('error', () => link.setAttribute(FONT_LINK_STATE_ATTR, 'error'), { once: true });
  document.head.appendChild(link);
  return link;
};

type StylesheetOutcome = 'loaded' | 'error' | 'timeout';

const waitForStylesheet = (link: HTMLLinkElement, limitMs: number): Promise<StylesheetOutcome> => {
  const state = link.getAttribute(FONT_LINK_STATE_ATTR);
  if (link.sheet || state === 'loaded') return Promise.resolve('loaded');
  if (state === 'error') return Promise.resolve('error');

  return new Promise<StylesheetOutcome>((resolve) => {
    link.addEventListener('load', () => resolve('loaded'), { once: true });
    link.addEventListener('error', () => resolve('error'), { once: true });
    window.setTimeout(() => resolve(link.sheet ? 'loaded' : 'timeout'), limitMs);
  });
};

/** Resolves true once the font can be drawn, false if it can't, null if the limit passed. */
const waitUntilFontUsable = async (family: string, weights: number[], limitMs: number): Promise<boolean | null> => {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return true;
  }

  const sample = 'Canvas Font 123';
  const tests = (weights.length > 0 ? weights : [400]).map((weight) => {
    return (document as Document & { fonts: FontFaceSet }).fonts.load(`${weight} 16px "${family}"`, sample);
  });

  const waitPromise = Promise.allSettled(tests).then((result) => result.some((entry) => entry.status === 'fulfilled'));

  const limitPromise = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), limitMs);
  });

  return Promise.race([waitPromise, limitPromise]);
};

/**
 * Loads a family all the way, without the caller's timeout. A slow network
 * therefore still ends with the font loaded and listeners told about it.
 */
const loadFamilyInBackground = async (family: string): Promise<FontLoadResult> => {
  try {
    let definition = getFontDefinition(family);
    if (!definition) {
      // The built-in list is short; the full catalog knows every family's weights.
      await getGoogleFontCatalog().catch(() => undefined);
      definition = getFontDefinition(family);
    }
    // Google rejects the whole request if one listed weight doesn't exist, so
    // when the weights are unknown ask for the family's regular weight only.
    const weights = definition?.weights ?? [];

    const link = ensureLink(family, weights);
    const stylesheet = await waitForStylesheet(link, BACKGROUND_LOAD_LIMIT_MS);
    if (stylesheet === 'error') {
      failedFamilies.add(family);
      return { family, status: 'failed' };
    }
    // Not recorded as failed, so a later call tries again.
    if (stylesheet === 'timeout') return { family, status: 'failed' };

    const usable = await waitUntilFontUsable(family, weights, BACKGROUND_LOAD_LIMIT_MS);
    if (usable === null) return { family, status: 'failed' };
    if (!usable) {
      failedFamilies.add(family);
      return { family, status: 'failed' };
    }

    const isNew = !loadedFamilies.has(family);
    loadedFamilies.add(family);
    failedFamilies.delete(family);
    if (isNew) notifyFontsLoaded([family]);
    return { family, status: 'loaded' };
  } catch {
    failedFamilies.add(family);
    return { family, status: 'failed' };
  }
};

/**
 * Strip characters that are unsafe inside a CSS font-family value.
 * Mainly: commas (they separate families), semicolons, braces, etc.
 * This is applied before building the font-stack so Canvas 2D / Konva
 * can look up the family name correctly even if the stored name was
 * derived from a file name that contained those characters.
 */
const sanitizeFamilyForCss = (family: string): string =>
  family
    .replace(/[,;{}()\[\]!@#$%^&*+=<>?/\\|`~"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const getFontFallbackStack = (family: string): string => {
  const cleanFamily = sanitizeFamilyForCss(normalizeFamily(family));
  if (!cleanFamily) return FALLBACK_STACK;
  return `"${cleanFamily}", ${FALLBACK_STACK}`;
};

/**
 * Loads a font family. Resolves with 'failed' if it isn't ready within the
 * timeout, but the load carries on, and `onFontsLoaded` listeners are told
 * when it finishes.
 */
export const loadFontFamily = async (family: string, waitOptions?: WaitOptions): Promise<FontLoadResult> => {
  const cleanFamily = normalizeFamily(family);
  if (!cleanFamily) {
    return { family: DEFAULT_FONT_FAMILY, status: 'loaded' };
  }

  if (loadedFamilies.has(cleanFamily)) {
    return { family: cleanFamily, status: 'loaded' };
  }

  if (failedFamilies.has(cleanFamily)) {
    return { family: cleanFamily, status: 'failed' };
  }

  if (typeof document === 'undefined') {
    return { family: cleanFamily, status: 'failed' };
  }

  let inflight = inflightLoads.get(cleanFamily);
  if (!inflight) {
    inflight = loadFamilyInBackground(cleanFamily).finally(() => {
      inflightLoads.delete(cleanFamily);
    });
    inflightLoads.set(cleanFamily, inflight);
  }

  const timeoutMs = clampTimeout(waitOptions?.timeoutMs);
  const timeout = new Promise<FontLoadResult>((resolve) => {
    window.setTimeout(() => resolve({ family: cleanFamily, status: 'failed' }), timeoutMs);
  });

  return Promise.race([inflight, timeout]);
};

export const isFontLoaded = (family: string): boolean => {
  return loadedFamilies.has(normalizeFamily(family));
};

export const preloadFonts = async (families: string[], options?: PreloadOptions): Promise<FontLoadResult[]> => {
  const maxFonts = options?.maxFonts ?? 200;
  const timeoutMs = options?.timeoutMs;
  const concurrency = Math.min(8, Math.max(1, options?.concurrency ?? 4));
  const deduped = [...new Set(families.map(normalizeFamily).filter(Boolean))].slice(0, maxFonts);

  if (deduped.length === 0) return [];

  const queue = [...deduped];
  const results: FontLoadResult[] = [];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const nextFamily = queue.shift();
      if (!nextFamily) continue;
      const result = await loadFontFamily(nextFamily, { timeoutMs });
      results.push(result);
    }
  });

  await Promise.all(workers);
  return results;
};

export const ensureFontFamiliesReady = async (families: string[], options?: PreloadOptions): Promise<void> => {
  await preloadFonts(families, options);
};

/**
 * Mark a font family as already loaded (e.g. registered via FontFace API).
 * This prevents fontLoader from trying to fetch it from Google Fonts.
 */
export const markFontAsLoaded = (family: string): void => {
  const clean = normalizeFamily(family);
  if (!clean) return;
  const isNew = !loadedFamilies.has(clean);
  loadedFamilies.add(clean);
  failedFamilies.delete(clean);
  if (isNew) notifyFontsLoaded([clean]);
};

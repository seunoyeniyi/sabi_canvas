/* eslint-disable no-useless-escape */
import { DEFAULT_FONT_FAMILY, getFontDefinition } from '@sabi-canvas/lib/fontCatalog';

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
const loadedFamilies = new Set<string>([
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  DEFAULT_FONT_FAMILY,
]);
const failedFamilies = new Set<string>();
const pendingLoads = new Map<string, Promise<FontLoadResult>>();

const FALLBACK_STACK = `${DEFAULT_FONT_FAMILY}, Arial, Helvetica, sans-serif`;

const clampTimeout = (timeoutMs: number | undefined): number => {
  if (!timeoutMs || Number.isNaN(timeoutMs)) return 2200;
  return Math.min(10000, Math.max(400, timeoutMs));
};

const normalizeFamily = (family: string): string => {
  return family.trim().replace(/["']/g, '');
};

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
  document.head.appendChild(link);
  return link;
};

const waitUntilFontUsable = async (family: string, weights: number[], timeoutMs: number): Promise<boolean> => {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return true;
  }

  const sample = 'Canvas Font 123';
  const tests = (weights.length > 0 ? weights : [400]).map((weight) => {
    return (document as Document & { fonts: FontFaceSet }).fonts.load(`${weight} 16px "${family}"`, sample);
  });

  const waitPromise = Promise.allSettled(tests).then((result) => result.some((entry) => entry.status === 'fulfilled'));

  const timeoutPromise = new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(false), timeoutMs);
  });

  return Promise.race([waitPromise, timeoutPromise]);
};

const loadFontFamilyInternal = async (inputFamily: string, waitOptions?: WaitOptions): Promise<FontLoadResult> => {
  const family = normalizeFamily(inputFamily);
  if (!family) {
    return { family: DEFAULT_FONT_FAMILY, status: 'loaded' };
  }

  if (loadedFamilies.has(family)) {
    return { family, status: 'loaded' };
  }

  if (failedFamilies.has(family)) {
    return { family, status: 'failed' };
  }

  const definition = getFontDefinition(family);
  const weights = definition?.weights ?? [400, 500, 700];
  const timeoutMs = clampTimeout(waitOptions?.timeoutMs);

  try {
    const link = ensureLink(family, weights);

    if (!link.sheet) {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          link.addEventListener('load', () => resolve(), { once: true });
          link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet for ${family}`)), { once: true });
        }),
        new Promise<void>((_resolve, reject) => {
          window.setTimeout(() => reject(new Error(`Timed out loading stylesheet for ${family}`)), timeoutMs);
        }),
      ]);
    }

    const usable = await waitUntilFontUsable(family, weights, timeoutMs);
    if (!usable) {
      failedFamilies.add(family);
      return { family, status: 'failed' };
    }

    loadedFamilies.add(family);
    failedFamilies.delete(family);
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

export const loadFontFamily = async (family: string, waitOptions?: WaitOptions): Promise<FontLoadResult> => {
  const cleanFamily = normalizeFamily(family);
  if (!cleanFamily) {
    return { family: DEFAULT_FONT_FAMILY, status: 'loaded' };
  }

  const existing = pendingLoads.get(cleanFamily);
  if (existing) {
    return existing;
  }

  const promise = loadFontFamilyInternal(cleanFamily, waitOptions).finally(() => {
    pendingLoads.delete(cleanFamily);
  });

  pendingLoads.set(cleanFamily, promise);
  return promise;
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
  loadedFamilies.add(clean);
  failedFamilies.delete(clean);
};

import { getSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

export interface GoogleFontDefinition {
  family: string;
  weights: number[];
  category: 'sans' | 'serif' | 'display' | 'handwriting' | 'monospace';
}

type GoogleFontApiCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace';

interface GoogleWebFontItem {
  family: string;
  category: GoogleFontApiCategory;
  variants: string[];
}

interface GoogleWebFontsApiResponse {
  items: GoogleWebFontItem[];
}

export const DEFAULT_FONT_FAMILY = 'Inter';
const GOOGLE_FONT_CACHE_KEY = 'canvas-editor-google-fonts-cache-v1';
const GOOGLE_FONT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const GOOGLE_FONT_CATALOG: GoogleFontDefinition[] = [
  { family: 'Inter', weights: [400, 500, 600, 700], category: 'sans' },
  { family: 'Roboto', weights: [400, 500, 700], category: 'sans' },
  { family: 'Open Sans', weights: [400, 600, 700], category: 'sans' },
  { family: 'Lato', weights: [400, 700], category: 'sans' },
  { family: 'Montserrat', weights: [400, 500, 700], category: 'sans' },
  { family: 'Poppins', weights: [400, 500, 600, 700], category: 'sans' },
  { family: 'Nunito', weights: [400, 600, 700], category: 'sans' },
  { family: 'Work Sans', weights: [400, 500, 700], category: 'sans' },
  { family: 'DM Sans', weights: [400, 500, 700], category: 'sans' },
  { family: 'Manrope', weights: [400, 600, 700], category: 'sans' },
  { family: 'Figtree', weights: [400, 500, 700], category: 'sans' },
  { family: 'Cabin', weights: [400, 500, 700], category: 'sans' },
  { family: 'Rubik', weights: [400, 500, 700], category: 'sans' },
  { family: 'Merriweather Sans', weights: [400, 700], category: 'sans' },
  { family: 'Source Sans 3', weights: [400, 600, 700], category: 'sans' },
  { family: 'Noto Sans', weights: [400, 700], category: 'sans' },
  { family: 'Bebas Neue', weights: [400], category: 'display' },
  { family: 'Oswald', weights: [400, 500, 700], category: 'sans' },
  { family: 'Barlow', weights: [400, 500, 700], category: 'sans' },
  { family: 'Teko', weights: [400, 500, 700], category: 'display' },
  { family: 'Playfair Display', weights: [400, 500, 700], category: 'serif' },
  { family: 'Merriweather', weights: [400, 700], category: 'serif' },
  { family: 'Lora', weights: [400, 500, 700], category: 'serif' },
  { family: 'Cormorant Garamond', weights: [400, 500, 700], category: 'serif' },
  { family: 'Libre Baskerville', weights: [400, 700], category: 'serif' },
  { family: 'Bitter', weights: [400, 500, 700], category: 'serif' },
  { family: 'Alegreya', weights: [400, 500, 700], category: 'serif' },
  { family: 'Crimson Pro', weights: [400, 500, 700], category: 'serif' },
  { family: 'DM Serif Display', weights: [400], category: 'serif' },
  { family: 'Fraunces', weights: [400, 500, 700], category: 'serif' },
  { family: 'PT Serif', weights: [400, 700], category: 'serif' },
  { family: 'Cardo', weights: [400, 700], category: 'serif' },
  { family: 'Source Serif 4', weights: [400, 600, 700], category: 'serif' },
  { family: 'Archivo', weights: [400, 500, 700], category: 'sans' },
  { family: 'Archivo Narrow', weights: [400, 500, 700], category: 'sans' },
  { family: 'Space Grotesk', weights: [400, 500, 700], category: 'sans' },
  { family: 'IBM Plex Sans', weights: [400, 500, 700], category: 'sans' },
  { family: 'IBM Plex Serif', weights: [400, 500, 700], category: 'serif' },
  { family: 'Plus Jakarta Sans', weights: [400, 500, 700], category: 'sans' },
  { family: 'Sora', weights: [400, 600, 700], category: 'sans' },
  { family: 'Hind', weights: [400, 500, 700], category: 'sans' },
  { family: 'Raleway', weights: [400, 500, 700], category: 'sans' },
  { family: 'Quicksand', weights: [400, 500, 700], category: 'sans' },
  { family: 'Josefin Sans', weights: [400, 500, 700], category: 'sans' },
  { family: 'Urbanist', weights: [400, 500, 700], category: 'sans' },
  { family: 'Anton', weights: [400], category: 'display' },
  { family: 'Abril Fatface', weights: [400], category: 'display' },
  { family: 'Archivo Black', weights: [400], category: 'display' },
  { family: 'Righteous', weights: [400], category: 'display' },
  { family: 'Lobster', weights: [400], category: 'handwriting' },
  { family: 'Pacifico', weights: [400], category: 'handwriting' },
  { family: 'Dancing Script', weights: [400, 500, 700], category: 'handwriting' },
  { family: 'Satisfy', weights: [400], category: 'handwriting' },
  { family: 'Caveat', weights: [400, 500, 700], category: 'handwriting' },
  { family: 'Shadows Into Light', weights: [400], category: 'handwriting' },
  { family: 'Indie Flower', weights: [400], category: 'handwriting' },
  { family: 'Great Vibes', weights: [400], category: 'handwriting' },
  { family: 'Sacramento', weights: [400], category: 'handwriting' },
  { family: 'Permanent Marker', weights: [400], category: 'handwriting' },
  { family: 'Amatic SC', weights: [400, 700], category: 'handwriting' },
  { family: 'Bangers', weights: [400], category: 'display' },
  { family: 'Fredoka', weights: [400, 500, 700], category: 'display' },
  { family: 'Comfortaa', weights: [400, 500, 700], category: 'display' },
  { family: 'Baloo 2', weights: [400, 500, 700], category: 'display' },
  { family: 'Press Start 2P', weights: [400], category: 'display' },
  { family: 'Orbitron', weights: [400, 500, 700], category: 'display' },
  { family: 'Exo 2', weights: [400, 500, 700], category: 'sans' },
  { family: 'Chivo', weights: [400, 500, 700], category: 'sans' },
  { family: 'Asap', weights: [400, 500, 700], category: 'sans' },
  { family: 'Fira Sans', weights: [400, 500, 700], category: 'sans' },
  { family: 'Mukta', weights: [400, 500, 700], category: 'sans' },
  { family: 'Titillium Web', weights: [400, 600, 700], category: 'sans' },
  { family: 'Kanit', weights: [400, 500, 700], category: 'sans' },
  { family: 'Varela Round', weights: [400], category: 'sans' },
  { family: 'Heebo', weights: [400, 500, 700], category: 'sans' },
  { family: 'Prompt', weights: [400, 500, 700], category: 'sans' },
  { family: 'Nunito Sans', weights: [400, 600, 700], category: 'sans' },
  { family: 'Noto Serif', weights: [400, 700], category: 'serif' },
  { family: 'Arvo', weights: [400, 700], category: 'serif' },
  { family: 'Domine', weights: [400, 500, 700], category: 'serif' },
  { family: 'Vollkorn', weights: [400, 500, 700], category: 'serif' },
  { family: 'Cinzel', weights: [400, 500, 700], category: 'serif' },
  { family: 'Prata', weights: [400], category: 'serif' },
  { family: 'Zilla Slab', weights: [400, 500, 700], category: 'serif' },
  { family: 'Tinos', weights: [400, 700], category: 'serif' },
  { family: 'Bricolage Grotesque', weights: [400, 500, 700], category: 'display' },
  { family: 'Jost', weights: [400, 500, 700], category: 'sans' },
  { family: 'Assistant', weights: [400, 500, 700], category: 'sans' },
  { family: 'Inconsolata', weights: [400, 500, 700], category: 'monospace' },
  { family: 'Fira Code', weights: [400, 500, 700], category: 'monospace' },
  { family: 'JetBrains Mono', weights: [400, 500, 700], category: 'monospace' },
  { family: 'Space Mono', weights: [400, 700], category: 'monospace' },
  { family: 'Source Code Pro', weights: [400, 500, 700], category: 'monospace' },
  { family: 'Ubuntu Mono', weights: [400, 700], category: 'monospace' },
  { family: 'PT Mono', weights: [400], category: 'monospace' },
  { family: 'Cutive Mono', weights: [400], category: 'monospace' },
  { family: 'Courier Prime', weights: [400, 700], category: 'monospace' },
  { family: 'Red Hat Mono', weights: [400, 500, 700], category: 'monospace' },
  { family: 'M PLUS 1 Code', weights: [400, 500, 700], category: 'monospace' },
];

export const FONT_FAMILY_SET = new Set(GOOGLE_FONT_CATALOG.map((font) => font.family));

export const TOP_FONT_PRELOAD = GOOGLE_FONT_CATALOG.slice(0, 8).map((font) => font.family);

let runtimeFontCatalog: GoogleFontDefinition[] | null = null;
let runtimeFontCatalogPromise: Promise<GoogleFontDefinition[]> | null = null;

const mapApiCategory = (category: GoogleFontApiCategory): GoogleFontDefinition['category'] => {
  if (category === 'sans-serif') return 'sans';
  return category;
};

const parseVariantToWeight = (variant: string): number | null => {
  if (variant === 'regular' || variant === 'italic') return 400;

  const weightText = variant.replace('italic', '');
  const parsed = Number.parseInt(weightText, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const normalizeWeights = (variants: string[]): number[] => {
  const parsedWeights = variants
    .map(parseVariantToWeight)
    .filter((weight): weight is number => weight !== null);

  if (parsedWeights.length === 0) {
    return [400, 500, 700];
  }

  return [...new Set(parsedWeights)].sort((a, b) => a - b);
};

const sortByFamilyName = (fonts: GoogleFontDefinition[]): GoogleFontDefinition[] => {
  return [...fonts].sort((a, b) => a.family.localeCompare(b.family));
};

const readCachedGoogleFonts = (): GoogleFontDefinition[] | null => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(GOOGLE_FONT_CACHE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as { timestamp?: number; data?: GoogleFontDefinition[] };
    if (!parsed?.timestamp || !Array.isArray(parsed.data)) return null;

    if (Date.now() - parsed.timestamp > GOOGLE_FONT_CACHE_TTL_MS) {
      return null;
    }

    return sortByFamilyName(parsed.data);
  } catch {
    return null;
  }
};

const writeCachedGoogleFonts = (fonts: GoogleFontDefinition[]): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      GOOGLE_FONT_CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data: fonts })
    );
  } catch {
    // Ignore cache failures to avoid breaking font selection.
  }
};

const hasGoogleFontsApiKey = (): boolean => {
  return Boolean(getSabiCanvasConfig().googleFontsApiKey);
};

const fetchGoogleFontsFromApi = async (): Promise<GoogleFontDefinition[]> => {
  const apiKey = getSabiCanvasConfig().googleFontsApiKey;
  const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${apiKey}`);

  if (!response.ok) {
    throw new Error(`Google Fonts API returned ${response.status}`);
  }

  const payload = (await response.json()) as GoogleWebFontsApiResponse;
  if (!Array.isArray(payload.items)) {
    throw new Error('Invalid Google Fonts API response');
  }

  const mapped = payload.items.map((item) => ({
    family: item.family,
    category: mapApiCategory(item.category),
    weights: normalizeWeights(item.variants ?? []),
  }));

  return sortByFamilyName(mapped);
};

export const getGoogleFontCatalog = async (): Promise<GoogleFontDefinition[]> => {
  if (runtimeFontCatalog) return runtimeFontCatalog;

  if (!hasGoogleFontsApiKey()) {
    runtimeFontCatalog = GOOGLE_FONT_CATALOG;
    return runtimeFontCatalog;
  }

  const cachedFonts = readCachedGoogleFonts();
  if (cachedFonts && cachedFonts.length > 0) {
    runtimeFontCatalog = cachedFonts;
    return runtimeFontCatalog;
  }

  if (!runtimeFontCatalogPromise) {
    runtimeFontCatalogPromise = fetchGoogleFontsFromApi()
      .then((fonts) => {
        const nextCatalog = fonts.length > 0 ? fonts : GOOGLE_FONT_CATALOG;
        runtimeFontCatalog = nextCatalog;
        writeCachedGoogleFonts(nextCatalog);
        return nextCatalog;
      })
      .catch(() => {
        runtimeFontCatalog = GOOGLE_FONT_CATALOG;
        return runtimeFontCatalog;
      })
      .finally(() => {
        runtimeFontCatalogPromise = null;
      });
  }

  return runtimeFontCatalogPromise;
};

export const getTopFontPreload = async (): Promise<string[]> => {
  const catalog = await getGoogleFontCatalog();
  return catalog.slice(0, 8).map((font) => font.family);
};

export const getFontDefinition = (fontFamily: string): GoogleFontDefinition | undefined => {
  const sourceCatalog = runtimeFontCatalog ?? GOOGLE_FONT_CATALOG;
  return sourceCatalog.find((font) => font.family === fontFamily);
};

// ---------------------------------------------------------------------------
// Custom font registry — populated at runtime when users upload fonts
// ---------------------------------------------------------------------------

const customFontRegistry = new Map<string, GoogleFontDefinition>();

export const registerCustomFontInCatalog = (family: string): void => {
  if (!customFontRegistry.has(family)) {
    customFontRegistry.set(family, { family, weights: [400], category: 'sans' });
  }
};

export const unregisterCustomFontFromCatalog = (family: string): void => {
  customFontRegistry.delete(family);
};

export const getCustomFontDefinitions = (): GoogleFontDefinition[] => {
  return [...customFontRegistry.values()];
};

export const isCustomFont = (family: string): boolean => {
  return customFontRegistry.has(family);
};

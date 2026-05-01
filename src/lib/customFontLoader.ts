import type { CustomFont } from '@sabi-canvas/types/custom-fonts';
import { sanitizeFontFamilyName } from '@sabi-canvas/types/custom-fonts';
import { markFontAsLoaded } from './fontLoader';
import { registerCustomFontInCatalog, unregisterCustomFontFromCatalog } from './fontCatalog';

/** Convert a base64 data URL to an ArrayBuffer (avoids MIME-type issues with FontFace). */
const dataUrlToBuffer = (dataUrl: string): ArrayBuffer => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export const registerCustomFont = async (font: CustomFont): Promise<void> => {
  // Sanitize at registration time — guards against fonts already stored in
  // localStorage with names containing commas or other CSS-unsafe characters.
  const family = sanitizeFontFamilyName(font.family);

  try {
    const buffer = dataUrlToBuffer(font.dataUrl);
    const fontFace = new FontFace(family, buffer);
    const loaded = await fontFace.load();
    document.fonts.add(loaded);

    try {
      await document.fonts.load(`16px "${family}"`, 'Aa');
    } catch {
      // Non-fatal — font is in document.fonts, Canvas 2D will still use it.
    }

    markFontAsLoaded(family);
    // Also mark the original unsanitized name so any existing canvas objects
    // that reference it don't trigger a failed Google Fonts fetch.
    if (font.family !== family) markFontAsLoaded(font.family);

    registerCustomFontInCatalog(family);
  } catch (error) {
    console.warn(`Failed to register custom font "${family}":`, error);
  }
};

export const registerCustomFonts = async (fonts: CustomFont[]): Promise<void> => {
  await Promise.all(fonts.map(registerCustomFont));
};

/** Remove from catalog (browser session FontFace cannot be truly unloaded) */
export const unregisterCustomFont = (family: string): void => {
  unregisterCustomFontFromCatalog(family);
};

/* eslint-disable no-useless-escape */
export interface CustomFont {
  id: string;
  /** CSS font-family name, used in canvas objects */
  family: string;
  /** Original uploaded file name */
  fileName: string;
  /** MIME type: font/ttf, font/otf, font/woff, or font/woff2 */
  mimeType: string;
  /** Full base64 data URL, e.g. "data:font/ttf;base64,..." */
  dataUrl: string;
  createdAt: number;
}

export const CUSTOM_FONT_ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

/**
 * Sanitize a raw string into a valid CSS font-family name.
 * Commas, semicolons, braces, and other characters that have special meaning
 * in CSS font lists will break font registration — strip them out.
 */
export const sanitizeFontFamilyName = (name: string): string =>
  name
    .replace(/[,;{}()\[\]!@#$%^&*+=<>?/\\|`~"']/g, ' ')  // unsafe CSS chars → space
    .replace(/\s+/g, ' ')                                   // collapse runs of spaces
    .trim();

/** Derive a human-readable font family name from a filename */
export const deriveFontFamilyFromFileName = (fileName: string): string => {
  const base = fileName
    .replace(/\.(ttf|otf|woff2?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return sanitizeFontFamilyName(base);
};

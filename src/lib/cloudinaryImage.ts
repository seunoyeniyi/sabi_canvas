/**
 * Cloudinary charges for every byte it serves, and an image uploaded for print
 * can be several MB. Small previews (the Uploads grids) load a resized copy;
 * the canvas itself always gets the original, so designs keep full quality.
 *
 * Hosts can replace this with `config.previewImageUrl`.
 *
 * Keep these strings identical to the host apps' own helpers: each distinct
 * string is a separate paid copy of every image, and identical strings let all
 * apps share one cached copy.
 */
export const CLOUDINARY_PRESETS = {
  avatar: 'c_fill,g_face,w_200,h_200,q_auto,f_webp',
  emailAvatar: 'c_fill,g_face,w_200,h_200,q_auto,f_jpg',
  logo: 'c_limit,w_600,h_300,q_auto,f_png',
  thumb: 'c_limit,w_600,h_600,q_auto,f_webp',
  full: 'c_limit,w_1600,h_1600,q_auto,f_webp',
} as const;
export type CloudinaryPreset = keyof typeof CLOUDINARY_PRESETS;

const RASTER_EXT = /\.(jpe?g|jfif|png|webp|heic|heif|bmp|tiff?|avif)$/i;
const DELIVERY = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;
const TRANSFORMATION_SEGMENT = /^[a-z]{1,3}_[^/]*$/;

/**
 * A resized copy of a Cloudinary image; any other value comes back unchanged
 * (PDFs, GIFs, SVGs, videos, data:/blob: URLs, other hosts, already-resized URLs).
 */
export function cloudinaryImage<T>(url: T, preset: CloudinaryPreset): T {
  if (typeof url !== 'string') return url;
  const match = DELIVERY.exec(url.trim());
  if (!match) return url;
  const [, prefix, rest] = match;
  const path = rest.split(/[?#]/)[0];
  if (!RASTER_EXT.test(path)) return url;
  const first = path.split('/')[0];
  if (!/^v\d+$/.test(first) && TRANSFORMATION_SEGMENT.test(first)) return url;
  return `${prefix}${CLOUDINARY_PRESETS[preset]}/${rest}` as unknown as T;
}

/** The default `previewImageUrl`: a 600px copy for Cloudinary images, anything else unchanged. */
export const defaultPreviewImageUrl = (src: string): string => cloudinaryImage(src, 'thumb');

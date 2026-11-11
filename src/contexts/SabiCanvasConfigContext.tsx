import React, { createContext, useContext } from 'react';
import type { SabiCanvasTemplatesConfig } from '@sabi-canvas/types/design-templates';

export interface SabiCanvasAIProviderConfig {
  apiKey?: string;
  model?: string;
}

export interface SabiCanvasAIConfig {
  /** Which AI provider to use: 'openai' | 'gemini' | 'claude' | 'deepseek' | 'grok' */
  provider?: string;
  /** Global model override (used if provider-specific model is not set) */
  model?: string;
  openai?: SabiCanvasAIProviderConfig;
  gemini?: SabiCanvasAIProviderConfig;
  claude?: SabiCanvasAIProviderConfig;
  deepseek?: SabiCanvasAIProviderConfig;
  grok?: SabiCanvasAIProviderConfig;
}

export interface SabiCanvasUploadedImage {
  src: string;
  width?: number;
  height?: number;
}

export interface SabiCanvasUploadedAsset {
  src: string;
  publicId?: string;
}

export interface SabiCanvasRecentUpload extends SabiCanvasUploadedImage {
  id?: string;
  createdAt?: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw';
}

export interface SabiCanvasProxyConfig {
  /** Base URL for backend proxy endpoints (e.g. 'https://api.sabiflow.com/api/canvas/proxy' or '/api/canvas/proxy') */
  baseUrl?: string;
  /** Custom Unsplash proxy URL, defaults to `${baseUrl}/unsplash/photos` */
  unsplashUrl?: string;
  /** Custom Pixabay proxy URL, defaults to `${baseUrl}/pixabay` */
  pixabayUrl?: string;
  /** Custom AI text generation proxy URL, defaults to `${baseUrl}/ai/generate-text` */
  aiUrl?: string;
  /** Custom Google Fonts catalog proxy URL, defaults to `${baseUrl}/google-fonts` */
  googleFontsUrl?: string;
  /** Custom background removal proxy URL, defaults to `${baseUrl}/remove-background` */
  removeBackgroundUrl?: string;
}

export interface SabiCanvasConfig {
  /**
   * Backend proxy configuration.
   * When provided, API requests (Unsplash, Pixabay, AI writing assistant)
   * are routed through your backend API gateway instead of exposing 3rd-party API keys in client browsers.
   */
  proxy?: SabiCanvasProxyConfig;
  /**
   * Sabi Canvas API key (`cpk_…`), from your account on the Sabi Canvas
   * website. Optional. Without it the Templates panel lists every template and
   * opens the free ones; with it, the paid templates your plan includes open
   * too. Ignored when `templates.source` is set.
   */
  sabiCanvasApiKey?: string;
  /** Unsplash API access key , for direct photo search/browse in the editor (fallback if no proxy configured) */
  unsplashAccessKey?: string;
  /** Pixabay API key , for direct transparent graphics/illustrations in the editor (fallback if no proxy configured) */
  pixabayApiKey?: string;
  /** Google Fonts API key , enables dynamic font catalog from Google Fonts API */
  googleFontsApiKey?: string;
  /** Cloudinary cloud name , for background-removal feature */
  cloudinaryCloudName?: string;
  /** Cloudinary unsigned upload preset , for background-removal feature */
  cloudinaryUploadPreset?: string;
  /** AI writing assistant configuration */
  ai?: SabiCanvasAIConfig;
  /**
   * The resolved theme ('dark' | 'light') from the host application.
   * When provided, overrides the editor's internal DOM-based theme detection
   * for canvas overlay colours and theme-sensitive rendering. Use this when
   * your app manages its own theme state (e.g. next-themes).
   */
  resolvedTheme?: 'dark' | 'light';
  /**
   * Optional upload adapter. When provided, image uploads in the editor
   * are sent through this callback instead of being converted to local data URLs.
   */
  uploadImageFile?: (file: File, options?: { maxSize?: number }) => Promise<SabiCanvasUploadedImage>;
  /**
   * Optional font upload adapter. When provided, My Fonts uploads can be routed
   * through your backend uploader before being registered in the editor.
   */
  uploadFontFile?: (file: File) => Promise<SabiCanvasUploadedAsset>;
  /**
   * Optional font delete adapter. When provided, custom font deletion can also
   * delete the hosted backend asset (e.g. Cloudinary raw file).
   */
  deleteFontFile?: (asset: { src?: string; publicId?: string }) => Promise<void>;
  /**
   * Optional recent-uploads adapter. When provided, Upload panel recent items
   * are fetched from this callback (e.g. backend history) instead of only localStorage.
   */
  listRecentUploads?: (options?: { limit?: number }) => Promise<SabiCanvasRecentUpload[]>;
  /**
   * Optional recent-upload delete adapter for backend-powered upload libraries.
   * Called by Uploads drawer panel before removing the item from local UI cache.
   */
  deleteRecentUpload?: (upload: SabiCanvasRecentUpload) => Promise<void>;
  /**
   * Disable localStorage usage for recent uploads and keep them in memory only.
   */
  disableRecentUploadsLocalStorage?: boolean;
  /**
   * Disable localStorage usage for custom fonts state in the package.
   */
  disableCustomFontsLocalStorage?: boolean;
  /**
   * Disable localStorage usage for recent font picks in FontFamilyPicker.
   */
  disableRecentFontsLocalStorage?: boolean;
  /**
   * Colours offered as swatches in every colour picker (any CSS colour,
   * including see-through ones such as 'rgba(0, 0, 0, 0.5)'). Defaults to a
   * built-in palette. The picker shows two rows of eight swatches: colours
   * already used in the design first, then these.
   */
  colorSwatches?: string[];
  /**
   * Templates panel. By default it lists the free Sabi Canvas templates, with
   * the filters the API offers. Pass `source` to serve your own templates and
   * filters, or `panel` to replace the panel entirely.
   */
  templates?: SabiCanvasTemplatesConfig;
}

// ---------------------------------------------------------------------------
// Module-level store , allows plain (non-React) modules to read config
// ---------------------------------------------------------------------------
let _moduleConfig: SabiCanvasConfig = {};

/** Read config from the module-level store. Use this in plain (non-hook) code. */
export const getSabiCanvasConfig = (): SabiCanvasConfig => _moduleConfig;

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------
const SabiCanvasConfigContext = createContext<SabiCanvasConfig>({});

/** Read config inside a React component or custom hook. */
export const useSabiCanvasConfig = (): SabiCanvasConfig =>
  useContext(SabiCanvasConfigContext);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export interface SabiCanvasProviderProps {
  config: SabiCanvasConfig;
  children: React.ReactNode;
}

/**
 * Wrap your app (or the component that mounts the editor) with this provider
 * to inject API keys at runtime.
 *
 * @example
 * ```tsx
 * <SabiCanvasProvider config={{
 *   unsplashAccessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY,
 *   pixabayApiKey:     import.meta.env.VITE_PIXABAY_API_KEY,
 *   googleFontsApiKey: import.meta.env.VITE_GOOGLE_FONTS_API_KEY,
 *   cloudinaryCloudName:    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
 *   cloudinaryUploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
 *   ai: {
 *     provider: import.meta.env.VITE_AI_PROVIDER,
 *     openai:   { apiKey: import.meta.env.VITE_OPENAI_API_KEY },
 *     gemini:   { apiKey: import.meta.env.VITE_GEMINI_API_KEY },
 *   },
 * }}>
 *   <App />
 * </SabiCanvasProvider>
 * ```
 */
export const SabiCanvasProvider: React.FC<SabiCanvasProviderProps> = ({ config, children }) => {
  // Keep the module-level store in sync so non-React code can also read it.
  _moduleConfig = config;

  return (
    <SabiCanvasConfigContext.Provider value={config}>
      {children}
    </SabiCanvasConfigContext.Provider>
  );
};

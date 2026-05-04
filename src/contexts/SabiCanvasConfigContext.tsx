import React, { createContext, useContext } from 'react';

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
}

export interface SabiCanvasRecentUpload extends SabiCanvasUploadedImage {
  id?: string;
  createdAt?: string;
}

export interface SabiCanvasConfig {
  /** Unsplash API access key — for photo search/browse in the editor */
  unsplashAccessKey?: string;
  /** Pixabay API key — for transparent graphics/illustrations in the editor */
  pixabayApiKey?: string;
  /** Google Fonts API key — enables dynamic font catalog from Google Fonts API */
  googleFontsApiKey?: string;
  /** Cloudinary cloud name — for background-removal feature */
  cloudinaryCloudName?: string;
  /** Cloudinary unsigned upload preset — for background-removal feature */
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
   * Optional recent-uploads adapter. When provided, Upload panel recent items
   * are fetched from this callback (e.g. backend history) instead of only localStorage.
   */
  listRecentUploads?: (options?: { limit?: number }) => Promise<SabiCanvasRecentUpload[]>;
  /**
   * Disable localStorage usage for recent uploads and keep them in memory only.
   */
  disableRecentUploadsLocalStorage?: boolean;
}

// ---------------------------------------------------------------------------
// Module-level store — allows plain (non-React) modules to read config
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

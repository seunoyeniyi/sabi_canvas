import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { CustomFont } from '@sabi-canvas/types/custom-fonts';
import { registerCustomFont, registerCustomFonts, unregisterCustomFont } from '@sabi-canvas/lib/customFontLoader';

const CUSTOM_FONTS_STORAGE_KEY = 'ca_custom_fonts';

export interface CustomFontsContextValue {
  customFonts: CustomFont[];
  addCustomFont: (data: Omit<CustomFont, 'id' | 'createdAt'>) => Promise<CustomFont>;
  removeCustomFont: (id: string) => void;
  /**
   * Merge fonts saved inside a project into the global store.
   * Called when a project is opened so its fonts are available to the canvas.
   */
  loadProjectFonts: (fonts: CustomFont[]) => void;
}

const CustomFontsContext = createContext<CustomFontsContextValue | null>(null);

const readStoredFonts = (): CustomFont[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_FONTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CustomFont[];
  } catch {
    return [];
  }
};

const writeFonts = (fonts: CustomFont[]): void => {
  try {
    localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(fonts));
  } catch {
    // Storage quota exceeded — silently ignore. Fonts remain in session only.
  }
};

export const CustomFontsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const initializedRef = useRef(false);

  // Load and register persisted fonts once on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const stored = readStoredFonts();
    if (stored.length > 0) {
      setCustomFonts(stored);
      registerCustomFonts(stored);
    }
  }, []);

  const addCustomFont = useCallback(
    async (data: Omit<CustomFont, 'id' | 'createdAt'>): Promise<CustomFont> => {
      const font: CustomFont = {
        ...data,
        id: `font_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
      };
      await registerCustomFont(font);
      setCustomFonts((prev) => {
        const next = [font, ...prev];
        writeFonts(next);
        return next;
      });
      return font;
    },
    []
  );

  const removeCustomFont = useCallback((id: string): void => {
    setCustomFonts((prev) => {
      const font = prev.find((f) => f.id === id);
      if (font) unregisterCustomFont(font.family);
      const next = prev.filter((f) => f.id !== id);
      writeFonts(next);
      return next;
    });
  }, []);

  const loadProjectFonts = useCallback((fonts: CustomFont[]): void => {
    if (!fonts.length) return;
    setCustomFonts((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      const newFonts = fonts.filter((f) => !existingIds.has(f.id));

      // Always re-register all project fonts to handle browser refresh
      const toRegister = newFonts.length > 0 ? fonts : fonts.filter((f) => existingIds.has(f.id));
      registerCustomFonts(toRegister);

      if (newFonts.length === 0) return prev;
      const next = [...newFonts, ...prev];
      writeFonts(next);
      return next;
    });
  }, []);

  return (
    <CustomFontsContext.Provider value={{ customFonts, addCustomFont, removeCustomFont, loadProjectFonts }}>
      {children}
    </CustomFontsContext.Provider>
  );
};

export const useCustomFonts = (): CustomFontsContextValue => {
  const ctx = useContext(CustomFontsContext);
  if (!ctx) throw new Error('useCustomFonts must be used within CustomFontsProvider');
  return ctx;
};

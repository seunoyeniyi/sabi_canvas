import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@sabi-canvas/ui/button';
import { Input } from '@sabi-canvas/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@sabi-canvas/ui/popover';
import { cn } from '@sabi-canvas/lib/utils';
import { GoogleFontDefinition, GOOGLE_FONT_CATALOG, getGoogleFontCatalog, getTopFontPreload, isCustomFont } from '@sabi-canvas/lib/fontCatalog';
import { getFontFallbackStack, loadFontFamily, preloadFonts } from '@sabi-canvas/lib/fontLoader';
import { useCustomFonts } from '@sabi-canvas/contexts/CustomFontsContext';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { CUSTOM_FONT_ACCEPT, deriveFontFamilyFromFileName } from '@sabi-canvas/types/custom-fonts';

interface FontFamilyPickerProps {
  value: string;
  onChange: (fontFamily: string) => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const RECENT_FONTS_STORAGE_KEY = 'canvas-editor-recent-fonts';
const MAX_RECENT_FONTS = 20;
const LIST_PAGE_SIZE = 120;
const INITIAL_VISIBLE_ITEMS = 140;
const FONT_ROW_HEIGHT = 34;
const FONT_VIEWPORT_HEIGHT = 256;
const FONT_WINDOW_BUFFER = 12;

const readRecentFonts = (): string[] => {
  try {
    const rawValue = window.localStorage.getItem(RECENT_FONTS_STORAGE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((font): font is string => typeof font === 'string' && font.length > 0)
      .slice(0, MAX_RECENT_FONTS);
  } catch {
    return [];
  }
};

const writeRecentFonts = (fonts: string[]): void => {
  try {
    window.localStorage.setItem(RECENT_FONTS_STORAGE_KEY, JSON.stringify(fonts.slice(0, MAX_RECENT_FONTS)));
  } catch {
    // Ignore storage failures to keep picker usable in private/restricted modes.
  }
};

export const FontFamilyPicker: React.FC<FontFamilyPickerProps> = ({
  value,
  onChange,
  side = 'bottom',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentFonts, setRecentFonts] = useState<string[]>([]);
  const [fontCatalog, setFontCatalog] = useState<GoogleFontDefinition[]>(GOOGLE_FONT_CATALOG);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const [scrollTop, setScrollTop] = useState(0);
  const [uploading, setUploading] = useState(false);
  const preloadTimeoutRef = useRef<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const { customFonts, addCustomFont } = useCustomFonts();
  const { uploadFontFile } = useSabiCanvasConfig();

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read font file'));
      reader.readAsDataURL(file);
    });
  };

  const remoteUrlToDataUrl = async (url: string, mimeType: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch uploaded font file');
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  };

  useEffect(() => {
    setRecentFonts(readRecentFonts());
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      const catalog = await getGoogleFontCatalog();
      if (!mounted) return;
      setFontCatalog(catalog);
    };

    loadCatalog();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    let idleId: number | undefined;

    const warmTopFonts = async () => {
      const topFonts = await getTopFontPreload();
      if (!mounted) return;
      preloadFonts(topFonts.slice(0, 4), { concurrency: 1, maxFonts: 4, timeoutMs: 1800 });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => {
        warmTopFonts();
      });
    } else {
      globalThis.setTimeout(() => {
        warmTopFonts();
      }, 0);
    }

    return () => {
      mounted = false;
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
    };
  }, [open]);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  // Custom fonts as GoogleFontDefinition entries for unified list handling
  const customFontDefs = useMemo<GoogleFontDefinition[]>(() => {
    return customFonts.map((f) => ({ family: f.family, weights: [400], category: 'sans' as const }));
  }, [customFonts]);

  const filteredCustomFonts = useMemo(() => {
    if (!normalizedQuery) return customFontDefs;
    return customFontDefs.filter((f) => f.family.toLowerCase().includes(normalizedQuery));
  }, [customFontDefs, normalizedQuery]);

  const filteredGoogleFonts = useMemo(() => {
    const sourceFonts = normalizedQuery
      ? fontCatalog.filter((font) => font.family.toLowerCase().includes(normalizedQuery))
      : fontCatalog;

    if (recentFonts.length === 0) {
      return sourceFonts;
    }

    const recentRank = new Map(recentFonts.map((font, index) => [font, index]));
    return [...sourceFonts].sort((a, b) => {
      const aRank = recentRank.get(a.family);
      const bRank = recentRank.get(b.family);

      if (aRank === undefined && bRank === undefined) return 0;
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    });
  }, [fontCatalog, normalizedQuery, recentFonts]);

  // Combined list: custom fonts first, then google fonts
  const filteredFonts = useMemo(() => {
    return [...filteredCustomFonts, ...filteredGoogleFonts];
  }, [filteredCustomFonts, filteredGoogleFonts]);

  useEffect(() => {
    if (!open) return;
    setVisibleCount(INITIAL_VISIBLE_ITEMS);
    setScrollTop(0);
  }, [open, normalizedQuery]);

  const visibleFonts = useMemo(() => {
    return filteredFonts.slice(0, visibleCount);
  }, [filteredFonts, visibleCount]);

  const recentFontSet = useMemo(() => new Set(recentFonts), [recentFonts]);
  const firstNonRecentIndex = useMemo(() => {
    // Among google fonts only (skip custom font entries at the top)
    const offset = filteredCustomFonts.length;
    const idx = filteredGoogleFonts.findIndex((font) => !recentFontSet.has(font.family));
    return idx < 0 ? -1 : offset + idx;
  }, [filteredCustomFonts.length, filteredGoogleFonts, recentFontSet]);

  const visibleFirstNonRecentIndex = useMemo(() => {
    if (firstNonRecentIndex < 0) return -1;
    if (firstNonRecentIndex >= visibleFonts.length) return -1;
    return firstNonRecentIndex;
  }, [firstNonRecentIndex, visibleFonts.length]);

  // Index of the first google font in the visible list (to show separator after custom fonts)
  const firstGoogleFontIndex = useMemo(() => {
    if (filteredCustomFonts.length === 0 || filteredCustomFonts.length >= visibleFonts.length) return -1;
    return filteredCustomFonts.length;
  }, [filteredCustomFonts.length, visibleFonts.length]);

  const selectedFontLabel = value || 'Select font';

  const previewWindow = useMemo(() => {
    if (visibleFonts.length === 0) {
      return { start: 0, end: -1 };
    }

    const baseStart = Math.floor(scrollTop / FONT_ROW_HEIGHT);
    const visibleRows = Math.ceil(FONT_VIEWPORT_HEIGHT / FONT_ROW_HEIGHT);
    const start = Math.max(0, baseStart - FONT_WINDOW_BUFFER);
    const end = Math.min(visibleFonts.length - 1, baseStart + visibleRows + FONT_WINDOW_BUFFER);

    return { start, end };
  }, [scrollTop, visibleFonts.length]);

  const previewFontFamilies = useMemo(() => {
    if (previewWindow.end < previewWindow.start) return [];

    const fontsInWindow = visibleFonts.slice(previewWindow.start, previewWindow.end + 1).map((font) => font.family);
    if (value && !fontsInWindow.includes(value)) {
      fontsInWindow.push(value);
    }

    return fontsInWindow;
  }, [previewWindow.end, previewWindow.start, value, visibleFonts]);

  useEffect(() => {
    if (!open || previewFontFamilies.length === 0) return;

    if (preloadTimeoutRef.current !== null) {
      window.clearTimeout(preloadTimeoutRef.current);
    }

    preloadTimeoutRef.current = window.setTimeout(() => {
      // Only preload google fonts — custom fonts are already registered
      const googleOnly = previewFontFamilies.filter((f) => !isCustomFont(f));
      preloadFonts(googleOnly, {
        concurrency: 2,
        maxFonts: googleOnly.length,
        timeoutMs: 2000,
      });
    }, 80);

    return () => {
      if (preloadTimeoutRef.current !== null) {
        window.clearTimeout(preloadTimeoutRef.current);
        preloadTimeoutRef.current = null;
      }
    };
  }, [open, previewFontFamilies]);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const threshold = 280;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    setScrollTop(target.scrollTop);

    if (remaining > threshold) return;

    setVisibleCount((prev) => {
      if (prev >= filteredFonts.length) return prev;
      return Math.min(filteredFonts.length, prev + LIST_PAGE_SIZE);
    });
  };

  const handleUploadFont = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) return;
    const files = Array.from(fileList); // snapshot before clearing the input
    event.target.value = '';

    setUploading(true);
    for (const file of files) {
      try {
        let dataUrl: string;
        if (uploadFontFile) {
          const uploaded = await uploadFontFile(file);
          dataUrl = await remoteUrlToDataUrl(uploaded.src, file.type || 'font/ttf');
        } else {
          dataUrl = await fileToDataUrl(file);
        }
        const family = deriveFontFamilyFromFileName(file.name);
        const font = await addCustomFont({
          family,
          fileName: file.name,
          mimeType: file.type || 'font/ttf',
          dataUrl,
        });
        // Select the newly uploaded font immediately
        setRecentFonts((prev) => {
          const next = [font.family, ...prev.filter((f) => f !== font.family)].slice(0, MAX_RECENT_FONTS);
          writeRecentFonts(next);
          return next;
        });
        onChange(font.family);
        setOpen(false);
      } catch {
        toast.error(`Failed to upload "${file.name}".`);
      }
    }
    setUploading(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="border flex items-center justify-between h-8 min-w-[120px] max-w-[180px] px-2 text-xs text-muted-foreground"
          title={selectedFontLabel}
        >
          <span className="truncate" style={{ fontFamily: getFontFallbackStack(selectedFontLabel) }}>
            {selectedFontLabel}
          </span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side={side} align="start">
        <div className="flex items-center gap-2 px-1 pb-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search fonts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 text-xs"
            autoFocus={false}
          />
        </div>

        <div className="max-h-64 overflow-y-auto pr-1" onScroll={handleListScroll}>
          <div className="space-y-0.5">
            {visibleFonts.map((font, index) => {
              const isSelected = font.family === value;
              const shouldPreview = isSelected || (index >= previewWindow.start && index <= previewWindow.end);
              const isCustom = isCustomFont(font.family);
              return (
                <React.Fragment key={font.family}>
                  {/* Separator: "Custom" label before first custom font */}
                  {index === 0 && isCustom && filteredCustomFonts.length > 0 ? (
                    <div className="px-2 pb-0.5 pt-0.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Custom</span>
                    </div>
                  ) : null}
                  {/* Separator: divider between custom and google fonts */}
                  {index === firstGoogleFontIndex && firstGoogleFontIndex > 0 ? (
                    <div className="my-1 border-t border-border" />
                  ) : null}
                  {/* Separator: recent / all divider within google fonts */}
                  {index === visibleFirstNonRecentIndex && visibleFirstNonRecentIndex > Math.max(0, firstGoogleFontIndex) ? (
                    <div className="my-1 border-t border-border" />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      'h-8 w-full justify-between px-2 text-left text-xs',
                      isSelected && 'bg-secondary text-secondary-foreground'
                    )}
                    style={shouldPreview ? { fontFamily: getFontFallbackStack(font.family) } : undefined}
                    onClick={() => {
                      setRecentFonts((prev) => {
                        const next = [font.family, ...prev.filter((item) => item !== font.family)].slice(0, MAX_RECENT_FONTS);
                        writeRecentFonts(next);
                        return next;
                      });
                      if (!isCustom) {
                        loadFontFamily(font.family, { timeoutMs: 2000 });
                      }
                      onChange(font.family);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{font.family}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {isCustom ? (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground leading-none">Custom</span>
                      ) : null}
                      {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                  </Button>
                </React.Fragment>
              );
            })}
          </div>

          {filteredFonts.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">No fonts matched your search.</div>
          ) : null}
        </div>

        {/* Footer: upload custom font */}
        <div className="mt-1 pt-1.5 border-t border-border">
          <input
            ref={uploadInputRef}
            type="file"
            accept={CUSTOM_FONT_ACCEPT}
            multiple
            className="hidden"
            onChange={handleUploadFont}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full h-7 gap-2 text-xs text-muted-foreground justify-start px-2"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploading ? 'Uploading…' : 'Upload font'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FontFamilyPicker;

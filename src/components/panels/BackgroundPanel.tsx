import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { ImageIcon, Loader2, Palette, Search, Upload, X } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { Input } from '@sabi-canvas/ui/input';
import { Label } from '@sabi-canvas/ui/label';
import { Separator } from '@sabi-canvas/ui/separator';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@sabi-canvas/ui/popover';
import { cn } from '@sabi-canvas/lib/utils';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { toast } from 'sonner';
import type { CanvasBackground } from '@sabi-canvas/types/pages';
import { useRecentUploads } from '@sabi-canvas/hooks/useRecentUploads';

interface BackgroundPanelProps {
  onClose: () => void;
}

// ─── Preset data ───────────────────────────────────────────────────────────────

const COMPACT_SOLID_PRESETS: string[] = [
  '#ffffff', '#0d6efd', '#fd7e14', '#198754', '#ffc107', '#a855f7',
];

interface GradientPreset {
  id: string;
  label: string;
  colors: string[];
  angle: number;
  type: 'linear-gradient' | 'radial-gradient';
  css: string;
}

const GRADIENT_PRESETS: GradientPreset[] = [
  // Linear gradients
  { id: 'sunset', label: 'Sunset', type: 'linear-gradient', angle: 135, colors: ['#f97316', '#ec4899'], css: 'linear-gradient(135deg, #f97316, #ec4899)' },
  { id: 'ocean', label: 'Ocean', type: 'linear-gradient', angle: 135, colors: ['#0ea5e9', '#6366f1'], css: 'linear-gradient(135deg, #0ea5e9, #6366f1)' },
  { id: 'forest', label: 'Forest', type: 'linear-gradient', angle: 160, colors: ['#22c55e', '#15803d'], css: 'linear-gradient(160deg, #22c55e, #15803d)' },
  { id: 'rose', label: 'Rose', type: 'linear-gradient', angle: 135, colors: ['#fda4af', '#be123c'], css: 'linear-gradient(135deg, #fda4af, #be123c)' },
  { id: 'dawn', label: 'Dawn', type: 'linear-gradient', angle: 180, colors: ['#fef3c7', '#f59e0b', '#b45309'], css: 'linear-gradient(180deg, #fef3c7, #f59e0b, #b45309)' },
  { id: 'night', label: 'Night', type: 'linear-gradient', angle: 180, colors: ['#1e1b4b', '#4f46e5'], css: 'linear-gradient(180deg, #1e1b4b, #4f46e5)' },
  { id: 'coral', label: 'Coral', type: 'linear-gradient', angle: 120, colors: ['#fde68a', '#f97316', '#db2777'], css: 'linear-gradient(120deg, #fde68a, #f97316, #db2777)' },
  { id: 'mint', label: 'Mint', type: 'linear-gradient', angle: 135, colors: ['#d1fae5', '#10b981'], css: 'linear-gradient(135deg, #d1fae5, #10b981)' },
  { id: 'lavender', label: 'Lavender', type: 'linear-gradient', angle: 135, colors: ['#ede9fe', '#7c3aed'], css: 'linear-gradient(135deg, #ede9fe, #7c3aed)' },
  { id: 'silver', label: 'Silver', type: 'linear-gradient', angle: 180, colors: ['#f1f5f9', '#94a3b8'], css: 'linear-gradient(180deg, #f1f5f9, #94a3b8)' },
  // Radial gradients
  { id: 'radial-fire', label: 'Fire', type: 'radial-gradient', angle: 0, colors: ['#fde68a', '#f97316', '#7f1d1d'], css: 'radial-gradient(circle, #fde68a, #f97316, #7f1d1d)' },
  { id: 'radial-cosmos', label: 'Cosmos', type: 'radial-gradient', angle: 0, colors: ['#a78bfa', '#1e1b4b'], css: 'radial-gradient(circle, #a78bfa, #1e1b4b)' },
];

import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useDebounce } from '@sabi-canvas/hooks/use-debounce';
import { usePhotosQuery } from '@sabi-canvas/hooks/usePhotosQuery';
import { useImageUpload } from '@sabi-canvas/hooks/useImageUpload';

// ─── Unsplash background section ──────────────────────────────────────────────

interface UnsplashBackgroundSectionProps {
  currentBg: CanvasBackground | undefined;
  onApply: (bg: CanvasBackground) => void;
}

const UnsplashBackgroundSection: React.FC<UnsplashBackgroundSectionProps> = ({
  currentBg,
  onApply,
}) => {
  const { lastBackgroundPhotosSearch, setLastBackgroundPhotosSearch } = useEditor();
  const [query, setQuery] = useState(lastBackgroundPhotosSearch);
  const [displayCount, setDisplayCount] = useState(6);
  const debouncedQuery = useDebounce(query, 500);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status
  } = usePhotosQuery(debouncedQuery, 'backgrounds');

  const observer = useRef<IntersectionObserver | null>(null);

  // Sync with independent global search persistence
  useEffect(() => {
    setLastBackgroundPhotosSearch(query);
    setDisplayCount(6); // Reset on new search
  }, [debouncedQuery, setLastBackgroundPhotosSearch]);

  const allPhotos = (data?.pages.flat() ?? []);
  const photos = allPhotos.slice(0, displayCount);

  const lastPhotoElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetching || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          // Load more displayed items first, then fetch next page
          if (displayCount < allPhotos.length) {
            setDisplayCount(prev => Math.min(prev + 6, allPhotos.length));
          } else if (hasNextPage) {
            fetchNextPage();
          }
        }
      });

      if (node) observer.current.observe(node);
    },
    [isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, displayCount, allPhotos.length]
  );

  const activePhotoUrl =
    currentBg?.type === 'image' ? (currentBg as Extract<CanvasBackground, { type: 'image' }>).src : null;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative px-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search backgrounds..."
          className="pl-9 bg-muted/20 border-border/40 focus:bg-background transition-all rounded-lg text-sm h-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Attribution */}
      <p className="text-center text-[10px] text-muted-foreground">
        Photos by{' '}
        <a
          href="https://unsplash.com/?utm_source=sabiprint&utm_medium=referral"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium hover:underline transition-colors"
        >
          Unsplash
        </a>
      </p>

      {/* Grid */}
      {status === 'pending' && !isFetchingNextPage ? (
        <div className="columns-2 gap-2 pb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mb-2 break-inside-avoid">
              <Skeleton
                className={`w-full rounded-xl animate-pulse ${i % 3 === 0 ? 'h-32' : i % 2 === 0 ? 'h-48' : 'h-24'}`}
              />
            </div>
          ))}
        </div>
      ) : photos.length > 0 ? (
        <>
          <div className="columns-2 gap-2 px-1 py-1">
            {photos.map((photo) => {
              const isActive = activePhotoUrl === photo.urls.regular;
              return (
                <button
                  key={photo.id}
                  className={cn(
                    'group relative w-full mb-2 break-inside-avoid rounded-xl overflow-hidden bg-muted/30 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary',
                    isActive && 'ring-2 ring-primary border-primary'
                  )}
                  onClick={() => onApply({ type: 'image', src: photo.urls.regular })}
                >
                  <img
                    src={`${photo.urls.thumb}?fit=max&w=300&q=70`}
                    alt={photo.alt_description || 'Unsplash photo'}
                    loading="lazy"
                    decoding="async"
                    width={300}
                    height={300}
                    className="w-full h-auto block object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Attribution overlay */}
                  <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 pointer-events-none">
                    <p className="text-[9px] text-white/90 leading-tight text-center w-full pointer-events-auto pb-1 drop-shadow-md truncate px-1">
                      By{' '}
                      <a
                        href={`https://unsplash.com/@${photo.user.username}?utm_source=sabiprint&utm_medium=referral`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-white hover:underline transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {photo.user.name}
                      </a>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={lastPhotoElementRef} className="h-4 w-full" />

          {(isFetchingNextPage || displayCount < allPhotos.length) && (
            <div className="py-4 flex justify-center w-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground opacity-50" />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-xl bg-muted/5 p-6 text-center text-muted-foreground space-y-3">
          <ImageIcon className="h-8 w-8 mb-2 opacity-30" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground/80">No photos found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main panel ────────────────────────────────────────────────────────────────

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({ onClose }) => {
  const { activePage, updatePageBackground } = useCanvasObjects();
  const { addUpload } = useRecentUploads();
  const currentBg = activePage.background;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);

  const currentColor =
    currentBg?.type === 'solid' ? currentBg.color : '#ffffff';
  const [localColor, setLocalColor] = useState(currentColor);

  useEffect(() => {
    setLocalColor(currentColor);
  }, [currentColor]);

  const handleApply = useCallback(
    (bg: CanvasBackground) => {
      updatePageBackground(bg);
      setTimeout(() => onClose(), 50);
    },
    [updatePageBackground, onClose]
  );

  const handleColorChange = (color: string) => {
    setLocalColor(color);
    updatePageBackground({ type: 'solid', color });
  };

  const handleBackgroundImageLoaded = useCallback(
    (src: string, width: number, height: number) => {
      updatePageBackground({ type: 'image', src });
      addUpload(src, width, height);
      setTimeout(() => onClose(), 50);
    },
    [updatePageBackground, addUpload, onClose]
  );

  const { processImage } = useImageUpload({
    onImageLoaded: handleBackgroundImageLoaded,
    maxSize: 2200,
    accept: 'image/*, .svg',
    onUploadStart: () => {
      setIsUploadingBackground(true);
    },
    onUploadComplete: () => {
      setIsUploadingBackground(false);
    },
    onUploadError: (error) => {
      setIsUploadingBackground(false);
      toast.error(error.message || 'Upload failed');
    },
  });

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await processImage(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processImage]
  );

  const isTransparent = currentBg?.type === 'transparent';
  const isImageBg = currentBg?.type === 'image';
  const activeImageSrc = isImageBg
    ? (currentBg as Extract<CanvasBackground, { type: 'image' }>).src
    : null;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      {/* ── Compact controls ── */}
      <div className="space-y-3 pb-2 overflow-hidden min-w-0">

        {/* Color row */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
            Color
          </Label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            {/* Palette picker trigger — fixed first */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Pick custom color"
                  className={cn(
                    'flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-md border-2 transition-all hover:scale-110',
                    currentBg?.type === 'solid' &&
                      !COMPACT_SOLID_PRESETS.includes(currentBg.color.toLowerCase())
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border'
                  )}
                  style={{ backgroundColor: localColor }}
                >
                  <Palette className="h-3.5 w-3.5 text-gray-500 drop-shadow" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" side="right" align="start">
                <Label className="text-xs mb-2 block font-medium">Pick Color</Label>
                <HexColorPicker color={localColor} onChange={handleColorChange} />
                <div className="flex items-center gap-1 border border-input rounded-md px-2 py-1 h-8 mt-2">
                  <span className="text-xs text-muted-foreground">#</span>
                  <input
                    className="flex-1 bg-transparent border-none text-xs focus:outline-none uppercase"
                    value={localColor.replace('#', '')}
                    onChange={(e) => {
                      const val = '#' + e.target.value.replace('#', '');
                      setLocalColor(val);
                      if (val.length === 7) handleColorChange(val);
                    }}
                    maxLength={6}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Transparent / checker — fixed second */}
            <button
              type="button"
              onClick={() => handleApply({ type: 'transparent' })}
              aria-label="No background (transparent)"
              className={cn(
                'w-8 h-8 flex-shrink-0 rounded-md border-2 transition-all hover:scale-110',
                isTransparent ? 'border-primary ring-2 ring-primary/30' : 'border-border'
              )}
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                backgroundColor: '#fff',
              }}
            />

            {/* Solid colour presets */}
            {COMPACT_SOLID_PRESETS.map((color) => {
              const isActive =
                currentBg?.type === 'solid' &&
                currentBg.color.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  onClick={() => handleApply({ type: 'solid', color })}
                  className={cn(
                    'w-8 h-8 flex-shrink-0 rounded-md border-2 transition-all hover:scale-110',
                    isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                  )}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>

        {/* Gradient row */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
            Gradient
          </Label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            {GRADIENT_PRESETS.map((preset) => {
              const isActive =
                (currentBg?.type === 'linear-gradient' || currentBg?.type === 'radial-gradient') &&
                JSON.stringify(currentBg.colors) === JSON.stringify(preset.colors);
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.label}
                  onClick={() =>
                    handleApply(
                      preset.type === 'linear-gradient'
                        ? { type: 'linear-gradient', colors: preset.colors, angle: preset.angle }
                        : { type: 'radial-gradient', colors: preset.colors }
                    )
                  }
                  className={cn(
                    'w-8 h-8 flex-shrink-0 rounded-md border-2 transition-all hover:scale-110',
                    isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                  )}
                  style={{ background: preset.css }}
                />
              );
            })}
          </div>
        </div>

        {/* Upload row */}
        <div>
          {isImageBg && activeImageSrc && !activeImageSrc.startsWith('https://') ? (
            <div className="space-y-1.5">
              <div className="relative">
                <img
                  src={activeImageSrc}
                  alt="Background"
                  className="w-full h-16 object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => handleApply({ type: 'solid', color: '#ffffff' })}
                  aria-label="Remove image background"
                  className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-0.5 border border-border transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingBackground}
              >
                {isUploadingBackground ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {isUploadingBackground ? 'Uploading...' : 'Replace'}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingBackground}
            >
              {isUploadingBackground ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {isUploadingBackground ? 'Uploading...' : 'Upload image'}
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <Separator />
      </div>

      {/* ── Unsplash photo backgrounds ── */}
      <div className="pt-2 pb-4">
        <UnsplashBackgroundSection currentBg={currentBg} onApply={handleApply} />
      </div>
    </div>
  );
};

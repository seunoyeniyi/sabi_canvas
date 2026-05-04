import React, { useState, useRef, useCallback } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { Input } from '@sabi-canvas/ui/input';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { usePixabayGraphics, PixabayHit } from '@sabi-canvas/hooks/usePixabayGraphics';
import { useDebounce } from '@sabi-canvas/hooks/use-debounce';

interface GraphicsGridProps {
  onClose: () => void;
}

export const GraphicsGrid: React.FC<GraphicsGridProps> = ({ onClose }) => {
  const { lastGraphicsSearch, setLastGraphicsSearch } = useEditor();
  const [query, setQuery] = useState(lastGraphicsSearch);
  const [displayCount, setDisplayCount] = useState(6);
  const debouncedQuery = useDebounce(query, 500);
  const { addImage } = useCanvasObjects();
  const observer = useRef<IntersectionObserver | null>(null);

  // Update global state when local query changes
  React.useEffect(() => {
    setLastGraphicsSearch(query);
    setDisplayCount(6); // Reset on new search
  }, [debouncedQuery, setLastGraphicsSearch]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = usePixabayGraphics(debouncedQuery);

  const allGraphics = (data?.pages.flatMap((page) => page.hits) ?? []);
  const graphics = allGraphics.slice(0, displayCount);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetching || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          // Load more displayed items first, then fetch next page
          if (displayCount < allGraphics.length) {
            setDisplayCount(prev => Math.min(prev + 6, allGraphics.length));
          } else if (hasNextPage) {
            fetchNextPage();
          }
        }
      });

      if (node) observer.current.observe(node);
    },
    [isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, displayCount, allGraphics.length]
  );

  const handleGraphicClick = (e: React.MouseEvent, hit: PixabayHit) => {
    e.stopPropagation();

    const maxSize = 800;
    let width = hit.imageWidth;
    let height = hit.imageHeight;

    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    addImage(hit.largeImageURL, undefined, { width, height });

    setTimeout(() => {
      onClose();
    }, 50);
  };

  return (
    <div className="space-y-4 flex flex-col h-full w-full pt-1">
      <div className="space-y-3">
        <div className="relative md:px-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search transparent objects (pencil, car, etc)..."
            className="pl-9 h-10 bg-muted/20 border-border/40 focus:bg-background transition-all rounded-lg text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {status === 'pending' && !isFetchingNextPage ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-hidden min-h-0 pointer-events-none">
            <div className="grid grid-cols-2 gap-3 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={`w-full rounded-xl animate-pulse ${i % 3 === 0 ? 'h-32' : 'h-40'}`} />
              ))}
            </div>
          </ScrollArea>
        ) : graphics.length > 0 ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-y-auto min-h-0">
            <div className="grid grid-cols-2 gap-3 py-1">
              {graphics.map((hit) => (
                <button
                  key={hit.id}
                  className="group relative w-full aspect-square rounded-xl overflow-hidden bg-muted/30 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={(e) => handleGraphicClick(e, hit)}
                >
                  <img
                    src={hit.previewURL}
                    alt={hit.tags || 'Pixabay graphic'}
                    loading="lazy"
                    decoding="async"
                    width={150}
                    height={150}
                    className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-110"
                  />

                  {/* Hover Overlay */}
                  <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 pointer-events-none">
                    <p className="text-[10px] text-white/90 leading-tight text-center w-full truncate px-1">
                      {hit.tags.split(',').slice(0, 2).join(', ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div ref={lastElementRef} className="h-4 w-full" />

            {(isFetchingNextPage || displayCount < allGraphics.length) && (
              <div className="py-4 flex justify-center w-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground opacity-50" />
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-3 border-2 border-dashed border-border/40 rounded-xl bg-muted/5">
            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-2">
              <Sparkles className="w-8 h-8 opacity-30" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">No transparent objects found</p>
              <p className="text-xs px-6 leading-relaxed">
                Try searching for 'pencil', 'football', or 'car'.
              </p>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-center text-[10px] text-muted-foreground pt-2">
        Graphics by{' '}
        <a
          href="https://pixabay.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-medium hover:underline transition-colors"
        >
          Pixabay
        </a>
      </p>
    </div>
  );
};

import React, { useState, useRef, useCallback } from 'react';
import { Search, Sparkles, Loader2 } from 'lucide-react';
import { Input } from '@sabi-canvas/ui/input';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useTheme } from '@sabi-canvas/providers/theme-provider';
import { useDebounce } from '@sabi-canvas/hooks/use-debounce';
import { useIconsQuery } from '@sabi-canvas/hooks/useIconsQuery';
import { createPathObject, createImageObject } from '@sabi-canvas/types/canvas-objects';
import { toast } from 'sonner';

interface IconsGridProps {
  onClose: () => void;
}

function isIconMultiColored(svgBody: string): boolean {
  // Check for multi-colored fills (excluding 'currentColor', 'none', and 'inherit')
  const fillColors = new Set();
  const fillRegex = /fill="((?!currentColor|none|inherit)[^"]+)"/g;
  let match;
  while ((match = fillRegex.exec(svgBody)) !== null) {
    fillColors.add(match[1].toLowerCase());
  }

  // Check for multi-colored strokes
  const strokeRegex = /stroke="((?!currentColor|none|inherit)[^"]+)"/g;
  while ((match = strokeRegex.exec(svgBody)) !== null) {
    fillColors.add(match[1].toLowerCase());
  }

  // If we have more than one distinct color, it's multi-colored
  if (fillColors.size > 1) return true;

  // Check for non-path elements that often appear in complex graphics.
  // extractPathData only handles <path d="...">, so any other shape means we should use ImageObject.
  const complexElements = ['<rect', '<circle', '<ellipse', '<line', '<polyline', '<polygon', '<image', '<linearGradient', '<radialGradient'];
  if (complexElements.some(el => svgBody.includes(el))) {
    return true;
  }

  return false;
}

/**
 * Extracts all 'd' attributes from path elements in an SVG body string
 * and combines them into a single path data string.
 */
function extractPathData(svgBody: string): string {
  const pathRegex = /d="([^"]+)"/g;
  let match;
  let combinedPath = '';
  while ((match = pathRegex.exec(svgBody)) !== null) {
    combinedPath += match[1] + ' ';
  }
  return combinedPath.trim();
}

export const IconsGrid: React.FC<IconsGridProps> = ({ onClose }) => {
  const { lastIconsSearch, setLastIconsSearch } = useEditor();
  const [query, setQuery] = useState(lastIconsSearch);
  const debouncedQuery = useDebounce(query, 400);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status
  } = useIconsQuery(debouncedQuery);

  const { addObject, getCustomerModePlacement } = useCanvasObjects();
  const observer = useRef<IntersectionObserver | null>(null);

  // Sync with global search persistence
  React.useEffect(() => {
    setLastIconsSearch(query);
  }, [query, setLastIconsSearch]);

  const icons = data?.pages.flatMap(page => page.icons) || [];
  const collectionsMetadata = data?.pages.reduce((acc, page) => ({
    ...acc,
    ...page.collectionsMetadata
  }), {} as Record<string, { palette?: boolean }>) || {};

  // Infinite scroll observer
  const lastGraphicElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetching || isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observer.current.observe(node);
    },
    [isFetching, isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const { resolvedTheme } = useTheme();

  const handleGraphicClick = async (graphicPath: string) => {
    const [prefix, name] = graphicPath.split(':');
    const collectionInfo = collectionsMetadata[prefix];
    let isColored = collectionInfo?.palette === true;

    try {
      const baseSize = 240;
      const p = getCustomerModePlacement(baseSize, baseSize);
      const x = p.x;
      const y = p.y;
      const size = p.width;

      // Handle icons as PathObjects (recolorable) or SVG images (multi-colored)
      // We fetch the icon data to perform a deeper check if metadata is ambiguous
      const response = await fetch(`https://api.iconify.design/${prefix}.json?icons=${name}`);
      if (!response.ok) throw new Error('Failed to fetch icon data');

      const data = await response.json();
      const iconData = data.icons[name];

      if (!iconData || !iconData.body) {
        toast.error('Could not find icon data');
        return;
      }

      // Fallback: If metadata doesn't explicitly say it's colored, inspect the body
      if (!isColored && isIconMultiColored(iconData.body)) {
        isColored = true;
      }

      if (isColored) {
        const svgUrl = `https://api.iconify.design/${prefix}/${name}.svg`;
        const newObj = createImageObject(
          svgUrl,
          { x, y },
          { width: size, height: size }
        );
        addObject(newObj);
      } else {
        const pathData = extractPathData(iconData.body);
        if (!pathData) {
          // If no path data found but it wasn't caught by isIconMultiColored, 
          // it might be an empty icon or use something we missed. 
          // Fallback to image just in case.
          const svgUrl = `https://api.iconify.design/${prefix}/${name}.svg`;
          const newObj = createImageObject(svgUrl, { x, y }, { width: size, height: size });
          addObject(newObj);
        } else {
          const originalWidth = iconData.width || data.width || 24;
          const originalHeight = iconData.height || data.height || 24;
          const scaleX = size / originalWidth;
          const scaleY = size / originalHeight;

          const newObj = createPathObject(
            pathData,
            { x, y },
            { width: size, height: size },
            'hsl(217, 91%, 60%)'
          );
          newObj.scaleX = scaleX;
          newObj.scaleY = scaleY;

          addObject(newObj);
        }
      }

      onClose();
    } catch (error) {
      console.error('Error adding icon:', error);
      toast.error('Failed to add graphic');
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col pt-1">
      <div className="space-y-3">
        <div className="relative md:px-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search 100k+ graphics..."
            className="pl-9 h-10 bg-muted/20 border-border/40 focus:bg-background transition-all rounded-lg text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {status === 'pending' && !isFetchingNextPage ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-hidden min-h-0 pointer-events-none">
            <div className="grid grid-cols-4 gap-3 pb-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          </ScrollArea>
        ) : icons.length > 0 ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-y-auto min-h-0">
            <div className="grid grid-cols-4 gap-3 py-1">
              {icons.map((graphic, index) => {
                const prefix = graphic.split(':')[0];
                const collectionInfo = collectionsMetadata[prefix];
                const isColored = collectionInfo?.palette === true;
                const iconColor = (resolvedTheme === 'dark' && !isColored) ? 'white' : '';
                const iconUrl = `https://api.iconify.design/${graphic.replace(':', '/')}.svg${iconColor ? `?color=${iconColor}` : ''}`;

                return (
                  <button
                    key={`${graphic}-${index}`}
                    onClick={() => handleGraphicClick(graphic)}
                    className="flex items-center justify-center aspect-square p-2.5 rounded-xl border border-border/40 bg-card hover:bg-accent hover:border-primary/40 hover:shadow-sm transition-all group relative overflow-hidden"
                    title={graphic.includes(':') ? graphic.split(':')[1] : graphic}
                  >
                    <img
                      src={iconUrl}
                      alt={graphic}
                      className="w-full h-full opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 pointer-events-none"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                  </button>
                );
              })}
            </div>

            {/* Pagination target */}
            <div ref={lastGraphicElementRef} className="h-4 w-full" />

            {isFetchingNextPage && (
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
              <p className="text-sm font-medium text-foreground/80">No graphics found</p>
              <p className="text-xs px-6 leading-relaxed">
                Try searching for 'home', 'star', 'user' or brands like 'google'.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

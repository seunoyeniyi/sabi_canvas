import React, { useState, useRef, useCallback } from 'react';
import { Search, Loader2, Image as ImageIcon } from 'lucide-react';
import { Input } from '@sabi-canvas/ui/input';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useDebounce } from '@sabi-canvas/hooks/use-debounce';
import { usePhotosQuery, UnsplashImage } from '@sabi-canvas/hooks/usePhotosQuery';

interface PhotosPanelProps {
  onClose: () => void;
}

export const PhotosPanel: React.FC<PhotosPanelProps> = ({ onClose }) => {
  const { lastPhotosSearch, setLastPhotosSearch } = useEditor();
  const [query, setQuery] = useState(lastPhotosSearch);
  const [displayCount, setDisplayCount] = useState(6);
  const debouncedQuery = useDebounce(query, 500);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status
  } = usePhotosQuery(debouncedQuery);

  const { addImage } = useCanvasObjects();
  const observer = useRef<IntersectionObserver | null>(null);

  // Sync with global search persistence
  React.useEffect(() => {
    setLastPhotosSearch(query);
    setDisplayCount(6); // Reset on new search
  }, [debouncedQuery, setLastPhotosSearch]);

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

  const handlePhotoClick = (e: React.MouseEvent, photo: UnsplashImage) => {
    e.stopPropagation();

    const maxSize = 1000;
    let width = photo.width;
    let height = photo.height;

    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    addImage(photo.urls.regular, undefined, { width, height });

    // Give time for click events to finish processing so we don't immediately deselect the new image
    setTimeout(() => {
      onClose();
    }, 50);
  };

  return (
    <div className="space-y-4 flex flex-col h-full w-full md:pt-2">
      <div className="space-y-3">
        <div className="relative md:px-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search Unsplash photos..."
            className="pl-9 bg-muted/20 border-border/40 focus:bg-background transition-all rounded-lg text-sm h-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {status === 'pending' && !isFetchingNextPage ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-hidden min-h-0 pointer-events-none">
            <div className="columns-2 gap-2 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mb-2 break-inside-avoid">
                  <Skeleton className={`w-full rounded-xl animate-pulse ${i % 3 === 0 ? 'h-32' : i % 2 === 0 ? 'h-48' : 'h-24'}`} />
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : photos.length > 0 ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-y-auto min-h-0">
            <div className="columns-2 gap-2 px-1 py-1">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  className="group relative w-full mb-2 break-inside-avoid rounded-xl overflow-hidden bg-muted/30 border border-border/40 hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={(e) => handlePhotoClick(e, photo)}
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

                  {/* Attribution Overlay */}
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
              ))}
            </div>

            {/* Invisible target for IntersectionObserver to trigger load more */}
            <div ref={lastPhotoElementRef} className="h-4 w-full" />

            {(isFetchingNextPage || displayCount < allPhotos.length) && (
              <div className="py-4 flex justify-center w-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground opacity-50" />
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-xl bg-muted/5 p-6 text-center text-muted-foreground space-y-3">
            <ImageIcon className="h-8 w-8 mb-2 opacity-30" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">No photos found</p>
              <p className="text-xs">Try a different search term</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotosPanel;

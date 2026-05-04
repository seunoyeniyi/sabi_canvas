import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

const RECENT_UPLOADS_KEY = 'canvas_recent_uploads';
const MAX_UPLOADS = 10;

export interface RecentImage {
  id: string;
  src: string;
  width: number;
  height: number;
}

export const useRecentUploads = () => {
  const { disableRecentUploadsLocalStorage, listRecentUploads } = useSabiCanvasConfig();
  const queryClient = useQueryClient();
  const queryKey = ['sabi-canvas', 'recent-uploads', disableRecentUploadsLocalStorage, Boolean(listRecentUploads)] as const;

  const loadUploads = useCallback(async (): Promise<RecentImage[]> => {
    if (listRecentUploads) {
      try {
        const remote = await listRecentUploads({ limit: MAX_UPLOADS });
        return (remote ?? [])
          .filter((item) => typeof item?.src === 'string' && item.src.length > 0)
          .map((item, index) => ({
            id: item.id || `${Date.now()}_${index}`,
            src: item.src,
            width: item.width ?? 300,
            height: item.height ?? 300,
          }))
          .slice(0, MAX_UPLOADS);
      } catch (e) {
        console.warn('Failed to load remote recent uploads', e);
        return [];
      }
    }

    if (disableRecentUploadsLocalStorage) {
      return [];
    }

    try {
      const stored = localStorage.getItem(RECENT_UPLOADS_KEY);
      return stored ? (JSON.parse(stored) as RecentImage[]) : [];
    } catch (e) {
      console.warn('Failed to load recent uploads', e);
      return [];
    }
  }, [disableRecentUploadsLocalStorage, listRecentUploads]);

  const {
    data: uploads = [],
    isLoading: isLoadingUploads,
  } = useQuery<RecentImage[]>({
    queryKey,
    queryFn: loadUploads,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const handleStorageChange = () => {
      void queryClient.invalidateQueries({ queryKey });
    };

    window.addEventListener('recent_uploads_changed', handleStorageChange);

    return () => {
      window.removeEventListener('recent_uploads_changed', handleStorageChange);
    };
  }, [queryClient, queryKey]);

  const addUpload = useCallback((src: string, width: number, height: number) => {
    const current = (queryClient.getQueryData<RecentImage[]>(queryKey) ?? []);

    const isDuplicate = current.some((item) => item.src === src);
    if (isDuplicate) return current;

    const newUpload: RecentImage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      src,
      width,
      height,
    };

    const next = [newUpload, ...current].slice(0, MAX_UPLOADS);

    if (disableRecentUploadsLocalStorage) {
      queryClient.setQueryData(queryKey, next);
      void queryClient.invalidateQueries({ queryKey });
      return next;
    }

    try {
      let persistable = [...next];
      let saved = false;
      while (!saved && persistable.length > 0) {
        try {
          localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(persistable));
          saved = true;
        } catch (e) {
          console.warn('LocalStorage quota might be exceeded, dropping oldest item');
          persistable = persistable.slice(0, persistable.length - 1);
        }
      }

      if (!saved) {
        // The item itself is too large to store — skip silently
        return current;
      }

      queryClient.setQueryData(queryKey, persistable);
      window.dispatchEvent(new Event('recent_uploads_changed'));
      void queryClient.invalidateQueries({ queryKey });

      return persistable;
    } catch (e) {
      console.error('Failed to add upload', e);
      return current;
    }
  }, [disableRecentUploadsLocalStorage, queryClient, queryKey]);

  return { uploads, addUpload, isLoadingUploads };
};
import { useState, useCallback, useEffect } from 'react';

const RECENT_UPLOADS_KEY = 'canvas_recent_uploads';
const MAX_UPLOADS = 10;

export interface RecentImage {
  id: string;
  src: string;
  width: number;
  height: number;
}

export const useRecentUploads = () => {
  const [uploads, setUploads] = useState<RecentImage[]>([]);

  const loadUploads = useCallback(() => {
    try {
      const stored = localStorage.getItem(RECENT_UPLOADS_KEY);
      if (stored) {
        setUploads(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load recent uploads', e);
    }
  }, []);

  useEffect(() => {
    loadUploads();
    
    // Listen for custom event inside the same window
    const handleStorageChange = () => loadUploads();
    window.addEventListener('recent_uploads_changed', handleStorageChange);
    
    return () => {
      window.removeEventListener('recent_uploads_changed', handleStorageChange);
    };
  }, [loadUploads]);

  const addUpload = useCallback((src: string, width: number, height: number) => {
    try {
      const stored = localStorage.getItem(RECENT_UPLOADS_KEY);
      const prev: RecentImage[] = stored ? JSON.parse(stored) : [];
      
      const isDuplicate = prev.some(item => item.src === src);
      if (isDuplicate) return prev;
      
      const newUpload = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        src,
        width,
        height,
      };
      
      let next = [newUpload, ...prev].slice(0, MAX_UPLOADS);
      
      let saved = false;
      while (!saved && next.length > 0) {
        try {
          localStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(next));
          saved = true;
        } catch (e) {
          console.warn('LocalStorage quota might be exceeded, dropping oldest item');
          next = next.slice(0, next.length - 1);
        }
      }

      if (!saved) {
        // The item itself is too large to store — skip silently
        return prev;
      }

      // Update local state and notify others
      setUploads(next);
      window.dispatchEvent(new Event('recent_uploads_changed'));
      
      return next;
    } catch (e) {
      console.error('Failed to add upload', e);
      return [];
    }
  }, []);

  return { uploads, addUpload };
};
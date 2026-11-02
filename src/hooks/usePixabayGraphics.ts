import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

export interface PixabayHit {
  id: number;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  tags: string;
  user: string;
}

interface PixabayResponse {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
}

const PIXABAY_API_URL = 'https://pixabay.com/api/';
const PER_PAGE = 20;

/**
 * A custom hook to fetch graphics from Pixabay using TanStack Query.
 * Handles infinite scrolling, search queries, and caching.
 */
export function usePixabayGraphics(query: string) {
  const { pixabayApiKey: apiKey, proxy } = useSabiCanvasConfig();
  const proxyUrl =
    proxy?.pixabayUrl ||
    (proxy?.baseUrl ? `${proxy.baseUrl.replace(/\/$/, '')}/pixabay` : undefined);

  return useInfiniteQuery<PixabayResponse>({
    queryKey: ['pixabay-graphics', query, proxyUrl],
    queryFn: async ({ pageParam = 1 }) => {
      if (!proxyUrl && !apiKey) {
        toast.error('Pixabay is not configured. Please configure proxy or add API key.');
        throw new Error('Missing Pixabay configuration');
      }

      if (proxyUrl) {
        try {
          const response = await axios.get<PixabayResponse>(proxyUrl, {
            params: {
              q: query.trim() || undefined,
              per_page: PER_PAGE,
              page: pageParam,
              image_type: 'illustration',
              colors: 'transparent',
              editors_choice: query.trim() ? undefined : 'true',
            },
          });
          return response.data;
        } catch (error) {
          console.error('Error fetching Pixabay graphics via proxy:', error);
          toast.error('Failed to load graphics');
          throw error;
        }
      }

      const params: Record<string, any> = {
        key: apiKey,
        image_type: 'illustration',
        colors: 'transparent',
        per_page: PER_PAGE,
        page: pageParam,
      };

      if (query.trim()) {
        params.q = query.trim();
      } else {
        params.editors_choice = 'true';
      }

      try {
        const response = await axios.get<PixabayResponse>(PIXABAY_API_URL, { params });
        return response.data;
      } catch (error) {
        console.error('Error fetching Pixabay graphics:', error);
        toast.error('Failed to load graphics');
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      const totalLoaded = allPages.length * PER_PAGE;
      return totalLoaded < lastPage.totalHits ? nextPage : undefined;
    },
    enabled: Boolean(apiKey || proxyUrl),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

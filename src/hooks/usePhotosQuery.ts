import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

export interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string;
  width: number;
  height: number;
  user: {
    name: string;
    username: string;
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashImage[];
}

const UNSPLASH_API_URL = 'https://api.unsplash.com';
const PER_PAGE = 20;

/**
 * A custom hook to fetch photos from Unsplash using TanStack Query.
 * Handles both the default state (latest photos or a default search) and active searches.
 */
export function usePhotosQuery(query: string, defaultSearch?: string) {
  const { unsplashAccessKey: apiKey, proxy } = useSabiCanvasConfig();
  const proxyUrl =
    proxy?.unsplashUrl ||
    (proxy?.baseUrl ? `${proxy.baseUrl.replace(/\/$/, '')}/unsplash/photos` : undefined);

  return useInfiniteQuery<UnsplashImage[]>({
    queryKey: ['photos', query, defaultSearch, proxyUrl],
    queryFn: async ({ pageParam = 1 }) => {
      if (!proxyUrl && !apiKey) {
        toast.error('Unsplash is not configured. Please configure proxy or add API key.');
        throw new Error('Missing Unsplash configuration');
      }

      try {
        const activeSearch = query.trim() || defaultSearch;

        if (proxyUrl) {
          const response = await axios.get(proxyUrl, {
            params: {
              query: activeSearch || undefined,
              per_page: PER_PAGE,
              page: pageParam,
            },
          });
          const data = response.data;
          return Array.isArray(data) ? data : (data?.results ?? []);
        }

        let response;
        if (activeSearch) {
          response = await axios.get<UnsplashSearchResponse>(`${UNSPLASH_API_URL}/search/photos`, {
            params: {
              query: activeSearch,
              per_page: PER_PAGE,
              page: pageParam,
              client_id: apiKey
            }
          });
          return response.data.results;
        } else {
          response = await axios.get<UnsplashImage[]>(`${UNSPLASH_API_URL}/photos`, {
            params: {
              per_page: PER_PAGE,
              page: pageParam,
              client_id: apiKey
            }
          });
          return response.data;
        }
      } catch (error) {
        console.error('Error fetching Unsplash photos:', error);
        toast.error('Failed to load photos');
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PER_PAGE ? allPages.length + 1 : undefined;
    },
    enabled: Boolean(apiKey || proxyUrl),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

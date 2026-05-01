import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

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
  const apiKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  return useInfiniteQuery<UnsplashImage[]>({
    queryKey: ['photos', query, defaultSearch],
    queryFn: async ({ pageParam = 1 }) => {
      if (!apiKey) {
        toast.error("Unsplash API key is missing. Please add it to .env");
        throw new Error("Missing API Key");
      }

      try {
        let response;
        const activeSearch = query.trim() || defaultSearch;

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
    enabled: !!apiKey,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

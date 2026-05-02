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
  const { pixabayApiKey: apiKey } = useSabiCanvasConfig();

  return useInfiniteQuery<PixabayResponse>({
    queryKey: ['pixabay-graphics', query],
    queryFn: async ({ pageParam = 1 }) => {
      if (!apiKey) {
        toast.error("Pixabay API key is missing. Please add it to .env");
        throw new Error("Missing API Key");
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
    enabled: !!apiKey, // Only run if API key is present
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

export interface IconifySearchResponse {
  icons: string[];
  total: number;
  limit: number;
  start: number;
  collections?: Record<string, { palette?: boolean }>;
}

export interface IconifyCollectionResponse {
  prefix: string;
  total: number;
  categories?: Record<string, string[]>;
}

const ICONIFY_API_URL = 'https://api.iconify.design';
const BATCH_SIZE = 48;

// Fixed curated list of popular graphics to show immediately as 'Featured'
const CURATED_DEFAULT_GRAPHICS = [
  'material-symbols:home', 'material-symbols:search', 'fluent-color:calendar-checkmark-20',
  'material-symbols:favorite', 'material-symbols:account-circle', 'material-symbols:shopping-cart',
  'material-symbols:star', 'fluent-color:clock-alarm-20', 'material-symbols:info',
  'material-symbols:check-circle', 'material-symbols:cancel', 'material-symbols:add',
  'material-symbols:close', 'material-symbols:menu', 'material-symbols:more-vert',
  'material-symbols:notifications', 'material-symbols:mail', 'material-symbols:call',
  'material-symbols:location-on', 'material-symbols:calendar-today', 'material-symbols:edit',
  'material-symbols:delete', 'material-symbols:download', 'material-symbols:upload',
  'material-symbols:lock', 'material-symbols:visibility', 'material-symbols:visibility-off',
  'material-symbols:thumb-up', 'material-symbols:thumb-down', 'material-symbols:attach-file',
  'material-symbols:cloud', 'material-symbols:image', 'material-symbols:photo-camera',
  'material-symbols:videocam', 'material-symbols:mic', 'material-symbols:headset-mic',
  'material-symbols:play-arrow', 'material-symbols:pause', 'material-symbols:stop',
  'material-symbols:done-all'
];

/**
 * A custom hook to fetch icons from Iconify using TanStack Query.
 * Handles both the default state (curated + material symbols) and searches.
 * Simulates infinite scroll by slicing the full list of icons.
 */
export function useIconsQuery(query: string) {
  return useInfiniteQuery<{
    icons: string[];
    collectionsMetadata: Record<string, { palette?: boolean }>;
    totalResults: number;
  }>({
    queryKey: ['icons', query],
    queryFn: async ({ pageParam = 1 }) => {
      const pageIndex = (pageParam as number) - 1;
      const start = pageIndex * BATCH_SIZE;

      try {
        if (!query.trim()) {
          // DEFAULT STATE: Fetch material symbols collection and prepend curated list
          const response = await axios.get<IconifyCollectionResponse>(`${ICONIFY_API_URL}/collection?prefix=material-symbols`);
          const categories = response.data.categories || {};
          const fullList: string[] = [];
          Object.values(categories).forEach((icons) => {
            if (Array.isArray(icons)) icons.forEach(n => fullList.push(`material-symbols:${n}`));
          });

          const curatedSet = new Set(CURATED_DEFAULT_GRAPHICS);
          const extendedList = [...CURATED_DEFAULT_GRAPHICS, ...fullList.filter(graphic => !curatedSet.has(graphic))];

          const initialPage = extendedList.slice(start, start + BATCH_SIZE);
          
          return {
            icons: initialPage,
            collectionsMetadata: { 
              'material-symbols': { palette: false },
              'fluent-color': { palette: true },
              'flat-color-icons': { palette: true },
              'logos': { palette: true }
            },
            totalResults: extendedList.length,
            _fullList: extendedList 
          };
        } else {
          // SEARCH STATE: Fetch results (limit 999 is standard search behavior)
          const response = await axios.get<IconifySearchResponse>(`${ICONIFY_API_URL}/search`, {
            params: { query: query.trim(), limit: 999 }
          });
          const results = response.data.icons || [];
          
          const initialPage = results.slice(start, start + BATCH_SIZE);
          
          return {
            icons: initialPage,
            collectionsMetadata: response.data.collections || {},
            totalResults: results.length,
            _fullList: results
          };
        }
      } catch (error) {
        console.error('Error fetching icons:', error);
        toast.error('Failed to load icons');
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      const totalLoaded = allPages.length * BATCH_SIZE;
      return totalLoaded < lastPage.totalResults ? nextPage : undefined;
    },
    // Since we fetch the full list in the first queryFn execution for Iconify,
    // we override the subsequent queryFn behavior or just use the same logic (it will be cached anyway)
    // Actually, TanStack Query executes the queryFn for each page. To avoid re-fetching, we can optimize.
    // For now, let's keep it simple as Axios/Iconify API is very fast and caching will help.
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

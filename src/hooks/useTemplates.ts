import { useCallback } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { getDefaultTemplateSource } from '@sabi-canvas/lib/templates/sabiCanvasTemplateSource';
import type {
  TemplateDesign,
  TemplateFilterState,
  TemplateSource,
} from '@sabi-canvas/types/design-templates';

const DEFAULT_PAGE_SIZE = 20;
const DESIGN_STALE_TIME = 5 * 60 * 1000;

/** Retries network and server failures, but not refusals (4xx) such as a missing plan or a bad key. */
const retryUnlessRefused = (failureCount: number, error: unknown) => {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return false;
  return failureCount < 2;
};

export const templateQueryKeys = {
  all: (source: TemplateSource) => ['sabi-canvas', 'templates', source.id] as const,
  list: (source: TemplateSource, state: TemplateFilterState, pageSize: number) =>
    [...templateQueryKeys.all(source), 'list', state, pageSize] as const,
  filters: (source: TemplateSource, state: TemplateFilterState) =>
    [...templateQueryKeys.all(source), 'filters', state] as const,
  design: (source: TemplateSource, id: string) => [...templateQueryKeys.all(source), 'design', id] as const,
};

/** The template source in use: `config.templates.source`, or the Sabi Canvas API with `config.sabiCanvasApiKey`. */
export function useTemplateSource(): TemplateSource {
  const { templates, sabiCanvasApiKey } = useSabiCanvasConfig();
  return templates?.source ?? getDefaultTemplateSource(sabiCanvasApiKey);
}

/** Templates for the chosen search, filters and order, a page at a time. */
export function useTemplateList(state: TemplateFilterState, options: { pageSize?: number; enabled?: boolean } = {}) {
  const source = useTemplateSource();
  const { templates } = useSabiCanvasConfig();
  const pageSize = options.pageSize ?? templates?.pageSize ?? DEFAULT_PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: templateQueryKeys.list(source, state, pageSize),
    queryFn: ({ pageParam, signal }) => source.list({ ...state, page: pageParam, limit: pageSize }, { signal }),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    placeholderData: keepPreviousData,
    retry: retryUnlessRefused,
    enabled: options.enabled ?? true,
  });
}

/** The filters and sort orders the source offers for the current choices. Idle when the source has none. */
export function useTemplateFilters(state: TemplateFilterState, options: { enabled?: boolean } = {}) {
  const source = useTemplateSource();
  const hasFilters = typeof source.filters === 'function';

  return useQuery({
    queryKey: templateQueryKeys.filters(source, state),
    queryFn: ({ signal }) => source.filters!(state, { signal }),
    placeholderData: keepPreviousData,
    retry: retryUnlessRefused,
    enabled: hasFilters && (options.enabled ?? true),
  });
}

/** Returns a function that fetches a template's design, cached for a few minutes. */
export function useTemplateDesignLoader(): (id: string) => Promise<TemplateDesign> {
  const source = useTemplateSource();
  const queryClient = useQueryClient();

  return useCallback(
    (id: string) =>
      queryClient.fetchQuery({
        queryKey: templateQueryKeys.design(source, id),
        queryFn: ({ signal }) => source.getDesign(id, { signal }),
        staleTime: DESIGN_STALE_TIME,
        retry: retryUnlessRefused,
      }),
    [queryClient, source],
  );
}

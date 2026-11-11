import type {
  TemplateDesign,
  TemplateFilterGroup,
  TemplateFilterState,
  TemplateFilters,
  TemplatePageContent,
  TemplateSource,
  TemplateSummary,
} from '@sabi-canvas/types/design-templates';
import type { CustomFont } from '@sabi-canvas/types/custom-fonts';

/**
 * The free Sabi Canvas templates API. Listing and free designs need no key;
 * paid designs need a Sabi Canvas API key whose plan includes them.
 */
export const SABI_CANVAS_TEMPLATES_URL = 'https://api.sabiflow.com/api/canvas-pro/api/v1/sabicanvas';

export interface SabiCanvasTemplateSourceOptions {
  /**
   * Your Sabi Canvas API key (`cpk_…`), from your account on the Sabi Canvas
   * website. Optional: without it every template is listed and free ones open;
   * with it, the designs your plan includes open too.
   */
  apiKey?: string;
  /**
   * The API address. Defaults to the free Sabi Canvas templates. A Canvas Pro
   * business's address (`…/canvas-pro/api/v1/<business-slug>`) lists that
   * business's templates instead.
   */
  baseUrl?: string;
  /** Replaces `fetch`, e.g. for server rendering or tests. */
  fetch?: typeof fetch;
}

/** A failed request to the templates API. `message` is the API's own explanation. */
export class SabiCanvasApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SabiCanvasApiError';
    this.status = status;
  }
}

// What the API sends. See https://sabicanvas.sabiflow.shop/developers
interface ApiTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** The main category. */
  category: { slug: string; name: string; image: string | null } | null;
  /** Every category, the main one first. Missing from replies before templates could have several. */
  categories?: { slug: string; name: string; image: string | null }[];
  plan: string;
  hasAccess: boolean;
  thumbnail: string | null;
  previewImages?: string[];
  tags?: string[];
  size?: { width: number; height: number };
  publishedAt?: string | null;
  updatedAt?: string | null;
}

interface ApiTemplateList {
  data: ApiTemplate[];
  total: number;
  page: number;
  totalPages: number;
}

interface ApiTemplateFilters {
  total: number;
  groups: TemplateFilterGroup[];
  sort?: { key: string; default?: string; options: { value: string; label: string }[] };
}

interface ApiTemplateContent extends ApiTemplate {
  content: { pages: TemplatePageContent[]; customFonts?: CustomFont[] };
}

const FREE_PLAN = 'free';
const DEFAULT_SIZE = 1080;

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** A short, stable fingerprint of a key, so caches stay apart without holding the key itself. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function toSummary(template: ApiTemplate): TemplateSummary {
  const locked = template.hasAccess === false;
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    thumbnail: template.thumbnail,
    width: template.size?.width || DEFAULT_SIZE,
    height: template.size?.height || DEFAULT_SIZE,
    category: template.category,
    categories: template.categories ?? (template.category ? [template.category] : []),
    tags: template.tags ?? [],
    hasAccess: template.hasAccess,
    badge: locked && template.plan && template.plan !== FREE_PLAN ? capitalise(template.plan) : undefined,
    meta: {
      plan: template.plan,
      previewImages: template.previewImages ?? [],
      publishedAt: template.publishedAt ?? null,
      updatedAt: template.updatedAt ?? null,
    },
  };
}

/**
 * A template source for the Sabi Canvas templates API. The editor uses one by
 * default, with `config.sabiCanvasApiKey` when it's set. Create one yourself
 * only to point at another business's templates.
 *
 * @example
 * <EditorLayout config={{ sabiCanvasApiKey: 'cpk_…' }} />
 */
export function createSabiCanvasTemplateSource(options: SabiCanvasTemplateSourceOptions = {}): TemplateSource {
  const baseUrl = (options.baseUrl ?? SABI_CANVAS_TEMPLATES_URL).replace(/\/+$/, '');
  const apiKey = options.apiKey?.trim() || undefined;
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  async function get<T>(path: string, params: URLSearchParams | undefined, signal?: AbortSignal): Promise<T> {
    const query = params && params.toString() ? `?${params}` : '';
    const response = await doFetch(`${baseUrl}${path}${query}`, { signal, headers });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = body && typeof body.message === 'string' ? body.message : `Templates request failed (${response.status})`;
      throw new SabiCanvasApiError(message, response.status);
    }
    return body as T;
  }

  function paramsFor(state: TemplateFilterState): URLSearchParams {
    const params = new URLSearchParams();
    const search = state.search.trim();
    if (search) params.set('search', search);
    for (const [key, values] of Object.entries(state.filters)) {
      if (values.length) params.set(key, values.join(','));
    }
    if (state.sort) params.set('sort', state.sort);
    return params;
  }

  return {
    id: `sabi-canvas:${baseUrl}:${apiKey ? `key-${fingerprint(apiKey)}` : 'guest'}`,

    async list(query, context) {
      const params = paramsFor(query);
      params.set('page', String(query.page));
      params.set('limit', String(query.limit));
      const result = await get<ApiTemplateList>('/templates', params, context?.signal);
      return {
        items: result.data.map(toSummary),
        hasMore: result.page < result.totalPages,
        total: result.total,
      };
    },

    async filters(state, context) {
      const result = await get<ApiTemplateFilters>('/templates/filters', paramsFor(state), context?.signal);
      const filters: TemplateFilters = { total: result.total, groups: result.groups };
      if (result.sort) filters.sort = { default: result.sort.default, options: result.sort.options };
      return filters;
    },

    pageSizeFilter: ({ width, height }) => ({ key: 'size', value: `${width}x${height}` }),

    async getDesign(id, context): Promise<TemplateDesign> {
      const result = await get<ApiTemplateContent>(`/templates/${encodeURIComponent(id)}/content`, undefined, context?.signal);
      return {
        ...toSummary(result),
        content: {
          pages: result.content?.pages ?? [],
          customFonts: result.content?.customFonts ?? [],
        },
      };
    },
  };
}

const defaultSources = new Map<string, TemplateSource>();

/**
 * The source the editor uses when `config.templates.source` isn't set: the
 * Sabi Canvas API, with your key when you pass one. One instance per key.
 */
export function getDefaultTemplateSource(apiKey?: string): TemplateSource {
  const key = apiKey?.trim() ?? '';
  let source = defaultSources.get(key);
  if (!source) {
    source = createSabiCanvasTemplateSource({ apiKey: key || undefined });
    defaultSources.set(key, source);
  }
  return source;
}

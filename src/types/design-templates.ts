import type { ComponentType } from 'react';
import type { CanvasObject } from './canvas-objects';
import type { CanvasBackground } from './pages';
import type { CustomFont } from './custom-fonts';

/**
 * Templates come from a `TemplateSource`. The editor ships one for the free
 * Sabi Canvas API (`createSabiCanvasTemplateSource`); pass your own through
 * `config.templates.source` to list templates from your backend instead. The
 * Templates panel shows whatever the source returns, filters included.
 */

/** A template as a gallery lists it, without its design. */
export interface TemplateSummary {
  /** Unique id, passed back to `TemplateSource.getDesign`. */
  id: string;
  /** Optional address-friendly name, e.g. `black-friday`. */
  slug?: string;
  name: string;
  description?: string | null;
  /** Picture shown in the gallery. Without one, the card shows the name. */
  thumbnail?: string | null;
  /** The design's size in pixels. Cards keep this shape. */
  width: number;
  height: number;
  category?: { slug: string; name: string; image?: string | null } | null;
  tags?: string[];
  /**
   * `false` shows the template with a lock. Picking it still asks the source
   * for the design, which decides; if that fails, `config.templates.onLockedTemplate`
   * is called. Default `true`.
   */
  hasAccess?: boolean;
  /** Short label shown on locked cards, e.g. `Pro`. */
  badge?: string;
  /** Anything else your source wants to carry, e.g. a price. */
  meta?: Record<string, unknown>;
}

/** One page of a template's design. */
export interface TemplatePageContent {
  id?: string;
  name?: string;
  size: { width: number; height: number };
  objects: CanvasObject[];
  background?: CanvasBackground;
}

/** A template's design: its pages, in order, and the uploaded fonts they use. */
export interface TemplateContent {
  pages: TemplatePageContent[];
  customFonts?: CustomFont[];
}

/** A template with its design, ready to apply to the canvas. */
export interface TemplateDesign extends TemplateSummary {
  content: TemplateContent;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface TemplateFilterOption {
  /** What goes in `TemplateFilterState.filters[group.key]`. */
  value: string;
  label: string;
  /** How many templates this choice finds. Shown next to the label. */
  count?: number;
  /** An icon or picture, e.g. for categories. */
  image?: string | null;
}

export interface TemplateFilterGroup {
  /** Key the chosen values go under in `TemplateFilterState.filters`. */
  key: string;
  label: string;
  /** `single` takes one value at a time, `multi` several. */
  type: 'single' | 'multi';
  /** Label for "no filter" in a `single` group, e.g. "All templates". */
  allLabel?: string;
  /** How many templates "no filter" finds. */
  allCount?: number;
  options: TemplateFilterOption[];
}

export interface TemplateSortOption {
  value: string;
  label: string;
}

export interface TemplateSorting {
  /** The order used when none is chosen. */
  default?: string;
  options: TemplateSortOption[];
}

/** What the Templates panel offers to filter and sort by. */
export interface TemplateFilters {
  /** How many templates the current search and choices find. */
  total?: number;
  groups: TemplateFilterGroup[];
  sort?: TemplateSorting;
}

/** The search, filters and order someone has chosen in the panel. */
export interface TemplateFilterState {
  search: string;
  /** Chosen values by group key. A `single` group has at most one. */
  filters: Record<string, string[]>;
  /** A `TemplateSortOption.value`, or undefined for the source's default. */
  sort?: string;
}

export interface TemplateListQuery extends TemplateFilterState {
  /** From 1. */
  page: number;
  limit: number;
}

export interface TemplateListResult {
  items: TemplateSummary[];
  /** Whether another page follows. */
  hasMore: boolean;
  total?: number;
}

// ─── Source ───────────────────────────────────────────────────────────────────

export interface TemplateRequestContext {
  /** Aborted when the panel no longer needs the reply. */
  signal?: AbortSignal;
}

/** Where templates come from. Implement it to serve templates from your own backend. */
export interface TemplateSource {
  /**
   * Names this source in the editor's cache. Use a different id for each
   * distinct set of templates, e.g. `my-api:${businessId}`.
   */
  id: string;
  /** One page of templates for the chosen search, filters and order. */
  list(query: TemplateListQuery, context?: TemplateRequestContext): Promise<TemplateListResult>;
  /**
   * The filter groups and sort orders to offer for the current choices. Omit it
   * to offer search only.
   */
  filters?(state: TemplateFilterState, context?: TemplateRequestContext): Promise<TemplateFilters>;
  /**
   * How to filter by the page's size: the filter group `key` and the option
   * `value` for a size. When set, the panel starts filtered to the page's size
   * until someone picks another size or none. Omit it to start unfiltered.
   */
  pageSizeFilter?(size: { width: number; height: number }): { key: string; value: string };
  /** A template's design, by the `id` from `list` or the editor's `templateId` prop. */
  getDesign(id: string, context?: TemplateRequestContext): Promise<TemplateDesign>;
}

// ─── Editor config ────────────────────────────────────────────────────────────

/** Props every Templates panel receives, including a replacement passed as `config.templates.panel`. */
export interface TemplatesPanelProps {
  /** Closes the panel, e.g. after a template is applied. */
  onClose: () => void;
}

/** `config.templates` on `<EditorLayout>` or `<SabiCanvasProvider>`. */
export interface SabiCanvasTemplatesConfig {
  /**
   * Where templates come from. Defaults to the Sabi Canvas API, using
   * `config.sabiCanvasApiKey` when it's set.
   */
  source?: TemplateSource;
  /**
   * Replaces the Templates panel. It renders inside the editor, so it can use
   * `useTemplateSource`, `useTemplateList`, `useTemplateFilters` and
   * `useApplyTemplate`.
   */
  panel?: ComponentType<TemplatesPanelProps>;
  /** Templates per request. Default 20. */
  pageSize?: number;
  /**
   * Called when a locked template (`hasAccess: false`) can't be opened, e.g. to
   * offer an upgrade. Without it, the panel shows a dialog saying which plan it needs.
   */
  onLockedTemplate?: (template: TemplateSummary, error: unknown) => void;
  /** Called after a template is applied to the canvas. */
  onTemplateApplied?: (design: TemplateDesign) => void;
}

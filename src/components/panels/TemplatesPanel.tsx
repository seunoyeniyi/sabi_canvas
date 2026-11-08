import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, LayoutTemplate, Loader2, Lock, Search, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@sabi-canvas/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@sabi-canvas/ui/popover';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { useDebounce } from '@sabi-canvas/hooks/use-debounce';
import { useApplyTemplate } from '@sabi-canvas/hooks/useApplyTemplate';
import { useTemplateDesignLoader, useTemplateFilters, useTemplateList, useTemplateSource } from '@sabi-canvas/hooks/useTemplates';
import { cn } from '@sabi-canvas/lib/utils';
import { TemplateLockedDialog, useTemplateLockedDialog } from '@sabi-canvas/components/shared/TemplateLockedDialog';
import type {
  TemplateFilterGroup,
  TemplateFilterOption,
  TemplateFilterState,
  TemplateSorting,
  TemplateSummary,
  TemplatesPanelProps,
} from '@sabi-canvas/types/design-templates';

type ChosenFilters = TemplateFilterState['filters'];

const SKELETON_HEIGHTS = ['h-40', 'h-28', 'h-32', 'h-44', 'h-28', 'h-36'];

/** Nothing searched or chosen: the source's full set of filters. */
const NO_CHOICES: TemplateFilterState = { search: '', filters: {} };

/**
 * Every filter group and option the source has offered, in the order of its
 * full set, with counts from the reply for the current choices. Sources often
 * leave out groups and options the current choices rule out; here they stay,
 * so a choice can always be changed. An option missing from a group the
 * current reply does have finds nothing (count 0); when the whole group is
 * missing, its counts aren't known.
 */
function mergeFilterGroups(known: TemplateFilterGroup[][], current: TemplateFilterGroup[] | undefined): TemplateFilterGroup[] {
    const byKey = new Map<string, TemplateFilterGroup>();
    for (const groups of known) {
        for (const group of groups) {
            const seen = byKey.get(group.key);
            if (!seen) {
                byKey.set(group.key, { ...group, options: [...group.options] });
                continue;
            }
            const values = new Set(seen.options.map((option) => option.value));
            seen.options.push(...group.options.filter((option) => !values.has(option.value)));
        }
    }

    const currentByKey = new Map((current ?? []).map((group) => [group.key, group]));
    return [...byKey.values()].map((group) => {
        const live = currentByKey.get(group.key);
        const liveOptions = new Map(live?.options.map((option) => [option.value, option]));
        const counted = live?.options.some((option) => option.count !== undefined) ?? false;
        return {
            ...group,
            ...live,
            options: group.options.map((option) => {
                const liveOption = liveOptions.get(option.value);
                return { ...option, ...liveOption, count: live ? (liveOption?.count ?? (counted ? 0 : undefined)) : undefined };
            }),
        };
    });
}

/**
 * Lists templates from the configured source (the free Sabi Canvas API by
 * default) with the filters and sort orders that source offers. Every group
 * is under Filters; the first single-choice group is also offered as chips.
 */
export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ onClose }) => {
    const { templates: templatesConfig } = useSabiCanvasConfig();
    const { editorMode, isMockupEnabled, canvasSize } = useEditor();
    const isCustomerMode = isMockupEnabled && editorMode === 'customer';
    const source = useTemplateSource();

    const [search, setSearch] = useState('');
    const [chosen, setChosen] = useState<ChosenFilters>({});
    const [sort, setSort] = useState<string | undefined>(undefined);
    const debouncedSearch = useDebounce(search, 400);

    // Start filtered to the page's size, and follow it if the page is resized,
    // until someone picks a size themselves (or none). Not in customer mode:
    // there, templates are scaled into the print area whatever their size.
    const pageWidth = Math.round(canvasSize.width);
    const pageHeight = Math.round(canvasSize.height);
    const pageSize = useMemo(
        () => (isCustomerMode ? undefined : source.pageSizeFilter?.({ width: pageWidth, height: pageHeight })),
        [isCustomerMode, source, pageWidth, pageHeight],
    );
    const [pageSizeTouched, setPageSizeTouched] = useState(false);
    const pageSizeApplied = Boolean(pageSize) && !pageSizeTouched;
    const filters = useMemo<ChosenFilters>(
        () => (pageSize && !pageSizeTouched ? { ...chosen, [pageSize.key]: [pageSize.value] } : chosen),
        [chosen, pageSize, pageSizeTouched],
    );

    const state = useMemo<TemplateFilterState>(
        () => ({ search: debouncedSearch.trim(), filters, sort }),
        [debouncedSearch, filters, sort],
    );

    const list = useTemplateList(state);
    const filterQuery = useTemplateFilters(state);
    const allFiltersQuery = useTemplateFilters(NO_CHOICES);
    const loadDesign = useTemplateDesignLoader();
    const applyTemplate = useApplyTemplate();
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const lockedDialog = useTemplateLockedDialog();

    // No filter section is ever hidden: groups and options from the full set,
    // and from any reply seen while the panel is open, stay on screen.
    // Wait for the full set so the sections (and the chip row) don't reorder.
    const seenGroups = useRef<TemplateFilterGroup[]>([]);
    const allFiltersSettled = !allFiltersQuery.isPending || allFiltersQuery.fetchStatus === 'idle';
    const groups = useMemo(() => {
        if (!allFiltersSettled) return [];
        const merged = mergeFilterGroups(
            [allFiltersQuery.data?.groups ?? [], filterQuery.data?.groups ?? [], seenGroups.current],
            filterQuery.data?.groups,
        );
        seenGroups.current = merged;
        return merged.filter((group) => group.options.length > 0);
    }, [allFiltersSettled, allFiltersQuery.data, filterQuery.data]);
    // The first single-choice group is also offered as chips; every group, that
    // one included, is listed under Filters.
    const chipGroup = groups.find((group) => group.type === 'single');
    const sorting = filterQuery.data?.sort ?? allFiltersQuery.data?.sort;
    const hasFilterMenu = groups.length > 0 || (sorting?.options.length ?? 0) > 1;

    const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
    const chosenCount = groups.reduce((sum, group) => sum + (filters[group.key]?.length ?? 0), 0);
    const isFiltered = Boolean(state.search) || Object.values(filters).some((values) => values.length > 0);

    const pageSizeKey = pageSize?.key;
    const setGroupValues = useCallback((key: string, values: string[]) => {
        if (key === pageSizeKey) setPageSizeTouched(true);
        setChosen((prev) => {
            const next = { ...prev };
            if (values.length) next[key] = values;
            else delete next[key];
            return next;
        });
    }, [pageSizeKey]);

    const clearAll = () => {
        setSearch('');
        setChosen({});
        setSort(undefined);
        setPageSizeTouched(true);
    };

    // Nothing in the page's size, and nothing else narrowing the list.
    const onlyPageSize = pageSizeApplied && !state.search
        && Object.entries(filters).every(([key, values]) => key === pageSizeKey || values.length === 0);

    // Locked templates are still asked for: the source decides, so a plan
    // upgraded since the list loaded works straight away.
    const handlePick = async (template: TemplateSummary) => {
        if (applyingId) return;
        setApplyingId(template.id);
        try {
            const design = await loadDesign(template.id);
            const result = applyTemplate(design);
            if (!result.success) {
                toast.error(result.error ?? 'This template couldn’t be opened.');
                return;
            }
            onClose();
        } catch (error) {
            const status = statusOf(error);
            if (status === 401 || status === 403 || (template.hasAccess === false && isRefusal(error))) {
                if (templatesConfig?.onLockedTemplate) templatesConfig.onLockedTemplate(template, error);
                else lockedDialog.show(template.badge);
                return;
            }
            toast.error(errorMessage(error) ?? 'This template couldn’t be opened. Check your connection and try again.');
        } finally {
            setApplyingId(null);
        }
    };

    // Load the next page when the end of the list scrolls into view.
    const { fetchNextPage, hasNextPage, isFetchingNextPage } = list;
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasNextPage) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
        }, { rootMargin: '200px' });
        observer.observe(node);
        return () => observer.disconnect();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, items.length]);

    const isFirstLoad = list.isPending;
    const isUpdating = list.isPlaceholderData && list.isFetching;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 pb-2 space-y-2">
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search templates"
                            aria-label="Search templates"
                            className="h-8 pl-8 pr-2 text-xs md:text-xs rounded-md bg-muted/20 border-border/60 focus-visible:ring-offset-0"
                        />
                    </div>
                    {hasFilterMenu && (
                        <FiltersPopover
                            groups={groups}
                            sorting={sorting}
                            filters={filters}
                            sort={sort}
                            chosenCount={chosenCount}
                            onGroupChange={setGroupValues}
                            onSortChange={setSort}
                            onClear={clearAll}
                        />
                    )}
                </div>

                {chipGroup && (
                    <ChipRow
                        group={chipGroup}
                        value={filters[chipGroup.key]?.[0]}
                        onChange={(value) => setGroupValues(chipGroup.key, value ? [value] : [])}
                    />
                )}

                {isCustomerMode && (
                    <p className="text-[11px] text-muted-foreground leading-none">
                        Templates will be scaled into your print area
                    </p>
                )}
            </div>

            <ScrollArea className="flex-1 pr-1">
                {isFirstLoad ? (
                    <div className="columns-2 gap-1 pb-2" aria-hidden>
                        {SKELETON_HEIGHTS.map((height, i) => (
                            <div key={i} className="mb-1 break-inside-avoid">
                                <Skeleton className={cn('w-full rounded-md', height)} />
                            </div>
                        ))}
                    </div>
                ) : list.isError && items.length === 0 ? (
                    <EmptyState
                        title="Templates couldn’t load"
                        detail={errorMessage(list.error) ?? 'Check your connection and try again.'}
                        action={{ label: 'Try again', onClick: () => void list.refetch() }}
                    />
                ) : items.length === 0 && onlyPageSize ? (
                    <EmptyState
                        title="No templates in this size"
                        detail={`None match your page size, ${pageWidth} × ${pageHeight}.`}
                        action={{ label: 'Show all sizes', onClick: () => setGroupValues(pageSizeKey!, []) }}
                    />
                ) : items.length === 0 ? (
                    <EmptyState
                        title="No templates found"
                        detail={isFiltered ? 'Try another search or fewer filters.' : 'New templates will show up here.'}
                        action={isFiltered ? { label: 'Clear filters', onClick: clearAll } : undefined}
                    />
                ) : (
                    <>
                        <div
                            className={cn('columns-2 gap-1 pb-2 transition-opacity', isUpdating && 'opacity-60')}
                            aria-busy={isUpdating}
                        >
                            {items.map((template) => (
                                <div key={template.id} className="mb-1 break-inside-avoid">
                                    <TemplateCard
                                        template={template}
                                        isApplying={applyingId === template.id}
                                        disabled={applyingId !== null && applyingId !== template.id}
                                        onClick={() => void handlePick(template)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div ref={sentinelRef} className="h-px w-full" />
                        {isFetchingNextPage && (
                            <div className="py-3 flex justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </>
                )}
            </ScrollArea>

            <TemplateLockedDialog open={lockedDialog.open} plan={lockedDialog.plan} onOpenChange={lockedDialog.onOpenChange} />
        </div>
    );
};

/** HTTP status a source attached to its error, if any. */
const statusOf = (error: unknown): number | undefined => {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === 'number' ? status : undefined;
};

/**
 * The source refused the request (e.g. no key, or a plan that doesn't include
 * it), as opposed to a network failure, which `fetch` reports as a TypeError.
 */
const isRefusal = (error: unknown) => {
    const status = statusOf(error);
    if (status !== undefined) return status >= 400 && status < 500;
    return !(error instanceof TypeError) && !(error instanceof DOMException && error.name === 'AbortError');
};

/** A message worth showing: the API's own explanation, not a browser's network error. */
const errorMessage = (error: unknown): string | undefined =>
    statusOf(error) !== undefined && error instanceof Error && error.message ? error.message : undefined;

// ─── Parts ────────────────────────────────────────────────────────────────────

const chipClass = (active: boolean) =>
    cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
        active
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border',
    );

const OptionImage: React.FC<{ option: TemplateFilterOption }> = ({ option }) =>
    option.image ? <img src={option.image} alt="" className="h-3.5 w-3.5 object-contain" /> : null;

const ChipRow: React.FC<{
    group: TemplateFilterGroup;
    value: string | undefined;
    onChange: (value: string | null) => void;
}> = ({ group, value, onChange }) => (
    <div className="w-full overflow-x-auto pb-1 hide-scrollbar scroll-smooth" role="group" aria-label={group.label}>
        <div className="flex items-center gap-1.5 pr-2 min-w-max">
            <button type="button" aria-pressed={!value} onClick={() => onChange(null)} className={chipClass(!value)}>
                {group.allLabel ?? 'All'}
            </button>
            {group.options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => onChange(value === option.value ? null : option.value)}
                    className={chipClass(value === option.value)}
                >
                    <OptionImage option={option} />
                    {option.label}
                </button>
            ))}
        </div>
    </div>
);

const FiltersPopover: React.FC<{
    groups: TemplateFilterGroup[];
    sorting: TemplateSorting | undefined;
    filters: ChosenFilters;
    sort: string | undefined;
    chosenCount: number;
    onGroupChange: (key: string, values: string[]) => void;
    onSortChange: (value: string | undefined) => void;
    onClear: () => void;
}> = ({ groups, sorting, filters, sort, chosenCount, onGroupChange, onSortChange, onClear }) => {
    const activeSort = sort ?? sorting?.default;
    // Picking anything applies it and closes the menu.
    const [open, setOpen] = useState(false);
    const pick = (apply: () => void) => {
        apply();
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={chosenCount ? `Filters, ${chosenCount} chosen` : 'Filters'}
                    className={cn(
                        'relative shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors cursor-pointer',
                        chosenCount
                            ? 'border-primary text-primary bg-primary/5'
                            : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border',
                    )}
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {chosenCount > 0 && (
                        <span className="absolute top-0.5 right-0.5 min-w-3 h-3 px-0.5 flex flex-col items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] leading-4 text-center">
                            {chosenCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                collisionPadding={12}
                className="w-64 p-0 flex flex-col max-h-(--radix-popover-content-available-height)"
            >
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
                    {groups.map((group) => {
                        const chosen = filters[group.key] ?? [];
                        const choose = (value: string) => pick(() => {
                            if (group.type === 'multi') {
                                onGroupChange(group.key, chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value]);
                            } else {
                                onGroupChange(group.key, chosen[0] === value ? [] : [value]);
                            }
                        });
                        return (
                            <fieldset key={group.key} className="space-y-1.5">
                                <legend className="text-[11px] font-medium text-foreground mb-1.5">{group.label}</legend>
                                <div className="flex flex-wrap gap-1.5">
                                    {group.type === 'single' && (
                                        <button
                                            type="button"
                                            aria-pressed={chosen.length === 0}
                                            onClick={() => pick(() => onGroupChange(group.key, []))}
                                            className={chipClass(chosen.length === 0)}
                                        >
                                            {group.allLabel ?? 'Any'}
                                        </button>
                                    )}
                                    {group.options.map((option) => {
                                        const active = chosen.includes(option.value);
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => choose(option.value)}
                                                className={cn(chipClass(active), !active && option.count === 0 && 'opacity-60')}
                                            >
                                                {group.type === 'multi' && active && <Check className="h-3 w-3" />}
                                                <OptionImage option={option} />
                                                {option.label}
                                                {option.count !== undefined && (
                                                    <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>{option.count}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>
                        );
                    })}

                    {sorting && sorting.options.length > 1 && (
                        <fieldset className="space-y-1.5">
                            <legend className="text-[11px] font-medium text-foreground mb-1.5">Sort by</legend>
                            <div className="flex flex-wrap gap-1.5">
                                {sorting.options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={activeSort === option.value}
                                        onClick={() => pick(() => onSortChange(option.value === sorting.default ? undefined : option.value))}
                                        className={chipClass(activeSort === option.value)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                    )}
                </div>
                <div className="shrink-0 border-t border-border/60 px-3 py-2 flex justify-end">
                    <button
                        type="button"
                        onClick={() => pick(onClear)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        Clear all
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
};

const TemplateCard: React.FC<{
    template: TemplateSummary;
    isApplying: boolean;
    disabled: boolean;
    onClick: () => void;
}> = ({ template, isApplying, disabled, onClick }) => {
    const locked = template.hasAccess === false;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={locked ? `${template.name} (locked)` : template.name}
            aria-busy={isApplying}
            title={template.name}
            className="group relative block w-full overflow-hidden rounded-md border border-border/60 hover:border-primary/60 transition-all hover:shadow-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:cursor-wait"
        >
            <div style={{ aspectRatio: `${template.width} / ${template.height}` }} className="w-full relative bg-muted/30">
                {template.thumbnail ? (
                    <img
                        src={template.thumbnail}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-muted/80 to-muted/30">
                        <span className="text-[11px] font-medium text-center text-foreground/70 leading-tight px-2">
                            {template.name}
                        </span>
                    </div>
                )}

                {locked && (
                    <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-xs">
                        <Lock className="h-2.5 w-2.5" />
                        {template.badge}
                    </span>
                )}

                {isApplying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                    </div>
                )}
            </div>
        </button>
    );
};

const EmptyState: React.FC<{
    title: string;
    detail: string;
    action?: { label: string; onClick: () => void };
}> = ({ title, detail, action }) => (
    <div className="flex flex-col items-center justify-center text-center py-10 px-3 gap-2">
        <LayoutTemplate className="h-7 w-7 text-muted-foreground/50" />
        <div className="space-y-0.5">
            <p className="text-xs font-medium text-foreground/80">{title}</p>
            <p className="text-[11px] text-muted-foreground">{detail}</p>
        </div>
        {action && (
            <button
                type="button"
                onClick={action.onClick}
                className="mt-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
            >
                {action.label}
            </button>
        )}
    </div>
);

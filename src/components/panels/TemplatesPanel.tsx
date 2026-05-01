import React, { useState } from 'react';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { DESIGN_TEMPLATES, TEMPLATE_CATEGORIES, TemplateCategoryItem } from '@sabi-canvas/design-templates';
import { DesignTemplate } from '@sabi-canvas/types/design-templates';
import { preloadFonts } from '@sabi-canvas/lib/fontLoader';
import { cn } from '@sabi-canvas/lib/utils';
import { DEFAULT_BACKGROUND } from '@sabi-canvas/types/pages';
import { CanvasObject, GroupObject, PrintAreaObject, TextObject, generateObjectId } from '@sabi-canvas/types/canvas-objects';

interface TemplatesPanelProps {
    onClose: () => void;
}

/** Scale a template's objects into a print area without replacing the page. */
function scaleTemplateIntoPrintArea(template: DesignTemplate, printArea: PrintAreaObject): CanvasObject[] {
    const s = Math.min(
        printArea.width / template.canvasWidth,
        printArea.height / template.canvasHeight,
    );
    const scaledW = template.canvasWidth * s;
    const scaledH = template.canvasHeight * s;
    const offsetX = printArea.x + (printArea.width - scaledW) / 2;
    const offsetY = printArea.y + (printArea.height - scaledH) / 2;

    const sourceObjects = template.objects.filter((o) => o.type !== 'print-area');

    // Build id remap so parent/children references stay intact
    const idRemap = new Map<string, string>();
    sourceObjects.forEach((o) => idRemap.set(o.id, generateObjectId()));

    return sourceObjects.map((obj) => {
        const newId = idRemap.get(obj.id)!;
        const newParentId = obj.parentId ? (idRemap.get(obj.parentId) ?? obj.parentId) : undefined;

        const base: CanvasObject = {
            ...obj,
            id: newId,
            parentId: newParentId,
            x: offsetX + obj.x * s,
            y: offsetY + obj.y * s,
            width: obj.width * s,
            height: obj.height * s,
            objectRole: 'customer' as const,
            // Scale stroke on shapes
            ...('strokeWidth' in obj && typeof (obj as { strokeWidth?: unknown }).strokeWidth === 'number'
                ? { strokeWidth: (obj as { strokeWidth: number }).strokeWidth * s }
                : {}),
            // Scale shadow offsets/blur
            ...(obj.shadowOffsetX !== undefined ? { shadowOffsetX: obj.shadowOffsetX * s } : {}),
            ...(obj.shadowOffsetY !== undefined ? { shadowOffsetY: obj.shadowOffsetY * s } : {}),
            ...(obj.shadowBlur !== undefined ? { shadowBlur: obj.shadowBlur * s } : {}),
        };

        // Text-specific scaling
        if (obj.type === 'text') {
            const t = obj as TextObject;
            const scaled: Partial<TextObject> = {
                fontSize: t.fontSize * s,
                ...(t.textStrokeWidth !== undefined ? { textStrokeWidth: t.textStrokeWidth * s } : {}),
                ...(t.textBgPadding !== undefined ? { textBgPadding: t.textBgPadding * s } : {}),
                ...(t.textBgCornerRadius !== undefined ? { textBgCornerRadius: t.textBgCornerRadius * s } : {}),
                ...(t.letterSpacing !== undefined ? { letterSpacing: t.letterSpacing * s } : {}),
            };
            Object.assign(base, scaled);
        }

        // Group: remap childrenIds
        if (obj.type === 'group') {
            const g = obj as GroupObject;
            (base as GroupObject).childrenIds = g.childrenIds.map((id) => idRemap.get(id) ?? id);
        }

        return base;
    });
}

export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ onClose }) => {
    const [category, setCategory] = useState<TemplateCategoryItem['id']>('all');
    const [sameSize, setSameSize] = useState(true);
    const { importActivePageJson, updatePageBackground, updateActivePageSize, objects, addObjects } = useCanvasObjects();
    const { canvasSize, editorMode, isMockupEnabled } = useEditor();

    const isCustomerMode = isMockupEnabled && editorMode === 'customer';

    const filtered = DESIGN_TEMPLATES.filter((t) => {
        if (category !== 'all' && t.category !== category) return false;
        // In customer mode all templates are usable regardless of page size
        if (!isCustomerMode && sameSize && (t.canvasWidth !== canvasSize.width || t.canvasHeight !== canvasSize.height)) return false;
        return true;
    });

    const handleApply = (template: DesignTemplate) => {
        // In customer mode with a print area: scale objects into the print area, don't replace the page
        const printArea = isCustomerMode
            ? (objects.find((o) => o.type === 'print-area') as PrintAreaObject | undefined)
            : undefined;

        if (printArea) {
            const newObjects = scaleTemplateIntoPrintArea(template, printArea);
            addObjects(newObjects);
        } else {
            updateActivePageSize(template.canvasWidth, template.canvasHeight);
            updatePageBackground(template.background ?? DEFAULT_BACKGROUND);
            importActivePageJson(template);
        }

        // Preload fonts referenced by text objects in the template
        const fontFamilies = template.objects
            .filter(
                (obj): obj is (typeof obj) & { fontFamily: string } =>
                    typeof obj === 'object' &&
                    obj !== null &&
                    (obj as { type: string }).type === 'text' &&
                    typeof (obj as { fontFamily?: unknown }).fontFamily === 'string'
            )
            .map((obj) => obj.fontFamily);

        if (fontFamilies.length > 0) {
            const unique = [...new Set(fontFamilies)];
            void preloadFonts(unique, { maxFonts: unique.length, concurrency: 4 });
        }

        onClose();
    };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Category pills — sticky, never scrolls away */}
            <div className="flex-shrink-0 pb-2 space-y-2">
                <div className="w-full overflow-x-auto pb-1">
                    <div className="flex items-center gap-1.5 pr-2 min-w-max">
                        {TEMPLATE_CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategory(cat.id)}
                                className={cn(
                                    'px-2 py-1 rounded-full border text-[11px] whitespace-nowrap transition-colors',
                                    category === cat.id
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Same-size toggle — hidden in customer mode since templates always scale to print area */}
                {isCustomerMode ? (
                    <p className="text-[11px] text-muted-foreground leading-none">
                        Templates will be scaled into your print area
                    </p>
                ) : (
                    <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                        <span
                            className={cn(
                                'relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border transition-colors',
                                sameSize ? 'bg-primary border-primary' : 'bg-muted border-border/60'
                            )}
                            onClick={() => setSameSize(v => !v)}
                        >
                            <span
                                className={cn(
                                    'absolute top-[1px] h-3 w-3 rounded-full bg-white shadow transition-transform',
                                    sameSize ? 'translate-x-3.5' : 'translate-x-0.5'
                                )}
                            />
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-none">
                            Match page size ({canvasSize.width} × {canvasSize.height})
                        </span>
                    </label>
                )}
            </div>

            <ScrollArea className="flex-1 pr-1">
                {filtered.length > 0 ? (
                    <div className="columns-2 gap-1 pb-2">
                        {filtered.map((template, idx) => (
                            <div key={`${template.name}-${idx}`} className="break-inside-avoid">
                                <TemplateCard
                                    template={template}
                                    onClick={() => handleApply(template)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px] text-muted-foreground text-center py-8">
                        {!isCustomerMode && sameSize
                            ? 'No templates match your page size. Try turning off "Match page size".'
                            : 'No templates in this category yet.'}
                    </p>
                )}
            </ScrollArea>
        </div>
    );
};

const TemplateCard: React.FC<{ template: DesignTemplate; onClick: () => void }> = ({
    template,
    onClick,
}) => {
    return (
        <button
            onClick={onClick}
            className="group relative w-full overflow-hidden rounded-md border border-border/60 hover:border-primary/60 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div
                style={{
                    aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
                }}
                className="w-full relative"
            >
                {template.thumbnail ? (
                    <img
                        src={template.thumbnail}
                        alt={template.name}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted/30">
                        <span className="text-[11px] font-medium text-center text-foreground/70 leading-tight px-2">
                            {template.name}
                        </span>
                    </div>
                )}
            </div>

        </button>
    );
};

import type { TemplatePageContent } from '@sabi-canvas/types/design-templates';
import type { CanvasPage } from '@sabi-canvas/types/pages';
import { DEFAULT_BACKGROUND } from '@sabi-canvas/types/pages';
import {
  CanvasObject,
  GroupObject,
  PrintAreaObject,
  TextObject,
  generateObjectId,
} from '@sabi-canvas/types/canvas-objects';

/** Copies objects with new ids, keeping parent and group references intact. */
export function withFreshIds(objects: CanvasObject[]): CanvasObject[] {
  const idRemap = new Map<string, string>();
  objects.forEach((obj) => idRemap.set(obj.id, generateObjectId()));

  return objects.map((obj) => {
    const next = {
      ...obj,
      id: idRemap.get(obj.id)!,
      parentId: obj.parentId ? (idRemap.get(obj.parentId) ?? obj.parentId) : undefined,
    } as CanvasObject;
    if (obj.type === 'group') {
      (next as GroupObject).childrenIds = (obj as GroupObject).childrenIds.map((id) => idRemap.get(id) ?? id);
    }
    return next;
  });
}

/** Scales a template page's objects into a print area, centred, without replacing the page. */
export function scalePageIntoPrintArea(page: TemplatePageContent, printArea: PrintAreaObject): CanvasObject[] {
  const s = Math.min(printArea.width / page.size.width, printArea.height / page.size.height);
  const offsetX = printArea.x + (printArea.width - page.size.width * s) / 2;
  const offsetY = printArea.y + (printArea.height - page.size.height * s) / 2;

  const sourceObjects = withFreshIds(page.objects.filter((o) => o.type !== 'print-area'));

  return sourceObjects.map((obj) => {
    const base: CanvasObject = {
      ...obj,
      x: offsetX + obj.x * s,
      y: offsetY + obj.y * s,
      width: obj.width * s,
      height: obj.height * s,
      objectRole: 'customer' as const,
      ...('strokeWidth' in obj && typeof (obj as { strokeWidth?: unknown }).strokeWidth === 'number'
        ? { strokeWidth: (obj as { strokeWidth: number }).strokeWidth * s }
        : {}),
      ...(obj.shadowOffsetX !== undefined ? { shadowOffsetX: obj.shadowOffsetX * s } : {}),
      ...(obj.shadowOffsetY !== undefined ? { shadowOffsetY: obj.shadowOffsetY * s } : {}),
      ...(obj.shadowBlur !== undefined ? { shadowBlur: obj.shadowBlur * s } : {}),
    };

    if (obj.type === 'text') {
      const t = obj as TextObject;
      Object.assign(base, {
        fontSize: t.fontSize * s,
        ...(t.textStrokeWidth !== undefined ? { textStrokeWidth: t.textStrokeWidth * s } : {}),
        ...(t.textBgPadding !== undefined ? { textBgPadding: t.textBgPadding * s } : {}),
        ...(t.textBgCornerRadius !== undefined ? { textBgCornerRadius: t.textBgCornerRadius * s } : {}),
        ...(t.letterSpacing !== undefined ? { letterSpacing: t.letterSpacing * s } : {}),
      } satisfies Partial<TextObject>);
    }

    return base;
  });
}

const newPageId = () => `page_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/**
 * Turns template pages into editor pages with new ids and empty history.
 * Unnamed pages are called "Page N", counting from `firstNumber`.
 */
export function toCanvasPages(pages: TemplatePageContent[], firstNumber = 1): CanvasPage[] {
  return pages.map((page, index) => ({
    id: newPageId(),
    name: page.name || `Page ${firstNumber + index}`,
    order: index,
    size: page.size,
    objects: withFreshIds(page.objects ?? []),
    selectedIds: [],
    past: [],
    future: [],
    viewState: { zoom: 1, position: { x: 0, y: 0 } },
    background: page.background ?? DEFAULT_BACKGROUND,
  }));
}

/** Font families named by text objects, to load before they're drawn. */
export function fontFamiliesIn(pages: TemplatePageContent[]): string[] {
  const families = new Set<string>();
  for (const page of pages) {
    for (const obj of page.objects ?? []) {
      if (obj.type === 'text' && typeof (obj as TextObject).fontFamily === 'string') {
        families.add((obj as TextObject).fontFamily);
      }
    }
  }
  return [...families];
}

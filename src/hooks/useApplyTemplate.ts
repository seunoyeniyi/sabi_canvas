import { useCallback } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useCustomFonts } from '@sabi-canvas/contexts/CustomFontsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { preloadFonts } from '@sabi-canvas/lib/fontLoader';
import { fontFamiliesIn, scalePageIntoPrintArea, toCanvasPages } from '@sabi-canvas/lib/templates/placeTemplate';
import { DEFAULT_BACKGROUND } from '@sabi-canvas/types/pages';
import type { ImageObject, PrintAreaObject } from '@sabi-canvas/types/canvas-objects';
import { coverCrop, fitPageInArea, loadPictureSize, pageBackgroundItem } from '@sabi-canvas/lib/printOnDemand';
import type { TemplateDesign } from '@sabi-canvas/types/design-templates';

export interface ApplyTemplateResult {
  success: boolean;
  error?: string;
}

export interface ApplyTemplateOptions {
  /**
   * Add every page after the active one (and show the first) instead of
   * replacing the active page: nothing on the design is lost. Not used while
   * a customer designs on a product, where the design is always added inside
   * the print area.
   */
  asNewPages?: boolean;
}

/**
 * Returns a function that puts a template's design on the canvas.
 *
 * - The first page replaces what's on the active page, which takes the
 *   design's size and background. Undo brings the old objects back.
 * - Further pages are added after the active page.
 * - With `asNewPages`, every page is added after the active page instead.
 * - With a print area in customer mode, the first page is scaled into the
 *   print area and added to what's there; nothing is replaced. Its colour,
 *   gradient or picture comes as an item behind it (not a plain white page).
 */
export function useApplyTemplate(): (design: TemplateDesign, options?: ApplyTemplateOptions) => ApplyTemplateResult {
  const { objects, addObjects, updateActivePageSize, importActivePageJson, insertPages, updateObject, pages, setActivePage } = useCanvasObjects();
  const { editorMode, isMockupEnabled } = useEditor();
  const { loadProjectFonts } = useCustomFonts();
  const { templates } = useSabiCanvasConfig();
  const onTemplateApplied = templates?.onTemplateApplied;

  return useCallback(
    (design: TemplateDesign, options: ApplyTemplateOptions = {}) => {
      const [first, ...rest] = design.content.pages;
      if (!first) return { success: false, error: 'This template is empty.' };

      const printArea = isMockupEnabled && editorMode === 'customer'
        ? (objects.find((o) => o.type === 'print-area') as PrintAreaObject | undefined)
        : undefined;

      let applied = [first];
      if (printArea) {
        const area = { x: printArea.x, y: printArea.y, width: printArea.width * (printArea.scaleX || 1), height: printArea.height * (printArea.scaleY || 1) };
        const behind = pageBackgroundItem(first.background, fitPageInArea(first.size, area));
        addObjects([...(behind ? [behind] : []), ...scalePageIntoPrintArea(first, printArea)]);
        // A picture covers its box once its size is known
        if (behind?.type === 'image') {
          const picture = behind as ImageObject;
          void loadPictureSize(picture.src).then((natural) => {
            if (natural) updateObject(picture.id, coverCrop(natural, picture));
          });
        }
      } else if (options.asNewPages) {
        // Added after the active page; the first one is shown. Plain "Page 2"
        // names are numbered again where they land; real names ("Back") stay.
        const named = design.content.pages.map((page) => (/^page \d+$/i.test(page.name?.trim() ?? '') ? { ...page, name: undefined } : page));
        const added = toCanvasPages(named, pages.length + 1);
        insertPages(added);
        setActivePage(added[0].id);
        applied = design.content.pages;
      } else {
        // Checks the objects before anything changes; sets the background too.
        const result = importActivePageJson({
          version: 1,
          pageName: first.name || design.name,
          viewState: { zoom: 1, position: { x: 0, y: 0 } },
          objects: first.objects ?? [],
          background: first.background ?? DEFAULT_BACKGROUND,
        });
        if (!result.success) return { success: false, error: result.error };
        updateActivePageSize(first.size.width, first.size.height);
        if (rest.length) {
          insertPages(toCanvasPages(rest, 2));
          applied = design.content.pages;
        }
      }

      if (design.content.customFonts?.length) loadProjectFonts(design.content.customFonts);
      const families = fontFamiliesIn(applied);
      if (families.length) void preloadFonts(families, { maxFonts: families.length, concurrency: 4 });

      onTemplateApplied?.(design);
      return { success: true };
    },
    [addObjects, editorMode, importActivePageJson, insertPages, isMockupEnabled, loadProjectFonts, objects, onTemplateApplied, pages.length, setActivePage, updateActivePageSize, updateObject],
  );
}

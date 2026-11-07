import { useCallback } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useCustomFonts } from '@sabi-canvas/contexts/CustomFontsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { preloadFonts } from '@sabi-canvas/lib/fontLoader';
import { fontFamiliesIn, scalePageIntoPrintArea, toCanvasPages } from '@sabi-canvas/lib/templates/placeTemplate';
import { DEFAULT_BACKGROUND } from '@sabi-canvas/types/pages';
import type { PrintAreaObject } from '@sabi-canvas/types/canvas-objects';
import type { TemplateDesign } from '@sabi-canvas/types/design-templates';

export interface ApplyTemplateResult {
  success: boolean;
  error?: string;
}

/**
 * Returns a function that puts a template's design on the canvas.
 *
 * - The first page replaces what's on the active page, which takes the
 *   design's size and background. Undo brings the old objects back.
 * - Further pages are added after the active page.
 * - With a print area in customer mode, the first page is scaled into the
 *   print area and added to what's there; nothing is replaced.
 */
export function useApplyTemplate(): (design: TemplateDesign) => ApplyTemplateResult {
  const { objects, addObjects, updateActivePageSize, importActivePageJson, insertPages } = useCanvasObjects();
  const { editorMode, isMockupEnabled } = useEditor();
  const { loadProjectFonts } = useCustomFonts();
  const { templates } = useSabiCanvasConfig();
  const onTemplateApplied = templates?.onTemplateApplied;

  return useCallback(
    (design: TemplateDesign) => {
      const [first, ...rest] = design.content.pages;
      if (!first) return { success: false, error: 'This template is empty.' };

      const printArea = isMockupEnabled && editorMode === 'customer'
        ? (objects.find((o) => o.type === 'print-area') as PrintAreaObject | undefined)
        : undefined;

      let applied = [first];
      if (printArea) {
        addObjects(scalePageIntoPrintArea(first, printArea));
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
    [addObjects, editorMode, importActivePageJson, insertPages, isMockupEnabled, loadProjectFonts, objects, onTemplateApplied, updateActivePageSize],
  );
}

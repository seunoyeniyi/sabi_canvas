/**
 * Print on demand helpers: a design made on a product, one page per side
 * (front, back, sleeve…). Each page holds the product's picture and a print
 * area, both locked, and the customer designs inside the print area. Open the
 * result with `<EditorLayout initialProject={…} customerMode />`.
 */
import type { CanvasObject, ImageObject, MockupRealism, PrintAreaObject, RectangleObject } from '@sabi-canvas/types/canvas-objects';
import { generateObjectId } from '@sabi-canvas/types/canvas-objects';
import type { CanvasBackground } from '@sabi-canvas/types/pages';
import type { Project, ProjectPage } from '@sabi-canvas/types/project';
import { generateProjectId } from '@sabi-canvas/types/project';
import { scalePageIntoPrintArea } from '@sabi-canvas/lib/templates/placeTemplate';

/** A side of a product that can be printed on. */
export interface MockupSide {
  /** Stable id, used as the page id, e.g. "front". Unique within the product. */
  id: string;
  /** Shown on the page tabs, e.g. "Front". */
  name: string;
  /**
   * A plain picture of this side of the product (a mockup) and its size in
   * pixels. Without one the customer designs on a plain page in the print
   * area's shape (`printAspect`).
   */
  picture?: { src: string; width: number; height: number };
  /** Where the design can go on the picture, as fractions (0–1) of its width and height. Ignored without a picture. */
  printArea: { x: number; y: number; width: number; height: number };
  /** The print's width ÷ height, for a side without a picture. Default 1 (square). */
  printAspect?: number;
  /**
   * How the design sits on the picture in previews: its light and folds on
   * the design, and the surface's shape. Unset: light and folds on, flat.
   */
  realism?: MockupRealism;
}

export interface MockupProjectOptions {
  /** Default: a new id. */
  id?: string;
  /** Default "Untitled". */
  title?: string;
  sides: MockupSide[];
  /** The longest edge of each page, in design units. Default 1200. */
  pageSize?: number;
  /** Colour of the print area's dashed frame. Default a mid grey that shows on light and dark products. */
  printAreaColor?: string;
}

/** Name given to the product picture on each page, so it can be found and swapped. */
export const MOCKUP_PICTURE_NAME = 'mockup-picture';

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** A new design on a product: one page per side, the picture and print area locked. */
export function createMockupProject(options: MockupProjectOptions): Project {
  const longest = options.pageSize ?? 1200;
  const now = Date.now();

  const pages: ProjectPage[] = options.sides.map((side, index) => {
    // Without a picture the page is the print itself, in its own shape
    const aspect = side.printAspect && side.printAspect > 0 ? side.printAspect : 1;
    const source = side.picture ?? { width: aspect >= 1 ? longest : longest * aspect, height: aspect >= 1 ? longest / aspect : longest };
    const pictureLongest = Math.max(1, source.width, source.height);
    const scale = longest / pictureLongest;
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const picture: ImageObject | null = side.picture ? {
      id: generateObjectId(),
      type: 'image',
      objectRole: 'mockup',
      name: MOCKUP_PICTURE_NAME,
      src: side.picture.src,
      naturalWidth: side.picture.width,
      naturalHeight: side.picture.height,
      x: 0,
      y: 0,
      width,
      height,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      draggable: false,
      visible: true,
      locked: true,
      maskShape: 'none',
    } : null;

    const area = side.picture ? side.printArea : { x: 0, y: 0, width: 1, height: 1 };
    const ax = clamp01(area.x);
    const ay = clamp01(area.y);
    const printArea: PrintAreaObject = {
      id: generateObjectId(),
      type: 'print-area',
      objectRole: 'mockup',
      label: 'Print area',
      x: Math.round(ax * width),
      y: Math.round(ay * height),
      width: Math.max(1, Math.round(Math.min(clamp01(area.width), 1 - ax) * width)),
      height: Math.max(1, Math.round(Math.min(clamp01(area.height), 1 - ay) * height)),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      draggable: false,
      visible: true,
      locked: true,
      borderColor: options.printAreaColor ?? '#94a3b8',
      borderDash: [10, 6],
      borderWidth: 2,
      fillColor: 'transparent',
      fillOpacity: 0,
      ...(side.picture && side.realism ? { realism: { ...side.realism } } : {}),
    };

    return {
      id: side.id,
      name: side.name,
      order: index,
      size: { width, height },
      objects: picture ? [picture, printArea] : [printArea],
      selectedIds: [],
      viewState: { zoom: 1, position: { x: 0, y: 0 } },
      background: { type: 'solid', color: '#ffffff' },
    };
  });

  return {
    id: options.id ?? generateProjectId(),
    title: options.title ?? 'Untitled',
    createdAt: now,
    updatedAt: now,
    pages,
    activePageId: pages[0]?.id ?? '',
    canvasSize: pages[0]?.size ?? { width: longest, height: longest },
    isMockupEnabled: true,
  };
}

/** Where the design goes on a side, as fractions (0–1) of the page. */
export interface PrintAreaFractions {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What can change about a side's mockup. */
export interface MockupChange {
  /** Another product picture. */
  src?: string;
  /** Another print area; the customer's items move and scale with it. */
  printArea?: PrintAreaFractions;
  /** Other preview settings. `null` returns to the defaults. */
  realism?: MockupRealism | null;
}

/**
 * A page's objects with another product picture and, optionally, another
 * print area. When the print area moves or changes size, the customer's
 * items move and scale with it, so their design keeps its place on the print.
 */
export function withMockup(
  objects: CanvasObject[],
  pageSize: { width: number; height: number },
  change: MockupChange,
): CanvasObject[] {
  const oldArea = objects.find((object) => object.type === 'print-area') as PrintAreaObject | undefined;
  const next = change.printArea && oldArea
    ? {
        x: Math.round(clamp01(change.printArea.x) * pageSize.width),
        y: Math.round(clamp01(change.printArea.y) * pageSize.height),
        width: Math.max(1, Math.round(clamp01(change.printArea.width) * pageSize.width)),
        height: Math.max(1, Math.round(clamp01(change.printArea.height) * pageSize.height)),
      }
    : null;
  const oldW = oldArea ? oldArea.width * (oldArea.scaleX || 1) : 0;
  const oldH = oldArea ? oldArea.height * (oldArea.scaleY || 1) : 0;
  const moved = !!(next && oldArea && (next.x !== oldArea.x || next.y !== oldArea.y || next.width !== oldW || next.height !== oldH));
  // One scale for both directions keeps the design's proportions
  const scale = moved ? Math.min(next!.width / Math.max(1, oldW), next!.height / Math.max(1, oldH)) : 1;

  const realismChanged = change.realism !== undefined
    && JSON.stringify(change.realism ?? null) !== JSON.stringify(oldArea?.realism ?? null);

  return objects.map((object) => {
    if (change.src && object.type === 'image' && object.objectRole === 'mockup' && object.name === MOCKUP_PICTURE_NAME) {
      return (object as ImageObject).src === change.src ? object : ({ ...(object as ImageObject), src: change.src } as CanvasObject);
    }
    if (object.type === 'print-area' && (moved || realismChanged)) {
      const area = { ...(object as PrintAreaObject) };
      if (moved) Object.assign(area, { x: next!.x, y: next!.y, width: next!.width, height: next!.height, scaleX: 1, scaleY: 1 });
      if (realismChanged) {
        if (change.realism) area.realism = { ...change.realism };
        else delete area.realism;
      }
      return area as CanvasObject;
    }
    if (!moved) return object;
    if (object.objectRole === 'customer') {
      return {
        ...object,
        x: next!.x + (object.x - oldArea!.x) * scale,
        y: next!.y + (object.y - oldArea!.y) * scale,
        scaleX: (object.scaleX || 1) * scale,
        scaleY: (object.scaleY || 1) * scale,
      } as CanvasObject;
    }
    return object;
  });
}

/**
 * The same design with another product picture on one side, e.g. after the
 * customer picks another colour, and optionally that colour's own print area
 * and the side's current preview settings. The customer's work is kept (and
 * moved with the print area). In an open editor use
 * `editorRef.current.replaceMockup`.
 */
export function replaceMockupPicture(
  project: Project,
  pageId: string,
  src: string,
  printArea?: PrintAreaFractions,
  realism?: MockupRealism | null,
): Project {
  return {
    ...project,
    pages: project.pages.map((page) =>
      page.id !== pageId ? page : { ...page, objects: withMockup(page.objects, page.size ?? project.canvasSize, { src, printArea, realism }) },
    ),
  };
}

/** A page of an existing design, to put on a product. */
export interface DesignPageSource {
  size: { width: number; height: number };
  objects: CanvasObject[];
  background?: CanvasBackground;
}

const WHITE = /^(#fff|#ffffff|white|rgba?\(\s*255\s*,\s*255\s*,\s*255\s*(,\s*1(\.0+)?\s*)?\))$/i;

/** Whether a page background prints as nothing: none, see-through or plain white. */
export function isBlankBackground(background?: CanvasBackground | null): boolean {
  if (!background || background.type === 'transparent') return true;
  return background.type === 'solid' && WHITE.test(background.color.trim());
}

const pictureSize = (src: string) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image.naturalWidth ? { width: image.naturalWidth, height: image.naturalHeight } : null);
    image.onerror = () => resolve(null);
    image.src = src;
  });

/** The page's colour, gradient or picture as an item of the customer's, over `box`. Null when it prints as nothing. */
async function backgroundItem(
  background: CanvasBackground | undefined,
  box: { x: number; y: number; width: number; height: number },
): Promise<CanvasObject | null> {
  if (!background || isBlankBackground(background)) return null;
  const base = {
    id: generateObjectId(),
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    visible: true,
    locked: false,
    objectRole: 'customer' as const,
    name: 'Background',
  };
  if (background.type === 'image') {
    // Drawn to cover the page, as the editor draws a page's picture
    const natural = await pictureSize(background.src);
    const picture: ImageObject = { ...base, type: 'image', src: background.src, maskShape: 'none' };
    if (natural) {
      const scale = Math.max(box.width / natural.width, box.height / natural.height);
      const cropWidth = box.width / scale;
      const cropHeight = box.height / scale;
      Object.assign(picture, {
        naturalWidth: natural.width,
        naturalHeight: natural.height,
        cropX: (natural.width - cropWidth) / 2,
        cropY: (natural.height - cropHeight) / 2,
        cropWidth,
        cropHeight,
      });
    }
    return picture;
  }
  const rect: RectangleObject = { ...base, type: 'rectangle', fill: '', stroke: '', strokeWidth: 0, cornerRadius: 0 };
  if (background.type === 'solid') {
    rect.fill = background.color;
  } else if (background.type === 'linear-gradient' || background.type === 'radial-gradient') {
    rect.fill = background.colors[0] ?? '#ffffff';
    rect.fillType = background.type;
    rect.gradientColors = background.colors;
    if (background.type === 'linear-gradient') rect.gradientAngle = background.angle;
  }
  return rect;
}

/**
 * An existing design put on a product (e.g. a template the customer made in
 * the free editor, now to be printed): its pages in order on the product's
 * sides (page 1 on the first side, page 2 on the second…), each scaled to fit
 * inside the side's print area and centred. A page's colour, gradient or
 * picture comes with it as an item behind the design; a plain white page
 * doesn't (white isn't printed on clothing, and on paper it's the paper).
 * Extra pages are left out. The customer's items already on a side stay.
 */
export async function placeDesignOnProduct(project: Project, pages: DesignPageSource[]): Promise<Project> {
  const placed = await Promise.all(
    project.pages.map(async (page, index) => {
      const source = pages[index];
      const area = printAreaOf(page);
      if (!source || !area || !source.size?.width || !source.size?.height) return page;
      const areaBox = { ...area, width: area.width * (area.scaleX || 1), height: area.height * (area.scaleY || 1) } as PrintAreaObject;
      const items = scalePageIntoPrintArea({ size: source.size, objects: source.objects ?? [], background: source.background }, areaBox);
      // Where the page lands: the same fit as its items
      const s = Math.min(areaBox.width / source.size.width, areaBox.height / source.size.height);
      const box = {
        x: areaBox.x + (areaBox.width - source.size.width * s) / 2,
        y: areaBox.y + (areaBox.height - source.size.height * s) / 2,
        width: source.size.width * s,
        height: source.size.height * s,
      };
      const behind = await backgroundItem(source.background, box);
      return { ...page, objects: [...page.objects, ...(behind ? [behind] : []), ...items] };
    }),
  );
  return { ...project, pages: placed, updatedAt: Date.now() };
}

/** The customer's own items on a page (not the product picture or print area). */
export function customerObjects(page: Pick<ProjectPage, 'objects'>): CanvasObject[] {
  return (page.objects ?? []).filter((object) => object.objectRole === 'customer' && object.visible !== false);
}

/** The page's print area, if it has one. */
export function printAreaOf(page: Pick<ProjectPage, 'objects'>): PrintAreaObject | undefined {
  return (page.objects ?? []).find((object) => object.type === 'print-area') as PrintAreaObject | undefined;
}

/** How big a side prints. */
export interface PrintSpec {
  /** Printed width and height in inches. */
  widthInches: number;
  heightInches: number;
}

export type PrintIssueKind =
  /** Nothing of the customer's on this side: it won't be printed. */
  | 'empty'
  /** A picture under `minDpi` at its printed size: it will look blurry. */
  | 'blurry'
  /** A picture between `minDpi` and `goodDpi`: it may look soft up close. */
  | 'soft'
  /** An item crosses the edge of the print area: the part outside is cut off. */
  | 'cut-off'
  /** An item is entirely outside the print area: it won't be printed. */
  | 'outside';

export interface PrintIssue {
  kind: PrintIssueKind;
  pageId: string;
  pageName: string;
  objectId?: string;
  /** The picture's resolution at its printed size, for 'blurry' and 'soft'. */
  dpi?: number;
}

export interface AnalyzePrintOptions {
  /** Under this, a picture is 'blurry'. Default 100. */
  minDpi?: number;
  /** Under this, a picture is 'soft'. Default 150. */
  goodDpi?: number;
  /** How far (as a fraction of the print area) an item may cross the edge before it counts. Default 0.01. */
  tolerance?: number;
}

const isVector = (src: string) => /^data:image\/svg|\.svg(\?|#|$)/i.test(src || '');

/** The item's bounding box, rotation included (items turn about their top-left corner). */
function boundsOf(object: CanvasObject) {
  const width = Math.abs(object.width * (object.scaleX || 1));
  const height = Math.abs(object.height * (object.scaleY || 1));
  const angle = ((object.rotation || 0) * Math.PI) / 180;
  if (!angle || object.type === 'circle') {
    return { left: object.x, top: object.y, right: object.x + width, bottom: object.y + height };
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([cx, cy]) => ({ x: object.x + cx * cos - cy * sin, y: object.y + cx * sin + cy * cos }));
  return {
    left: Math.min(...corners.map((c) => c.x)),
    top: Math.min(...corners.map((c) => c.y)),
    right: Math.max(...corners.map((c) => c.x)),
    bottom: Math.max(...corners.map((c) => c.y)),
  };
}

/**
 * Checks a design before it's printed, the way print shops "preflight" a
 * file: empty sides, pictures too small for their printed size, and items
 * crossing or outside the print area. `specs` gives each page's printed size
 * by page id; pages without one skip the resolution check.
 */
export function analyzePrintDesign(
  pages: Pick<ProjectPage, 'id' | 'name' | 'objects'>[],
  specs: Record<string, PrintSpec | undefined>,
  options: AnalyzePrintOptions = {},
): PrintIssue[] {
  const minDpi = options.minDpi ?? 100;
  const goodDpi = options.goodDpi ?? 150;
  const tolerance = options.tolerance ?? 0.01;
  const issues: PrintIssue[] = [];

  for (const page of pages) {
    const mine = customerObjects(page);
    const base = { pageId: page.id, pageName: page.name };
    if (mine.length === 0) {
      issues.push({ ...base, kind: 'empty' });
      continue;
    }

    const area = printAreaOf(page);
    const spec = specs[page.id];

    for (const object of mine) {
      if (area && !object.parentId) {
        const box = boundsOf(object);
        const slackX = area.width * tolerance;
        const slackY = area.height * tolerance;
        const areaRight = area.x + area.width;
        const areaBottom = area.y + area.height;
        const outside = box.right <= area.x || box.left >= areaRight || box.bottom <= area.y || box.top >= areaBottom;
        const crosses =
          box.left < area.x - slackX || box.top < area.y - slackY || box.right > areaRight + slackX || box.bottom > areaBottom + slackY;
        if (outside) issues.push({ ...base, kind: 'outside', objectId: object.id });
        else if (crosses) issues.push({ ...base, kind: 'cut-off', objectId: object.id });
      }

      if (object.type === 'image' && area && spec?.widthInches) {
        const image = object as ImageObject;
        if (isVector(image.src)) continue;
        const sourceWidth = image.cropWidth || image.naturalWidth;
        if (!sourceWidth) continue;
        const shownWidth = Math.abs(image.width * (image.scaleX || 1));
        const printedInches = (shownWidth / area.width) * spec.widthInches;
        if (printedInches <= 0) continue;
        const dpi = Math.round(sourceWidth / printedInches);
        if (dpi < minDpi) issues.push({ ...base, kind: 'blurry', objectId: object.id, dpi });
        else if (dpi < goodDpi) issues.push({ ...base, kind: 'soft', objectId: object.id, dpi });
      }
    }
  }

  return issues;
}

/** Inches in one unit. */
export const INCHES_PER = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4 } as const;

/** A print size in pixels: e.g. 30 × 40 cm at 150 DPI is 1772 × 2362. */
export function printPixels(width: number, height: number, unit: keyof typeof INCHES_PER, dpi: number) {
  const perUnit = INCHES_PER[unit] ?? 1;
  return {
    width: Math.max(1, Math.round(width * perUnit * dpi)),
    height: Math.max(1, Math.round(height * perUnit * dpi)),
  };
}

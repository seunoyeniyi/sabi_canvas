// Canvas Object Types for shapes, images, and other elements
import { DEFAULT_FONT_FAMILY } from '@sabi-canvas/lib/fontCatalog';

export type CanvasObjectType =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'star'
  | 'line'
  | 'arrow'
  | 'path'
  | 'text'
  | 'image'
  | 'group'
  | 'table'
  | 'draw'
  | 'print-area';

export interface BaseCanvasObject {
  id: string;
  type: CanvasObjectType;
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  draggable: boolean;
  visible: boolean;
  locked: boolean;
  name?: string;
  // Print-on-demand: which editing layer this object belongs to
  objectRole?: 'mockup' | 'customer';
  // Advanced styling
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  // Filter effects
  filterBlur?: number;         // 0–40 px
  filterBrightness?: number;   // -100 to 100
  filterContrast?: number;     // -100 to 100
  filterSaturation?: number;   // -100 to 100
  filterTemperature?: number;  // -100 (cool) to 100 (warm)
  filterVibrance?: number;     // -100 to 100
  filterWhites?: number;       // -100 to 100 (highlights)
  filterShadows?: number;      // -100 to 100 (shadow lift/crush)
  filterBlacks?: number;       // -100 to 100 (black point)
  colorFilter?: 'none' | 'grayscale' | 'sepia' | 'cold' | 'natural' | 'warm';
  colorOverlay?: string;
  colorOverlayOpacity?: number;
  // Inner text (for shapes with embedded text)
  innerText?: string;
  innerTextFontSize?: number;
  innerTextFontFamily?: string;
  innerTextFontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  innerTextFill?: string;
  innerTextAlign?: 'left' | 'center' | 'right';
  innerTextVerticalAlign?: 'top' | 'middle' | 'bottom';
  innerTextPadding?: number;
  innerTextLineHeight?: number;
  innerTextLetterSpacing?: number;
  innerTextDecoration?: 'underline' | 'line-through' | 'underline line-through' | 'none';
  innerTextListStyle?: 'none' | 'disc' | 'ordered';
  innerRichText?: TextSpan[];
}

export interface RectangleObject extends BaseCanvasObject {
  type: 'rectangle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  // Gradient support
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
  gradientAngle?: number;
}

export interface CircleObject extends BaseCanvasObject {
  type: 'circle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
}

export interface EllipseObject extends BaseCanvasObject {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
  radiusX: number;
  radiusY: number;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
}

export interface TriangleObject extends BaseCanvasObject {
  type: 'triangle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
}

export interface PolygonObject extends BaseCanvasObject {
  type: 'polygon';
  sides: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
}

export interface StarObject extends BaseCanvasObject {
  type: 'star';
  numPoints: number;
  innerRadius: number;
  outerRadius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
}

export interface LineObject extends BaseCanvasObject {
  type: 'line';
  points: number[]; // [x1, y1, x2, y2, ...]
  stroke: string;
  strokeWidth: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dash?: number[];
}

export interface ArrowObject extends BaseCanvasObject {
  type: 'arrow';
  points: number[];
  stroke: string;
  strokeWidth: number;
  fill: string;
  pointerLength: number;
  pointerWidth: number;
  pointerAtBeginning?: boolean;
  pointerAtEnding?: boolean;
}

export interface PathObject extends BaseCanvasObject {
  type: 'path';
  data: string; // SVG path data
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillType?: 'solid' | 'linear-gradient' | 'radial-gradient';
  gradientColors?: string[];
}

export interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  fontFamily?: string;
}

export interface TextObject extends BaseCanvasObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  textDecoration?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  lineHeight?: number;
  letterSpacing?: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  listStyle?: 'none' | 'disc' | 'ordered';
  richText?: TextSpan[];
  // Curve
  textCurve?: number;           // -100 to 100 (positive = arch up, negative = arch down)
  // Stroke
  textStrokeColor?: string;
  textStrokeWidth?: number;
  // Background
  textBgColor?: string;
  textBgCornerRadius?: number;
  textBgPadding?: number;
  textBgOpacity?: number;
}

export type ImageMaskShape = 'none' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'hexagon' | 'rounded-rect';

export interface ImageObject extends BaseCanvasObject {
  type: 'image';
  src: string;
  removedBgSrc?: string;
  // Original image dimensions (set on load)
  naturalWidth?: number;
  naturalHeight?: number;
  // Crop rect in natural image coordinates
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  // Mask shape
  maskShape?: ImageMaskShape;
  // Border / stroke
  stroke?: string;
  strokeWidth?: number;
  // SVG color editing (only populated when src is an SVG)
  svgPalette?: string[];              // unique #rrggbb colors extracted from the SVG
  svgColors?: Record<string, string>; // original hex → replacement hex
}

export interface GroupObject extends BaseCanvasObject {
  type: 'group';
  childrenIds: string[];
}

// --- Table types ---

export interface TableCell {
  text: string;
  // Per-cell overrides (undefined = use table-level default)
  fill?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
}

export type TableBorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';

export interface TableBorderConfig {
  outerTop: boolean;
  outerBottom: boolean;
  outerLeft: boolean;
  outerRight: boolean;
  innerHorizontal: boolean;
  innerVertical: boolean;
  style: TableBorderStyle;
  color: string;
  width: number;
}

export interface TableObject extends BaseCanvasObject {
  type: 'table';
  rows: number;
  cols: number;
  cells: TableCell[][];
  colWidths: number[]; // pixel widths for each column
  rowHeights: number[]; // pixel heights for each row
  // Table-level style defaults
  defaultCellFill: string;
  defaultTextColor: string;
  defaultFontSize: number;
  defaultFontFamily: string;
  defaultTextAlign: 'left' | 'center' | 'right';
  defaultVerticalAlign: 'top' | 'middle' | 'bottom';
  cellPadding: number;
  // Header row
  headerRow: boolean;
  headerFill: string;
  headerTextColor: string;
  // Border config
  border: TableBorderConfig;
}

export interface DrawObject extends BaseCanvasObject {
  type: 'draw';
  points: number[];          // flat [x1, y1, x2, y2, ...]
  stroke: string;
  strokeWidth: number;
  lineCap: 'round' | 'butt' | 'square';
  lineJoin: 'round' | 'bevel' | 'miter';
  tension: number;           // 0 = sharp, 0.5 = smooth
  drawTool: 'pen' | 'marker' | 'highlighter';
}

export interface PrintAreaObject extends BaseCanvasObject {
  type: 'print-area';
  label?: string;
  borderColor: string;
  borderDash: number[];
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
}

export type CanvasObject =
  | RectangleObject
  | CircleObject
  | EllipseObject
  | TriangleObject
  | PolygonObject
  | StarObject
  | LineObject
  | ArrowObject
  | PathObject
  | TextObject
  | ImageObject
  | GroupObject
  | TableObject
  | DrawObject
  | PrintAreaObject;

// Helper to generate unique IDs
export const generateObjectId = (): string => {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Default shape properties
export const DEFAULT_SHAPE_PROPS = {
  rectangle: {
    fill: 'hsl(217, 91%, 60%)',
    stroke: 'hsl(217, 91%, 40%)',
    strokeWidth: 0,
    cornerRadius: 0,
    width: 200,
    height: 200,
  },
  circle: {
    fill: 'hsl(280, 65%, 60%)',
    stroke: 'hsl(280, 65%, 40%)',
    strokeWidth: 0,
    width: 150,
    height: 150,
  },
  ellipse: {
    fill: 'hsl(150, 60%, 50%)',
    stroke: 'hsl(150, 60%, 35%)',
    strokeWidth: 0,
    radiusX: 100,
    radiusY: 60,
    width: 200,
    height: 120,
  },
  triangle: {
    fill: 'hsl(45, 93%, 58%)',
    stroke: 'hsl(45, 93%, 40%)',
    strokeWidth: 0,
    width: 180,
    height: 156, // equilateral triangle height
  },
  polygon: {
    fill: 'hsl(330, 80%, 60%)',
    stroke: 'hsl(330, 80%, 40%)',
    strokeWidth: 0,
    sides: 6,
    width: 150,
    height: 150,
  },
  star: {
    fill: 'hsl(50, 100%, 50%)',
    stroke: 'hsl(50, 100%, 35%)',
    strokeWidth: 0,
    numPoints: 5,
    innerRadius: 40,
    outerRadius: 80,
    width: 160,
    height: 160,
  },
  line: {
    stroke: '#000000',
    strokeWidth: 4,
    points: [0, 0, 200, 0] as number[],
    width: 200,
    height: 4,
  },
  arrow: {
    stroke: '#000000',
    fill: '#000000',
    strokeWidth: 4,
    points: [0, 0, 200, 0] as number[],
    pointerLength: 30,
    pointerWidth: 50,
    pointerAtEnding: true,
    width: 200,
    height: 20,
  },
  text: {
    text: 'Add text',
    fontSize: 48,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontStyle: 'normal' as const,
    textDecoration: 'none' as const,
    lineHeight: 1.2,
    letterSpacing: 0,
    fill: '#000000',
    align: 'center' as const,
    width: 200,
    height: 60,
  },
  table: {
    width: 400,
    height: 300,
    rows: 3,
    cols: 3,
  },
} as const;

// Create default object
export const createDefaultObject = (
  type: CanvasObjectType,
  position: { x: number; y: number }
): CanvasObject => {
  const base: Omit<BaseCanvasObject, 'type' | 'width' | 'height'> = {
    id: generateObjectId(),
    x: position.x,
    y: position.y,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    visible: true,
    locked: false,
  };

  switch (type) {
    case 'rectangle':
      return {
        ...base,
        type: 'rectangle',
        ...DEFAULT_SHAPE_PROPS.rectangle,
      };
    case 'circle':
      return {
        ...base,
        type: 'circle',
        ...DEFAULT_SHAPE_PROPS.circle,
      };
    case 'ellipse':
      return {
        ...base,
        type: 'ellipse',
        ...DEFAULT_SHAPE_PROPS.ellipse,
      };
    case 'triangle':
      return {
        ...base,
        type: 'triangle',
        ...DEFAULT_SHAPE_PROPS.triangle,
      };
    case 'polygon':
      return {
        ...base,
        type: 'polygon',
        ...DEFAULT_SHAPE_PROPS.polygon,
      };
    case 'star':
      return {
        ...base,
        type: 'star',
        ...DEFAULT_SHAPE_PROPS.star,
      };
    case 'line':
      return {
        ...base,
        type: 'line',
        ...DEFAULT_SHAPE_PROPS.line,
      };
    case 'arrow':
      return {
        ...base,
        type: 'arrow',
        ...DEFAULT_SHAPE_PROPS.arrow,
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        ...DEFAULT_SHAPE_PROPS.text,
      };
    case 'table': {
      const { rows, cols, width, height } = DEFAULT_SHAPE_PROPS.table;
      const colWidth = width / cols;
      const rowHeight = height / rows;
      return {
        ...base,
        type: 'table',
        width,
        height,
        rows,
        cols,
        cells: Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => ({ text: '' }))
        ),
        colWidths: Array.from({ length: cols }, () => colWidth),
        rowHeights: Array.from({ length: rows }, () => rowHeight),
        defaultCellFill: '#ffffff',
        defaultTextColor: '#000000',
        defaultFontSize: 14,
        defaultFontFamily: DEFAULT_FONT_FAMILY,
        defaultTextAlign: 'left',
        cellPadding: 8,
        headerRow: false,
        headerFill: '#e2e8f0',
        headerTextColor: '#1e293b',
        border: {
          outerTop: true,
          outerBottom: true,
          outerLeft: true,
          outerRight: true,
          innerHorizontal: true,
          innerVertical: true,
          style: 'solid',
          color: '#000000',
          width: 1,
        },
      } as TableObject;
    }
    case 'draw':
      return {
        ...base,
        type: 'draw',
        points: [],
        stroke: '#2563EB',
        strokeWidth: 4,
        lineCap: 'round',
        lineJoin: 'round',
        tension: 0.5,
        drawTool: 'pen',
        width: 0,
        height: 0,
      } as DrawObject;
    default:
      return {
        ...base,
        type: 'rectangle',
        ...DEFAULT_SHAPE_PROPS.rectangle,
      };
  }
};

// Create path object from SVG data
export const createPathObject = (
  pathData: string,
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  fill: string = 'hsl(217, 91%, 60%)'
): PathObject => {
  return {
    id: generateObjectId(),
    type: 'path',
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    visible: true,
    locked: false,
    data: pathData,
    fill,
    stroke: '',
    strokeWidth: 0,
  };
};

// Factory to create a table object with given rows/cols/dimensions
export const createDefaultTableObject = (
  rows: number,
  cols: number,
  position: { x: number; y: number },
  width = 400,
  height = 300
): TableObject => {
  const colWidth = width / cols;
  const rowHeight = height / rows;
  return {
    id: generateObjectId(),
    type: 'table',
    x: position.x,
    y: position.y,
    width,
    height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    visible: true,
    locked: false,
    rows,
    cols,
    cells: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ text: '' }))
    ),
    colWidths: Array.from({ length: cols }, () => colWidth),
    rowHeights: Array.from({ length: rows }, () => rowHeight),
    defaultCellFill: '#ffffff',
    defaultTextColor: '#000000',
    defaultFontSize: 14,
    defaultFontFamily: DEFAULT_FONT_FAMILY,
    defaultTextAlign: 'left',
    defaultVerticalAlign: 'top',
    cellPadding: 0,
    headerRow: false,
    headerFill: '#e2e8f0',
    headerTextColor: '#1e293b',
    border: {
      outerTop: true,
      outerBottom: true,
      outerLeft: true,
      outerRight: true,
      innerHorizontal: true,
      innerVertical: true,
      style: 'solid',
      color: '#000000',
      width: 1,
    },
  };
};

// Factory to create a draw object from recorded points
export const createDrawObject = (
  points: number[],
  options: {
    stroke?: string;
    strokeWidth?: number;
    lineCap?: DrawObject['lineCap'];
    lineJoin?: DrawObject['lineJoin'];
    tension?: number;
    opacity?: number;
    drawTool?: DrawObject['drawTool'];
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    shadowOpacity?: number;
  } = {}
): DrawObject => {
  // Compute bounding box for x/y/width/height
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] < minX) minX = points[i];
    if (points[i] > maxX) maxX = points[i];
    if (points[i + 1] < minY) minY = points[i + 1];
    if (points[i + 1] > maxY) maxY = points[i + 1];
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  return {
    id: generateObjectId(),
    type: 'draw',
    x: 0,
    y: 0,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: options.opacity ?? 1,
    draggable: true,
    visible: true,
    locked: false,
    points,
    stroke: options.stroke ?? '#2563EB',
    strokeWidth: options.strokeWidth ?? 2,
    lineCap: options.lineCap ?? 'round',
    lineJoin: options.lineJoin ?? 'round',
    tension: options.tension ?? 0.5,
    drawTool: options.drawTool ?? 'pen',
    shadowColor: options.shadowColor,
    shadowBlur: options.shadowBlur,
    shadowOffsetX: options.shadowOffsetX,
    shadowOffsetY: options.shadowOffsetY,
    shadowOpacity: options.shadowOpacity,
  };
};

export const createImageObject = (
  src: string,
  position: { x: number; y: number },
  dimensions: { width: number; height: number },
  naturalDimensions?: { width: number; height: number }
): ImageObject => {
  return {
    id: generateObjectId(),
    type: 'image',
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    visible: true,
    locked: false,
    src,
    naturalWidth: naturalDimensions?.width,
    naturalHeight: naturalDimensions?.height,
    maskShape: 'none',
  };
};

export const createPrintAreaObject = (
  position: { x: number; y: number },
  dimensions: { width: number; height: number }
): PrintAreaObject => {
  return {
    id: generateObjectId(),
    type: 'print-area',
    objectRole: 'mockup',
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    visible: true,
    locked: false,
    label: 'Print Area',
    borderColor: '#000000',
    borderDash: [10, 6],
    borderWidth: 2,
    fillColor: 'transparent',
    fillOpacity: 0,
  };
};

// Canvas and Stage Type Definitions for React-Konva Integration

import Konva from 'konva';

// Stage configuration for responsive behavior
export interface StageConfig {
  // Base design dimensions (the "safe area" size)
  designWidth: number;
  designHeight: number;
  // Minimum padding around the safe area
  padding: number;
  // Background color for off-canvas area
  backgroundColor: string;
  // Safe area background color
  safeAreaColor: string;
  // Whether to show grid inside safe area
  showGrid: boolean;
  // Grid size in pixels
  gridSize: number;
}

// Viewport dimensions (actual Stage size)
export interface ViewportDimensions {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Pan and zoom state
export interface PanZoomState {
  scale: number;
  position: { x: number; y: number };
  isDragging: boolean;
}

// Touch gesture state for mobile
export interface TouchState {
  lastCenter: { x: number; y: number } | null;
  lastDist: number;
}

// Canvas interaction modes
export type InteractionMode = 'select' | 'pan' | 'draw' | 'text' | 'shape';

// Props for the EditorCanvas component
export interface EditorCanvasProps {
  // Stage configuration
  config?: Partial<StageConfig>;
  // Current zoom level (1 = 100%)
  zoom?: number;
  // Current view position
  position?: { x: number; y: number };
  // Callback when zoom changes
  onZoomChange?: (zoom: number) => void;
  // Callback when position changes
  onPositionChange?: (pos: { x: number; y: number }) => void;
  // Current interaction mode
  mode?: InteractionMode;
  // Whether stage is interactive
  interactive?: boolean;
  // Show/hide grid
  showGrid?: boolean;
  // Show/hide safe area border
  showSafeArea?: boolean;
  // Custom class for the container
  className?: string;
  // Children to render inside the main layer
  children?: React.ReactNode;
  // Callback when stage is ready
  onStageReady?: (stage: Konva.Stage) => void;
}

// Props for SafeArea component
export interface SafeAreaProps {
  x: number;
  y: number;
  width: number;
  height: number;
  showBorder?: boolean;
  showGrid?: boolean;
  gridSize?: number;
  /** Fallback fill color (used when background prop is absent). */
  fillColor?: string;
  borderColor?: string;
  /** Per-page background definition (takes precedence over fillColor). */
  background?: import('./pages').CanvasBackground;
}

// Default stage configuration
export const DEFAULT_STAGE_CONFIG: StageConfig = {
  designWidth: 1080,
  designHeight: 1920,
  padding: 40,
  backgroundColor: 'transparent',
  safeAreaColor: '#ffffff',
  showGrid: true,
  gridSize: 20,
};

// Zoom constraints
export const ZOOM_CONFIG = {
  min: 0.1,
  max: 4,
  step: 0.1,
  wheelSensitivity: 0.001,
  pinchSensitivity: 0.01,
} as const;

// Common print preset dimensions
export const PRINT_PRESETS = {
  businessCard: { width: 1050, height: 600, name: 'Business Card (3.5" × 2")' },
  postcard: { width: 1800, height: 1200, name: 'Postcard (6" × 4")' },
  flyer: { width: 2550, height: 3300, name: 'Flyer (8.5" × 11")' },
  poster: { width: 5400, height: 7200, name: 'Poster (18" × 24")' },
  instagram: { width: 1080, height: 1080, name: 'Instagram Square' },
  instagramStory: { width: 1080, height: 1920, name: 'Instagram Story' },
  facebookCover: { width: 1640, height: 624, name: 'Facebook Cover' },
} as const;

export interface AlignmentLine {
  points: number[];
  orientation: 'vertical' | 'horizontal';
}

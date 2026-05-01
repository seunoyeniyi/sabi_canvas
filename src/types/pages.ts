import { CanvasObject } from './canvas-objects';

export type CanvasBackground =
  | { type: 'transparent' }
  | { type: 'solid'; color: string }
  | { type: 'linear-gradient'; colors: string[]; angle: number }
  | { type: 'radial-gradient'; colors: string[] }
  | { type: 'image'; src: string };

export const DEFAULT_BACKGROUND: CanvasBackground = { type: 'solid', color: '#ffffff' };

export interface CanvasPage {
  id: string;
  name: string;
  order: number;
  size?: { width: number; height: number };
  objects: CanvasObject[];
  selectedIds: string[];
  past: CanvasObject[][];
  future: CanvasObject[][];
  viewState: {
    zoom: number;
    position: { x: number; y: number };
  };
  background?: CanvasBackground;
}

export interface ActivePageJsonPayload {
  version: 1;
  pageName: string;
  viewState: CanvasPage['viewState'];
  objects: CanvasObject[];
  background?: CanvasBackground;
}

export interface ActivePageImportResult {
  success: boolean;
  importedCount?: number;
  error?: string;
}

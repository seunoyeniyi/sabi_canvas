import { CanvasObject } from './canvas-objects';
import { CanvasBackground } from './pages';

export type TemplateCategory = 'social' | 'presentation' | 'marketing';

export interface DesignTemplate {
  // Metadata
  id: string;
  name: string;
  /** Cloudinary URL — leave empty until manually set after upload */
  thumbnail: string;
  canvasWidth: number;
  canvasHeight: number;
  category: TemplateCategory;
  // Page content (compatible with ActivePageJsonPayload)
  version: 1;
  pageName: string;
  viewState: { zoom: number; position: { x: number; y: number } };
  objects: CanvasObject[];
  background?: CanvasBackground;
}

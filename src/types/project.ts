import { CanvasBackground, CanvasPage } from './pages';
import { CanvasObject } from './canvas-objects';
import type { CustomFont } from './custom-fonts';

export const STORAGE_PROJECTS_KEY = 'ca_projects';
export const STORAGE_LAST_PROJECT_KEY = 'ca_last_project_id';

export const DEFAULT_PROJECT_TITLE = 'Untitled';

export const generateProjectId = (): string =>
  `proj_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

/** A CanvasPage without undo/redo history — safe to persist */
export interface ProjectPage {
  id: string;
  name: string;
  order: number;
  size?: { width: number; height: number };
  objects: CanvasObject[];
  selectedIds: string[];
  viewState: CanvasPage['viewState'];
  background?: CanvasBackground;
}

export interface Project {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  pages: ProjectPage[];
  activePageId: string;
  canvasSize: { width: number; height: number };
  /** Custom fonts uploaded by the user that are used in this project */
  customFonts?: CustomFont[];
  /** Whether the print-on-demand mockup feature is enabled for this project */
  isMockupEnabled?: boolean;
}

/** Strip history and selection from a live CanvasPage for storage */
export const pageToProjectPage = (page: CanvasPage): ProjectPage => ({
  id: page.id,
  name: page.name,
  order: page.order,
  size: page.size,
  objects: page.objects,
  selectedIds: [],
  viewState: { zoom: 1, position: { x: 0, y: 0 } },
  background: page.background,
});

/** Hydrate a ProjectPage into a full CanvasPage (empty history) */
export const projectPageToCanvasPage = (page: ProjectPage): CanvasPage => ({
  ...page,
  selectedIds: [],
  past: [],
  future: [],
});

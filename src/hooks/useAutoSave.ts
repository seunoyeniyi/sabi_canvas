import { useEffect, useMemo, useRef } from 'react';
import Konva from 'konva';
import { CanvasPage } from '@sabi-canvas/types/pages';
import { Project, generateProjectId, pageToProjectPage } from '@sabi-canvas/types/project';
import { saveProject, setLastProjectId } from '@sabi-canvas/hooks/useProjectManager';
import type { CustomFont } from '@sabi-canvas/types/custom-fonts';

const DEBOUNCE_MS = 1500;

interface UseAutoSaveOptions {
  pages: CanvasPage[];
  activePageId: string;
  projectId: string | null;
  projectTitle: string;
  getStage: () => Konva.Stage | null;
  onProjectCreated: (id: string) => void;
  onSaved?: () => void;
  customFonts?: CustomFont[];
  isMockupEnabled?: boolean;
}

export const useAutoSave = ({
  pages,
  activePageId,
  projectId,
  projectTitle,
  getStage,
  onProjectCreated,
  onSaved,
  customFonts,
  isMockupEnabled,
}: UseAutoSaveOptions): void => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectIdRef = useRef<string | null>(projectId);
  const isFirstMountRef = useRef(true);
  const createdAtRef = useRef<number>(Date.now());
  const customFontsRef = useRef<CustomFont[] | undefined>(customFonts);
  useEffect(() => { customFontsRef.current = customFonts; }, [customFonts]);

  const isMockupEnabledRef = useRef<boolean | undefined>(isMockupEnabled);
  useEffect(() => { isMockupEnabledRef.current = isMockupEnabled; }, [isMockupEnabled]);

  // Always keep a ref to the latest pages so the debounced callback saves
  // current viewState without viewState changes triggering the effect.
  const pagesRef = useRef(pages);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  const activePageIdRef = useRef(activePageId);
  useEffect(() => { activePageIdRef.current = activePageId; }, [activePageId]);

  const projectTitleRef = useRef(projectTitle);
  useEffect(() => { projectTitleRef.current = projectTitle; }, [projectTitle]);

  // Keep projectIdRef in sync so the debounced callback always sees the latest value
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // Content fingerprint: only includes things that matter for saving.
  // Deliberately excludes viewState (zoom/pan) so scrolling/zooming never triggers a save.
  const contentKey = useMemo(() => {
    return pages
      .map((p) =>
        `${p.id}:${p.name}:${p.order}:${p.size?.width ?? 0}x${p.size?.height ?? 0}:${JSON.stringify(p.background)}:${p.objects.length}:${JSON.stringify(p.objects)}`
      )
      .join('||');
  }, [pages]);

  useEffect(() => {
    // Skip the very first mount render — we don't want to overwrite a project
    // the moment the editor mounts before the parent has a chance to load a project from storage.
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    const totalObjects = pagesRef.current.reduce((sum, p) => sum + p.objects.length, 0);

    // Guard: don't create a brand-new project if canvas is still empty
    if (projectIdRef.current === null && totalObjects === 0) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      const pages = pagesRef.current;
      const activePageId = activePageIdRef.current;
      const projectTitle = projectTitleRef.current;
      const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
      const canvasSize = activePage?.size ?? { width: 1080, height: 1080 };

      let currentProjectId = projectIdRef.current;
      const isNew = currentProjectId === null;

      if (isNew) {
        currentProjectId = generateProjectId();
        projectIdRef.current = currentProjectId;
        createdAtRef.current = Date.now();
        onProjectCreated(currentProjectId);
      }

      let thumbnail: string | undefined;
      try {
        const stage = getStage();
        if (stage) {
          // Temporarily suppress Konva's internal error logger so a tainted canvas
          // (cross-origin image with missing CORS headers) doesn't spam the console.
          // Konva catches the SecurityError itself and returns '' — our catch won't fire.
          const originalKonvaError = Konva.Util.error.bind(Konva.Util);
          Konva.Util.error = () => undefined;
          try {
            const result = stage.toDataURL({ mimeType: 'image/jpeg', quality: 0.3, pixelRatio: 0.3 });
            if (result && result.startsWith('data:image/')) {
              thumbnail = result;
            }
          } finally {
            Konva.Util.error = originalKonvaError;
          }
        }
      } catch {
        // Thumbnail capture failure is non-fatal
      }

      const now = Date.now();
      const project: Project = {
        id: currentProjectId,
        title: projectTitle,
        createdAt: isNew ? createdAtRef.current : now,
        updatedAt: now,
        thumbnail,
        pages: pages.map(pageToProjectPage),
        activePageId,
        canvasSize,
        customFonts: customFontsRef.current?.length ? customFontsRef.current : undefined,
        isMockupEnabled: isMockupEnabledRef.current ?? false,
      };

      // For existing projects, preserve original createdAt from storage
      if (!isNew) {
        try {
          const stored = localStorage.getItem('ca_projects');
          if (stored) {
            const all = JSON.parse(stored) as Record<string, Project>;
            if (all[currentProjectId]) {
              project.createdAt = all[currentProjectId].createdAt;
            }
          }
        } catch {
          // ignore
        }
      }

      saveProject(project);
      setLastProjectId(currentProjectId);
      onSaved?.();
    }, DEBOUNCE_MS);
  // contentKey changes only when objects/background/page-structure change — not on zoom/pan
  // projectTitle and isMockupEnabled are tracked via refs for the callback but also in deps to trigger saves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, projectTitle, isMockupEnabled]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
};

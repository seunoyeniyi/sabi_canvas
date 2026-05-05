import { useEffect, useMemo, useRef } from 'react';
import Konva from 'konva';
import { captureSafeAreaThumbnail } from '@sabi-canvas/hooks/useCanvasExport';
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
  /**
   * Optional external save handler. When provided the hook calls this instead
   * of writing to localStorage, enabling cloud/backend storage.
   * Receives the fully-built Project object. Returning a rejected promise is
   * treated as a non-fatal error (auto-save continues on next change).
   */
  onSave?: (project: Project) => Promise<void>;
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
  onSave,
  customFonts,
  isMockupEnabled,
}: UseAutoSaveOptions): void => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectIdRef = useRef<string | null>(projectId);
  const isFirstMountRef = useRef(true);
  const createdAtRef = useRef<number>(Date.now());
  const onSaveRef = useRef<((project: Project) => Promise<void>) | undefined>(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

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

  // Track font list changes explicitly so uploading/deleting custom fonts
  // also triggers a save even when canvas objects did not change.
  const customFontsKey = useMemo(() => {
    if (!customFonts || customFonts.length === 0) return '[]';
    return JSON.stringify(
      customFonts.map((font) => ({
        id: font.id,
        family: font.family,
        fileName: font.fileName,
        mimeType: font.mimeType,
        createdAt: font.createdAt,
        assetSrc: font.assetSrc,
        assetPublicId: font.assetPublicId,
      }))
    );
  }, [customFonts]);

  useEffect(() => {
    // Skip the very first mount render — we don't want to overwrite a project
    // the moment the editor mounts before the parent has a chance to load a project from storage.
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    const totalObjects = pagesRef.current.reduce((sum, p) => sum + (p.objects?.length ?? 0), 0);

    // Guard: don't create a brand-new project if canvas is still empty
    if (projectIdRef.current === null && totalObjects === 0) {
      return;
    }

    // Guard: if an external onSave handler is registered but projectId is null,
    // we have no valid backend ID to write to — skip until projectId is available.
    if (onSaveRef.current && projectIdRef.current === null) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
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

      // Capture thumbnail cropped to the safe area (design area only, not the whole viewport).
      let thumbnail: string | undefined;
      try {
        const stage = getStage();
        if (stage) {
          const result = await captureSafeAreaThumbnail(stage, canvasSize, activePage?.background);
          if (result) thumbnail = result;
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
      // (only needed for the localStorage path)
      if (!isNew && !onSaveRef.current) {
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

      if (onSaveRef.current) {
        // External (cloud) save path — caller owns storage
        onSaveRef.current(project).then(() => {
          onSaved?.();
        }).catch(() => {
          // Non-fatal; will retry on next content change
        });
      } else {
        // Local-storage fallback path (backward compatible)
        saveProject(project);
        setLastProjectId(currentProjectId);
        onSaved?.();
      }
    }, DEBOUNCE_MS);
  // contentKey changes only when objects/background/page-structure change — not on zoom/pan
  // customFontsKey ensures custom font add/delete is persisted even without object edits
  // projectTitle and isMockupEnabled are tracked via refs for the callback but also in deps to trigger saves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, customFontsKey, projectTitle, isMockupEnabled]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);
};

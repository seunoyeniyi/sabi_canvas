import { useCallback, useEffect, useMemo, useRef } from 'react';
import Konva from 'konva';
import { captureSafeAreaThumbnail } from '@sabi-canvas/hooks/useCanvasExport';
import { CanvasPage } from '@sabi-canvas/types/pages';
import { Project, generateProjectId, pageToProjectPage } from '@sabi-canvas/types/project';
import { saveProject, setLastProjectId } from '@sabi-canvas/hooks/useProjectManager';
import type { CustomFont } from '@sabi-canvas/types/custom-fonts';
import type { CanvasObject, ImageObject } from '@sabi-canvas/types/canvas-objects';
import type { EditorSaveState } from '@sabi-canvas/types/editor';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

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
  /** Goes up each time a design is loaded; changes are counted afresh from then. */
  loadVersion?: number;
}

/**
 * Fields the editor fills in by itself (a text's height once its font loads,
 * a picture's own size and colours): left out when comparing designs, so they
 * never count as the user's changes.
 */
function withoutDerivedFields(object: CanvasObject) {
  if (object.type === 'text') {
    const { height: _height, ...rest } = object as CanvasObject & { height?: number };
    return rest;
  }
  if (object.type === 'image') {
    const { naturalWidth: _w, naturalHeight: _h, svgPalette: _p, ...rest } = object as ImageObject & { svgPalette?: unknown };
    return rest;
  }
  return object;
}

export interface UseAutoSaveResult {
  /**
   * The design as it is right now, with a freshly captured thumbnail: what
   * the next auto-save would send. Saves nothing. `id` is empty for a design
   * that hasn't been saved yet.
   */
  snapshot: () => Promise<Project>;
  /** Whether leaving would lose changes. See `EditorSaveState`. */
  saveState: () => EditorSaveState;
  /** The design as it is now counts as saved. */
  markSaved: () => void;
  /** Call on the user's first touch, click or key press: changes count from then. */
  noteInteraction: () => void;
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
  loadVersion = 0,
}: UseAutoSaveOptions): UseAutoSaveResult => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectIdRef = useRef<string | null>(projectId);
  const isFirstMountRef = useRef(true);
  const createdAtRef = useRef<number>(Date.now());
  const onSaveRef = useRef<((project: Project) => Promise<void>) | undefined>(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const customFontsRef = useRef<CustomFont[] | undefined>(customFonts);
  useEffect(() => { customFontsRef.current = customFonts; }, [customFonts]);

  // Thumbnail size and quality from the host's config (config.thumbnail).
  const { thumbnail: thumbnailConfig } = useSabiCanvasConfig();
  const thumbnailConfigRef = useRef(thumbnailConfig);
  useEffect(() => { thumbnailConfigRef.current = thumbnailConfig; }, [thumbnailConfig]);

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

  // The design and its thumbnail, from the latest state. Shared by auto-save
  // and snapshot() so both always describe the design the same way.
  const captureProject = useCallback(async (id: string, createdAt: number): Promise<Project> => {
    const pages = pagesRef.current;
    const activePageId = activePageIdRef.current;
    const activePage = pages.find((p) => p.id === activePageId) ?? pages[0];
    const canvasSize = activePage?.size ?? { width: 1080, height: 1080 };

    // Cropped to the safe area (the design itself, not the whole viewport)
    let thumbnail: string | undefined;
    try {
      const stage = getStage();
      if (stage) {
        const result = await captureSafeAreaThumbnail(stage, canvasSize, activePage?.background, thumbnailConfigRef.current);
        if (result) thumbnail = result;
      }
    } catch {
      // Thumbnail capture failure is non-fatal
    }

    return {
      id,
      title: projectTitleRef.current,
      createdAt,
      updatedAt: Date.now(),
      thumbnail,
      pages: pages.map(pageToProjectPage),
      activePageId,
      canvasSize,
      customFonts: customFontsRef.current?.length ? customFontsRef.current : undefined,
      isMockupEnabled: isMockupEnabledRef.current ?? false,
    };
  }, [getStage]);

  const snapshot = useCallback(
    () => captureProject(projectIdRef.current ?? '', createdAtRef.current),
    [captureProject],
  );

  // ── Unsaved changes ──────────────────────────────────────────────────────
  // `openedKey`: the design when the user first touched it after it opened
  // (null until then: nothing they did yet). `savedKey`: the design last
  // saved, or as opened. Both are fingerprints of what's saved.
  const openedKeyRef = useRef<string | null>(null);
  const savedKeyRef = useRef<string | null>(null);
  const savesInFlightRef = useRef(0);

  const designKey = useCallback(() => JSON.stringify([
    pagesRef.current.map((p) => [p.id, p.name, p.order, p.size, p.background, p.objects.map(withoutDerivedFields)]),
    projectTitleRef.current,
    (customFontsRef.current ?? []).map((font) => font.id),
    isMockupEnabledRef.current ?? false,
  ]), []);

  // A design loaded (opened, switched, new): changes count afresh
  useEffect(() => {
    openedKeyRef.current = null;
    savedKeyRef.current = null;
  }, [loadVersion]);

  const noteInteraction = useCallback(() => {
    if (openedKeyRef.current !== null) return;
    const key = designKey();
    openedKeyRef.current = key;
    savedKeyRef.current = key;
  }, [designKey]);

  const markSaved = useCallback(() => {
    const key = designKey();
    openedKeyRef.current = key;
    savedKeyRef.current = key;
  }, [designKey]);

  const saveState = useCallback((): EditorSaveState => {
    const saving = timerRef.current !== null || savesInFlightRef.current > 0;
    if (openedKeyRef.current === null) return { edited: false, unsaved: false, saving };
    const key = designKey();
    return { edited: key !== openedKeyRef.current, unsaved: key !== savedKeyRef.current, saving };
  }, [designKey]);

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

  // Saves the design as it is now. Run by the debounce timer, and at once
  // when the editor closes with a save still waiting, so leaving never drops it.
  const runSave = async () => {
    let currentProjectId = projectIdRef.current;
    const isNew = currentProjectId === null;

    if (isNew) {
      currentProjectId = generateProjectId();
      projectIdRef.current = currentProjectId;
      createdAtRef.current = Date.now();
      onProjectCreated(currentProjectId);
    }

    // What this save holds, to know later whether it's the latest design
    const savingKey = designKey();
    const touched = openedKeyRef.current !== null;
    const noteSaved = () => {
      if (touched && openedKeyRef.current !== null) savedKeyRef.current = savingKey;
    };
    const project = await captureProject(currentProjectId!, isNew ? createdAtRef.current : Date.now());
    savesInFlightRef.current += 1;

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
      // External (cloud) save path , caller owns storage
      onSaveRef.current(project).then(() => {
        noteSaved();
        onSaved?.();
      }).catch(() => {
        // Non-fatal; will retry on next content change. The changes stay unsaved meanwhile.
      }).finally(() => {
        savesInFlightRef.current -= 1;
      });
    } else {
      // Local-storage fallback path (backward compatible)
      saveProject(project);
      setLastProjectId(currentProjectId);
      noteSaved();
      savesInFlightRef.current -= 1;
      onSaved?.();
    }
  };
  const runSaveRef = useRef(runSave);
  runSaveRef.current = runSave;

  useEffect(() => {
    // Skip the very first mount render , we don't want to overwrite a project
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
    // we have no valid backend ID to write to , skip until projectId is available.
    if (onSaveRef.current && projectIdRef.current === null) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSaveRef.current();
    }, DEBOUNCE_MS);
  // contentKey changes only when objects/background/page-structure change , not on zoom/pan
  // customFontsKey ensures custom font add/delete is persisted even without object edits
  // projectTitle and isMockupEnabled are tracked via refs for the callback but also in deps to trigger saves
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, customFontsKey, projectTitle, isMockupEnabled]);

  // Closing the editor (leaving the page, opening another design) with a
  // save still waiting: save now rather than drop the latest changes
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void runSaveRef.current();
      }
    };
  }, []);

  return { snapshot, saveState, markSaved, noteInteraction };
};

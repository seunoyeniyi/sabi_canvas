/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  CanvasObject,
  GroupObject,
  createDefaultObject,
  createDefaultTableObject,
  createImageObject,
  CanvasObjectType,
  DEFAULT_SHAPE_PROPS,
  generateObjectId,
} from '@sabi-canvas/types/canvas-objects';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { ActivePageImportResult, ActivePageJsonPayload, CanvasBackground, CanvasPage } from '@sabi-canvas/types/pages';

interface CanvasObjectsContextValue {
  pages: CanvasPage[];
  activePageId: string;
  activePage: CanvasPage;

  // Page management
  addPage: () => void;
  deletePage: (id: string) => void;
  renamePage: (id: string, name: string) => void;
  duplicatePage: (id: string) => void;
  reorderPage: (id: string, direction: 'left' | 'right') => void;
  setActivePage: (id: string) => void;
  updatePageViewState: (zoom: number, position: { x: number; y: number }) => void;
  updatePageBackground: (background: CanvasBackground) => void;
  updateActivePageSize: (width: number, height: number) => void;

  objects: CanvasObject[];
  selectedIds: string[];

  // Object management
  addObject: (object: CanvasObject) => void;
  addObjects: (objects: CanvasObject[]) => void;
  addShape: (type: CanvasObjectType, position?: { x: number; y: number }) => void;
  addTable: (rows: number, cols: number, position?: { x: number; y: number }) => void;
  addImage: (
    src: string,
    position?: { x: number; y: number },
    dimensions?: { width: number; height: number }
  ) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  deleteSelectedObjects: (ids?: string[]) => void;
  duplicateSelected: () => boolean;
  duplicateForDrag: (sourceRootIds?: string[]) => { duplicatedRootIds: string[]; rootIdMap: Record<string, string> } | null;
  copySelected: () => boolean;
  cutSelected: () => boolean;
  pasteClipboard: () => boolean;
  nudgeSelected: (dx: number, dy: number) => boolean;
  groupSelected: () => boolean;
  ungroupSelected: () => boolean;

  // Selection management
  selectObject: (id: string, addToSelection?: boolean) => void;
  selectObjects: (ids: string[], append?: boolean) => void;
  deselectAll: () => void;
  selectAll: () => void;

  // Object ordering
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  reorderObjects: (orderedIds: string[]) => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Placement helpers
  getCustomerModePlacement: (objWidth: number, objHeight: number) => { x: number; y: number; width: number; height: number };

  // Dev JSON import/export
  exportActivePageJson: () => ActivePageJsonPayload;
  importActivePageJson: (payload: unknown) => ActivePageImportResult;

  // Project persistence
  loadProjectData: (pages: CanvasPage[], activePageId: string, fallbackSize?: { width: number; height: number }) => void;
}

const CanvasObjectsContext = createContext<CanvasObjectsContextValue | undefined>(undefined);

interface CanvasObjectsProviderProps {
  children: React.ReactNode;
}

const generatePageId = () => `page_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const VALID_OBJECT_TYPES: readonly CanvasObjectType[] = [
  'rectangle',
  'circle',
  'ellipse',
  'triangle',
  'polygon',
  'star',
  'line',
  'arrow',
  'path',
  'text',
  'image',
  'group',
  'table',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isSupportedObjectType = (value: unknown): value is CanvasObjectType =>
  typeof value === 'string' && VALID_OBJECT_TYPES.includes(value as CanvasObjectType);

const hasValidBaseObjectShape = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;

  return (
    isSupportedObjectType(value.type) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.rotation) &&
    isFiniteNumber(value.scaleX) &&
    isFiniteNumber(value.scaleY) &&
    isFiniteNumber(value.opacity)
  );
};

const isValidViewState = (value: unknown): value is CanvasPage['viewState'] => {
  if (!isRecord(value) || !isRecord(value.position)) return false;

  return (
    isFiniteNumber(value.zoom) &&
    isFiniteNumber(value.position.x) &&
    isFiniteNumber(value.position.y)
  );
};

const createEmptyPage = (name: string, order: number, size?: { width: number; height: number }): CanvasPage => ({
  id: generatePageId(),
  name,
  order,
  size,
  objects: [],
  selectedIds: [],
  past: [],
  future: [],
  viewState: {
    zoom: 1,
    position: { x: 0, y: 0 },
  },
  background: { type: 'solid', color: '#ffffff' },
});

const getObjectMap = (objects: CanvasObject[]): Map<string, CanvasObject> => {
  return new Map(objects.map((object) => [object.id, object]));
};

const getChildMap = (objects: CanvasObject[]): Map<string, string[]> => {
  const childMap = new Map<string, string[]>();

  objects.forEach((object) => {
    if (object.parentId) {
      const current = childMap.get(object.parentId) ?? [];
      current.push(object.id);
      childMap.set(object.parentId, current);
    }
  });

  return childMap;
};

const getDescendantIds = (
  rootId: string,
  objectMap: Map<string, CanvasObject>,
  childMap: Map<string, string[]>
): string[] => {
  const descendants: string[] = [];
  const stack = [...(childMap.get(rootId) ?? [])];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId) continue;

    if (!objectMap.has(currentId)) continue;
    descendants.push(currentId);

    const children = childMap.get(currentId);
    if (children && children.length > 0) {
      stack.push(...children);
    }
  }

  return descendants;
};

const getSubtreeIdSet = (
  rootId: string,
  objectMap: Map<string, CanvasObject>,
  childMap: Map<string, string[]>
): Set<string> => {
  const ids = new Set<string>([rootId]);
  getDescendantIds(rootId, objectMap, childMap).forEach((id) => ids.add(id));
  return ids;
};

const getTopLevelSelection = (selectedIds: string[], objectMap: Map<string, CanvasObject>): string[] => {
  const selectedSet = new Set(selectedIds);

  return selectedIds.filter((id) => {
    let cursor = objectMap.get(id)?.parentId;

    while (cursor) {
      if (selectedSet.has(cursor)) return false;
      cursor = objectMap.get(cursor)?.parentId;
    }

    return true;
  });
};

const applyParentTransform = (
  parent: Pick<CanvasObject, 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY'>,
  child: CanvasObject
) => {
  const angle = (parent.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const offset = (() => {
    if (child.type === 'circle') return { x: Math.min(child.width, child.height) / 2, y: Math.min(child.width, child.height) / 2 };
    if (child.type === 'ellipse') return { x: (child as any).radiusX, y: (child as any).radiusY };
    if (child.type === 'triangle' || child.type === 'polygon' || child.type === 'star') return { x: child.width / 2, y: child.height / 2 };
    return { x: 0, y: 0 };
  })();

  const nodeLocalX = child.x + offset.x;
  const nodeLocalY = child.y + offset.y;

  const scaledLocalX = nodeLocalX * parent.scaleX;
  const scaledLocalY = nodeLocalY * parent.scaleY;

  const rotatedX = scaledLocalX * cos - scaledLocalY * sin;
  const rotatedY = scaledLocalX * sin + scaledLocalY * cos;

  return {
    x: parent.x + rotatedX - offset.x,
    y: parent.y + rotatedY - offset.y,
    rotation: parent.rotation + child.rotation,
    scaleX: parent.scaleX * child.scaleX,
    scaleY: parent.scaleY * child.scaleY,
  };
};

const synchronizeGroupChildren = (objects: CanvasObject[]): CanvasObject[] => {
  const childMap = getChildMap(objects);
  let hasChanges = false;

  const next = objects.map((obj) => {
    if (obj.type !== 'group') return obj;

    const derivedChildren = childMap.get(obj.id) ?? [];
    if (
      obj.childrenIds.length === derivedChildren.length
      && obj.childrenIds.every((id, index) => id === derivedChildren[index])
    ) {
      return obj;
    }

    hasChanges = true;
    return {
      ...obj,
      childrenIds: derivedChildren,
    } as GroupObject;
  });

  return hasChanges ? next : objects;
};

export const CanvasObjectsProvider: React.FC<CanvasObjectsProviderProps> = ({ children }) => {
  const [pages, setPages] = useState<CanvasPage[]>(() => [createEmptyPage('Page 1', 0)]);
  const [activePageId, setActivePageId] = useState<string>(() => pages[0].id);

  const activePage = useMemo<CanvasPage>(() => {
    const found = pages.find((p) => p.id === activePageId);
    return found ?? pages[0] ?? createEmptyPage('Page 1', 0);
  }, [pages, activePageId]);

  const objects = activePage.objects;
  const selectedIds = activePage.selectedIds;
  const past = activePage.past;
  const future = activePage.future;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardRef = useRef<CanvasObject[]>([]);
  const pasteCountRef = useRef(1);
  const { canvasSize, setCanvasSize, editorMode, isMockupEnabled } = useEditor();

  const cloneCanvasObject = useCallback((obj: CanvasObject): CanvasObject => {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj)) as CanvasObject;
  }, []);

  const modifyActivePage = useCallback(
    (updater: (page: CanvasPage) => CanvasPage) => {
      setPages((prev) => {
        const hasActive = prev.some((p) => p.id === activePageId);
        const safePages = hasActive ? prev : prev.length > 0 ? prev : [createEmptyPage('Page 1', 0)];
        return safePages.map((p) => (p.id === activePageId ? updater(p) : p));
      });
    },
    [activePageId]
  );

  const modifyObjects = useCallback(
    (updater: (prev: CanvasObject[]) => CanvasObject[], debounce = false) => {
      modifyActivePage((page) => {
        const prevObjs = page.objects;
        const nextObjs = synchronizeGroupChildren(updater(prevObjs));
        if (prevObjs === nextObjs) return page;

        let newPast = page.past;
        let newFuture = page.future;

        if (debounce) {
          if (!debounceTimerRef.current) {
            newPast = [...newPast, prevObjs];
            newFuture = [];
          }
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
          }, 500);
        } else {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          newPast = [...newPast, prevObjs];
          newFuture = [];
        }

        return { ...page, objects: nextObjs, past: newPast, future: newFuture };
      });
    },
    [modifyActivePage]
  );

  const addPage = useCallback(() => {
    setPages((prev) => {
      const currentActive = prev.find((p) => p.id === activePageId) ?? prev[0];
      const size = currentActive?.size ?? canvasSize;
      const nextPage = createEmptyPage(`Page ${prev.length + 1}`, prev.length, size);
      setActivePageId(nextPage.id);
      return [...prev, nextPage];
    });
  }, [activePageId, canvasSize]);

  const deletePage = useCallback(
    (id: string) => {
      setPages((prev) => {
        if (prev.length <= 1) {
          const replacement = createEmptyPage('Page 1', 0, prev[0]?.size ?? canvasSize);
          setActivePageId(replacement.id);
          return [replacement];
        }

        const filtered = prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i }));
        if (!filtered.some((p) => p.id === activePageId)) {
          const targetId = filtered[0].id;
          setActivePageId(targetId);
          return filtered.map((p) =>
            p.id === targetId ? { ...p, viewState: { zoom: 1, position: { x: 0, y: 0 } } } : p
          );
        }
        return filtered;
      });
    },
    [activePageId, canvasSize]
  );

  const renamePage = useCallback((id: string, name: string) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);

  const duplicatePage = useCallback(
    (id: string) => {
      setPages((prev) => {
        const idx = prev.findIndex((p) => p.id === id);
        if (idx === -1) return prev;

        const pageToDup = prev[idx];
        const duplicated: CanvasPage = {
          ...pageToDup,
          id: generatePageId(),
          name: `${pageToDup.name} Copy`,
          order: idx + 1,
          objects: pageToDup.objects.map(cloneCanvasObject),
          selectedIds: [],
          past: [],
          future: [],
          viewState: { zoom: 1, position: { x: 0, y: 0 } },
        };

        const shiftedTail = prev.slice(idx + 1).map((p) => ({ ...p, order: p.order + 1 }));
        const merged = [...prev.slice(0, idx + 1), duplicated, ...shiftedTail];
        setActivePageId(duplicated.id);
        return merged;
      });
    },
    [cloneCanvasObject]
  );

  const reorderPage = useCallback((id: string, direction: 'left' | 'right') => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;

      if (direction === 'left' && idx > 0) {
        const next = [...prev];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next.map((p, i) => ({ ...p, order: i }));
      }

      if (direction === 'right' && idx < prev.length - 1) {
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next.map((p, i) => ({ ...p, order: i }));
      }

      return prev;
    });
  }, []);

  const setActivePage = useCallback((id: string) => {
    setActivePageId(id);
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, viewState: { zoom: 1, position: { x: 0, y: 0 } } } : p
      )
    );
  }, []);

  const updatePageViewState = useCallback(
    (zoom: number, position: { x: number; y: number }) => {
      modifyActivePage((page) => ({ ...page, viewState: { zoom, position } }));
    },
    [modifyActivePage]
  );

  const updatePageBackground = useCallback(
    (background: CanvasBackground) => {
      modifyActivePage((page) => ({ ...page, background }));
    },
    [modifyActivePage]
  );

  const updateActivePageSize = useCallback(
    (width: number, height: number) => {
      const size = { width, height };
      modifyActivePage((page) => ({ ...page, size }));
      setCanvasSize(size);
    },
    [modifyActivePage, setCanvasSize]
  );

  // Sync EditorContext canvasSize whenever the active page changes
  useEffect(() => {
    if (activePage.size) {
      setCanvasSize(activePage.size);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage.id]);

  const getCenterPosition = useCallback(
    (objWidth: number, objHeight: number) => ({
      x: (canvasSize.width - objWidth) / 2,
      y: (canvasSize.height - objHeight) / 2,
    }),
    [canvasSize]
  );

  // In customer mode with a print area, center and scale new objects to fit within the print area.
  // Falls back to normal canvas centering when not in customer mode or no print area exists.
  const getCustomerModePlacement = useCallback(
    (objWidth: number, objHeight: number): { x: number; y: number; width: number; height: number } => {
      const printArea = isMockupEnabled && editorMode === 'customer'
        ? objects.find((o) => o.type === 'print-area')
        : null;

      if (!printArea) {
        const pos = getCenterPosition(objWidth, objHeight);
        return { x: pos.x, y: pos.y, width: objWidth, height: objHeight };
      }

      // Scale down proportionally to fit within the print area (never scale up)
      const scaleFactor = Math.min(printArea.width / objWidth, printArea.height / objHeight, 1);
      const scaledW = Math.round(objWidth * scaleFactor);
      const scaledH = Math.round(objHeight * scaleFactor);

      // Center within the print area
      return {
        x: printArea.x + (printArea.width - scaledW) / 2,
        y: printArea.y + (printArea.height - scaledH) / 2,
        width: scaledW,
        height: scaledH,
      };
    },
    [isMockupEnabled, editorMode, objects, getCenterPosition]
  );

  const setPageSelectedIds = useCallback(
    (updater: string[] | ((prev: string[]) => string[])) => {
      modifyActivePage((page) => {
        const nextSelected = typeof updater === 'function' ? updater(page.selectedIds) : updater;
        return { ...page, selectedIds: nextSelected };
      });
    },
    [modifyActivePage]
  );

  const addObject = useCallback(
    (object: CanvasObject) => {
      let tagged = object;
      if (isMockupEnabled && object.type !== 'print-area' && !object.objectRole) {
        if (editorMode === 'customer') {
          tagged = { ...object, objectRole: 'customer' };
        } else if (editorMode === 'mockup-design') {
          tagged = { ...object, objectRole: 'mockup' };
        }
      }
      modifyObjects((prev) => [...prev, tagged], false);
      setPageSelectedIds([tagged.id]);
    },
    [editorMode, isMockupEnabled, modifyObjects, setPageSelectedIds]
  );

  const addObjects = useCallback(
    (newObjects: CanvasObject[]) => {
      if (newObjects.length === 0) return;
      const tagged = isMockupEnabled
        ? newObjects.map((o) => {
            if (o.type === 'print-area' || o.objectRole) return o;
            if (editorMode === 'customer') return { ...o, objectRole: 'customer' as const };
            if (editorMode === 'mockup-design') return { ...o, objectRole: 'mockup' as const };
            return o;
          })
        : newObjects;
      modifyObjects((prev) => [...prev, ...tagged], false);
      setPageSelectedIds(tagged.map((o) => o.id));
    },
    [editorMode, isMockupEnabled, modifyObjects, setPageSelectedIds]
  );

  const addShape = useCallback(
    (type: CanvasObjectType, position?: { x: number; y: number }) => {
      const shapeProps = DEFAULT_SHAPE_PROPS[type as keyof typeof DEFAULT_SHAPE_PROPS];
      const defaultW = shapeProps?.width ?? 200;
      const defaultH = shapeProps?.height ?? 200;
      if (position) {
        addObject(createDefaultObject(type, position));
      } else {
        const p = getCustomerModePlacement(defaultW, defaultH);
        const obj = createDefaultObject(type, { x: p.x, y: p.y });
        addObject(p.width !== defaultW || p.height !== defaultH ? { ...obj, width: p.width, height: p.height } : obj);
      }
    },
    [addObject, getCustomerModePlacement]
  );

  const addTable = useCallback(
    (rows: number, cols: number, position?: { x: number; y: number }) => {
      const defaultW = 400;
      const defaultH = 300;
      if (position) {
        addObject(createDefaultTableObject(rows, cols, position, defaultW, defaultH));
      } else {
        const p = getCustomerModePlacement(defaultW, defaultH);
        addObject(createDefaultTableObject(rows, cols, { x: p.x, y: p.y }, p.width, p.height));
      }
    },
    [addObject, getCustomerModePlacement]
  );

  const addImage = useCallback(
    (src: string, position?: { x: number; y: number }, dimensions = { width: 300, height: 300 }) => {
      if (position) {
        addObject(createImageObject(src, position, dimensions));
      } else {
        const p = getCustomerModePlacement(dimensions.width, dimensions.height);
        addObject(createImageObject(src, { x: p.x, y: p.y }, { width: p.width, height: p.height }));
      }
    },
    [addObject, getCustomerModePlacement]
  );

  const updateObject = useCallback(
    (id: string, updates: Partial<CanvasObject>) => {
      modifyObjects(
        (prev) => prev.map((obj) => (obj.id === id ? ({ ...obj, ...updates } as CanvasObject) : obj)),
        true
      );
    },
    [modifyObjects]
  );

  const deleteObject = useCallback(
    (id: string) => {
      const objectMap = getObjectMap(objects);
      const childMap = getChildMap(objects);
      const idsToDelete = getSubtreeIdSet(id, objectMap, childMap);

      modifyObjects((prev) => {
        const objectMap = getObjectMap(prev);
        const childMap = getChildMap(prev);
        const idsToDelete = getSubtreeIdSet(id, objectMap, childMap);

        const next = prev
          .filter((obj) => !idsToDelete.has(obj.id))
          .map((obj) => {
            if (obj.type !== 'group') return obj;

            const nextChildrenIds = obj.childrenIds.filter((childId) => !idsToDelete.has(childId));
            return nextChildrenIds.length === obj.childrenIds.length
              ? obj
              : ({ ...obj, childrenIds: nextChildrenIds } as GroupObject);
          });

        return next;
      }, false);

      setPageSelectedIds((prev) => {
        return prev.filter((selectedId) => !idsToDelete.has(selectedId));
      });
    },
    [modifyObjects, objects, setPageSelectedIds]
  );

  const deleteSelectedObjects = useCallback((ids?: string[]) => {
    const targetIds = ids ?? selectedIds;
    if (targetIds.length === 0) return;

    modifyObjects((prev) => {
      const objectMap = getObjectMap(prev);
      const childMap = getChildMap(prev);
      const topLevelSelected = getTopLevelSelection(targetIds, objectMap);

      const idsToDelete = new Set<string>();
      topLevelSelected.forEach((selectedId) => {
        idsToDelete.add(selectedId);
        getDescendantIds(selectedId, objectMap, childMap).forEach((id) => idsToDelete.add(id));
      });

      return prev
        .filter((obj) => !idsToDelete.has(obj.id))
        .map((obj) => {
          if (obj.type !== 'group') return obj;
          const nextChildrenIds = obj.childrenIds.filter((childId) => !idsToDelete.has(childId));
          return nextChildrenIds.length === obj.childrenIds.length
            ? obj
            : ({ ...obj, childrenIds: nextChildrenIds } as GroupObject);
        });
    }, false);

    setPageSelectedIds([]);
  }, [selectedIds, modifyObjects, setPageSelectedIds]);

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return false;

    const objectMap = getObjectMap(objects);
    const childMap = getChildMap(objects);
    const rootIds = getTopLevelSelection(selectedIds, objectMap);
    if (rootIds.length === 0) return false;

    const idRemap = new Map<string, string>();
    const idsToCopy = new Set<string>();
    const sourceByNewId = new Map<string, CanvasObject>();

    rootIds.forEach((rootId) => {
      idsToCopy.add(rootId);
      getDescendantIds(rootId, objectMap, childMap).forEach((id) => idsToCopy.add(id));
    });

    const duplicatedObjects: CanvasObject[] = objects
      .filter((obj) => idsToCopy.has(obj.id))
      .map((obj) => {
        const newId = generateObjectId();
        idRemap.set(obj.id, newId);
        sourceByNewId.set(newId, obj);
        return {
          ...cloneCanvasObject(obj),
          id: newId,
        } as CanvasObject;
      })
      .map((obj) => {
        const source = sourceByNewId.get(obj.id);
        if (!source) return obj;

        const isRoot = rootIds.includes(source.id);
        const remappedParentId = source.parentId ? idRemap.get(source.parentId) ?? source.parentId : undefined;

        if (obj.type === 'group') {
          const sourceGroup = source as GroupObject;
          return {
            ...obj,
            parentId: isRoot ? source.parentId : remappedParentId,
            x: isRoot ? source.x + 20 : source.x,
            y: isRoot ? source.y + 20 : source.y,
            childrenIds: sourceGroup.childrenIds
              .map((childId) => idRemap.get(childId))
              .filter((childId): childId is string => Boolean(childId)),
          } as GroupObject;
        }

        return {
          ...obj,
          parentId: isRoot ? source.parentId : remappedParentId,
          x: isRoot ? source.x + 20 : source.x,
          y: isRoot ? source.y + 20 : source.y,
        } as CanvasObject;
      });

    modifyObjects((prev) => [...prev, ...duplicatedObjects], false);
    setPageSelectedIds(rootIds.map((rootId) => idRemap.get(rootId)).filter((id): id is string => Boolean(id)));
    return true;
  }, [cloneCanvasObject, modifyObjects, objects, selectedIds, setPageSelectedIds]);

  const duplicateForDrag = useCallback(
    (sourceRootIds?: string[]) => {
      const objectMap = getObjectMap(objects);
      const childMap = getChildMap(objects);

      const candidateIds = sourceRootIds && sourceRootIds.length > 0 ? sourceRootIds : selectedIds;
      if (candidateIds.length === 0) return null;

      const rootIds = getTopLevelSelection(
        Array.from(new Set(candidateIds.filter((id) => objectMap.has(id)))),
        objectMap
      );
      if (rootIds.length === 0) return null;

      const idRemap = new Map<string, string>();
      const idsToCopy = new Set<string>();
      const sourceByNewId = new Map<string, CanvasObject>();

      rootIds.forEach((rootId) => {
        idsToCopy.add(rootId);
        getDescendantIds(rootId, objectMap, childMap).forEach((id) => idsToCopy.add(id));
      });

      const duplicatedObjects: CanvasObject[] = objects
        .filter((obj) => idsToCopy.has(obj.id))
        .map((obj) => {
          const newId = generateObjectId();
          idRemap.set(obj.id, newId);
          sourceByNewId.set(newId, obj);
          return {
            ...cloneCanvasObject(obj),
            id: newId,
          } as CanvasObject;
        })
        .map((obj) => {
          const source = sourceByNewId.get(obj.id);
          if (!source) return obj;

          const isRoot = rootIds.includes(source.id);
          const remappedParentId = source.parentId ? idRemap.get(source.parentId) ?? source.parentId : undefined;

          if (obj.type === 'group') {
            const sourceGroup = source as GroupObject;
            return {
              ...obj,
              parentId: isRoot ? source.parentId : remappedParentId,
              x: source.x,
              y: source.y,
              childrenIds: sourceGroup.childrenIds
                .map((childId) => idRemap.get(childId))
                .filter((childId): childId is string => Boolean(childId)),
            } as GroupObject;
          }

          return {
            ...obj,
            parentId: isRoot ? source.parentId : remappedParentId,
            x: source.x,
            y: source.y,
          } as CanvasObject;
        });

      const duplicatedRootIds = rootIds
        .map((rootId) => idRemap.get(rootId))
        .filter((id): id is string => Boolean(id));

      if (duplicatedRootIds.length === 0) return null;

      modifyObjects((prev) => [...prev, ...duplicatedObjects], false);
      setPageSelectedIds(duplicatedRootIds);

      const rootIdMap = rootIds.reduce<Record<string, string>>((acc, rootId) => {
        const mappedId = idRemap.get(rootId);
        if (mappedId) {
          acc[rootId] = mappedId;
        }
        return acc;
      }, {});

      return {
        duplicatedRootIds,
        rootIdMap,
      };
    },
    [cloneCanvasObject, modifyObjects, objects, selectedIds, setPageSelectedIds]
  );

  const copySelected = useCallback(() => {
    if (selectedIds.length === 0) return false;

    const objectMap = getObjectMap(objects);
    const childMap = getChildMap(objects);
    const rootIds = getTopLevelSelection(selectedIds, objectMap);
    if (rootIds.length === 0) return false;

    const idsToCopy = new Set<string>();
    rootIds.forEach((rootId) => {
      idsToCopy.add(rootId);
      getDescendantIds(rootId, objectMap, childMap).forEach((id) => idsToCopy.add(id));
    });

    clipboardRef.current = objects
      .filter((obj) => idsToCopy.has(obj.id))
      .map(cloneCanvasObject);

    pasteCountRef.current = 1;
    return true;
  }, [cloneCanvasObject, objects, selectedIds]);

  const cutSelected = useCallback(() => {
    const copied = copySelected();
    if (!copied) return false;

    deleteSelectedObjects();
    return true;
  }, [copySelected, deleteSelectedObjects]);

  const pasteClipboard = useCallback(() => {
    if (clipboardRef.current.length === 0) return false;

    const offset = 20 * pasteCountRef.current;
    const sourceObjects = clipboardRef.current.map(cloneCanvasObject);
    const objectMap = getObjectMap(sourceObjects);
    const idRemap = new Map<string, string>();

    sourceObjects.forEach((obj) => {
      idRemap.set(obj.id, generateObjectId());
    });

    const pastedObjects = sourceObjects.map((obj) => {
      const newId = idRemap.get(obj.id) as string;
      const remappedParentId = obj.parentId ? idRemap.get(obj.parentId) : undefined;
      const isRoot = !obj.parentId || !objectMap.has(obj.parentId);

      if (obj.type === 'group') {
        return {
          ...obj,
          id: newId,
          parentId: remappedParentId,
          x: isRoot ? obj.x + offset : obj.x,
          y: isRoot ? obj.y + offset : obj.y,
          childrenIds: obj.childrenIds
            .map((childId) => idRemap.get(childId))
            .filter((childId): childId is string => Boolean(childId)),
        } as GroupObject;
      }

      return {
        ...obj,
        id: newId,
        parentId: remappedParentId,
        x: isRoot ? obj.x + offset : obj.x,
        y: isRoot ? obj.y + offset : obj.y,
      } as CanvasObject;
    });

    const rootIds = sourceObjects
      .filter((obj) => !obj.parentId || !objectMap.has(obj.parentId))
      .map((obj) => obj.id);

    modifyObjects((prev) => [...prev, ...pastedObjects], false);
    setPageSelectedIds(rootIds.map((id) => idRemap.get(id)).filter((id): id is string => Boolean(id)));
    pasteCountRef.current += 1;
    return true;
  }, [cloneCanvasObject, modifyObjects, setPageSelectedIds]);

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return false;

      const objectMap = getObjectMap(objects);
      const selectedIdSet = new Set(getTopLevelSelection(selectedIds, objectMap));
      modifyObjects(
        (prev) =>
          prev.map((obj) =>
            selectedIdSet.has(obj.id) ? ({ ...obj, x: obj.x + dx, y: obj.y + dy } as CanvasObject) : obj
          ),
        true
      );

      return true;
    },
    [modifyObjects, objects, selectedIds]
  );

  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return false;

    const objectMap = getObjectMap(objects);
    const rootIds = getTopLevelSelection(selectedIds, objectMap);
    if (rootIds.length < 2) return false;

    const selectedObjects = rootIds
      .map((id) => objectMap.get(id))
      .filter((obj): obj is CanvasObject => Boolean(obj));

    if (selectedObjects.length < 2) return false;

    const parentId = selectedObjects[0].parentId;
    if (!selectedObjects.every((obj) => obj.parentId === parentId)) {
      return false;
    }

    const bounds = selectedObjects.reduce(
      (acc, obj) => ({
        minX: Math.min(acc.minX, obj.x),
        minY: Math.min(acc.minY, obj.y),
        maxX: Math.max(acc.maxX, obj.x + obj.width),
        maxY: Math.max(acc.maxY, obj.y + obj.height),
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      }
    );

    const groupId = generateObjectId();

    const groupObject: GroupObject = {
      id: groupId,
      type: 'group',
      parentId,
      x: bounds.minX,
      y: bounds.minY,
      width: Math.max(1, bounds.maxX - bounds.minX),
      height: Math.max(1, bounds.maxY - bounds.minY),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      draggable: true,
      visible: true,
      locked: selectedObjects.every((obj) => obj.locked),
      childrenIds: rootIds,
    };

    modifyObjects((prev) => {
      const selectedSet = new Set(rootIds);
      const next = prev.map((obj) => {
        if (!selectedSet.has(obj.id)) return obj;

        return {
          ...obj,
          parentId: groupId,
          x: obj.x - bounds.minX,
          y: obj.y - bounds.minY,
        } as CanvasObject;
      });

      const insertionIndex = Math.max(
        ...rootIds
          .map((id) => prev.findIndex((obj) => obj.id === id))
          .filter((index) => index >= 0)
      );

      if (!Number.isFinite(insertionIndex)) {
        return [...next, groupObject];
      }

      const output = [...next];
      output.splice(insertionIndex + 1, 0, groupObject);
      return output;
    }, false);

    setPageSelectedIds([groupId]);
    return true;
  }, [modifyObjects, objects, selectedIds, setPageSelectedIds]);

  const ungroupSelected = useCallback(() => {
    if (selectedIds.length === 0) return false;

    const objectMap = getObjectMap(objects);
    const selectedGroups = getTopLevelSelection(selectedIds, objectMap)
      .map((id) => objectMap.get(id))
      .filter((obj): obj is GroupObject => Boolean(obj) && obj.type === 'group');

    if (selectedGroups.length === 0) return false;

    const groupIds = new Set(selectedGroups.map((group) => group.id));
    const selectedChildren: string[] = [];

    modifyObjects((prev) => {
      const prevMap = getObjectMap(prev);
      const next = prev
        .filter((obj) => !groupIds.has(obj.id))
        .map((obj) => {
          if (!obj.parentId || !groupIds.has(obj.parentId)) {
            return obj;
          }

          const parentGroup = prevMap.get(obj.parentId);
          if (!parentGroup || parentGroup.type !== 'group') {
            return { ...obj, parentId: undefined } as CanvasObject;
          }

          const transformed = applyParentTransform(parentGroup, obj);
          selectedChildren.push(obj.id);

          return {
            ...obj,
            parentId: parentGroup.parentId,
            x: transformed.x,
            y: transformed.y,
            rotation: transformed.rotation,
            scaleX: transformed.scaleX,
            scaleY: transformed.scaleY,
          } as CanvasObject;
        })
        .map((obj) => {
          if (obj.type !== 'group') return obj;

          const nextChildrenIds = obj.childrenIds.filter((childId) => !groupIds.has(childId));
          return nextChildrenIds.length === obj.childrenIds.length
            ? obj
            : ({ ...obj, childrenIds: nextChildrenIds } as GroupObject);
        });

      return next;
    }, false);

    setPageSelectedIds(Array.from(new Set(selectedChildren)));
    return true;
  }, [modifyObjects, objects, selectedIds, setPageSelectedIds]);

  const selectObject = useCallback(
    (id: string, addToSelection = false) => {
      const objectMap = getObjectMap(objects);
      let targetId = id;
      let cursor = objectMap.get(id)?.parentId;

      while (cursor) {
        const parent = objectMap.get(cursor);
        if (!parent || parent.type !== 'group') break;
        targetId = parent.id;
        cursor = parent.parentId;
      }

      if (addToSelection) {
        setPageSelectedIds((prev) =>
          prev.includes(targetId) ? prev.filter((sid) => sid !== targetId) : [...prev, targetId]
        );
      } else {
        setPageSelectedIds([targetId]);
      }
    },
    [objects, setPageSelectedIds]
  );

  const selectObjects = useCallback(
    (ids: string[], append = false) => {
      if (append) {
        setPageSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
      } else {
        setPageSelectedIds(ids);
      }
    },
    [setPageSelectedIds]
  );

  const deselectAll = useCallback(() => {
    setPageSelectedIds([]);
  }, [setPageSelectedIds]);

  const selectAll = useCallback(() => {
    setPageSelectedIds(objects.filter((obj) => !obj.parentId).map((obj) => obj.id));
  }, [objects, setPageSelectedIds]);

  const bringToFront = useCallback(
    (id: string) => {
      modifyObjects((prev) => {
        const objectMap = getObjectMap(prev);
        const childMap = getChildMap(prev);
        const subtreeIds = getSubtreeIdSet(id, objectMap, childMap);
        const block = prev.filter((obj) => subtreeIds.has(obj.id));
        if (block.length === 0) return prev;

        const remainder = prev.filter((obj) => !subtreeIds.has(obj.id));
        return [...remainder, ...block];
      }, false);
    },
    [modifyObjects]
  );

  const sendToBack = useCallback(
    (id: string) => {
      modifyObjects((prev) => {
        const objectMap = getObjectMap(prev);
        const childMap = getChildMap(prev);
        const subtreeIds = getSubtreeIdSet(id, objectMap, childMap);
        const block = prev.filter((obj) => subtreeIds.has(obj.id));
        if (block.length === 0) return prev;

        const remainder = prev.filter((obj) => !subtreeIds.has(obj.id));
        return [...block, ...remainder];
      }, false);
    },
    [modifyObjects]
  );

  const bringForward = useCallback(
    (id: string) => {
      modifyObjects((prev) => {
        const index = prev.findIndex((o) => o.id === id);
        if (index === -1 || index === prev.length - 1) return prev;
        const next = [...prev];
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
        return next;
      }, false);
    },
    [modifyObjects]
  );

  const sendBackward = useCallback(
    (id: string) => {
      modifyObjects((prev) => {
        const index = prev.findIndex((o) => o.id === id);
        if (index <= 0) return prev;
        const next = [...prev];
        [next[index], next[index - 1]] = [next[index - 1], next[index]];
        return next;
      }, false);
    },
    [modifyObjects]
  );

  const reorderObjects = useCallback(
    (orderedIds: string[]) => {
      modifyObjects((prev) => {
        const objectMap = getObjectMap(prev);
        const childMap = getChildMap(prev);
        const result: CanvasObject[] = [];
        for (const id of orderedIds) {
          const subtreeIds = getSubtreeIdSet(id, objectMap, childMap);
          // preserve the original relative order of each subtree
          prev.filter((o) => subtreeIds.has(o.id)).forEach((o) => result.push(o));
        }
        // append any remaining objects not in orderedIds (shouldn't happen, safety net)
        prev.forEach((o) => {
          if (!result.find((r) => r.id === o.id)) result.push(o);
        });
        return result;
      }, false);
    },
    [modifyObjects]
  );

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    clearDebounceTimer();

    modifyActivePage((page) => {
      const previousState = page.past[page.past.length - 1];
      const newPast = page.past.slice(0, page.past.length - 1);

      return {
        ...page,
        past: newPast,
        future: [...page.future, page.objects],
        objects: previousState,
        selectedIds: [],
      };
    });
  }, [past.length, clearDebounceTimer, modifyActivePage]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    clearDebounceTimer();

    modifyActivePage((page) => {
      const nextState = page.future[page.future.length - 1];
      const newFuture = page.future.slice(0, page.future.length - 1);

      return {
        ...page,
        future: newFuture,
        past: [...page.past, page.objects],
        objects: nextState,
        selectedIds: [],
      };
    });
  }, [future.length, clearDebounceTimer, modifyActivePage]);

  const loadProjectData = useCallback(
    (incomingPages: CanvasPage[], incomingActivePageId: string, fallbackSize?: { width: number; height: number }) => {
      clearDebounceTimer();
      const hydrated = incomingPages.map((page) => ({
        ...page,
        size: page.size ?? fallbackSize,
        selectedIds: [],
        past: [] as CanvasPage['past'],
        future: [] as CanvasPage['future'],
      }));
      const first = hydrated[0];
      if (!first) return;
      setPages(hydrated);
      const targetId = hydrated.some((p) => p.id === incomingActivePageId)
        ? incomingActivePageId
        : first.id;
      setActivePageId(targetId);
      const targetPage = hydrated.find((p) => p.id === targetId) ?? first;
      const sizeToApply = targetPage.size ?? fallbackSize;
      if (sizeToApply) {
        setCanvasSize(sizeToApply);
      }
    },
    [clearDebounceTimer, setCanvasSize]
  );

  const exportActivePageJson = useCallback((): ActivePageJsonPayload => {
    return {
      version: 1,
      pageName: activePage.name,
      viewState: {
        zoom: activePage.viewState.zoom,
        position: {
          x: activePage.viewState.position.x,
          y: activePage.viewState.position.y,
        },
      },
      objects: activePage.objects.map(cloneCanvasObject),
      background: activePage.background,
    };
  }, [activePage.name, activePage.objects, activePage.viewState.position.x, activePage.viewState.position.y, activePage.viewState.zoom, cloneCanvasObject]);

  const importActivePageJson = useCallback(
    (payload: unknown): ActivePageImportResult => {
      if (!isRecord(payload)) {
        return { success: false, error: 'Invalid JSON payload.' };
      }

      if (!Array.isArray(payload.objects)) {
        return { success: false, error: 'Payload must contain an objects array.' };
      }

      const maybeViewState = payload.viewState;
      if (typeof maybeViewState !== 'undefined' && !isValidViewState(maybeViewState)) {
        return { success: false, error: 'Payload viewState is invalid.' };
      }

      const parsedObjects: CanvasObject[] = [];
      for (const item of payload.objects) {
        if (!hasValidBaseObjectShape(item)) {
          return { success: false, error: 'One or more objects are invalid or unsupported.' };
        }

        if (item.type === 'group' && (!Array.isArray(item.childrenIds) || !item.childrenIds.every((id) => typeof id === 'string'))) {
          return { success: false, error: 'One or more group objects are invalid.' };
        }

        parsedObjects.push(item as unknown as CanvasObject);
      }

      const idRemap = new Map<string, string>();
      parsedObjects.forEach((obj) => {
        idRemap.set(obj.id, generateObjectId());
      });

      const nextObjects: CanvasObject[] = parsedObjects.map((obj) => {
        const nextId = idRemap.get(obj.id) as string;
        const nextParentId = obj.parentId ? idRemap.get(obj.parentId) : undefined;

        if (obj.type === 'group') {
          return {
            ...obj,
            id: nextId,
            parentId: nextParentId,
            childrenIds: obj.childrenIds
              .map((childId) => idRemap.get(childId))
              .filter((childId): childId is string => Boolean(childId)),
          } as GroupObject;
        }

        return {
          ...obj,
          id: nextId,
          parentId: nextParentId,
        } as CanvasObject;
      });

      clearDebounceTimer();

      const maybeBackground = payload.background as CanvasBackground | undefined;

      modifyActivePage((page) => ({
        ...page,
        objects: nextObjects,
        selectedIds: [],
        past: [...page.past, page.objects],
        future: [],
        viewState: isValidViewState(maybeViewState) ? maybeViewState : page.viewState,
        background: maybeBackground !== undefined ? maybeBackground : page.background,
      }));

      return { success: true, importedCount: nextObjects.length };
    },
    [clearDebounceTimer, modifyActivePage]
  );

  const value = useMemo<CanvasObjectsContextValue>(
    () => ({
      pages,
      activePageId,
      activePage,
      addPage,
      deletePage,
      renamePage,
      duplicatePage,
      reorderPage,
      setActivePage,
      updatePageViewState,
      updatePageBackground,
      updateActivePageSize,
      objects,
      selectedIds,
      addObject,
      addObjects,
      addShape,
      addTable,
      addImage,
      updateObject,
      deleteObject,
      deleteSelectedObjects,
      duplicateSelected,
      duplicateForDrag,
      copySelected,
      cutSelected,
      pasteClipboard,
      nudgeSelected,
      groupSelected,
      ungroupSelected,
      selectObject,
      selectObjects,
      deselectAll,
      selectAll,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      reorderObjects,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      undo,
      redo,
      getCustomerModePlacement,
      exportActivePageJson,
      importActivePageJson,
      loadProjectData,
    }),
    [
      pages,
      activePageId,
      activePage,
      addPage,
      deletePage,
      renamePage,
      duplicatePage,
      reorderPage,
      updatePageViewState,
      updatePageBackground,
      updateActivePageSize,
      objects,
      selectedIds,
      addObject,
      addObjects,
      addShape,
      addTable,
      addImage,
      updateObject,
      deleteObject,
      deleteSelectedObjects,
      duplicateSelected,
      duplicateForDrag,
      copySelected,
      cutSelected,
      pasteClipboard,
      nudgeSelected,
      groupSelected,
      ungroupSelected,
      selectObject,
      selectObjects,
      deselectAll,
      selectAll,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      reorderObjects,
      past.length,
      future.length,
      undo,
      redo,
      getCustomerModePlacement,
      exportActivePageJson,
      importActivePageJson,
      loadProjectData,
    ]
  );

  return <CanvasObjectsContext.Provider value={value}>{children}</CanvasObjectsContext.Provider>;
};

export const useCanvasObjects = (): CanvasObjectsContextValue => {
  const context = useContext(CanvasObjectsContext);
  if (!context) {
    throw new Error('useCanvasObjects must be used within a CanvasObjectsProvider');
  }
  return context;
};

export default CanvasObjectsContext;

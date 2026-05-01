import { useMemo } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';

/**
 * Hook to get the currently selected object (single selection only)
 * Returns null if no object or multiple objects are selected
 */
export const useSelectedObject = (): CanvasObject | null => {
  const { objects, selectedIds } = useCanvasObjects();

  const selectedObject = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return objects.find(obj => obj.id === selectedIds[0]) || null;
  }, [objects, selectedIds]);

  return selectedObject;
};

/**
 * Hook to get all selected objects
 */
export const useSelectedObjects = (): CanvasObject[] => {
  const { objects, selectedIds } = useCanvasObjects();

  const selectedObjects = useMemo(() => {
    return objects.filter(obj => selectedIds.includes(obj.id));
  }, [objects, selectedIds]);

  return selectedObjects;
};

export default useSelectedObject;

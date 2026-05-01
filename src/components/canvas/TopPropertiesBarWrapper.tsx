import React, { useMemo } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { TopPropertiesBar } from './TopPropertiesBar';
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';

export const TopPropertiesBarWrapper: React.FC = () => {
  const { objects, selectedIds } = useCanvasObjects();
  const { canvasSize } = useEditor();

  const activeObjects = useMemo(
    () =>
      selectedIds
        .map((id) => objects.find((obj) => obj.id === id))
        .filter(Boolean) as CanvasObject[],
    [objects, selectedIds]
  );

  const selectedObject = activeObjects.length > 0 ? activeObjects[0] : null;

  return (
    <TopPropertiesBar
      selectedObject={selectedObject}
      designSize={canvasSize}
    />
  );
};

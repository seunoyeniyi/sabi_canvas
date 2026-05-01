import { useCallback } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useImageUpload } from '@sabi-canvas/hooks/useImageUpload';
import { useRecentUploads } from '@sabi-canvas/hooks/useRecentUploads';
import { CanvasObjectType } from '@sabi-canvas/types/canvas-objects';

/**
 * Shared hook for canvas actions (shapes, images) 
 * to avoid duplicating logic between mobile and desktop toolbars
 */
export const useCanvasActions = () => {
  const { addShape, addImage } = useCanvasObjects();
  const { addUpload } = useRecentUploads();

  const handleImageLoaded = useCallback((src: string, width: number, height: number) => {
    addImage(src, undefined, { width, height });
    addUpload(src, width, height);

    // Provide a neat way for callers to know uploading and canvas addition is complete
    // by dispatching a custom event they can listen to.
    window.dispatchEvent(new Event('canvas_image_added'));
  }, [addImage, addUpload]);

  const { openFilePicker } = useImageUpload({
    onImageLoaded: handleImageLoaded,
    maxSize: 800,
  });

  const handleAddShape = useCallback((type: CanvasObjectType) => {
    addShape(type);
  }, [addShape]);

  const handleAddRectangle = useCallback(() => {
    addShape('rectangle');
  }, [addShape]);

  const handleAddCircle = useCallback(() => {
    addShape('circle');
  }, [addShape]);

  const handleAddEllipse = useCallback(() => {
    addShape('ellipse');
  }, [addShape]);

  const handleAddText = useCallback(() => {
    addShape('text');
  }, [addShape]);

  const handleUploadImage = useCallback(() => {
    openFilePicker();
  }, [openFilePicker]);

  return {
    addShape: handleAddShape,
    addRectangle: handleAddRectangle,
    addCircle: handleAddCircle,
    addEllipse: handleAddEllipse,
    addText: handleAddText,
    uploadImage: handleUploadImage,
  };
};

export default useCanvasActions;

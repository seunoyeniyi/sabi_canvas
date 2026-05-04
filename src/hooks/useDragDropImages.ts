/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useRef, useEffect } from 'react';
import { useImageUpload } from './useImageUpload';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';

interface UseDragDropImagesOptions {
  containerRef: React.RefObject<HTMLElement>;
  stageRef?: React.RefObject<any>;
  onImageAdded?: () => void;
}

export const useDragDropImages = ({
  containerRef,
  stageRef,
  onImageAdded,
}: UseDragDropImagesOptions) => {
  const [isDropActive, setIsDropActive] = useState(false);
  const dragCounterRef = useRef(0);
  const dropPositionRef = useRef<{ x: number; y: number } | null>(null);

  const { addImage, updateObject } = useCanvasObjects();
  const { replacingImageId, setReplacingImageId } = useEditor();

  const handleImageLoaded = useCallback(
    (src: string, width: number, height: number) => {
      const position = dropPositionRef.current || undefined;
      const replacingId = replacingImageId;

      if (replacingId) {
        // Replace mode
        updateObject(replacingId, {
          src,
          removedBgSrc: undefined,
          naturalWidth: undefined,
          naturalHeight: undefined,
          cropX: undefined,
          cropY: undefined,
          cropWidth: undefined,
          cropHeight: undefined,
        } as Partial<CanvasObject>);
        setReplacingImageId(null);
      } else {
        // Add new image
        addImage(src, position, { width, height });
      }

      onImageAdded?.();
    },
    [replacingImageId, updateObject, addImage, setReplacingImageId, onImageAdded]
  );

  const { processImage } = useImageUpload({
    onImageLoaded: handleImageLoaded,
    maxSize: 1000,
    accept: 'image/*, .svg',
  });

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;

    if (e.dataTransfer?.types?.includes('Files')) {
      setIsDropActive(true);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate drop position relative to stage
    if (stageRef?.current && containerRef.current) {
      const stage = stageRef.current;
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;

      // Convert to stage coordinates
      const stageX = (x - stage.x()) / stage.scaleX();
      const stageY = (y - stage.y()) / stage.scaleY();
      dropPositionRef.current = { x: stageX, y: stageY };
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [stageRef, containerRef]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;

    if (dragCounterRef.current === 0) {
      setIsDropActive(false);
      dropPositionRef.current = null;
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDropActive(false);

    const files = e.dataTransfer?.files;
    if (!files) {
      dropPositionRef.current = null;
      return;
    }

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        processImage(file);
      }
    }

    dropPositionRef.current = null;
  }, [processImage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop, containerRef]);

  return {
    isDropActive,
  };
};

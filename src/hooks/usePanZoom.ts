import React, { useState, useCallback, useRef, useEffect } from 'react';
import Konva from 'konva';
import { ZOOM_CONFIG, TouchState } from '@sabi-canvas/types/canvas';

interface UsePanZoomOptions {
  initialZoom?: number;
  initialPosition?: { x: number; y: number };
  minZoom?: number;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
  onPositionChange?: (pos: { x: number; y: number }) => void;
}

interface UsePanZoomResult {
  zoom: number;
  position: { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  resetView: () => void;
  handleWheel: (
    e: Konva.KonvaEventObject<WheelEvent>,
  ) => void;
  handleTouchStart: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleTouchMove: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  handleTouchEnd: () => void;
  handleDragStart: () => void;
  handleDragEnd: () => void;
  isDragging: boolean;
}

function getDistance(p1: Touch, p2: Touch): number {
  return Math.sqrt(Math.pow(p2.clientX - p1.clientX, 2) + Math.pow(p2.clientY - p1.clientY, 2));
}

function getCenter(p1: Touch, p2: Touch): { x: number; y: number } {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
}

export function usePanZoom({
  initialZoom = 1,
  initialPosition = { x: 0, y: 0 },
  minZoom = ZOOM_CONFIG.min,
  maxZoom = ZOOM_CONFIG.max,
  onZoomChange,
  onPositionChange,
}: UsePanZoomOptions = {}): UsePanZoomResult {
  const [zoom, setZoomState] = useState(initialZoom);
  const [position, setPositionState] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  
  const touchStateRef = useRef<TouchState>({
    lastCenter: null,
    lastDist: 0,
  });

  useEffect(() => {
    setZoomState(initialZoom);
    setPositionState({
      x: initialPosition.x,
      y: initialPosition.y,
    });
  }, [initialZoom, initialPosition.x, initialPosition.y]);

  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    setZoomState(clampedZoom);
    onZoomChange?.(clampedZoom);
  }, [minZoom, maxZoom, onZoomChange]);

  const setPosition = useCallback((newPosition: { x: number, y: number }) => {
    setPositionState(newPosition);
    onPositionChange?.(newPosition);
  }, [onPositionChange]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [setZoom, setPosition]);

  // Mouse wheel input policy:
  // - Ctrl/Cmd + wheel => zoom
  // - Shift + wheel => horizontal pan
  // - Wheel => vertical pan
  const handleWheel = useCallback((
    e: Konva.KonvaEventObject<WheelEvent>,
  ) => {
    const isModifiedZoom = e.evt.ctrlKey || e.evt.metaKey;
    const isHorizontalPan = e.evt.shiftKey;
    const hasNativeHorizontalDelta = Math.abs(e.evt.deltaX) > 0;

    if (!isModifiedZoom) {
      // Trackpads emit both deltaX and deltaY for diagonal gestures; apply both axes at once.
      if (hasNativeHorizontalDelta) {
        e.evt.preventDefault();
        setPosition({
          x: position.x - e.evt.deltaX,
          y: position.y - e.evt.deltaY,
        });
        return;
      }

      if (isHorizontalPan) {
        e.evt.preventDefault();

        const delta = e.evt.deltaX !== 0 ? e.evt.deltaX : e.evt.deltaY;
        if (delta === 0) return;

        setPosition({
          x: position.x - delta,
          y: position.y,
        });
        return;
      }

      e.evt.preventDefault();

      if (e.evt.deltaY === 0) return;
      setPosition({
        x: position.x,
        y: position.y - e.evt.deltaY,
      });
      return;
    }

    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = zoom;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    // Calculate new scale
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 
      ? oldScale * (1 + ZOOM_CONFIG.step)
      : oldScale / (1 + ZOOM_CONFIG.step);
    
    const clampedScale = Math.max(minZoom, Math.min(maxZoom, newScale));
    
    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setZoom(clampedScale);
    setPosition(newPos);
  }, [zoom, position, minZoom, maxZoom, setZoom, setPosition]);

  // Touch handlers for mobile pinch-to-zoom
  const handleTouchStart = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      touchStateRef.current = {
        lastDist: getDistance(touches[0], touches[1]),
        lastCenter: getCenter(touches[0], touches[1]),
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: Konva.KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault();
      
      const newDist = getDistance(touches[0], touches[1]);
      const newCenter = getCenter(touches[0], touches[1]);
      
      const touchState = touchStateRef.current;
      
      if (touchState.lastDist && touchState.lastCenter) {
        // Calculate scale change
        const scaleDelta = newDist / touchState.lastDist;
        const pinchBoost = 1.6;
        const adjustedScaleDelta = 1 + (scaleDelta - 1) * pinchBoost;
        const newZoom = zoom * adjustedScaleDelta;
        
        // Calculate position change
        const dx = newCenter.x - touchState.lastCenter.x;
        const dy = newCenter.y - touchState.lastCenter.y;
        
        const newPos = {
          x: position.x + dx,
          y: position.y + dy,
        };
        
        setZoom(newZoom);
        setPosition(newPos);
      }
      
      touchStateRef.current = {
        lastDist: newDist,
        lastCenter: newCenter,
      };
    }
  }, [zoom, position, setZoom, setPosition]);

  const handleTouchEnd = useCallback(() => {
    touchStateRef.current = {
      lastCenter: null,
      lastDist: 0,
    };
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    zoom,
    position,
    setZoom,
    setPosition,
    resetView,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDragStart,
    handleDragEnd,
    isDragging,
  };
}

export default usePanZoom;

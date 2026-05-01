import React, { useRef, useEffect, useCallback } from 'react';
import { Group } from 'react-konva';
import Konva from 'konva';

interface CachedGroupWrapperProps {
  // Forwarded to the underlying <Group>
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  visible: boolean;
  draggable: boolean;
  name: string;
  children: React.ReactNode;

  // Cache-control
  /** True when this group (or any descendant) is currently selected. */
  isSelected: boolean;
  /**
   * Opaque string derived from the visual state of this group's entire subtree.
   * Changing it while !isSelected triggers a re-cache so undo/redo updates are
   * reflected even when the group is not selected.
   */
  cacheKey: string;

  // Event handlers
  onClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onTap: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const CachedGroupWrapper: React.FC<CachedGroupWrapperProps> = ({
  x,
  y,
  rotation,
  scaleX,
  scaleY,
  opacity,
  visible,
  draggable,
  name,
  children,
  isSelected,
  cacheKey,
  onClick,
  onTap,
  onDragMove,
  onDragStart,
  onDragEnd,
  onMouseEnter,
  onMouseLeave,
}) => {
  const groupRef = useRef<Konva.Group>(null);

  const applyCache = useCallback(() => {
    const node = groupRef.current;
    if (!node) return;
    // Ensure the group has been painted at least once before caching.
    // getClientRect() returns {x:0,y:0,width:0,height:0} for an empty group
    // so we guard against a zero-area snapshot.
    const rect = node.getClientRect({ skipTransform: true });
    if (rect.width <= 0 || rect.height <= 0) return;
    node.cache();
    node.getLayer()?.batchDraw();
  }, []);

  // Clear cache while the group (or children) are selected so the Transformer
  // can attach to individual nodes and interactions remain accurate.
  // Re-cache when the group loses selection.
  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;

    if (isSelected) {
      node.clearCache();
      node.getLayer()?.batchDraw();
    } else {
      // Defer so the React tree has a chance to commit the new children state
      // before we snapshot it (handles undo/redo changing a child while
      // the group is deselected).
      const id = requestAnimationFrame(applyCache);
      return () => cancelAnimationFrame(id);
    }
  }, [isSelected, cacheKey, applyCache]);

  const handleDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // Clear the cache while dragging so the shadow / opacity feedback is
    // correct and Konva isn't trying to move a stale bitmap.
    groupRef.current?.clearCache();
    onDragStart?.(e);
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = 'move';
  }, [onDragStart]);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = '';
    onDragEnd?.(e);
    // Re-cache after the position update has been committed.
    requestAnimationFrame(applyCache);
  }, [onDragEnd, applyCache]);

  return (
    <Group
      ref={groupRef}
      x={x}
      y={y}
      rotation={rotation}
      scaleX={scaleX}
      scaleY={scaleY}
      opacity={opacity}
      visible={visible}
      draggable={draggable}
      name={name}
      onClick={onClick}
      onTap={onTap}
      onDragMove={onDragMove}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </Group>
  );
};

export default CachedGroupWrapper;

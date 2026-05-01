import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Transformer } from 'react-konva';
import Konva from 'konva';
import { CanvasObject, EllipseObject, TextObject, TableObject, StarObject } from '@sabi-canvas/types/canvas-objects';
import {
  getTransformerAnchorVisibility,
  getResponsiveEnabledAnchors,
  getRotateEnabled,
  TransformerSizeClass,
} from './transformerAnchorPolicy';

const MIN_TEXT_WIDTH = 40;
const TRANSFORMER_STROKE = 'hsl(217, 91%, 60%)';

interface CanvasTransformerProps {
  selectedIds: string[];
  objects: CanvasObject[];
  stageRef: React.RefObject<Konva.Stage>;
  onTransformEnd?: (id: string, updates: Partial<CanvasObject>) => void;
  locked?: boolean;
  isHover?: boolean;
  isMobile?: boolean;
  viewportScale?: number;
}

export const CanvasTransformer: React.FC<CanvasTransformerProps> = ({
  selectedIds,
  objects,
  stageRef,
  onTransformEnd = () => {},
  locked = false,
  isHover = false,
  isMobile = false,
  viewportScale = 1,
}) => {
  const transformerRef = useRef<Konva.Transformer>(null);
  // Cache original table dimensions at the start of a transform drag so
  // cumulative scale is always computed from the originals, not stale state.
  const tableTransformOriginals = useRef<{
    colWidths: number[];
    rowHeights: number[];
  } | null>(null);
  const [sizeClass, setSizeClass] = useState<TransformerSizeClass>('normal');
  const [hideHorizontalMiddleAnchors, setHideHorizontalMiddleAnchors] = useState(false);
  const [hideVerticalMiddleAnchors, setHideVerticalMiddleAnchors] = useState(false);
  const [rotateIconImage, setRotateIconImage] = useState<HTMLImageElement | null>(null);
  const selectedObjects = selectedIds
    .map((id) => objects.find((object) => object.id === id))
    .filter(Boolean) as CanvasObject[];
  const isSingleTextSelection = selectedObjects.length === 1 && selectedObjects[0].type === 'text';
  const isSingleTableSelection = selectedObjects.length === 1 && selectedObjects[0].type === 'table';

  // Compute minimum table dimensions based on cell font sizes (for vertical shrink limit)
  const { minTableWidth, minTableHeight } = useMemo(() => {
    if (selectedIds.length !== 1) return { minTableWidth: 10, minTableHeight: 10 };
    const tableObj = objects.find(o => o.id === selectedIds[0]);
    if (!tableObj || tableObj.type !== 'table') return { minTableWidth: 10, minTableHeight: 10 };
    const t = tableObj as TableObject;
    const minWidth = t.colWidths.length * 20;
    const minHeight = t.rowHeights.reduce((total, _, rowIdx) => {
      const row = t.cells[rowIdx] ?? [];
      const defaultFS = t.defaultFontSize ?? 14;
      const maxFontSize = row.reduce((max, cell) => Math.max(max, cell?.fontSize ?? defaultFS), defaultFS);
      const padding = t.cellPadding ?? 8;
      return total + Math.max(20, maxFontSize + 2 * padding);
    }, 0);
    return { minTableWidth: minWidth, minTableHeight: minHeight };
  }, [selectedIds, objects]);

  const updateSizeClass = useCallback(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    const nodes = transformer.nodes();
    if (nodes.length === 0) {
      setSizeClass('normal');
      setHideHorizontalMiddleAnchors(false);
      setHideVerticalMiddleAnchors(false);
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    nodes.forEach((node) => {
      const rect = node.getClientRect({
        skipShadow: true,
      });

      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });

    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    const visibility = getTransformerAnchorVisibility(width, height, isMobile);
    const nextSizeClass = visibility.sizeClass;

    setHideHorizontalMiddleAnchors((current) => {
      return current === visibility.hideHorizontalMiddleAnchors
        ? current
        : visibility.hideHorizontalMiddleAnchors;
    });
    setHideVerticalMiddleAnchors((current) => {
      return current === visibility.hideVerticalMiddleAnchors
        ? current
        : visibility.hideVerticalMiddleAnchors;
    });

    setSizeClass((current) => (current === nextSizeClass ? current : nextSizeClass));
  }, [isMobile]);

  const anchorStyleFunc = useCallback((anchor: Konva.Rect) => {
    const isTopCenter = anchor.hasName('top-center');
    const isBottomCenter = anchor.hasName('bottom-center');
    const isMiddleLeft = anchor.hasName('middle-left');
    const isMiddleRight = anchor.hasName('middle-right');
    const isMiddleAnchor = isTopCenter || isBottomCenter || isMiddleLeft || isMiddleRight;
    const isRotateAnchor = anchor.hasName('rotater');

    const cornerSize = sizeClass === 'tiny'
      ? (isMobile ? 15 : 15)
      : sizeClass === 'small'
        ? (isMobile ? 12 : 12)
        : (isMobile ? 12 : 12);
    const middleLong = isMobile ? 24 : 18;
    const middleShort = isMobile ? 6 : 6;
    const rotateSize = isMobile ? 24 : 20;

    anchor.stroke(TRANSFORMER_STROKE);
    anchor.strokeWidth(1);
    anchor.fill('white');
    anchor.fillPriority('color');
    anchor.fillPatternImage(null);

    if (isRotateAnchor) {
      anchor.width(rotateSize);
      anchor.height(rotateSize);
      anchor.offsetX(rotateSize / 2);
      anchor.offsetY(rotateSize / 2);
      anchor.cornerRadius(rotateSize / 2);

      if (rotateIconImage) {
        const sourceWidth = Math.max(1, rotateIconImage.naturalWidth || rotateIconImage.width || 1);
        const sourceHeight = Math.max(1, rotateIconImage.naturalHeight || rotateIconImage.height || 1);
        const iconScaleX = rotateSize / sourceWidth;
        const iconScaleY = rotateSize / sourceHeight;
        anchor.fillPatternImage(rotateIconImage);
        anchor.fillPriority('pattern');
        anchor.fillPatternRepeat('no-repeat');
        anchor.fillPatternX(0);
        anchor.fillPatternY(0);
        anchor.fillPatternScaleX(iconScaleX);
        anchor.fillPatternScaleY(iconScaleY);
      }
      return;
    }

    if (isMiddleAnchor) {
      const width = (isTopCenter || isBottomCenter) ? middleLong : middleShort;
      const height = (isTopCenter || isBottomCenter) ? middleShort : middleLong;
      anchor.width(width);
      anchor.height(height);
      anchor.offsetX(width / 2);
      anchor.offsetY(height / 2);
      anchor.cornerRadius(Math.min(width, height) / 2);
      return;
    }

    anchor.width(cornerSize);
    anchor.height(cornerSize);
    anchor.offsetX(cornerSize / 2);
    anchor.offsetY(cornerSize / 2);
    anchor.cornerRadius(cornerSize / 2);
  }, [isMobile, rotateIconImage, sizeClass]);

  const enabledAnchors = useMemo(() => {
    return getResponsiveEnabledAnchors({
      locked,
      isHover,
      isSingleTextSelection,
      sizeClass,
      hideHorizontalMiddleAnchors,
      hideVerticalMiddleAnchors,
    });
  }, [
    locked,
    isHover,
    isSingleTextSelection,
    sizeClass,
    hideHorizontalMiddleAnchors,
    hideVerticalMiddleAnchors,
  ]);

  const rotateEnabled = useMemo(() => {
    return getRotateEnabled({
      locked,
      isHover,
      sizeClass,
    });
  }, [locked, isHover, sizeClass]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const image = new window.Image();

    const handleLoad = () => {
      setRotateIconImage(image);
      transformerRef.current?.getLayer()?.batchDraw();
    };

    image.addEventListener('load', handleLoad);
    image.src = '/rotate-anchor.svg';

    if (image.complete) {
      handleLoad();
    }

    return () => {
      image.removeEventListener('load', handleLoad);
    };
  }, []);

  useEffect(() => {
    updateSizeClass();
  }, [objects, selectedIds, viewportScale, updateSizeClass]);

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;

    if (!transformer || !stage) return;

    const attachNodes = () => {
      const selectedNodes: Konva.Node[] = [];

      selectedIds.forEach(id => {
        const node = stage.findOne(`.${id}`);
        if (node) {
          selectedNodes.push(node);
        }
      });

      transformer.nodes(selectedNodes);
      updateSizeClass();
      transformer.getLayer()?.batchDraw();
    };

    attachNodes();

    // Listen for image mounts to re-attach nodes if they were loaded asynchronously
    const handleImageMounted = () => {
      attachNodes();
    };

    window.addEventListener('canvas_image_mounted', handleImageMounted);
    
    return () => {
      window.removeEventListener('canvas_image_mounted', handleImageMounted);
    };
  }, [selectedIds, objects, stageRef, updateSizeClass]);

  const handleTransformEnd = () => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    updateSizeClass();

    const activeAnchor = transformer.getActiveAnchor();
    const isCornerResize = activeAnchor === 'top-left'
      || activeAnchor === 'top-right'
      || activeAnchor === 'bottom-left'
      || activeAnchor === 'bottom-right';
    const isHorizontalSideResize = activeAnchor === 'middle-left' || activeAnchor === 'middle-right';

    transformer.nodes().forEach(node => {
      const id = node.name();
      if (!id) return;

      const obj = objects.find(o => o.id === id);
      if (!obj) return;

      const nodeClass = node.getClassName();

      let newX = node.x();
      let newY = node.y();

      const nsX = node.scaleX();
      const nsY = node.scaleY();
      const isBakingScale = (nodeClass === 'Group' && obj.type !== 'table' && obj.type !== 'group') ||
                            (nodeClass === 'Rect' || nodeClass === 'Image');

      // Revert visual offsets for center-origin shapes using their FUTURE baked un-scaled coordinates
      if (obj.type === 'circle') {
        const futureWidth = obj.width * Math.abs(isBakingScale ? nsX : 1);
        const futureHeight = obj.height * Math.abs(isBakingScale ? nsY : 1);
        const radius = Math.min(futureWidth, futureHeight) / 2;
        newX -= radius;
        newY -= radius;
      } else if (obj.type === 'ellipse') {
        const ellipse = obj as EllipseObject;
        const futureRadiusX = ellipse.radiusX * Math.abs(isBakingScale ? nsX : 1);
        const futureRadiusY = ellipse.radiusY * Math.abs(isBakingScale ? nsY : 1);
        newX -= futureRadiusX;
        newY -= futureRadiusY;
      } else if (
        obj.type === 'triangle' ||
        obj.type === 'polygon' ||
        obj.type === 'star'
      ) {
        const futureWidth = obj.width * Math.abs(isBakingScale ? nsX : 1);
        const futureHeight = obj.height * Math.abs(isBakingScale ? nsY : 1);
        newX -= futureWidth / 2;
        newY -= futureHeight / 2;
      }

      const updates: Partial<CanvasObject> = {
        x: newX,
        y: newY,
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      };

      if (obj.type === 'text') {
        const textObject = obj as TextObject;

        // Helper: immediately update the inner Text/Shape child so the transformer
        // bounding box is correct before React re-renders, preventing a 1-frame flash.
        const applyToInnerChild = (newWidth: number, newHeight: number, newFontSize?: number) => {
          const group = node as Konva.Group;
          const childText = group.findOne('Text') as Konva.Text | null;
          const childShape = group.findOne('Shape') as Konva.Shape | null;
          if (childText) {
            if (newFontSize !== undefined) childText.fontSize(newFontSize);
            childText.width(newWidth);
            childText.height(newHeight);
          } else if (childShape) {
            childShape.width(newWidth);
            childShape.height(newHeight);
          }
          transformer.forceUpdate();
        };

        if (isCornerResize) {
          const nextScale = Math.max(0.1, Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY())));
          const newFontSize = Math.max(1, Math.round(textObject.fontSize * nextScale));
          const newWidth = Math.max(MIN_TEXT_WIDTH, textObject.width * nextScale);
          const newHeight = Math.max(1, textObject.height * nextScale);
          const textUpdates = {
            ...updates,
            fontSize: newFontSize,
            width: newWidth,
            height: newHeight,
            scaleX: 1,
            scaleY: 1,
          } as Partial<TextObject>;
          node.scaleX(1);
          node.scaleY(1);
          applyToInnerChild(newWidth, newHeight, newFontSize);

          onTransformEnd(id, textUpdates as Partial<CanvasObject>);
          return;
        }

        if (isHorizontalSideResize) {
          const newWidth = Math.max(MIN_TEXT_WIDTH, textObject.width * Math.abs(node.scaleX()));
          const textUpdates = {
            ...updates,
            width: newWidth,
            scaleX: 1,
            scaleY: 1,
          } as Partial<TextObject>;

          node.scaleX(1);
          node.scaleY(1);
          applyToInnerChild(newWidth, textObject.height);

          onTransformEnd(id, textUpdates as Partial<CanvasObject>);
          return;
        }

        updates.scaleX = 1;
        updates.scaleY = 1;
        node.scaleX(1);
        node.scaleY(1);
        transformer.forceUpdate();

        onTransformEnd(id, updates);
        return;
      }

      // For tables: bake scaleX/scaleY into colWidths/rowHeights so final geometry is saved
      if (nodeClass === 'Group' && obj.type === 'table') {
        const table = obj as TableObject;
        const sx = node.scaleX();
        const sy = node.scaleY();
        const newColWidths = table.colWidths.map(w => Math.max(20, w * sx));
        const newRowHeights = table.rowHeights.map(h => Math.max(20, h * sy));
        
        updates.width = newColWidths.reduce((s, w) => s + w, 0);
        updates.height = newRowHeights.reduce((s, h) => s + h, 0);
        (updates as Partial<TableObject>).colWidths = newColWidths;
        (updates as Partial<TableObject>).rowHeights = newRowHeights;
        
        updates.scaleX = 1;
        updates.scaleY = 1;
        node.scaleX(1);
        node.scaleY(1);

        // Cleanup Text children
        ((node as Konva.Group).find('Text') as Konva.Node[]).forEach((textNode) => {
          textNode.setAttr('_origX', undefined);
          textNode.setAttr('_origY', undefined);
          textNode.setAttr('_origW', undefined);
          textNode.setAttr('_origH', undefined);
          textNode.scaleX(1);
          textNode.scaleY(1);
        });

        onTransformEnd(id, updates);
        return;
      }

      // For shape Groups with inner text: reset inner text scale explicitly just in case
      if (nodeClass === 'Group' && obj.type !== 'table' && obj.type !== 'group') {
        const innerTexts = ((node as Konva.Group).find('Text') as Konva.Text[]).filter(
          (t) => (t.name() || '').startsWith('_innerText_')
        );
        if (innerTexts.length > 0) {
          innerTexts.forEach((textNode) => {
            textNode.scaleX(1);
            textNode.scaleY(1);
          });
        }

        // Bake width/height based on scale
        updates.width = obj.width * Math.abs(node.scaleX());
        updates.height = obj.height * Math.abs(node.scaleY());
        
        // Bake specific shape custom radii properties
        if (obj.type === 'ellipse') {
          (updates as Partial<EllipseObject>).radiusX = (obj as EllipseObject).radiusX * Math.abs(node.scaleX());
          (updates as Partial<EllipseObject>).radiusY = (obj as EllipseObject).radiusY * Math.abs(node.scaleY());
        } else if (obj.type === 'star') {
          // Average scale logic or keep proportional for simplicity on Stars
          const scaleDiff = Math.abs(Math.min(node.scaleX(), node.scaleY()));
          (updates as Partial<StarObject>).innerRadius = (obj as StarObject).innerRadius * scaleDiff;
          (updates as Partial<StarObject>).outerRadius = (obj as StarObject).outerRadius * scaleDiff;
        }

        updates.scaleX = Math.sign(node.scaleX()) || 1;
        updates.scaleY = Math.sign(node.scaleY()) || 1;

        node.scaleX(1);
        node.scaleY(1);

        onTransformEnd(id, updates);
        return;
      }

      // For rectangles and images, also update width/height based on scale
      if (nodeClass === 'Rect' || nodeClass === 'Image') {
        const absX = Math.abs(node.scaleX());
        const absY = Math.abs(node.scaleY());
        updates.width = node.width() * absX;
        updates.height = node.height() * absY;
        updates.scaleX = Math.sign(node.scaleX()) || 1;
        updates.scaleY = Math.sign(node.scaleY()) || 1;
        node.scaleX(1);
        node.scaleY(1);
      }

      onTransformEnd(id, updates);
    });
  };

  const handleTransform = () => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    updateSizeClass();

    const activeAnchor = transformer.getActiveAnchor();
    const isHorizontalSideResize = activeAnchor === 'middle-left' || activeAnchor === 'middle-right';

    transformer.nodes().forEach((node) => {
      const id = node.name();
      if (!id) return;

      const obj = objects.find((candidate) => candidate.id === id);
      if (!obj) return;

      const nodeClass = node.getClassName();

      // Text: live width update on horizontal resize only
      if (obj.type === 'text' && isHorizontalSideResize) {
        const textObj = obj as TextObject;
        const nextWidth = Math.max(MIN_TEXT_WIDTH, textObj.width * Math.abs(node.scaleX()));
        // CanvasText renders inside a Group — update the inner Text or Shape child directly
        const childNode = (node as Konva.Group).findOne('Text') as Konva.Text | null
          ?? (node as Konva.Group).findOne('Shape') as Konva.Shape | null;
        if (childNode) {
          childNode.width(nextWidth);
        }
        node.scaleX(1);
        node.scaleY(1);
        return;
      }

      // Table: counter-scale text nodes so font size never stretches visually during live drag
      if (obj.type === 'table' && nodeClass === 'Group') {
        const table = obj as TableObject;
        const sx = node.scaleX();
        const sy = node.scaleY();
        if (sx === 1 && sy === 1) return;
        
        const padding = table.cellPadding ?? 0;

        ((node as Konva.Group).find('Text') as Konva.Text[]).forEach((textNode) => {
          // Cache original positions/dimensions on the first transform frame
          if (textNode.getAttr('_origX') == null) {
            textNode.setAttr('_origX', textNode.x());
            textNode.setAttr('_origY', textNode.y());
            textNode.setAttr('_origW', textNode.width());
            textNode.setAttr('_origH', textNode.height());
          }

          const origX = textNode.getAttr('_origX') as number;
          const origY = textNode.getAttr('_origY') as number;
          const origW = textNode.getAttr('_origW') as number;
          const origH = textNode.getAttr('_origH') as number;

          // Derive cell offset (position without padding) and cell dimensions
          const cellOffsetX = origX - padding;
          const cellOffsetY = origY - padding;
          const cellWidth = origW + 2 * padding;
          const cellHeight = origH + 2 * padding;

          // Counter-scale to prevent font scaling
          textNode.scaleX(1 / sx);
          textNode.scaleY(1 / sy);

          // Adjust position so visual padding stays constant (doesn't scale)
          textNode.x(cellOffsetX + padding / sx);
          textNode.y(cellOffsetY + padding / sy);

          // Adjust wrapping width/height to fill the scaled cell correctly
          textNode.width(Math.max(1, cellWidth * sx - 2 * padding));
          textNode.height(Math.max(1, cellHeight * sy - 2 * padding));
        });
      }


    });
  };

  return (
    <Transformer
      ref={transformerRef}
      boundBoxFunc={(oldBox, newBox) => {
        const activeAnchor = transformerRef.current?.getActiveAnchor();

        if (isSingleTextSelection && (activeAnchor === 'middle-left' || activeAnchor === 'middle-right')) {
          return {
            ...newBox,
            y: oldBox.y,
            height: oldBox.height,
          };
        }

        if (isSingleTextSelection && newBox.width < MIN_TEXT_WIDTH) {
          return oldBox;
        }

        // Limit minimum size (table-aware: use font-derived minimums for tables)
        const minW = isSingleTableSelection ? minTableWidth : 10;
        const minH = isSingleTableSelection ? minTableHeight : 10;
        if (newBox.width < minW || newBox.height < minH) {
          return oldBox;
        }
        return newBox;
      }}
      onTransform={isHover ? undefined : handleTransform}
      onTransformEnd={isHover ? undefined : handleTransformEnd}
      // Transformer styling
      anchorSize={14}
      anchorCornerRadius={999}
      anchorStroke={TRANSFORMER_STROKE}
      anchorFill="white"
      anchorStrokeWidth={1}
      borderStroke={TRANSFORMER_STROKE}
      borderStrokeWidth={2}
      rotateAnchorOffset={30}
      enabledAnchors={enabledAnchors}
      anchorStyleFunc={anchorStyleFunc}
      // Touch-friendly sizing
      padding={0}
      ignoreStroke={true}
      keepRatio={!isSingleTableSelection}
      rotateEnabled={rotateEnabled}
      resizeEnabled={!locked && !isHover}
      listening={!isHover} // Don't block clicks in hover mode
    />
  );
};

export default CanvasTransformer;

import React, { useEffect, useRef, useCallback } from 'react';
import { Layer, Rect, Line, Ellipse, Shape, Group } from 'react-konva';
import Konva from 'konva';
import { ImageObject } from '@sabi-canvas/types/canvas-objects';

export interface CropRatio {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface KonvaCropOverlayProps {
  object: ImageObject;
  safeAreaRect: { x: number; y: number; width: number; height: number };
  scale: number;
  stageRef: React.RefObject<Konva.Stage>;
  cropRatio: CropRatio;
  onCropRatioChange: (ratio: CropRatio) => void;
  /** Called when user taps/clicks outside the image area — treated as an apply. */
  onApply: () => void;
}

const HANDLE_SIZE = 10;
const HANDLE_HALF = HANDLE_SIZE / 2;
const MIN_CROP_RATIO = 0.05;
const BORDER_COLOR = 'hsl(217, 91%, 60%)';
const DIM_COLOR = 'rgba(0,0,0,0.50)';
const BACKDROP_COLOR = 'rgba(0,0,0,0.60)';
const GRID_COLOR = 'rgba(255,255,255,0.35)';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export const KonvaCropOverlay: React.FC<KonvaCropOverlayProps> = ({
  object,
  safeAreaRect,
  scale,
  stageRef,
  cropRatio,
  onCropRatioChange,
  onApply,
}) => {
  const dragStateRef = useRef<{
    type: string;
    startStageX: number;
    startStageY: number;
    startCrop: CropRatio;
    imgSW: number;
    imgSH: number;
    rotation: number;
  } | null>(null);

  // Track touch movement to distinguish a tap from a stage-pan gesture.
  // When the user pans the stage (single-finger drag), Konva's manual pan
  // logic doesn't suppress the subsequent `tap` event, so we must do it here.
  const touchMovedRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Coordinate math (rotation-aware) ─────────────────────────────────────
  const rotation = object.rotation || 0;
  const nw = object.naturalWidth || object.width;
  const nh = object.naturalHeight || object.height;
  const displayScale = object.cropWidth ? object.width / object.cropWidth : object.width / nw;

  // Rotation pivot in stage coords (= object's design-space origin scaled to stage)
  const pivotSX = safeAreaRect.x + object.x * scale;
  const pivotSY = safeAreaRect.y + object.y * scale;

  // How far the full image is offset behind the crop region (in stage units)
  const expandOffsetSX = (object.cropX || 0) * displayScale * scale;
  const expandOffsetSY = (object.cropY || 0) * displayScale * scale;

  // Full image dimensions in stage units
  const imgSW = nw * displayScale * scale;
  const imgSH = nh * displayScale * scale;

  // Crop selection position/size in the rotated group's local space
  const cropLocalX = -expandOffsetSX + cropRatio.x * imgSW;
  const cropLocalY = -expandOffsetSY + cropRatio.y * imgSH;
  const cropLocalW = cropRatio.width * imgSW;
  const cropLocalH = cropRatio.height * imgSH;

  // Click-out handler — skip if touch was a stage-pan gesture, otherwise apply.
  const handleCancel = useCallback(() => {
    if (touchMovedRef.current) {
      touchMovedRef.current = false;
      return;
    }
    onApply();
  }, [onApply]);

  // ── Drag start ────────────────────────────────────────────────────────────
  const startDrag = useCallback(
    (type: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      dragStateRef.current = {
        type,
        startStageX: pos.x,
        startStageY: pos.y,
        startCrop: { ...cropRatio },
        imgSW,
        imgSH,
        rotation,
      };
    },
    [cropRatio, imgSW, imgSH, rotation, stageRef]
  );

  // ── Stage-level mouse/touch move & up ─────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleTouchStartTracking = () => {
      const pos = stage.getPointerPosition();
      if (pos) touchStartPosRef.current = { x: pos.x, y: pos.y };
      touchMovedRef.current = false;
    };

    const handleMove = () => {
      const drag = dragStateRef.current;

      // Track stage-pan movement even when no crop handle is being dragged
      if (!drag && touchStartPosRef.current) {
        const pos = stage.getPointerPosition();
        if (pos) {
          const dx = pos.x - touchStartPosRef.current.x;
          const dy = pos.y - touchStartPosRef.current.y;
          if (dx * dx + dy * dy > 25) { // > 5px
            touchMovedRef.current = true;
          }
        }
      }

      if (!drag || drag.imgSW === 0 || drag.imgSH === 0) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Transform stage-space delta into the image's local (pre-rotation) space
      const dxStage = pos.x - drag.startStageX;
      const dyStage = pos.y - drag.startStageY;
      const angleRad = (drag.rotation || 0) * Math.PI / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
      // Inverse rotation: local = R^-1 * stage_delta
      const dx = (dxStage * cos + dyStage * sin) / drag.imgSW;
      const dy = (-dxStage * sin + dyStage * cos) / drag.imgSH;

      const { type, startCrop } = drag;
      const updated = { ...startCrop };

      if (type === 'move') {
        updated.x = clamp(startCrop.x + dx, 0, 1 - startCrop.width);
        updated.y = clamp(startCrop.y + dy, 0, 1 - startCrop.height);
      } else {
        if (type.includes('left')) {
          const newX = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.width - MIN_CROP_RATIO);
          updated.width = startCrop.width - (newX - startCrop.x);
          updated.x = newX;
        }
        if (type.includes('right')) {
          updated.width = clamp(startCrop.width + dx, MIN_CROP_RATIO, 1 - startCrop.x);
        }
        if (type.includes('top')) {
          const newY = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.height - MIN_CROP_RATIO);
          updated.height = startCrop.height - (newY - startCrop.y);
          updated.y = newY;
        }
        if (type.includes('bottom')) {
          updated.height = clamp(startCrop.height + dy, MIN_CROP_RATIO, 1 - startCrop.y);
        }
      }
      onCropRatioChange(updated);
    };

    const handleUp = () => {
      dragStateRef.current = null;
      touchStartPosRef.current = null;
      // Intentionally NOT resetting touchMovedRef here — it must still be true
      // when the `tap` event fires (synchronously after touchend).
    };

    stage.on('touchstart', handleTouchStartTracking);
    stage.on('mousemove touchmove', handleMove);
    stage.on('mouseup touchend', handleUp);
    return () => {
      stage.off('touchstart', handleTouchStartTracking);
      stage.off('mousemove touchmove', handleMove);
      stage.off('mouseup touchend', handleUp);
    };
  }, [stageRef, onCropRatioChange]);

  // ── Cursor helpers ────────────────────────────────────────────────────────
  const setCursor = useCallback(
    (cursor: string) => {
      const c = stageRef.current?.container();
      if (c) c.style.cursor = cursor;
    },
    [stageRef]
  );

  const stageW = stageRef.current?.width() ?? 5000;
  const stageH = stageRef.current?.height() ?? 5000;

  // Dim rectangles in LOCAL space (within the rotated group)
  // Each covers the image area OUTSIDE the crop selection
  const dimRects = [
    // top strip (image area above crop selection)
    { key: 't', x: -expandOffsetSX, y: -expandOffsetSY, width: imgSW, height: cropRatio.y * imgSH },
    // bottom strip
    { key: 'b', x: -expandOffsetSX, y: cropLocalY + cropLocalH, width: imgSW, height: (1 - cropRatio.y - cropRatio.height) * imgSH },
    // left strip (between top and bottom)
    { key: 'l', x: -expandOffsetSX, y: cropLocalY, width: cropRatio.x * imgSW, height: cropLocalH },
    // right strip
    { key: 'r', x: cropLocalX + cropLocalW, y: cropLocalY, width: (1 - cropRatio.x - cropRatio.width) * imgSW, height: cropLocalH },
  ];

  // 8 resize handles in LOCAL space
  const handles = [
    { id: 'top-left',     x: cropLocalX - HANDLE_HALF,                   y: cropLocalY - HANDLE_HALF,                   cursor: 'nwse-resize' },
    { id: 'top-right',    x: cropLocalX + cropLocalW - HANDLE_HALF,      y: cropLocalY - HANDLE_HALF,                   cursor: 'nesw-resize' },
    { id: 'bottom-left',  x: cropLocalX - HANDLE_HALF,                   y: cropLocalY + cropLocalH - HANDLE_HALF,      cursor: 'nesw-resize' },
    { id: 'bottom-right', x: cropLocalX + cropLocalW - HANDLE_HALF,      y: cropLocalY + cropLocalH - HANDLE_HALF,      cursor: 'nwse-resize' },
    { id: 'top',          x: cropLocalX + cropLocalW / 2 - HANDLE_HALF,  y: cropLocalY - HANDLE_HALF,                   cursor: 'ns-resize' },
    { id: 'bottom',       x: cropLocalX + cropLocalW / 2 - HANDLE_HALF,  y: cropLocalY + cropLocalH - HANDLE_HALF,      cursor: 'ns-resize' },
    { id: 'left',         x: cropLocalX - HANDLE_HALF,                   y: cropLocalY + cropLocalH / 2 - HANDLE_HALF,  cursor: 'ew-resize' },
    { id: 'right',        x: cropLocalX + cropLocalW - HANDLE_HALF,      y: cropLocalY + cropLocalH / 2 - HANDLE_HALF,  cursor: 'ew-resize' },
  ];

  const maskShape = object.maskShape && object.maskShape !== 'none' ? object.maskShape : null;

  return (
    <Layer>
      {/*
       * 1. Full-stage backdrop — dims everything outside the image.
       *    Clicking anywhere outside the image cancels crop mode.
       */}
      <Rect
        x={0}
        y={0}
        width={stageW}
        height={stageH}
        fill={BACKDROP_COLOR}
        onClick={handleCancel}
        onTap={handleCancel}
        perfectDrawEnabled={false}
      />

      {/*
       * 2. Cut the ROTATED image area out of the backdrop so the image shows
       *    clearly underneath. The Group applies the same rotation as the image.
       */}
      <Group x={pivotSX} y={pivotSY} rotation={rotation} listening={false}>
        <Rect
          x={-expandOffsetSX}
          y={-expandOffsetSY}
          width={imgSW}
          height={imgSH}
          fill="black"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          globalCompositeOperation={'destination-out' as any}
          perfectDrawEnabled={false}
        />
      </Group>

      {/*
       * 3–7. Everything else is in the same rotated coordinate system as the image,
       *      so handles, dim strips, border and grid all align with the rotation.
       */}
      <Group x={pivotSX} y={pivotSY} rotation={rotation}>
        {/* 3. Dim strips — image area outside the crop selection */}
        {dimRects.map((r) => (
          <Rect
            key={r.key}
            x={r.x}
            y={r.y}
            width={Math.max(0, r.width)}
            height={Math.max(0, r.height)}
            fill={DIM_COLOR}
            perfectDrawEnabled={false}
          />
        ))}

        {/* 4. Optional mask-shape preview inside the crop area */}
        {maskShape && (
          <>
            {/* Dim the whole crop area */}
            <Rect
              x={cropLocalX}
              y={cropLocalY}
              width={cropLocalW}
              height={cropLocalH}
              fill={DIM_COLOR}
              listening={false}
              perfectDrawEnabled={false}
            />
            {/* Cut the mask shape back out (destination-out) */}
            {maskShape === 'circle' && (
              <Ellipse
                x={cropLocalX + cropLocalW / 2}
                y={cropLocalY + cropLocalH / 2}
                radiusX={Math.min(cropLocalW, cropLocalH) / 2}
                radiusY={Math.min(cropLocalW, cropLocalH) / 2}
                fill="black"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                globalCompositeOperation={'destination-out' as any}
                listening={false}
              />
            )}
            {maskShape === 'ellipse' && (
              <Ellipse
                x={cropLocalX + cropLocalW / 2}
                y={cropLocalY + cropLocalH / 2}
                radiusX={cropLocalW / 2}
                radiusY={cropLocalH / 2}
                fill="black"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                globalCompositeOperation={'destination-out' as any}
                listening={false}
              />
            )}
            {maskShape === 'rounded-rect' && (
              <Rect
                x={cropLocalX + cropLocalW * 0.05}
                y={cropLocalY + cropLocalH * 0.05}
                width={cropLocalW * 0.9}
                height={cropLocalH * 0.9}
                cornerRadius={cropLocalW * 0.15}
                fill="black"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                globalCompositeOperation={'destination-out' as any}
                listening={false}
              />
            )}
            {maskShape === 'triangle' && (
              <Shape
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                globalCompositeOperation={'destination-out' as any}
                listening={false}
                sceneFunc={(ctx, shape) => {
                  ctx.beginPath();
                  ctx.moveTo(cropLocalX + cropLocalW / 2, cropLocalY);
                  ctx.lineTo(cropLocalX + cropLocalW, cropLocalY + cropLocalH);
                  ctx.lineTo(cropLocalX, cropLocalY + cropLocalH);
                  ctx.closePath();
                  ctx.fillStrokeShape(shape);
                }}
                fill="black"
              />
            )}
            {(maskShape === 'star' || maskShape === 'hexagon') && (
              <Shape
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                globalCompositeOperation={'destination-out' as any}
                listening={false}
                sceneFunc={(ctx, shape) => {
                  const cx = cropLocalX + cropLocalW / 2;
                  const cy = cropLocalY + cropLocalH / 2;
                  const r = Math.min(cropLocalW, cropLocalH) / 2;
                  ctx.beginPath();
                  if (maskShape === 'hexagon') {
                    for (let i = 0; i < 6; i++) {
                      const angle = (Math.PI / 3) * i - Math.PI / 2;
                      const px = cx + r * Math.cos(angle);
                      const py = cy + r * Math.sin(angle);
                      if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
                    }
                  } else {
                    const outerR = r;
                    const innerR = r * 0.4;
                    for (let i = 0; i < 10; i++) {
                      const sr = i % 2 === 0 ? outerR : innerR;
                      const angle = (Math.PI / 5) * i - Math.PI / 2;
                      const px = cx + sr * Math.cos(angle);
                      const py = cy + sr * Math.sin(angle);
                      if (i === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
                    }
                  }
                  ctx.closePath();
                  ctx.fillStrokeShape(shape);
                }}
                fill="black"
              />
            )}
          </>
        )}

        {/* 5. Crop border — transparent fill makes it hit-testable for move drag */}
        <Rect
          x={cropLocalX}
          y={cropLocalY}
          width={cropLocalW}
          height={cropLocalH}
          fill="transparent"
          stroke={BORDER_COLOR}
          strokeWidth={2}
          onMouseDown={(e) => startDrag('move', e)}
          onTouchStart={(e) => startDrag('move', e as unknown as Konva.KonvaEventObject<MouseEvent>)}
          onMouseEnter={() => setCursor('move')}
          onMouseLeave={() => setCursor('default')}
          perfectDrawEnabled={false}
        />

        {/* 6. Rule-of-thirds grid lines */}
        {[1 / 3, 2 / 3].map((frac) => (
          <React.Fragment key={frac}>
            <Line
              points={[
                cropLocalX + frac * cropLocalW, cropLocalY,
                cropLocalX + frac * cropLocalW, cropLocalY + cropLocalH,
              ]}
              stroke={GRID_COLOR}
              strokeWidth={1}
              listening={false}
              perfectDrawEnabled={false}
            />
            <Line
              points={[
                cropLocalX, cropLocalY + frac * cropLocalH,
                cropLocalX + cropLocalW, cropLocalY + frac * cropLocalH,
              ]}
              stroke={GRID_COLOR}
              strokeWidth={1}
              listening={false}
              perfectDrawEnabled={false}
            />
          </React.Fragment>
        ))}

        {/* 7. Resize handles */}
        {handles.map((h) => (
          <Rect
            key={h.id}
            x={h.x}
            y={h.y}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="white"
            stroke={BORDER_COLOR}
            strokeWidth={2}
            cornerRadius={1}
            onMouseDown={(e) => startDrag(h.id, e)}
            onTouchStart={(e) => startDrag(h.id, e as unknown as Konva.KonvaEventObject<MouseEvent>)}
            onMouseEnter={() => setCursor(h.cursor)}
            onMouseLeave={() => setCursor('default')}
            perfectDrawEnabled={false}
          />
        ))}
      </Group>
    </Layer>
  );
};

export default KonvaCropOverlay;

import React from 'react';
import { Shape, Group } from 'react-konva';
import Konva from 'konva';

interface SafeAreaOverlayProps {
  stageWidth: number;
  stageHeight: number;
  safeAreaX: number;
  safeAreaY: number;
  safeAreaWidth: number;
  safeAreaHeight: number;
  overlayColor?: string;
  overlayOpacity?: number;
}

/**
 * SafeAreaOverlay renders a semi-transparent overlay covering the entire stage
 * with a transparent "cut-out" for the safe area. This creates the Polotno-style
 * effect where content outside the export area appears dimmed but still visible.
 */
export const SafeAreaOverlay: React.FC<SafeAreaOverlayProps> = ({
  stageWidth,
  stageHeight,
  safeAreaX,
  safeAreaY,
  safeAreaWidth,
  safeAreaHeight,
  overlayColor = 'rgba(0, 0, 0, 0.5)',
  overlayOpacity = 1,
}) => {
  if (safeAreaWidth <= 0 || safeAreaHeight <= 0) return null;

  // Custom shape that draws the overlay with a cutout
  const sceneFunc = (context: Konva.Context, shape: Konva.Shape) => {
    const ctx = context._context;

    // Large padding to ensure the overlay "feels" unlimited/infinite
    // We center it around the safe area to ensure the hole is always covered
    const INFINITE_PADDING = 100000;

    // Begin path
    ctx.beginPath();

    // Draw outer rectangle (huge area) - clockwise
    ctx.moveTo(safeAreaX - INFINITE_PADDING, safeAreaY - INFINITE_PADDING);
    ctx.lineTo(safeAreaX + safeAreaWidth + INFINITE_PADDING, safeAreaY - INFINITE_PADDING);
    ctx.lineTo(safeAreaX + safeAreaWidth + INFINITE_PADDING, safeAreaY + safeAreaHeight + INFINITE_PADDING);
    ctx.lineTo(safeAreaX - INFINITE_PADDING, safeAreaY + safeAreaHeight + INFINITE_PADDING);
    ctx.closePath();

    // Draw inner rectangle (safe area cutout) - counter-clockwise for hole
    ctx.moveTo(safeAreaX, safeAreaY);
    ctx.lineTo(safeAreaX, safeAreaY + safeAreaHeight);
    ctx.lineTo(safeAreaX + safeAreaWidth, safeAreaY + safeAreaHeight);
    ctx.lineTo(safeAreaX + safeAreaWidth, safeAreaY);
    ctx.closePath();

    // Fill with the overlay color using evenodd rule
    ctx.fillStyle = overlayColor;
    // Dev Mode - Uncomment for production
    // ctx.strokeStyle = 'red';
    // ctx.lineWidth = 1;
    // ctx.stroke();
    ctx.fill('evenodd');
  };

  return (
    <Group listening={false}>
      <Shape
        sceneFunc={sceneFunc}
        opacity={overlayOpacity}
        listening={false}
      />
    </Group>
  );
};

export default SafeAreaOverlay;

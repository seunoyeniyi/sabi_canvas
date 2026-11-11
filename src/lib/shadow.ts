import type { BaseCanvasObject } from '@sabi-canvas/types/canvas-objects';

export interface KonvaShadowProps {
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
}

/**
 * Konva shadow props for an object, or {} when it has no shadow.
 *
 * A blur of 0 means "no shadow": the shadow controls have no separate on/off
 * switch, so moving Blur to 0 is how a shadow is removed.
 *
 * Konva draws shadows on shapes only (Rect, Text, Image, Shape…), never on a
 * Group, so spread these onto the node that is actually drawn.
 */
export const getShadowProps = (
  object: Pick<BaseCanvasObject, 'shadowColor' | 'shadowBlur' | 'shadowOffsetX' | 'shadowOffsetY' | 'shadowOpacity'>,
): KonvaShadowProps => {
  if (!object.shadowBlur || object.shadowBlur <= 0) return {};

  return {
    shadowColor: object.shadowColor || 'rgba(0,0,0,0.5)',
    shadowBlur: object.shadowBlur,
    shadowOffsetX: object.shadowOffsetX || 0,
    shadowOffsetY: object.shadowOffsetY || 0,
    shadowOpacity: object.shadowOpacity ?? 0.5,
  };
};

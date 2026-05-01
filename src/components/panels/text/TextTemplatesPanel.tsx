import React, { useMemo, useState } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import {
  TEXT_TEMPLATE_CATEGORIES,
  TEXT_TEMPLATE_PRESETS,
  TextTemplateCategory,
  TextTemplatePreset,
} from '@sabi-canvas/data/textPresets';
import { preloadFonts } from '@sabi-canvas/lib/fontLoader';
import { TextObject, createDefaultObject } from '@sabi-canvas/types/canvas-objects';
import { CanvasBackground } from '@sabi-canvas/types/pages';
import { cn } from '@sabi-canvas/lib/utils';
import { TextTemplateThumbnail } from './TextTemplateThumbnail';

interface TextTemplatesPanelProps {
  onClose: () => void;
}

const parseRgb = (input: string): [number, number, number] | null => {
  const color = input.trim().toLowerCase();

  if (color === 'white') return [255, 255, 255];
  if (color === 'black') return [0, 0, 0];

  if (/^#([0-9a-f]{3})$/.test(color)) {
    const [, shortHex] = color.match(/^#([0-9a-f]{3})$/) ?? [];
    if (!shortHex) return null;
    return [
      parseInt(shortHex[0] + shortHex[0], 16),
      parseInt(shortHex[1] + shortHex[1], 16),
      parseInt(shortHex[2] + shortHex[2], 16),
    ];
  }

  if (/^#([0-9a-f]{6})$/.test(color)) {
    const [, hex] = color.match(/^#([0-9a-f]{6})$/) ?? [];
    if (!hex) return null;
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]),
      Number(rgbMatch[2]),
      Number(rgbMatch[3]),
    ];
  }

  return null;
};

const luminance = (color: string): number | null => {
  const rgb = parseRgb(color);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const isWhiteLike = (color: string): boolean => {
  const luma = luminance(color);
  return luma !== null && luma > 0.93;
};

const isLightBackground = (background?: CanvasBackground): boolean => {
  if (!background) return true;

  if (background.type === 'transparent') return true;
  if (background.type === 'image') return false;

  if (background.type === 'solid') {
    const luma = luminance(background.color);
    return luma === null ? true : luma > 0.6;
  }

  if (background.type === 'linear-gradient' || background.type === 'radial-gradient') {
    if (!background.colors.length) return true;
    const values = background.colors.map((c) => luminance(c)).filter((v): v is number => v !== null);
    if (values.length === 0) return true;
    return values.reduce((sum, value) => sum + value, 0) / values.length > 0.6;
  }

  return true;
};

const buildTemplateObjects = (
  preset: TextTemplatePreset,
  canvasWidth: number,
  canvasHeight: number,
  stageBackground?: CanvasBackground
): TextObject[] => {
  const padding = 56;
  const maxWidth = Math.max(canvasWidth - padding * 2, 120);
  const maxHeight = Math.max(canvasHeight - padding * 2, 120);

  const scale = Math.min(maxWidth / preset.referenceWidth, maxHeight / preset.referenceHeight, 1);
  const finalWidth = preset.referenceWidth * scale;
  const finalHeight = preset.referenceHeight * scale;

  const originX = (canvasWidth - finalWidth) / 2;
  const originY = (canvasHeight - finalHeight) / 2;
  const useDarkFallbackText = isLightBackground(stageBackground);

  return preset.layers.map((layer) => {
    const fontSize = Math.max(14, layer.fontSize * scale);
    const width = Math.max(32, layer.width * scale);
    const estimatedHeight = Math.max(24, fontSize * (layer.lineHeight ?? 1.2) * 1.5);

    const base = createDefaultObject('text', {
      x: originX + layer.x * scale,
      y: originY + layer.y * scale,
    }) as TextObject;

    return {
      ...base,
      text: layer.text,
      fontFamily: layer.fontFamily,
      fontSize,
      fontStyle: layer.fontStyle ?? 'normal',
      fill: useDarkFallbackText && isWhiteLike(layer.fill) ? '#111111' : layer.fill,
      align: layer.align ?? 'left',
      width,
      height: estimatedHeight,
      lineHeight: layer.lineHeight ?? 1.2,
      letterSpacing: layer.letterSpacing ?? 0,
    };
  });
};

export const TextTemplatesPanel: React.FC<TextTemplatesPanelProps> = ({ onClose }) => {
  const [category, setCategory] = useState<TextTemplateCategory | 'all'>('all');
  const { addObjects, activePage, objects } = useCanvasObjects();
  const { canvasSize, editorMode, isMockupEnabled } = useEditor();

  const presets = useMemo(() => {
    if (category === 'all') return TEXT_TEMPLATE_PRESETS;
    return TEXT_TEMPLATE_PRESETS.filter((p) => p.category === category);
  }, [category]);

  const handleInsertPreset = async (preset: TextTemplatePreset) => {
    const printArea = isMockupEnabled && editorMode === 'customer'
      ? objects.find((o) => o.type === 'print-area')
      : null;

    const refW = printArea ? printArea.width : canvasSize.width;
    const refH = printArea ? printArea.height : canvasSize.height;
    const builtObjects = buildTemplateObjects(preset, refW, refH, activePage.background);

    // If placing within a print area, offset all objects by the print area's origin
    const finalObjects = printArea
      ? builtObjects.map((o) => ({ ...o, x: o.x + printArea.x, y: o.y + printArea.y }))
      : builtObjects;

    addObjects(finalObjects);

    const uniqueFamilies = [...new Set(preset.layers.map((l) => l.fontFamily))];
    void preloadFonts(uniqueFamilies, { maxFonts: uniqueFamilies.length, concurrency: 4 });

    onClose();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 pr-2 min-w-max">
          {TEXT_TEMPLATE_CATEGORIES.map((item) => (
            <button
              key={item.id}
              onClick={() => setCategory(item.id)}
              className={cn(
                'px-2 py-1 rounded-full border text-[11px] whitespace-nowrap transition-colors',
                category === item.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pb-2">
        {presets.map((preset) => (
          <TextTemplateThumbnail
            key={preset.id}
            preset={preset}
            onClick={() => {
              void handleInsertPreset(preset);
            }}
          />
        ))}
      </div>
    </div>
  );
};

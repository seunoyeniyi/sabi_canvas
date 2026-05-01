import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TextTemplatePreset } from '@sabi-canvas/data/textPresets';
import { loadFontFamily } from '@sabi-canvas/lib/fontLoader';

interface TextTemplateThumbnailProps {
  preset: TextTemplatePreset;
  onClick: () => void;
}

export const TextTemplateThumbnail: React.FC<TextTemplateThumbnailProps> = ({
  preset,
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

  // Compute scale based on actual container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setScale(w / preset.referenceWidth);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [preset.referenceWidth]);

  // Load all fonts used by this preset
  const loadFonts = useCallback(async () => {
    const uniqueFamilies = [...new Set(preset.layers.map((l) => l.fontFamily))];
    await Promise.all(uniqueFamilies.map((f) => loadFontFamily(f)));
    setFontsReady(true);
  }, [preset.layers]);

  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  const stageHeight = preset.referenceHeight * scale;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-sm border border-border/50 overflow-hidden hover:border-primary/60 hover:shadow-md transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={preset.name}
    >
      {/* Preview area */}
      <div
        ref={containerRef}
        className="w-full relative overflow-hidden"
        style={{
          height: stageHeight > 0 ? stageHeight : undefined,
          minHeight: stageHeight > 0 ? undefined : `${(preset.referenceHeight / preset.referenceWidth) * 100}%`,
          aspectRatio: stageHeight === 0 ? `${preset.referenceWidth} / ${preset.referenceHeight}` : undefined,
          backgroundColor: preset.previewBg,
        }}
      >
        {scale > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: preset.referenceWidth,
              height: preset.referenceHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
              opacity: fontsReady ? 1 : 0,
              transition: 'opacity 0.2s ease',
            }}
          >
            {preset.layers.map((layer, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: layer.x,
                  top: layer.y,
                  width: layer.width,
                  fontFamily: `"${layer.fontFamily}", sans-serif`,
                  fontSize: layer.fontSize,
                  fontWeight:
                    layer.fontStyle === 'bold' || layer.fontStyle === 'bold italic' ? 700 : 400,
                  fontStyle:
                    layer.fontStyle === 'italic' || layer.fontStyle === 'bold italic'
                      ? 'italic'
                      : 'normal',
                  color: layer.fill,
                  textAlign: layer.align ?? 'left',
                  lineHeight: layer.lineHeight ?? 1.2,
                  letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}px` : undefined,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  userSelect: 'none',
                }}
              >
                {layer.text}
              </div>
            ))}
          </div>
        )}

        {/* Skeleton shown while fonts load */}
        {!fontsReady && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: preset.previewBg }}
          >
            <div className="w-3/4 space-y-2">
              <div className="h-3 rounded-sm bg-white/10 animate-pulse" />
              <div className="h-3 rounded-sm bg-white/10 animate-pulse w-2/3 mx-auto" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

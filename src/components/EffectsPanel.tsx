/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Switch } from '@sabi-canvas/ui/switch';
import { Slider } from '@sabi-canvas/ui/slider';
import { Separator } from '@sabi-canvas/ui/separator';
import { useIsDesktop } from '@sabi-canvas/hooks/useMediaQuery';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { CanvasObject, ImageObject, RectangleObject, PolygonObject, StarObject, ArrowObject, TextObject } from '@sabi-canvas/types/canvas-objects';
import { ColorPickerButton } from '@sabi-canvas/components/canvas/shared/ContextualTools';
import { cn } from '@sabi-canvas/lib/utils';
import { isSvgSrc } from '@sabi-canvas/lib/svgColorUtils';

// ── Color preset definitions ─────────────────────────────────────────────────
interface ColorPreset {
  name: string;
  value: NonNullable<CanvasObject['colorFilter']>;
  /** CSS filter string used for the thumbnail preview only */
  cssFilter: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  { name: 'Grayscale', value: 'grayscale', cssFilter: 'grayscale(100%)' },
  { name: 'Sepia',     value: 'sepia',     cssFilter: 'sepia(100%)' },
  { name: 'Cold',      value: 'cold',      cssFilter: 'brightness(0.92) saturate(0.82) hue-rotate(200deg)' },
  { name: 'Natural',   value: 'natural',   cssFilter: 'saturate(1.14) brightness(1.03)' },
  { name: 'Warm',      value: 'warm',      cssFilter: 'sepia(0.32) saturate(1.4) brightness(1.05)' },
];

// ── Tiny helpers ─────────────────────────────────────────────────────────────

/** A single row with a label and an on/off toggle. Children are shown when enabled. */
const EffectRow: React.FC<{
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}> = ({ label, enabled, onToggle, children }) => (
  <div>
    <div className="flex items-center justify-between py-3 px-4">
      <span className="text-sm">{label}</span>
      <Switch checked={enabled} onCheckedChange={onToggle} className="scale-90" />
    </div>
    <AnimatePresence initial={false}>
      {enabled && children && (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-3 space-y-2">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
    <Separator className="opacity-40" />
  </div>
);

/** Horizontal slider with an optional label and a numeric readout. */
const SliderRow: React.FC<{
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step = 1, onChange }) => (
  <div className="flex items-center gap-2">
    {label && (
      <span className="text-xs text-muted-foreground w-16 shrink-0 leading-none">{label}</span>
    )}
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([v]) => onChange(v)}
      className="flex-1"
    />
    <span className="text-xs text-muted-foreground w-9 text-right tabular-nums shrink-0">
      {value}
    </span>
  </div>
);

/**
 * A bidirectional slider: fill goes from 0 (center) outward to the thumb.
 * Positive values fill rightward, negative values fill leftward.
 */
const BidirectionalSlider: React.FC<{
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}> = ({ value, min = -100, max = 100, onChange }) => {
  const range = max - min;
  const pct = (v: number) => ((v - min) / range) * 100;
  const centerPct = pct(0);
  const thumbPct = pct(value);
  const fillLeft = Math.min(centerPct, thumbPct);
  const fillWidth = Math.abs(thumbPct - centerPct);
  const ticks = [min, min / 2, 0, max / 2, max];

  return (
    <div className="space-y-2 pt-1">
      {/* Value readout */}
      <div className="flex justify-end">
        <span className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 min-w-[2.5rem] text-center tabular-nums">
          {value}
        </span>
      </div>

      {/* Custom track */}
      <div className="relative h-6 flex items-center select-none">
        <div className="w-full h-1.5 rounded-full bg-muted relative overflow-visible">
          {/* Fill from center to thumb */}
          <div
            className="absolute top-0 h-full rounded-full bg-primary"
            style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
          />
          {/* Center tick mark */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/40 rounded-full"
            style={{ left: `calc(${centerPct}% - 1px)` }}
          />
        </div>

        {/* Thumb (visual only, pointer-events from the input) */}
        <div
          className="absolute h-4 w-4 rounded-full border-2 border-primary bg-background shadow pointer-events-none z-10"
          style={{ left: `${thumbPct}%`, transform: 'translateX(-50%)' }}
        />

        {/* Invisible native range input — handles all interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        />
      </div>

      {/* Tick labels */}
      <div className="flex justify-between">
        {ticks.map((tick) => (
          <span
            key={tick}
            className={cn(
              'text-xs tabular-nums',
              value === tick ? 'text-primary font-medium' : 'text-muted-foreground'
            )}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Inline colour picker row using the shared ColorPickerButton */
const ColorRow: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">{label}</span>
    <ColorPickerButton label={label} color={value} onChange={onChange} side="left" />
  </div>
);

/** Non-toggleable section divider with a label */
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <p className="px-4 pt-4 pb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
    {label}
  </p>
);

// ── Per-object panel content ─────────────────────────────────────────────────

const PanelContent: React.FC<{
  object: CanvasObject;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
}> = ({ object, onUpdate }) => {
  const upd = useCallback(
    (updates: Partial<CanvasObject>) => onUpdate(object.id, updates),
    [onUpdate, object.id]
  );

  // Object type booleans
  const isSvgImage  = object.type === 'image' && isSvgSrc((object as ImageObject).src ?? '');
  const isImage     = object.type === 'image' && !isSvgImage;
  const isShape     = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'star', 'path'].includes(object.type);
  const isText      = object.type === 'text';
  const isArrow     = object.type === 'arrow';
  const isLine      = object.type === 'line' || isArrow;
  const isTable     = object.type === 'table';
  const isRectangle = object.type === 'rectangle';
  const isPolygon   = object.type === 'polygon';
  const isStar      = object.type === 'star';
  const isDraw      = object.type === 'draw';

  // Objects that can have a stroke border
  const hasBorderSupport = isShape || isTable || isImage;

  // Derived toggle states
  const blurEnabled      = (object.filterBlur ?? 0) > 0;
  const brightnessEnabled = (object.filterBrightness ?? 0) !== 0;
  const temperatureEnabled = (object.filterTemperature ?? 0) !== 0;
  const contrastEnabled  = (object.filterContrast ?? 0) !== 0;
  const shadowsEnabled   = (object.filterShadows ?? 0) !== 0;
  const whiteEnabled     = (object.filterWhites ?? 0) !== 0;
  const blackEnabled     = (object.filterBlacks ?? 0) !== 0;
  const vibranceEnabled  = (object.filterVibrance ?? 0) !== 0;
  const saturationEnabled = (object.filterSaturation ?? 0) !== 0;
  const borderEnabled    = ((object as any).strokeWidth ?? 0) > 0;
  const cornerEnabled    = isRectangle && ((object as RectangleObject).cornerRadius ?? 0) > 0;
  const dropShadowEnabled = (object.shadowBlur ?? 0) > 0;

  return (
    <div className="pb-4">

      {/* ── Shape Geometry (polygon / star / arrow) ───────────────────── */}
      {(isPolygon || isStar || isArrow) && (
        <div>
          <SectionLabel label="Geometry" />
          <div className="px-4 pb-3 pt-2 space-y-3">

            {/* Polygon sides */}
            {isPolygon && (
              <SliderRow
                label="Sides"
                value={(object as PolygonObject).sides}
                min={3}
                max={20}
                onChange={(v) => upd({ sides: v } as Partial<CanvasObject>)}
              />
            )}

            {/* Star points + depth */}
            {isStar && (() => {
              const star = object as StarObject;
              const depth = star.outerRadius > 0
                ? Math.round((star.innerRadius / star.outerRadius) * 100)
                : 50;
              return (
                <>
                  <SliderRow
                    label="Points"
                    value={star.numPoints}
                    min={3}
                    max={16}
                    onChange={(v) => upd({ numPoints: v } as Partial<CanvasObject>)}
                  />
                  <SliderRow
                    label="Depth %"
                    value={depth}
                    min={10}
                    max={90}
                    onChange={(v) =>
                      upd({ innerRadius: Math.round(star.outerRadius * (v / 100)) } as Partial<CanvasObject>)
                    }
                  />
                </>
              );
            })()}

            {/* Arrow pointer size */}
            {isArrow && (
              <>
                <SliderRow
                  label="Ptr Length"
                  value={(object as ArrowObject).pointerLength}
                  min={1}
                  max={80}
                  onChange={(v) => upd({ pointerLength: v } as Partial<CanvasObject>)}
                />
                <SliderRow
                  label="Ptr Width"
                  value={(object as ArrowObject).pointerWidth}
                  min={1}
                  max={80}
                  onChange={(v) => upd({ pointerWidth: v } as Partial<CanvasObject>)}
                />
              </>
            )}
          </div>

          {/* Arrow direction toggles (rendered outside the slider block so they use EffectRow's separator) */}
          {isArrow && (
            <>
              <EffectRow
                label="Arrow at Start"
                enabled={(object as ArrowObject).pointerAtBeginning ?? false}
                onToggle={(v) => upd({ pointerAtBeginning: v } as Partial<CanvasObject>)}
              />
              <EffectRow
                label="Arrow at End"
                enabled={(object as ArrowObject).pointerAtEnding !== false}
                onToggle={(v) => upd({ pointerAtEnding: v } as Partial<CanvasObject>)}
              />
            </>
          )}

          {!isArrow && <Separator className="opacity-40" />}
        </div>
      )}

      {/* ── Color presets (images only) ──────────────────────────────── */}
      {isImage && (
        <div className="px-4 pt-4 pb-3">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            Color Presets
          </p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-4">
            {COLOR_PRESETS.map((preset) => {
              const active = (object as ImageObject).colorFilter === preset.value;
              return (
                <button
                  key={preset.value}
                  onClick={() =>
                    upd({ colorFilter: active ? 'none' : preset.value } as Partial<CanvasObject>)
                  }
                  className="flex flex-col items-center gap-1.5 group focus:outline-none"
                >
                  <div
                    className={cn(
                      'w-full aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                      active
                        ? 'border-primary'
                        : 'border-transparent group-hover:border-muted-foreground/40'
                    )}
                  >
                    {(object as ImageObject).src ? (
                      <img
                        src={(object as ImageObject).src}
                        alt={preset.name}
                        draggable={false}
                        style={{
                          filter: preset.cssFilter,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs leading-none',
                      active ? 'text-primary font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
          <Separator className="mt-4 opacity-40" />
        </div>
      )}

      {/* ── Text properties (text objects only) ──────────────────────── */}
      {isText && (
        <>
          {/* Text Color */}
          <div className="flex items-center justify-between py-3 px-4">
            <span className="text-sm">Color</span>
            <ColorPickerButton
              label="Text Color"
              color={(object as TextObject).fill}
              onChange={(v) => upd({ fill: v } as Partial<CanvasObject>)}
              side="left"
            />
          </div>
          <Separator className="opacity-40" />

          {/* Curved Text */}
          <EffectRow
            label="Curved Text"
            enabled={Math.abs((object as TextObject).textCurve ?? 0) >= 1}
            onToggle={(v) => upd({ textCurve: v ? 50 : 0 } as Partial<CanvasObject>)}
          >
            <BidirectionalSlider
              value={(object as TextObject).textCurve ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ textCurve: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          {/* Text Stroke */}
          <EffectRow
            label="Text Stroke"
            enabled={((object as TextObject).textStrokeWidth ?? 0) > 0}
            onToggle={(v) =>
              upd({
                textStrokeColor: v ? '#000000' : undefined,
                textStrokeWidth: v ? 2 : 0,
              } as Partial<CanvasObject>)
            }
          >
            <ColorRow
              label="Color"
              value={(object as TextObject).textStrokeColor || '#000000'}
              onChange={(v) => upd({ textStrokeColor: v } as Partial<CanvasObject>)}
            />
            <SliderRow
              label="Width"
              value={(object as TextObject).textStrokeWidth ?? 0}
              min={0}
              max={20}
              onChange={(v) => upd({ textStrokeWidth: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          {/* Text Background */}
          <EffectRow
            label="Background"
            enabled={!!(object as TextObject).textBgColor}
            onToggle={(v) =>
              upd({
                textBgColor: v ? '#7ED321' : undefined,
                textBgOpacity: v ? 1 : undefined,
              } as Partial<CanvasObject>)
            }
          >
            <ColorRow
              label="Color"
              value={(object as TextObject).textBgColor || '#7ED321'}
              onChange={(v) => upd({ textBgColor: v } as Partial<CanvasObject>)}
            />
            <SliderRow
              label="Opacity"
              value={Math.round(((object as TextObject).textBgOpacity ?? 1) * 100)}
              min={0}
              max={100}
              onChange={(v) => upd({ textBgOpacity: v / 100 } as Partial<CanvasObject>)}
            />
            <SliderRow
              label="Padding"
              value={(object as TextObject).textBgPadding ?? 8}
              min={0}
              max={50}
              onChange={(v) => upd({ textBgPadding: v } as Partial<CanvasObject>)}
            />
            <SliderRow
              label="Radius"
              value={(object as TextObject).textBgCornerRadius ?? 0}
              min={0}
              max={50}
              onChange={(v) => upd({ textBgCornerRadius: v } as Partial<CanvasObject>)}
            />
          </EffectRow>
        </>
      )}

      {/* ── Blur (all except line/arrow) ─────────────────────────────── */}
      {!isLine && (
        <EffectRow
          label="Blur"
          enabled={blurEnabled}
          onToggle={(v) => upd({ filterBlur: v ? 5 : 0 } as Partial<CanvasObject>)}
        >
          <SliderRow
            value={object.filterBlur ?? 0}
            min={0}
            max={40}
            onChange={(v) => upd({ filterBlur: v } as Partial<CanvasObject>)}
          />
        </EffectRow>
      )}

      {/* ── Image-only adjustment controls ───────────────────────────── */}
      {isImage && (
        <>
          <EffectRow
            label="Brightness"
            enabled={brightnessEnabled}
            onToggle={(v) => upd({ filterBrightness: v ? 20 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterBrightness ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterBrightness: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="Temperature"
            enabled={temperatureEnabled}
            onToggle={(v) => upd({ filterTemperature: v ? 30 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterTemperature ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterTemperature: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="Contrast"
            enabled={contrastEnabled}
            onToggle={(v) => upd({ filterContrast: v ? 20 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterContrast ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterContrast: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="Shadows"
            enabled={shadowsEnabled}
            onToggle={(v) => upd({ filterShadows: v ? 30 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterShadows ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterShadows: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="White"
            enabled={whiteEnabled}
            onToggle={(v) => upd({ filterWhites: v ? 30 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterWhites ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterWhites: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="Black"
            enabled={blackEnabled}
            onToggle={(v) => upd({ filterBlacks: v ? -30 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterBlacks ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterBlacks: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="Vibrance"
            enabled={vibranceEnabled}
            onToggle={(v) => upd({ filterVibrance: v ? 30 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterVibrance ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterVibrance: v } as Partial<CanvasObject>)}
            />
          </EffectRow>

          <EffectRow
            label="Saturation"
            enabled={saturationEnabled}
            onToggle={(v) => upd({ filterSaturation: v ? 30 : 0 } as Partial<CanvasObject>)}
          >
            <SliderRow
              value={object.filterSaturation ?? 0}
              min={-100}
              max={100}
              onChange={(v) => upd({ filterSaturation: v } as Partial<CanvasObject>)}
            />
          </EffectRow>
        </>
      )}

      {/* ── Border (shapes + table) ───────────────────────────────────── */}
      {hasBorderSupport && (
        <EffectRow
          label="Border"
          enabled={borderEnabled}
          onToggle={(v) =>
            upd({
              stroke: v ? '#000000' : 'transparent',
              strokeWidth: v ? 2 : 0,
            } as Partial<CanvasObject>)
          }
        >
          <ColorRow
            label="Color"
            value={(object as any).stroke || '#000000'}
            onChange={(v) => upd({ stroke: v } as Partial<CanvasObject>)}
          />
          <SliderRow
            label="Width"
            value={(object as any).strokeWidth ?? 0}
            min={0}
            max={50}
            onChange={(v) => upd({ strokeWidth: v } as Partial<CanvasObject>)}
          />
        </EffectRow>
      )}

      {/* ── Corner Radius (rectangle only) ───────────────────────────── */}
      {isRectangle && (
        <EffectRow
          label="Corner Radius"
          enabled={cornerEnabled}
          onToggle={(v) => upd({ cornerRadius: v ? 10 : 0 } as Partial<CanvasObject>)}
        >
          <SliderRow
            value={(object as RectangleObject).cornerRadius ?? 0}
            min={0}
            max={200}
            onChange={(v) => upd({ cornerRadius: v } as Partial<CanvasObject>)}
          />
        </EffectRow>
      )}

      {/* ── Drop Shadow (all objects) ─────────────────────────────────── */}
      <EffectRow
        label="Shadow"
        enabled={dropShadowEnabled}
        onToggle={(v) =>
          upd(
            v
              ? {
                  shadowColor: '#000000',
                  shadowBlur: 10,
                  shadowOffsetX: 5,
                  shadowOffsetY: 5,
                  shadowOpacity: 0.5,
                }
              : { shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, shadowOpacity: 0 }
          )
        }
      >
        <ColorRow
          label="Color"
          value={object.shadowColor || '#000000'}
          onChange={(v) => upd({ shadowColor: v })}
        />
        <SliderRow
          label="Blur"
          value={object.shadowBlur ?? 0}
          min={0}
          max={50}
          onChange={(v) => upd({ shadowBlur: v })}
        />
        <SliderRow
          label="Offset X"
          value={object.shadowOffsetX ?? 0}
          min={-50}
          max={50}
          onChange={(v) => upd({ shadowOffsetX: v })}
        />
        <SliderRow
          label="Offset Y"
          value={object.shadowOffsetY ?? 0}
          min={-50}
          max={50}
          onChange={(v) => upd({ shadowOffsetY: v })}
        />
        <SliderRow
          label="Opacity"
          value={Math.round((object.shadowOpacity ?? 0.5) * 100)}
          min={0}
          max={100}
          onChange={(v) => upd({ shadowOpacity: v / 100 })}
        />
      </EffectRow>
    </div>
  );
};

// ── Panel shell ──────────────────────────────────────────────────────────────

interface EffectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({ isOpen, onClose }) => {
  const isDesktop = useIsDesktop();
  const { selectedIds, objects, updateObject } = useCanvasObjects();

  const selectedObject = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return objects.find((o) => o.id === selectedIds[0]) ?? null;
  }, [selectedIds, objects]);

  // Close panel when nothing is selected
  useEffect(() => {
    if (isOpen && selectedIds.length === 0) {
      onClose();
    }
  }, [selectedIds, isOpen, onClose]);

  const body = selectedObject ? (
    <PanelContent object={selectedObject} onUpdate={updateObject} />
  ) : (
    <div className="p-6 text-sm text-muted-foreground text-center">
      Select an object to see its effects.
    </div>
  );

  if (isDesktop) {
    return (
      <motion.aside
        initial={false}
        animate={{ width: isOpen ? 280 : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:block h-full bg-card border-l border-panel-border overflow-hidden shrink-0"
      >
        <div className="w-[280px]">
          <PanelHeader onClose={onClose} />
          <ScrollArea className="h-[calc(100dvh-8rem)]">{body}</ScrollArea>
        </div>
      </motion.aside>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-[150] max-h-[50vh] bg-card rounded-t-2xl border-t border-panel-border shadow-editor-lg lg:hidden flex flex-col"
        >
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <PanelHeader onClose={onClose} />
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{body}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

const PanelHeader: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex items-center justify-between h-12 px-4 border-b border-panel-border">
    <div className="flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-muted-foreground" />
      <h3 className="font-semibold text-sm">Effects</h3>
    </div>
    <Button
      variant="ghost"
      size="icon"
      onClick={onClose}
      className="h-7 w-7 text-muted-foreground hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </Button>
  </div>
);

export default EffectsPanel;

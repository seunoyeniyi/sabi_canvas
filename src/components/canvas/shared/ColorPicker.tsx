import React, { startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RgbaColorPicker, RgbColorPicker } from 'react-colorful';
import { Pipette } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import CanvasObjectsContext from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { cn } from '@sabi-canvas/lib/utils';
import {
  DEFAULT_COLOR_SWATCHES,
  collectDesignColors,
  formatColor,
  isSameColor,
  parseCssColor,
  parseHexInput,
  toHex6,
  type RgbaColor,
} from '@sabi-canvas/lib/color';

const WHITE: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };

/**
 * The picker's handle follows the pointer on every move. The editor gets the
 * colour once the pointer pauses this long, or is let go, because each change
 * redraws the whole editor. That redraw runs as a transition, which React
 * pauses whenever the pointer moves again, so it never holds up the handle.
 */
const CHANGE_DELAY_MS = 120;

/** Swatches fit two rows of eight, so the picker stays short on phones. */
const SWATCH_COLUMNS = 8;
const SWATCH_ROWS = 2;

/**
 * Theme classes for a colour chip: the checkerboard squares take the text
 * colour, so see-through colours read as see-through in light and dark mode.
 */
export const CHECKERBOARD_CLASS = 'bg-background text-muted-foreground/30';

/** Inline style that lays `color` over the checkerboard (pair with CHECKERBOARD_CLASS). */
export const checkerboardStyle = (color?: string): React.CSSProperties => ({
  backgroundImage: [
    color ? `linear-gradient(${color}, ${color})` : null,
    'repeating-conic-gradient(currentColor 0% 25%, transparent 0% 50%)',
  ].filter(Boolean).join(', '),
  backgroundSize: color ? '100% 100%, 8px 8px' : '8px 8px',
});

interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>;
}

const getEyeDropper = (): (new () => EyeDropperApi) | undefined =>
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;

interface Swatch {
  css: string;
  rgba: RgbaColor;
}

interface SwatchGridProps {
  colors: Swatch[];
  current: RgbaColor;
  onPick: (color: RgbaColor) => void;
  /** Adds a "no colour" swatch in the first slot. */
  withNone?: boolean;
}

const swatchClass = (selected: boolean) =>
  cn(
    'relative aspect-square w-full cursor-pointer overflow-hidden rounded-sm border border-panel-border transition-transform hover:scale-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
    CHECKERBOARD_CLASS,
    selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
  );

const SwatchGrid: React.FC<SwatchGridProps> = ({ colors, current, onPick, withNone }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {withNone && (
      <button
        type="button"
        title="No colour"
        aria-label="No colour"
        aria-pressed={current.a === 0}
        onClick={() => onPick({ ...current, a: 0 })}
        className={swatchClass(current.a === 0)}
        style={checkerboardStyle()}
      >
        <span className="absolute left-1/2 top-[-20%] h-[140%] w-0.5 -translate-x-1/2 rotate-45 bg-destructive" />
      </button>
    )}
    {colors.map(({ css, rgba }) => {
      const selected = isSameColor(rgba, current);
      return (
        <button
          key={css}
          type="button"
          title={css}
          aria-label={`Colour ${css}`}
          aria-pressed={selected}
          onClick={() => onPick(rgba)}
          className={swatchClass(selected)}
          style={checkerboardStyle(css)}
        />
      );
    })}
  </div>
);

export interface ColorPickerPanelProps {
  color: string;
  onChange: (color: string) => void;
  /** Show the transparency slider, opacity box and "no colour" swatch. Default true. */
  allowAlpha?: boolean;
  className?: string;
}

/**
 * Colour picker: picker area with hue and transparency sliders, hex and
 * opacity boxes, a screen eyedropper where the browser has one, and two rows
 * of swatches (colours already in the design first, then `config.colorSwatches`
 * or a default palette). Emits '#rrggbb' for solid colours and 'rgba(…)' for
 * see-through ones.
 */
export const ColorPickerPanel: React.FC<ColorPickerPanelProps> = ({
  color,
  onChange,
  allowAlpha = true,
  className,
}) => {
  const { colorSwatches } = useSabiCanvasConfig();
  const canvasObjects = useContext(CanvasObjectsContext);

  const [value, setValue] = useState<RgbaColor>(() => parseCssColor(color) ?? WHITE);
  // Text being typed in the hex / opacity boxes; null shows the current colour.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);
  // Taken once when the picker opens, so the list doesn't shift while picking.
  const [designColors] = useState(() => (canvasObjects ? collectDesignColors(canvasObjects.pages) : []));

  // ── Sending changes to the editor ──
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const pendingRef = useRef<string | null>(null);
  // Colours sent that the editor hasn't shown back yet.
  const sentRef = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const next = pendingRef.current;
    if (next === null) return;
    pendingRef.current = null;
    sentRef.current = [...sentRef.current.slice(-19), next];
    startTransition(() => onChangeRef.current(next));
  }, []);

  // Closing the picker sends the last colour.
  useEffect(() => flush, [flush]);

  const send = (next: string, immediately: boolean) => {
    pendingRef.current = next;
    if (immediately) {
      flush();
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, CHANGE_DELAY_MS);
  };

  // Follow outside changes (undo, another object selected), but not our own
  // colours coming back, nor an older one while a newer change is waiting.
  useEffect(() => {
    if (pendingRef.current !== null) return;
    const sent = sentRef.current;
    if (sent.includes(color)) {
      if (color === sent[sent.length - 1]) sentRef.current = [];
      return;
    }
    const parsed = parseCssColor(color);
    if (parsed) setValue((current) => (isSameColor(current, parsed) ? current : parsed));
  }, [color]);

  /** `immediately` for single actions (swatch, typed value); dragging waits. */
  const commit = (next: RgbaColor, immediately = true) => {
    const safe = allowAlpha ? next : { ...next, a: 1 };
    setValue(safe);
    send(formatColor(safe), immediately);
  };

  /**
   * Choosing a colour for a fully see-through one means the person wants to
   * see it, so it becomes solid. Partly see-through colours keep their opacity.
   */
  const visibleIfHidden = (next: RgbaColor): RgbaColor =>
    value.a === 0 && next.a === 0 ? { ...next, a: 1 } : next;

  // Which part of the picker was last touched: only the colour area and hue
  // slider make a hidden colour visible, not the transparency slider. (On a
  // see-through black, moving the hue doesn't change the colour values, so
  // the values alone can't tell.)
  const touchedPartRef = useRef<'color' | 'alpha'>('color');
  const noteTouchedPart = (target: EventTarget) => {
    touchedPartRef.current = (target as Element).closest?.('.react-colorful__alpha') ? 'alpha' : 'color';
  };

  const EyeDropper = getEyeDropper();
  const pickFromScreen = async () => {
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const picked = parseCssColor(sRGBHex);
      if (picked) commit(visibleIfHidden({ ...picked, a: value.a }));
    } catch {
      // Closed without picking.
    }
  };

  const palette = colorSwatches?.length ? colorSwatches : DEFAULT_COLOR_SWATCHES;

  // One grid, two rows: the design's colours first, then the palette, with
  // no repeats, after the "no colour" swatch when transparency is allowed.
  const swatches = useMemo(() => {
    const slots = SWATCH_COLUMNS * SWATCH_ROWS - (allowAlpha ? 1 : 0);
    const seen = new Set<string>();
    const list: Swatch[] = [];
    for (const css of [...designColors, ...palette]) {
      const rgba = parseCssColor(css);
      if (!rgba || (!allowAlpha && rgba.a < 1)) continue;
      const key = formatColor(rgba);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ css, rgba });
      if (list.length === slots) break;
    }
    return list;
  }, [designColors, palette, allowAlpha]);

  return (
    <div className={cn('flex w-56 flex-col gap-3', className)}>
      <div
        onPointerDownCapture={(event) => noteTouchedPart(event.target)}
        onKeyDownCapture={(event) => noteTouchedPart(event.target)}
        // Letting go applies the colour straight away.
        onPointerUp={flush}
        onPointerCancel={flush}
        onKeyUp={flush}
      >
        {allowAlpha ? (
          <RgbaColorPicker
            color={value}
            onChange={(next) => commit(touchedPartRef.current === 'color' ? visibleIfHidden(next) : next, false)}
            style={{ width: '100%', height: 168 }}
          />
        ) : (
          <RgbColorPicker color={value} onChange={(next) => commit({ ...next, a: 1 }, false)} style={{ width: '100%', height: 168 }} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-input px-2">
          <span className="text-xs text-muted-foreground">#</span>
          <input
            aria-label="Hex colour"
            value={hexDraft ?? toHex6(value).slice(1)}
            maxLength={6}
            spellCheck={false}
            onChange={(event) => {
              const draft = event.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
              setHexDraft(draft);
              const rgb = draft.length === 6 ? parseHexInput(draft) : null;
              if (rgb) commit(visibleIfHidden({ ...rgb, a: value.a }));
            }}
            onBlur={() => {
              const rgb = hexDraft === null ? null : parseHexInput(hexDraft);
              if (rgb && toHex6(rgb) !== toHex6(value)) commit(visibleIfHidden({ ...rgb, a: value.a }));
              setHexDraft(null);
            }}
            className="w-full min-w-0 bg-transparent text-xs uppercase focus:outline-hidden"
          />
        </label>
        {allowAlpha && (
          <label className="flex h-8 w-16 shrink-0 items-center gap-0.5 rounded-md border border-input px-2">
            <input
              aria-label="Opacity"
              inputMode="numeric"
              value={opacityDraft ?? String(Math.round(value.a * 100))}
              onChange={(event) => {
                const draft = event.target.value.replace(/\D/g, '').slice(0, 3);
                setOpacityDraft(draft);
                // Typing "50" passes through "5": wait for the pause.
                if (draft !== '') commit({ ...value, a: Math.min(100, Number(draft)) / 100 }, false);
              }}
              onBlur={() => {
                flush();
                setOpacityDraft(null);
              }}
              className="w-full min-w-0 bg-transparent text-right text-xs focus:outline-hidden"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </label>
        )}
        {EyeDropper && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Pick a colour from the screen"
            title="Pick a colour from the screen"
            onClick={pickFromScreen}
          >
            <Pipette className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <SwatchGrid colors={swatches} current={value} onPick={commit} withNone={allowAlpha} />
    </div>
  );
};

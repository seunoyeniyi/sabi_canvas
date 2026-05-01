import React from 'react';
import { Grid3X3 } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@sabi-canvas/ui/popover';
import { Slider } from '@sabi-canvas/ui/slider';
import { Label } from '@sabi-canvas/ui/label';
import { Separator } from '@sabi-canvas/ui/separator';
import { cn } from '@sabi-canvas/lib/utils';
import type { TableBorderConfig, TableBorderStyle } from '@sabi-canvas/types/canvas-objects';

interface TableBorderButtonProps {
  border: TableBorderConfig;
  onChange: (updates: Partial<TableBorderConfig>) => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const BORDER_STYLES: { value: TableBorderStyle; label: string; preview: string }[] = [
  { value: 'none',   label: 'None',   preview: '—' },
  { value: 'solid',  label: 'Solid',  preview: '—' },
  { value: 'dashed', label: 'Dashed', preview: '- -' },
  { value: 'dotted', label: 'Dotted', preview: '···' },
];

type BorderKey = 'outerTop' | 'outerBottom' | 'outerLeft' | 'outerRight' | 'innerHorizontal' | 'innerVertical';

interface BorderPreset {
  label: string;
  keys: BorderKey[];
  svg: React.ReactNode;
}

const BorderPresets: BorderPreset[] = [
  {
    label: 'All borders',
    keys: ['outerTop', 'outerBottom', 'outerLeft', 'outerRight', 'innerHorizontal', 'innerVertical'],
    svg: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x={1} y={1} width={14} height={14} />
        <line x1={8} y1={1} x2={8} y2={15} />
        <line x1={1} y1={8} x2={15} y2={8} />
      </svg>
    ),
  },
  {
    label: 'Outer border only',
    keys: ['outerTop', 'outerBottom', 'outerLeft', 'outerRight'],
    svg: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <rect x={1} y={1} width={14} height={14} />
      </svg>
    ),
  },
  {
    label: 'Inner grid only',
    keys: ['innerHorizontal', 'innerVertical'],
    svg: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <line x1={8} y1={1} x2={8} y2={15} />
        <line x1={1} y1={8} x2={15} y2={8} />
      </svg>
    ),
  },
  {
    label: 'Inner horizontal',
    keys: ['innerHorizontal'],
    svg: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <line x1={1} y1={8} x2={15} y2={8} />
      </svg>
    ),
  },
  {
    label: 'Inner vertical',
    keys: ['innerVertical'],
    svg: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5}>
        <line x1={8} y1={1} x2={8} y2={15} />
      </svg>
    ),
  },
  {
    label: 'No borders',
    keys: [],
    svg: (
      <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.3}>
        <rect x={1} y={1} width={14} height={14} strokeDasharray="2 2" />
      </svg>
    ),
  },
];

export const TableBorderButton: React.FC<TableBorderButtonProps> = ({ border, onChange, side = 'bottom' }) => {
  const allBorderKeys: BorderKey[] = ['outerTop', 'outerBottom', 'outerLeft', 'outerRight', 'innerHorizontal', 'innerVertical'];

  const applyPreset = (keys: BorderKey[]) => {
    const updates: Partial<TableBorderConfig> = {};
    allBorderKeys.forEach((k) => {
      (updates as Record<string, boolean>)[k] = keys.includes(k);
    });
    onChange(updates);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" title="Table borders">
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align="center" className="w-56 p-3 space-y-3">
        {/* Border position presets */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Border position</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {BorderPresets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="icon"
                className="h-9 w-full flex-shrink-0"
                title={preset.label}
                onClick={() => applyPreset(preset.keys)}
              >
                {preset.svg}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Border style */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Style</Label>
          <div className="grid grid-cols-4 gap-1">
            {BORDER_STYLES.map((s) => (
              <Button
                key={s.value}
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 px-1 text-[10px] flex-shrink-0',
                  border.style === s.value && 'bg-secondary text-secondary-foreground border-primary/40'
                )}
                onClick={() => onChange({ style: s.value })}
                title={s.label}
              >
                {s.preview}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Border color */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={border.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded border border-border p-0.5 bg-transparent"
            />
            <span className="text-xs text-muted-foreground font-mono">{border.color}</span>
          </div>
        </div>

        {/* Border width */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Width — {border.width}px
          </Label>
          <Slider
            min={0.5}
            max={8}
            step={0.5}
            value={[border.width]}
            onValueChange={([val]) => onChange({ width: val })}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

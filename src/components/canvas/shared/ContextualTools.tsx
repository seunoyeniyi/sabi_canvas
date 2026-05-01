import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { HexColorPicker } from 'react-colorful';
import {
  Square,
  Circle,
  Triangle,
  Star,
  Hexagon,
  Droplet,
  ArrowUp,
  ArrowDown,
  Layers,
  SunDim,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  ChevronDown,
  ChevronUp,
  Shapes,
  ChevronsUp,
  ChevronsDown,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from '@sabi-canvas/ui/popover';
import { Slider } from '@sabi-canvas/ui/slider';
import { Input } from '@sabi-canvas/ui/input';
import { Label } from '@sabi-canvas/ui/label';
import { Separator } from '@sabi-canvas/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import { cn } from '@sabi-canvas/lib/utils';
import { ImageMaskShape, CanvasObject } from '@sabi-canvas/types/canvas-objects';
import type { AIWriteAction } from '@sabi-canvas/hooks/useAIWrite';

export interface ToolbarTooltipProps {
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
}

export const ToolbarTooltip: React.FC<ToolbarTooltipProps> = ({ label, side = 'top', children }) => {
  const isTouchLikeDevice = typeof window !== 'undefined'
    && window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const [mobileOpen, setMobileOpen] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, [clearLongPressTimer]);

  const triggerWithTouchHandlers = useMemo(() => {
    if (!isTouchLikeDevice) return children;

    return React.cloneElement(children, {
      onPointerDown: (event: React.PointerEvent) => {
        children.props.onPointerDown?.(event);
        if (event.pointerType !== 'touch') return;

        clearLongPressTimer();
        longPressTimerRef.current = window.setTimeout(() => {
          setMobileOpen(true);
        }, 350);
      },
      onPointerUp: (event: React.PointerEvent) => {
        children.props.onPointerUp?.(event);
        clearLongPressTimer();

        if (mobileOpen) {
          window.setTimeout(() => setMobileOpen(false), 900);
        }
      },
      onPointerCancel: (event: React.PointerEvent) => {
        children.props.onPointerCancel?.(event);
        clearLongPressTimer();
      },
      onContextMenu: (event: React.MouseEvent) => {
        children.props.onContextMenu?.(event);
        if (isTouchLikeDevice) {
          event.preventDefault();
        }
      }
    });
  }, [children, isTouchLikeDevice, mobileOpen, clearLongPressTimer]);

  if (isTouchLikeDevice) {
    return (
      <Tooltip open={mobileOpen} defaultOpen={false}>
        <TooltipTrigger asChild>
          {triggerWithTouchHandlers}
        </TooltipTrigger>
        <TooltipContent side={side} className="text-xs px-2 py-1 bg-popover text-popover-foreground border shadow-sm">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="text-xs px-2 py-1 bg-popover text-popover-foreground border shadow-sm" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
};


export interface ColorPickerButtonProps {
  color: string;
  onChange: (color: string) => void;
  icon?: React.ReactNode;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
}

export const ColorPickerButton: React.FC<ColorPickerButtonProps> = ({
  color,
  onChange,
  icon,
  label,
  side = "bottom"
}) => {
  const [localColor, setLocalColor] = useState(color || '#ffffff');

  useEffect(() => {
    setLocalColor(color || '#ffffff');
  }, [color]);

  const handleColorChange = (newColor: string) => {
    setLocalColor(newColor);
    onChange(newColor);
  };

  return (
    <Popover>
      <ToolbarTooltip label={label} side={side}>
        <PopoverTrigger asChild>
          <Button
            // variant="ghost"
            size="icon"
            aria-label={label}
            className="h-8 w-8 relative group flex-shrink-0 rounded-sm border border-panel-border transition-transform hover:scale-110"
            style={{ backgroundColor: color || '#ffffff' }}
          >
            <div
              className="absolute inset-1.5 flex items-center justify-center"
            >
              {icon && React.cloneElement(icon as React.ReactElement, {
                className: cn("h-3 w-3", (color === '#ffffff' || !color) ? "" : "text-background/80 mix-blend-difference"),
              })}
            </div>
          </Button>
        </PopoverTrigger>
      </ToolbarTooltip>
      <PopoverContent
        className="w-auto p-3"
        align="center"
        side={side}
        onMouseDown={(e) => e.preventDefault()}
      >
        <Label className="text-xs mb-3 block font-medium">{label}</Label>
        <div className="flex flex-col gap-3">
          <HexColorPicker color={localColor} onChange={handleColorChange} />
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-1 border border-input rounded-md px-2 py-1 h-8">
                <span className="text-xs text-muted-foreground">#</span>
                <input
                  className="flex-1 bg-transparent border-none text-xs focus:outline-none uppercase"
                  value={localColor.replace('#', '')}
                  onChange={(e) => {
                    const val = '#' + e.target.value.replace('#', '');
                    setLocalColor(val);
                    if (val.length === 7) onChange(val);
                  }}
                  maxLength={6}
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const StrokeWidthButton: React.FC<{
  weight: number;
  onChange: (weight: number) => void;
  side?: "top" | "bottom" | "left" | "right";
}> = ({ weight, onChange, side = "bottom" }) => (
  <Popover>
    <ToolbarTooltip label="Stroke Weight" side={side}>
      <PopoverTrigger asChild>
        <Button aria-label="Stroke Weight" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 ">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 lucide lucide-line-style-icon lucide-line-style">
            <path d="M11 5h2" /><path d="M15 12h6" /><path d="M19 5h2" /><path d="M3 12h6" /><path d="M3 19h18" /><path d="M3 5h2" /></svg>

        </Button>
      </PopoverTrigger>
    </ToolbarTooltip>
    <PopoverContent className="w-48 p-3" side={side}>
      <Label className="text-xs mb-2 block">Weight: {weight || 0}px</Label>
      <Slider value={[weight || 0]} onValueChange={([val]) => onChange(val)} min={0} max={20} step={1} />
    </PopoverContent>
  </Popover>
);

export const OpacityButton: React.FC<{
  opacity: number;
  onChange: (opacity: number) => void;
  side?: "top" | "bottom" | "left" | "right";
}> = ({ opacity, onChange, side = "bottom" }) => (
  <Popover>
    <ToolbarTooltip label="Opacity" side={side}>
      <PopoverTrigger asChild>
        <Button aria-label="Opacity" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
          <Droplet className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
    </ToolbarTooltip>
    <PopoverContent className="w-48 p-3" side={side}>
      <div className="flex justify-between mb-2">
        <Label className="text-xs">Opacity</Label>
      </div>
      <Slider value={[(opacity ?? 1) * 100]} onValueChange={([val]) => onChange(val / 100)} min={0} max={100} step={1} />
    </PopoverContent>
  </Popover>
);

export const PositionAlignButton: React.FC<{
  onAlign: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onLayersChange: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  side?: "top" | "bottom" | "left" | "right";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}> = ({ onAlign, onLayersChange, side = "bottom", open, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button aria-label="Position" variant="ghost" className={cn("h-8 px-2 flex-shrink-0 text-xs font-medium", isOpen && "bg-muted text-foreground")}>
          <Layers className="h-4 w-4" />
          Position
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" side={side} align="center">
        <Label className="text-xs mb-2 block font-semibold">Layering</Label>
        <div className="grid grid-cols-2 gap-1 mb-3">
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('forward')}><ArrowUp className="h-3 w-3" />Forward</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('backward')}><ArrowDown className="h-3 w-3" />Backward</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('front')}><ChevronsUp className="h-3 w-3" />To Front</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('back')}><ChevronsDown className="h-3 w-3" />To back</Button>
        </div>
        <Separator className="my-2" />
        <Label className="text-xs mb-2 block font-semibold">Position</Label>
        <div className="grid grid-cols-2 gap-1 mb-3">
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('left')}><AlignLeft className="h-3 w-3" />Align left</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('top')}><ArrowUp className="h-3 w-3" />Align top</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('center')}><AlignCenter className="h-3 w-3" />Align center</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('middle')}><Move className="h-3 w-3" />Align middle</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('right')}><AlignRight className="h-3 w-3" />Align right</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('bottom')}><ArrowDown className="h-3 w-3" />Align bottom</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const AI_WRITE_ACTIONS: { id: AIWriteAction; label: string }[] = [
  { id: 'transform', label: 'Transform text' },
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'fix-spelling', label: 'Fix spelling' },
  { id: 'continue-writing', label: 'Continue writing' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'more-fun', label: 'More fun' },
  { id: 'more-formal', label: 'More formal' },
];

export const AIWriteButton: React.FC<{
  onAction: (action: AIWriteAction) => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isLoading?: boolean;
}> = ({ onAction, side = 'bottom', open, onOpenChange, isLoading = false }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          aria-label="AI Write"
          variant="ghost"
          className={cn('h-8 px-2 flex-shrink-0 text-xs font-medium gap-1.5', isOpen && 'bg-muted text-foreground')}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI Write
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" side={side} align="center">
        <div className="flex flex-col">
          {AI_WRITE_ACTIONS.map((action) => (
            <Button
              key={action.id}
              variant="ghost"
              className="h-9 justify-start rounded-md text-sm font-normal"
              onClick={() => {
                onAction(action.id);
                handleOpenChange(false);
              }}
              disabled={isLoading}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const MultipleAlignButton: React.FC<{
  onAlign: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onLayersChange: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  side?: "top" | "bottom" | "left" | "right";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}> = ({ onAlign, onLayersChange, side = "bottom", open, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button aria-label="Position" variant="ghost" className={cn("h-8 px-2 gap-1.5 flex-shrink-0 text-xs font-medium", isOpen && "bg-muted text-foreground")}>
          <Layers className="h-4 w-4" />
          Position
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" side={side} align="center">
        <Label className="text-xs mb-2 block font-semibold">Layering</Label>
        <div className="grid grid-cols-2 gap-1 mb-3">
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('forward')}><ArrowUp className="h-3 w-3" />Forward</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('backward')}><ArrowDown className="h-3 w-3" />Backward</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('front')}><ChevronsUp className="h-3 w-3" />To Front</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onLayersChange('back')}><ChevronsDown className="h-3 w-3" />To back</Button>
        </div>
        <Separator className="my-2" />
        <Label className="text-xs mb-2 block font-semibold">Position</Label>
        <div className="grid grid-cols-2 gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('left')}><AlignLeft className="h-3 w-3" />Align left</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('top')}><ArrowUp className="h-3 w-3" />Align top</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('center')}><AlignCenter className="h-3 w-3" />Align center</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('middle')}><Move className="h-3 w-3" />Align middle</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('right')}><AlignRight className="h-3 w-3" />Align right</Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs justify-start gap-1.5 !px-1 rounded-none" onClick={() => onAlign('bottom')}><ArrowDown className="h-3 w-3" />Align bottom</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ShadowButton: React.FC<{
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  color?: string;
  onChange: (updates: Partial<CanvasObject>) => void;
  side?: "top" | "bottom" | "left" | "right";
}> = ({ blur = 0, offsetX = 0, offsetY = 0, color = '#000000', onChange, side = "bottom" }) => (
  <Popover>
    <ToolbarTooltip label="Shadow" side={side}>
      <PopoverTrigger asChild>
        <Button aria-label="Shadow" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
          <SunDim className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
    </ToolbarTooltip>
    <PopoverContent className="w-56 p-3" side={side}>
      <Label className="text-xs mb-3 block font-medium">Shadow Settings</Label>
      <div className="space-y-3">
        <div className="space-y-1"><Label className="text-[10px]">Blur</Label><Slider value={[blur]} onValueChange={([val]) => onChange({ shadowBlur: val })} min={0} max={50} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-[10px]">Off X</Label><Slider value={[offsetX]} onValueChange={([val]) => onChange({ shadowOffsetX: val })} min={-50} max={50} /></div>
          <div className="space-y-1"><Label className="text-[10px]">Off Y</Label><Slider value={[offsetY]} onValueChange={([val]) => onChange({ shadowOffsetY: val })} min={-50} max={50} /></div>
        </div>
        <div className="flex items-center gap-2"><Label className="text-[10px]">Color</Label><Input type="color" value={color} onChange={(e) => onChange({ shadowColor: e.target.value })} className="w-6 h-6 p-0 border-0" /></div>
      </div>
    </PopoverContent>
  </Popover>
);

const MASK_OPTIONS: { id: ImageMaskShape; label: string; icon: React.ReactNode }[] = [
  { id: 'none', label: 'None', icon: <Square className="h-4 w-4" /> },
  { id: 'circle', label: 'Circle', icon: <Circle className="h-4 w-4" /> },
  { id: 'ellipse', label: 'Ellipse', icon: <Circle className="h-4 w-4" style={{ transform: 'scaleX(1.3)' }} /> },
  { id: 'triangle', label: 'Triangle', icon: <Triangle className="h-4 w-4" /> },
  { id: 'star', label: 'Star', icon: <Star className="h-4 w-4" /> },
  { id: 'hexagon', label: 'Hexagon', icon: <Hexagon className="h-4 w-4" /> },
  { id: 'rounded-rect', label: 'Rounded', icon: <Square className="h-4 w-4 rounded" /> },
];

export const MaskShapeButton: React.FC<{
  currentMask: ImageMaskShape;
  onChange: (mask: ImageMaskShape) => void;
  side?: "top" | "bottom" | "left" | "right";
}> = ({ currentMask, onChange, side = "bottom" }) => (
  <Popover>
    <ToolbarTooltip label="Mask to Shape" side={side}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Mask to Shape"
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 flex-shrink-0 ", currentMask !== 'none' && "text-primary")}
        >
          <Shapes className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
    </ToolbarTooltip>
    <PopoverContent className="w-auto p-2" side={side} align="center">
      <Label className="text-[10px] text-muted-foreground px-2 mb-1 block">Mask Shape</Label>
      <div className="grid grid-cols-4 gap-1">
        {MASK_OPTIONS.map(opt => (
          <Button
            key={opt.id}
            variant={currentMask === opt.id ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8 flex-col gap-0 !p-0"
            onClick={() => onChange(opt.id)}
            title={opt.label}
          >
            {opt.icon}
          </Button>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

export const LineHeightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M13 18 L16 21 L19 18" />
    <path d="M16 21 V3" />
    <path d="M13 6 L16 3 L19 6" />
    <path d="M9 4 H3" />
    <path d="M9 10 H3" />
    <path d="M9 16 H3" />
    <path d="M9 22 H3" />
  </svg>
);

export const TextSpacingButton: React.FC<{
  lineHeight: number;
  letterSpacing: number;
  padding?: number;
  onChange: (updates: Partial<CanvasObject>) => void;
  side?: "top" | "bottom" | "left" | "right";
}> = ({ lineHeight = 1.2, letterSpacing = 0, padding, onChange, side = "bottom" }) => (
  <Popover>
    <ToolbarTooltip label="Line Height & Spacing" side={side}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Line Height & Spacing"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 "
        >
          <LineHeightIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
    </ToolbarTooltip>
    <PopoverContent className="w-56 p-3" side={side}>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs">Line Height</Label>
            <span className="text-xs text-muted-foreground">{lineHeight.toFixed(2)}</span>
          </div>
          <Slider
            value={[lineHeight]}
            onValueChange={([val]) => onChange({ lineHeight: Number(val.toFixed(2)) })}
            min={0.7}
            max={3}
            step={0.01}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs">Letter Spacing</Label>
            <span className="text-xs text-muted-foreground">{letterSpacing.toFixed(1)}px</span>
          </div>
          <Slider
            value={[letterSpacing]}
            onValueChange={([val]) => onChange({ letterSpacing: Number(val.toFixed(1)) })}
            min={-10}
            max={50}
            step={0.5}
          />
        </div>

        {padding !== undefined && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Text Padding</Label>
              <span className="text-xs text-muted-foreground">{padding}px</span>
            </div>
            <Slider
              value={[padding]}
              onValueChange={([val]) => onChange({ innerTextPadding: val })}
              min={0}
              max={100}
              step={1}
            />
          </div>
        )}
      </div>
    </PopoverContent>
  </Popover>
);

const COMMON_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 120, 144, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440, 460, 480, 500];

export const FontSizeButton: React.FC<{
  value: number;
  onChange: (value: number) => void;
  side?: "top" | "bottom" | "left" | "right";
  min?: number;
  max?: number;
}> = ({ value, onChange, side = "bottom", min = 8, max = 500 }) => {
  const [draft, setDraft] = useState(value.toString());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const ignoreBlurRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value.toString());
  }, [value]);

  const handleCommit = (valStr: string) => {
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setDraft(clamped.toString());
    } else {
      setDraft(value.toString());
    }
  };

  const handleIncrement = () => {
    const parsed = parseInt(draft, 10) || value;
    handleCommit((parsed + 1).toString());
  };

  const handleDecrement = () => {
    const parsed = parseInt(draft, 10) || value;
    handleCommit((parsed - 1).toString());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ToolbarTooltip label="Font Size" side={side}>
        <div 
          ref={containerRef}
          className="flex items-center h-8 border border-input rounded-md overflow-hidden bg-transparent shrink-0"
        >
          <PopoverAnchor asChild>
            <div className="relative h-full">
              <Input
                className="w-[48px] h-full border-0 focus-visible:ring-0 px-1 py-0 text-xs text-center rounded-none shadow-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setOpen(true)}
                onPointerDown={() => setOpen(true)}
                onBlur={(e) => {
                  if (ignoreBlurRef.current) return;
                  handleCommit(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCommit(draft);
                    setOpen(false);
                    ignoreBlurRef.current = true;
                    (e.target as HTMLInputElement).blur();
                    setTimeout(() => { ignoreBlurRef.current = false; }, 10);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    handleIncrement();
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    handleDecrement();
                  }
                }}
              />
            </div>
          </PopoverAnchor>
          <div className="flex flex-col border-l border-input h-full">
            <button 
              type="button"
              className="flex items-center justify-center flex-1 px-1 hover:bg-muted text-muted-foreground border-b border-input"
              onClick={handleIncrement}
              tabIndex={-1}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button 
              type="button"
              className="flex items-center justify-center flex-1 px-1 hover:bg-muted text-muted-foreground"
              onClick={handleDecrement}
              tabIndex={-1}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </ToolbarTooltip>
      <PopoverContent
        className="w-[60px] p-0 shadow-md border rounded-md hidden sm:block"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => {
            const activeItem = listRef.current?.querySelector('[data-active="true"]');
            if (activeItem) {
              activeItem.scrollIntoView({ block: 'center' });
            }
          }, 0);
        }}
        onInteractOutside={(e) => {
          if (containerRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
        align="start"
      >
        <div ref={listRef} className="flex flex-col max-h-[240px] overflow-y-auto custom-scrollbar overflow-x-hidden">
          {COMMON_FONT_SIZES.map((size) => (
            <button
              key={size}
              data-active={size === value}
              className={cn(
                "text-xs text-center py-1.5 hover:bg-muted font-mono w-full",
                size === value && "bg-secondary text-secondary-foreground font-bold"
              )}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent native blur sequence
                ignoreBlurRef.current = true;
                handleCommit(size.toString());
                setOpen(false);
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                setTimeout(() => { ignoreBlurRef.current = false; }, 10);
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

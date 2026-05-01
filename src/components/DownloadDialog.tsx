import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Download,
  Image as ImageIcon,
  FileImage,
  FileText,
  Loader2,
  Check,
  Monitor,
  Info,
  Layers,
  ScanLine,
} from 'lucide-react';
import Konva from 'konva';
import { Button } from '@sabi-canvas/ui/button';
import { Label } from '@sabi-canvas/ui/label';
import { Slider } from '@sabi-canvas/ui/slider';
import { Switch } from '@sabi-canvas/ui/switch';
import { Separator } from '@sabi-canvas/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@sabi-canvas/ui/sheet';
import { cn } from '@sabi-canvas/lib/utils';
import { useCanvasExport, ExportFormat, ExportOptions } from '@sabi-canvas/hooks/useCanvasExport';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';

interface DownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageRef: React.RefObject<Konva.Stage> | null;
}

interface FormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  supportsTransparency: boolean;
  supportsQuality: boolean;
  recommended?: boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'png',
    label: 'PNG',
    description: 'Graphics with transparency',
    icon: <FileImage className="h-5 w-5" />,
    supportsTransparency: true,
    supportsQuality: false,
    recommended: true,
  },
  {
    value: 'jpg',
    label: 'JPG',
    description: 'Smaller size, for photos',
    icon: <ImageIcon className="h-5 w-5" />,
    supportsTransparency: false,
    supportsQuality: true,
  },
  {
    value: 'webp',
    label: 'WEBP',
    description: 'Modern, best compression',
    icon: <Monitor className="h-5 w-5" />,
    supportsTransparency: true,
    supportsQuality: true,
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Best for printing',
    icon: <FileText className="h-5 w-5" />,
    supportsTransparency: false,
    supportsQuality: false,
  },
];

const SIZE_OPTIONS = [
  { value: 1, label: '1×', description: 'Standard' },
  { value: 2, label: '2×', description: 'High' },
  { value: 3, label: '3×', description: 'Very high' },
  { value: 4, label: '4×', description: 'Maximum' },
];

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  isOpen,
  onClose,
  stageRef,
}) => {
  const { canvasSize, isMockupEnabled } = useEditor();
  const { activePage, objects } = useCanvasObjects();
  const { exportCanvas, generatePreview, isExporting } = useCanvasExport(stageRef, canvasSize, activePage.background);

  const printAreaBounds = useMemo(() => {
    if (!isMockupEnabled) return null;
    const pa = objects.find((o) => o.type === 'print-area');
    if (!pa) return null;
    return { x: pa.x, y: pa.y, width: pa.width, height: pa.height };
  }, [isMockupEnabled, objects]);

  const [exportType, setExportType] = useState<'full' | 'print-area'>('full');
  const isPrintAreaMode = exportType === 'print-area' && !!printAreaBounds;

  const [format, setFormat] = useState<ExportFormat>('png');
  const [printAreaFormat, setPrintAreaFormat] = useState<'png' | 'pdf'>('png');
  const [quality, setQuality] = useState(92);
  const [sizeMultiplier, setSizeMultiplier] = useState(1);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Print-area mode: use printAreaFormat, always transparent
  const effectiveFormat: ExportFormat = isPrintAreaMode ? printAreaFormat : format;
  const effectiveTransparent = isPrintAreaMode ? true : transparentBackground;

  const selectedFormatOption = FORMAT_OPTIONS.find(f => f.value === effectiveFormat)!;
  const outputWidth = isPrintAreaMode ? (printAreaBounds!.width * sizeMultiplier) : (canvasSize.width * sizeMultiplier);
  const outputHeight = isPrintAreaMode ? (printAreaBounds!.height * sizeMultiplier) : (canvasSize.height * sizeMultiplier);
  const exportWidth = Math.round(outputWidth);
  const exportHeight = Math.round(outputHeight);

  // Generate preview when dialog opens or settings change
  const updatePreview = useCallback(async () => {
    if (!isOpen || !stageRef?.current) return;
    try {
      const url = await generatePreview({
        format: effectiveFormat,
        transparentBackground: effectiveTransparent,
        printAreaBounds: isPrintAreaMode ? printAreaBounds! : undefined,
      });
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    }
  }, [isOpen, stageRef, generatePreview, effectiveFormat, effectiveTransparent, isPrintAreaMode, printAreaBounds]);

  useEffect(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    previewTimeoutRef.current = setTimeout(updatePreview, 300);
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, [updatePreview]);

  // Reset success state
  useEffect(() => {
    if (downloadSuccess) {
      const t = setTimeout(() => setDownloadSuccess(false), 2500);
      return () => clearTimeout(t);
    }
  }, [downloadSuccess]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setDownloadSuccess(false);
      setExportType('full');
      setPrintAreaFormat('png');
    }
  }, [isOpen]);

  const handleDownload = async () => {
    const options: Partial<ExportOptions> = {
      format: effectiveFormat,
      quality,
      sizeMultiplier,
      transparentBackground: selectedFormatOption.supportsTransparency ? effectiveTransparent : false,
      printAreaBounds: isPrintAreaMode ? printAreaBounds! : undefined,
      fileName: isPrintAreaMode ? 'print-area' : 'design',
    };
    await exportCanvas(options);
    setDownloadSuccess(true);
  };

  // Force JPG to not have transparency
  useEffect(() => {
    if (!selectedFormatOption.supportsTransparency) {
      setTransparentBackground(false);
    }
  }, [effectiveFormat, selectedFormatOption]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-screen max-w-[100vw] sm:w-[400px] sm:max-w-[480px] flex flex-col p-0 gap-0 border-l border-panel-border overflow-hidden bg-card"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-2 border-b border-panel-border text-left">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Download className="h-4 w-4 text-white" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold">Download your design</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0">
                Choose your file format and settings
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Export type toggle — only shown when a print area exists */}
          {printAreaBounds && (
            <>
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">Export</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportType('full')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                      exportType === 'full'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                        : 'border-panel-border bg-background text-foreground hover:border-violet-400/50'
                    )}
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    Full design
                  </button>
                  <button
                    onClick={() => setExportType('print-area')}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                      exportType === 'print-area'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                        : 'border-panel-border bg-background text-foreground hover:border-violet-400/50'
                    )}
                  >
                    <ScanLine className="h-4 w-4 shrink-0" />
                    Print area
                  </button>
                </div>
                {isPrintAreaMode && (
                  <>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {([
                        { value: 'png' as const, label: 'PNG', description: 'Transparent', icon: <FileImage className="h-4 w-4" /> },
                        { value: 'pdf' as const, label: 'PDF', description: 'Print-ready', icon: <FileText className="h-4 w-4" /> },
                      ]).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPrintAreaFormat(opt.value)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all',
                            printAreaFormat === opt.value
                              ? 'border-violet-500 bg-violet-500/10 text-violet-600'
                              : 'border-panel-border bg-background text-foreground hover:border-violet-400/50'
                          )}
                        >
                          {opt.icon}
                          <span className="font-semibold">{opt.label}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{opt.description}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Exports the customer design within the print area — transparent background.
                    </p>
                  </>
                )}
              </div>
              <Separator className="bg-panel-border" />
            </>
          )}

          {/* Preview */}
              <div className="relative rounded-xl overflow-hidden border border-panel-border bg-muted/30">
                <div
                  className="flex items-center justify-center p-4"
                  style={{
                    minHeight: 160,
                    background: effectiveTransparent
                      ? 'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, transparent 0% 50%) 50% / 16px 16px'
                      : undefined,
                  }}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Export preview"
                      className="max-h-[140px] max-w-full object-contain shadow-md"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground py-4">
                      <ImageIcon className="h-8 w-8 opacity-40" />
                      <span className="text-xs">Preview loading...</span>
                    </div>
                  )}
                </div>
                {/* Dimensions badge */}
                <div className="absolute flex items-start justify-center bottom-2 right-2 px-2 py-0.5 rounded-md bg-background/90 backdrop-blur-sm border border-panel-border">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {exportWidth} × {exportHeight}px
                  </span>
                </div>
              </div>

              {/* File Type — hidden in print-area mode (always PNG) */}
              {!isPrintAreaMode && (
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">File type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {FORMAT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormat(option.value)}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200',
                        'hover:border-violet-400/50 hover:bg-violet-500/5',
                        format === option.value
                          ? 'border-violet-500 bg-violet-500/10 shadow-sm'
                          : 'border-panel-border bg-background'
                      )}
                    >
                      {option.recommended && (
                        <span className="absolute -top-1.5 right-1.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-violet-500 text-white rounded-full">
                          Best
                        </span>
                      )}
                      <div className={cn(
                        'transition-colors',
                        format === option.value ? 'text-violet-500' : 'text-muted-foreground'
                      )}>
                        {option.icon}
                      </div>
                      <span className={cn(
                        'text-sm font-semibold',
                        format === option.value ? 'text-violet-500' : 'text-foreground'
                      )}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              )}

              <Separator className="bg-panel-border" />

              {/* Size Multiplier */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Size</Label>
                  <span className="text-xs text-muted-foreground font-mono">
                    {exportWidth} × {exportHeight}px
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSizeMultiplier(option.value)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg border transition-all duration-200',
                        'hover:border-violet-400/50',
                        sizeMultiplier === option.value
                          ? 'border-violet-500 bg-violet-500/10 text-violet-500'
                          : 'border-panel-border bg-background text-foreground'
                      )}
                    >
                      <span className="text-sm font-bold">{option.label}</span>
                      <span className="text-[10px] text-muted-foreground">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Slider (JPG/WEBP only) */}
              {selectedFormatOption.supportsQuality && (
                <>
                  <Separator className="bg-panel-border" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Quality</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            Higher quality = larger file size
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className={cn(
                        'text-sm font-semibold tabular-nums min-w-[40px] text-right',
                        quality > 80 ? 'text-emerald-500' :
                        quality > 50 ? 'text-amber-500' : 'text-red-500'
                      )}>
                        {quality}%
                      </span>
                    </div>
                    <Slider
                      value={[quality]}
                      onValueChange={([v]) => setQuality(v)}
                      min={10}
                      max={100}
                      step={1}
                      className="[&>span:first-child]:h-1.5 [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&>span:first-child_span]:bg-violet-500"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Smaller file</span>
                      <span>Better quality</span>
                    </div>
                  </div>
                </>
              )}

              {/* Transparent Background (PNG/WEBP only, hidden in print-area mode) */}
              {selectedFormatOption.supportsTransparency && !isPrintAreaMode && (
                <>
                  <Separator className="bg-panel-border" />
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Transparent background</Label>
                      <p className="text-xs text-muted-foreground">
                        Remove the white background
                      </p>
                    </div>
                    <Switch
                      checked={transparentBackground}
                      onCheckedChange={setTransparentBackground}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-panel-border bg-muted/20">
              <Button
                onClick={handleDownload}
                disabled={isExporting}
                className={cn(
                  'w-full h-12 rounded-xl text-base font-semibold transition-all duration-300',
                  'shadow-lg hover:shadow-xl',
                  downloadSuccess
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white'
                )}
              >
                {isExporting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Preparing download...
                  </span>
                ) : downloadSuccess ? (
                  <span className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Downloaded!
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    {isPrintAreaMode ? 'Download Print Area' : `Download ${effectiveFormat.toUpperCase()}`}
                  </span>
                )}
              </Button>
            </div>
      </SheetContent>
    </Sheet>
  );
};

export default DownloadDialog;

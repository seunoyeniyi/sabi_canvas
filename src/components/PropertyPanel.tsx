import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  Palette,
  Move,
  Layers,
  Copy,
  Trash2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  SlidersHorizontal,
  SunDim,
} from 'lucide-react';
import { PropertyPanelProps } from '@sabi-canvas/types/editor';
import { Button } from '@sabi-canvas/ui/button';
import { Input } from '@sabi-canvas/ui/input';
import { Label } from '@sabi-canvas/ui/label';
import { Slider } from '@sabi-canvas/ui/slider';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { cn } from '@sabi-canvas/lib/utils';
import { useIsDesktop } from '@sabi-canvas/hooks/useMediaQuery';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useSelectedObject } from '@sabi-canvas/hooks/useSelectedObject';
import { CanvasObject, ImageObject, TableObject } from '@sabi-canvas/types/canvas-objects';

type TextSelection = Extract<CanvasObject, { type: 'text' }>;

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  isOpen,
  onClose,
  title = 'Properties',
  children,
  className,
}) => {
  const isDesktop = useIsDesktop();

  // Desktop: Persistent side panel
  if (isDesktop) {
    return (
      <motion.aside
        initial={false}
        animate={{
          width: isOpen ? 280 : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'hidden lg:block h-full bg-card overflow-hidden',
          className
        )}
      >
        <div className="w-[280px]">
          <PanelHeader title={title} onClose={onClose} />
          <ScrollArea className="h-[calc(100dvh-8rem)]">
            <div className="p-4 space-y-6">
              {children || <ContextualPropertyContent />}
            </div>
          </ScrollArea>
        </div>
      </motion.aside>
    );
  }

  // Mobile/Tablet: Overlay panel from bottom
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          />

          {/* Panel */}
          <motion.aside
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-[150]',
              'max-h-[70vh] bg-card rounded-t-2xl',
              'border-t border-panel-border shadow-editor-lg',
              'lg:hidden',
              className
            )}
          >
            {/* Drag Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <PanelHeader title={title} onClose={onClose} />

            <ScrollArea className="max-h-[calc(70vh-80px)]">
              <div className="p-4 pb-safe space-y-6">
                {children || <ContextualPropertyContent />}
              </div>
            </ScrollArea>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

interface PanelHeaderProps {
  title: string;
  onClose: () => void;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ title, onClose }) => (
  <div className="flex items-center justify-between h-12 px-4 border-b border-panel-border">
    <h3 className="font-semibold text-sm">{title}</h3>
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

const ContextualPropertyContent: React.FC = () => {
  const {
    selectedIds,
    updateObject,
    duplicateSelected,
    deleteSelectedObjects,
    bringToFront,
    sendToBack,
    objects,
  } = useCanvasObjects();
  const selectedObject = useSelectedObject();

  const selectedObjects = React.useMemo(
    () => objects.filter((obj) => selectedIds.includes(obj.id)),
    [objects, selectedIds]
  );

  if (selectedIds.length === 0 || !selectedObject) {
    return <EmptyPropertyContent />;
  }

  const isMultiSelect = selectedIds.length > 1;
  const isText = selectedObject.type === 'text';
  const isTable = selectedObject.type === 'table';
  const tableObject: TableObject | null = isTable ? (selectedObject as TableObject) : null;
  const textObject: TextSelection | null = isText ? selectedObject : null;
  const hasFill = 'fill' in selectedObject;
  const hasStroke = 'stroke' in selectedObject;
  const fillValue = hasFill ? selectedObject.fill : '#000000';
  const strokeValue = hasStroke ? selectedObject.stroke : '#000000';
  const strokeWidthValue = hasStroke ? selectedObject.strokeWidth : 0;

  const updateSingle = (updates: Partial<CanvasObject>) => {
    updateObject(selectedObject.id, updates);
  };

  const updateMany = (updates: Partial<CanvasObject>) => {
    selectedObjects.forEach((obj) => updateObject(obj.id, updates));
  };

  const updateNumeric = (prop: 'x' | 'y' | 'width' | 'height', value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;

    if (isMultiSelect) {
      return;
    }

    updateSingle({ [prop]: parsed } as Partial<CanvasObject>);
  };

  const toggleFontStyle = (style: 'bold' | 'italic') => {
    if (!textObject) return;

    const currentStyle = textObject.fontStyle || 'normal';
    let nextBold = currentStyle.includes('bold');
    let nextItalic = currentStyle.includes('italic');

    if (style === 'bold') nextBold = !nextBold;
    if (style === 'italic') nextItalic = !nextItalic;

    let nextStyle: TextSelection['fontStyle'] = 'normal';
    if (nextBold && nextItalic) nextStyle = 'bold italic';
    else if (nextBold) nextStyle = 'bold';
    else if (nextItalic) nextStyle = 'italic';

    updateSingle({ fontStyle: nextStyle } as Partial<CanvasObject>);
  };

  const toggleTextDecoration = (decoration: 'underline' | 'line-through') => {
    if (!textObject) return;

    const currentDecoration = (textObject.textDecoration || 'none') as string;
    const hasUnderline = currentDecoration.includes('underline');
    const hasStrike = currentDecoration.includes('line-through');

    let nextUnderline = hasUnderline;
    let nextStrike = hasStrike;

    if (decoration === 'underline') nextUnderline = !hasUnderline;
    if (decoration === 'line-through') nextStrike = !hasStrike;

    let nextDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through' = 'none';
    if (nextUnderline && nextStrike) nextDecoration = 'underline line-through';
    else if (nextUnderline) nextDecoration = 'underline';
    else if (nextStrike) nextDecoration = 'line-through';

    updateSingle({ textDecoration: nextDecoration } as Partial<CanvasObject>);
  };

  const textAlign = textObject?.align || 'left';
  const textStyle = textObject?.fontStyle || 'normal';
  const textDecoration = textObject?.textDecoration || 'none';

  // ---- Table helpers ----
  const updateTable = (updates: Partial<TableObject>) => {
    if (!tableObject) return;
    updateObject(tableObject.id, updates as Partial<CanvasObject>);
  };

  const changeTableRows = (nextRows: number) => {
    if (!tableObject || nextRows < 1) return;
    const current = tableObject;
    if (nextRows > current.rows) {
      const newCells = [...current.cells];
      for (let r = current.rows; r < nextRows; r++) {
        newCells.push(current.cells[0].map(() => ({ text: '' })));
      }
      const newHeights = [...current.rowHeights];
      for (let r = current.rows; r < nextRows; r++) {
        newHeights.push(current.rowHeights[0] ?? 40);
      }
      updateTable({ rows: nextRows, cells: newCells, rowHeights: newHeights });
    } else {
      updateTable({ rows: nextRows, cells: current.cells.slice(0, nextRows), rowHeights: current.rowHeights.slice(0, nextRows) });
    }
  };

  const changeTableCols = (nextCols: number) => {
    if (!tableObject || nextCols < 1) return;
    const current = tableObject;
    if (nextCols > current.cols) {
      const newCells = current.cells.map((row) => {
        const extended = [...row];
        for (let c = current.cols; c < nextCols; c++) extended.push({ text: '' });
        return extended;
      });
      const newWidths = [...current.colWidths];
      for (let c = current.cols; c < nextCols; c++) newWidths.push(current.colWidths[0] ?? 80);
      updateTable({ cols: nextCols, cells: newCells, colWidths: newWidths });
    } else {
      const newCells = current.cells.map((row) => row.slice(0, nextCols));
      updateTable({ cols: nextCols, cells: newCells, colWidths: current.colWidths.slice(0, nextCols) });
    }
  };

  return (
    <>
      {isMultiSelect && (
        <div className="rounded-lg border border-panel-border p-3 text-xs text-muted-foreground">
          {selectedIds.length} objects selected. Generic controls apply to all selected objects.
        </div>
      )}

      {isText && !isMultiSelect && (
        <PropertySection title="Typography" icon={<Type className="h-4 w-4" />}>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Font Size</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[Number(textObject?.fontSize ?? 16)]}
                  onValueChange={([val]) => updateSingle({ fontSize: val } as Partial<CanvasObject>)}
                  min={8}
                  max={400}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={String(textObject?.fontSize ?? 16)}
                  min={8}
                  max={400}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (!Number.isFinite(parsed)) return;
                    updateSingle({ fontSize: Math.max(8, Math.min(400, parsed)) } as Partial<CanvasObject>);
                  }}
                  className="w-20 h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Font Family</Label>
              <Input
                value={textObject?.fontFamily || 'Inter'}
                onChange={(e) => updateSingle({ fontFamily: e.target.value } as Partial<CanvasObject>)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </PropertySection>
      )}

      {isText && !isMultiSelect && (
        <PropertySection title="Text Styles & Align" icon={<SlidersHorizontal className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              <Button
                variant={textStyle.includes('bold') ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFontStyle('bold')}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                variant={textStyle.includes('italic') ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleFontStyle('italic')}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                variant={textDecoration.includes('underline') ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleTextDecoration('underline')}
              >
                <Underline className="h-4 w-4" />
              </Button>
              <Button
                variant={textDecoration.includes('line-through') ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleTextDecoration('line-through')}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant={textAlign === 'left' ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => updateSingle({ align: 'left' } as Partial<CanvasObject>)}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={textAlign === 'center' ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => updateSingle({ align: 'center' } as Partial<CanvasObject>)}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                variant={textAlign === 'right' ? 'secondary' : 'outline'}
                size="icon"
                className="h-8 w-8"
                onClick={() => updateSingle({ align: 'right' } as Partial<CanvasObject>)}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </PropertySection>
      )}

      {isText && !isMultiSelect && (
        <PropertySection title="Line Height & Spacing" icon={<SlidersHorizontal className="h-4 w-4" />}>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Line Height</Label>
                <span className="text-xs text-muted-foreground">{Number(textObject?.lineHeight ?? 1.2).toFixed(2)}</span>
              </div>
              <Slider
                value={[Number(textObject?.lineHeight ?? 1.2)]}
                onValueChange={([val]) => updateSingle({ lineHeight: Number(val.toFixed(2)) } as Partial<CanvasObject>)}
                min={0.7}
                max={3}
                step={0.01}
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Letter Spacing</Label>
                <span className="text-xs text-muted-foreground">{Number(textObject?.letterSpacing ?? 0).toFixed(1)}px</span>
              </div>
              <Slider
                value={[Number(textObject?.letterSpacing ?? 0)]}
                onValueChange={([val]) => updateSingle({ letterSpacing: Number(val.toFixed(1)) } as Partial<CanvasObject>)}
                min={-10}
                max={40}
                step={0.1}
              />
            </div>
          </div>
        </PropertySection>
      )}

      {isTable && !isMultiSelect && tableObject && (
        <PropertySection title="Table" icon={<SlidersHorizontal className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Rows</Label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 text-base"
                    onClick={() => changeTableRows(tableObject.rows - 1)}>−</Button>
                  <span className="w-8 text-center text-sm">{tableObject.rows}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 text-base"
                    onClick={() => changeTableRows(tableObject.rows + 1)}>+</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Columns</Label>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 text-base"
                    onClick={() => changeTableCols(tableObject.cols - 1)}>−</Button>
                  <span className="w-8 text-center text-sm">{tableObject.cols}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0 text-base"
                    onClick={() => changeTableCols(tableObject.cols + 1)}>+</Button>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Cell Padding — {tableObject.cellPadding}px</Label>
              <Slider
                value={[tableObject.cellPadding]}
                onValueChange={([val]) => updateTable({ cellPadding: val })}
                min={0} max={24} step={1}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Header Row</Label>
              <button
                onClick={() => updateTable({ headerRow: !tableObject.headerRow })}
                className={cn(
                  'h-5 w-9 rounded-full transition-colors relative',
                  tableObject.headerRow ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span className={cn(
                  'block h-4 w-4 rounded-full bg-white shadow absolute top-0.5 transition-transform',
                  tableObject.headerRow ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Cell Fill</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={tableObject.defaultCellFill}
                  onChange={(e) => updateTable({ defaultCellFill: e.target.value })}
                  className="h-8 w-10 p-1" />
                <span className="text-xs text-muted-foreground font-mono">{tableObject.defaultCellFill}</span>
              </div>
            </div>

            {tableObject.headerRow && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Header Fill</Label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={tableObject.headerFill}
                    onChange={(e) => updateTable({ headerFill: e.target.value })}
                    className="h-8 w-10 p-1" />
                  <span className="text-xs text-muted-foreground font-mono">{tableObject.headerFill}</span>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Text Color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" value={tableObject.defaultTextColor}
                  onChange={(e) => updateTable({ defaultTextColor: e.target.value })}
                  className="h-8 w-10 p-1" />
                <span className="text-xs text-muted-foreground font-mono">{tableObject.defaultTextColor}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Font Size — {tableObject.defaultFontSize}px</Label>
              <Slider
                value={[tableObject.defaultFontSize]}
                onValueChange={([val]) => updateTable({ defaultFontSize: val })}
                min={8} max={72} step={1}
              />
            </div>
          </div>
        </PropertySection>
      )}

      {hasFill && (
        <PropertySection title={isText ? 'Color' : 'Fill'} icon={<Palette className="h-4 w-4" />}>
          <div className="flex items-center gap-3">
            <Input
              type="color"
              value={String(fillValue)}
              onChange={(e) => {
                if (isMultiSelect) updateMany({ fill: e.target.value } as Partial<CanvasObject>);
                else updateSingle({ fill: e.target.value } as Partial<CanvasObject>);
              }}
              className="h-10 w-14 p-1"
            />
            <Input
              value={String(fillValue)}
              onChange={(e) => {
                const next = e.target.value;
                if (!next.startsWith('#') || (next.length !== 7 && next !== 'transparent')) return;
                if (isMultiSelect) updateMany({ fill: next } as Partial<CanvasObject>);
                else updateSingle({ fill: next } as Partial<CanvasObject>);
              }}
              className="flex-1 h-9 font-mono text-sm"
            />
          </div>
        </PropertySection>
      )}

      {hasStroke && !isText && (
        <PropertySection title="Stroke" icon={<Palette className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={String(strokeValue)}
                onChange={(e) => updateSingle({ stroke: e.target.value } as Partial<CanvasObject>)}
                className="h-10 w-14 p-1"
              />
              <Input
                value={String(strokeValue)}
                onChange={(e) => updateSingle({ stroke: e.target.value } as Partial<CanvasObject>)}
                className="flex-1 h-9 font-mono text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Stroke Weight</Label>
                <span className="text-xs text-muted-foreground">{Number(strokeWidthValue)}px</span>
              </div>
              <Slider
                value={[Number(strokeWidthValue)]}
                onValueChange={([val]) => updateSingle({ strokeWidth: val } as Partial<CanvasObject>)}
                min={0}
                max={20}
                step={1}
              />
            </div>
          </div>
        </PropertySection>
      )}

      {selectedObject.type === 'image' && !isMultiSelect && (
        <PropertySection title="Border" icon={<Palette className="h-4 w-4" />}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={(selectedObject as ImageObject).stroke ?? '#ffffff'}
                onChange={(e) => updateSingle({ stroke: e.target.value } as Partial<CanvasObject>)}
                className="h-10 w-14 p-1"
              />
              <Input
                value={(selectedObject as ImageObject).stroke ?? ''}
                placeholder="none"
                onChange={(e) => updateSingle({ stroke: e.target.value || undefined } as Partial<CanvasObject>)}
                className="flex-1 h-9 font-mono text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Border Width</Label>
                <span className="text-xs text-muted-foreground">{(selectedObject as ImageObject).strokeWidth ?? 0}px</span>
              </div>
              <Slider
                value={[(selectedObject as ImageObject).strokeWidth ?? 0]}
                onValueChange={([val]) => updateSingle({ strokeWidth: val || undefined } as Partial<CanvasObject>)}
                min={0}
                max={60}
                step={1}
              />
            </div>
          </div>
        </PropertySection>
      )}

      <PropertySection title="Position & Size" icon={<Move className="h-4 w-4" />}>
        {isMultiSelect ? (
          <p className="text-xs text-muted-foreground">Position and size inputs are available for single selection.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <PropertyInput label="X" value={String(Math.round(selectedObject.x))} onChange={(value) => updateNumeric('x', value)} />
            <PropertyInput label="Y" value={String(Math.round(selectedObject.y))} onChange={(value) => updateNumeric('y', value)} />
            <PropertyInput label="W" value={String(Math.round(selectedObject.width))} onChange={(value) => updateNumeric('width', value)} />
            <PropertyInput label="H" value={String(Math.round(selectedObject.height))} onChange={(value) => updateNumeric('height', value)} />
          </div>
        )}
      </PropertySection>

      <PropertySection title="Opacity" icon={<Palette className="h-4 w-4" />}>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs text-muted-foreground">Opacity</Label>
            <span className="text-xs text-muted-foreground">{Math.round(selectedObject.opacity * 100)}%</span>
          </div>
          <Slider
            value={[selectedObject.opacity * 100]}
            onValueChange={([val]) => {
              const next = val / 100;
              if (isMultiSelect) updateMany({ opacity: next } as Partial<CanvasObject>);
              else updateSingle({ opacity: next } as Partial<CanvasObject>);
            }}
            min={0}
            max={100}
            step={1}
          />
        </div>
      </PropertySection>

      <PropertySection title="Shadow" icon={<SunDim className="h-4 w-4" />}>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-xs text-muted-foreground">Blur</Label>
              <span className="text-xs text-muted-foreground">{Number(selectedObject.shadowBlur || 0)}</span>
            </div>
            <Slider
              value={[Number(selectedObject.shadowBlur || 0)]}
              onValueChange={([val]) => {
                if (isMultiSelect) updateMany({ shadowBlur: val } as Partial<CanvasObject>);
                else updateSingle({ shadowBlur: val } as Partial<CanvasObject>);
              }}
              min={0}
              max={50}
              step={1}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Offset X</Label>
              <Slider
                value={[Number(selectedObject.shadowOffsetX || 0)]}
                onValueChange={([val]) => {
                  if (isMultiSelect) updateMany({ shadowOffsetX: val } as Partial<CanvasObject>);
                  else updateSingle({ shadowOffsetX: val } as Partial<CanvasObject>);
                }}
                min={-50}
                max={50}
                step={1}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Offset Y</Label>
              <Slider
                value={[Number(selectedObject.shadowOffsetY || 0)]}
                onValueChange={([val]) => {
                  if (isMultiSelect) updateMany({ shadowOffsetY: val } as Partial<CanvasObject>);
                  else updateSingle({ shadowOffsetY: val } as Partial<CanvasObject>);
                }}
                min={-50}
                max={50}
                step={1}
              />
            </div>
          </div>
        </div>
      </PropertySection>

      <PropertySection title="Layers" icon={<Layers className="h-4 w-4" />}>
        {isMultiSelect ? (
          <p className="text-xs text-muted-foreground">Layer ordering actions are available for single selection.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => bringToFront(selectedObject.id)}>Bring to Front</Button>
            <Button variant="outline" size="sm" onClick={() => sendToBack(selectedObject.id)}>Send to Back</Button>
          </div>
        )}
      </PropertySection>

      <PropertySection title="Actions" icon={<Copy className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={duplicateSelected}>
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          <Button variant="destructive" size="sm" onClick={() => deleteSelectedObjects()}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </PropertySection>
    </>
  );
};

const EmptyPropertyContent: React.FC = () => (
  <div className="rounded-lg border border-panel-border p-4 text-sm text-muted-foreground">
    Select an object to edit its properties.
  </div>
);

interface PropertySectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const PropertySection: React.FC<PropertySectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full py-1 text-left group"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-90'
          )}
        />
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="text-sm font-medium">{title}</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pl-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface PropertyInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

const PropertyInput: React.FC<PropertyInputProps> = ({
  label,
  value,
  onChange,
  className,
}) => (
  <div className={cn('space-y-1', className)}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-8 text-sm font-mono"
    />
  </div>
);

export default PropertyPanel;

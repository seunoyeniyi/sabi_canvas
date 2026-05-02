/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  Bold,
  Check,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Copy,
  Lock,
  Unlock,
  Trash2,
  PaintBucket,
  Group,
  Ungroup,
  Crop,
  ChevronDown,
  Eraser,
  List,
  ListOrdered,
  Sparkles,
  X,
  Image,
  RotateCcw,
  Layers2,
} from 'lucide-react';

import { useToolbarState } from './hooks/useToolbarState';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import {
  ToolbarTooltip,
  ColorPickerButton,
  StrokeWidthButton,
  OpacityButton,
  ShadowButton,
  MaskShapeButton,
  TextSpacingButton,
  FontSizeButton,
  PositionAlignButton,
  MultipleAlignButton,
} from './shared/ContextualTools';
import { TableBorderButton } from './shared/TableBorderButton';
import { FontFamilyPicker } from './FontFamilyPicker';
import { RemoveBgDialog } from '@sabi-canvas/components/RemoveBgDialog';
import { DrawPenIcon, DrawMarkerIcon, DrawHighlighterIcon } from '@sabi-canvas/components/icons/DrawIcons';
import { cn } from '@sabi-canvas/lib/utils';
import { Button } from '@sabi-canvas/ui/button';
import { Separator } from '@sabi-canvas/ui/separator';
import { Slider } from '@sabi-canvas/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@sabi-canvas/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@sabi-canvas/ui/popover';
import { CanvasObject, TableObject, DrawObject, ImageObject } from '@sabi-canvas/types/canvas-objects';

interface TopPropertiesBarProps {
  selectedObject: CanvasObject | null;
  designSize: { width: number; height: number };
}

export const TopPropertiesBar: React.FC<TopPropertiesBarProps> = ({ selectedObject, designSize }) => {
  const state = useToolbarState({ selectedObject, designSize });
  const { isEffectsPanelOpen, toggleEffectsPanel, interactionMode, drawColor, drawSize, drawTension, drawTool, setDrawColor, setDrawSize, setDrawTension, setDrawTool, setInteractionMode, setReplacingImageId, setActiveToolPanel, editorMode, isMockupEnabled } = useEditor();
  const { updateObject } = useCanvasObjects();
  const [isRemoveBgDialogOpen, setIsRemoveBgDialogOpen] = React.useState(false);
  const selectedImageObject = selectedObject?.type === 'image' ? selectedObject as ImageObject : null;

  React.useEffect(() => {
    if (!selectedImageObject) {
      setIsRemoveBgDialogOpen(false);
    }
  }, [selectedImageObject]);

  if (!selectedObject && interactionMode !== 'draw') {
    return null;
  }

  // Draw mode bar — shown when in draw mode with no selection
  if (!selectedObject && interactionMode === 'draw') {
    return (
      <div
        id="top-properties-bar"
        className="flex items-center gap-1 border-b border-panel-border bg-card px-2 h-12 shadow-sm shrink-0"
      >
        {/* Cancel draw mode */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 flex-shrink-0 gap-1.5 text-xs flex items-center text-muted-foreground hover:text-foreground"
          onClick={() => setInteractionMode('select')}
          title="Exit draw mode"
        >
          <X className="h-3.5 w-3.5" />
          <span>Cancel</span>
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        {/* Tool switcher */}
        {([
          { id: 'pen' as const,         label: 'Pen',         Icon: DrawPenIcon },
          { id: 'marker' as const,      label: 'Marker',      Icon: DrawMarkerIcon },
          { id: 'highlighter' as const, label: 'Highlighter', Icon: DrawHighlighterIcon },
        ] as const).map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant={drawTool === id ? 'secondary' : 'ghost'}
            size="sm"
            className={`h-8 px-2 flex-shrink-0 gap-1.5 text-xs flex items-center ${drawTool === id ? 'bg-accent border border-primary/30' : ''}`}
            onClick={() => setDrawTool(id)}
            title={label}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Button>
        ))}
        <Separator orientation="vertical" className="mx-1 h-6" />
        <ColorPickerButton color={drawColor} onChange={setDrawColor} label="Stroke Color" side="bottom" />
        <StrokeWidthButton weight={drawSize} onChange={setDrawSize} side="bottom" />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 flex-shrink-0 text-xs gap-1">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 13 C4 10, 6 6, 8 8 C10 10, 12 5, 14 3" strokeLinecap="round" />
              </svg>
              <span>Smooth</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-52 p-3">
            <p className="text-xs font-medium mb-2">Smoothness</p>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[Math.round(drawTension * 100)]}
              onValueChange={([v]) => setDrawTension(v / 100)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Sharp</span>
              <span>{Math.round(drawTension * 100)}%</span>
              <span>Smooth</span>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1" />
      </div>
    );
  }

  const {
    isMultiSelect,
    activeObjects,
    canUngroupSelection,
    canGroupSelection,
    shouldShowGroupAction,
    isGroupActionUngroup,
    allLocked,

    objectType,
    isText,
    isImage,
    isSvgImage,
    isTable,
    isShapeWithText,
    
    hasStroke,
    hasFill,
    hasShadow,
    
    fontSizeMin,
    fontSizeMax,
    selectedFontSize,
    fontSizeDraft,
    isFontSizeFocused,
    setIsFontSizeFocused,
    setFontSizeDraft,
    currentMask,

    clampFontSize,
    commitFontSize,
    handleFillChange,
    handleStrokeChange,
    handleStrokeWidthChange,
    handleOpacityChange,
    handleShadowChange,
    handleDelete,
    handleDuplicate,
    handleLockToggle,
    handleAlign,
    handleDimensionChange,
    toggleFontStyle,
    handleFontFamilyChange,
    toggleTextDecoration,
    toggleListStyle,
    handleTextColorChange,
    handleTextAlignChange,
    handleTextVerticalAlignChange,
    handleMaskChange,
    handleLayers,
    handleTextEdit,
    handleGroupAction,
    isCropMode,
    handleCropModeToggle,
    cropApply,
    cropReset,
    cropCancel,
    handleTableBorderChange,
    handleTableCellFillChange,
    handleTableHeaderFillChange,
    isEditingTableCell,
    editingCellData,
    isCellSelected,
    activeCellData,
    handleSelectedCellFillChange,
    handleInsertRowAbove,
    handleInsertRowBelow,
    handleDeleteRow,
    handleInsertColumnLeft,
    handleInsertColumnRight,
    handleDeleteColumn,
    handleDistributeRowsEvenly,
    handleDistributeColumnsEvenly,
    handleCellFontFamilyChange,
    handleCellFontSizeChange,
    handleCellFontStyleToggle,
    handleCellTextColorChange,
    handleCellTextAlignChange,
    handleCellVerticalAlignChange,
    isInlineTextEditing,
    inlineTextSelectionState,
  } = state;

  const tooltipSide = "bottom";

  // Crop mode takeover bar — shown when actively cropping an image
  if (isCropMode && isImage && !isSvgImage) {
    const imgObj = selectedObject as ImageObject;
    const hasCrop = imgObj.cropX != null && imgObj.cropWidth != null && (imgObj.cropWidth ?? 0) > 0;
    return (
      <div
        id="top-properties-bar"
        className="flex items-center gap-2 border-b border-panel-border bg-card px-3 h-12 shadow-sm shrink-0"
      >
        <Crop className="h-3 w-3 text-primary flex-shrink-0" />
        <span className="text-xs font-medium text-foreground flex-shrink-0">Cropping</span>
        <div className="flex-1" />
        {hasCrop && (
          <ToolbarTooltip label="Reset to original" side="bottom">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1.5 flex-shrink-0 text-xs font-medium"
              onClick={cropReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          </ToolbarTooltip>
        )}
        <Button
          size="sm"
          className="h-8 px-3 gap-1.5 flex-shrink-0 text-xs font-medium"
          onClick={cropApply}
        >
          <Check className="h-3.5 w-3.5" />
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 gap-1.5 flex-shrink-0 text-xs font-medium"
          onClick={cropCancel}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        id="top-properties-bar"
        className="flex items-center overflow-x-auto gap-1 border-b border-panel-border bg-card px-2 h-12 shadow-sm hide-scrollbar shrink-0"
        onMouseDown={(e) => {
          // Allow inputs to receive focus properly (crucial for popovers rendered via portals)
          if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') {
            return;
          }

          // Prevent the cell textarea and inline text contentEditable from losing focus
          if (isEditingTableCell || isCellSelected || isInlineTextEditing) {
            e.preventDefault();
          }
        }}
      >
      {/* --- Properties Based on Type --- */}
      
      {/* Colors (Fill & Stroke) */}
      {(hasFill || isText || objectType === 'path') && (
        <ColorPickerButton
          color={isInlineTextEditing && inlineTextSelectionState?.color ? inlineTextSelectionState.color : ((selectedObject as any).fill || "#000000")}
          onChange={isText ? handleTextColorChange : handleFillChange}
          label={isText ? "Text Color" : "Fill Color"}
          side={tooltipSide}
          icon={isText ? <Type className="h-4 w-4" /> : <PaintBucket className="h-4 w-4" />}
        />
      )}

      {(hasStroke || ['rect', 'circle', 'path'].includes(objectType)) && (
         <ColorPickerButton color={(selectedObject as any).stroke || "transparent"} onChange={handleStrokeChange} label="Border Color" side={tooltipSide} />
      )}

      {(hasStroke || ['rect', 'circle', 'path'].includes(objectType)) && (
        <StrokeWidthButton weight={(selectedObject as any).strokeWidth || 0} onChange={handleStrokeWidthChange} side={tooltipSide} />
      )}

      {/* Draw smoothness control */}
      {objectType === 'draw' && !isMultiSelect && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 flex-shrink-0 text-xs gap-1">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 13 C4 10, 6 6, 8 8 C10 10, 12 5, 14 3" strokeLinecap="round" />
                </svg>
                <span>Smooth</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" className="w-52 p-3">
              <p className="text-xs font-medium mb-2">Smoothness</p>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[Math.round(((selectedObject as DrawObject).tension ?? 0.4) * 100)]}
                onValueChange={([v]) => updateObject(selectedObject!.id, { tension: v / 100 } as Partial<DrawObject>)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Sharp</span>
                <span>{Math.round(((selectedObject as DrawObject).tension ?? 0.4) * 100)}%</span>
                <span>Smooth</span>
              </div>
            </PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      {(hasFill || hasStroke || isImage || isText || isMultiSelect) && objectType !== 'draw' && <Separator orientation="vertical" className="mx-1 h-6" />}

      {/* Font & Typography if Text or Shape with innerText */}
      {(isText || isShapeWithText) && !isMultiSelect && (
        <>
          <FontFamilyPicker
            value={isShapeWithText ? (selectedObject as any).innerTextFontFamily : (selectedObject as any).fontFamily}
            onChange={handleFontFamilyChange}
          />
          <FontSizeButton value={selectedFontSize} onChange={commitFontSize} side={tooltipSide} min={fontSizeMin} max={fontSizeMax} />

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Text Styles */}
          <ToolbarTooltip label="Bold" side={tooltipSide}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Bold"
              onClick={() => toggleFontStyle('bold')}
              className={cn("h-8 w-8 flex-shrink-0",
                (isInlineTextEditing ? inlineTextSelectionState?.bold : (selectedObject as any)[isShapeWithText ? 'innerTextFontStyle' : 'fontStyle']?.includes('bold'))
                && "bg-secondary text-secondary-foreground"
              )}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Italic" side={tooltipSide}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Italic"
              onClick={() => toggleFontStyle('italic')}
              className={cn("h-8 w-8 flex-shrink-0",
                (isInlineTextEditing ? inlineTextSelectionState?.italic : (selectedObject as any)[isShapeWithText ? 'innerTextFontStyle' : 'fontStyle']?.includes('italic'))
                && "bg-secondary text-secondary-foreground"
              )}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          {(isText || isShapeWithText) && (
            <>
              <ToolbarTooltip label="Underline" side={tooltipSide}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Underline"
                  onClick={() => toggleTextDecoration('underline')}
                  className={cn("h-8 w-8 flex-shrink-0",
                    (isInlineTextEditing ? inlineTextSelectionState?.underline : (selectedObject as any)[isShapeWithText ? 'innerTextDecoration' : 'textDecoration']?.includes('underline'))
                    && "bg-secondary text-secondary-foreground"
                  )}
                >
                  <Underline className="h-4 w-4" />
                </Button>
              </ToolbarTooltip>
              <ToolbarTooltip label="Strikethrough" side={tooltipSide}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Strikethrough"
                  onClick={() => toggleTextDecoration('line-through')}
                  className={cn("h-8 w-8 flex-shrink-0",
                    (isInlineTextEditing ? inlineTextSelectionState?.strikethrough : (selectedObject as any)[isShapeWithText ? 'innerTextDecoration' : 'textDecoration']?.includes('line-through'))
                    && "bg-secondary text-secondary-foreground"
                  )}
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
              </ToolbarTooltip>
              {(() => {
                const currentList = (selectedObject as any)[isShapeWithText ? 'innerTextListStyle' : 'listStyle'] || 'none';
                return (
                  <ToolbarTooltip
                    label={currentList === 'none' ? 'Bullet List' : currentList === 'disc' ? 'Numbered List' : 'Remove List'}
                    side={tooltipSide}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="List Style"
                      onClick={toggleListStyle}
                      className={cn("h-8 w-8 flex-shrink-0", currentList !== 'none' && "bg-secondary text-secondary-foreground")}
                    >
                      {currentList === 'ordered' ? <ListOrdered className="h-4 w-4" /> : <List className="h-4 w-4" />}
                    </Button>
                  </ToolbarTooltip>
                );
              })()}
            </>
          )}

          {isShapeWithText && (
            <ColorPickerButton
              color={(selectedObject as any).innerTextFill || "#000000"}
              onChange={handleTextColorChange}
              label="Text Color"
              side={tooltipSide}
              icon={<Type className="h-4 w-4" />}
            />
          )}

          {(isText || isShapeWithText) && (
            <TextSpacingButton
              lineHeight={(selectedObject as any)[isShapeWithText ? 'innerTextLineHeight' : 'lineHeight'] ?? 1.2}
              letterSpacing={(selectedObject as any)[isShapeWithText ? 'innerTextLetterSpacing' : 'letterSpacing'] ?? 0}
              padding={isShapeWithText ? ((selectedObject as any).innerTextPadding ?? 10) : undefined}
              onChange={(updates) => {
                if (isShapeWithText) {
                  const mapped: any = {};
                  if ('lineHeight' in updates) mapped.innerTextLineHeight = updates.lineHeight;
                  if ('letterSpacing' in updates) mapped.innerTextLetterSpacing = updates.letterSpacing;
                  if ('innerTextPadding' in updates) mapped.innerTextPadding = updates.innerTextPadding;
                  handleShadowChange(mapped);
                } else {
                  handleShadowChange(updates);
                }
              }}
              side={tooltipSide}
            />
          )}

          <Separator orientation="vertical" className="mx-1 h-6" />
          
          {(['left', 'center', 'right'] as const).map((align) => (
            <ToolbarTooltip key={align} label={align.charAt(0).toUpperCase() + align.slice(1)} side={tooltipSide}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={align}
                onClick={() => handleTextAlignChange(align)}
                className={cn("h-8 w-8 flex-shrink-0",
                  ((selectedObject as any)[isShapeWithText ? 'innerTextAlign' : 'align'] ?? 'center') === align
                    && "bg-secondary text-secondary-foreground"
                )}
              >
                {align === 'left' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>}
                {align === 'center' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>}
                {align === 'right' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>}
              </Button>
            </ToolbarTooltip>
          ))}

          {isShapeWithText && (
            <>
              <Separator orientation="vertical" className="mx-1 h-6" />
              {(['top', 'middle', 'bottom'] as const).map((valign) => (
                <ToolbarTooltip key={valign} label={`Align ${valign}`} side={tooltipSide}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Vertical align ${valign}`}
                    onClick={() => handleTextVerticalAlignChange(valign)}
                    className={cn("h-8 w-8 flex-shrink-0",
                      ((selectedObject as any).innerTextVerticalAlign ?? 'middle') === valign
                        && "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {valign === 'top' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="20" y2="4"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="5" y1="14" x2="19" y2="14"/></svg>}
                    {valign === 'middle' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"/><line x1="7" y1="7" x2="17" y2="7"/><line x1="5" y1="17" x2="19" y2="17"/></svg>}
                    {valign === 'bottom' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="20"/><line x1="7" y1="15" x2="17" y2="15"/><line x1="5" y1="10" x2="19" y2="10"/></svg>}
                  </Button>
                </ToolbarTooltip>
              ))}
            </>
          )}

          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      {/* Image Mask & Crop */}
      {isImage && !isSvgImage && !isMultiSelect && (
        <>
          <ToolbarTooltip label="Crop" side={tooltipSide}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Crop"
              onClick={handleCropModeToggle}
              className={cn("h-8 w-8 flex-shrink-0", isCropMode && "bg-secondary text-secondary-foreground")}
            >
              <Crop className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <MaskShapeButton currentMask={currentMask} onChange={handleMaskChange} side={tooltipSide} />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-8 px-2 gap-1.5 flex-shrink-0 text-xs font-medium',
              selectedImageObject?.removedBgSrc && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            )}
            onClick={() => setIsRemoveBgDialogOpen(true)}
          >
            <Eraser className="h-4 w-4" />
            <span>Remove Background</span>
            {selectedImageObject?.removedBgSrc && <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 flex-shrink-0 text-xs font-medium"
            onClick={() => {
              setReplacingImageId(selectedObject!.id);
              setActiveToolPanel('upload');
            }}
          >
            <Image className="h-4 w-4" />
            <span>Replace</span>
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      {/* SVG color palette — shown when the selected image is an SVG with extractable colors */}
      {isImage && !isMultiSelect && selectedImageObject?.svgPalette && selectedImageObject.svgPalette.length > 0 && (
        <>
          {selectedImageObject.svgPalette.map((originalColor, i) => {
            const currentColor = selectedImageObject.svgColors?.[originalColor] ?? originalColor;
            return (
              <ColorPickerButton
                key={originalColor}
                color={currentColor}
                label={`SVG Color ${i + 1}`}
                side={tooltipSide}
                onChange={(newColor) => {
                  const svgColors = { ...(selectedImageObject.svgColors ?? {}), [originalColor]: newColor };
                  updateObject(selectedImageObject.id, { svgColors } as Partial<ImageObject>);
                }}
              />
            );
          })}
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      {/* Table Tools */}
      {isTable && !isMultiSelect && !isEditingTableCell && !isCellSelected && (
        <>
          <ColorPickerButton
            color={(selectedObject as TableObject).defaultCellFill || '#ffffff'}
            onChange={handleTableCellFillChange}
            label="Cell Fill"
            side={tooltipSide}
            icon={<PaintBucket className="h-4 w-4" />}
          />
          <ColorPickerButton
            color={(selectedObject as TableObject).headerFill || '#e2e8f0'}
            onChange={handleTableHeaderFillChange}
            label="Header Fill"
            side={tooltipSide}
            icon={<Type className="h-4 w-4" />}
          />
          <TableBorderButton
            border={(selectedObject as TableObject).border}
            onChange={handleTableBorderChange}
            side={tooltipSide}
          />
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      {/* Cell Text Editing Tools — blur prevented via root div's onMouseDown */}
      {isTable && !isMultiSelect && (isCellSelected || isEditingTableCell) && (
        <>
          <ColorPickerButton
            color={activeCellData?.fill ?? (selectedObject as TableObject).defaultCellFill}
            onChange={handleSelectedCellFillChange}
            label="Cell Fill"
            side={tooltipSide}
            icon={<PaintBucket className="h-4 w-4" />}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 flex-shrink-0 text-xs font-medium gap-1">
                Table <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Rows</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleInsertRowAbove}>Insert row above</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleInsertRowBelow}>Insert row below</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDeleteRow}>Delete row</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleInsertColumnLeft}>Insert column left</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleInsertColumnRight}>Insert column right</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDeleteColumn}>Delete column</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleDistributeRowsEvenly}>Distribute rows evenly</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDistributeColumnsEvenly}>Distribute columns evenly</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <FontFamilyPicker
            value={activeCellData?.fontFamily ?? (selectedObject as TableObject).defaultFontFamily}
            onChange={handleCellFontFamilyChange}
          />
          <FontSizeButton
            value={activeCellData?.fontSize ?? (selectedObject as TableObject).defaultFontSize}
            onChange={handleCellFontSizeChange}
            side={tooltipSide}
            min={fontSizeMin}
            max={fontSizeMax}
          />
          <Separator orientation="vertical" className="mx-1 h-6" />
          <ToolbarTooltip label="Bold" side={tooltipSide}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Bold"
              onClick={() => handleCellFontStyleToggle('bold')}
              className={cn("h-8 w-8 flex-shrink-0", (activeCellData?.fontStyle ?? 'normal').includes('bold') && "bg-secondary text-secondary-foreground")}
            >
              <Bold className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ToolbarTooltip label="Italic" side={tooltipSide}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Italic"
              onClick={() => handleCellFontStyleToggle('italic')}
              className={cn("h-8 w-8 flex-shrink-0", (activeCellData?.fontStyle ?? 'normal').includes('italic') && "bg-secondary text-secondary-foreground")}
            >
              <Italic className="h-4 w-4" />
            </Button>
          </ToolbarTooltip>
          <ColorPickerButton
            color={activeCellData?.textColor ?? (selectedObject as TableObject).defaultTextColor}
            onChange={handleCellTextColorChange}
            label="Text Color"
            side={tooltipSide}
            icon={<Type className="h-4 w-4" />}
          />
          <Separator orientation="vertical" className="mx-1 h-6" />
          {(['left', 'center', 'right'] as const).map((align) => (
            <ToolbarTooltip key={align} label={align.charAt(0).toUpperCase() + align.slice(1)} side={tooltipSide}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={align}
                onClick={() => handleCellTextAlignChange(align)}
                className={cn("h-8 w-8 flex-shrink-0",
                  (activeCellData?.textAlign ?? (selectedObject as TableObject).defaultTextAlign) === align
                    && "bg-secondary text-secondary-foreground"
                )}
              >
                {align === 'left' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>}
                {align === 'center' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>}
                {align === 'right' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>}
              </Button>
            </ToolbarTooltip>
          ))}
          <Separator orientation="vertical" className="mx-1 h-6" />
          {(['top', 'middle', 'bottom'] as const).map((valign) => (
            <ToolbarTooltip key={valign} label={`Align ${valign}`} side={tooltipSide}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Vertical align ${valign}`}
                onClick={() => handleCellVerticalAlignChange(valign)}
                className={cn("h-8 w-8 flex-shrink-0",
                  (activeCellData?.verticalAlign ?? (selectedObject as TableObject).defaultVerticalAlign ?? 'top') === valign
                    && "bg-secondary text-secondary-foreground"
                )}
              >
                {valign === 'top' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="4" x2="20" y2="4"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="5" y1="14" x2="19" y2="14"/></svg>}
                {valign === 'middle' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="12" x2="20" y2="12"/><line x1="7" y1="7" x2="17" y2="7"/><line x1="5" y1="17" x2="19" y2="17"/></svg>}
                {valign === 'bottom' && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="20"/><line x1="7" y1="15" x2="17" y2="15"/><line x1="5" y1="10" x2="19" y2="10"/></svg>}
              </Button>
            </ToolbarTooltip>
          ))}
          <Separator orientation="vertical" className="mx-1 h-6" />
        </>
      )}

      {/* Common Properties */}
      <OpacityButton opacity={(selectedObject as any).opacity ?? 1} onChange={handleOpacityChange} side={tooltipSide} />      <ShadowButton blur={(selectedObject as any).shadowBlur} offsetX={(selectedObject as any).shadowOffsetX} offsetY={(selectedObject as any).shadowOffsetY} color={(selectedObject as any).shadowColor} onChange={handleShadowChange} side={tooltipSide} />

      {/* Alignment / Positioning (usually common) */}
      {isMultiSelect ? <MultipleAlignButton onAlign={handleAlign} onLayersChange={handleLayers} side={tooltipSide} /> : <PositionAlignButton onAlign={handleAlign} onLayersChange={handleLayers} side={tooltipSide} />}

      <Button
        variant="ghost"
        aria-label="Effects"
        onClick={toggleEffectsPanel}
        className={cn("h-8 px-2 gap-1.5 flex-shrink-0 text-xs font-medium", isEffectsPanelOpen && "bg-muted text-foreground")}
      >
        <Sparkles className="h-4 w-4" />
        Effects
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Spacer to push actions to the right */}
      <div className="flex-1" />

      {/* Global Actions */}
      {shouldShowGroupAction && (
        <Button variant="ghost" className="h-8 px-2 flex-shrink-0 text-xs font-medium" onClick={handleGroupAction}>
          {isGroupActionUngroup ? <Ungroup className="h-4 w-4" /> : <Group className="h-4 w-4" />}
          {isGroupActionUngroup ? 'Ungroup' : 'Group'}
        </Button>
      )}

      <ToolbarTooltip label="Duplicate" side={tooltipSide}>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleDuplicate}>
          <Copy className="h-4 w-4" />
        </Button>
      </ToolbarTooltip>

      {/* Mockup layer toggle: visible only in mockup-design mode, hidden for print-area objects */}
      {isMockupEnabled && editorMode === 'mockup-design' && selectedObject?.type !== 'print-area' && (
        <ToolbarTooltip
          label={selectedObject?.objectRole === 'mockup' ? 'Remove from Mockup Layer' : 'Set as Mockup Layer'}
          side={tooltipSide}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 flex-shrink-0',
              selectedObject?.objectRole === 'mockup' && 'text-amber-500 hover:text-amber-600'
            )}
            onClick={() => updateObject(selectedObject!.id, {
              objectRole: selectedObject?.objectRole === 'mockup' ? 'customer' : 'mockup',
            })}
          >
            <Layers2 className="h-4 w-4" />
          </Button>
        </ToolbarTooltip>
      )}

      <ToolbarTooltip label={allLocked ? 'Unlock' : 'Lock'} side={tooltipSide}>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("h-8 w-8 flex-shrink-0", allLocked && "text-muted-foreground")}
          onClick={handleLockToggle}
        >
          {allLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </Button>
      </ToolbarTooltip>

      <ToolbarTooltip label="Delete" side={tooltipSide}>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </ToolbarTooltip>

      </div>

      <RemoveBgDialog
        imageObject={selectedImageObject}
        open={isRemoveBgDialogOpen}
        onClose={() => setIsRemoveBgDialogOpen(false)}
        onApply={(resultUrl) => {
          if (!selectedImageObject) {
            return;
          }

          updateObject(selectedImageObject.id, { removedBgSrc: resultUrl });
        }}
        onRevert={() => {
          if (!selectedImageObject) {
            return;
          }

          updateObject(selectedImageObject.id, { removedBgSrc: undefined });
          setIsRemoveBgDialogOpen(false);
        }}
      />
    </>
  );
};

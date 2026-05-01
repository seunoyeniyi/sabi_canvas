/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { CanvasObject, ImageMaskShape, TableObject, TableCell, ImageObject } from '@sabi-canvas/types/canvas-objects';
import type { TextSpan } from '@sabi-canvas/types/canvas-objects';
import { isSvgSrc } from '@sabi-canvas/lib/svgColorUtils';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { loadFontFamily } from '@sabi-canvas/lib/fontLoader';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { normalizeSpans, isPlainSpans } from '@sabi-canvas/lib/richText';
import { useAIWrite } from '@sabi-canvas/hooks/useAIWrite';
import type { AIWriteAction } from '@sabi-canvas/hooks/useAIWrite';

// --- List style text utilities ---

const DISC_PREFIX = '\u2022 ';

function stripListPrefix(line: string): string {
  if (line.startsWith(DISC_PREFIX)) return line.slice(DISC_PREFIX.length);
  const orderedMatch = line.match(/^\d+\.\s/);
  if (orderedMatch) return line.slice(orderedMatch[0].length);
  return line;
}

export function applyListStyle(text: string, listStyle: 'disc' | 'ordered'): string {
  return text.split('\n').map((line, i) => {
    const raw = stripListPrefix(line);
    return listStyle === 'disc' ? DISC_PREFIX + raw : `${i + 1}. ${raw}`;
  }).join('\n');
}

export function stripListStyle(text: string): string {
  return text.split('\n').map(stripListPrefix).join('\n');
}

export function getListContinuationPrefix(listStyle: 'disc' | 'ordered', linesBefore: number): string {
  if (listStyle === 'disc') return DISC_PREFIX;
  return `${linesBefore + 1}. `;
}

// --- Rich text span list helpers ---

function splitSpansIntoLines(spans: TextSpan[]): TextSpan[][] {
  const lines: TextSpan[][] = [[]];
  for (const span of spans) {
    const parts = span.text.split('\n');
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...span, text: part });
    });
  }
  return lines;
}

function joinLinesIntoSpans(lines: TextSpan[][]): TextSpan[] {
  const result: TextSpan[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) result.push({ text: '\n' });
    result.push(...line);
  });
  return result;
}

function stripListPrefixFromLine(line: TextSpan[]): TextSpan[] {
  if (line.length === 0) return line;
  const first = line[0];
  if (first.text.startsWith(DISC_PREFIX)) {
    const remaining = first.text.slice(DISC_PREFIX.length);
    return remaining ? [{ ...first, text: remaining }, ...line.slice(1)] : line.slice(1);
  }
  const orderedMatch = first.text.match(/^\d+\.\s/);
  if (orderedMatch) {
    const remaining = first.text.slice(orderedMatch[0].length);
    return remaining ? [{ ...first, text: remaining }, ...line.slice(1)] : line.slice(1);
  }
  return line;
}

export function applyListStyleToSpans(spans: TextSpan[], listStyle: 'disc' | 'ordered'): TextSpan[] {
  const lines = splitSpansIntoLines(spans);
  const newLines = lines.map((line, i) => {
    const stripped = stripListPrefixFromLine(line);
    const prefix = listStyle === 'disc' ? DISC_PREFIX : `${i + 1}. `;
    return [{ text: prefix }, ...stripped];
  });
  return normalizeSpans(joinLinesIntoSpans(newLines));
}

export function stripListStyleFromSpans(spans: TextSpan[]): TextSpan[] {
  const lines = splitSpansIntoLines(spans);
  return normalizeSpans(joinLinesIntoSpans(lines.map(stripListPrefixFromLine)));
}

export interface UseToolbarStateProps {
  selectedObject: CanvasObject | null;
  designSize: { width: number; height: number };
  onTextEdit?: (id: string) => void;
}

export const useToolbarState = ({
  selectedObject,
  designSize,
  onTextEdit,
}: UseToolbarStateProps) => {
  const {
    objects,
    selectedIds,
    updateObject,
    deleteObject,
    deleteSelectedObjects,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    addObject,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  } = useCanvasObjects();

  const { isCropMode, setIsCropMode, editingTableCell, selectedTableCells, editingShapeTextId, editingTextId, inlineTextSelectionState, applyInlineTextStyle, cropApply, cropReset, cropCancel, editorMode, isMockupEnabled } = useEditor();
  const { isRunningAction, runAIWriteAction } = useAIWrite();

  // --- Derived Selection States ---

  const isMultiSelect = selectedIds.length > 1;
  
  const activeObjects = useMemo(
    () => (isMultiSelect ? objects.filter((o) => selectedIds.includes(o.id)) : []),
    [objects, selectedIds, isMultiSelect]
  );
  
  const canUngroupSelection = useMemo(
    () => selectedIds.some((id) => objects.find((obj) => obj.id === id)?.type === 'group'),
    [objects, selectedIds]
  );
  
  const canGroupSelection = selectedIds.length > 1 && !canUngroupSelection;
  const shouldShowGroupAction = isMultiSelect || selectedObject?.type === 'group';
  const isGroupActionUngroup = canUngroupSelection;

  // --- Object Properties & Accessors ---

  const objectType = selectedObject?.type || '';
  const isText = objectType === 'text';
  const isImage = objectType === 'image';
  const isSvgImage = isImage && isSvgSrc((selectedObject as ImageObject)?.src ?? '');
  const isTable = objectType === 'table';
  // Whether the user is actively editing a text object (inline rich-text mode)
  const isInlineTextEditing = isText && !!editingTextId && editingTextId === selectedObject?.id;
  const isEditingShapeTextContext = !!editingShapeTextId && editingShapeTextId === selectedObject?.id;
  const isInlineShapeTextEditing = isEditingShapeTextContext;
  const isShapeWithText = ['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'star', 'path'].includes(objectType)
    && (!!(selectedObject as any)?.innerText || !!(selectedObject as any)?.innerRichText?.length || isEditingShapeTextContext);

  const editingCellData = useMemo(() => {
    if (!isTable || !editingTableCell) return null;
    const table = selectedObject as TableObject;
    const { row, col } = editingTableCell;
    return table.cells?.[row]?.[col] ?? null;
  }, [isTable, editingTableCell, selectedObject]);

  const isEditingTableCell = isTable && !!editingTableCell;

  // Cells that are "active" for property operations:
  // — while text-editing: the single editing cell
  // — otherwise: all selected cells (from single/shift click)
  const activeCells = useMemo(() => {
    if (!isTable) return [];
    if (editingTableCell) return [editingTableCell];
    return selectedTableCells;
  }, [isTable, editingTableCell, selectedTableCells]);

  const isCellSelected = isTable && (selectedTableCells.length > 0 || !!editingTableCell);

  // First active cell's data (for reading current values in toolbar)
  const activeCellData = useMemo(() => {
    if (activeCells.length === 0 || !isTable) return null;
    const { row, col } = activeCells[0];
    const table = selectedObject as TableObject;
    return table.cells?.[row]?.[col] ?? null;
  }, [activeCells, isTable, selectedObject]);
  
  const hasStroke = selectedObject ? 'stroke' in selectedObject : false;
  // Lines typically don't use fill in the same way as other shapes, keeping original logic:
  const hasFill = selectedObject ? 'fill' in selectedObject && objectType !== 'line' : false;
  const hasShadow = true;
  
  const currentMask = isImage
    ? (((selectedObject as any)?.maskShape || 'none') as ImageMaskShape)
    : 'none';
    
  const allLocked = isMultiSelect
    ? activeObjects.every((obj) => obj.locked)
    : selectedObject?.locked || false;

  const canShowAIWrite = !!selectedObject
    && !isMultiSelect
    && !allLocked
    && (isText || isShapeWithText);

  // --- Typography States & Logic ---

  const fontSizeMin = 8;
  const fontSizeMax = 400;
  const selectedFontSize = useMemo(() => {
    if (isText) return Number((selectedObject as any)?.fontSize ?? 16);
    if (isShapeWithText) return Number((selectedObject as any)?.innerTextFontSize ?? 24);
    return 16;
  }, [isText, isShapeWithText, selectedObject]);
  const [fontSizeDraft, setFontSizeDraft] = useState<string>(() => String(selectedFontSize));
  const [isFontSizeFocused, setIsFontSizeFocused] = useState(false);

  const clampFontSize = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return selectedFontSize;
      return Math.min(fontSizeMax, Math.max(fontSizeMin, value));
    },
    [selectedFontSize]
  );

  const commitFontSize = useCallback(
    (rawValue: string | number, objectId?: string) => {
      if (!selectedObject || (!isText && !isShapeWithText)) return;

      const targetId = objectId ?? selectedObject.id;
      const parsedValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      const nextFontSize = clampFontSize(parsedValue);

      if (isText) {
        updateObject(targetId, { fontSize: nextFontSize });
      } else if (isShapeWithText) {
        updateObject(targetId, { innerTextFontSize: nextFontSize });
      }
      setFontSizeDraft(String(nextFontSize));
    },
    [selectedObject, isText, isShapeWithText, clampFontSize, updateObject]
  );

  useEffect(() => {
    if (!isText && !isShapeWithText) return;

    if (!isFontSizeFocused) {
      setFontSizeDraft(String(selectedFontSize));
    }
  }, [isText, isShapeWithText, selectedObject?.id, selectedFontSize, isFontSizeFocused]);

  // --- Tool Action Handlers ---

  const handleFillChange = useCallback((color: string) => {
    if (isMultiSelect) {
      activeObjects.forEach((obj) => updateObject(obj.id, { fill: color }));
    } else if (selectedObject && hasFill) {
      updateObject(selectedObject.id, { fill: color });
    }
  }, [isMultiSelect, activeObjects, selectedObject, hasFill, updateObject]);

  const handleStrokeChange = useCallback((color: string) => {
    if (isMultiSelect) {
      activeObjects.forEach((obj) => updateObject(obj.id, { stroke: color }));
    } else if (selectedObject && hasStroke) {
      updateObject(selectedObject.id, { stroke: color });
    }
  }, [isMultiSelect, activeObjects, selectedObject, hasStroke, updateObject]);

  const handleStrokeWidthChange = useCallback((width: number) => {
    if (isMultiSelect) {
      activeObjects.forEach((obj) => updateObject(obj.id, { strokeWidth: width }));
    } else if (selectedObject && hasStroke) {
      updateObject(selectedObject.id, { strokeWidth: width });
    }
  }, [isMultiSelect, activeObjects, selectedObject, hasStroke, updateObject]);

  const handleOpacityChange = useCallback((opacity: number) => {
    if (isMultiSelect) {
      activeObjects.forEach((obj) => updateObject(obj.id, { opacity }));
    } else if (selectedObject) {
      updateObject(selectedObject.id, { opacity });
    }
  }, [isMultiSelect, activeObjects, selectedObject, updateObject]);

  const handleShadowChange = useCallback((updates: Partial<CanvasObject>) => {
    if (isMultiSelect) {
      activeObjects.forEach((obj) => updateObject(obj.id, updates));
    } else if (selectedObject) {
      updateObject(selectedObject.id, updates);
    }
  }, [isMultiSelect, activeObjects, selectedObject, updateObject]);

  const handleDelete = useCallback(() => {
    if (isMultiSelect) {
      deleteSelectedObjects();
    } else if (selectedObject) {
      deleteObject(selectedObject.id);
    }
  }, [isMultiSelect, selectedObject, deleteSelectedObjects, deleteObject]);

  const handleDuplicate = useCallback(() => {
    if (isMultiSelect) {
      duplicateSelected();
    } else if (selectedObject) {
      const { ...objectWithoutId } = selectedObject;
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newObject = {
        ...objectWithoutId,
        id: newId,
        x: selectedObject.x + 20,
        y: selectedObject.y + 20,
      } as CanvasObject;
      addObject(newObject);
    }
  }, [isMultiSelect, selectedObject, duplicateSelected, addObject]);

  const handleLockToggle = useCallback(() => {
    if (isMultiSelect) {
      const allLocked = activeObjects.every((obj) => obj.locked);
      activeObjects.forEach((obj) => updateObject(obj.id, { locked: !allLocked }));
    } else if (selectedObject) {
      updateObject(selectedObject.id, { locked: !selectedObject.locked });
    }
  }, [isMultiSelect, activeObjects, selectedObject, updateObject]);

  const handleAlign = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    // In customer mode, align relative to the print area when one exists.
    // Otherwise fall back to the full design canvas.
    const printArea = isMockupEnabled && editorMode === 'customer'
      ? objects.find((o) => o.type === 'print-area')
      : null;
    const bounds = printArea
      ? { x: printArea.x, y: printArea.y, width: printArea.width, height: printArea.height }
      : { x: 0, y: 0, width: designSize.width, height: designSize.height };

    if (isMultiSelect) {
      if (activeObjects.length === 0) return;

      const selBounds = activeObjects.reduce(
        (acc, obj) => ({
          minX: Math.min(acc.minX, obj.x),
          minY: Math.min(acc.minY, obj.y),
          maxX: Math.max(acc.maxX, obj.x + obj.width),
          maxY: Math.max(acc.maxY, obj.y + obj.height),
        }),
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        }
      );

      const groupWidth = selBounds.maxX - selBounds.minX;
      const groupHeight = selBounds.maxY - selBounds.minY;

      let dx = 0;
      let dy = 0;

      switch (alignment) {
        case 'left':   dx = bounds.x - selBounds.minX; break;
        case 'center': dx = bounds.x + bounds.width / 2 - groupWidth / 2 - selBounds.minX; break;
        case 'right':  dx = bounds.x + bounds.width - groupWidth - selBounds.minX; break;
        case 'top':    dy = bounds.y - selBounds.minY; break;
        case 'middle': dy = bounds.y + bounds.height / 2 - groupHeight / 2 - selBounds.minY; break;
        case 'bottom': dy = bounds.y + bounds.height - groupHeight - selBounds.minY; break;
      }

      activeObjects.forEach((obj) => {
        updateObject(obj.id, { x: obj.x + dx, y: obj.y + dy });
      });
      return;
    }

    if (!selectedObject) return;
    let newX = selectedObject.x;
    let newY = selectedObject.y;
    const { width, height } = selectedObject;

    switch (alignment) {
      case 'left':   newX = bounds.x; break;
      case 'center': newX = bounds.x + bounds.width / 2 - width / 2; break;
      case 'right':  newX = bounds.x + bounds.width - width; break;
      case 'top':    newY = bounds.y; break;
      case 'middle': newY = bounds.y + bounds.height / 2 - height / 2; break;
      case 'bottom': newY = bounds.y + bounds.height - height; break;
    }
    updateObject(selectedObject.id, { x: newX, y: newY });
  }, [isMultiSelect, activeObjects, selectedObject, designSize, editorMode, isMockupEnabled, objects, updateObject]);

  const handleDimensionChange = useCallback((prop: 'x' | 'y' | 'width' | 'height', value: string) => {
    if (!selectedObject) return;
    const num = parseFloat(value);
    if (!isNaN(num)) updateObject(selectedObject.id, { [prop]: num });
  }, [selectedObject, updateObject]);

  const toggleFontStyle = useCallback((style: 'bold' | 'italic') => {
    if (!selectedObject || (!isText && !isShapeWithText)) return;

    if (isInlineTextEditing || isInlineShapeTextEditing) {
      applyInlineTextStyle(style === 'bold' ? 'bold' : 'italic');
      return;
    }

    // Determine the prop to update based on object type
    const propName = isText ? 'fontStyle' : 'innerTextFontStyle';
    const currentStyle = (selectedObject as any)[propName] || 'normal';

    let newStyle = currentStyle;
    if (style === 'bold') {
      if (currentStyle.includes('bold')) newStyle = currentStyle.replace('bold', '').trim() || 'normal';
      else newStyle = currentStyle === 'normal' ? 'bold' : `${currentStyle} bold`;
    }
    if (style === 'italic') {
      if (currentStyle.includes('italic')) newStyle = currentStyle.replace('italic', '').trim() || 'normal';
      else newStyle = currentStyle === 'normal' ? 'italic' : `${currentStyle} italic`;
    }
    updateObject(selectedObject.id, { [propName]: newStyle });
  }, [selectedObject, isText, isShapeWithText, isInlineTextEditing, isInlineShapeTextEditing, applyInlineTextStyle, updateObject]);

  const handleFontFamilyChange = useCallback(async (fontFamily: string) => {
    if (!selectedObject || (!isText && !isShapeWithText)) return;

    if (isInlineTextEditing || isInlineShapeTextEditing) {
      // Load the font first so canvas renders it immediately after commit
      await loadFontFamily(fontFamily, { timeoutMs: 2400 });
      applyInlineTextStyle('fontFamily', fontFamily);
      return;
    }

    const propName = isText ? 'fontFamily' : 'innerTextFontFamily';
    updateObject(selectedObject.id, { [propName]: fontFamily });
    const result = await loadFontFamily(fontFamily, { timeoutMs: 2400 });

    if (result.status === 'loaded') {
      updateObject(selectedObject.id, { [propName]: fontFamily });
    }
  }, [selectedObject, isText, isShapeWithText, isInlineTextEditing, isInlineShapeTextEditing, applyInlineTextStyle, updateObject]);

  const toggleTextDecoration = useCallback((decoration: 'underline' | 'line-through') => {
    if (!selectedObject || (!isText && !isShapeWithText)) return;

    if (isInlineTextEditing || isInlineShapeTextEditing) {
      applyInlineTextStyle(decoration === 'underline' ? 'underline' : 'strikeThrough');
      return;
    }

    const propName = isShapeWithText ? 'innerTextDecoration' : 'textDecoration';
    const currentDecoration = ((selectedObject as any)[propName] || 'none') as string;
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

    updateObject(selectedObject.id, { [propName]: nextDecoration });
  }, [selectedObject, isText, isShapeWithText, isInlineTextEditing, isInlineShapeTextEditing, applyInlineTextStyle, updateObject]);

  const toggleListStyle = useCallback(() => {
    if (!selectedObject || (!isText && !isShapeWithText)) return;
    const listProp = isText ? 'listStyle' : 'innerTextListStyle';
    const current = ((selectedObject as any)[listProp] as string) || 'none';
    const next = current === 'none' ? 'disc' : current === 'disc' ? 'ordered' : 'none';

    // In inline text edit mode, delegate to the inline editor so it updates both
    // the contentEditable DOM and the object's listStyle/text/richText together.
    if (isInlineTextEditing || isInlineShapeTextEditing) {
      applyInlineTextStyle('listStyle', next);
      return;
    }

    const textProp = isText ? 'text' : 'innerText';
    const currentText: string = (selectedObject as any)[textProp] || '';
    const nextText = next === 'none' ? stripListStyle(currentText) : applyListStyle(currentText, next);

    const updates: Record<string, any> = { [listProp]: next, [textProp]: nextText };

    // Also update richText spans when inline styles are present
    if (isText) {
      const richText: TextSpan[] | undefined = (selectedObject as any).richText;
      if (richText && richText.length > 0) {
        const nextRichText = next === 'none'
          ? stripListStyleFromSpans(richText)
          : applyListStyleToSpans(richText, next as 'disc' | 'ordered');
        updates.richText = isPlainSpans(nextRichText) ? undefined : nextRichText;
        updates[textProp] = nextRichText.map(s => s.text).join('');
      }
    } else if (isShapeWithText) {
      const innerRichText: TextSpan[] | undefined = (selectedObject as any).innerRichText;
      if (innerRichText && innerRichText.length > 0) {
        const nextRichText = next === 'none'
          ? stripListStyleFromSpans(innerRichText)
          : applyListStyleToSpans(innerRichText, next as 'disc' | 'ordered');
        updates.innerRichText = isPlainSpans(nextRichText) ? undefined : nextRichText;
        updates.innerText = nextRichText.map(s => s.text).join('');
      }
    }

    updateObject(selectedObject.id, updates);
  }, [selectedObject, isText, isShapeWithText, isInlineTextEditing, isInlineShapeTextEditing, applyInlineTextStyle, updateObject]);

  const handleTextColorChange = useCallback((color: string) => {
    if (!selectedObject || (!isText && !isShapeWithText)) return;
    if (isInlineTextEditing || isInlineShapeTextEditing) {
      applyInlineTextStyle('foreColor', color);
      return;
    }
    const propName = isText ? 'fill' : 'innerTextFill';
    updateObject(selectedObject.id, { [propName]: color });
  }, [selectedObject, isText, isShapeWithText, isInlineTextEditing, isInlineShapeTextEditing, applyInlineTextStyle, updateObject]);

  const handleTextAlignChange = useCallback((align: 'left' | 'center' | 'right' | 'justify') => {
    if (!selectedObject || (!isText && !isShapeWithText)) return;
    const propName = isText ? 'align' : 'innerTextAlign';
    updateObject(selectedObject.id, { [propName]: align });
  }, [selectedObject, isText, isShapeWithText, updateObject]);

  const handleTextVerticalAlignChange = useCallback((valign: 'top' | 'middle' | 'bottom') => {
    if (!selectedObject || !isShapeWithText) return;
    updateObject(selectedObject.id, { innerTextVerticalAlign: valign });
  }, [selectedObject, isShapeWithText, updateObject]);

  const handleMaskChange = useCallback((mask: ImageMaskShape) => {
    if (selectedObject && isImage) {
      updateObject(selectedObject.id, { maskShape: mask });
    }
  }, [selectedObject, isImage, updateObject]);

  const handleLayers = useCallback((direction: 'front' | 'back' | 'forward' | 'backward') => {
    if (isMultiSelect) {
      if (direction === 'front') {
        activeObjects.forEach((obj) => bringToFront(obj.id));
      } else if (direction === 'back') {
        [...activeObjects].reverse().forEach((obj) => sendToBack(obj.id));
      } else if (direction === 'forward') {
        activeObjects.forEach((obj) => bringForward(obj.id));
      } else {
        [...activeObjects].reverse().forEach((obj) => sendBackward(obj.id));
      }
    } else if (selectedObject) {
      if (direction === 'front') bringToFront(selectedObject.id);
      else if (direction === 'back') sendToBack(selectedObject.id);
      else if (direction === 'forward') bringForward(selectedObject.id);
      else sendBackward(selectedObject.id);
    }
  }, [isMultiSelect, activeObjects, selectedObject, bringToFront, sendToBack, bringForward, sendBackward]);

  const handleTextEdit = useCallback(() => {
    if (!selectedObject || !isText) return;
    onTextEdit?.(selectedObject.id);
  }, [selectedObject, isText, onTextEdit]);

  const handleGroup = useCallback(() => {
    groupSelected();
  }, [groupSelected]);

  const handleUngroup = useCallback(() => {
    ungroupSelected();
  }, [ungroupSelected]);

  const handleGroupAction = useCallback(() => {
    if (isGroupActionUngroup) {
      handleUngroup();
      return;
    }
    handleGroup();
  }, [isGroupActionUngroup, handleUngroup, handleGroup]);

  const handleTableBorderChange = useCallback((border: Partial<import('@sabi-canvas/types/canvas-objects').TableBorderConfig>) => {
    if (!selectedObject || !isTable) return;
    const current = (selectedObject as import('@sabi-canvas/types/canvas-objects').TableObject).border;
    updateObject(selectedObject.id, { border: { ...current, ...border } });
  }, [selectedObject, isTable, updateObject]);

  const handleAIWriteAction = useCallback(async (action: AIWriteAction) => {
    if (!selectedObject) return;

    if (selectedObject.type === 'text') {
      await runAIWriteAction(action, selectedObject as any, updateObject);
      return;
    }

    if (!isShapeWithText) return;

    const shapeText = (selectedObject as any).innerText ?? '';
    const tempTextObject = {
      ...(selectedObject as any),
      type: 'text',
      text: shapeText,
      richText: (selectedObject as any).innerRichText,
    } as any;

    await runAIWriteAction(action, tempTextObject, (id, updates) => {
      const nextText = typeof (updates as any).text === 'string' ? (updates as any).text : shapeText;
      updateObject(id, {
        innerText: nextText,
        innerRichText: undefined,
      });
    });
  }, [selectedObject, isShapeWithText, runAIWriteAction, updateObject]);

  const handleTableCellFillChange = useCallback((color: string) => {
    if (!selectedObject || !isTable) return;
    updateObject(selectedObject.id, { defaultCellFill: color });
  }, [selectedObject, isTable, updateObject]);

  const handleTableHeaderFillChange = useCallback((color: string) => {
    if (!selectedObject || !isTable) return;
    updateObject(selectedObject.id, { headerFill: color });
  }, [selectedObject, isTable, updateObject]);

  const handleCellFontFamilyChange = useCallback(async (fontFamily: string) => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, fontFamily } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
    const result = await loadFontFamily(fontFamily, { timeoutMs: 2400 });
    if (result.status === 'loaded') {
      updateObject(selectedObject.id, { cells: newCells });
    }
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleCellFontSizeChange = useCallback((fontSize: number) => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, fontSize } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleCellFontStyleToggle = useCallback((style: 'bold' | 'italic') => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    // Derive toggle direction from first active cell
    const firstCell = table.cells[activeCells[0].row]?.[activeCells[0].col];
    const currentStyle = firstCell?.fontStyle ?? 'normal';
    let newStyle: TableCell['fontStyle'];
    if (style === 'bold') {
      newStyle = currentStyle.includes('bold')
        ? (currentStyle.replace('bold', '').trim() || 'normal') as TableCell['fontStyle']
        : currentStyle === 'normal' ? 'bold' : 'bold italic';
    } else {
      newStyle = currentStyle.includes('italic')
        ? (currentStyle.replace('italic', '').trim() || 'normal') as TableCell['fontStyle']
        : currentStyle === 'normal' ? 'italic' : 'bold italic';
    }
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, fontStyle: newStyle } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleCellTextColorChange = useCallback((textColor: string) => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, textColor } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleCellTextAlignChange = useCallback((textAlign: TableCell['textAlign']) => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, textAlign } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleCellVerticalAlignChange = useCallback((verticalAlign: TableCell['verticalAlign']) => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, verticalAlign } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleSelectedCellFillChange = useCallback((fill: string) => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const cellSet = new Set(activeCells.map((c) => `${c.row}-${c.col}`));
    const newCells = table.cells.map((r, rIdx) =>
      r.map((c, cIdx) => (cellSet.has(`${rIdx}-${cIdx}`) ? { ...c, fill } : c))
    );
    updateObject(selectedObject.id, { cells: newCells });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleInsertRowAbove = useCallback(() => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const row = activeCells[0].row;
    const avgHeight = Math.round(table.rowHeights.reduce((s, h) => s + h, 0) / table.rowHeights.length);
    const newRow: TableCell[] = table.colWidths.map(() => ({ text: '' }));
    const newCells = [...table.cells];
    newCells.splice(row, 0, newRow);
    const newRowHeights = [...table.rowHeights];
    newRowHeights.splice(row, 0, avgHeight);
    updateObject(selectedObject.id, { cells: newCells, rowHeights: newRowHeights, height: table.height + avgHeight });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleInsertRowBelow = useCallback(() => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const row = activeCells[0].row + 1;
    const avgHeight = Math.round(table.rowHeights.reduce((s, h) => s + h, 0) / table.rowHeights.length);
    const newRow: TableCell[] = table.colWidths.map(() => ({ text: '' }));
    const newCells = [...table.cells];
    newCells.splice(row, 0, newRow);
    const newRowHeights = [...table.rowHeights];
    newRowHeights.splice(row, 0, avgHeight);
    updateObject(selectedObject.id, { cells: newCells, rowHeights: newRowHeights, height: table.height + avgHeight });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleDeleteRow = useCallback(() => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    if (table.rowHeights.length <= 1) return;
    const row = activeCells[0].row;
    const removedHeight = table.rowHeights[row];
    updateObject(selectedObject.id, {
      cells: table.cells.filter((_, rIdx) => rIdx !== row),
      rowHeights: table.rowHeights.filter((_, rIdx) => rIdx !== row),
      height: table.height - removedHeight,
    });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleInsertColumnLeft = useCallback(() => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const col = activeCells[0].col;
    const avgWidth = Math.round(table.colWidths.reduce((s, w) => s + w, 0) / table.colWidths.length);
    const newCells = table.cells.map((r) => { const nr = [...r]; nr.splice(col, 0, { text: '' }); return nr; });
    const newColWidths = [...table.colWidths];
    newColWidths.splice(col, 0, avgWidth);
    updateObject(selectedObject.id, { cells: newCells, colWidths: newColWidths, width: table.width + avgWidth });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleInsertColumnRight = useCallback(() => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const col = activeCells[0].col + 1;
    const avgWidth = Math.round(table.colWidths.reduce((s, w) => s + w, 0) / table.colWidths.length);
    const newCells = table.cells.map((r) => { const nr = [...r]; nr.splice(col, 0, { text: '' }); return nr; });
    const newColWidths = [...table.colWidths];
    newColWidths.splice(col, 0, avgWidth);
    updateObject(selectedObject.id, { cells: newCells, colWidths: newColWidths, width: table.width + avgWidth });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleDeleteColumn = useCallback(() => {
    if (activeCells.length === 0 || !selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    if (table.colWidths.length <= 1) return;
    const col = activeCells[0].col;
    const removedWidth = table.colWidths[col];
    updateObject(selectedObject.id, {
      cells: table.cells.map((r) => r.filter((_, cIdx) => cIdx !== col)),
      colWidths: table.colWidths.filter((_, cIdx) => cIdx !== col),
      width: table.width - removedWidth,
    });
  }, [activeCells, selectedObject, isTable, updateObject]);

  const handleDistributeRowsEvenly = useCallback(() => {
    if (!selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const total = table.rowHeights.reduce((s, h) => s + h, 0);
    const even = Math.round(total / table.rowHeights.length);
    updateObject(selectedObject.id, { rowHeights: table.rowHeights.map(() => even) });
  }, [selectedObject, isTable, updateObject]);

  const handleDistributeColumnsEvenly = useCallback(() => {
    if (!selectedObject || !isTable) return;
    const table = selectedObject as TableObject;
    const total = table.colWidths.reduce((s, w) => s + w, 0);
    const even = Math.round(total / table.colWidths.length);
    updateObject(selectedObject.id, { colWidths: table.colWidths.map(() => even) });
  }, [selectedObject, isTable, updateObject]);

  const handleCropModeToggle = useCallback(() => {
    if (selectedObject && isImage) {
      setIsCropMode(!isCropMode);
    }
  }, [selectedObject, isImage, isCropMode, setIsCropMode]);

  return {
    // Selection state
    isMultiSelect,
    activeObjects,
    canUngroupSelection,
    canGroupSelection,
    shouldShowGroupAction,
    isGroupActionUngroup,
    allLocked,
    isCropMode,

    // Object types
    objectType,
    isText,
    isImage,
    isSvgImage,
    isTable,
    isShapeWithText,
    isInlineTextEditing,
    isInlineShapeTextEditing,
    canShowAIWrite,
    isAIWriteRunning: isRunningAction,
    inlineTextSelectionState,
    
    // Feature flags
    hasStroke,
    hasFill,
    hasShadow,
    
    // Typography states
    fontSizeMin,
    fontSizeMax,
    selectedFontSize,
    fontSizeDraft,
    isFontSizeFocused,
    setIsFontSizeFocused,
    setFontSizeDraft,
    
    // Specific properties
    currentMask,

    // Actions
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
    handleGroup,
    handleUngroup,
    handleGroupAction,
    handleCropModeToggle,
    cropApply,
    cropReset,
    cropCancel,
    handleAIWriteAction,
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
  };
};

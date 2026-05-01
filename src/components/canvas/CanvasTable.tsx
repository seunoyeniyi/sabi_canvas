import React, { useCallback, useState, useMemo, useRef } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import Konva from 'konva';
import { TableObject, TableCell } from '@sabi-canvas/types/canvas-objects';
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';
import { DEFAULT_FONT_FAMILY } from '@sabi-canvas/lib/fontCatalog';
import { getFontFallbackStack } from '@sabi-canvas/lib/fontLoader';

interface CanvasTableProps {
  object: TableObject;
  isSelected: boolean;
  editingCell: { tableId: string; row: number; col: number } | null;
  onSelect: (id: string, addToSelection?: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDragStart?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onHover?: (id: string | null) => void;
  onCellTextEditRequest: (tableId: string, row: number, col: number) => void;
  onCellSelection?: (tableId: string, cells: { row: number; col: number }[]) => void;
  isDragEnabled?: boolean;
  shouldSuppressTapSelection?: () => boolean;
}

const DIVIDER_HIT_SIZE = 8;

export const CanvasTable: React.FC<CanvasTableProps> = ({
  object,
  isSelected,
  editingCell,
  onSelect,
  onUpdate,
  onDragStart,
  onDragMove,
  onDragEnd,
  onHover,
  onCellTextEditRequest,
  onCellSelection,
  isDragEnabled = true,
  shouldSuppressTapSelection,
}) => {
  const [selectedCells, setSelectedCells] = useState<{ row: number; col: number }[]>([]);

  const isEditingThisTable =
    editingCell !== null && editingCell.tableId === object.id;

  // Clear cell selection when table is deselected
  React.useEffect(() => {
    if (!isSelected) {
      setSelectedCells([]);
      onCellSelection?.(object.id, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected]);

  // Cumulative col offset positions
  const colOffsets = useMemo(() => {
    const offsets: number[] = [0];
    object.colWidths.forEach((w) => offsets.push(offsets[offsets.length - 1] + w));
    return offsets;
  }, [object.colWidths]);

  // Cumulative row offset positions
  const rowOffsets = useMemo(() => {
    const offsets: number[] = [0];
    object.rowHeights.forEach((h) => offsets.push(offsets[offsets.length - 1] + h));
    return offsets;
  }, [object.rowHeights]);

  const totalWidth = useMemo(() => object.colWidths.reduce((s, w) => s + w, 0), [object.colWidths]);
  const totalHeight = useMemo(() => object.rowHeights.reduce((s, h) => s + h, 0), [object.rowHeights]);

  const getCell = (row: number, col: number): TableCell => {
    return object.cells[row]?.[col] ?? { text: '' };
  };

  const getCellFill = (row: number): string => {
    if (object.headerRow && row === 0) return object.headerFill;
    return object.defaultCellFill;
  };

  const getCellTextColor = (row: number): string => {
    if (object.headerRow && row === 0) return object.headerTextColor;
    return object.defaultTextColor;
  };

  // Border line dash pattern
  const getBorderDash = (): number[] | undefined => {
    if (object.border.style === 'dashed') return [8, 4];
    if (object.border.style === 'dotted') return [2, 3];
    return undefined;
  };

  // --- Drag handlers for column dividers ---
  const colDividerStartX = useRef<number>(0);
  const colDividerStartWidths = useRef<number[]>([]);

  const handleColDividerDragStart = useCallback(
    (colIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      // Record the divider's boundary center (right edge of left column)
      colDividerStartX.current = e.target.x() + DIVIDER_HIT_SIZE / 2;
      colDividerStartWidths.current = [...object.colWidths];
    },
    [object.colWidths]
  );

  const handleColDividerDragMove = useCallback(
    (colIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const startWidths = colDividerStartWidths.current;
      const dx = e.target.x() + DIVIDER_HIT_SIZE / 2 - colDividerStartX.current;
      const minWidth = 20;
      // drag right → right col shrinks; drag left → left col shrinks
      const maxDx = startWidths[colIndex + 1] - minWidth;
      const minDx = -(startWidths[colIndex] - minWidth);
      const clampedDx = Math.max(minDx, Math.min(maxDx, dx));
      const newBoundaryX =
        startWidths.slice(0, colIndex + 1).reduce((s, w) => s + w, 0) + clampedDx;
      // Move divider visually — no React update, no re-render
      e.target.x(newBoundaryX - DIVIDER_HIT_SIZE / 2);
      e.target.y(0);
    },
    []
  );

  const handleColDividerDragEnd = useCallback(
    (colIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const startWidths = colDividerStartWidths.current;
      const dx = e.target.x() + DIVIDER_HIT_SIZE / 2 - colDividerStartX.current;
      const minWidth = 20;
      const maxDx = startWidths[colIndex + 1] - minWidth;
      const minDx = -(startWidths[colIndex] - minWidth);
      const clampedDx = Math.max(minDx, Math.min(maxDx, dx));
      const newWidths = [...startWidths];
      newWidths[colIndex] = startWidths[colIndex] + clampedDx;
      newWidths[colIndex + 1] = startWidths[colIndex + 1] - clampedDx;
      onUpdate(object.id, {
        colWidths: newWidths,
        width: newWidths.reduce((s, w) => s + w, 0),
      } as Partial<CanvasObject>);
    },
    [object.id, onUpdate]
  );

  // --- Drag handlers for row dividers ---
  const rowDividerStartY = useRef<number>(0);
  const rowDividerStartHeights = useRef<number[]>([]);

  const handleRowDividerDragStart = useCallback(
    (rowIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      rowDividerStartY.current = e.target.y() + DIVIDER_HIT_SIZE / 2;
      rowDividerStartHeights.current = [...object.rowHeights];
    },
    [object.rowHeights]
  );

  const handleRowDividerDragMove = useCallback(
    (rowIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const startHeights = rowDividerStartHeights.current;
      const dy = e.target.y() + DIVIDER_HIT_SIZE / 2 - rowDividerStartY.current;
      const minHeight = 20;
      const maxDy = startHeights[rowIndex + 1] - minHeight;
      const minDy = -(startHeights[rowIndex] - minHeight);
      const clampedDy = Math.max(minDy, Math.min(maxDy, dy));
      const newBoundaryY =
        startHeights.slice(0, rowIndex + 1).reduce((s, h) => s + h, 0) + clampedDy;
      e.target.x(0);
      e.target.y(newBoundaryY - DIVIDER_HIT_SIZE / 2);
    },
    []
  );

  const handleRowDividerDragEnd = useCallback(
    (rowIndex: number, e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const startHeights = rowDividerStartHeights.current;
      const dy = e.target.y() + DIVIDER_HIT_SIZE / 2 - rowDividerStartY.current;
      const minHeight = 20;
      const maxDy = startHeights[rowIndex + 1] - minHeight;
      const minDy = -(startHeights[rowIndex] - minHeight);
      const clampedDy = Math.max(minDy, Math.min(maxDy, dy));
      const newHeights = [...startHeights];
      newHeights[rowIndex] = startHeights[rowIndex] + clampedDy;
      newHeights[rowIndex + 1] = startHeights[rowIndex + 1] - clampedDy;
      onUpdate(object.id, {
        rowHeights: newHeights,
        height: newHeights.reduce((s, h) => s + h, 0),
      } as Partial<CanvasObject>);
    },
    [object.id, onUpdate]
  );

  const handleGroupClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (shouldSuppressTapSelection?.()) return;
      if (!isSelected) {
        const isMultiSelect = e.evt.shiftKey || e.evt.metaKey || e.evt.ctrlKey;
        onSelect(object.id, isMultiSelect);
      }
    },
    [isSelected, onSelect, object.id, shouldSuppressTapSelection]
  );

  const handleGroupTap = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      e.cancelBubble = true;
      if (shouldSuppressTapSelection?.()) return;
      if (!isSelected) {
        onSelect(object.id);
      }
    },
    [isSelected, onSelect, object.id, shouldSuppressTapSelection]
  );

  const handleCellClick = useCallback(
    (row: number, col: number, e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (shouldSuppressTapSelection?.()) return;

      // Select the table if not already selected
      if (!isSelected) {
        onSelect(object.id);
      }

      const isShift = e.evt.shiftKey;
      setSelectedCells((prev) => {
        const alreadySelected = prev.some((c) => c.row === row && c.col === col);
        let next: { row: number; col: number }[];
        if (isShift) {
          next = alreadySelected
            ? prev.filter((c) => !(c.row === row && c.col === col))
            : [...prev, { row, col }];
        } else {
          next = [{ row, col }];
        }
        onCellSelection?.(object.id, next);
        return next;
      });
    },
    [isSelected, object.id, onSelect, onCellSelection, shouldSuppressTapSelection]
  );

  const handleCellDblClick = useCallback(
    (row: number, col: number, e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      setSelectedCells([{ row, col }]);
      onCellSelection?.(object.id, [{ row, col }]);
      onCellTextEditRequest(object.id, row, col);
    },
    [onCellTextEditRequest, onCellSelection, object.id]
  );

  const borderColor = object.border.style === 'none' ? 'transparent' : object.border.color;
  const borderWidth = object.border.style === 'none' ? 0 : object.border.width;
  const borderDash = getBorderDash();

  // Disable drag when cells are selected or text is being edited
  const isDraggable =
    selectedCells.length === 0 &&
    !isEditingThisTable &&
    object.draggable &&
    !object.locked &&
    isDragEnabled;

  return (
    <Group
      x={object.x}
      y={object.y}
      rotation={object.rotation}
      scaleX={object.scaleX}
      scaleY={object.scaleY}
      opacity={object.opacity}
      visible={object.visible}
      draggable={isDraggable}
      name={object.id}
      onClick={handleGroupClick}
      onTap={handleGroupTap}
      onDragMove={onDragMove}
      onDragStart={(e) => {
        onDragStart?.(e);
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'move';
      }}
      onDragEnd={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = '';
        onDragEnd?.(e);
        onUpdate(object.id, { x: e.target.x(), y: e.target.y() });
      }}
      onMouseEnter={() => onHover?.(object.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Cell backgrounds */}
      {object.cells.map((rowArr, rowIdx) =>
        rowArr.map((cell, colIdx) => {
          const x = colOffsets[colIdx];
          const y = rowOffsets[rowIdx];
          const w = object.colWidths[colIdx];
          const h = object.rowHeights[rowIdx];
          const perCellFill = cell.fill ?? getCellFill(rowIdx);
          const isActiveCell =
            isEditingThisTable &&
            editingCell!.row === rowIdx &&
            editingCell!.col === colIdx;
          const isHighlightedCell =
            isSelected &&
            selectedCells.some((c) => c.row === rowIdx && c.col === colIdx);

          return (
            <React.Fragment key={`cell-${rowIdx}-${colIdx}`}>
              <Rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill={perCellFill}
                stroke="transparent"
                strokeWidth={0}
                perfectDrawEnabled={false}
                onClick={(e) => handleCellClick(rowIdx, colIdx, e)}
                onDblClick={(e) => handleCellDblClick(rowIdx, colIdx, e)}
              />
              {/* Selection highlight */}
              {(isHighlightedCell || isActiveCell) && (
                <Rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="rgba(59,130,246,0.12)"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              )}
              {/* Cell text — hidden for the actively edited cell */}
              {!isActiveCell && (
                <Text
                  x={x + object.cellPadding}
                  y={y + object.cellPadding}
                  width={w - 2 * object.cellPadding}
                  height={h - 2 * object.cellPadding}
                  text={cell.text}
                  fontSize={cell.fontSize ?? object.defaultFontSize}
                  fontFamily={getFontFallbackStack(cell.fontFamily ?? object.defaultFontFamily ?? DEFAULT_FONT_FAMILY)}
                  fontStyle={cell.fontStyle ?? 'normal'}
                  fill={cell.textColor ?? getCellTextColor(rowIdx)}
                  align={cell.textAlign ?? object.defaultTextAlign}
                  verticalAlign={cell.verticalAlign ?? object.defaultVerticalAlign ?? 'top'}
                  lineHeight={1.2}
                  scaleX={1}
                  scaleY={1}
                  listening={false}
                  perfectDrawEnabled={false}
                  wrap="word"
                  ellipsis={true}
                />
              )}
            </React.Fragment>
          );
        })
      )}

      {/* Border lines */}
      {/* Outer top */}
      {object.border.outerTop && (
        <Line
          points={[0, 0, totalWidth, 0]}
          stroke={borderColor}
          strokeWidth={borderWidth}
          dash={borderDash}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {/* Outer bottom */}
      {object.border.outerBottom && (
        <Line
          points={[0, totalHeight, totalWidth, totalHeight]}
          stroke={borderColor}
          strokeWidth={borderWidth}
          dash={borderDash}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {/* Outer left */}
      {object.border.outerLeft && (
        <Line
          points={[0, 0, 0, totalHeight]}
          stroke={borderColor}
          strokeWidth={borderWidth}
          dash={borderDash}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {/* Outer right */}
      {object.border.outerRight && (
        <Line
          points={[totalWidth, 0, totalWidth, totalHeight]}
          stroke={borderColor}
          strokeWidth={borderWidth}
          dash={borderDash}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {/* Inner horizontal lines */}
      {object.border.innerHorizontal &&
        rowOffsets.slice(1, -1).map((y, idx) => (
          <Line
            key={`ih-${idx}`}
            points={[0, y, totalWidth, y]}
            stroke={borderColor}
            strokeWidth={borderWidth}
            dash={borderDash}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}
      {/* Inner vertical lines */}
      {object.border.innerVertical &&
        colOffsets.slice(1, -1).map((x, idx) => (
          <Line
            key={`iv-${idx}`}
            points={[x, 0, x, totalHeight]}
            stroke={borderColor}
            strokeWidth={borderWidth}
            dash={borderDash}
            listening={false}
            perfectDrawEnabled={false}
          />
        ))}

      {/* When table is selected: draggable column dividers */}
      {isSelected &&
        colOffsets.slice(1, -1).map((x, idx) => (
          <Rect
            key={`cd-${idx}`}
            x={x - DIVIDER_HIT_SIZE / 2}
            y={0}
            width={DIVIDER_HIT_SIZE}
            height={totalHeight}
            fill="rgba(59,130,246,0.15)"
            draggable
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'ew-resize';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = '';
            }}
            onDragStart={(e) => handleColDividerDragStart(idx, e)}
            onDragMove={(e) => handleColDividerDragMove(idx, e)}
            onDragEnd={(e) => handleColDividerDragEnd(idx, e)}
            onClick={(e) => e.cancelBubble = true}
          />
        ))}

      {/* When table is selected: draggable row dividers */}
      {isSelected &&
        rowOffsets.slice(1, -1).map((y, idx) => (
          <Rect
            key={`rd-${idx}`}
            x={0}
            y={y - DIVIDER_HIT_SIZE / 2}
            width={totalWidth}
            height={DIVIDER_HIT_SIZE}
            fill="rgba(59,130,246,0.15)"
            draggable
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'ns-resize';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = '';
            }}
            onDragStart={(e) => handleRowDividerDragStart(idx, e)}
            onDragMove={(e) => handleRowDividerDragMove(idx, e)}
            onDragEnd={(e) => handleRowDividerDragEnd(idx, e)}
            onClick={(e) => e.cancelBubble = true}
          />
        ))}

      {/* Transparent hit area for group-level clicks when no cells are selected */}
      <Rect
        x={0}
        y={0}
        width={totalWidth}
        height={totalHeight}
        fill="transparent"
        listening={selectedCells.length === 0 && !isSelected}
        perfectDrawEnabled={false}
        onClick={handleGroupClick}
        onTap={handleGroupTap}
      />
    </Group>
  );
};

export default CanvasTable;

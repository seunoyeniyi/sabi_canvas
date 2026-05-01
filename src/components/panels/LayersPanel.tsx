import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Layers2,
  Lock,
  Square,
  Trash2,
  Unlock,
} from 'lucide-react';
import { cn } from '@sabi-canvas/lib/utils';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { CanvasObject, CanvasObjectType, TextObject } from '@sabi-canvas/types/canvas-objects';

interface LayersPanelProps {
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeIcon(type: CanvasObjectType): React.ReactNode {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (type) {
    case 'rectangle':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="3" width="14" height="10" rx="1" />
        </svg>
      );
    case 'circle':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <ellipse cx="8" cy="8" rx="6.5" ry="4.5" />
        </svg>
      );
    case 'triangle':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="8,1.5 14.5,14 1.5,14" />
        </svg>
      );
    case 'polygon':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="8,1 14,5.5 11.5,13 4.5,13 2,5.5" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="8,1 9.8,6 15,6 10.9,9.2 12.5,14.3 8,11.3 3.5,14.3 5.1,9.2 1,6 6.2,6" />
        </svg>
      );
    case 'line':
      return (
        <svg viewBox="0 0 16 16" className={cls} stroke="currentColor" strokeWidth="1.5">
          <line x1="1" y1="8" x2="15" y2="8" />
        </svg>
      );
    case 'arrow':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="1" y1="8" x2="12" y2="8" />
          <polyline points="9,5 12,8 9,11" />
        </svg>
      );
    case 'path':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 13 C4 4 8 2 10 6 S14 12 14 3" strokeLinecap="round" />
        </svg>
      );
    case 'text':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="currentColor">
          <text x="2" y="13" fontSize="11" fontWeight="700" fontFamily="serif">T</text>
        </svg>
      );
    case 'image':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="2" width="14" height="12" rx="1" />
          <circle cx="5.5" cy="6" r="1.5" />
          <polyline points="1,13 5,8.5 8,11 11,7.5 15,13" />
        </svg>
      );
    case 'group':
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="5" width="7" height="6" rx="0.75" />
          <rect x="8" y="2" width="7" height="5" rx="0.75" />
          <rect x="8" y="9" width="7" height="5" rx="0.75" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="3" width="14" height="10" rx="1" />
        </svg>
      );
  }
}

function getDisplayName(obj: CanvasObject): string {
  if (obj.name) return obj.name;
  if (obj.type === 'text') {
    const t = (obj as TextObject).text?.trim();
    if (t) return t;
  }
  return `#${obj.id}`;
}

export const LayersPanel: React.FC<LayersPanelProps> = () => {
  const {
    objects,
    selectedIds,
    selectObject,
    selectObjects,
    updateObject,
    deleteObject,
    reorderObjects,
  } = useCanvasObjects();

  const { editorMode, isMockupEnabled } = useEditor();
  const isCustomerMode = isMockupEnabled && editorMode === 'customer';

  // In customer mode, hide mockup-role and print-area objects from the layers list
  const visibleObjects = useMemo(
    () => isCustomerMode
      ? objects.filter((o) => o.objectRole === 'customer')
      : objects,
    [isCustomerMode, objects]
  );

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const dragOverRef = useRef<{ id: string | null; pos: 'before' | 'after' | null }>({ id: null, pos: null });
  const touchDragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const commitReorderRef = useRef<(src: string, tgt: string, pos: 'before' | 'after') => void>(() => {});
  const selectionAnchorRef = useRef<string | null>(null);

  const [multiSelectMode, setMultiSelectMode] = useState(false);

  const topLevelObjects = useMemo(() => visibleObjects.filter((o) => !o.parentId), [visibleObjects]);
  const displayObjects = useMemo(() => [...topLevelObjects].reverse(), [topLevelObjects]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, CanvasObject[]>();
    visibleObjects.forEach((o) => {
      if (o.parentId) {
        const arr = map.get(o.parentId) ?? [];
        arr.push(o);
        map.set(o.parentId, arr);
      }
    });
    return map;
  }, [objects]);

  const flatRows = useMemo(() => {
    const rows: CanvasObject[] = [];
    const visit = (obj: CanvasObject) => {
      rows.push(obj);
      if (obj.type === 'group' && expandedGroups.has(obj.id)) {
        [...(childrenMap.get(obj.id) ?? [])].reverse().forEach(visit);
      }
    };
    displayObjects.forEach(visit);
    return rows;
  }, [displayObjects, expandedGroups, childrenMap]);

  const commitReorder = useCallback(
    (sourceId: string, targetId: string, position: 'before' | 'after') => {
      const newDisplay = [...displayObjects];
      const srcIdx = newDisplay.findIndex((o) => o.id === sourceId);
      if (srcIdx === -1) return;
      const [removed] = newDisplay.splice(srcIdx, 1);
      const tgtIdx = newDisplay.findIndex((o) => o.id === targetId);
      if (tgtIdx === -1) return;
      newDisplay.splice(position === 'before' ? tgtIdx : tgtIdx + 1, 0, removed);
      reorderObjects([...newDisplay].reverse().map((o) => o.id));
    },
    [displayObjects, reorderObjects]
  );

  useEffect(() => { commitReorderRef.current = commitReorder; }, [commitReorder]);

  const clearDragState = useCallback(() => {
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition(null);
    dragOverRef.current = { id: null, pos: null };
  }, []);

  const applyDragOver = useCallback((id: string | null, pos: 'before' | 'after' | null) => {
    dragOverRef.current = { id, pos };
    setDragOverId(id);
    setDropPosition(pos);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      if (id === draggingId) { applyDragOver(null, null); return; }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      applyDragOver(id, e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    },
    [draggingId, applyDragOver]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain');
      const pos = dragOverRef.current.pos;
      if (sourceId && pos) commitReorder(sourceId, targetId, pos);
      clearDragState();
    },
    [commitReorder, clearDragState]
  );

  const handleGripTouchStart = useCallback((e: React.TouchEvent, id: string) => {
    e.stopPropagation();
    touchDragRef.current = { id, moved: false };
    setDraggingId(id);
  }, []);

  const exitMultiSelect = useCallback(() => setMultiSelectMode(false), []);

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!touchDragRef.current) return;
      touchDragRef.current.moved = true;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = el?.closest('[data-layer-id]') as HTMLElement | null;
      const targetId = row?.getAttribute('data-layer-id');
      if (!targetId || targetId === touchDragRef.current.id) {
        dragOverRef.current = { id: null, pos: null };
        setDragOverId(null);
        setDropPosition(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const pos: 'before' | 'after' = touch.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      dragOverRef.current = { id: targetId, pos };
      setDragOverId(targetId);
      setDropPosition(pos);
    };

    const onTouchEnd = () => {
      if (!touchDragRef.current) return;
      const { id: sourceId, moved } = touchDragRef.current;
      touchDragRef.current = null;
      const { id: targetId, pos } = dragOverRef.current;
      if (moved && targetId && pos) commitReorderRef.current(sourceId, targetId, pos);
      dragOverRef.current = { id: null, pos: null };
      setDraggingId(null);
      setDragOverId(null);
      setDropPosition(null);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  const handleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (editingId) return;
      if (e.metaKey || e.ctrlKey) {
        selectionAnchorRef.current = id;
        selectObject(id, true);
      } else if (e.shiftKey && selectionAnchorRef.current) {
        const anchorIdx = flatRows.findIndex((r) => r.id === selectionAnchorRef.current);
        const currIdx = flatRows.findIndex((r) => r.id === id);
        if (anchorIdx !== -1 && currIdx !== -1) {
          const [from, to] = anchorIdx < currIdx ? [anchorIdx, currIdx] : [currIdx, anchorIdx];
          selectObjects(flatRows.slice(from, to + 1).map((r) => r.id));
        } else {
          selectionAnchorRef.current = id;
          selectObject(id);
        }
      } else {
        selectionAnchorRef.current = id;
        selectObject(id);
      }
    },
    [editingId, flatRows, selectObject, selectObjects]
  );

  const handleToggleVisible = useCallback(
    (id: string, current: boolean) => updateObject(id, { visible: !current }),
    [updateObject]
  );

  const handleToggleLock = useCallback(
    (id: string, current: boolean) => updateObject(id, { locked: !current }),
    [updateObject]
  );

  const handleDelete = useCallback((id: string) => deleteObject(id), [deleteObject]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    updateObject(editingId, { name: editValue.trim() || undefined });
    setEditingId(null);
  }, [editingId, editValue, updateObject]);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const renderRow = (obj: CanvasObject, depth: number): React.ReactNode => {
    const isGroup = obj.type === 'group';
    const isExpanded = expandedGroups.has(obj.id);
    const isTopLevel = !obj.parentId;
    const isSelected = selectedIds.includes(obj.id);
    const displayChildren =
      isGroup && isExpanded ? [...(childrenMap.get(obj.id) ?? [])].reverse() : [];

    return (
      <React.Fragment key={obj.id}>
        <div
          data-layer-id={obj.id}
          draggable={isTopLevel}
          onDragStart={isTopLevel ? (e) => handleDragStart(e, obj.id) : undefined}
          onDragOver={isTopLevel ? (e) => handleDragOver(e, obj.id) : undefined}
          onDragEnd={isTopLevel ? clearDragState : undefined}
          onDrop={isTopLevel ? (e) => handleDrop(e, obj.id) : undefined}
          onClick={(e) => {
            if (multiSelectMode) {
              e.stopPropagation();
              selectionAnchorRef.current = obj.id;
              selectObject(obj.id, true);
              return;
            }
            if (isSelected && !e.metaKey && !e.ctrlKey && !e.shiftKey && !editingId) {
              e.stopPropagation();
              setEditingId(obj.id);
              setEditValue(obj.name ?? '');
              return;
            }
            handleSelect(obj.id, e);
          }}
          style={{ marginLeft: depth > 0 ? `${depth * 14}px` : undefined }}
          className={cn(
            'relative flex items-center gap-1 px-1 py-1.5 border transition-colors cursor-pointer select-none',
            isSelected
              ? 'border-primary/50 bg-primary/10'
              : 'border-border bg-card hover:bg-muted/40',
            draggingId === obj.id && 'opacity-40',
          )}
        >
          {dragOverId === obj.id && dropPosition === 'before' && (
            <div className="absolute -top-px left-2 right-2 h-0.5 bg-primary rounded-full pointer-events-none z-10" />
          )}
          {dragOverId === obj.id && dropPosition === 'after' && (
            <div className="absolute -bottom-px left-2 right-2 h-0.5 bg-primary rounded-full pointer-events-none z-10" />
          )}

          {multiSelectMode && (
            <span
              className="shrink-0"
              onClick={(e) => { e.stopPropagation(); selectionAnchorRef.current = obj.id; selectObject(obj.id, true); }}
            >
              {isSelected
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4 text-muted-foreground/50" />}
            </span>
          )}

          <span
            className="cursor-grab active:cursor-grabbing shrink-0 touch-none"
            onTouchStart={isTopLevel ? (e) => handleGripTouchStart(e, obj.id) : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          </span>

          {isGroup && (
            <button
              className="shrink-0 text-muted-foreground hover:text-foreground -mx-0.5"
              onClick={(e) => { e.stopPropagation(); handleToggleExpand(obj.id); }}
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}

          <span className="text-muted-foreground/50 shrink-0" title={obj.type}>
            {getTypeIcon(obj.type)}
          </span>

          <div className="flex-1 min-w-0">
            {editingId === obj.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-background border border-primary rounded px-1.5 py-1 text-xs outline-none"
              />
            ) : (
              <span
                className="block truncate text-xs py-1"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingId(obj.id);
                  setEditValue(obj.name ?? '');
                }}
              >
                {getDisplayName(obj)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0 shrink-0">
            <button
              title={obj.visible ? 'Hide' : 'Show'}
              onClick={(e) => { e.stopPropagation(); handleToggleVisible(obj.id, obj.visible); }}
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors',
                !obj.visible && 'text-muted-foreground/40',
              )}
            >
              {obj.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>

            <button
              title={obj.locked ? 'Unlock' : 'Lock'}
              onClick={(e) => { e.stopPropagation(); handleToggleLock(obj.id, obj.locked); }}
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors',
                obj.locked && 'text-amber-500',
              )}
            >
              {obj.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>

            <button
              title="Delete layer"
              onClick={(e) => { e.stopPropagation(); handleDelete(obj.id); }}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {displayChildren.map((child) => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-3 px-0.5 min-h-[20px]">
        <span className="text-xs text-muted-foreground flex-1">
          {multiSelectMode
            ? `${selectedIds.length} selected`
            : topLevelObjects.length === 0
              ? 'No layers'
              : `${topLevelObjects.length} layer${topLevelObjects.length !== 1 ? 's' : ''}`}
        </span>
        {topLevelObjects.length > 0 && (
          <button
            onClick={multiSelectMode ? exitMultiSelect : () => setMultiSelectMode(true)}
            className={cn(
              'text-xs px-2 py-0.5 rounded transition-colors',
              multiSelectMode
                ? 'text-primary font-medium hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {multiSelectMode ? 'Done' : 'Select'}
          </button>
        )}
      </div>

      {topLevelObjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <Layers2 className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs max-w-[160px]">Add shapes, text, or images to see them here.</p>
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto space-y-1"
          onDragOver={(e) => e.preventDefault()}
        >
          {displayObjects.map((obj) => renderRow(obj, 0))}
        </div>
      )}
    </div>
  );
};

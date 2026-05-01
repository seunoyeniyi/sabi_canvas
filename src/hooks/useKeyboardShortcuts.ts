import { useEffect } from 'react';
import { toast } from 'sonner';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useCanvasActions } from '@sabi-canvas/hooks/useCanvasActions';

const isMacPlatform = (): boolean => navigator.platform.toUpperCase().includes('MAC');

const isEditableElement = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;

  if (element.closest('[data-disable-shortcuts="true"]')) return true;

  const tagName = element.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    element.isContentEditable
  );
};

const isDialogContext = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;

  return !!element.closest('[role="dialog"]');
};

export const useKeyboardShortcuts = (): void => {
  const { setInteractionMode, setActiveTool, interactionMode, editorMode, isMockupEnabled } = useEditor();
  const { addShape } = useCanvasActions();

  const {
    selectedIds,
    deleteSelectedObjects,
    selectAll,
    deselectAll,
    undo,
    redo,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteClipboard,
    nudgeSelected,
    groupSelected,
    ungroupSelected,
    objects,
    selectObjects,
  } = useCanvasObjects();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;

      const key = event.key.toLowerCase();
      const mod = isMacPlatform() ? event.metaKey : event.ctrlKey;
      const inDialog = isDialogContext(event.target);

      // Keep dialog-focused interactions isolated from global shortcuts.
      if (inDialog && key !== 'escape') return;

      if (mod && !event.shiftKey && key === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      if ((mod && event.shiftKey && key === 'z') || (mod && key === 'y')) {
        event.preventDefault();
        redo();
        return;
      }

      if (mod && key === 'a') {
        event.preventDefault();
        if (isMockupEnabled && editorMode === 'customer') {
          // Only select top-level objects owned by the customer
          const customerIds = objects
            .filter((o) => !o.parentId && o.objectRole === 'customer')
            .map((o) => o.id);
          selectObjects(customerIds);
        } else {
          selectAll();
        }
        return;
      }

      if (mod && key === 'd') {
        const handled = duplicateSelected();
        if (handled) event.preventDefault();
        return;
      }

      if (mod && !event.shiftKey && key === 'g') {
        const handled = groupSelected();
        if (handled) event.preventDefault();
        return;
      }

      if (mod && event.shiftKey && key === 'g') {
        const handled = ungroupSelected();
        if (handled) event.preventDefault();
        return;
      }

      if (mod && key === 'c') {
        const handled = copySelected();
        if (handled) event.preventDefault();
        return;
      }

      if (mod && key === 'x') {
        const handled = cutSelected();
        if (handled) event.preventDefault();
        return;
      }

      if (mod && key === 'v') {
        const handled = pasteClipboard();
        if (handled) event.preventDefault();
        return;
      }

      if (mod && key === 's') {
        event.preventDefault();
        // toast.success('Design saved');
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.length > 0) {
        event.preventDefault();
        if (isMockupEnabled && editorMode === 'customer') {
          // Guard: only delete objects the customer owns — never touch mockup-role objects
          const customerSelected = selectedIds.filter((id) => {
            const obj = objects.find((o) => o.id === id);
            return obj?.objectRole === 'customer';
          });
          if (customerSelected.length > 0) {
            deleteSelectedObjects(customerSelected);
          }
        } else {
          deleteSelectedObjects();
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setInteractionMode('select');
        setActiveTool('select');
        deselectAll();
        return;
      }

      const nudgeStep = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        nudgeSelected(0, -nudgeStep);
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        nudgeSelected(0, nudgeStep);
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeSelected(-nudgeStep, 0);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeSelected(nudgeStep, 0);
        return;
      }

      if (mod || event.altKey || event.shiftKey) return;

      switch (key) {
        case 'v':
          event.preventDefault();
          setInteractionMode('select');
          setActiveTool('select');
          break;
        case 'h':
          event.preventDefault();
          setInteractionMode('pan');
          setActiveTool('hand');
          break;
        case 'd':
          event.preventDefault();
          setInteractionMode('draw');
          setActiveTool('draw');
          break;
        case 't':
          event.preventDefault();
          addShape('text');
          break;
        case 'r':
          event.preventDefault();
          addShape('rectangle');
          break;
        case 'o':
          event.preventDefault();
          addShape('ellipse');
          break;
        case 'p':
          event.preventDefault();
          setActiveTool('pen');
          break;
        case 'e':
          event.preventDefault();
          setActiveTool('eraser');
          break;
        case 'i':
          event.preventDefault();
          setActiveTool('image');
          break;
        case 'l':
          event.preventDefault();
          setActiveTool('layers');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    addShape,
    copySelected,
    cutSelected,
    deleteSelectedObjects,
    deselectAll,
    duplicateSelected,
    editorMode,
    isMockupEnabled,
    nudgeSelected,
    objects,
    pasteClipboard,
    groupSelected,
    ungroupSelected,
    redo,
    selectAll,
    selectObjects,
    selectedIds,
    setActiveTool,
    setInteractionMode,
    undo,
  ]);
};

export default useKeyboardShortcuts;

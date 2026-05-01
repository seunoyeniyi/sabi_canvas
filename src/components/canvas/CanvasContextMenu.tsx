import React from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@sabi-canvas/ui/context-menu';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useToolbarState } from './hooks/useToolbarState';
import { useSelectedObject } from '@sabi-canvas/hooks/useSelectedObject';
import { 
  Copy, 
  Trash2, 
  Lock, 
  Unlock, 
  Group, 
  Ungroup, 
  ArrowUp, 
  ArrowDown, 
  BringToFront, 
  SendToBack, 
  Scissors, 
  ClipboardPaste, 
  CopyPlus 
} from 'lucide-react';

interface CanvasContextMenuProps {
  children: React.ReactNode;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({ children }) => {
  const {
    selectedIds,
    deleteSelectedObjects,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteClipboard,
    bringForward,
    bringToFront: bringToFrontAction,
    sendBackward,
    sendToBack: sendToBackAction,
  } = useCanvasObjects();

  const selectedObject = useSelectedObject();
  const { canvasSize } = useEditor();
  const {
    allLocked,
    handleLockToggle,
    shouldShowGroupAction,
    isGroupActionUngroup,
    handleGroupAction,
  } = useToolbarState({ selectedObject, designSize: canvasSize });

  const hasSelection = selectedIds.length > 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem disabled={!hasSelection} onClick={cutSelected}>
           <Scissors className="mr-2 h-4 w-4 text-muted-foreground" />
           <span>Cut</span>
           <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onClick={copySelected}>
           <Copy className="mr-2 h-4 w-4 text-muted-foreground" />
           <span>Copy</span>
           <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={pasteClipboard}>
           <ClipboardPaste className="mr-2 h-4 w-4 text-muted-foreground" />
           <span>Paste</span>
           <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!hasSelection} onClick={duplicateSelected}>
           <CopyPlus className="mr-2 h-4 w-4 text-muted-foreground" />
           <span>Duplicate</span>
           <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>
        
        {hasSelection && (
          <>
             <ContextMenuSeparator />
             <ContextMenuItem onClick={() => { selectedIds.forEach(id => bringForward(id)) }}>
                <ArrowUp className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Bring Forward</span>
             </ContextMenuItem>
             <ContextMenuItem onClick={() => { selectedIds.forEach(id => bringToFrontAction(id)) }}>
                <BringToFront className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Bring to Front</span>
             </ContextMenuItem>
             <ContextMenuItem onClick={() => { selectedIds.forEach(id => sendBackward(id)) }}>
                <ArrowDown className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Send Backward</span>
             </ContextMenuItem>
             <ContextMenuItem onClick={() => { selectedIds.forEach(id => sendToBackAction(id)) }}>
                <SendToBack className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Send to Back</span>
             </ContextMenuItem>
          </>
        )}

        {(shouldShowGroupAction || hasSelection) && (
          <ContextMenuSeparator />
        )}

        {shouldShowGroupAction && (
          <ContextMenuItem onClick={handleGroupAction}>
            {isGroupActionUngroup ? <Ungroup className="mr-2 h-4 w-4 text-muted-foreground" /> : <Group className="mr-2 h-4 w-4 text-muted-foreground" />}
            <span>{isGroupActionUngroup ? 'Ungroup' : 'Group'}</span>
          </ContextMenuItem>
        )}

        {hasSelection && (
          <ContextMenuItem onClick={handleLockToggle}>
            {allLocked ? <Unlock className="mr-2 h-4 w-4 text-muted-foreground" /> : <Lock className="mr-2 h-4 w-4 text-muted-foreground" />}
            <span>{allLocked ? 'Unlock' : 'Lock'}</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem disabled={!hasSelection} onClick={() => deleteSelectedObjects()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
           <Trash2 className="mr-2 h-4 w-4" />
           <span>Delete</span>
           <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

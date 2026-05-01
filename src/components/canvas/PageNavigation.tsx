import React, { useState } from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { Button } from '@sabi-canvas/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@sabi-canvas/ui/dropdown-menu';
import { Plus, MoreVertical, Edit2, Copy, ArrowLeft, ArrowRight, Trash2, FileText } from 'lucide-react';
import { cn } from '@sabi-canvas/lib/utils';
import { Badge } from '@sabi-canvas/ui/badge';

export const PageNavigation: React.FC = () => {
  const {
    pages,
    activePageId,
    setActivePage,
    addPage,
    deletePage,
    renamePage,
    duplicatePage,
    reorderPage
  } = useCanvasObjects();

  const { editorMode, isMockupEnabled } = useEditor();
  const isCustomerMode = isMockupEnabled && editorMode === 'customer';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const safePages = Array.isArray(pages) ? pages : [];
  const sortedPages = [...safePages].sort((a, b) => a.order - b.order);

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renamePage(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleMenuItemClick = (
    e: React.MouseEvent,
    action: () => void
  ) => {
    e.stopPropagation();
    action();
  };

  return (
    <div className="flex items-center gap-2 z-10 p-1.5 bg-background/85 backdrop-blur border border-border shadow-sm rounded-xl overflow-x-auto max-w-[90vw] sm:max-w-[70vw] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {sortedPages.map((page, index) => (
        <div key={page.id} className="relative flex items-center group">
          <Badge
            variant={page.id === activePageId ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3.5 py-1.5 rounded-md border transition-all text-sm h-9 select-none flex items-center gap-1.5",
              page.id === activePageId 
                ? "bg-primary text-primary-foreground border-primary/70 shadow-sm" 
                : "bg-card/80 hover:bg-muted text-muted-foreground border-border"
            )}
            onClick={() => setActivePage(page.id)}
          >
            <FileText className="w-3.5 h-3.5 opacity-90" />
            {editingId === page.id ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRename(page.id)}
                onKeyDown={(e) => handleKeyDown(e, page.id)}
                className="bg-transparent border-none outline-none w-20 text-center focus:ring-0 text-primary-foreground placeholder:text-primary-foreground/50"
              />
            ) : (
              <span className="truncate max-w-[100px] font-medium">{page.name}</span>
            )}

            {(!editingId || editingId !== page.id) && !isCustomerMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    className="opacity-70 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 rounded-sm w-6 h-6 inline-flex items-center justify-center transition-all"
                    aria-label={`Page actions for ${page.name}`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-48"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem onClick={(e) => handleMenuItemClick(e, () => startEditing(page.id, page.name))}>
                    <Edit2 className="w-4 h-4 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => handleMenuItemClick(e, () => duplicatePage(page.id))}>
                    <Copy className="w-4 h-4 mr-2" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => handleMenuItemClick(e, () => reorderPage(page.id, 'left'))}
                    disabled={index === 0}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Move Left
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => handleMenuItemClick(e, () => reorderPage(page.id, 'right'))}
                    disabled={index === sortedPages.length - 1}
                  >
                    <ArrowRight className="w-4 h-4 mr-2" /> Move Right
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={(e) => handleMenuItemClick(e, () => deletePage(page.id))}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </Badge>
        </div>
      ))}

      {!isCustomerMode && (
        <Button
          variant="ghost"
          size="icon"
          className="rounded-md w-9 h-9 flex-shrink-0 bg-transparent hover:bg-muted border border-border"
          onClick={addPage}
          title="Add New Page"
        >
          <Plus className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};
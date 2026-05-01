import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@sabi-canvas/lib/utils';
import { ScrollArea, ScrollBar } from '@sabi-canvas/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@sabi-canvas/ui/sheet';
import { editorTools, EditorTool } from './shared/editorToolsConfig';
import { ToolPanelContent } from './shared/ToolPanels';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { SidebarPanelId } from '@sabi-canvas/types/editor';
import { useIsDesktop } from '@sabi-canvas/hooks/useMediaQuery';

interface BottomToolbarProps {
  className?: string;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({ className }) => {
  const isDesktop = useIsDesktop();
  const { activeToolPanel, toggleToolPanel, setActiveToolPanel, editorMode, isMockupEnabled } = useEditor();
  const activeTool = activeToolPanel;

  const isCustomerMode = isMockupEnabled && editorMode === 'customer';
  const CUSTOMER_HIDDEN_TOOLS = new Set(['background', 'resize']);
  const visibleTools = isCustomerMode
    ? editorTools.filter((t) => !CUSTOMER_HIDDEN_TOOLS.has(t.id))
    : editorTools;

  // Close restricted panels if they are open when entering customer mode
  useEffect(() => {
    if (isCustomerMode && activeTool && CUSTOMER_HIDDEN_TOOLS.has(activeTool)) {
      setActiveToolPanel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomerMode]);

  const handleToolClick = (tool: EditorTool) => {
    if (tool.hasPanel) {
      toggleToolPanel(tool.id as SidebarPanelId);
    }
  };

  const closePanel = () => setActiveToolPanel(null);

  const getPanelTitle = () => {
    const tool = editorTools.find(t => t.id === activeTool);
    return tool?.label || '';
  };

  return (
    <>
      {/* Bottom Toolbar */}
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[150]',
          'h-16 pb-safe',
          'bg-card border-t border-panel-border',
          'shadow-editor-lg',
          'lg:hidden',
          className
        )}
      >
        <ScrollArea className="w-full h-full">
          <div className="flex items-center gap-1 px-2 h-full min-w-max">
            {visibleTools.map((tool) => {
              const isActive = tool.id === activeTool;

              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className={cn(
                    'flex flex-col items-center justify-center',
                    'min-w-[64px] h-14 px-2 gap-0.5 rounded-lg',
                    'transition-colors duration-200',
                    'active:scale-95',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    {tool.icon}
                  </motion.div>
                  <span className={cn(
                    'text-[10px] font-medium',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {tool.label}
                  </span>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </motion.div>

      {/* Tool Panel Sheet */}
      <Sheet open={!!activeTool && !isDesktop} onOpenChange={(open) => !open && closePanel()}>
        <SheetContent
          side="bottom"
          className="h-[60vh] rounded-t-2xl px-0 flex flex-col"
        >
          <SheetHeader className="flex-shrink-0 px-4 pb-2 border-b border-border">
            <SheetTitle className="text-left">{getPanelTitle()}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 py-0">
            <ToolPanelContent activeTool={activeTool} onClose={closePanel} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BottomToolbar;

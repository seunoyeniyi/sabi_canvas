import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@sabi-canvas/lib/utils';
import { ScrollArea, ScrollBar } from '@sabi-canvas/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@sabi-canvas/ui/sheet';
import { useEditorTools, CUSTOMER_HIDDEN_TOOLS, type ToolbarTool } from './shared/useEditorTools';
import { ToolPanelContent } from './shared/ToolPanels';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { SidebarPanelId } from '@sabi-canvas/types/editor';
import { useIsDesktop } from '@sabi-canvas/hooks/useMediaQuery';

/** Default height of the phone/tablet tool panel sheet. */
export const DEFAULT_MOBILE_TOOL_PANEL_HEIGHT = '85dvh';

interface BottomToolbarProps {
  className?: string;
  /** Height of the tool panel sheet on phones and tablets, as any CSS length. */
  panelHeight?: string;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({ className, panelHeight = DEFAULT_MOBILE_TOOL_PANEL_HEIGHT }) => {
  const isDesktop = useIsDesktop();
  const { activeToolPanel, toggleToolPanel, setActiveToolPanel, editorMode, isMockupEnabled } = useEditor();
  const activeTool = activeToolPanel;

  const isCustomerMode = isMockupEnabled && editorMode === 'customer';
  // Built-in tools (less those a customer doesn't get) and the host's own
  const { tools: visibleTools, find: findTool } = useEditorTools();

  // Close restricted panels if they are open when entering customer mode
  useEffect(() => {
    if (isCustomerMode && activeTool && CUSTOMER_HIDDEN_TOOLS.has(activeTool)) {
      setActiveToolPanel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomerMode]);

  const handleToolClick = (tool: ToolbarTool) => {
    if (tool.hasPanel) {
      toggleToolPanel(tool.id as SidebarPanelId);
    }
  };

  const closePanel = () => setActiveToolPanel(null);

  const getPanelTitle = () => findTool(activeTool)?.title || '';

  return (
    <>
      {/* Bottom Toolbar */}
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-150',
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
          className="rounded-t-2xl px-0 flex flex-col"
          style={{ height: panelHeight }}
        >
          <SheetHeader className="shrink-0 px-4 pb-2 border-b border-border">
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

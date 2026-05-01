import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import { Separator } from '@sabi-canvas/ui/separator';
import { cn } from '@sabi-canvas/lib/utils';
import { editorTools, EditorTool } from './shared/editorToolsConfig';
import { ToolPanelContent } from './shared/ToolPanels';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { SidebarPanelId } from '@sabi-canvas/types/editor';
import { useIsDesktop } from '@sabi-canvas/hooks/useMediaQuery';

interface DesktopToolbarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export const DesktopToolbar: React.FC<DesktopToolbarProps> = ({
  collapsed = false,
  onCollapsedChange,
  className,
}) => {
  const { activeToolPanel, toggleToolPanel, setActiveToolPanel, editorMode, isMockupEnabled } = useEditor();
  const isDesktop = useIsDesktop();
  const activeTool = isDesktop ? activeToolPanel : null;

  const isCustomerMode = isMockupEnabled && editorMode === 'customer';
  // Tools that are not available to customers
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

  return (
    <div className={cn('hidden lg:flex flex-row items-start gap-1 h-full', className)}>
      {/* Toolbar column */}
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 56 : 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'flex bg-card border border-panel-border rounded-xl',
          'shadow-editor-md',
          'flex-col',
          'p-2 gap-2 overflow-hidden h-fit'
        )}
      >
        {/* Tool Buttons */}
        <div className="flex flex-col gap-1 items-center">
          {visibleTools.map((tool) => (
            <ToolbarButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              shortcut={tool.shortcut}
              isActive={activeTool === tool.id}
              onClick={() => handleToolClick(tool)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Collapse Toggle */}
        {onCollapsedChange && (
          <>
            <Separator className="my-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCollapsedChange(!collapsed)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover mx-auto"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </motion.div>

      {/* Inline Panel */}
      <AnimatePresence mode="wait">
        {activeTool && (
          <motion.div
            key={activeTool}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.1 }}
            className="flex flex-col bg-card border border-panel-border rounded-xl shadow-editor-md p-3 w-[260px] h-full"
          >
            <h4 className="font-medium text-sm mb-2 shrink-0">
              {editorTools.find((t) => t.id === activeTool)?.label}
            </h4>
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <ToolPanelContent activeTool={activeTool} onClose={closePanel} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
  collapsed?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon,
  label,
  shortcut,
  isActive,
  onClick,
  disabled,
  collapsed,
}) => {
  return (
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'relative flex flex-col items-center justify-center gap-1',
            collapsed ? 'h-10 w-10' : 'h-[60px] w-[64px]',
            'rounded-lg',
            'transition-colors duration-200',
            isActive
              ? 'bg-primary/10 text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-toolbar-hover hover:text-foreground',
            disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          <div className="flex items-center justify-center">
            {icon}
          </div>

          {!collapsed && (
            <span className="text-[10px] pb-0.5 font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
              {label}
            </span>
          )}

          {/* Active indicator line replacing the dot */}
          {isActive && collapsed && (
            <motion.div
              layoutId="toolIndicator"
              className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-accent"
            />
          )}

          {isActive && !collapsed && (
            <motion.div
              layoutId="toolIndicatorExpanded"
              className="absolute left-6 -bottom-0 w-4 h-0.5 rounded-full bg-primary"
            />
          )}
        </motion.button>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="flex items-center gap-2">
          <span>{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono">
              {shortcut}
            </kbd>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

export default DesktopToolbar;

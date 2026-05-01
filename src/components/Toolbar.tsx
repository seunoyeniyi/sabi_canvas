import React from 'react';
import { motion } from 'framer-motion';
import { 
  MousePointer2, 
  Type, 
  Square, 
  Circle, 
  Image, 
  Layers, 
  Hand,
  Pen,
  Eraser,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ToolbarProps, ToolItem } from '@sabi-canvas/types/editor';
import { Button } from '@sabi-canvas/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import { Separator } from '@sabi-canvas/ui/separator';
import { cn } from '@sabi-canvas/lib/utils';

// Default tools for the editor
export const defaultTools: ToolItem[] = [
  { id: 'select', icon: <MousePointer2 className="h-5 w-5" />, label: 'Select', shortcut: 'V', group: 'select' },
  { id: 'hand', icon: <Hand className="h-5 w-5" />, label: 'Hand Tool', shortcut: 'H', group: 'select' },
  { id: 'text', icon: <Type className="h-5 w-5" />, label: 'Text', shortcut: 'T', group: 'create' },
  { id: 'rectangle', icon: <Square className="h-5 w-5" />, label: 'Rectangle', shortcut: 'R', group: 'shapes' },
  { id: 'ellipse', icon: <Circle className="h-5 w-5" />, label: 'Ellipse', shortcut: 'O', group: 'shapes' },
  { id: 'pen', icon: <Pen className="h-5 w-5" />, label: 'Pen Tool', shortcut: 'P', group: 'draw' },
  { id: 'eraser', icon: <Eraser className="h-5 w-5" />, label: 'Eraser', shortcut: 'E', group: 'draw' },
  { id: 'image', icon: <Image className="h-5 w-5" />, label: 'Image', shortcut: 'I', group: 'media' },
  { id: 'layers', icon: <Layers className="h-5 w-5" />, label: 'Layers', shortcut: 'L', group: 'organize' },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  tools = defaultTools,
  activeToolId,
  onToolSelect,
  orientation = 'vertical',
  collapsed = false,
  onCollapsedChange,
  className,
}) => {
  const isVertical = orientation === 'vertical';

  // Group tools by their group property
  const groupedTools = tools.reduce((acc, tool) => {
    const group = tool.group || 'default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(tool);
    return acc;
  }, {} as Record<string, ToolItem[]>);

  const groups = Object.entries(groupedTools);

  return (
    <motion.div
      initial={false}
      animate={{ 
        width: isVertical ? (collapsed ? 48 : 56) : 'auto',
        height: isVertical ? 'auto' : 48,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'hidden md:flex bg-card border border-panel-border rounded-xl',
        'shadow-editor-md',
        isVertical ? 'flex-col' : 'flex-row items-center',
        'p-1.5 gap-1',
        className
      )}
    >
      {groups.map(([groupName, groupTools], groupIndex) => (
        <React.Fragment key={groupName}>
          {groupIndex > 0 && (
            <Separator 
              orientation={isVertical ? 'horizontal' : 'vertical'} 
              className={cn(
                isVertical ? 'my-1' : 'mx-1 h-6'
              )}
            />
          )}
          
          <div className={cn(
            'flex gap-1',
            isVertical ? 'flex-col' : 'flex-row'
          )}>
            {groupTools.map((tool) => (
              <ToolbarButton
                key={tool.id}
                tool={tool}
                isActive={tool.id === activeToolId}
                onClick={() => onToolSelect(tool.id)}
              />
            ))}
          </div>
        </React.Fragment>
      ))}

      {/* Collapse Toggle */}
      {onCollapsedChange && isVertical && (
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
  );
};

interface ToolbarButtonProps {
  tool: ToolItem;
  isActive: boolean;
  onClick: () => void;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  tool,
  isActive,
  onClick,
}) => {
  return (
    <Tooltip delayDuration={50}>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          disabled={tool.disabled}
          className={cn(
            'relative flex items-center justify-center',
            'h-10 w-10 rounded-lg',
            'transition-colors duration-200',
            isActive 
              ? 'bg-primary text-primary-foreground shadow-md' 
              : 'text-muted-foreground hover:bg-toolbar-hover hover:text-foreground',
            tool.disabled && 'opacity-40 cursor-not-allowed'
          )}
        >
          {tool.icon}
          
          {/* Active indicator dot */}
          {isActive && (
            <motion.div
              layoutId="toolIndicator"
              className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-accent"
            />
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        <span>{tool.label}</span>
        {tool.shortcut && (
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono">
            {tool.shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default Toolbar;

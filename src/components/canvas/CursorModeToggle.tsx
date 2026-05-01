import React from 'react';
import { MousePointer2, Hand } from 'lucide-react';
import { InteractionMode } from '@sabi-canvas/types/editor';
import { Button } from '@sabi-canvas/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import { cn } from '@sabi-canvas/lib/utils';

interface CursorModeToggleProps {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  className?: string;
}

export const CursorModeToggle: React.FC<CursorModeToggleProps> = ({
  mode,
  onModeChange,
  className,
}) => {
  return (
    <div className={cn(
      'flex items-center gap-1 p-1 rounded-lg bg-card border border-panel-border shadow-editor-sm',
      className
    )}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onModeChange('select')}
            className={cn(
              'h-8 w-8',
              mode === 'select'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground hover:text-foreground hover:bg-toolbar-hover'
            )}
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>Select Tool (V)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onModeChange('pan')}
            className={cn(
              'h-8 w-8',
              mode === 'pan'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-muted-foreground hover:text-foreground hover:bg-toolbar-hover'
            )}
          >
            <Hand className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>Hand Tool (H)</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default CursorModeToggle;

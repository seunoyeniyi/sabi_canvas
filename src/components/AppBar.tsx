import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Menu,
  Undo2,
  Redo2,
  Settings,
  User,
  ChevronDown,
  Sun,
  Moon,
  MoreHorizontal,
  Share2,
  FileBox
} from 'lucide-react';
import { AppBarProps } from '@sabi-canvas/types/editor';
import { Button } from '@sabi-canvas/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sabi-canvas/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@sabi-canvas/ui/dropdown-menu';
import { cn } from '@sabi-canvas/lib/utils';
import { useIsMobile } from '@sabi-canvas/hooks/useMediaQuery';
import { useTheme } from '@sabi-canvas/providers/theme-provider';

export const AppBar: React.FC<AppBarProps> = ({
  logo,
  title = 'Untitled Design',
  onTitleChange,
  onMenuToggle,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  actions = [],
  centerContent,
  className,
  hideTitle = false,
}) => {
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingTitle) {
      setEditValue(title);
    }
  }, [title, isEditingTitle]);

  const handleTitleClick = () => {
    setEditValue(title);
    setIsEditingTitle(true);
    // Focus happens via autoFocus on the input
  };

  const commitTitle = () => {
    const trimmed = editValue.trim() || 'Untitled Design';
    setIsEditingTitle(false);
    onTitleChange?.(trimmed);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditValue(title);
    }
  };

  // Helper to find specific actions
  const downloadAction = actions.find(a => a.id === 'download');
  const shareAction = actions.find(a => a.id === 'share');
  const devActions = actions.filter(a => a.id.includes('json-dev'));
  const otherActions = actions.filter(a =>
    a.id !== 'download' &&
    a.id !== 'share' &&
    !a.id.includes('json-dev')
  );

  return (
    <motion.header
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      className={cn(
        'sticky top-0 z-50 h-14 px-3 md:px-4',
        'flex items-center justify-between gap-2',
        'bg-card border-b border-panel-border',
        'shadow-editor-sm',
        className
      )}
    >
      {/* Left Section: Menu + Logo */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {logo || (<></>)}

        {/* Title - editable inline */}
        {!hideTitle && (
          isEditingTitle ? (
            <input
              ref={inputRef}
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="font-medium text-sm px-2 py-1 rounded-md bg-toolbar-hover border border-input outline-none focus:ring-1 focus:ring-ring min-w-0 w-[120px] md:w-[200px] text-foreground"
              maxLength={80}
            />
          ) : (
            <button
              onClick={handleTitleClick}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-toolbar-hover cursor-pointer transition-colors min-w-0"
            >
              <span className="font-medium text-sm truncate max-w-[120px] md:max-w-[200px]">
                {title}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            </button>
          )
        )}
      </div>

      {/* Center Section: Optional content (e.g. mode toggle) */}
      {centerContent && (
        <div className="flex items-center justify-center flex-shrink-0">
          {centerContent}
        </div>
      )}

      {/* Right Section: Actions */}
      <div className="flex items-center gap-1">
        {/* Undo/Redo - Always visible */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover disabled:opacity-40"
              >
                <Undo2 className="h-4.5 w-4.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (⌘Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover disabled:opacity-40"
              >
                <Redo2 className="h-4.5 w-4.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
          </Tooltip>
        </div>

        {/* Action Rendering Logic */}
        {!isMobile ? (
          /* DESKTOP VIEW */
          <>
            {/* Standard Desktop Actions */}
            {downloadAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={downloadAction.onClick}
                    disabled={downloadAction.disabled}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
                  >
                    {downloadAction.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{downloadAction.label}</TooltipContent>
              </Tooltip>
            )}

            {shareAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={shareAction.onClick}
                    disabled={shareAction.disabled}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
                  >
                    {shareAction.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{shareAction.label}</TooltipContent>
              </Tooltip>
            )}

            {/* Combined JSON Dev Actions */}
            {devActions.length > 0 && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover data-[state=open]:bg-toolbar-hover"
                      >
                        <FileBox className="h-4.5 w-4.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>JSON Dev Tools</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Developer Tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {devActions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="gap-2"
                    >
                      <span className="opacity-70">{action.icon}</span>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Any other miscellaneous actions */}
            {otherActions.map((action) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{action.label}</TooltipContent>
              </Tooltip>
            ))}

            {/* Desktop Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
                >
                  <Settings className="h-4.5 w-4.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </>
        ) : (
          /* MOBILE VIEW */
          <>
            {/* Show only Download on mobile initially */}
            {downloadAction && (
              <Button
                variant="ghost"
                size="icon"
                onClick={downloadAction.onClick}
                disabled={downloadAction.disabled}
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
              >
                {downloadAction.icon}
              </Button>
            )}

            {/* Mobile "More" Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {shareAction && (
                  <DropdownMenuItem onClick={shareAction.onClick} className="gap-2">
                    <Share2 className="h-4 w-4 opacity-70" />
                    Share Project
                  </DropdownMenuItem>
                )}

                {devActions.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>JSON Dev Tools</DropdownMenuLabel>
                    {devActions.map((action) => (
                      <DropdownMenuItem
                        key={action.id}
                        onClick={action.onClick}
                        disabled={action.disabled}
                        className="gap-2"
                      >
                        <span className="opacity-70">{action.icon}</span>
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}

                <DropdownMenuSeparator />

                {/* Theme Toggle (Mobile) */}
                <DropdownMenuItem
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="gap-2"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  Toggle Theme
                </DropdownMenuItem>

                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4 opacity-70" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Theme Toggle (Desktop Only as a standalone button) */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-toolbar-hover"
          >
            <Sun className="h-4.5 w-4.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4.5 w-4.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        )}

        {/* User Avatar - Desktop Only */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 ml-1 rounded-full bg-gradient-to-br from-tool-blue to-tool-purple text-white hover:opacity-90"
          >
            <User className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.header>
  );
};

export default AppBar;


import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, FolderOpen, Image, Settings, HelpCircle, Star } from 'lucide-react';
import { EditorDrawerProps, SidebarPanelId } from '@sabi-canvas/types/editor';
import type { Project } from '@sabi-canvas/types/project';
import { Button } from '@sabi-canvas/ui/button';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Separator } from '@sabi-canvas/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@sabi-canvas/ui/sheet';
import { cn } from '@sabi-canvas/lib/utils';
import { useIsDesktop } from '@sabi-canvas/hooks/useMediaQuery';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { ProjectsPanel } from './panels/ProjectsPanel';

interface DrawerMenuItem {
  id: SidebarPanelId;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  hasPanel?: boolean;
}

// Sidebar items are for project/app navigation, NOT editor tools
const menuItems: DrawerMenuItem[] = [
  { id: 'home', icon: <Home className="h-5 w-5" />, label: 'Home', hasPanel: true },
  { id: 'projects', icon: <FolderOpen className="h-5 w-5" />, label: 'My Projects', hasPanel: true },
  { id: 'uploads', icon: <Image className="h-5 w-5" />, label: 'Uploads', hasPanel: true },
  { id: 'favorites', icon: <Star className="h-5 w-5" />, label: 'Favorites', hasPanel: true },
];

const bottomMenuItems: DrawerMenuItem[] = [
  { id: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Settings', hasPanel: true },
  { id: 'help', icon: <HelpCircle className="h-5 w-5" />, label: 'Help & Support', hasPanel: true },
];

export const EditorDrawer: React.FC<EditorDrawerProps> = ({
  isOpen,
  onClose,
  side = 'left',
  children,
  className,
  logo,
  title = 'Sabi Canvas',
  onOpenProject,
  onNewProject,
  externalProjects,
  isLoadingProjects,
  onDeleteProject,
  onRefreshProjects,
  onSelectProject,
}) => {
  const isDesktop = useIsDesktop();
  const { activeSidebarPanel, setActiveSidebarPanel } = useEditor();
  const [lastDesktopPanel, setLastDesktopPanel] = useState<Exclude<SidebarPanelId, null> | null>(null);
  const wasDesktopDrawerOpenRef = useRef(false);

  useEffect(() => {
    if (!isDesktop) {
      wasDesktopDrawerOpenRef.current = false;
      return;
    }

    const justOpened = isOpen && !wasDesktopDrawerOpenRef.current;

    if (justOpened && !activeSidebarPanel && lastDesktopPanel) {
      setActiveSidebarPanel(lastDesktopPanel);
    }

    if (activeSidebarPanel) {
      setLastDesktopPanel(activeSidebarPanel);
    }

    wasDesktopDrawerOpenRef.current = isOpen;
  }, [isDesktop, isOpen, activeSidebarPanel, lastDesktopPanel, setActiveSidebarPanel]);

  const handleItemClick = (item: DrawerMenuItem) => {
    if (item.hasPanel) {
      setActiveSidebarPanel(item.id);
      if (isDesktop) {
        setLastDesktopPanel(item.id as Exclude<SidebarPanelId, null>);
      }
      if (!isDesktop) {
        onClose();
      }
    }
  };

  const renderPanelContent = () => {
    switch (activeSidebarPanel) {
      case 'home':
        return <PlaceholderPanel title="Home" description="Welcome to the editor" />;
      case 'projects':
        return (
          <ProjectsPanel
            onOpenProject={(project: Project) => {
              onOpenProject?.(project);
            }}
            onNewProject={() => {
              onNewProject?.();
            }}
            externalProjects={externalProjects}
            isLoading={isLoadingProjects}
            onDeleteProject={onDeleteProject}
            onRefresh={onRefreshProjects}
            onSelectProject={onSelectProject ? (project: Project) => {
              onSelectProject(project);
            } : undefined}
          />
        );
      case 'uploads':
        return <PlaceholderPanel title="Uploads" description="Your uploaded files" />;
      case 'favorites':
        return <PlaceholderPanel title="Favorites" description="Your favorite designs" />;
      case 'settings':
        return <PlaceholderPanel title="Settings" description="Editor preferences" />;
      case 'help':
        return <PlaceholderPanel title="Help & Support" description="Get help with the editor" />;
      default:
        return null;
    }
  };

  const activePanelLabel =
    menuItems.find((i) => i.id === activeSidebarPanel)?.label ||
    bottomMenuItems.find((i) => i.id === activeSidebarPanel)?.label ||
    '';

  // Menu-triggered drawer on all viewports; panel content is rendered separately.
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            {!isDesktop && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[160] bg-background/80 backdrop-blur-sm"
              />
            )}

            {/* Drawer Panel */}
            <motion.aside
              initial={{ x: side === 'left' ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: side === 'left' ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed top-0 z-[165] h-full w-[min(22rem,90vw)]',
                'flex flex-col bg-card shadow-editor-lg',
                side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
                'border-panel-border',
                className
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between h-14 px-4 border-b border-panel-border">
                <div className="flex items-center gap-3">
                  {logo ?? (
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary-foreground">SC</span>
                    </div>
                  )}
                  <span className="font-semibold">{title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1">
                <div className="py-3">
                  {menuItems.map((item) => (
                    <DrawerItem
                      key={item.id}
                      item={item}
                      collapsed={false}
                      isActive={activeSidebarPanel === item.id}
                      onClick={() => handleItemClick(item)}
                    />
                  ))}

                  {children && (
                    <>
                      <Separator className="my-3" />
                      {children}
                    </>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="border-t border-panel-border py-3">
                {bottomMenuItems.map((item) => (
                  <DrawerItem
                    key={item.id}
                    item={item}
                    collapsed={false}
                    isActive={activeSidebarPanel === item.id}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
              </div>
            </motion.aside>

            {/* Desktop: panel replaces the right-side backdrop area */}
            <AnimatePresence>
              {isDesktop && (
                <motion.section
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="fixed top-0 left-[min(22rem,90vw)] right-0 z-[164] h-full bg-card border-l border-panel-border shadow-editor-lg"
                >
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between h-14 px-4 border-b border-panel-border">
                      <h3 className="font-semibold text-sm">
                        {activeSidebarPanel ? activePanelLabel : 'Select a menu item'}
                      </h3>
                      {activeSidebarPanel && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setActiveSidebarPanel(null)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {activeSidebarPanel ? (
                        renderPanelContent()
                      ) : (
                        <DesktopPanelPlaceholder />
                      )}
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>

      {/* Mobile/tablet: sidebar panels open as bottom sheet */}
      <Sheet
        open={!isDesktop && !!activeSidebarPanel}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSidebarPanel(null);
          }
        }}
      >
        <SheetContent side="bottom" className="h-[70vh] !gap-y-0 rounded-t-2xl px-0 flex flex-col">
          <SheetHeader className="flex-shrink-0 px-4 pb-2 border-b border-border">
            <SheetTitle className="text-left">{activePanelLabel}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{renderPanelContent()}</div>
        </SheetContent>
      </Sheet>
    </>
  );
};

interface DrawerItemProps {
  item: DrawerMenuItem;
  collapsed: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

const DrawerItem: React.FC<DrawerItemProps> = ({
  item,
  collapsed,
  isActive = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex transition-colors duration-200 hover:bg-toolbar-hover relative',
        collapsed
          ? 'flex-col items-center justify-center py-2 h-16 gap-1'
          : 'flex-row items-center gap-3 px-4 py-3',
        isActive && 'bg-primary/5 text-primary',
        !isActive && 'text-muted-foreground hover:text-foreground'
      )}
    >
      <span className={cn(
        'flex-shrink-0',
        isActive ? 'text-primary' : 'text-muted-foreground'
      )}>
        {item.icon}
      </span>

      {collapsed ? (
        <span className="text-[10px] font-medium leading-none whitespace-nowrap overflow-hidden text-ellipsis max-w-[56px]">
          {item.label}
        </span>
      ) : (
        <span className="flex-1 text-sm font-medium truncate text-left">
          {item.label}
        </span>
      )}

      {!collapsed && item.badge && (
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {item.badge}
        </span>
      )}

      {/* Active Indicator line for collapsed mode */}
      {isActive && collapsed && (
        <motion.div
          layoutId="drawerIndicator"
          className="absolute left-0 top-1/4 bottom-1/4 w-0.5 rounded-r-full bg-primary"
        />
      )}
    </button>
  );
};

// Placeholder panel for items without specific content yet
const PlaceholderPanel: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="p-4">
    <p className="text-sm text-muted-foreground">{description}</p>
    <p className="text-xs text-muted-foreground/60 mt-2">Panel content coming soon...</p>
  </div>
);

const DesktopPanelPlaceholder: React.FC = () => (
  <div className="h-full flex flex-col items-center justify-center text-center px-6">
    <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
    <p className="mt-4 text-sm font-medium text-foreground">Choose a section from the left menu</p>
    <p className="mt-1 text-xs text-muted-foreground">Select an item to open its panel here.</p>
  </div>
);

export default EditorDrawer;

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, FolderOpen, Image, Settings, HelpCircle, Star } from 'lucide-react';
import { EditorDrawerProps, SidebarPanelId } from '@sabi-canvas/types/editor';
import type { Project } from '@sabi-canvas/types/project';
import { Button } from '@sabi-canvas/ui/button';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Separator } from '@sabi-canvas/ui/separator';
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
  onOpenProject,
  onNewProject,
  externalProjects,
  isLoadingProjects,
  onDeleteProject,
  onRefreshProjects,
  onSelectProject,
}) => {
  const isDesktop = useIsDesktop();
  const { activeSidebarPanel, toggleSidebarPanel } = useEditor();

  const handleItemClick = (item: DrawerMenuItem) => {
    if (item.hasPanel) {
      toggleSidebarPanel(item.id);
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
              toggleSidebarPanel('projects');
            }}
            onNewProject={() => {
              onNewProject?.();
              toggleSidebarPanel('projects');
            }}
            externalProjects={externalProjects}
            isLoading={isLoadingProjects}
            onDeleteProject={onDeleteProject}
            onRefresh={onRefreshProjects}
            onSelectProject={onSelectProject ? (project: Project) => {
              onSelectProject(project);
              toggleSidebarPanel('projects');
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

  // On desktop, show persistent mini drawer with expandable panel
  if (isDesktop) {
    return (
      <div className="flex max-lg:hidden h-full">
        {/* Icon sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: 72 }}
          className={cn(
            'flex flex-col',
            'h-full bg-card border-r border-panel-border z-20',
            'overflow-hidden',
            className
          )}
        >
          <ScrollArea className="flex-1">
            <div className="py-3">
              {menuItems.map((item) => (
                <DrawerItem
                  key={item.id}
                  item={item}
                  collapsed={true}
                  isActive={activeSidebarPanel === item.id}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          </ScrollArea>

          <div className="border-t border-panel-border py-3">
            {bottomMenuItems.map((item) => (
              <DrawerItem
                key={item.id}
                item={item}
                collapsed={true}
                isActive={activeSidebarPanel === item.id}
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        </motion.aside>

        {/* Expandable panel */}
        <AnimatePresence>
          {activeSidebarPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="h-full bg-card border-r border-panel-border overflow-hidden"
            >
              <div className="w-[280px] h-full flex flex-col">
                <div className="flex items-center justify-between h-12 px-4 border-b border-panel-border">
                  <h3 className="font-semibold text-sm">
                    {menuItems.find(i => i.id === activeSidebarPanel)?.label ||
                      bottomMenuItems.find(i => i.id === activeSidebarPanel)?.label}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleSidebarPanel(activeSidebarPanel)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  {renderPanelContent()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // On mobile/tablet, show overlay drawer
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[160] bg-background/80 backdrop-blur-sm lg:hidden"
          />

          {/* Drawer Panel */}
          <motion.aside
            initial={{ x: side === 'left' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'left' ? '-100%' : '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'fixed top-0 z-[165] h-full w-72',
              'flex flex-col bg-card shadow-editor-lg',
              side === 'left' ? 'left-0 border-r' : 'right-0 border-l',
              'border-panel-border',
              'lg:hidden',
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between h-14 px-4 border-b border-panel-border">
              <div className="flex items-center gap-3">
                <img src="/app-icon.png" alt="Logo" className="h-8 w-8" />
                <span className="font-semibold">Sabi Canvas</span>
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
        </>
      )}
    </AnimatePresence>
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

export default EditorDrawer;

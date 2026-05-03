import React, { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Plus, Trash2, Pencil, Loader2, RefreshCw } from 'lucide-react';
import { Project } from '@sabi-canvas/types/project';
import { deleteProject, loadAllProjects } from '@sabi-canvas/hooks/useProjectManager';
import { Button } from '@sabi-canvas/ui/button';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { cn } from '@sabi-canvas/lib/utils';

interface ProjectsPanelProps {
  onOpenProject?: (project: Project) => void;
  onNewProject?: () => void;
  /**
   * External projects list. When provided, the panel renders these instead of
   * reading from localStorage — enabling database-backed or API-driven lists.
   * Pass an empty array while the host is loading data.
   */
  externalProjects?: Project[];
  /** Show a loading skeleton while the external list is being fetched. */
  isLoading?: boolean;
  /**
   * Delete handler for external mode. Called when the user confirms deletion.
   * The host app is responsible for removing the item from `externalProjects`.
   */
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  /**
   * Called once on mount (and via the refresh button) to trigger a re-fetch.
   * Only relevant when `externalProjects` is provided.
   */
  onRefresh?: () => void;
  /**
   * When provided, clicking a project calls this instead of `onOpenProject`.
   * Use it to navigate to a different design from the host application rather
   * than loading it into the current canvas.
   */
  onSelectProject?: (project: Project) => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const delta = Date.now() - timestamp;
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export const ProjectsPanel: React.FC<ProjectsPanelProps> = ({
  onOpenProject,
  onNewProject,
  externalProjects,
  isLoading = false,
  onDeleteProject,
  onRefresh,
  onSelectProject,
}) => {
  const isExternal = externalProjects !== undefined;

  // Local state only used in localStorage mode
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    if (!isExternal) {
      setLocalProjects(loadAllProjects());
    }
  }, [isExternal]);

  useEffect(() => {
    if (isExternal) {
      onRefresh?.();
    } else {
      refreshLocal();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExternal]);

  const displayProjects = isExternal ? externalProjects : localProjects;

  const handleOpen = (project: Project) => {
    if (onSelectProject) {
      onSelectProject(project);
    } else {
      onOpenProject?.(project);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    setConfirmDeleteId(null);

    if (isExternal && onDeleteProject) {
      setDeletingId(id);
      try {
        await onDeleteProject(id);
      } finally {
        setDeletingId(null);
      }
    } else {
      deleteProject(id);
      refreshLocal();
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* New Project Button */}
      <div className="px-3 py-3 border-b border-panel-border flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 text-sm"
          onClick={onNewProject}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
        {isExternal && onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={onRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          </div>
        ) : displayProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {isExternal
                ? 'No designs found. Create one to get started.'
                : 'No saved projects yet. Start creating and your work will be saved automatically.'}
            </p>
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-2">
            {displayProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isConfirmingDelete={confirmDeleteId === project.id}
                isDeleting={deletingId === project.id}
                onOpen={() => handleOpen(project)}
                onDelete={(e) => {
                  e.stopPropagation();
                  handleDelete(project.id);
                }}
                onCancelDelete={cancelDelete}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

interface ProjectCardProps {
  project: Project;
  isConfirmingDelete: boolean;
  isDeleting: boolean;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onCancelDelete: (e: React.MouseEvent) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isConfirmingDelete,
  isDeleting,
  onOpen,
  onDelete,
  onCancelDelete,
}) => {
  const pageCount = project.pages.length;
  const objectCount = project.pages.reduce((sum, p) => sum + p.objects.length, 0);

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-panel-border bg-card overflow-hidden',
        'hover:border-ring/50 transition-colors cursor-pointer',
        isDeleting && 'opacity-50 pointer-events-none'
      )}
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div className="w-full aspect-video bg-muted/30 overflow-hidden flex items-center justify-center">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-foreground">{project.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatRelativeTime(project.updatedAt)}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex items-center gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isConfirmingDelete ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onDelete}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={onCancelDelete}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                title="Open project"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                title="Delete project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

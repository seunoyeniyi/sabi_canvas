import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Image, LayoutGrid, Loader2, Plus, RefreshCw, ChevronRight, Zap, Play, Layers } from 'lucide-react';
import { Button } from '@sabi-canvas/ui/button';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { cn } from '@sabi-canvas/lib/utils';
import { useRecentUploads } from '@sabi-canvas/hooks/useRecentUploads';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
import { loadAllProjects } from '@sabi-canvas/hooks/useProjectManager';
import type { Project } from '@sabi-canvas/types/project';

interface HomePanelProps {
    onNewProject?: () => void;
    onOpenProjectsPanel?: () => void;
    onOpenUploadsPanel?: () => void;
    onOpenProject?: (project: Project) => void;
    onSelectProject?: (project: Project) => void;
    externalProjects?: Project[];
    isLoadingProjects?: boolean;
    onRefreshProjects?: () => void;
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

export const HomePanel: React.FC<HomePanelProps> = ({
    onNewProject,
    onOpenProjectsPanel,
    onOpenUploadsPanel,
    onOpenProject,
    onSelectProject,
    externalProjects,
    isLoadingProjects = false,
    onRefreshProjects,
}) => {
    const { uploads, isLoadingUploads } = useRecentUploads();
    const { listRecentUploads, disableRecentUploadsLocalStorage } = useSabiCanvasConfig();

    // When no externalProjects are provided, load from localStorage
    const isExternal = externalProjects !== undefined;
    const [localProjects, setLocalProjects] = useState<Project[]>([]);

    useEffect(() => {
        if (!isExternal) {
            setLocalProjects(loadAllProjects());
        }
    }, [isExternal]);

    const recentProjects = useMemo(() => {
        const list = isExternal ? externalProjects : localProjects;
        return [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
    }, [isExternal, externalProjects, localProjects]);

    const projectCount = isExternal ? externalProjects.length : localProjects.length;

    useEffect(() => {
        if (isExternal) {
            onRefreshProjects?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExternal]);

    const backendConnected = Boolean(externalProjects !== undefined && listRecentUploads);
    const uploadsSourceLabel = listRecentUploads
        ? 'Synced from backend'
        : disableRecentUploadsLocalStorage
            ? 'Adapter not configured'
            : 'Saved in browser';

    const handleOpenProject = (project: Project) => {
        if (onSelectProject) {
            onSelectProject(project);
            return;
        }
        onOpenProject?.(project);
    };

    return (
        <div className="h-full flex flex-col bg-background/50">
            {/* Hero Section */}
            <div className="px-4 py-4 border-b border-border/50">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-end">
                        <div className="flex items-center gap-2">
                            {onRefreshProjects && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="px-3 text-muted-foreground hover:text-foreground"
                                    onClick={onRefreshProjects}
                                    title="Refresh dashboard"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", isLoadingProjects && "animate-spin")} />
                                </Button>
                            )}
                            <Button
                                className="w-full gap-2 font-semibold shadow-sm active:scale-[0.98] transition-transform"
                                onClick={onNewProject}
                                size="sm"
                            >
                                <Plus className="h-4 w-4" />
                                Create New Design
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">

                    {/* Quick Metrics & Links */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={onOpenProjectsPanel}
                            className="flex-1 flex items-center justify-between py-2 px-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors group text-left"
                        >
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Designs</span>
                            </div>
                            <span className="text-sm font-bold">{projectCount}</span>
                        </button>

                        <button
                            onClick={onOpenUploadsPanel}
                            className="flex-1 flex items-center justify-between py-2 px-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors group text-left"
                        >
                            <div className="flex items-center gap-2">
                                <Image className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">Assets</span>
                            </div>
                            <span className="text-sm font-bold">{uploads.length}</span>
                        </button>
                    </div>

                    {/* Recent Designs Row */}
                    <section>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h4 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                                <Play className="h-3.5 w-3.5 text-primary" />
                                Jump back in
                            </h4>
                            <button
                                type="button"
                                onClick={onOpenProjectsPanel}
                                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center"
                            >
                                View all
                            </button>
                        </div>

                        {isLoadingProjects ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
                                <span className="text-[11px] font-medium">Fetching...</span>
                            </div>
                        ) : recentProjects.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 flex flex-col items-center justify-center gap-2 text-center">
                                <Layers className="h-6 w-6 text-muted-foreground/50" />
                                <p className="text-xs text-muted-foreground">No designs yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {recentProjects.map((project) => (
                                    <button
                                        key={project.id}
                                        type="button"
                                        onClick={() => handleOpenProject(project)}
                                        className="group relative rounded-lg border border-border/40 bg-card overflow-hidden hover:border-primary/40 focus:outline-none transition-all text-left flex flex-col"
                                    >
                                        <div className="aspect-[4/3] w-full bg-[#f3f3f3] dark:bg-[#1e1e1e] relative overflow-hidden flex-shrink-0">
                                            {project.thumbnail ? (
                                                <img
                                                    src={project.thumbnail}
                                                    alt={project.title}
                                                    className="absolute inset-0 w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.03]"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <FolderOpen className="h-5 w-5 text-muted-foreground/30 transition-transform duration-300 group-hover:scale-110" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="px-2 py-2 flex flex-col gap-0.5">
                                            <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">{project.title}</p>
                                            <p className="text-[9px] font-medium text-muted-foreground">{formatRelativeTime(project.updatedAt)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Recent Uploads Row */}
                    <section className="pb-4">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h4 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                Latest Assets
                            </h4>
                            <button
                                type="button"
                                onClick={onOpenUploadsPanel}
                                className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex items-center"
                            >
                                Manage
                            </button>
                        </div>

                        {isLoadingUploads ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 flex flex-col items-center justify-center text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin text-primary/50" />
                            </div>
                        ) : uploads.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-[11px] text-muted-foreground">No recent uploads</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* 5 columns on desktop, 3 on mobile */}
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                    {uploads.slice(0, 10).map((upload) => (
                                        <div
                                            key={upload.id}
                                            className="group relative rounded-md border border-border/30 overflow-hidden bg-secondary/20 aspect-square hover:border-primary/30 cursor-pointer transition-all"
                                            title={upload.createdAt ? new Date(upload.createdAt).toLocaleString() : 'Recent upload'}
                                            onClick={onOpenUploadsPanel}
                                        >
                                            <img
                                                src={upload.src}
                                                alt="Recent upload"
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                </div>
            </ScrollArea>
        </div>
    );
};

export default HomePanel;

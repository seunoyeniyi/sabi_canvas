import React, { useCallback, useMemo, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@sabi-canvas/ui/button';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sabi-canvas/ui/alert-dialog';
import { useCanvasActions } from '@sabi-canvas/hooks/useCanvasActions';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { RecentImage, useRecentUploads } from '@sabi-canvas/hooks/useRecentUploads';
import { isSvgSrc } from '@sabi-canvas/lib/svgColorUtils';

interface UploadsPanelProps {
  onAssetInserted?: () => void;
}

const formatDate = (value?: string) => {
  if (!value) return 'Recent';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return 'Recent';
  return new Date(time).toLocaleString();
};

async function resolveToSvgDataUrl(src: string): Promise<string> {
  if (!isSvgSrc(src) || src.startsWith('data:')) return src;
  try {
    const res = await fetch(src);
    const text = await res.text();
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(text)));
  } catch {
    return src;
  }
}

export const UploadsPanel: React.FC<UploadsPanelProps> = ({ onAssetInserted }) => {
  const { uploadImage, isUploadingImage, uploadError } = useCanvasActions();
  const { addImage } = useCanvasObjects();
  const { uploads, removeUpload, isLoadingUploads } = useRecentUploads();
  const [deleteCandidate, setDeleteCandidate] = useState<RecentImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    if (!uploadError) return;
    toast.error(uploadError);
  }, [uploadError]);

  const handleInsert = useCallback(async (upload: RecentImage) => {
    const resolvedSrc = await resolveToSvgDataUrl(upload.src);
    addImage(resolvedSrc, undefined, { width: upload.width, height: upload.height });
    onAssetInserted?.();
  }, [addImage, onAssetInserted]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate || isDeleting) return;

    setIsDeleting(true);
    try {
      await removeUpload(deleteCandidate);
      setDeleteCandidate(null);
    } catch {
      toast.error('Failed to delete upload.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteCandidate, isDeleting, removeUpload]);

  const isEmpty = useMemo(() => !isLoadingUploads && uploads.length === 0, [isLoadingUploads, uploads.length]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-3 border-b border-panel-border">
        <Button
          className="w-full gap-2"
          onClick={uploadImage}
          disabled={isUploadingImage}
        >
          {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isUploadingImage ? 'Uploading...' : 'Upload Image'}
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        {isLoadingUploads ? (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square rounded-md animate-pulse" />
              ))}
            </div>
          </ScrollArea>
        ) : isEmpty ? (
          <div className="h-full flex items-center justify-center px-4 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No uploads yet</p>
              <p className="text-xs text-muted-foreground">Upload images and manage them from here.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 p-3">
              {uploads.map((upload) => (
                <div key={upload.id} className="group rounded-md border border-panel-border overflow-hidden bg-card">
                  <button
                    type="button"
                    className="relative w-full aspect-square bg-muted"
                    onClick={() => {
                      void handleInsert(upload);
                    }}
                    title="Add to canvas"
                  >
                    <img
                      src={upload.src}
                      alt="Uploaded item"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </button>

                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground truncate" title={formatDate(upload.createdAt)}>
                      {formatDate(upload.createdAt)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      title="Delete upload"
                      onClick={() => setDeleteCandidate(upload)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <AlertDialog
        open={deleteCandidate !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              This upload will be removed from your uploads library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UploadsPanel;
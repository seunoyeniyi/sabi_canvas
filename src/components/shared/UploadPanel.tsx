import React, { useCallback } from 'react';
import { Upload, Cloud, HardDrive, MoreVertical, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@sabi-canvas/ui/button';
import { useCanvasActions } from '@sabi-canvas/hooks/useCanvasActions';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useRecentUploads } from '@sabi-canvas/hooks/useRecentUploads';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useImageUpload } from '@sabi-canvas/hooks/useImageUpload';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Skeleton } from '@sabi-canvas/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sabi-canvas/ui/dropdown-menu";
import { CanvasObject } from '@sabi-canvas/types/canvas-objects';
import { isSvgSrc } from '@sabi-canvas/lib/svgColorUtils';

/** If src is an SVG HTTP URL, fetch it and return a data URI so SVG color
 * editing utilities can operate on it. Returns the original src on failure. */
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

interface UploadPanelProps {
  onClose: () => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({ onClose }) => {
  const { uploadImage, isUploadingImage, uploadError } = useCanvasActions();
  const { addImage, updateObject } = useCanvasObjects();
  const { uploads, addUpload, isLoadingUploads } = useRecentUploads();
  const { replacingImageId, setReplacingImageId } = useEditor();
  const [isReplaceUploading, setIsReplaceUploading] = React.useState(false);

  const isReplaceMode = !!replacingImageId;

  // Clear replace mode whenever this panel unmounts (handles toolbar toggle close too)
  React.useEffect(() => {
    return () => {
      setReplacingImageId(null);
    };
  }, [setReplacingImageId]);

  const handleClose = useCallback(() => {
    setReplacingImageId(null);
    onClose();
  }, [onClose, setReplacingImageId]);

  React.useEffect(() => {
    const handleImageAdded = () => {
      // Use to wrap in timeout specifically for selection logic in Konva matching mouse events
      setTimeout(() => {
        handleClose();
      }, 50);
    };

    window.addEventListener('canvas_image_added', handleImageAdded);
    return () => {
      window.removeEventListener('canvas_image_added', handleImageAdded);
    };
  }, [handleClose]);

  React.useEffect(() => {
    if (!uploadError) return;
    toast.error(uploadError);
  }, [uploadError]);

  // Handler for replace-mode image load (upload picker)
  const handleReplaceLoaded = useCallback((src: string, width: number, height: number) => {
    if (!replacingImageId) return;
    updateObject(replacingImageId, {
      src,
      removedBgSrc: undefined,
      naturalWidth: undefined,
      naturalHeight: undefined,
      cropX: undefined,
      cropY: undefined,
      cropWidth: undefined,
      cropHeight: undefined,
    } as Partial<CanvasObject>);
    addUpload(src, width, height);
    setReplacingImageId(null);
    window.dispatchEvent(new Event('canvas_image_added'));
  }, [replacingImageId, updateObject, addUpload, setReplacingImageId]);

  const { openFilePicker: openReplacePicker } = useImageUpload({
    onImageLoaded: handleReplaceLoaded,
    maxSize: 2200,
    onUploadStart: () => {
      setIsReplaceUploading(true);
    },
    onUploadComplete: () => {
      setIsReplaceUploading(false);
    },
    onUploadError: (error) => {
      toast.error(error.message || 'Upload failed');
    },
  });

  const isUploading = isReplaceMode ? isReplaceUploading : isUploadingImage;

  const handleDeviceUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReplaceMode) {
      openReplacePicker();
    } else {
      uploadImage();
    }
    // Intentionally not calling onClose() here so the panel stays open
    // while the user looks at the native file picker.
    // It will close automatically via the 'canvas_image_added' event above.
  };

  const handleRecentClick = useCallback(async (e: React.MouseEvent, src: string, width: number, height: number) => {
    e.stopPropagation();
    // If the stored src is a remote SVG URL, convert it to a data URI so that
    // SVG color-editing (palette extraction, color replacement) works on canvas.
    const resolvedSrc = await resolveToSvgDataUrl(src);
    if (isReplaceMode && replacingImageId) {
      updateObject(replacingImageId, {
        src: resolvedSrc,
        removedBgSrc: undefined,
        naturalWidth: undefined,
        naturalHeight: undefined,
        cropX: undefined,
        cropY: undefined,
        cropWidth: undefined,
        cropHeight: undefined,
      } as Partial<CanvasObject>);
      setReplacingImageId(null);
    } else {
      addImage(resolvedSrc, undefined, { width, height });
    }
    // Use a small timeout before closing so the click event finishes
    // processing. This prevents the canvas underneath from receiving
    // the event and accidentally deselecting the new image.
    setTimeout(() => {
      handleClose();
    }, 50);
  }, [addImage, handleClose, isReplaceMode, replacingImageId, setReplacingImageId, updateObject]);

  return (
    <div className="space-y-3 flex flex-col h-full">
      {/* Replace mode banner */}
      {isReplaceMode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-primary text-xs font-medium border border-primary/20">
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
          <span>Select an image to replace</span>
        </div>
      )}

      {/* Top Actions */}
      <div className="flex gap-2">
        <Button
          className="flex-1 gap-2"
          onClick={handleDeviceUpload}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isUploading ? 'Uploading...' : isReplaceMode ? 'Upload New' : 'Upload'}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="gap-2">
              <Cloud className="h-4 w-4 text-muted-foreground" />
              <span>Dropbox</span>
              <span className="text-[10px] ml-auto text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span>Google Drive</span>
              <span className="text-[10px] ml-auto text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      {/* Recent Uploads */}
      <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
        {/* <h3 className="text-sm font-medium shrink-0">Recent Uploads</h3> */}

        {isLoadingUploads ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-y-auto min-h-0 pointer-events-none">
            <div className="grid grid-cols-3 gap-2 py-2 px-1">
              {Array.from({ length: 18 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-square rounded-md animate-pulse"
                />
              ))}
            </div>
          </ScrollArea>
        ) : uploads.length > 0 ? (
          <ScrollArea className="flex-1 -mx-4 px-5 overflow-y-auto min-h-0">
            <div className="grid grid-cols-3 gap-2 py-2 px-1">
              {uploads.map((img) => (
                <button
                  key={img.id}
                  className="group relative aspect-square rounded-md overflow-hidden bg-muted hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={(e) => handleRecentClick(e, img.src, img.width, img.height)}
                >
                  <img
                    src={img.src}
                    alt="Recent upload"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/10 p-6 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">No recent uploads</p>
              <p className="text-xs text-muted-foreground">Images you upload will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPanel;

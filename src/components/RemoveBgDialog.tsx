import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@sabi-canvas/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@sabi-canvas/ui/dialog';
import { useBackgroundRemoval } from '@sabi-canvas/hooks/useBackgroundRemoval';
import type { ImageObject } from '@sabi-canvas/types/canvas-objects';

interface RemoveBgDialogProps {
  imageObject: ImageObject | null;
  onApply: (resultUrl: string) => void;
  onClose: () => void;
  onRevert: () => void;
  open: boolean;
}

const transparencyBackground = {
  backgroundImage:
    'linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  backgroundSize: '16px 16px',
};

export const RemoveBgDialog: React.FC<RemoveBgDialogProps> = ({
  imageObject,
  onApply,
  onClose,
  onRevert,
  open,
}) => {
  const { error, isProcessing, removeBackground, reset } = useBackgroundRemoval();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      reset();
      setPreviewUrl(null);
      return;
    }

    setPreviewUrl(imageObject?.removedBgSrc ?? null);
  }, [imageObject?.removedBgSrc, open, reset]);

  const displayUrl = previewUrl ?? imageObject?.src ?? null;
  const canConfirm = Boolean(previewUrl) && previewUrl !== imageObject?.removedBgSrc;

  const handleGenerate = async () => {
    if (!imageObject) {
      return;
    }

    const result = await removeBackground(imageObject);
    if ('resultUrl' in result) {
      setPreviewUrl(result.resultUrl);
    }
  };

  const handleConfirm = () => {
    if (!previewUrl) {
      return;
    }

    onApply(previewUrl);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[980px] gap-0 overflow-hidden border-panel-border bg-card p-0 sm:w-[95vw]">
        <div className="flex items-center justify-between border-b border-panel-border px-4 py-3 sm:px-5">
          <DialogTitle className="text-base font-semibold">Remove background from image</DialogTitle>
        </div>

        <div className="max-h-[calc(92vh-120px)] overflow-y-auto p-3 sm:p-6">
            
            <div
              className="flex min-h-[220px] items-center justify-center sm:min-h-[420px]"
              style={transparencyBackground}
            >
              {displayUrl ? (
                <img
                  src={displayUrl}
                  alt="Image to remove background from"
                  className="max-h-[calc(92vh-260px)] w-auto max-w-full object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No image selected</p>
              )}
            </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            {!previewUrl && (
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!imageObject || isProcessing}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? 'Removing background...' : 'Remove background'}
              </Button>
            )}
            {canConfirm && (
              <Button type="button" onClick={handleConfirm} disabled={isProcessing}>
                Confirm
              </Button>
            )}
          </div>

          {imageObject?.removedBgSrc && !isProcessing && (
            <div className="mt-2 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onRevert}>
                Use original image
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
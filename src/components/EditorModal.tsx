import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EditorLayout } from './EditorLayout';
import type { SabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';
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

interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  /**
   * Optional: pass API keys directly on <EditorModal> instead of using an
   * ancestor <SabiCanvasProvider>. Passed through to the inner EditorLayout.
   */
  config?: SabiCanvasConfig;
}

export const EditorModal: React.FC<EditorModalProps> = ({ isOpen, onClose, productName, config }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Intercept browser back button
  useEffect(() => {
    if (!isOpen) return;

    // Push a new history entry so back button can be caught
    window.history.pushState({ editorModalOpen: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      // Re-push state to prevent actual navigation
      window.history.pushState({ editorModalOpen: true }, '');
      setShowConfirm(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleRequestClose = () => {
    setShowConfirm(true);
  };

  const handleConfirmClose = () => {
    // Remove the history entry we pushed so back button works normally after close
    window.history.back();
    setShowConfirm(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="editor-modal"
            className="fixed inset-0 z-[100] flex flex-col bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Floating back button — mirrors DesignEditor page */}
            <button
              onClick={handleRequestClose}
              className="absolute top-3 left-16 z-[110] flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Back to product"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {productName ?? 'Back to product'}
            </button>

            <EditorLayout hideTitle={true} config={config} />
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={showConfirm} onOpenChange={(open) => !open && handleCancelClose()}>
        <AlertDialogContent className="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the editor?</AlertDialogTitle>
            <AlertDialogDescription>
              Going back will discard any unsaved changes to your design. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClose}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>Leave editor</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

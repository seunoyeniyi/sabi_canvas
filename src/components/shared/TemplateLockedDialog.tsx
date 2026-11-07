import React, { useCallback, useState } from 'react';
import { Lock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@sabi-canvas/ui/alert-dialog';

interface TemplateLockedDialogProps {
  open: boolean;
  /** The plan the template needs, e.g. `Pro`, when known. */
  plan?: string;
  onOpenChange: (open: boolean) => void;
}

/** Tells someone a template they picked isn't available to them. */
export const TemplateLockedDialog: React.FC<TemplateLockedDialogProps> = ({ open, plan, onOpenChange }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-w-sm">
      <AlertDialogHeader>
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Lock className="h-4.5 w-4.5 text-foreground" />
        </div>
        <AlertDialogTitle>Template locked</AlertDialogTitle>
        <AlertDialogDescription>
          {plan ? `This template needs the ${plan} plan.` : 'This template isn’t available to you.'}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction>OK</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

/**
 * State for `TemplateLockedDialog`. The plan is kept while the dialog closes,
 * so its text doesn't change during the closing animation.
 */
export function useTemplateLockedDialog() {
  const [state, setState] = useState<{ open: boolean; plan?: string }>({ open: false });
  const show = useCallback((plan?: string) => setState({ open: true, plan }), []);
  const onOpenChange = useCallback((open: boolean) => setState((prev) => ({ ...prev, open })), []);
  return { open: state.open, plan: state.plan, show, onOpenChange };
}

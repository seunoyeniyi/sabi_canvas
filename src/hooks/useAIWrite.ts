import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { aiService } from '@sabi-canvas/lib/ai-service';
import type { TextObject } from '@sabi-canvas/types/canvas-objects';
import type { CanvasObject } from '@sabi-canvas/types/canvas-objects';

type AIActionLabel = {
  label: string;
  instruction: string;
};

export type AIWriteAction =
  | 'transform'
  | 'rewrite'
  | 'fix-spelling'
  | 'continue-writing'
  | 'shorten'
  | 'more-fun'
  | 'more-formal';

const ACTION_LABELS: Record<AIWriteAction, AIActionLabel> = {
  transform: {
    label: 'Transform text',
    instruction: 'Transform this text to be clearer, more impactful, and easier to understand while preserving the meaning.',
  },
  rewrite: {
    label: 'Rewrite',
    instruction: 'Rewrite this text to improve flow, readability, and structure while preserving the intent.',
  },
  'fix-spelling': {
    label: 'Fix spelling',
    instruction: 'Fix grammar, spelling, punctuation, and minor wording issues without changing the meaning.',
  },
  'continue-writing': {
    label: 'Continue writing',
    instruction: 'Continue writing naturally from this text in the same tone and context.',
  },
  shorten: {
    label: 'Shorten',
    instruction: 'Rewrite this text to be shorter and concise while preserving key meaning.',
  },
  'more-fun': {
    label: 'More fun',
    instruction: 'Rewrite this text with a more playful, engaging, and lively tone.',
  },
  'more-formal': {
    label: 'More formal',
    instruction: 'Rewrite this text with a more professional and formal tone.',
  },
};

const getCurrentSelection = (): Selection | null => {
  if (typeof window === 'undefined') return null;
  return window.getSelection();
};

const getSelectionText = (): string => {
  return getCurrentSelection()?.toString().trim() ?? '';
};

const getActiveEditableRoot = (): HTMLElement | null => {
  const selection = getCurrentSelection();
  const anchorNode = selection?.anchorNode;

  if (!anchorNode) return null;

  const anchorElement = anchorNode.nodeType === Node.ELEMENT_NODE
    ? (anchorNode as HTMLElement)
    : anchorNode.parentElement;

  if (!anchorElement) return null;

  return anchorElement.closest('[contenteditable="true"]') as HTMLElement | null;
};

const getEditableText = (editableRoot: HTMLElement | null): string => {
  if (!editableRoot) return '';
  return editableRoot.innerText ?? '';
};

const buildPrompt = (action: AIWriteAction, sourceText: string, selectedText?: string): string => {
  const metadata = ACTION_LABELS[action];

  if (selectedText) {
    return [
      metadata.instruction,
      'You are rewriting only a selected excerpt from a larger document.',
      'Return only the rewritten excerpt and no extra explanation.',
      `Selected excerpt:\n${selectedText}`,
    ].join('\n\n');
  }

  if (action === 'continue-writing') {
    return [
      metadata.instruction,
      'Return the full text by including the original text first, then the continuation.',
      'Do not use quotes or markdown.',
      `Original text:\n${sourceText}`,
    ].join('\n\n');
  }

  return [
    metadata.instruction,
    'Return only the rewritten text and no extra explanation.',
    `Text:\n${sourceText}`,
  ].join('\n\n');
};

const replaceSelectionInEditableRoot = (selection: Selection, generatedText: string): boolean => {
  if (!selection.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return false;

  range.deleteContents();
  const textNode = document.createTextNode(generatedText);
  range.insertNode(textNode);

  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
};

export const useAIWrite = () => {
  const [isRunningAction, setIsRunningAction] = useState(false);

  const runAIWriteAction = useCallback(
    async (
      action: AIWriteAction,
      object: TextObject,
      updateObject: (id: string, updates: Partial<CanvasObject>) => void
    ) => {
      const editableRoot = getActiveEditableRoot();
      const liveText = getEditableText(editableRoot);
      const fullText = (liveText || object.text || '').trim();
      const selectedText = getSelectionText();
      const sourceText = selectedText || fullText;

      if (!sourceText) {
        toast.error('Enter text before using AI Write.');
        return;
      }

      setIsRunningAction(true);

      try {
        const response = await aiService.generateText({
          prompt: buildPrompt(action, fullText || object.text, selectedText),
          temperature: action === 'fix-spelling' ? 0.1 : 0.7,
        });

        const generatedText = response.text.trim();
        const selection = getCurrentSelection();
        const replacedInDom = !!selection && replaceSelectionInEditableRoot(selection, generatedText);
        const nextText = replacedInDom
          ? getEditableText(editableRoot)
          : generatedText;

        updateObject(object.id, {
          text: nextText,
          richText: undefined,
        });

      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI Write failed. Please try again.';
        toast.error(message);
      } finally {
        setIsRunningAction(false);
      }
    },
    []
  );

  return {
    isRunningAction,
    runAIWriteAction,
  };
};

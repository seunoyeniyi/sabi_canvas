import { useMemo } from 'react';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import type { EditorCustomTool } from '@sabi-canvas/types/editor';
import { editorTools, type EditorTool } from './editorToolsConfig';

/** Built-in tools a customer designing on a product doesn't get. */
export const CUSTOMER_HIDDEN_TOOLS = new Set(['background', 'resize']);

/** A toolbar button: a built-in tool, or one of the host's with its panel. */
export interface ToolbarTool extends EditorTool {
  /** The host's own panel, for a custom tool. */
  panel?: EditorCustomTool['panel'];
  /** Above the panel. */
  title: string;
}

/**
 * The toolbar's tools, in order: the built-in ones (less those a customer
 * doesn't get, and those the host hides) with the host's own tools placed
 * where they asked. Shared by the side toolbar and the phone's bottom bar.
 */
export function useEditorTools() {
  const { customTools, hiddenTools, editorMode, isMockupEnabled } = useEditor();
  const isCustomerMode = isMockupEnabled && editorMode === 'customer';

  return useMemo(() => {
    const hidden = new Set(hiddenTools);
    const builtIn: ToolbarTool[] = editorTools
      .filter((tool) => !(isCustomerMode && CUSTOMER_HIDDEN_TOOLS.has(tool.id)))
      .map((tool) => ({ ...tool, title: tool.label }));

    const tools = [...builtIn];
    for (const custom of customTools) {
      const showIn = custom.showIn ?? 'all';
      if ((showIn === 'customer' && !isCustomerMode) || (showIn === 'editor' && isCustomerMode)) continue;
      const entry: ToolbarTool = {
        id: custom.id,
        icon: custom.icon,
        label: custom.label,
        title: custom.title ?? custom.label,
        hasPanel: true,
        panel: custom.panel,
      };
      const placement = custom.placement ?? 'end';
      if (placement === 'start') {
        tools.unshift(entry);
        continue;
      }
      if (placement === 'end') {
        tools.push(entry);
        continue;
      }
      const anchorId = 'before' in placement ? placement.before : placement.after;
      const anchor = tools.findIndex((tool) => tool.id === anchorId);
      if (anchor === -1) tools.push(entry);
      else tools.splice('before' in placement ? anchor : anchor + 1, 0, entry);
    }

    const visible = tools.filter((tool) => !hidden.has(tool.id));
    return {
      tools: visible,
      /** A tool by id, among those shown. */
      find: (id: string | null | undefined) => (id ? visible.find((tool) => tool.id === id) : undefined),
    };
  }, [customTools, hiddenTools, isCustomerMode]);
}

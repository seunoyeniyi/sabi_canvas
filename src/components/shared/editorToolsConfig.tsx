import React from 'react';
import { 
  Layout, 
  Shapes, 
  Type,
  Upload,
  Layers, 
  Maximize,
  MousePointer2,
  Hand,
  Image as ImageIcon,
  Grid3x3,
} from 'lucide-react';
import { InteractionMode } from '@sabi-canvas/types/editor';

export interface EditorTool {
  id: string;
  icon: React.ReactNode;
  label: string;
  hasPanel?: boolean;
  shortcut?: string;
}

export interface ModeTool {
  id: string;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  mode: InteractionMode;
}

// Mode/cursor tools (Select, Hand)
export const modeTools: ModeTool[] = [
  { id: 'select', icon: <MousePointer2 className="h-5 w-5" />, label: 'Select', shortcut: 'V', mode: 'select' },
  { id: 'hand', icon: <Hand className="h-5 w-5" />, label: 'Hand Tool', shortcut: 'H', mode: 'pan' },
];

// Editor panel tools (shared between mobile bottom toolbar and desktop sidebar)
export const editorTools: EditorTool[] = [
  { id: 'templates', icon: <Layout className="h-5 w-5" />, label: 'Templates', hasPanel: true, shortcut: 'P' },
  { id: 'elements', icon: <Shapes className="h-5 w-5" />, label: 'Elements', hasPanel: true, shortcut: 'E' },
  { id: 'text', icon: <Type className="h-5 w-5" />, label: 'Text', hasPanel: true, shortcut: 'T' },
  { id: 'photos', icon: <ImageIcon className="h-5 w-5" />, label: 'Photos', hasPanel: true, shortcut: 'I' },
  { id: 'upload', icon: <Upload className="h-5 w-5" />, label: 'Uploads', hasPanel: true, shortcut: 'U' },
  { id: 'background', icon: <Grid3x3 className="h-5 w-5" />, label: 'Background', hasPanel: true, shortcut: 'B' },
  { id: 'layers', icon: <Layers className="h-5 w-5" />, label: 'Layers', hasPanel: true, shortcut: 'L' },
  { id: 'resize', icon: <Maximize className="h-5 w-5" />, label: 'Resize', hasPanel: true, shortcut: 'R' },
];

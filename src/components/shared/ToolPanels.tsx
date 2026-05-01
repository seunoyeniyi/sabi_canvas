import React from 'react';
import { Layout } from 'lucide-react';
import { ResizePanel } from '../panels/ResizePanel';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { UploadPanel } from './UploadPanel';
import { ElementsPanel } from '../panels/ElementsPanel';
import { TemplatesPanel } from '../panels/TemplatesPanel';
import { PhotosPanel } from '../panels/PhotosPanel';
import { BackgroundPanel } from '../panels/BackgroundPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { MyFontsPanel } from '../panels/MyFontsPanel';
import { TextTemplatesPanel } from '../panels/text/TextTemplatesPanel';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { TextObject, createDefaultObject } from '@sabi-canvas/types/canvas-objects';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@sabi-canvas/ui/tabs';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';

interface ToolPanelProps {
  activeTool: string | null;
  onClose: () => void;
}

export const ToolPanelContent: React.FC<ToolPanelProps> = ({ activeTool, onClose }) => {
  const { canvasSize } = useEditor();
  const { updateActivePageSize } = useCanvasObjects();

  switch (activeTool) {
    case 'templates':
      return <TemplatesPanel onClose={onClose} />;
    case 'resize':
      return (
        <ResizePanel
          currentWidth={canvasSize.width}
          currentHeight={canvasSize.height}
          onSizeChange={(width, height) => {
            updateActivePageSize(width, height);
            onClose();
          }}
        />
      );
    case 'elements':
      return <ElementsPanel onClose={onClose} />;
    case 'text':
      return <TextPanel onClose={onClose} />;
    case 'upload':
      return <UploadPanel onClose={onClose} />;
    case 'photos':
      return <PhotosPanel onClose={onClose} />;
    case 'background':
      return <BackgroundPanel onClose={onClose} />;
    case 'layers':
      return <LayersPanel onClose={onClose} />;
    default:
      return <PlaceholderPanel title={activeTool || ''} />;
  }
};

// Text Panel - Add text elements
export const TextPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { addObject, objects } = useCanvasObjects();
  const { canvasSize, editorMode, isMockupEnabled } = useEditor();

  const textStyles = [
    {
      id: 'heading',
      label: 'Add a heading',
      className: 'text-2xl font-bold',
      preset: {
        text: 'Add a heading',
        fontSize: 96,
        fontStyle: 'bold' as const,
        align: 'center' as const,
        width: 920,
      },
    },
    {
      id: 'subheading',
      label: 'Add a subheading',
      className: 'text-lg font-semibold',
      preset: {
        text: 'Add a subheading',
        fontSize: 56,
        fontStyle: 'bold' as const,
        align: 'center' as const,
        width: 760,
      },
    },
    {
      id: 'body',
      label: 'Add body text',
      className: 'text-base',
      preset: {
        text: 'Add body text',
        fontSize: 32,
        fontStyle: 'normal' as const,
        align: 'left' as const,
        width: 620,
      },
    },
  ];

  const handleAddText = (preset: {
    text: string;
    fontSize: number;
    fontStyle: TextObject['fontStyle'];
    align: TextObject['align'];
    width: number;
  }) => {
    const printArea = isMockupEnabled && editorMode === 'customer'
      ? objects.find((o) => o.type === 'print-area')
      : null;

    const refW = printArea ? printArea.width : canvasSize.width;
    const refH = printArea ? printArea.height : canvasSize.height;
    const originX = printArea ? printArea.x : 0;
    const originY = printArea ? printArea.y : 0;

    const width = Math.min(preset.width, refW - 80);
    const estimatedHeight = Math.ceil(preset.fontSize * 1.2);
    const position = {
      x: originX + (refW - width) / 2,
      y: originY + (refH - estimatedHeight) / 2,
    };

    const baseText = createDefaultObject('text', position) as TextObject;
    addObject({
      ...baseText,
      text: preset.text,
      fontSize: preset.fontSize,
      fontStyle: preset.fontStyle,
      align: preset.align,
      width,
      height: estimatedHeight,
    });

    onClose();
  };

  return (
    <Tabs defaultValue="text" className="w-full flex flex-col min-h-0 flex-1">
      <TabsList className="w-full h-8 mb-3 flex-shrink-0">
        <TabsTrigger value="text" className="flex-1 text-xs">Text</TabsTrigger>
        <TabsTrigger value="fonts" className="flex-1 text-xs">My Fonts</TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="mt-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="space-y-2 pb-4">
            {textStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => handleAddText(style.preset)}
                className="w-full text-center px-3 py-1 rounded-sm border border-border hover:bg-muted/50 transition-colors"
              >
                <span className={style.className}>{style.label}</span>
              </button>
            ))}

            <div className="pt-2">
              <p className="text-[11px] font-medium text-muted-foreground mb-2">Templates</p>
              <TextTemplatesPanel onClose={onClose} />
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="fonts" className="mt-0 flex-1 min-h-0">
        <MyFontsPanel onClose={onClose} />
      </TabsContent>
    </Tabs>
  );
};

// Placeholder Panel for unimplemented tools
export const PlaceholderPanel: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Layout className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold capitalize mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[200px]">
        This panel is coming soon. Stay tuned for updates!
      </p>
    </div>
  );
};

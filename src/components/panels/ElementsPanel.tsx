import React, { useCallback } from 'react';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Badge } from '@sabi-canvas/ui/badge';
import { shapeCategories, ShapeDefinition } from '@sabi-canvas/config/shapesConfig';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import {
  createDefaultObject,
  createPathObject,
  CanvasObjectType,
  PolygonObject,
  ArrowObject,
  DEFAULT_SHAPE_PROPS,
} from '@sabi-canvas/types/canvas-objects';
import { IconsGrid } from './elements/IconsGrid';
import { GraphicsGrid } from './elements/GraphicsGrid';
import { TablePresetGrid } from './elements/TablePresetGrid';
import { DrawPenIcon, DrawMarkerIcon, DrawHighlighterIcon } from '../icons/DrawIcons';


interface ElementsPanelProps {
  onClose: () => void;
}

const CATEGORIES = ['Shapes', 'Icons', 'Graphics', 'Tables'] as const;
type Category = typeof CATEGORIES[number];

export const ElementsPanel: React.FC<ElementsPanelProps> = ({ onClose }) => {
  const { addObject, addShape, getCustomerModePlacement } = useCanvasObjects();
  const { lastElementsCategory, setLastElementsCategory, setInteractionMode, setDrawTool } = useEditor();
  const selectedCategory = lastElementsCategory as Category;

  const setSelectedCategory = (category: Category) => {
    setLastElementsCategory(category);
  };

  const handleAddShape = useCallback((shape: ShapeDefinition) => {
    // Handle path shapes
    if (shape.type === 'path' && shape.pathData) {
      const w = shape.pathWidth || 200;
      const h = shape.pathHeight || 200;
      const p = getCustomerModePlacement(w, h);
      const pathObj = createPathObject(
        shape.pathData,
        { x: p.x, y: p.y },
        { width: p.width, height: p.height },
        shape.defaultFill || 'hsl(217, 91%, 60%)'
      );
      addObject(pathObj);
      onClose();
      return;
    }

    // Handle special polygon configurations
    if (shape.type === 'polygon') {
      let sides = 6; // default hexagon
      if (shape.id === 'pentagon') sides = 5;
      if (shape.id === 'hexagon') sides = 6;
      if (shape.id === 'octagon') sides = 8;

      const props = DEFAULT_SHAPE_PROPS.polygon;
      const p = getCustomerModePlacement(props.width, props.height);
      const obj = { ...createDefaultObject('polygon', { x: p.x, y: p.y }), width: p.width, height: p.height } as PolygonObject;
      obj.sides = sides;
      addObject(obj);
      onClose();
      return;
    }

    // Handle arrow variants
    if (shape.type === 'arrow') {
      const props = DEFAULT_SHAPE_PROPS.arrow;
      const p = getCustomerModePlacement(props.width, props.height);
      const obj = { ...createDefaultObject('arrow', { x: p.x, y: p.y }), width: p.width, height: p.height } as ArrowObject;
      if (shape.id === 'arrow-double') {
        obj.pointerAtBeginning = true;
        obj.pointerAtEnding = true;
      }
      addObject(obj);
      onClose();
      return;
    }

    // Handle rounded rectangle
    if (shape.id === 'rounded-rect') {
      const props = DEFAULT_SHAPE_PROPS.rectangle;
      const p = getCustomerModePlacement(props.width, props.height);
      const obj = createDefaultObject('rectangle', { x: p.x, y: p.y });
      obj.width = p.width;
      obj.height = p.height;
      if (obj.type === 'rectangle') {
        obj.cornerRadius = 20;
      }
      addObject(obj);
      onClose();
      return;
    }

    // Standard shapes — pass no position so addShape auto-centers
    addShape(shape.type as CanvasObjectType);
    onClose();
  }, [addObject, addShape, onClose, getCustomerModePlacement]);

  const handleSelectDrawTool = useCallback((tool: 'pen' | 'marker' | 'highlighter') => {
    setDrawTool(tool);
    setInteractionMode('draw');
    onClose();
  }, [setDrawTool, setInteractionMode, onClose]);

  return (
    <div className="flex flex-col h-full gap-x-4 gap-y-0">
      {/* Categories Row */}
      <div className="relative mb-2">
        <div className="flex items-center overflow-x-auto hide-scrollbar scroll-smooth pb-2">
          <div className="flex flex-nowrap gap-2 pr-10">
            {CATEGORIES.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className={`
                  cursor-pointer transition-all px-4 py-1.5 whitespace-nowrap rounded-lg text-sm font-medium
                  ${selectedCategory === category
                    ? 'shadow-sm border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/50'}
                `}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4 -mr-4">
        {selectedCategory === 'Shapes' ? (
          <div className="space-y-6 pb-4">
            {/* Draw Tools */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase">
                Draw
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'pen' as const,         label: 'Pen',         Icon: DrawPenIcon },
                  { id: 'marker' as const,      label: 'Marker',      Icon: DrawMarkerIcon },
                  { id: 'highlighter' as const, label: 'Highlighter', Icon: DrawHighlighterIcon },
                ]).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleSelectDrawTool(id)}
                    className="flex flex-col items-center justify-center gap-1.5 p-2 pt-3 rounded-xl border border-border/50 bg-card hover:bg-accent hover:border-primary/30 transition-all group"
                    title={label}
                  >
                    <div className="w-full h-7 flex items-center justify-center">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Shape Categories */}
            {shapeCategories.map((category) => (
              <div key={category.id} className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground/80 tracking-wider uppercase">
                  {category.label}
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {category.shapes.map((shape) => (
                    <button
                      key={shape.id}
                      onClick={() => handleAddShape(shape)}
                      className="flex flex-col items-center justify-center aspect-square p-2 rounded-xl border border-border/50 bg-card hover:bg-accent hover:text-accent-foreground hover:border-primary/30 transition-all group relative overflow-hidden"
                      title={shape.label}
                    >
                      <div className="flex items-center justify-center w-full h-full text-muted-foreground group-hover:text-primary transition-colors">
                        {shape.preview}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : selectedCategory === 'Icons' ? (
          <IconsGrid onClose={onClose} />
        ) : selectedCategory === 'Graphics' ? (
          <GraphicsGrid onClose={onClose} />
        ) : selectedCategory === 'Tables' ? (
          <TablePresetGrid onClose={onClose} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-4 p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-2">
              {selectedCategory === 'Tables' && <span className="text-2xl opacity-40">📊</span>}
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-foreground text-base">{selectedCategory} coming soon</h3>
              <p className="text-sm text-muted-foreground px-4">
                We're currently working on bringing more design elements to your workspace.
              </p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ElementsPanel;

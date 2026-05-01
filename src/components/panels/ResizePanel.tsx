import React from 'react';
import { motion } from 'framer-motion';
import {
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Linkedin,
  Smartphone,
  Monitor,
  Image,
  FileText,
  Check
} from 'lucide-react';
import { ScrollArea } from '@sabi-canvas/ui/scroll-area';
import { Button } from '@sabi-canvas/ui/button';
import { Input } from '@sabi-canvas/ui/input';
import { Label } from '@sabi-canvas/ui/label';
import { Separator } from '@sabi-canvas/ui/separator';
import { cn } from '@sabi-canvas/lib/utils';

export interface SizePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  category: 'social' | 'print' | 'screen' | 'custom';
}

const sizePresets: SizePreset[] = [
  // Social Media
  { id: 'instagram-post', name: 'Instagram Post', width: 1080, height: 1080, icon: <Instagram className="h-4 w-4" />, category: 'social' },
  { id: 'instagram-story', name: 'Instagram Reel', width: 1080, height: 1920, icon: <Instagram className="h-4 w-4" />, category: 'social' },
  { id: 'youtube-thumbnail', name: 'YouTube Thumbnail', width: 1280, height: 720, icon: <Youtube className="h-4 w-4" />, category: 'social' },
  { id: 'youtube-banner', name: 'YouTube Banner', width: 2560, height: 1440, icon: <Youtube className="h-4 w-4" />, category: 'social' },
  { id: 'facebook-post', name: 'Facebook Post', width: 1200, height: 630, icon: <Facebook className="h-4 w-4" />, category: 'social' },
  { id: 'facebook-cover', name: 'Facebook Cover', width: 1640, height: 624, icon: <Facebook className="h-4 w-4" />, category: 'social' },
  { id: 'twitter-post', name: 'Twitter Post', width: 1200, height: 675, icon: <Twitter className="h-4 w-4" />, category: 'social' },
  { id: 'twitter-header', name: 'Twitter Header', width: 1500, height: 500, icon: <Twitter className="h-4 w-4" />, category: 'social' },
  { id: 'linkedin-post', name: 'LinkedIn Post', width: 1200, height: 627, icon: <Linkedin className="h-4 w-4" />, category: 'social' },
  { id: 'linkedin-banner', name: 'LinkedIn Banner', width: 1584, height: 396, icon: <Linkedin className="h-4 w-4" />, category: 'social' },

  // Screen
  { id: 'mobile', name: 'Mobile', width: 375, height: 812, icon: <Smartphone className="h-4 w-4" />, category: 'screen' },
  { id: 'tablet', name: 'Tablet', width: 768, height: 1024, icon: <Smartphone className="h-4 w-4" />, category: 'screen' },
  { id: 'desktop', name: 'Desktop', width: 1920, height: 1080, icon: <Monitor className="h-4 w-4" />, category: 'screen' },
  { id: 'desktop-4k', name: '4K Desktop', width: 3840, height: 2160, icon: <Monitor className="h-4 w-4" />, category: 'screen' },

  // Print
  { id: 'a4', name: 'A4 Document', width: 2480, height: 3508, icon: <FileText className="h-4 w-4" />, category: 'print' },
  { id: 'letter', name: 'US Letter', width: 2550, height: 3300, icon: <FileText className="h-4 w-4" />, category: 'print' },
  { id: 'poster', name: 'Poster (18×24)', width: 5400, height: 7200, icon: <Image className="h-4 w-4" />, category: 'print' },
  { id: 'business-card', name: 'Business Card', width: 1050, height: 600, icon: <FileText className="h-4 w-4" />, category: 'print' },
];

interface ResizePanelProps {
  currentWidth: number;
  currentHeight: number;
  onSizeChange: (width: number, height: number) => void;
  className?: string;
}

export const ResizePanel: React.FC<ResizePanelProps> = ({
  currentWidth,
  currentHeight,
  onSizeChange,
  className,
}) => {
  const [customWidth, setCustomWidth] = React.useState(currentWidth.toString());
  const [customHeight, setCustomHeight] = React.useState(currentHeight.toString());

  React.useEffect(() => {
    setCustomWidth(currentWidth.toString());
    setCustomHeight(currentHeight.toString());
  }, [currentWidth, currentHeight]);

  const handlePresetSelect = (preset: SizePreset) => {
    onSizeChange(preset.width, preset.height);
  };

  const handleCustomApply = () => {
    const w = parseInt(customWidth) || 1080;
    const h = parseInt(customHeight) || 1920;
    onSizeChange(Math.max(100, Math.min(10000, w)), Math.max(100, Math.min(10000, h)));
  };

  const groupedPresets = sizePresets.reduce((acc, preset) => {
    if (!acc[preset.category]) acc[preset.category] = [];
    acc[preset.category].push(preset);
    return acc;
  }, {} as Record<string, SizePreset[]>);

  const categoryLabels: Record<string, string> = {
    social: 'Social Media',
    screen: 'Screen Sizes',
    print: 'Print',
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <ScrollArea className="h-full pr-3">
        <div className="px-1 border-b border-panel-border pb-3 mb-3">
        <p className="text-xs text-muted-foreground">
          Current: {currentWidth} × {currentHeight}px
        </p>
      </div>
        <div className="space-y-4">
          {/* Custom Size */}
          <div className="space-y-3">
            <div className="flex gap-2 px-1">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Width</Label>
                <Input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="h-9 text-sm font-mono !ring-1"
                  min={100}
                  max={10000}
                />
              </div>
              <div className="flex items-end pb-1 text-muted-foreground">×</div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Height</Label>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  className="h-9 text-sm font-mono !ring-1"
                  min={100}
                  max={10000}
                />
              </div>
            </div>
            <Button
              onClick={handleCustomApply}
              variant="secondary"
              size="sm"
              className="w-full"
            >
              Apply Custom Size
            </Button>
          </div>

          <Separator />

          {/* Preset Categories */}
          {Object.entries(groupedPresets).map(([category, presets]) => (
            <div key={category} className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {categoryLabels[category] || category}
              </Label>
              <div className="grid grid-cols-1 gap-1">
                {presets.map((preset) => {
                  const isSelected = preset.width === currentWidth && preset.height === currentHeight;
                  return (
                    <motion.button
                      key={preset.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handlePresetSelect(preset)}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-toolbar-hover'
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0',
                        isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}>
                        {preset.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{preset.name}</div>
                        <div className={cn(
                          'text-xs',
                          isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        )}>
                          {preset.width} × {preset.height}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ResizePanel;
import React, { useRef, useState } from 'react';
import { Loader2, Trash2, Type, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@sabi-canvas/ui/button';
import { useCustomFonts } from '@sabi-canvas/contexts/CustomFontsContext';
import { CUSTOM_FONT_ACCEPT, deriveFontFamilyFromFileName } from '@sabi-canvas/types/custom-fonts';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';
import { getFontFallbackStack } from '@sabi-canvas/lib/fontLoader';
import { createDefaultObject } from '@sabi-canvas/types/canvas-objects';
import type { TextObject } from '@sabi-canvas/types/canvas-objects';
import { useEditor } from '@sabi-canvas/contexts/EditorContext';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

interface MyFontsPanelProps {
  onClose: () => void;
}

export const MyFontsPanel: React.FC<MyFontsPanelProps> = ({ onClose }) => {
  const { customFonts, addCustomFont, removeCustomFont } = useCustomFonts();
  const { activePage, updateObject, addObject } = useCanvasObjects();
  const { canvasSize } = useEditor();
  const { uploadFontFile } = useSabiCanvasConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read font file'));
      reader.readAsDataURL(file);
    });
  };

  const remoteUrlToDataUrl = async (url: string, mimeType: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch uploaded font file');
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:${mimeType};base64,${base64}`;
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList?.length) return;
    const files = Array.from(fileList); // snapshot before clearing the input
    event.target.value = '';

    setUploading(true);
    for (const file of files) {
      try {
        let dataUrl: string;
        if (uploadFontFile) {
          const uploaded = await uploadFontFile(file);
          dataUrl = await remoteUrlToDataUrl(uploaded.src, file.type || 'font/ttf');
        } else {
          dataUrl = await fileToDataUrl(file);
        }
        const family = deriveFontFamilyFromFileName(file.name);
        await addCustomFont({
          family,
          fileName: file.name,
          mimeType: file.type || 'font/ttf',
          dataUrl,
        });
      } catch {
        toast.error(`Failed to upload "${file.name}".`);
      }
    }
    setUploading(false);
  };

  const handleUseFont = (family: string) => {
    const selectedTextId = activePage.selectedIds.find((id) => {
      const obj = activePage.objects.find((o) => o.id === id);
      return obj?.type === 'text';
    });

    if (selectedTextId) {
      updateObject(selectedTextId, { fontFamily: family } as Partial<TextObject>);
    } else {
      const width = Math.min(620, canvasSize.width - 80);
      const fontSize = 48;
      const estimatedHeight = Math.ceil(fontSize * 1.2);
      const position = {
        x: (canvasSize.width - width) / 2,
        y: (canvasSize.height - estimatedHeight) / 2,
      };
      const base = createDefaultObject('text', position) as TextObject;
      addObject({ ...base, text: 'Your text here', fontSize, width, height: estimatedHeight, fontFamily: family });
    }

    onClose();
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={handleUploadClick}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? 'Uploading…' : 'Upload font'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={CUSTOM_FONT_ACCEPT}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {customFonts.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          <Type className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No custom fonts yet.</p>
          <p className="mt-1 opacity-70">Upload .ttf, .otf, .woff or .woff2 files.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {customFonts.map((font) => (
            <div
              key={font.id}
              className="flex items-center gap-2 px-2 py-2 rounded border border-border hover:bg-muted/30 group"
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate"
                  style={{ fontFamily: getFontFallbackStack(font.family) }}
                >
                  {font.family}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{font.fileName}</div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Use font"
                  onClick={() => handleUseFont(font.family)}
                >
                  <Type className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  title="Delete font"
                  onClick={() => removeCustomFont(font.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

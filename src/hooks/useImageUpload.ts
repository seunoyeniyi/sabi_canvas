import { useCallback, useRef } from 'react';

interface UseImageUploadOptions {
  onImageLoaded: (src: string, width: number, height: number) => void;
  maxSize?: number; // Max dimension in pixels
  accept?: string;
}

export const useImageUpload = ({
  onImageLoaded,
  maxSize = 1000,
  accept = 'image/*',
}: UseImageUploadOptions) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const processImage = useCallback((file: File) => {
    const isSvgFile = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;

      // For SVG files, preserve the SVG format
      if (isSvgFile) {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Scale down if larger than maxSize
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          onImageLoaded(dataUrl, width, height);
        };
        img.onerror = () => {
          // Fallback to original dimensions if loading fails
          onImageLoaded(dataUrl, 300, 300);
        };
        img.src = dataUrl;
        return;
      }

      // For raster images, resize and convert to JPEG
      // Load image to get dimensions and resize if needed
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Always render to a canvas so we return a properly sized, compressed
        // JPEG data URL instead of the raw (potentially multi-megabyte) original.
        // This keeps the stored src small enough to fit in localStorage.
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onImageLoaded(dataUrl, width, height);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        onImageLoaded(resizedDataUrl, width, height);
      };
      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  }, [onImageLoaded, maxSize]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
    // Reset input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [processImage]);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const createHiddenInput = useCallback(() => {
    if (typeof document === 'undefined') return null;
    
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      input.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          processImage(file);
        }
        // Reset
        input.value = '';
      });
      document.body.appendChild(input);
      inputRef.current = input;
    }
    
    return inputRef.current;
  }, [accept, processImage]);

  // Cleanup on unmount would go here in a useEffect

  return {
    openFilePicker: () => {
      createHiddenInput();
      openFilePicker();
    },
    handleFileChange,
    inputRef,
    accept,
    processImage,
  };
};

export default useImageUpload;

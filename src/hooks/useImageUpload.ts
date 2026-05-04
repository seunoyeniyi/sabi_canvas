import { useCallback, useRef } from 'react';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

interface UseImageUploadOptions {
  onImageLoaded: (src: string, width: number, height: number) => void;
  maxSize?: number; // Max dimension in pixels
  accept?: string;
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
  onUploadError?: (error: Error) => void;
}

const normalizeImageDimensions = (
  sourceWidth: number,
  sourceHeight: number,
  maxSize: number,
): { width: number; height: number } => {
  let width = Math.max(1, sourceWidth);
  let height = Math.max(1, sourceHeight);

  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  return { width, height };
};

export const useImageUpload = ({
  onImageLoaded,
  maxSize = 1000,
  accept = 'image/*',
  onUploadStart,
  onUploadComplete,
  onUploadError,
}: UseImageUploadOptions) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { uploadImageFile } = useSabiCanvasConfig();

  const toError = (error: unknown, fallback: string): Error => {
    if (error instanceof Error) return error;
    if (typeof error === 'string') return new Error(error);
    return new Error(fallback);
  };

  const processImage = useCallback(async (file: File) => {
    onUploadStart?.();

    // Host-provided upload adapter (e.g. backend API + Cloudinary URL)
    if (uploadImageFile) {
      try {
        const isSvgFile = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
        const uploaded = await uploadImageFile(file, { maxSize });
        const normalized = normalizeImageDimensions(
          uploaded.width ?? 300,
          uploaded.height ?? 300,
          maxSize,
        );

        // SVGs uploaded via backend return an HTTPS URL, but the SVG color utilities
        // (extractSvgPalette, applySvgColorReplacements) only operate on data URIs.
        // Fetch the SVG text and re-encode as a data URL so color editing works.
        if (isSvgFile) {
          try {
            const response = await fetch(uploaded.src);
            const svgText = await response.text();
            const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
            onImageLoaded(dataUrl, normalized.width, normalized.height);
          } catch {
            // Fallback to Cloudinary URL if fetch fails — color editing won't work
            // but the image will still display.
            onImageLoaded(uploaded.src, normalized.width, normalized.height);
          }
        } else {
          onImageLoaded(uploaded.src, normalized.width, normalized.height);
        }
      } catch (error) {
        onUploadError?.(toError(error, 'Failed to upload image'));
        console.error('Failed to upload image through uploadImageFile adapter', error);
      } finally {
        onUploadComplete?.();
      }
      return;
    }

    const isSvgFile = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;

      // For SVG files, preserve the SVG format
      if (isSvgFile) {
        const img = new Image();
        img.onload = () => {
          const normalized = normalizeImageDimensions(img.width, img.height, maxSize);
          onImageLoaded(dataUrl, normalized.width, normalized.height);
        };
        img.onerror = () => {
          // Fallback to original dimensions if loading fails
          onImageLoaded(dataUrl, 300, 300);
          onUploadComplete?.();
        };
        img.src = dataUrl;
        return;
      }

      // For raster images, resize and convert to JPEG
      // Load image to get dimensions and resize if needed
      const img = new Image();
      img.onload = () => {
        const normalized = normalizeImageDimensions(img.width, img.height, maxSize);
        const width = normalized.width;
        const height = normalized.height;

        // Always render to a canvas so we return a properly sized, compressed
        // JPEG data URL instead of the raw (potentially multi-megabyte) original.
        // This keeps the stored src small enough to fit in localStorage.
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          onImageLoaded(dataUrl, width, height);
          onUploadComplete?.();
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        onImageLoaded(resizedDataUrl, width, height);
        onUploadComplete?.();
      };
      img.onerror = () => {
        onUploadError?.(new Error('Failed to process selected image'));
        onUploadComplete?.();
      };
      img.src = dataUrl;
    };

    reader.onerror = () => {
      onUploadError?.(new Error('Failed to read selected file'));
      onUploadComplete?.();
    };

    reader.readAsDataURL(file);
  }, [onImageLoaded, maxSize, onUploadComplete, onUploadError, onUploadStart, uploadImageFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processImage(file);
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
          void processImage(file);
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

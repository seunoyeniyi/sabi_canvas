import { useCallback, useState } from 'react';

import type { ImageObject } from '@sabi-canvas/types/canvas-objects';
import { useSabiCanvasConfig } from '@sabi-canvas/contexts/SabiCanvasConfigContext';

type BackgroundRemovalStage = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface BackgroundRemovalSuccess {
  resultUrl: string;
}

interface BackgroundRemovalError {
  message: string;
}

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 2000;

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const buildTransformedUrl = (cloudName: string, publicId: string) => {
  const encodedPublicId = publicId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `https://res.cloudinary.com/${cloudName}/image/upload/e_background_removal/${encodedPublicId}.png`;
};

const waitForDerivedImage = async (src: string) => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Image not ready yet'));
        image.src = `${src}${src.includes('?') ? '&' : '?'}_=${Date.now()}_${attempt}`;
      });

      return;
    } catch {
      if (attempt === MAX_POLL_ATTEMPTS - 1) {
        throw new Error('Cloudinary background removal timed out. Try again in a moment.');
      }
      await delay(POLL_INTERVAL_MS);
    }
  }
};

export const useBackgroundRemoval = () => {
  const [stage, setStage] = useState<BackgroundRemovalStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const { cloudinaryCloudName, cloudinaryUploadPreset } = useSabiCanvasConfig();

  const removeBackground = useCallback(async (image: ImageObject): Promise<BackgroundRemovalSuccess | BackgroundRemovalError> => {
    const cloudName = cloudinaryCloudName;
    const uploadPreset = cloudinaryUploadPreset;

    if (!cloudName || !uploadPreset) {
      const message = 'Cloudinary is not configured. Pass cloudinaryCloudName and cloudinaryUploadPreset to SabiCanvasProvider.';
      setStage('error');
      setError(message);
      return { message };
    }

    setStage('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', image.src);
      formData.append('upload_preset', uploadPreset);

      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed. Confirm your unsigned Cloudinary upload preset is enabled.');
      }

      const uploadData = await uploadResponse.json() as { public_id?: string };
      if (!uploadData.public_id) {
        throw new Error('Cloudinary did not return a public ID for the uploaded image.');
      }

      setStage('processing');

      const resultUrl = buildTransformedUrl(cloudName, uploadData.public_id);
      await waitForDerivedImage(resultUrl);

      setStage('done');
      return { resultUrl };
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Background removal failed.';
      setStage('error');
      setError(message);
      return { message };
    }
  }, [cloudinaryCloudName, cloudinaryUploadPreset]);

  const reset = useCallback(() => {
    setStage('idle');
    setError(null);
  }, []);

  return {
    error,
    isProcessing: stage === 'uploading' || stage === 'processing',
    removeBackground,
    reset,
    stage,
  };
};
import { useState, useEffect, useCallback, useRef } from 'react';
import { StageConfig, ViewportDimensions, DEFAULT_STAGE_CONFIG } from '@sabi-canvas/types/canvas';

interface UseStageResizeOptions {
  config?: Partial<StageConfig>;
  containerRef: React.RefObject<HTMLDivElement>;
  zoom?: number;
  safeAreaTopInset?: number;
  safeAreaBottomInset?: number;
  safeAreaLeftInset?: number;
  safeAreaRightInset?: number;
}

interface UseStageResizeResult {
  dimensions: ViewportDimensions;
  safeAreaRect: { x: number; y: number; width: number; height: number };
  containerSize: { width: number; height: number };
}

export function useStageResize({
  config: userConfig,
  containerRef,
  zoom = 1,
  safeAreaTopInset = 0,
  safeAreaBottomInset = 0,
  safeAreaLeftInset = 0,
  safeAreaRightInset = 0,
}: UseStageResizeOptions): UseStageResizeResult {
  const config: StageConfig = { ...DEFAULT_STAGE_CONFIG, ...userConfig };
  
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Calculate dimensions based on container size and zoom
  const calculateDimensions = useCallback((): ViewportDimensions => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0 };
    }

    const { designWidth, designHeight, padding } = config;
    
    // Available space for the design (minus padding and reserved vertical/horizontal insets)
    const availableWidth = containerSize.width - padding * 2 - safeAreaLeftInset - safeAreaRightInset;
    const availableHeight = containerSize.height - padding * 2 - safeAreaTopInset - safeAreaBottomInset;
    
    // Calculate scale to fit design in available space
    const scaleX = availableWidth / designWidth;
    const scaleY = availableHeight / designHeight;
    const baseScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1
    
    // Apply zoom
    const finalScale = baseScale * zoom;
    
    // Calculate offsets to center the design
    const scaledWidth = designWidth * finalScale;
    const scaledHeight = designHeight * finalScale;
    const horizontalStart = padding + safeAreaLeftInset;
    const verticalStart = padding + safeAreaTopInset;
    const offsetX = horizontalStart + (availableWidth - scaledWidth) / 2;
    const offsetY = verticalStart + (availableHeight - scaledHeight) / 2;

    return {
      width: containerSize.width,
      height: containerSize.height,
      scale: finalScale,
      offsetX,
      offsetY,
    };
  }, [containerSize, config, zoom, safeAreaTopInset, safeAreaBottomInset, safeAreaLeftInset, safeAreaRightInset]);

  // Calculate safe area rectangle position
  const calculateSafeAreaRect = useCallback(() => {
    const dims = calculateDimensions();
    return {
      x: dims.offsetX,
      y: dims.offsetY,
      width: config.designWidth * dims.scale,
      height: config.designHeight * dims.scale,
    };
  }, [calculateDimensions, config.designWidth, config.designHeight]);

  // Set up resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    // Initial size
    updateSize();

    // Create resize observer
    resizeObserverRef.current = new ResizeObserver(updateSize);
    resizeObserverRef.current.observe(container);

    // Also listen to window resize for safety
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserverRef.current?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [containerRef]);

  return {
    dimensions: calculateDimensions(),
    safeAreaRect: calculateSafeAreaRect(),
    containerSize,
  };
}

export default useStageResize;

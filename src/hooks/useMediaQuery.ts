import { useState, useEffect } from 'react';
import { BREAKPOINTS } from '@sabi-canvas/types/editor';

type BreakpointKey = keyof typeof BREAKPOINTS;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    
    mediaQuery.addEventListener('change', handler);
    setMatches(mediaQuery.matches);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export function useBreakpoint(breakpoint: BreakpointKey): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

export function useIsMobile(): boolean {
  return !useBreakpoint('md');
}

export function useIsTablet(): boolean {
  const isMd = useBreakpoint('md');
  const isLg = useBreakpoint('lg');
  return isMd && !isLg;
}

export function useIsDesktop(): boolean {
  return useBreakpoint('lg');
}

export function useResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
}): T | undefined {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  
  if (isMobile) return values.mobile;
  if (isTablet) return values.tablet ?? values.desktop;
  return values.desktop ?? values.tablet ?? values.mobile;
}

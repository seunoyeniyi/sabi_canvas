export type TransformerSizeClass = 'normal' | 'small' | 'tiny';

const DESKTOP_SMALL_THRESHOLD_PX = 44;
const DESKTOP_TINY_THRESHOLD_PX = 14;

const MOBILE_SMALL_THRESHOLD_PX = 60;
const MOBILE_TINY_THRESHOLD_PX = 30;

export interface TransformerAnchorPolicyInput {
  locked: boolean;
  isHover: boolean;
  isSingleTextSelection: boolean;
  sizeClass: TransformerSizeClass;
  hideHorizontalMiddleAnchors?: boolean;
  hideVerticalMiddleAnchors?: boolean;
}

export interface TransformerAnchorVisibility {
  sizeClass: TransformerSizeClass;
  hideHorizontalMiddleAnchors: boolean;
  hideVerticalMiddleAnchors: boolean;
}

export const getTransformerSizeClass = (
  minDimensionPx: number,
  isMobile: boolean,
): TransformerSizeClass => {
  if (!Number.isFinite(minDimensionPx) || minDimensionPx <= 0) {
    return 'normal';
  }

  const tinyThreshold = isMobile ? MOBILE_TINY_THRESHOLD_PX : DESKTOP_TINY_THRESHOLD_PX;
  const smallThreshold = isMobile ? MOBILE_SMALL_THRESHOLD_PX : DESKTOP_SMALL_THRESHOLD_PX;

  if (minDimensionPx <= tinyThreshold) {
    return 'tiny';
  }

  if (minDimensionPx <= smallThreshold) {
    return 'small';
  }

  return 'normal';
};

export const getTransformerAnchorVisibility = (
  widthPx: number,
  heightPx: number,
  isMobile: boolean,
): TransformerAnchorVisibility => {
  const tinyThreshold = isMobile ? MOBILE_TINY_THRESHOLD_PX : DESKTOP_TINY_THRESHOLD_PX;
  const smallThreshold = isMobile ? MOBILE_SMALL_THRESHOLD_PX : DESKTOP_SMALL_THRESHOLD_PX;

  const safeWidth = Number.isFinite(widthPx) ? Math.max(0, widthPx) : 0;
  const safeHeight = Number.isFinite(heightPx) ? Math.max(0, heightPx) : 0;
  const minDimension = Math.min(safeWidth, safeHeight);

  const sizeClass = getTransformerSizeClass(minDimension, isMobile);

  return {
    sizeClass,
    hideHorizontalMiddleAnchors: safeHeight > 0 && safeHeight <= smallThreshold,
    hideVerticalMiddleAnchors: safeWidth > 0 && safeWidth <= smallThreshold,
  };
};

const TEXT_NORMAL_ANCHORS = [
  'top-left',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-right',
] as const;
const FULL_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;
const ESSENTIAL_RESPONSIVE_ANCHORS = ['top-left', 'middle-right'] as const;

const ensureEssentialResponsiveAnchors = (anchors: string[]): string[] => {
  const nextAnchors = [...anchors];

  ESSENTIAL_RESPONSIVE_ANCHORS.forEach((anchor) => {
    if (!nextAnchors.includes(anchor)) {
      nextAnchors.push(anchor);
    }
  });

  return nextAnchors;
};

export const getResponsiveEnabledAnchors = ({
  locked,
  isHover,
  isSingleTextSelection,
  sizeClass,
  hideHorizontalMiddleAnchors = false,
  hideVerticalMiddleAnchors = false,
}: TransformerAnchorPolicyInput): string[] => {
  if (locked || isHover) {
    return [];
  }

  const shouldEnforceEssentialResponsiveAnchors = isSingleTextSelection
    && (sizeClass === 'tiny' || sizeClass === 'small');

  if (sizeClass === 'tiny') {
    return shouldEnforceEssentialResponsiveAnchors
      ? ensureEssentialResponsiveAnchors([])
      : ['top-left'];
  }

  const baseAnchors = isSingleTextSelection ? [...TEXT_NORMAL_ANCHORS] : [...FULL_ANCHORS];

  if (!hideHorizontalMiddleAnchors && !hideVerticalMiddleAnchors) {
    return shouldEnforceEssentialResponsiveAnchors
      ? ensureEssentialResponsiveAnchors(baseAnchors)
      : baseAnchors;
  }

  const filteredAnchors = baseAnchors.filter((anchor) => {
    if (hideHorizontalMiddleAnchors && (anchor === 'middle-left' || anchor === 'middle-right')) {
      return false;
    }

    if (hideVerticalMiddleAnchors && (anchor === 'top-center' || anchor === 'bottom-center')) {
      return false;
    }

    return true;
  });

  return shouldEnforceEssentialResponsiveAnchors
    ? ensureEssentialResponsiveAnchors(filteredAnchors)
    : filteredAnchors;
};

export const getRotateEnabled = ({
  locked,
  isHover,
  sizeClass,
}: Pick<TransformerAnchorPolicyInput, 'locked' | 'isHover' | 'sizeClass'>): boolean => {
  return !locked && !isHover && sizeClass !== 'tiny';
};

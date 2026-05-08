interface TimelineTopBarVisibilityParams {
  currentTop: number;
  previousTop: number;
  isVisible: boolean;
  threshold?: number;
}

interface ProfileTopBarVisibilityParams {
  scrollTop: number;
  threshold: number;
}

export function getNextTimelineTopBarVisibility({
  currentTop,
  previousTop,
  isVisible,
  threshold = 6,
}: TimelineTopBarVisibilityParams): boolean {
  if (currentTop <= 0) return true;

  const delta = currentTop - previousTop;
  if (delta > threshold) return false;
  if (delta < -threshold) return true;
  return isVisible;
}

export function shouldShowProfileTopBar({
  scrollTop,
  threshold,
}: ProfileTopBarVisibilityParams): boolean {
  return scrollTop >= threshold;
}

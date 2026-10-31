import { useMemo } from 'react';
import { useNavGestures } from '../../../os/navigation';

// X pages pass untyped action specs, as before.
type AnyBinding = (id: any, options?: any) => any;
const inactive = () => ({});

/**
 * Gesture bindings for X pages; jump targets come from `../routes`.
 * While `isActive` is false (an off-screen tab), tap bindings render no
 * handler and no tag; system back stays bound.
 */
export function useXGestures(isActive: boolean = true) {
  const gestures = useNavGestures();
  return useMemo(() => ({
    nav: gestures.nav,
    back: gestures.nav.back,
    bindBack: gestures.bindBack,
    bindNav: isActive ? gestures.bindNav : (inactive as unknown as typeof gestures.bindNav),
    bindTap: (isActive ? gestures.bindTap : inactive) as AnyBinding,
    bindLongPress: (isActive ? gestures.bindLongPress : inactive) as AnyBinding,
    bindDoubleTap: (isActive ? gestures.bindDoubleTap : inactive) as AnyBinding,
  }), [gestures, isActive]);
}

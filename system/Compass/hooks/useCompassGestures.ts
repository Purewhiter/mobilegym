import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Compass pages; jump targets come from `../routes`. */
export function useCompassGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

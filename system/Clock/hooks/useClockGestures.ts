import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Clock pages; jump targets come from `../routes`. */
export function useClockGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

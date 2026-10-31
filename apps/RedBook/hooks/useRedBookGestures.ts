import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for RedBook pages; jump targets come from `../routes`. */
export function useRedBookGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

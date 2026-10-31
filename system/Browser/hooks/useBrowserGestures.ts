import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Browser pages; jump targets come from `../routes`. */
export function useBrowserGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

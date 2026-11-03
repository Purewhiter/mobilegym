import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Map pages; jump targets come from `../routes`. */
export function useMapGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back, replaceState: gestures.nav.replaceState };
}

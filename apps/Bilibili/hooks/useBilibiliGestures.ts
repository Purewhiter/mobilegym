import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Bilibili pages; jump targets come from `../routes`. */
export function useBilibiliGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

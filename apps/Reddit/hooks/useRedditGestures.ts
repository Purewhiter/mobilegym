import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Reddit pages; jump targets come from `../routes`. */
export function useRedditGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

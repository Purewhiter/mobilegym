import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Notes pages; jump targets come from `../routes`. */
export function useNotesGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

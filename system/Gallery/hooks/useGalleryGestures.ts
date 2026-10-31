import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Gallery pages; jump targets come from `../routes`. */
export function useGalleryGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

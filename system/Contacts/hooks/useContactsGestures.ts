import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Contacts pages; jump targets come from `../routes`. */
export function useContactsGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

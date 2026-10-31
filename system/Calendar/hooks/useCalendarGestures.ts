import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Calendar pages; jump targets come from `../routes`. */
export function useCalendarGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

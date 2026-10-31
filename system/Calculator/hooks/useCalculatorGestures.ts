import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Calculator pages; jump targets come from `../routes`. */
export function useCalculatorGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

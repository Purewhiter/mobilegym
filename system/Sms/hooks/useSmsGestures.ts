import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Sms pages; jump targets come from `../routes`. */
export function useSmsGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

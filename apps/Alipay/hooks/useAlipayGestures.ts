import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Alipay pages; jump targets come from `../routes`. */
export function useAlipayGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

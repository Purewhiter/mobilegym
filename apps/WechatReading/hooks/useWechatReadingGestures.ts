import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for WechatReading pages; jump targets come from `../routes`. */
export function useWechatReadingGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

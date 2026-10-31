import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Wechat pages; jump targets come from `../routes`. */
export function useWechatGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

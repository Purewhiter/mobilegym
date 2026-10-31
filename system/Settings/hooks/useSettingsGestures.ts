import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Settings pages; jump targets come from `../routes`. */
export function useSettingsGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

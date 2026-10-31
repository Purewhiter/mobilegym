import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for ThemeStore pages; jump targets come from `../routes`. */
export function useThemeStoreGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

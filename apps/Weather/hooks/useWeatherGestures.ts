import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Weather pages; jump targets come from `../routes`. */
export function useWeatherGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

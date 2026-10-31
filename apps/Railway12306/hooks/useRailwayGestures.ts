import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Railway12306 pages; jump targets come from `../routes`. */
export function useRailwayGestures() {
  const gestures = useNavGestures();
  return { ...gestures, back: gestures.nav.back };
}

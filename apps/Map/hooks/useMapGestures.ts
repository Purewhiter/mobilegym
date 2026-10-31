import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavGestures } from '../../../os/navigation';

/** Gesture bindings for Map pages; jump targets come from `../routes`. */
export function useMapGestures() {
  const gestures = useNavGestures();
  const navigate = useNavigate();

  /** Replace the current entry's `location.state`, keeping its URL. */
  const replaceState = useCallback((state: Record<string, unknown>) => {
    navigate('.', { replace: true, state });
  }, [navigate]);

  return { ...gestures, back: gestures.nav.back, replaceState };
}

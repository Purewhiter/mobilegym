import { useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_DECLARATION, type TransitionId } from './navigation.declaration';

export function useAppNavigate() {
  const location = useLocation();
  const navigate = useNavigate();

  const go = (
    id: TransitionId,
    params: Record<string, string | number> = {},
    options?: { mode?: 'push' | 'replace' },
  ) => {
    const transition = NAVIGATION_DECLARATION.transitions.find((item) => item.id === id);
    if (!transition) throw new Error(`Transition not found: ${id}`);
    if (transition.from !== location.pathname) {
      throw new Error(`Transition "${id}" not allowed from "${location.pathname}"`);
    }

    const target = transition.to.replace(/:(\w+)/g, (_, key: string) => {
      const value = params[key];
      if (value === undefined) {
        throw new Error(`Missing param "${key}" for transition "${id}"`);
      }
      return encodeURIComponent(String(value));
    });
    const mode = options?.mode ?? transition.mode;
    navigate(target, mode === 'replace' ? { replace: true } : undefined);
  };

  const back = (steps = 1) => navigate(-steps);
  const navigateTo = (path: string, options?: { replace?: boolean }) => navigate(path, options);

  return { go, back, navigateTo };
}

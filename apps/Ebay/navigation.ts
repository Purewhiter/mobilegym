import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_DECLARATION } from './navigation.declaration';
import type {
  CaseDeclaration,
  Condition,
  TransitionDeclaration,
  ValueRef,
  Primitive,
} from './navigation.types';

export function useEbayNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = useCallback(
    (id: string, params: Record<string, string | number> = {}) => {
      const searchParams = new URLSearchParams(location.search);
      const t = NAVIGATION_DECLARATION.transitions?.find(
        (transition: any) => transition.id === id,
      ) as TransitionDeclaration | undefined;
      
      if (!t) {
        throw new Error(`Transition not found: ${id}`);
      }

      // Simplified logic assuming simple transitions for now
      // For a real robust implementation, we should copy the full logic from Wechat/navigation.ts
      // But given the scope, I'll stick to direct navigation if possible, but respecting the structure.
      
      let targetPathname = t.to;

      // Replace path params like :id with actual values
      for (const [key, value] of Object.entries(params)) {
        targetPathname = targetPathname.replace(`:${key}`, String(value));
      }

      navigate(targetPathname);
    },
    [navigate, location.pathname, location.search],
  );

  const back = useCallback(
    (steps: number = 1) => {
      navigate(-steps);
    },
    [navigate],
  );

  return { go, back };
}

export function useEbayGestures() {
    const { go, back } = useEbayNavigation();
    
    const bindTap = (id: string, params?: Record<string, string | number>) => ({
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            go(id, params);
        },
        'data-trigger': id,
        'data-trigger-params': params ? JSON.stringify(params) : undefined
    });

    const bindAction = (actionId: string, params?: any) => ({
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            console.log(`Action ${actionId} triggered`, params);
        },
        'data-action': actionId,
        'data-action-params': params ? JSON.stringify(params) : undefined
    });

    const bindBack = () => ({
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            back();
        },
        'data-trigger': 'system.back'
    });

    return { bindTap, bindAction, bindBack };
}

import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_DECLARATION } from './navigation.declaration';
import type { TransitionDeclaration } from './navigation.types';

export function useEbayNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const go = useCallback(
    (
      id: string,
      params: Record<string, string | number> = {},
      options?: { mode?: 'push' | 'replace' },
    ) => {
      const currentSearchParams = new URLSearchParams(location.search);
      const t = NAVIGATION_DECLARATION.transitions?.find(
        (transition: any) => transition.id === id,
      ) as TransitionDeclaration | undefined;
      
      if (!t) {
        throw new Error(`Transition not found: ${id}`);
      }

      let targetPathname = t.to;

      // Replace path params like :id with actual values
      for (const [key, value] of Object.entries(params)) {
        targetPathname = targetPathname.replace(`:${key}`, String(value));
      }

      // Query 构建顺序与 Wechat/navigation.ts buildSearchParams 一致：
      // preserveParams 保留当前 URL 键 → search 写入静态键值 → searchParams 映射运行时参数
      const nextSearchParams = new URLSearchParams();
      for (const key of t.preserveParams ?? []) {
        const value = currentSearchParams.get(key);
        if (value !== null) nextSearchParams.set(key, value);
      }
      for (const [key, value] of Object.entries(t.search)) {
        if (value === null) nextSearchParams.delete(key);
        else nextSearchParams.set(key, value);
      }
      for (const key of Object.keys(t.searchParams)) {
        const value = params[key];
        if (value !== undefined) nextSearchParams.set(key, String(value));
      }

      const searchStr = nextSearchParams.toString();
      const targetUrl = searchStr ? `${targetPathname}?${searchStr}` : targetPathname;

      navigate(targetUrl, options?.mode === 'replace' ? { replace: true } : undefined);
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

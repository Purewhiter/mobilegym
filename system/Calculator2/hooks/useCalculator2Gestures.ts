/**
 * Calculator2 手势绑定 hook
 * 提供 bindAction (data-action 属性) 和 bindBack
 *
 * Calculator 按钮都是 actions（原地操作），不走导航 transitions。
 */

import type React from 'react';

export function useCalculator2Gestures() {
  const bindAction = (actionId: string, params?: Record<string, any>) => ({
    'data-action': actionId,
    'data-action-type': 'tap',
    ...(params && Object.keys(params).length > 0
      ? { 'data-action-params': JSON.stringify(params) }
      : {}),
  });

  const bindBack = () => ({
    'data-trigger': 'system.back',
    'data-trigger-type': 'back',
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
    },
  });

  return {
    bindAction,
    bindBack,
  };
}

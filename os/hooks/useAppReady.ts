import { useContext, useEffect } from 'react';
import type { ImplementedAppId } from '../types';
import { ActivityContext } from '../ActivityContext';

/**
 * 通知系统 App 已准备就绪
 * 
 * 用于解决 openApp 带 initialRoute 时的异步等待问题。
 * App 在挂载并完成导航注册后调用此 hook，
 * 系统会立即执行待处理的导航操作。
 * 
 * @param appId - App 的唯一标识符（必须是已实现的 App）
 * 
 * @example
 * // 在 App 主组件中使用
 * function WechatApp() {
 *   const { navigate } = useNavigate();
 *   
 *   // 通知系统 App 已准备好接收导航
 *   useAppReady('wechat');
 *   
 *   return <div>...</div>;
 * }
 */
export function useAppReady(appId: ImplementedAppId) {
  const { activityId } = useContext(ActivityContext);

  useEffect(() => {
    // 使用 requestAnimationFrame 确保在同一渲染周期内完成导航注册
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('app-ready', { detail: { appId, activityId } })
      );
    });
  }, [appId, activityId]);
}

/**
 * 手动触发 App ready 事件
 * 适用于不方便使用 hook 的场景
 */
export function notifyAppReady(appId: ImplementedAppId) {
  requestAnimationFrame(() => {
    window.dispatchEvent(
      new CustomEvent('app-ready', { detail: { appId } })
    );
  });
}

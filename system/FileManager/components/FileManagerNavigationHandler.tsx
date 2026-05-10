/**
 * FileManager Navigation Handler
 *
 * Handles system integration: back handler, route tracking, and per-activity navigator.
 * Cross-app callers指定具体子页时使用 intent.route（IntentResolver 让 caller hint 优先于
 * filter.route），OS 直接 navigateToActivity 到目标路由，不需要 App 端再做 dispatch。
 */
import React, { useCallback, useEffect } from 'react';
import { useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../../os/hooks/useAppNavigationHandler';
import { AppNavigatorRegistry } from '../../../os/AppNavigatorRegistry';
import { useActivityContext } from '../../../os/ActivityContext';

export const FileManagerNavigationHandler: React.FC = () => {
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const { activityId } = useActivityContext();

  const handleBack = useCallback((): boolean => {
    const index = (navigator as any).index || 0;
    if (index > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  useAppNavigationHandler('file_manager', { onBack: handleBack });

  // Activity-level navigator 注册：用于 OS 在 foreign-task push 时（如 Settings 调用
  // ACTION_VIEW + type=inode/directory 把 FileManager Activity 推到 Settings task 上）通过
  // navigateToActivity 把内部路由切到 baseRoute（intent.route 或 filter.route）。
  // 不注册的话，OS 的 waitForNavigator 会等到 5 秒超时。
  // 默认 replace=true 保持兼容；显式 { replace: false } 时尊重 push 语义。
  useEffect(() => {
    const navFn = (path: string, opts?: { replace?: boolean }) => {
      navigate(path, { replace: opts?.replace ?? true });
    };
    AppNavigatorRegistry.registerActivity(activityId, { navigate: navFn, back: handleBack }, 'file_manager');
    return () => {
      AppNavigatorRegistry.unregisterActivity(activityId);
    };
  }, [activityId, handleBack, navigate]);

  return null;
};

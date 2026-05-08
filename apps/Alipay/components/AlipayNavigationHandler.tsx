import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { AppNavigatorRegistry } from '../../../os/AppNavigatorRegistry';
import { useAppNavigationHandler } from '../../../os/hooks/useAppNavigationHandler';
import { useActivityContext } from '../../../os/ActivityContext';

// 标准 App 桥接：系统返回/路由观测/（可选）外部导航
export const AlipayNavigationHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { activityId } = useActivityContext();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator?.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex =
      typeof memoryNavigator?.index === 'number' ? memoryNavigator.index : historyIndexRef.current;

    if (currentIndex > 0) {
      navigate(-1);
      return true;
    }
    return false;
  }, [navigate, navigator]);

  // Per-activity navigation registration (activity-system level)
  useEffect(() => {
    const navFn = (path: string) => {
      navigate(path, { replace: true });
    };
    AppNavigatorRegistry.registerActivity(activityId, { navigate: navFn, back: handleBackPress }, 'alipay');

    return () => {
      AppNavigatorRegistry.unregisterActivity(activityId);
    };
  }, [activityId, handleBackPress, navigate]);

  // Per-app navigation registration (app-lifecycle level)
  useAppNavigationHandler('alipay', { onBack: handleBackPress });

  return null;
};

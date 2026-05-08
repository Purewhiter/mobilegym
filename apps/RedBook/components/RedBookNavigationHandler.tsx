import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { useAppNavigationHandler } from '../../../os/hooks/useAppNavigationHandler';
import { realNow } from '../../../os/TimeService';

const EXIT_INTERVAL = 2000; // 2秒内双击退出
const ROOT_PATHS = ['/', '/market', '/message', '/me'];
const ROOT_OVERLAY_PARAMS = ['menu', 'modal'];

type RedBookBackIntent =
  | { type: 'history-back' }
  | { type: 'replace'; to: string }
  | { type: 'finish' }
  | { type: 'toast'; goHome: boolean };

export function getRedBookBackIntent(options: {
  pathname: string;
  search: string;
  currentIndex: number;
  lastBackTime: number;
  now: number;
}): RedBookBackIntent {
  const { pathname, search, currentIndex, lastBackTime, now } = options;
  const isRootPath = ROOT_PATHS.includes(pathname);
  const searchParams = new URLSearchParams(search);
  const hasRootOverlay = ROOT_OVERLAY_PARAMS.some(key => searchParams.has(key));

  if (isRootPath && hasRootOverlay) {
    if (currentIndex > 0) return { type: 'history-back' };
    return { type: 'replace', to: buildRootPathWithoutOverlay(pathname, searchParams) };
  }

  if (isRootPath) {
    if (now - lastBackTime < EXIT_INTERVAL) return { type: 'finish' };
    return { type: 'toast', goHome: pathname === '/message' || pathname === '/me' };
  }

  if (currentIndex > 0) return { type: 'history-back' };
  return { type: 'replace', to: '/?tab=discover' };
}

function buildRootPathWithoutOverlay(pathname: string, searchParams: URLSearchParams): string {
  ROOT_OVERLAY_PARAMS.forEach(key => searchParams.delete(key));
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

// 标准 App 桥接：系统返回/路由观测/（可选）外部导航
export const RedBookNavigationHandler: React.FC = () => {
  const s = useRedBookStrings();
  const location = useLocation();
  const navigate = useNavigate();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const historyIndexRef = useRef(0);
  const lastBackTimeRef = useRef(0);
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 1500);
  };

  const normalizeInitialRoute = useCallback((path: string): string => {
    // 允许传入 "/me"、"/me?x=y" 这类路径；为了可解析性加一个 base
    try {
      const url = new URL(path, 'http://redbook.local');
      const pathname = url.pathname;
      const params = url.searchParams;

      // Home：首页 Tab 已迁到 URL。外部直达必须提供合法地址（如 "/?tab=discover"）。

      // User：兼容外部直达时缺省 query
      if (pathname.startsWith('/user/') && pathname !== '/user/allUser') {
        // 未来如果 UserPage tab 状态迁移到 query，这里可以补默认 tab
      }

      if (pathname === '/user/allUser' && !params.has('type')) {
        // FollowList 默认：关注（type=1）
        params.set('type', '1');
      }

      const searchStr = params.toString();
      return searchStr ? `${pathname}?${searchStr}` : pathname;
    } catch {
      return path;
    }
  }, []);

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
    const now = realNow();
    const intent = getRedBookBackIntent({
      pathname: location.pathname,
      search: location.search,
      currentIndex,
      lastBackTime: lastBackTimeRef.current,
      now,
    });

    switch (intent.type) {
      case 'history-back':
        navigate(-1);
        return true;
      case 'replace':
        navigate(intent.to, { replace: true });
        return true;
      case 'finish':
        lastBackTimeRef.current = 0;
        window.__OS__?.finishActivity?.();
        return true;
      case 'toast':
        lastBackTimeRef.current = now;
        showToast(s.press_again_to_go_home);
        if (intent.goHome) {
          navigate('/?tab=discover', { replace: true });
        }
        return true;
    }
  }, [location.pathname, location.search, navigate, navigator, s.press_again_to_go_home]);

  useAppNavigationHandler('redbook', {
    onBack: handleBackPress,
    onNavigate: (path, navigateToPath) => {
      navigateToPath(normalizeInitialRoute(path));
    },
  });

  // 渲染居中 Toast
  return toast.show ? (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
      <div className="bg-black/80 text-white px-6 py-3 rounded-lg text-sm font-medium shadow-lg animate-in fade-in zoom-in-95 duration-200">
        {toast.msg}
      </div>
    </div>
  ) : null;
};

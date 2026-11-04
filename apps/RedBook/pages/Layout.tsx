import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from '../components/TabBar';

/** The main tabs: one instance each, kept while you are on another tab (ActivityRouteHost). */
export const MAIN_TAB_PATHS = ['/', '/market', '/message', '/me'] as const;

export const Layout: React.FC = () => {
  const { pathname } = useLocation();
  const isMainTab = (MAIN_TAB_PATHS as readonly string[]).includes(pathname);

  return (
    <div className="flex flex-col h-full bg-app-surface text-black relative hide-all-scrollbars" data-status-bar-foreground={pathname === '/me' ? 'light' : 'dark'}>
      <div className="flex-1 overflow-hidden relative">
        {isMainTab ? (
          <div style={{ height: '100%' }}>
            <Outlet />
          </div>
        ) : (
          <Outlet />
        )}
      </div>

      {isMainTab && <TabBar />}
    </div>
  );
};

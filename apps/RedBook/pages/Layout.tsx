import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from '../components/TabBar';

// Import pages for "Main Tab Persistent Mounting" pattern
import { HomePage } from './HomePage';
import { MePage } from './MePage';
import { MessagePage } from './MessagePage';
import { ShopPage } from './ShopPage';

export const Layout: React.FC = () => {
  const { pathname } = useLocation();
  
  // Define which paths correspond to main tabs that should be kept alive
  const isMainTab = ['/', '/market', '/message', '/me'].includes(pathname);
  
  // Hide TabBar on detail pages or publish page if needed, 
  // but usually in RedBook detail page hides it.
  // We'll show TabBar only on main tabs.
  const showTabBar = isMainTab;

  return (
    <div className="flex flex-col h-full bg-app-surface text-black relative hide-all-scrollbars" data-status-bar-foreground={pathname === '/me' ? 'light' : 'dark'}>
      <div className="flex-1 overflow-hidden relative">
         {/* 
            Persistent Views Pattern:
            We render the main tab components directly here, controlling their visibility with CSS.
            This preserves their state (scroll position, etc.) when switching tabs.
         */}
         <div style={{ display: pathname === '/' ? 'block' : 'none', height: '100%' }}>
            <HomePage />
         </div>
         <div style={{ display: pathname === '/market' ? 'block' : 'none', height: '100%' }}>
            <ShopPage />
         </div>
         <div style={{ display: pathname === '/message' ? 'block' : 'none', height: '100%' }}>
             <MessagePage />
         </div>
         <div style={{ display: pathname === '/me' ? 'block' : 'none', height: '100%' }}>
            <MePage />
         </div>
         {/* UserPage is transient, but we might want to keep it alive if we wanted to support back/forward with state,
             but for now standard routing is fine for sub-pages */}

         {/* 
            Transient Views:
            Detail pages, etc., are rendered via Outlet.
            They mount/unmount as standard routes.
         */}
         {!isMainTab && <Outlet />}
      </div>
      
      {showTabBar && <TabBar />}
    </div>
  );
};
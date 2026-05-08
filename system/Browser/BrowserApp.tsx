import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { MemoryRouter, useLocation, UNSAFE_NavigationContext, Routes, Route } from 'react-router-dom';
import { IcGlobe, IcBack, IcForward, IcRefresh, IcHome, IcSearch, IcShield, IcNavBack, IcNavForward, IcTabs, IcMoreHoriz, IcClose, IcAdd } from './res/icons';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { useBrowserStore } from './state';
import type { Tab } from './state';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useBrowserGestures } from './hooks/useBrowserGestures';

// --- Navigation Handler ---
const BrowserNavigationHandler: React.FC = () => {
    const location = useLocation();
    const { back } = useBrowserGestures();
    const { navigator } = React.useContext(UNSAFE_NavigationContext);
    const historyIndexRef = useRef(0);

    useEffect(() => {
        const memoryNavigator = navigator as any;
        if (typeof memoryNavigator.index === 'number') {
            historyIndexRef.current = memoryNavigator.index;
        }
    }, [location, navigator]);

    const handleBackPress = useCallback((): boolean => {
        const memoryNavigator = navigator as any;
        const currentIndex = typeof memoryNavigator.index === 'number'
            ? memoryNavigator.index
            : historyIndexRef.current;

        if (currentIndex > 0) {
            back();
            return true;
        }
        return false;
    }, [back, navigator]);

    useAppNavigationHandler('browser', { onBack: handleBackPress });

    return null;
};

// --- Home Component ---
const BrowserHome: React.FC<{ onNavigate: (url: string) => void }> = ({ onNavigate }) => {
    const [input, setInput] = useState('');

    const recommendations = [
        { name: '维基百科', url: 'https://zh.m.wikipedia.org', icon: 'https://zh.wikipedia.org/favicon.ico', color: 'bg-white' },
        { name: 'GitHub', url: 'https://github.com', icon: 'https://github.com/favicon.ico', color: 'bg-black' },
        { name: '百度', url: 'https://www.baidu.com', icon: 'https://www.baidu.com/favicon.ico', color: 'bg-blue-500' },
        { name: 'Bilibili', url: 'https://m.bilibili.com', icon: 'https://www.bilibili.com/favicon.ico', color: 'bg-pink-400' },
        { name: '知乎', url: 'https://www.zhihu.com', icon: 'https://www.zhihu.com/favicon.ico', color: 'bg-blue-600' },
        { name: 'React', url: 'https://react.dev', icon: 'https://react.dev/favicon.ico', color: 'bg-sky-400' },
        { name: 'Google', url: 'https://www.google.com', icon: 'https://www.google.com/favicon.ico', color: 'bg-white' },
        { name: 'Bing', url: 'https://www.bing.com', icon: 'https://www.bing.com/favicon.ico', color: 'bg-white' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        onNavigate(input.trim());
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-8 bg-app-surface animate-in fade-in overflow-hidden" style={{ animationDuration: 'var(--app-duration-long)' }}>
            <div className="mb-12 flex flex-col items-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[24px] flex items-center justify-center shadow-lg shadow-blue-200 mb-6">
                    <IcGlobe size={40} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-800">Browser</h1>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-md relative group mb-12">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <IcSearch size={20} />
                </div>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="搜索或输入网址"
                    className="w-full h-16 pl-14 pr-6 bg-slate-100/80 backdrop-blur-sm rounded-[24px] text-lg outline-none border-2 border-transparent focus:border-blue-500/20 focus:bg-white focus:shadow-xl transition-all"
                />
            </form>

            <div className="w-full max-w-md grid grid-cols-4 gap-y-8">
                {recommendations.map((item) => (
                    <button
                        key={item.name}
                        onClick={() => onNavigate(item.url)}
                        className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
                    >
                        <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center shadow-sm overflow-hidden border border-slate-100 group-hover:shadow-md transition-shadow`}>
                            <img
                                src={item.icon}
                                alt=""
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).parentElement!.classList.add('bg-slate-50');
                                    (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGExYjIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1nbG9iZSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMTIgMmExNS4zIDE1LjMgMCAwIDEgMCAyMCIvPjxwYXRoIGQ9Ik0xMiAyYTE1LjMgMTUuMyAwIDAgMCAwIDIwIi8+PHBhdGggZD0iTTIgMTJoMjAiLz48L3N2Zz4=';
                                }}
                            />
                        </div>
                        <span className="text-[12px] font-medium text-slate-600 truncate w-full text-center px-1">{item.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- WebView Component ---
const BrowserView: React.FC<{ url: string }> = ({ url }) => {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-app-surface overflow-hidden relative">
            <div className="pt-8 bg-white/80 backdrop-blur-md border-b border-slate-100 shrink-0">
                <div className="h-12 flex items-center px-4">
                    <div className="flex-1 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2 overflow-hidden">
                        <IcShield size={12} className="text-green-500 shrink-0" />
                        <span className="text-[11px] text-slate-500 truncate">{url}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                {url ? (
                    <iframe
                        src={url}
                        className="w-full h-full border-none"
                        onLoad={() => setIsLoading(false)}
                        title="browser-active-content"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                    />
                ) : null}
                {isLoading && (
                    <div className="absolute inset-0 bg-app-surface flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Tabs Overlay ---
const TabsOverlay: React.FC<{
    tabs: Tab[],
    activeTabId: string,
    onCloseTab: (id: string, e: React.MouseEvent) => void,
    onSelectTab: (id: string) => void,
    onNewTab: () => void,
    onCloseOverlay: () => void
}> = ({ tabs, activeTabId, onCloseTab, onSelectTab, onNewTab, onCloseOverlay }) => {
    return (
        <div className="absolute inset-0 z-[1000] bg-slate-900/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom" style={{ animationDuration: 'var(--app-duration-medium)' }}>
            <div className="h-16 flex items-center justify-between px-6 shrink-0">
                <h2 className="text-white text-xl font-semibold">标签页</h2>
                <button onClick={onCloseOverlay} className="text-white/60 hover:text-white"><IcClose size={dimens.tabs_overlay_close_icon} /></button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 grid grid-cols-2 gap-4">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        onClick={() => onSelectTab(tab.id)}
                        className={`aspect-[3/4] rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all ${tab.id === activeTabId ? 'ring-4 ring-blue-500 scale-100' : 'bg-white/10 scale-95'}`}
                    >
                        <div className="flex-1 bg-white/5 rounded-lg flex items-center justify-center mb-2">
                            <IcGlobe size={32} className="text-white/20" />
                        </div>
                        <div className="text-xs text-white font-medium truncate mb-1">{tab.title || '新标签页'}</div>
                        <div className="text-[10px] text-white/40 truncate">{tab.url}</div>
                        <button
                            onClick={(e) => onCloseTab(tab.id, e)}
                            className="absolute top-2 right-2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center text-white"
                        >
                            <IcClose size={14} />
                        </button>
                    </div>
                ))}
                <button
                    onClick={onNewTab}
                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/40 active:bg-white/5 transition-colors"
                >
                    <IcAdd size={32} />
                    <span className="text-xs">新标签页</span>
                </button>
            </div>
        </div>
    );
};

// --- Main App Logic ---
const BrowserContent: React.FC = () => {
    const { go, back, bindBack } = useBrowserGestures();
    const location = useLocation();
    const { navigator } = React.useContext(UNSAFE_NavigationContext);

    // Store state
    const tabs = useBrowserStore(s => s.tabs);
    const activeTabId = useBrowserStore(s => s.activeTabId);
    const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

    // Store actions (stable refs)
    const navigateTab = useBrowserStore(s => s.navigateTab);
    const storeAddTab = useBrowserStore(s => s.addTab);
    const storeCloseTab = useBrowserStore(s => s.closeTab);
    const storeGoHome = useBrowserStore(s => s.goHome);
    const setActiveTabId = useBrowserStore(s => s.setActiveTabId);
    const trackVisitedUrl = useBrowserStore(s => s.trackVisitedUrl);

    const [isTabsOverlayOpen, setIsTabsOverlayOpen] = useState(false);

    // Track visited URLs
    useEffect(() => {
        if (activeTab.url) {
            trackVisitedUrl(activeTab.url);
        }
    }, [activeTab.url, trackVisitedUrl]);

    const handleNavigate = (input: string) => {
        let target = input.trim();
        if (!target.startsWith('http')) {
            if (target.includes('.') && !target.includes(' ')) {
                target = 'https://' + target;
            } else {
                target = `https://www.bing.com/search?q=${encodeURIComponent(target)}`;
            }
        }
        navigateTab(activeTabId, target);
        go('view.open');
    };

    const handleNewTab = () => {
        storeAddTab();
        setIsTabsOverlayOpen(false);
        go('home.open');
    };

    const handleCloseTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const result = storeCloseTab(id);
        if (id === activeTabId || tabs.length === 1) {
            if (result.newActiveTabHasUrl) {
                go('view.open');
            } else {
                go('home.open');
            }
        }
    };

    const currentHistoryPos = (navigator as any).index || 0;
    const canGoBack = currentHistoryPos > 0;
    const canGoForward = false; // MemoryRouter Forward is tricky to detect easily

    return (
        <div className="h-full min-h-0 w-full flex flex-col bg-app-surface overflow-hidden select-none">
            <BrowserNavigationHandler />

            {/* Content */}
            <div className="flex-1 relative flex flex-col overflow-hidden">
                <Routes>
                    <Route path="/" element={<BrowserHome onNavigate={handleNavigate} />} />
                    <Route path="/view" element={<BrowserView url={activeTab.url} />} />
                </Routes>
            </div>

            {/* Bottom Bar */}
            <div className="h-(--app-bottom-bar-height) shrink-0 bg-app-surface border-t border-slate-100 px-6 flex items-center justify-between pb-safe">
                <button
                    {...bindBack()}
                    disabled={!canGoBack}
                    className="w-12 h-12 flex items-center justify-center text-slate-400 disabled:opacity-10 active:bg-slate-50 rounded-full"
                >
                    <IcNavBack size={dimens.bottom_nav_icon_size} />
                </button>

                <button
                    onClick={() => {}}
                    disabled={!canGoForward}
                    className="w-12 h-12 flex items-center justify-center text-slate-400 disabled:opacity-10 active:bg-slate-50 rounded-full"
                >
                    <IcNavForward size={dimens.bottom_nav_icon_size} />
                </button>

                <button
                    onClick={() => {
                        if (activeTab.url) {
                            storeGoHome(activeTabId);
                        }
                        go('home.open');
                    }}
                    className={`w-14 h-14 flex items-center justify-center rounded-[20px] transition-all ${location.pathname === '/' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-500 active:bg-slate-50'}`}
                >
                    <IcHome size={dimens.bottom_home_icon_size} />
                </button>

                <button
                    onClick={() => setIsTabsOverlayOpen(true)}
                    className="w-12 h-12 flex items-center justify-center text-slate-500 relative active:bg-slate-50 rounded-full"
                >
                    <IcTabs size={dimens.tabs_icon_size} />
                    <span className="absolute top-2 right-2 bg-slate-800 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{tabs.length}</span>
                </button>

                <button className="w-12 h-12 flex items-center justify-center text-slate-500 active:bg-slate-50 rounded-full">
                    <IcMoreHoriz size={dimens.bottom_more_icon_size} />
                </button>
            </div>

            {/* Tabs Overlay */}
            {isTabsOverlayOpen && (
                <TabsOverlay
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onCloseTab={handleCloseTab}
                    onSelectTab={(id) => {
                        setActiveTabId(id);
                        setIsTabsOverlayOpen(false);
                        const target = tabs.find(t => t.id === id);
                        if (target?.url) {
                            go('view.open');
                        } else {
                            go('home.open');
                        }
                    }}
                    onNewTab={handleNewTab}
                    onCloseOverlay={() => setIsTabsOverlayOpen(false)}
                />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        iframe { scrollbar-width: none; }
        iframe::-webkit-scrollbar { display: none; }
      `}} />
        </div>
    );
};

export const BrowserApp: React.FC = () => {
    const { isDark } = useDarkMode();
    const themeColors = isDark
        ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
        : manifest.theme.colors;
    const appColors = isDark ? { ...colors, ...colorsDark } : colors;
    const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
    const cssVars = {
        ...themeToCssVars(applySkinToThemeColors(themeColors)),
        ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
        ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
        ...dimensToCssVars(dimens),
        ...dimensToCssVars(anim, { prefix: '--app-' }),
    };
    return (
        <div className="h-full w-full" style={cssVars as React.CSSProperties}>
        <MemoryRouter>
            <BrowserContent />
        </MemoryRouter>
        </div>
    );
};

export default BrowserApp;

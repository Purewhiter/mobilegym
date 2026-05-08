import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import {
  IcMenu,
  IcSearch,
  IcExpand,
  IcFilter,
  IcMoreVert,
  IcTabHome,
  IcExternalLink,
  IcPlay,
  IcFeature,
  IcNews,
  IcNavForward,
  IcTrend,
  IcShield,
  IcCoins,
  IcListFilter,
  IcScrollText,
  IcLock,
  IcFile,
  IcHandHeart,
  IcGamepad,
} from '../res/icons';
import { useRedditStore } from '../state';
import { useRedditGestures } from '../hooks/useRedditGestures';

const asset = (resource: unknown) => {
  const src = String(resource ?? '').trim();
  return !src || src.startsWith('http') ? src : `/@app-assets/Reddit/${src}`;
};

interface TopBarProps {
  title?: string;
  isHome?: boolean;
  rightAction?: 'search' | 'filter' | 'more' | 'none';
  rightSlot?: React.ReactNode;
}

type DrawerSectionKey = 'games' | 'pro' | 'resources' | 'communities' | 'about';

export const TopBar: React.FC<TopBarProps> = ({
  title,
  isHome,
  rightAction = 'search',
  rightSlot,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const user = useRedditStore((state) => state.user);
  const location = useLocation();
  const { bindTap, bindBack, go } = useRedditGestures();

  const menu = new URLSearchParams(location.search).get('menu');
  const isHomeMenuOpen = Boolean(isHome && menu === 'home');
  const isDrawerOpen = menu === 'drawer';

  const closeDrawerBinding = bindBack<HTMLDivElement>();
  const closeHomeMenuBinding = bindBack<HTMLDivElement>();
  const profileOpenBinding = bindTap('profile.me.open');

  const drawerOpenBinding = (() => {
    if (isDrawerOpen) return bindBack<HTMLDivElement>();
    if (location.pathname === '/') return bindTap('home.drawer.open');
    if (location.pathname === '/communities') return bindTap('communities.drawer.open');
    if (location.pathname === '/chat') return bindTap('chat.drawer.open');
    if (location.pathname === '/inbox') return bindTap('inbox.drawer.open');
    return null;
  })();

  const [drawerSections, setDrawerSections] = React.useState<Record<DrawerSectionKey, boolean>>({
    games: true,
    pro: false,
    resources: false,
    communities: false,
    about: false,
  });

  const toggleSection = (key: DrawerSectionKey) => {
    setDrawerSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const homeMenuItems = [
    {
      key: 'home',
      label: s.home_menu_home,
      assetName: 'home',
      alt: s.home_menu_home,
      fallback: <IcTabHome className="w-[28px] h-[28px] text-app-text" strokeWidth={2} />,
      selected: true,
    },
    {
      key: 'popular',
      label: s.home_menu_popular,
      assetName: 'popular',
      alt: s.home_menu_popular,
      fallback: <IcExternalLink className="w-[28px] h-[28px] text-gray-700" strokeWidth={2} />,
    },
    {
      key: 'watch',
      label: s.home_menu_watch,
      assetName: 'watch',
      alt: s.home_menu_watch,
      fallback: <IcPlay className="w-[28px] h-[28px] text-gray-700" strokeWidth={2} />,
    },
    {
      key: 'latest',
      label: s.home_menu_latest,
      assetName: 'latest',
      alt: s.home_menu_latest,
      fallback: <IcFeature className="w-[28px] h-[28px] text-gray-700" strokeWidth={2} />,
    },
    {
      key: 'games',
      label: s.home_menu_games,
      assetName: 'games',
      alt: s.home_menu_games,
      fallback: <IcGamepad className="w-[28px] h-[28px] text-gray-700" strokeWidth={2} />,
    },
    {
      key: 'news',
      label: s.home_menu_news,
      assetName: 'news',
      alt: s.home_menu_news,
      fallback: <IcNews className="w-[28px] h-[28px] text-gray-700" strokeWidth={2} />,
    },
  ];

  const gameItems = [
    { name: 'romkerl', iconText: 'R' },
    { name: 'Quiz Planet', iconText: 'Q' },
    { name: 'BattleBirds', iconText: 'B' },
  ];

  const MenuIconImg: React.FC<{
    name: string;
    alt: string;
    fallback: React.ReactNode;
    sizePx?: number;
  }> = ({ name, alt, fallback, sizePx = 30 }) => {
    const [failed, setFailed] = React.useState(false);
    return (
      <span style={{ width: sizePx, height: sizePx }} className="flex items-center justify-center">
        {failed ? (
          fallback
        ) : (
          <img
            src={asset(`icons/${name}.png`)}
            alt={alt}
            style={{ width: sizePx, height: sizePx }}
            className="object-contain"
            draggable={false}
            onError={() => setFailed(true)}
          />
        )}
      </span>
    );
  };

  const DrawerRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center gap-3 py-3 select-none cursor-pointer active:bg-gray-50 rounded-lg px-2 -mx-2">
      {children}
    </div>
  );

  const DrawerSectionHeader: React.FC<{
    label: string;
    sectionKey: DrawerSectionKey;
  }> = ({ label, sectionKey }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center justify-between py-4 select-none cursor-pointer active:bg-gray-50 rounded-lg px-2 -mx-2"
    >
      <span className="text-[18px] font-semibold text-app-text">{label}</span>
      <IcNavForward
        className={`w-5 h-5 text-app-text-muted transition-transform ${drawerSections[sectionKey] ? 'rotate-90' : ''}`}
      />
    </div>
  );

  return (
    <div className="sticky top-0 z-50 bg-app-surface relative">
      {isHomeMenuOpen && (
        <div
          {...closeHomeMenuBinding}
          className="fixed inset-0 bg-black/30 z-40"
          aria-label="Close home menu"
        />
      )}

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[300]">
          <div
            {...closeDrawerBinding}
            className="absolute inset-0 bg-black/20"
            aria-label="Close drawer"
          />

          <div
            className="absolute left-0 top-0 bottom-0 w-[78%] max-w-[360px] bg-app-surface shadow-[2px_0_24px_rgba(0,0,0,0.16)]"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="pt-10 pb-4 h-full overflow-y-auto no-scrollbar">
              <div className="px-6 pb-2">
                <div className="flex items-center justify-between py-4 select-none rounded-lg px-2 -mx-2">
                  <span className="text-[18px] font-semibold text-app-text">
                    {s.drawer_discover_communities}
                  </span>
                  <IcNavForward className="w-5 h-5 text-gray-400" />
                </div>

                <div className="flex items-center justify-between py-4 select-none rounded-lg px-2 -mx-2">
                  <span className="text-[18px] font-semibold text-app-text">
                    {s.drawer_create_community}
                  </span>
                  <IcNavForward className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              <div className="px-6">
                <DrawerSectionHeader label={s.drawer_games_on_reddit} sectionKey="games" />
                {drawerSections.games && (
                  <div className="pb-2">
                    {gameItems.map((game) => (
                      <DrawerRow key={game.name}>
                        <div className="w-8 h-8 rounded-full bg-gray-100 border border-app-border flex items-center justify-center text-gray-700 font-bold">
                          {game.iconText}
                        </div>
                        <span className="text-[16px] font-medium text-app-text">{game.name}</span>
                      </DrawerRow>
                    ))}

                    <DrawerRow>
                      <IcGamepad className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_discover_more_games}
                      </span>
                    </DrawerRow>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 my-2" />

              <div className="px-6">
                <DrawerSectionHeader label={s.drawer_reddit_pro} sectionKey="pro" />
                {drawerSections.pro && (
                  <div className="pb-2">
                    <DrawerRow>
                      <IcTrend className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_trending}
                      </span>
                    </DrawerRow>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 my-2" />

              <div className="px-6">
                <DrawerSectionHeader label={s.drawer_resources} sectionKey="resources" />
                {drawerSections.resources && (
                  <div className="pb-2">
                    <DrawerRow>
                      <IcShield className="w-5 h-5 text-gray-600" />
                      <div className="flex flex-col leading-tight">
                        <span className="text-[16px] font-medium text-app-text">Reddit Premium</span>
                        <span className="text-[12px] text-app-text-muted">
                          {s.drawer_ad_free_browsing}
                        </span>
                      </div>
                    </DrawerRow>

                    <DrawerRow>
                      <IcCoins className="w-5 h-5 text-gray-600" />
                      <div className="flex flex-col leading-tight">
                        <span className="text-[16px] font-medium text-app-text">
                          {s.drawer_monetize}
                        </span>
                        <span className="text-[12px] text-app-text-muted">
                          {s.drawer_monetize_desc}
                        </span>
                      </div>
                    </DrawerRow>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 my-2" />

              <div className="px-6">
                <DrawerSectionHeader label={s.drawer_your_communities} sectionKey="communities" />
                {drawerSections.communities && (
                  <div className="pb-2">
                    <DrawerRow>
                      <IcListFilter className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_custom_feed}
                      </span>
                    </DrawerRow>
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 my-2" />

              <div className="px-6">
                <div className="flex items-center gap-3 py-4 select-none cursor-pointer active:bg-gray-50 rounded-lg px-2 -mx-2">
                  <div className="w-[26px] h-[26px] rounded-full border border-gray-300 flex items-center justify-center shrink-0">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-gray-700"
                    >
                      <path d="M6 20V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 20V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M18 20V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="text-[16px] font-medium text-app-text">{s.drawer_all}</span>
                </div>
              </div>

              <div className="h-px bg-gray-200 my-2" />

              <div className="px-6">
                <DrawerSectionHeader label={s.drawer_about} sectionKey="about" />
                {drawerSections.about && (
                  <div className="pb-2">
                    <DrawerRow>
                      <IcScrollText className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_reddit_rules}
                      </span>
                    </DrawerRow>

                    <DrawerRow>
                      <IcLock className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_privacy_policy}
                      </span>
                    </DrawerRow>

                    <DrawerRow>
                      <IcFile className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_user_agreement}
                      </span>
                    </DrawerRow>

                    <DrawerRow>
                      <IcHandHeart className="w-5 h-5 text-gray-600" />
                      <span className="text-[16px] font-medium text-app-text">
                        {s.drawer_acknowledgements}
                      </span>
                    </DrawerRow>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-10 pb-3 bg-app-surface relative z-50">
        <div className="flex items-center gap-4">
          {drawerOpenBinding ? (
            <div {...drawerOpenBinding} className="cursor-pointer select-none">
              <IcMenu className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
            </div>
          ) : (
            <IcMenu className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
          )}

          {isHome ? (
            <div className="relative">
              <div
                {...(isHomeMenuOpen ? bindBack<HTMLDivElement>() : bindTap('home.menu.open'))}
                className="flex items-center gap-1 cursor-pointer select-none active:opacity-80 transition-opacity"
              >
                <span className="font-black text-[22px] tracking-tight text-app-primary leading-none">
                  reddit
                </span>
                <IcExpand
                  className={`w-5 h-5 text-gray-700 transition-transform ${isHomeMenuOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2.5}
                />
              </div>

              {isHomeMenuOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-[240px] max-w-[78vw] bg-app-surface rounded-2xl border border-gray-100 shadow-[0_12px_28px_rgba(0,0,0,0.14)] overflow-hidden">
                  <div className="py-2">
                    {homeMenuItems.map((item) => (
                      <div
                        key={item.key}
                        className={`flex items-center gap-4 px-5 py-3 ${item.selected ? 'bg-gray-100' : ''}`}
                      >
                        <MenuIconImg
                          name={item.assetName}
                          alt={item.alt}
                          fallback={item.fallback}
                          sizePx={28}
                        />
                        <span className="text-[16px] font-semibold text-app-text">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="font-bold text-lg text-black">{title}</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {rightSlot}
          {rightAction === 'search' && (
            <button
              onClick={() => go('search.open', {})}
              className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
              aria-label="Search"
            >
              <IcSearch className="w-6 h-6 text-gray-700" strokeWidth={2} />
            </button>
          )}
          {rightAction === 'filter' && (
            <IcFilter className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
          )}
          {rightAction === 'more' && (
            <IcMoreVert className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
          )}
          {rightAction === 'none' && null}

          <div
            {...profileOpenBinding}
            className="relative w-8 h-8 rounded-full bg-gray-200 overflow-hidden cursor-pointer select-none"
            aria-label="Open profile"
          >
            {user.avatar ? (
              <img src={user.avatar} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full bg-purple-400 flex items-center justify-center">
                <img
                  src={asset('others/u_wherewindsmeet.png')}
                  className="w-6 h-6 opacity-70"
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            {user.isOnline && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

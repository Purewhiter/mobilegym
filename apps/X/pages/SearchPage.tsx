import React from 'react';
import { useLocation } from 'react-router-dom';
import { useXStore, selectTrends, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';

export const SearchPage: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const trends = selectTrends();
  const user = useXStore(selectUser);
  const location = useLocation();
  const { bindTap } = useXGestures(isActive);
  const s = useXStrings();

  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');
  const activeTab: 'foryou' | 'trending' | 'news' | 'sports' | 'entertainment' =
    tab === 'foryou' || tab === 'trending' || tab === 'news' || tab === 'sports' || tab === 'entertainment'
      ? tab
      : 'foryou';

  const filteredTrends = React.useMemo(() => {
    switch (activeTab) {
      case 'foryou':
        return trends.filter(trend => trend.type === 'promoted' || trend.type === 'standard');
      case 'trending':
        return trends.filter(trend => trend.type === 'standard' || trend.type === 'promoted');
      case 'news':
        return [];
      case 'sports':
        return trends.filter(trend => trend.type === 'sports_match');
      case 'entertainment':
        return trends.filter(trend => trend.id.startsWith('e'));
      default:
        return trends;
    }
  }, [activeTab, trends]);

  const tabs = [
    { key: 'foryou', label: s.search_tab_foryou, transitionId: 'search.tab.toForyou' as const },
    { key: 'trending', label: s.search_tab_trending, transitionId: 'search.tab.toTrending' as const },
    { key: 'news', label: s.search_tab_news, transitionId: 'search.tab.toNews' as const },
    { key: 'sports', label: s.search_tab_sports, transitionId: 'search.tab.toSports' as const },
    { key: 'entertainment', label: s.search_tab_entertainment, transitionId: 'search.tab.toEntertainment' as const },
  ];

  return (
    <div className="flex flex-col pt-10 bg-app-bg min-h-full text-app-text">
      <div className="px-4 py-2 flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-app-text font-bold overflow-hidden cursor-pointer" {...bindTap('search.drawer.open')}>
          {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.name[0]}
        </div>
        <div className="flex-1 bg-app-surface rounded-full px-4 py-2 text-gray-500 text-center cursor-pointer" {...bindTap('search.input.open')}>
          ⌕ {s.search_input_placeholder}
        </div>
        <div className="w-6 text-center">⋯</div>
      </div>

      <div className="flex border-b border-app-border mt-2 overflow-x-auto no-scrollbar">
        {tabs.map(({ key, label, transitionId }) => (
          <div
            key={key}
            className={`px-4 py-2 whitespace-nowrap cursor-pointer relative ${activeTab === key ? 'font-bold' : 'text-gray-500'}`}
            {...bindTap(transitionId)}
          >
            {label}
            {activeTab === key && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-full" />}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'foryou' && (
          <div className="border-b border-app-border relative h-48 bg-app-surface flex items-end p-4 overflow-hidden">
            {trends.find(trend => trend.id === 't_promo_1')?.image && (
              <img src={trends.find(trend => trend.id === 't_promo_1')?.image} alt="Promo trend" className="absolute inset-0 w-full h-full object-cover opacity-60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div className="relative z-10">
              <div className="text-sm font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                {trends.find(trend => trend.id === 't_promo_1')?.category}
              </div>
              <div className="text-xl font-bold leading-tight w-3/4">{trends.find(trend => trend.id === 't_promo_1')?.title}</div>
            </div>
          </div>
        )}

        {activeTab === 'news' && <div className="p-8 text-2xl font-bold">{s.search_news_empty}</div>}

        {activeTab === 'sports' && (
          <div>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-xl font-bold">NFL</h2>
              <div className="flex gap-2">
                <span className="bg-app-text text-app-bg px-3 py-1 rounded-full text-sm font-bold">{s.search_sports_schedule}</span>
                <span className="bg-gray-100 text-app-text px-3 py-1 rounded-full text-sm font-bold">{s.search_sports_standings}</span>
                <span className="bg-gray-100 text-app-text px-3 py-1 rounded-full text-sm font-bold">{s.search_sports_news}</span>
              </div>
            </div>
            {filteredTrends.map(match => (
              <div key={match.id} className="mx-4 mb-3 bg-gray-100 border border-app-border rounded-xl p-4 flex justify-between items-center">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{match.meta.team1.logo}</span>
                    <span className="font-bold">{match.meta.team1.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{match.meta.team2.logo}</span>
                    <span className="font-bold">{match.meta.team2.name}</span>
                  </div>
                </div>
                <div className="text-right text-gray-400 text-sm border-l border-app-border pl-4">
                  <div>{match.meta.time.split(' ')[0]}</div>
                  <div className="text-lg text-app-text font-bold mt-1">{match.meta.time.split(' ')[1]}</div>
                </div>
              </div>
            ))}
            <div className="bg-blue-900 mx-4 p-3 rounded-xl flex justify-between items-center mt-2">
              <span className="text-sm">Presented by <span className="font-bold">AMERICAN EXPRESS</span></span>
              <span className="font-bold text-sm">{s.search_sports_full_schedule}</span>
            </div>
          </div>
        )}

        {(activeTab === 'foryou' || activeTab === 'trending' || activeTab === 'entertainment') && (
          <div>
            {activeTab === 'trending' && (
              <div className="border-b border-app-border relative h-40 bg-app-bg flex items-end p-4 overflow-hidden mx-4 mt-4 rounded-xl border border-app-border">
                <img src="https://pbs.twimg.com/media/GhV3RrObsAAEetk.jpg" alt="Global trends" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                <div className="relative z-10">
                  <div className="text-xl font-bold">{s.search_global_trends_title}</div>
                  <div className="text-sm text-gray-500">{s.search_global_trends_subtitle}</div>
                  <button className="mt-2 bg-white border border-gray-300 rounded-full px-4 py-1 text-sm font-bold text-app-text">
                    {s.search_global_trends_explore}
                  </button>
                </div>
              </div>
            )}

            {filteredTrends.filter(trend => !trend.image && trend.type !== 'sports_match').map(trend => (
              <div key={trend.id} className="py-3 px-4 border-b border-app-border flex justify-between items-start active:bg-black/5 cursor-pointer transition-colors" {...bindTap('trend.open', { params: { id: trend.id } })}>
                <div>
                  {activeTab === 'trending' ? (
                    <div className="font-bold text-md">{trend.title}</div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500">{trend.category}</div>
                      <div className="font-bold text-md mt-0.5">{trend.title}</div>
                    </>
                  )}
                  {trend.subtitle && <div className="text-sm text-gray-500 mt-0.5">{trend.subtitle}</div>}
                  {trend.postsCount && <div className="text-xs text-gray-500 mt-0.5">{trend.postsCount}</div>}
                </div>
                <div className="text-gray-500">⋯</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div {...bindTap('compose.open')} className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-3xl shadow-lg cursor-pointer z-50">
        +
      </div>
    </div>
  );
};

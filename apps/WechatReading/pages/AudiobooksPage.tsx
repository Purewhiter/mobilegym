import React from 'react';
import { useLocation } from 'react-router-dom';
import { WECHAT_READING_CONFIG } from '../data';
import { IcSearch, IcAdd, IcMessage, IcHeart, IcShare, IcPlay } from '../res/icons';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { dimens } from '../res/dimens';

function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

const AudiobooksPage: React.FC = () => {
  const audioSubTab = useWechatReadingStore(s => s._temp.audioSubTab);
  const recommendedAudiobooks = useWechatReadingStore(s => s.recommendedAudiobooks) ?? [];
  const refreshRecommendedAudiobooks = useWechatReadingStore(s => s.refreshRecommendedAudiobooks);
  const { bindTap, go } = useWechatReadingGestures();
  const s = useWechatReadingStrings();
  const location = useLocation();

  React.useEffect(() => {
    if (location.pathname !== '/audiobooks') return;
    const raw = new URLSearchParams(location.search).get('sub');
    if (raw !== 'audio' && raw !== 'community') {
      go('audiobooks.tab.switch', { sub: 'audio' });
    }
  }, [go, location.pathname, location.search]);

  const communityTabs = [
    s.audiobooks_community_recommended,
    s.audiobooks_community_following,
    s.audiobooks_community_chat,
    s.audiobooks_community_topics,
    s.audiobooks_community_mine,
  ];

  return (
    <div data-scroll-container="main" data-scroll-direction="vertical" className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100) relative overflow-y-auto no-scrollbar pb-16">
      <div className="pt-10 pb-2 px-4 bg-app-surface/95 backdrop-blur-sm sticky top-0 z-40 flex flex-col gap-3">
        <div className="flex items-center justify-center gap-8 text-lg font-medium pt-2">
          <button
            {...bindTap<HTMLButtonElement>('audiobooks.tab.switch', { params: { sub: 'audio' } })}
            className={`${audioSubTab === 'audio' ? 'text-app-primary scale-105' : 'text-(--app-c-tw-text-slate-500)'}`}
            style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {s.audiobooks_tab_audiobook}
          </button>
          <button
            {...bindTap<HTMLButtonElement>('audiobooks.tab.switch', { params: { sub: 'community' } })}
            className={`${audioSubTab === 'community' ? 'text-app-primary scale-105' : 'text-(--app-c-tw-text-slate-500)'}`}
            style={{ transition: 'all var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {s.audiobooks_tab_friends}
          </button>
        </div>

        {audioSubTab === 'audio' ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-9 bg-(--app-c-tw-bg-gray-100) rounded-full flex items-center px-3 gap-2">
              <IcSearch size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400)" />
              <input type="text" placeholder={s.search_placeholder_default} className="bg-transparent flex-1 text-sm outline-none placeholder-(--app-c-tw-placeholder-gray-400)" />
              <div className="w-(--app-comp-header-width-1) h-4 bg-(--app-c-tw-bg-gray-300) mx-1" />
              <span className="text-xs text-(--app-c-tw-text-gray-500) font-medium whitespace-nowrap px-1">{s.audiobooks_search_category}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm font-medium text-(--app-c-tw-text-slate-500) overflow-x-auto no-scrollbar pb-1">
            {communityTabs.map((label, index) => (
              <span
                key={label}
                className={index === 0 ? 'text-(--app-c-tw-text-slate-800) bg-black/5 px-3 py-1 rounded-full' : ''}
              >
                {label}
              </span>
            ))}
            <div className="ml-auto flex items-center justify-center w-8 h-8 rounded-full bg-(--app-c-tw-bg-gray-100)">
              <IcAdd size={dimens.icSizeAction} className="text-(--app-c-tw-text-slate-600)" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 py-4">
        {audioSubTab === 'audio' ? (
          <>
            <div className="px-4">
              <h2 className="text-lg font-bold text-(--app-c-tw-text-slate-800) mb-4">{s.audiobooks_recommended_for_you}</h2>
              <div className="grid grid-cols-3 gap-x-3 gap-y-6">
                {recommendedAudiobooks.map(id => {
                  const book = WECHAT_READING_CONFIG.audiobooks.find(item => item.id === id);
                  if (!book) return null;

                  return (
                    <div
                      key={book.id}
                      className="flex flex-col gap-2 active:opacity-70"
                      style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
                      {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
                    >
                      <div className="aspect-[3/4] rounded-lg shadow-sm relative overflow-hidden flex items-center justify-center text-center p-2" style={{ backgroundColor: book.coverColor }}>
                        <span className={`${isLightColor(book.coverColor) ? 'text-(--app-c-tw-text-slate-800)' : 'text-white'} font-bold text-sm leading-tight drop-shadow-sm`}>
                          {book.title}
                        </span>
                        <div className="absolute bottom-1.5 right-1.5">
                          <IcPlay
                            size={dimens.icSizeNavPagination}
                            className={`${isLightColor(book.coverColor) ? 'text-(--app-c-tw-text-slate-400)' : 'text-white/80'}`}
                            fill={isLightColor(book.coverColor) ? 'transparent' : 'white'}
                          />
                        </div>
                      </div>
                      <h3 className="text-xs font-semibold text-(--app-c-tw-text-slate-800) line-clamp-2 h-8 leading-tight">{book.title}</h3>
                    </div>
                  );
                })}
              </div>

              <button
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'audiobooks.recommendations.refresh.submit' },
                  { onTrigger: refreshRecommendedAudiobooks },
                )}
                className="w-full py-3 bg-app-surface mt-6 rounded-xl shadow-sm text-sm text-(--app-c-tw-text-slate-500) font-medium active:bg-(--app-c-tw-bg-slate-50)"
                style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
              >
                {s.audiobooks_refresh_batch}
              </button>
            </div>

            <div className="mt-8">
              <div className="px-4 flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-(--app-c-tw-text-slate-800)">{s.audiobooks_hot_chart}</h2>
                <span className="text-xs text-(--app-c-tw-text-slate-400)">{s.audiobooks_view_full_chart} &gt;</span>
              </div>

              <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory px-4 gap-4 pb-4">
                {[0, 1, 2].map(columnIndex => (
                  <div key={columnIndex} className="flex-shrink-0 w-[85vw] flex flex-col gap-3 snap-start">
                    {WECHAT_READING_CONFIG.hotListeningChart.slice(columnIndex * 3, (columnIndex * 3) + 3).map((bookId, index) => {
                      const book = WECHAT_READING_CONFIG.audiobooks.find(item => item.id === bookId);
                      if (!book) return null;

                      const rank = (columnIndex * 3) + index + 1;

                      return (
                        <div
                          key={book.id}
                          className="flex items-center gap-3 bg-app-surface p-3 rounded-xl shadow-sm border border-(--app-c-tw-border-slate-50) active:bg-(--app-c-tw-bg-slate-50)"
                          style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                          {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
                        >
                          <div className={`w-14 h-14 rounded-lg shrink-0 flex items-center justify-center text-(--app-audiobook-chart-thumb-text-size) text-center p-1 leading-tight font-bold overflow-hidden ${isLightColor(book.coverColor) ? 'text-(--app-c-tw-text-slate-700) border border-(--app-c-tw-border-slate-100)' : 'text-white'}`} style={{ backgroundColor: book.coverColor }}>
                            <span className="line-clamp-4">{book.title}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-lg font-bold font-mono ${rank <= 3 ? 'text-(--app-c-audiobooks-page-text-d1a0)' : 'text-(--app-c-tw-text-slate-300)'}`}>{rank}</span>
                              <h3 className="text-sm font-bold text-(--app-c-tw-text-slate-800) truncate">{book.title}</h3>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-1 pl-5">
                              <p className="text-(--app-audiobook-chart-stat-text-size) text-(--app-c-tw-text-slate-400)">{s.audiobooks_good_listen_value} {book.rating || '95%'}</p>
                              <p className="text-(--app-audiobook-chart-stat-text-size) text-(--app-c-tw-text-slate-400)">{book.plays}{s.audiobooks_listens}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4 pb-20">
            {WECHAT_READING_CONFIG.bookFriends.map(post => (
              <div key={post.id} className="bg-app-surface p-4 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-(--app-c-tw-bg-slate-200) flex items-center justify-center text-xs font-bold text-(--app-c-tw-text-slate-500) overflow-hidden">
                      {post.author[0]}
                    </div>
                    <span className="text-sm font-bold text-(--app-c-audiobooks-page-text-d1a0)">{post.author}</span>
                  </div>
                  <span className="text-xs text-(--app-c-tw-text-slate-300)">{post.time}</span>
                </div>

                <p className="text-sm text-(--app-c-tw-text-slate-700) leading-relaxed mb-4 text-justify">{post.content}</p>

                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-0.5 bg-(--app-c-tw-bg-slate-100) rounded text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-400)">{s.audiobooks_friends_tag}</span>
                  <span className="px-2 py-0.5 bg-(--app-c-tw-bg-slate-100) rounded text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-400)">{s.audiobooks_challenge_tag}</span>
                </div>

                <div className="flex items-center justify-between border-t border-(--app-c-tw-border-slate-50) pt-3 text-(--app-c-tw-text-slate-400)">
                  <button className="flex items-center gap-1 active:text-(--app-c-tw-text-slate-600)">
                    <IcShare size={dimens.icSizeChevron} />
                  </button>
                  <button className="flex items-center gap-1 active:text-(--app-c-tw-text-slate-600)">
                    <IcMessage size={dimens.icSizeChevron} />
                    <span className="text-xs">{post.comments}</span>
                  </button>
                  <button className="flex items-center gap-1 active:text-red-500 hover:text-red-500" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                    <IcHeart size={dimens.icSizeChevron} />
                    <span className="text-xs">{post.likes}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AudiobooksPage;

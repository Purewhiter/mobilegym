import React, { useState, useMemo } from 'react';
import { IcNavBack, IcClose, IcScan, IcSearch } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { WECHAT_READING_CONFIG } from '../data';
import { BOOK_BADGE_COLOR_MAP } from '../constants';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { quoteWechatReadingTitle } from '../utils/localization';

const HighlightText: React.FC<{ text: string, highlight: string, className?: string }> = ({ text, highlight, className = '' }) => {
    if (!highlight) return <span className={className}>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
        <span className={className}>
            {parts.map((part, i) =>
                part.toLowerCase() === highlight.toLowerCase()
                    ? <span key={i} className="text-(--app-c-tw-text-blue-500)">{part}</span>
                    : part
            )}
        </span>
    );
};

type SearchTab = 'all' | 'ebook' | 'audiobook' | 'fulltext' | 'author' | 'booklist';

const SearchPage: React.FC = () => {
    const { bindTap, bindBack } = useWechatReadingGestures();
    const [searchText, setSearchText] = useState('');
    const [activeTab, setActiveTab] = useState<SearchTab>('all');
    const locale = useLocale();
    const s = useWechatReadingStrings();

    const hotSearchList = WECHAT_READING_CONFIG.hotSearch;

    const tabs: { id: SearchTab; label: string }[] = [
        { id: 'all', label: s.search_tab_all },
        { id: 'ebook', label: s.search_tab_ebook },
        { id: 'audiobook', label: s.search_tab_audiobook },
        { id: 'fulltext', label: s.search_tab_fulltext },
        { id: 'author', label: s.search_tab_author },
        { id: 'booklist', label: s.search_tab_book_list },
    ];

    const searchResults = useMemo(() => {
        if (!searchText) return { authors: [], books: [], audiobooks: [] };

        const lowerText = searchText.toLowerCase();

        const authors = Array.from(new Set(
            WECHAT_READING_CONFIG.store
                .filter(b => b.author.toLowerCase().includes(lowerText))
                .map(b => b.author)
        )).map(name => ({
            name,
            avatar: 'bg-(--app-c-tw-bg-gray-200)',
            desc: locale === 'en'
                ? `Author | ${quoteWechatReadingTitle(WECHAT_READING_CONFIG.store.find(b => b.author === name)?.title || '', locale)}`
                : `${s.search_author_section} | ${quoteWechatReadingTitle(WECHAT_READING_CONFIG.store.find(b => b.author === name)?.title || '', locale)}`
        }));

        const books = WECHAT_READING_CONFIG.store.filter(b =>
            b.title.toLowerCase().includes(lowerText) ||
            b.author.toLowerCase().includes(lowerText)
        );

        const audiobooks = (WECHAT_READING_CONFIG.audiobooks || []).filter((a: any) =>
            a.title.toLowerCase().includes(lowerText) ||
            (a.author && a.author.toLowerCase().includes(lowerText))
        );

        return { authors, books, audiobooks };
    }, [locale, s.search_author_section, searchText]);

    const showAuthors = activeTab === 'all' || activeTab === 'author';
    const showBooks = activeTab === 'all' || activeTab === 'ebook';
    const showAudiobooks = activeTab === 'all' || activeTab === 'audiobook';
    const hasResults = (showAuthors && searchResults.authors.length > 0)
        || (showBooks && searchResults.books.length > 0)
        || (showAudiobooks && searchResults.audiobooks.length > 0);

    return (
        <div className="flex flex-col h-full bg-app-surface">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-2 bg-app-surface sticky top-0 z-50">
                <div
                    className="p-1 -ml-2 active:opacity-60" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
                    {...bindBack()}
                >
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-gray-600)" />
                </div>
                <div className="flex-1 h-9 bg-(--app-c-tw-bg-gray-100) rounded-full flex items-center px-3 gap-2">
                    <IcSearch size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400)" />
                    <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder={s.search_placeholder_default}
                        className="bg-transparent flex-1 text-sm outline-none placeholder-(--app-c-tw-placeholder-gray-400) text-(--app-c-tw-text-slate-800)"
                        autoFocus
                    />
                    {searchText ? (
                        <div onClick={() => setSearchText('')}>
                            <IcClose size={dimens.icSizeChevron} className="text-(--app-c-tw-text-gray-400)" />
                        </div>
                    ) : null}
                </div>
                {!searchText && (
                    <div className="p-1">
                        <IcScan size={dimens.icSizeNav} className="text-(--app-c-tw-text-gray-500)" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {!searchText ? (
                    /* Hot Search List */
                    <div className="px-4 py-2">
                        <div className="flex justify-between items-center mb-4 mt-2">
                            <h2 className="text-lg font-bold text-(--app-c-tw-text-slate-800)">{s.search_hot_list}</h2>
                            <div className="px-2 py-0.5 bg-(--app-c-tw-bg-gray-100) rounded-full text-xs text-(--app-c-tw-text-gray-500) flex items-center">
                                {s.search_more_rankings} <IcNavBack size={dimens.icSizeInlineArrow} className="rotate-180 ml-0.5" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-6">
	                            {hotSearchList.map((item, index) => (
	                                <div
	                                    key={item.id}
	                                    className="flex gap-4"
	                                    {...bindTap(
	                                      { kind: 'action', id: 'search.hot.item' },
	                                      { params: { hotId: item.id, value: item.title }, onTrigger: () => setSearchText(item.title) },
	                                    )}
	                                >
	                                    <div className={`text-lg font-bold w-4 text-center ${index < 3 ? 'text-red-500' : 'text-(--app-c-tw-text-gray-400)'}`}>
	                                        {item.rank}
	                                    </div>
                                    <div className={`w-12 h-16 ${item.coverColor} rounded shadow-sm shrink-0`} />
                                    <div className="flex flex-col justify-center flex-1 gap-1">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">{item.title}</h3>
                                        {item.subtitle ? (
                                            <div className="text-sm text-(--app-c-tw-text-gray-400) line-clamp-1">{item.subtitle}</div>
                                        ) : (
                                            <div className="text-sm text-(--app-c-tw-text-gray-400)">{item.people}</div>
                                        )}
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-(--app-c-tw-text-gray-400)">{item.metric}</span>
                                            {item.badge && (
                                                <span className={`text-(--app-title-text-size-9) px-1 py-0.5 border rounded ${BOOK_BADGE_COLOR_MAP[item.badge] || 'text-(--app-c-tw-text-gray-400) border-app-border'}`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Search Results */
                    <div>
                        {/* Tabs */}
                        <div className="flex items-center justify-around px-4 border-b border-(--app-c-tw-border-gray-100)">
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-3 text-base font-medium cursor-pointer ${
                                        activeTab === tab.id
                                            ? 'text-(--app-c-tw-text-blue-500) border-b-2 border-(--app-c-tw-border-blue-500)'
                                            : 'text-(--app-c-tw-text-gray-500)'
                                    }`}
                                >
                                    {tab.label}
                                </div>
                            ))}
                        </div>

                        <div className="bg-(--app-c-tw-bg-gray-50) min-h-screen p-3 flex flex-col gap-3">
                            {/* Authors Section */}
                            {showAuthors && searchResults.authors.length > 0 && (
                                <div className="bg-app-surface rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800)">{s.search_author_section}</h3>
                                        <div className="text-sm text-(--app-c-tw-text-gray-400) flex items-center">
                                            {s.search_more} <IcNavBack size={dimens.icSizeInlineArrow} className="rotate-180 ml-0.5" />
                                        </div>
                                    </div>
                                    {searchResults.authors.map(author => (
                                        <div key={author.name} className="flex items-center gap-3 mb-3 last:mb-0">
                                            <div className="w-10 h-10 rounded-full bg-(--app-c-tw-bg-gray-200) flex items-center justify-center text-(--app-c-tw-text-gray-500) text-sm font-bold">
                                                {author.name[0]}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="text-base font-bold text-(--app-c-tw-text-slate-800)">
                                                    <HighlightText text={author.name} highlight={searchText} />
                                                </div>
                                                <div className="text-sm text-(--app-c-tw-text-gray-400)">{author.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Books Section */}
                            {showBooks && searchResults.books.length > 0 && (
                                <div className="bg-app-surface rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800)">{s.search_ebook_section}</h3>
                                    </div>
                                    {searchResults.books.map(book => (
                                        <div
                                            key={book.id}
                                            className="flex gap-3 mb-4 last:mb-0"
                                            {...bindTap('book.detail.open', { params: { bookId: book.id } })}
                                        >
                                            <div className={`w-12 h-16 ${book.coverColor} rounded shadow-sm shrink-0 flex items-center justify-center text-(--app-item-text-size-8) p-1 text-center`}>
                                                {book.title}
                                            </div>
                                            <div className="flex flex-col justify-center flex-1 gap-1">
                                                <h4 className="text-base font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">
                                                    <HighlightText text={book.title} highlight={searchText} />
                                                </h4>
                                                <div className="text-sm text-(--app-c-tw-text-gray-400)">
                                                    <HighlightText text={book.author} highlight={searchText} />
                                                </div>
                                                <div className="text-xs text-(--app-c-tw-text-gray-400)">{s.reading_recommendation_value} {book.recommendedValue}%</div>
                                            </div>
                                            <div className="flex items-center">
                                                 <div className="bg-(--app-c-tw-bg-gray-100) px-2 py-1 rounded-full text-xs text-(--app-c-tw-text-gray-500) flex items-center gap-1">
                                                    <span>👤 19</span>
                                                 </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Audiobooks Section */}
                            {showAudiobooks && searchResults.audiobooks.length > 0 && (
                                <div className="bg-app-surface rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-base font-bold text-(--app-c-tw-text-slate-800)">{s.search_audiobook_section}</h3>
                                    </div>
                                    {searchResults.audiobooks.map((audio: any) => (
                                        <div
                                            key={audio.id}
                                            className="flex gap-3 mb-4 last:mb-0"
                                            {...bindTap('book.detail.open', { params: { bookId: audio.id } })}
                                        >
                                            <div
                                                className="w-12 h-12 rounded-lg shadow-sm shrink-0 flex items-center justify-center text-(--app-item-text-size-8) p-1 text-center text-white font-bold"
                                                style={{ backgroundColor: audio.coverColor || '#999' }}
                                            >
                                                {audio.title.slice(0, 4)}
                                            </div>
                                            <div className="flex flex-col justify-center flex-1 gap-1">
                                                <h4 className="text-base font-bold text-(--app-c-tw-text-slate-800) line-clamp-1">
                                                    <HighlightText text={audio.title} highlight={searchText} />
                                                </h4>
                                                <div className="text-sm text-(--app-c-tw-text-gray-400)">
                                                    {audio.author && <HighlightText text={audio.author} highlight={searchText} />}
                                                </div>
                                                <div className="text-xs text-(--app-c-tw-text-gray-400)">{audio.plays}次播放 · {audio.rating}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!hasResults && (
                                <div className="text-center py-10 text-(--app-c-tw-text-gray-400) text-base">
                                    {s.search_no_result}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;

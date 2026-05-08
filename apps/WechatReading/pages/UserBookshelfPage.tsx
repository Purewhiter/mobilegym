import React from 'react';
import { useParams } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { dimens } from '../res/dimens';
import { getWechatReadingBookById, getWechatReadingUserById, useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';

export const UserBookshelfPage: React.FC = () => {
    const { userId } = useParams<{ userId: string }>();
    const { bindBack, bindTap } = useWechatReadingGestures();
    const user = useWechatReadingStore(s => s.user);
    const shelf = useWechatReadingStore(s => s.shelf);
    const s = useWechatReadingStrings();

    const targetUser = getWechatReadingUserById(user, userId || '');

    if (!targetUser) return <div>User not found</div>;

    const isMe = userId === user.id || userId === 'user_me';

    const books = isMe
        ? shelf.filter(item => !item.isPrivate).map(item => getWechatReadingBookById(item.bookId)).filter(Boolean)
        : targetUser.recentBooks?.map((id: string) => getWechatReadingBookById(id)).filter(Boolean) || [];

    return (
        <div data-scroll-container="main" data-scroll-direction="vertical" className="flex flex-col h-full bg-app-surface relative overflow-y-auto no-scrollbar pb-10">
            {/* Header */}
            <div className="pt-10 pb-4 px-4 flex items-center bg-app-surface sticky top-0 z-40">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2">
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </button>
                <div className="flex-1 flex flex-col items-center mr-8">
                    <span className="text-(--app-modal-action-text-size) font-black text-(--app-c-tw-text-slate-900) leading-tight">{targetUser.name}</span>
                    <span className="text-sm font-bold text-(--app-c-tw-text-slate-800) leading-tight">{s.user_bookshelf_shelf}</span>
                </div>
            </div>

            {/* List */}
            <div className="px-5 pt-4">
                <div className="grid grid-cols-3 gap-x-5 gap-y-10">
                    {books.map((book: any) => (
                        <div
                            key={book.id}
                            className="flex flex-col gap-3 active:opacity-60" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
                            {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
                        >
                            <div className={`aspect-[3/4] ${book.coverColor || 'bg-(--app-c-tw-bg-slate-100)'} rounded shadow-sm flex items-center justify-center text-center p-2 relative overflow-hidden border border-(--app-c-tw-border-gray-50)`}>
                                <span className={`${book.coverColor === 'bg-app-surface' ? 'text-(--app-c-tw-text-slate-800)' : 'text-white'} text-(--app-tab-bar-label-size) font-bold leading-tight drop-shadow-sm`}>
                                    {book.title}
                                </span>
                                {book.coverColor === 'bg-app-surface' && (
                                    <div className="absolute inset-0 border-[0.5px] border-black/5 rounded"></div>
                                )}
                            </div>
                            <h3 className="text-sm font-bold text-(--app-c-tw-text-slate-800) line-clamp-2 h-10 leading-tight">
                                {book.title}
                            </h3>
                        </div>
                    ))}
                </div>

                <div className="mt-20 flex justify-center">
                    <span className="text-sm text-(--app-c-tw-text-slate-300) font-medium">{books.length}{s.user_bookshelf_count}</span>
                </div>
            </div>
        </div>
    );
};

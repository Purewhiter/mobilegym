import React, { useMemo } from 'react';
import {
  IcMail,
  IcFilter,
  IcNavForward,
  IcUser,
  IcClock,
  IcBook,
  IcCheckCircle,
  IcEdit,
  IcBell,
  IcList,
  IcEye,
  IcHeart,
  IcMonitor,
  IcTablet,
} from '../res/icons';
import { getWechatReadingBookById, selectFinishedBookIds, selectReadingBookIds, useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { dimens } from '../res/dimens';
import * as TimeService from '../../../os/TimeService';

function formatMessage(template: string, ...values: Array<string | number>) {
  let result = template;
  values.forEach((value, index) => {
    result = result.replace(`{${index}}`, String(value));
  });
  return result;
}

const MePage: React.FC = () => {
  const user = useWechatReadingStore(s => s.user);
  const readingRecords = useWechatReadingStore(s => s.readingRecords);
  const readingBookIds = useWechatReadingStore(selectReadingBookIds);
  const finishedBookIds = useWechatReadingStore(selectFinishedBookIds);
  const bookProgress = useWechatReadingStore(s => s.bookProgress);
  const { bindTap } = useWechatReadingGestures();
  const s = useWechatReadingStrings();

  const readingStats = useMemo(() => {
    const reading = readingBookIds
      .map(id => ({ id, book: getWechatReadingBookById(id), progress: bookProgress[id] }))
      .filter(item => item.book);
    const finished = finishedBookIds
      .map(id => ({ id, book: getWechatReadingBookById(id), progress: bookProgress[id] }))
      .filter(item => item.book);

    return {
      readingCount: reading.length,
      finishedCount: finished.length,
    };
  }, [bookProgress, finishedBookIds, readingBookIds]);

  const stats = useMemo(() => {
    const totalMinutes = readingRecords.reduce((sum, record) => sum + record.duration, 0);
    const today = TimeService.getToday();
    const currentMonth = today.substring(0, 7);
    const monthMinutes = readingRecords
      .filter(record => record.date.startsWith(currentMonth))
      .reduce((sum, record) => sum + record.duration, 0);

    return { totalMinutes, monthMinutes };
  }, [readingRecords]);

  return (
    <div data-scroll-container="main" data-scroll-direction="vertical" className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100) relative overflow-y-auto no-scrollbar pb-20">
      <div className="flex justify-between items-center px-4 pt-10 pb-4 sticky top-0 z-40 bg-(--app-c-tw-bg-slate-100)">
        <button type="button" className="text-(--app-c-tw-text-slate-600) active:opacity-60">
          <IcMail size={dimens.icSizeToolbar as number} />
        </button>
        <div className="font-medium text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800)">{user.name}</div>
        <button type="button" className="text-(--app-c-tw-text-slate-600) active:opacity-60 cursor-pointer" {...bindTap<HTMLButtonElement>('settings.open')}>
          <IcFilter size={dimens.icSizeToolbar as number} />
        </button>
      </div>

      <div className="px-4 flex items-center mb-6">
        <div className="w-16 h-16 rounded-full bg-(--app-c-tw-bg-gray-200) flex items-center justify-center overflow-hidden mr-4 active:opacity-70 cursor-pointer" {...bindTap<HTMLDivElement>('profile.edit.open')}>
          {user.avatar ? (
            <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
          ) : (
            <IcUser size={dimens.icSizeAvatarSm as number} className="text-(--app-c-tw-text-slate-300)" />
          )}
        </div>

        <div className="flex-1 active:opacity-70 cursor-pointer" {...bindTap<HTMLDivElement>('profile.my.open')}>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-(--app-c-tw-text-slate-900)">{user.name}</h1>
            <div className="px-2 py-0.5 bg-(--app-c-tw-bg-slate-200) rounded-full text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-500) font-medium z-10" onClick={e => e.stopPropagation()}>
              {s.me_badge}
            </div>
          </div>
          <div className="text-xs text-(--app-c-tw-text-slate-400) mt-1 flex items-center gap-1 min-h-(--app-item-height-16)">
            {(user.introduction || user.signature) && (
              <>
                {user.introduction && <span className="max-w-(--app-me-page-width-100) truncate">{user.introduction}</span>}
                {user.introduction && user.signature && <span className="w-(--app-comp-header-width-1) h-2.5 bg-(--app-c-tw-bg-slate-300)" />}
                {user.signature && <span className="max-w-(--app-me-page-width-150) truncate">{user.signature}</span>}
              </>
            )}
          </div>
        </div>

        <button type="button" className="text-(--app-c-tw-text-slate-300) ml-2 active:opacity-60" {...bindTap<HTMLButtonElement>('profile.my.open')}>
          <IcNavForward size={dimens.icSizeNav} />
        </button>
      </div>

      <div className="px-4 mb-3">
        <div className="bg-app-surface rounded-2xl p-4 flex items-center justify-between shadow-sm/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-500">
              <IcClock size={dimens.icSizeNavPagination} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_become_member}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400)">{s.me_first_month_deal}</span>
        </div>
      </div>

      <div className="px-4 mb-3 flex gap-3">
        <div className="flex-1 bg-app-surface rounded-2xl p-4 flex flex-col justify-center active:opacity-70 cursor-pointer" {...bindTap<HTMLDivElement>('wallet.coins.open')}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-500 flex items-center justify-center text-(--app-tab-bar-label-size) font-bold">
              C
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_coins}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-7">{s.me_balance} {user.coinBalance.toFixed(2)}</span>
        </div>
        <div className="flex-1 bg-app-surface rounded-2xl p-4 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-orange-400 rotate-45" />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_benefits}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-7">{s.me_benefits_detail}</span>
        </div>
      </div>

      <div className="px-4 mb-3">
        <div className="bg-app-surface rounded-2xl p-5 shadow-sm/50 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-400 text-white flex items-center justify-center">
                <span className="text-xs font-bold">1</span>
              </div>
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_reading_ranking}</span>
            </div>
            <div className="text-right">
              <div className="text-(--app-title-text-size-14) font-bold text-(--app-c-tw-text-slate-800)">{s.me_ranking_position}</div>
              <div className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-400)">1 {s.common_minutes_unit}</div>
            </div>
          </div>

          <div className="flex items-center justify-between active:opacity-60 cursor-pointer" {...bindTap<HTMLDivElement>('myReading.open.week')}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-400 text-white flex items-center justify-center">
                <IcClock size={dimens.icSizeChevron} />
              </div>
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_reading_duration}</span>
            </div>
            <div className="text-right">
              <div className="text-(--app-title-text-size-14) font-bold text-(--app-c-tw-text-slate-800)">{stats.totalMinutes} {s.common_minutes_unit}</div>
              <div className="text-(--app-tab-bar-label-size) text-(--app-c-tw-text-slate-400)">{s.me_this_month} {stats.monthMinutes} {s.common_minutes_unit}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-3 grid grid-cols-2 gap-3">
        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between active:opacity-70 cursor-pointer" {...bindTap<HTMLDivElement>('readingList.open.reading')}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-400 text-white flex items-center justify-center">
              <IcBook size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_reading}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9 truncate max-w-(--app-me-page-width-120)">
            {s.me_cumulative} {readingStats.readingCount}{s.me_books_unit}
          </span>
        </div>
        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between active:opacity-70 cursor-pointer" {...bindTap<HTMLDivElement>('readingList.open.finished')}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sky-400 text-white flex items-center justify-center">
              <IcCheckCircle size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_finished}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">
            {s.me_cumulative} {readingStats.finishedCount}{s.me_books_unit}
          </span>
        </div>

        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-400 text-white flex items-center justify-center">
              <IcEdit size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_notes}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">{s.me_no_notes}</span>
        </div>
        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-400 text-white flex items-center justify-center">
              <IcBell size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_subscription}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">{s.me_not_published}</span>
        </div>
      </div>

      <div className="px-4 mb-3">
        <div className="bg-app-surface rounded-2xl p-5 relative overflow-hidden">
          <div
            className="flex justify-between items-center mb-6 active:opacity-60 cursor-pointer"
            {...bindTap<HTMLDivElement>('bookLists.open')}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-400 text-white flex items-center justify-center">
                <IcList size={dimens.icSizeChevron} />
              </div>
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_book_lists}</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-(--app-c-tw-text-slate-800)">
              <span className="text-(--app-title-text-size-14)">{`1${s.me_unit_ge}`}</span>
              <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-slate-300) ml-1" />
            </div>
          </div>

          <div className="flex justify-between items-center active:opacity-60 cursor-pointer" {...bindTap<HTMLDivElement>('following.open.following')}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-fuchsia-400 text-white flex items-center justify-center">
                <IcEye size={dimens.icSizeChevron} />
              </div>
              <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_following}</span>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="flex items-center gap-1 font-medium text-(--app-c-tw-text-slate-800)">
                <span className="text-lg">{user.followerCount}</span>
                <span className="text-(--app-bookshelf-footer-text-size)">{s.me_followers_count}</span>
                <IcNavForward size={dimens.icSizeNavPagination} className="text-(--app-c-tw-text-slate-300) ml-1" />
              </div>
              <div className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-400) pr-5">
                {formatMessage(s.me_following_count, user.following.length)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-3 grid grid-cols-2 gap-3">
        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-400 text-white flex items-center justify-center">
              <IcHeart size={dimens.icSizeNavPagination} fill="white" />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_liked}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">{s.me_no_likes}</span>
        </div>
        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-pink-400 text-white flex items-center justify-center">
              <IcClock size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_browsing_history}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">{s.me_this_month_books}</span>
        </div>

        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-pink-300 text-white flex items-center justify-center">
              <IcMonitor size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_web_version}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">r.qq.com</span>
        </div>
        <div className="bg-app-surface rounded-2xl p-4 h-24 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-rose-400 text-white flex items-center justify-center">
              <IcTablet size={dimens.icSizeChevron} />
            </div>
            <span className="text-(--app-settings-item-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.me_eink}</span>
          </div>
          <span className="text-xs text-(--app-c-tw-text-slate-400) pl-9">{s.me_eink_desc}</span>
        </div>
      </div>
    </div>
  );
};

export default MePage;

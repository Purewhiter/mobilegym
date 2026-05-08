import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IcNavBack, IcExpand, IcUser } from '../res/icons';
import { dimens } from '../res/dimens';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { BOOK_BADGE_COLOR_MAP } from '../constants';
import { formatWechatReadingCount } from '../utils/localization';
import { useLocale } from '../../../os/locale';
import { TOP_CATEGORIES } from './CategoryListPage';

function getRecommendationTag(book: any): { label: string; className: string } | null {
  if (book.recommendationTag) {
    return { label: book.recommendationTag, className: 'text-amber-600' };
  }
  const val = book.recommendedValue;
  if (val == null) return null;
  if (val >= 90) return { label: '神作', className: 'text-amber-600' };
  if (val >= 85) return { label: '好评如潮', className: BOOK_BADGE_COLOR_MAP['好评如潮']?.split(' ')[0] || 'text-red-500' };
  if (val >= 75) return { label: '值得一读', className: 'text-blue-500' };
  return null;
}

const SUB_ALL = '__all__';

const CategoryDetailPage: React.FC = () => {
  const { categoryName } = useParams<{ categoryName: string }>();
  const { bindBack, bindTap } = useWechatReadingGestures();
  const s = useWechatReadingStrings();
  const locale = useLocale();

  // 查找顶级分类映射
  const topCategory = TOP_CATEGORIES.find(c => c.name === categoryName);
  const dataCategories = topCategory?.dataCategories ?? [];

  // 子分类列表（当有多个数据分类时显示 tag 切换）
  const subCategories = useMemo(() => {
    if (dataCategories.length <= 1) return [];
    return [SUB_ALL, ...dataCategories];
  }, [dataCategories]);

  const [activeSubCat, setActiveSubCat] = useState(SUB_ALL);

  // 过滤书籍
  const books = useMemo(() => {
    let filtered;
    if (dataCategories.length === 0) {
      filtered = [...WECHAT_READING_CONFIG.store];
    } else if (activeSubCat === SUB_ALL || subCategories.length === 0) {
      filtered = WECHAT_READING_CONFIG.store.filter(b => dataCategories.includes(b.category ?? ''));
    } else {
      filtered = WECHAT_READING_CONFIG.store.filter(b => b.category === activeSubCat);
    }
    return filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }, [dataCategories, activeSubCat, subCategories.length]);

  return (
    <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-50)">
      {/* Header */}
      <div className="flex items-center px-4 pt-10 pb-3 bg-white sticky top-0 z-10">
        <div className="w-10 flex justify-start" {...bindBack()}>
          <IcNavBack size={dimens.icSizeTab} className="text-(--app-c-tw-text-slate-800)" />
        </div>
        <div className="flex-1 text-center text-lg font-bold text-(--app-c-tw-text-slate-900)">{categoryName}</div>
        <div className="w-10" />
      </div>

      {/* Subcategory tags */}
      {subCategories.length > 0 && (
        <div className="bg-white px-4 pt-3 pb-4 border-b border-(--app-c-tw-bg-gray-100) shrink-0">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {subCategories.map(sub => (
              <span
                key={sub}
                onClick={() => setActiveSubCat(sub)}
                className={`text-sm cursor-pointer ${
                  activeSubCat === sub
                    ? 'text-app-primary font-bold'
                    : 'text-(--app-c-tw-text-gray-600)'
                }`}
              >
                {sub === SUB_ALL ? s.category_sub_all : sub}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar (decorative) */}
      <div className="flex items-center justify-around py-3 bg-white border-b border-(--app-c-tw-bg-gray-100) shrink-0">
        {[s.category_filter_word_count, s.category_filter_payment_type, s.category_filter_popularity].map(label => (
          <div key={label} className="flex items-center gap-0.5 text-sm text-(--app-c-tw-text-gray-500)">
            <span>{label}</span>
            <IcExpand size={12} />
          </div>
        ))}
      </div>

      {/* Book list */}
      <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar">
        {books.map(book => {
          const tag = getRecommendationTag(book);
          return (
            <div
              key={book.id}
              {...bindTap<HTMLDivElement>('book.detail.open', { params: { bookId: book.id } })}
              className="flex gap-4 px-4 py-4 bg-white border-b border-(--app-c-tw-bg-gray-50) active:bg-(--app-c-tw-bg-gray-50) cursor-pointer relative"
            >
              {/* Cover */}
              <div className={`w-24 aspect-[2/3] rounded shrink-0 relative overflow-hidden shadow-sm ${book.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}>
                {book.cover ? (
                  <img src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 p-2 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-bold opacity-90 text-(--app-c-tw-text-slate-900) leading-tight">{book.title}</span>
                    <span className="text-[8px] text-(--app-c-tw-text-slate-500) mt-0.5">{book.author}</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-base font-bold text-(--app-c-tw-text-slate-900) leading-snug line-clamp-2">{book.title}</h3>
                <div className="text-sm text-(--app-c-tw-text-gray-500) mt-1">{book.author}</div>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-sm text-(--app-c-tw-text-gray-500)">{s.reading_recommendation_value} {book.recommendedValue}%</span>
                  {tag && (
                    <span className={`text-sm font-bold ${tag.className}`}>{tag.label}</span>
                  )}
                </div>
              </div>

              {/* Reader count badge */}
              {book.totalReads != null && (
                <div className="absolute top-4 right-4 flex items-center gap-0.5 text-(--app-c-tw-text-gray-400)">
                  <IcUser size={12} />
                  <span className="text-xs">{formatWechatReadingCount(book.totalReads, locale)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryDetailPage;

import React from 'react';
import { IcNavBack } from '../res/icons';
import { dimens } from '../res/dimens';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';

// 顶级分类（参照微信读书真实 UI，完整 31 项）
// coverBookId: 指定封面书籍 id；未指定时自动从 dataCategories 匹配
const TOP_CATEGORIES: { name: string; count: number; unit: string; coverBookId?: string; dataCategories: string[] }[] = [
  // --- 第一屏 ---
  { name: '微信读书出品', count: 2791, unit: '本书籍', coverBookId: '5', dataCategories: [] },
  { name: '有声书', count: 51680, unit: '张专辑', coverBookId: '2', dataCategories: [] },
  { name: '会员专享', count: 246100, unit: '本书籍', coverBookId: '4', dataCategories: [] },
  { name: '期刊杂志', count: 3431, unit: '本书籍', coverBookId: '3', dataCategories: [] },
  { name: '历史', count: 31342, unit: '本书籍', dataCategories: ['历史'] },
  { name: '精品小说', count: 38150, unit: '本书籍', dataCategories: ['小说'] },
  { name: '文学', count: 49533, unit: '本书籍', dataCategories: ['文学', '散文'] },
  { name: '社会小说', count: 10161, unit: '本书籍', dataCategories: ['小说'] },
  { name: '影视原著', count: 1266, unit: '本书籍', coverBookId: '1', dataCategories: [] },
  { name: '个人成长', count: 15961, unit: '本书籍', dataCategories: ['成长', '励志'] },
  { name: '经济理财', count: 26180, unit: '本书籍', dataCategories: ['经济', '理财', '经管', '商业'] },
  { name: '心理', count: 5008, unit: '本书籍', dataCategories: ['心理'] },
  { name: '哲学宗教', count: 11847, unit: '本书籍', dataCategories: ['哲学'] },
  { name: '玄幻小说', count: 1749, unit: '本书籍', coverBookId: '1', dataCategories: [] },
  // --- 第二屏 ---
  { name: '悬疑推理', count: 5420, unit: '本书籍', dataCategories: ['悬疑'] },
  { name: '人物传记', count: 7067, unit: '本书籍', dataCategories: ['传记'] },
  { name: '社会文化', count: 22830, unit: '本书籍', dataCategories: [] },
  { name: '医学健康', count: 15692, unit: '本书籍', dataCategories: ['健康'] },
  { name: '政治军事', count: 8386, unit: '本书籍', dataCategories: ['政治', '军事'] },
  { name: '教育学习', count: 25106, unit: '本书籍', dataCategories: [] },
  { name: '情感小说', count: 7567, unit: '本书籍', dataCategories: ['治愈'] },
  { name: '科幻小说', count: 2148, unit: '本书籍', dataCategories: ['科幻'] },
  { name: '科学技术', count: 21155, unit: '本书籍', dataCategories: ['科技', '科普', '数学'] },
  { name: '计算机', count: 12556, unit: '本书籍', dataCategories: ['科技'] },
  { name: '童书', count: 12311, unit: '本书籍', dataCategories: ['童话'] },
  { name: '漫画', count: 1508, unit: '本书籍', coverBookId: '1', dataCategories: [] },
  { name: '生活百科', count: 5285, unit: '本书籍', dataCategories: ['生活'] },
  { name: '艺术', count: 9476, unit: '本书籍', coverBookId: '1', dataCategories: [] },
  // --- 第三屏 ---
  { name: '原版书', count: 6930, unit: '本书籍', coverBookId: '1', dataCategories: [] },
  { name: '男生小说', count: 325821, unit: '本书籍', coverBookId: '1', dataCategories: [] },
  { name: '女生小说', count: 259997, unit: '本书籍', coverBookId: '1', dataCategories: [] },
];

function getCoverBook(cat: typeof TOP_CATEGORIES[number]) {
  if (cat.coverBookId) {
    const found = WECHAT_READING_CONFIG.store.find(b => b.id === cat.coverBookId);
    if (found) return found;
  }
  if (cat.dataCategories.length > 0) {
    const found = WECHAT_READING_CONFIG.store.find(b => b.category === cat.dataCategories[0]);
    if (found) return found;
  }
  return WECHAT_READING_CONFIG.store[0];
}

const CategoryListPage: React.FC = () => {
  const { bindBack, bindTap } = useWechatReadingGestures();
  const s = useWechatReadingStrings();

  return (
    <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-50)">
      {/* Header */}
      <div className="flex items-center px-4 pt-10 pb-3 bg-white sticky top-0 z-10">
        <div className="w-10 flex justify-start" {...bindBack()}>
          <IcNavBack size={dimens.icSizeTab} className="text-(--app-c-tw-text-slate-800)" />
        </div>
        <div className="flex-1 text-center text-lg font-bold text-(--app-c-tw-text-slate-900)">{s.category_list_title}</div>
        <div className="w-10" />
      </div>

      {/* Grid */}
      <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar px-3 pt-4 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {TOP_CATEGORIES.map(cat => {
            const coverBook = getCoverBook(cat);
            return (
              <div
                key={cat.name}
                {...bindTap<HTMLDivElement>('category.detail.open', { params: { categoryName: cat.name } })}
                className="bg-app-surface rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] cursor-pointer"
                style={{ transition: 'transform 120ms ease' }}
              >
                <div className={`w-14 aspect-[2/3] rounded shrink-0 relative overflow-hidden shadow-sm ${coverBook.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}>
                  {coverBook.cover ? (
                    <img src={coverBook.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 p-1.5 flex flex-col items-center justify-center text-center">
                      <span className="text-[8px] font-bold opacity-80 text-(--app-c-tw-text-slate-900) leading-tight line-clamp-3">{coverBook.title}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-(--app-c-tw-text-slate-900) truncate">{cat.name}</div>
                  <div className="text-xs text-(--app-c-tw-text-gray-400) mt-1">{cat.count} {cat.unit}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 导出映射供 CategoryDetailPage 使用
export { TOP_CATEGORIES };
export default CategoryListPage;

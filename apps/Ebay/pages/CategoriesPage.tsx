import React from 'react';
import { IcNavBack } from '../res/icons';
import { useEbayGestures } from '../navigation';
import { useLocale } from '../../../os/locale';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { localizeEbayCategoryLabel } from '../utils/localize';
import { cdn } from '../../../os/utils/cdn';

const EBAY_CDN = cdn('ebay/images');

type Category = { id: string; label: string; image: string };

const CATEGORIES: Category[] = [
  { id: 'motors', label: 'eBay 汽车', image: `${EBAY_CDN}/unsplash/photo-1541899481282-d53bffe3c35d.jpg` },
  { id: 'electronics', label: '电子产品', image: `${EBAY_CDN}/unsplash/photo-1517336714731-489689fd1ca8.jpg` },
  { id: 'collectibles', label: '收藏品和艺术品', image: `${EBAY_CDN}/unsplash/photo-1521412644187-c49fa049e84d.jpg` },
  { id: 'home', label: '家庭和花园', image: `${EBAY_CDN}/unsplash/photo-1540574163026-643ea20ade25.jpg` },
  { id: 'fashion', label: '服装、鞋子和配饰', image: `${EBAY_CDN}/unsplash/photo-1542291026-7eec264c27ff.jpg` },
  { id: 'toys', label: '玩具和爱好', image: `${EBAY_CDN}/unsplash/photo-1587654780291-39c9404d746b.jpg` },
  { id: 'sports', label: '运动用品', image: `${EBAY_CDN}/unsplash/photo-1517649763962-0c623066013b.jpg` },
  { id: 'media', label: '书籍、电影和音乐', image: `${EBAY_CDN}/unsplash/photo-1495433324511-bf8e92934d90.jpg` },
  { id: 'beauty', label: '健康与美容', image: `${EBAY_CDN}/unsplash/photo-1522335789203-aabd1fc54bc9.jpg` },
  { id: 'business', label: '商业和工业', image: `${EBAY_CDN}/unsplash/photo-1519608487953-e999c86e7455.jpg` },
  { id: 'jewelry', label: '珠宝和手表', image: `${EBAY_CDN}/unsplash/photo-1523275335684-37898b6baf30.jpg` },
  { id: 'baby', label: '婴儿必需品', image: `${EBAY_CDN}/unsplash/photo-1504548840739-580b10ae7715.jpg` },
  { id: 'pets', label: '宠物用品', image: `${EBAY_CDN}/unsplash/photo-1548199973-03cce0bbc87b.jpg` },
  { id: 'travel', label: '机票及旅游', image: `${EBAY_CDN}/unsplash/photo-1500530855697-b586d89ba3ee.jpg` },
  { id: 'giftcards', label: '礼品卡和优惠券', image: `${EBAY_CDN}/unsplash/photo-1601598851547-4302969d0614.jpg` },
  { id: 'everything', label: '其他一切', image: `${EBAY_CDN}/unsplash/photo-1528825871115-3581a5387919.jpg` },
  { id: 'realestate', label: '房地产', image: `${EBAY_CDN}/unsplash/photo-1560518883-ce09059eeffa.jpg` },
  { id: 'services', label: '专业服务', image: `${EBAY_CDN}/unsplash/photo-1455390582262-044cdead277a.jpg` },
];

const CategoriesPage: React.FC = () => {
  const { bindBack } = useEbayGestures();
  const locale = useLocale();
  const s = useEbayStrings();

  return (
    <div className="h-full bg-app-surface flex flex-col">
      <div className="px-4 py-3 pt-10 flex items-center">
        <button
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3"
          {...bindBack()}
        >
          <IcNavBack size={22} className="text-black" />
        </button>
        <h1 className="text-2xl font-bold text-black">{s.categories_title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} className="text-left active:opacity-70">
              <div className="bg-gray-100 rounded-3xl overflow-hidden h-32 flex items-center justify-center">
                <img src={cat.image} alt={cat.label} className="w-full h-full object-contain p-5" />
              </div>
              <div className="mt-3 text-center text-[15px] font-medium text-black">
                {localizeEbayCategoryLabel(cat.label, locale)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;

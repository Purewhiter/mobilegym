import { useRedBookStrings } from '../hooks/useRedBookStrings';

import React from 'react';
import { IcCart, IcMore } from '../res/icons';
const ShoppingCart = IcCart, MoreHorizontal = IcMore;
import { strings, type StringKey } from '../res/strings';

// Assets
import searchIcon from '../assets/mall/Search_2x.png';
import banner1 from '../assets/mall/banner/1.jpg';
// import banner2 from '../assets/mall/banner/2.jpg';

import cat1 from '../assets/mall/category/1.jpg';
import cat2 from '../assets/mall/category/2.jpg';
import cat3 from '../assets/mall/category/3.jpg';
import cat4 from '../assets/mall/category/4.png';
import cat5 from '../assets/mall/category/5.png';
import cat6 from '../assets/mall/category/6.jpg';
import cat7 from '../assets/mall/category/7.jpg';
import cat8 from '../assets/mall/category/8.jpg';

const products = [
  { id: 'prod_beauty_set', title: '水光感护肤礼盒套装', image: cat1, price: '129', sold: '836', isDouble11: true },
  { id: 'prod_knit_bag', title: '通勤针织托特包', image: cat2, price: '89', sold: '421', isDouble11: false },
  { id: 'prod_home_lamp', title: '奶油风小夜灯', image: cat3, price: '59', sold: '690', isDouble11: true },
  { id: 'prod_snack_box', title: '办公室低卡零食盒', image: cat4, price: '39', sold: '978', isDouble11: false },
  { id: 'prod_kids_cup', title: '儿童防漏吸管杯', image: cat5, price: '45', sold: '312', isDouble11: true },
  { id: 'prod_sport_towel', title: '速干运动毛巾三件装', image: cat6, price: '49', sold: '556', isDouble11: false },
  { id: 'prod_earbuds', title: '降噪蓝牙耳机', image: cat7, price: '199', sold: '764', isDouble11: true },
  { id: 'prod_storage', title: '桌面收纳组合', image: cat8, price: '69', sold: '287', isDouble11: false },
];

const categories: { name: StringKey, img: string }[] = [
    { name: 'beauty', img: cat1 },
    { name: 'fashion_2', img: cat2 },
    { name: 'home_and_living', img: cat3 },
    { name: 'food_and_drinks', img: cat4 },
    { name: 'baby_and_kids', img: cat5 },
    { name: 'sports_and_outdoor', img: cat6 },
    { name: 'electronics', img: cat7 },
    { name: 'homepage_more', img: cat8 },
];

export const ShopPage: React.FC = () => {
  const s = useRedBookStrings();
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="pt-10 px-3 pb-3 flex items-center gap-3 bg-app-surface sticky top-0 z-10">
        <div className="flex-1 h-[32px] bg-gray-100 rounded-full flex items-center px-3 gap-2 border border-transparent focus-within:border-gray-300 transition-colors">
            <img src={searchIcon} className="w-4 h-4 opacity-50" />
            <span className="text-[13px] text-gray-400">{s.everyone_searching}</span>
        </div>
        <div className="relative">
            <ShoppingCart size={24} className="text-app-text" strokeWidth={1.5} />
             <div className="absolute -top-1 -right-1 w-2 h-2 bg-app-primary rounded-full border border-white"></div>
        </div>
        <MoreHorizontal size={24} className="text-app-text" strokeWidth={1.5} />
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {/* Banner */}
          <div className="px-3 py-2 bg-app-surface">
              <div className="w-full aspect-[2.5/1] rounded-lg overflow-hidden relative">
                  <img src={banner1} className="w-full h-full object-cover" />
                  {/* Dots for carousel simulation */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-app-surface"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
                  </div>
              </div>
          </div>

          {/* Categories */}
          <div className="bg-app-surface pb-4">
              <div className="grid grid-cols-4 gap-y-4">
                  {categories.map((cat, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                          <div className="w-10 h-10">
                              <img src={cat.img} className="w-full h-full object-contain" />
                          </div>
                          <span className="text-[11px] text-app-text">{s[cat.name]}</span>
                      </div>
                  ))}
              </div>
          </div>

          {/* Marketing/Tabs Bar */}
          <div className="flex items-center gap-4 px-3 py-3 overflow-x-auto no-scrollbar bg-gray-50 sticky top-[72px] z-0">
             <span className="text-[15px] font-bold text-app-primary">{s.recommend}</span>
             <span className="text-[14px] text-gray-500">{s.must_buys}</span>
             <span className="text-[14px] text-gray-500">{s.flash_sale}</span>
             <span className="text-[14px] text-gray-500">{s.live}</span>
             <span className="text-[14px] text-gray-500">{s.picks}</span>
          </div>

          {/* Product Grid - Waterfall */}
          <div className="px-2 pb-20">
            <div className="grid grid-cols-2 gap-2">
                {products.map(prod => (
                    <div key={prod.id} className="bg-app-surface rounded-lg overflow-hidden pb-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <div className="aspect-square bg-gray-100 relative">
                            <img src={prod.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2">
                            <h3 className="text-[13px] font-medium text-app-text line-clamp-2 mb-2 h-[38px] leading-[19px]">
                                {prod.isDouble11 && <span className="text-[10px] bg-app-primary text-white px-1 rounded-sm mr-1 align-middle">11.11</span>}
                                {prod.title}
                            </h3>
                            <div className="flex items-end justify-between mt-2">
                                <div className="flex items-baseline gap-0.5 text-app-primary">
                                    <span className="text-xs font-bold">¥</span>
                                    <span className="text-[16px] font-bold">{prod.price}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{prod.sold}{s.people_paid}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {/* Duplicate for content volume */}
                 {products.map(prod => (
                    <div key={prod.id + '_dup'} className="bg-app-surface rounded-lg overflow-hidden pb-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <div className="aspect-square bg-gray-100 relative">
                            <img src={prod.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2">
                            <h3 className="text-[13px] font-medium text-app-text line-clamp-2 mb-2 h-[38px] leading-[19px]">
                                {prod.isDouble11 && <span className="text-[10px] bg-app-primary text-white px-1 rounded-sm mr-1 align-middle">11.11</span>}
                                {prod.title}
                            </h3>
                            <div className="flex items-end justify-between mt-2">
                                <div className="flex items-baseline gap-0.5 text-app-primary">
                                    <span className="text-xs font-bold">¥</span>
                                    <span className="text-[16px] font-bold">{prod.price}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{prod.sold}{s.people_paid}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
             <div className="py-4 text-center text-xs text-gray-300">
                {s.shoppage_end}
            </div>
          </div>
      </div>
    </div>
  );
};

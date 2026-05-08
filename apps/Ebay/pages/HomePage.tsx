import React from 'react';
import { IcCart, IcCamera, IcHeart, IcTag, IcGrid, IcFastPay, IcSearch, IcShield, IcNavForward } from '../res/icons';
import { useEbayGestures } from '../navigation';
import TabBar from '../components/TabBar';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { cdn } from '../../../os/utils/cdn';

const EBAY_CDN = cdn('ebay/images');

const HomePage: React.FC = () => {
  const { bindTap, bindAction } = useEbayGestures();
  const s = useEbayStrings();

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
      {/* Fixed Top Section */}
      <div className="bg-app-surface z-20 flex-shrink-0">
          {/* Header */}
          <div className="px-4 py-2 flex items-center justify-between pt-10">
            <div className="flex items-center">
                {/* Multicolor eBay Logo */}
                <span className="text-3xl font-bold tracking-tight">
                    <span className="text-app-primary">e</span>
                    <span className="text-[#0064d2]">b</span>
                    <span className="text-[#f5af02]">a</span>
                    <span className="text-[#86b817]">y</span>
                </span>
            </div>
            <div {...bindTap('cart.open', {})} className="p-2">
                <IcCart size={24} className="text-app-text" />
            </div>
          </div>

          {/* IcSearch Bar */}
          <div className="px-4 mb-3 pb-2">
            <div 
                {...bindTap('home.search.open')}
                className="bg-gray-100 rounded-full h-12 flex items-center px-4 relative cursor-pointer"
            >
                <IcSearch className="text-app-text-muted mr-3" size={20} />
                <span className="text-app-text-muted text-base">{s.home_search_placeholder}</span>
                <div className="absolute right-4">
                    <IcCamera className="text-app-text-muted" size={20} />
                </div>
            </div>
          </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20" data-scroll-container="home_content" data-scroll-direction="vertical">
          {/* Quick Filters */}
          <div className="px-4 flex space-x-3 overflow-x-auto mb-6 no-scrollbar pb-2 pt-2">
             <Chip icon={<IcHeart size={16} />} label={s.home_saved} />
             <Chip icon={<IcTag size={16} />} label={s.home_sell} onClickProps={bindTap('home.quick_filter.sell')} />
             <Chip icon={<IcGrid size={16} />} label={s.home_categories} onClickProps={bindTap('home.quick_filter.categories')} />
             <Chip icon={<IcFastPay size={16} />} label={s.home_deals} />
          </div>

          {/* Auth Prompt */}
          <div className="px-4 mb-6 text-center">
            <p className="text-gray-600 mb-4 text-base">{s.home_auth_prompt}</p>
            <div className="flex space-x-4">
                <button 
                    {...bindAction('home.auth.register')}
                    className="flex-1 border border-blue-600 text-blue-600 rounded-full py-2.5 font-medium"
                >
                    {s.home_register}
                </button>
                <button 
                    {...bindAction('home.auth.login')}
                    className="flex-1 border border-blue-600 text-blue-600 rounded-full py-2.5 font-medium"
                >
                    {s.home_login}
                </button>
            </div>
          </div>

          {/* Old Promo Banner (Keeping as it was in previous design) */}
          <div className="bg-[#003087] p-6 text-white mb-6">
            <h2 className="text-2xl font-bold mb-2">{s.home_promo_title}</h2>
            <p className="mb-4 text-sm opacity-90">{s.home_promo_desc}</p>
            <button 
                {...bindAction('home.promo.getCoupon')}
                className="bg-[#c5e5fb] text-[#003087] px-6 py-2 rounded-full font-bold text-sm mb-4"
            >
                {s.home_get_coupon}
            </button>
            <p className="text-xs opacity-70 underline block mb-4">{s.home_promo_footnote}</p>
            
            {/* Product Carousel */}
            <div className="flex space-x-3 mt-2 overflow-x-auto pb-2">
                <div className="w-24 h-32 bg-app-surface rounded-lg flex-shrink-0 p-2 flex items-center justify-center">
                    <img src={`${EBAY_CDN}/unsplash/photo-1511707171634-5f897ff02aa9.jpg`} className="max-h-full max-w-full object-contain" alt="Phone" />
                </div>
                <div className="w-24 h-32 bg-app-surface rounded-lg flex-shrink-0 p-2 flex items-center justify-center">
                     <img src={`${EBAY_CDN}/unsplash/photo-1584917865442-de89df76afd3.jpg`} className="max-h-full max-w-full object-contain" alt="Bag" />
                </div>
                <div className="w-24 h-32 bg-app-surface rounded-lg flex-shrink-0 p-2 flex items-center justify-center">
                     <img src={`${EBAY_CDN}/unsplash/photo-1585771724684-38269d6639fd.jpg`} className="max-h-full max-w-full object-contain" alt="Fan" />
                </div>
            </div>
          </div>

          {/* Orange Guarantee Banner */}
          <div className="bg-[#e56600] p-6 text-black mb-0">
              <h2 className="text-2xl font-bold mb-1">{s.home_guarantee_title}</h2>
              <p className="text-sm mb-4">{s.home_guarantee_desc}</p>
              <button className="bg-[#191919] text-white px-5 py-2.5 rounded-full font-bold text-sm">
                  {s.home_guarantee_cta}
              </button>
          </div>

          {/* Image Section */}
          <div className="w-full h-48 bg-gray-200">
              <img 
                src={`${EBAY_CDN}/unsplash/photo-1556740758-90de374c12ad.jpg`} 
                className="w-full h-full object-cover" 
                alt="Shopping experience" 
              />
          </div>

          {/* Light Gray Experience Section */}
          <div className="bg-[#f7f7f7] p-6 text-black mb-6">
              <h2 className="text-2xl font-bold mb-2">{s.home_easy_title}</h2>
              <p className="text-gray-600 text-sm mb-5">{s.home_easy_desc}</p>
              <button className="bg-black text-white px-6 py-2.5 rounded-full font-bold text-sm">
                  {s.home_easy_cta}
              </button>
          </div>

          {/* Category Section */}
          <div className="px-4 pb-4">
              <h2 className="text-xl font-bold mb-4 text-black">{s.home_category_section_title}</h2>
              <div className="flex justify-between space-x-2">
                  <CategoryItem 
                    title={s.home_cat1} 
                    image={`${EBAY_CDN}/unsplash/photo-1525547719571-a2d4ac8945e2.jpg`} 
                  />
                  <CategoryItem 
                    title={s.home_cat2} 
                    image={`${EBAY_CDN}/unsplash/photo-1607457561901-e6ec3a6d16cf.jpg`} 
                  />
                  <CategoryItem 
                    title={s.home_cat3} 
                    image={`${EBAY_CDN}/unsplash/photo-1613771404721-c5b4512a3835.jpg`} 
                  />
              </div>
          </div>
      </div>

      <TabBar />
    </div>
  );
};

const Chip = ({ icon, label, onClickProps }: any) => (
    <div 
        {...onClickProps}
        className="flex items-center space-x-1.5 px-4 py-2 bg-gray-100 rounded-full border border-app-border whitespace-nowrap flex-shrink-0"
    >
        <span className="text-gray-700">{icon}</span>
        <span className="text-app-text font-medium text-sm">{label}</span>
    </div>
);

const CategoryItem = ({ title, image }: any) => (
    <div className="flex flex-col items-center w-1/3">
        <div className="w-24 h-24 rounded-full bg-gray-100 mb-3 overflow-hidden">
            <img src={image} className="w-full h-full object-cover" alt={title} />
        </div>
        <span className="text-sm font-bold text-center text-app-text">{title}</span>
    </div>
);

export default HomePage;

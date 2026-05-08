import React from 'react';
import { IcSearch, IcCart, IcTicket, IcGrid, IcClock, IcStar } from '../res/icons';
import { useLocale } from '@/apps/Bilibili/locale';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';

const Search = IcSearch;
const ShoppingCart = IcCart;
const Ticket = IcTicket;
const Grid = IcGrid;
const Clock = IcClock;
const Star = IcStar;

const ShopItem = ({
    title,
    price,
    locale,
    ownedLabel,
    priceLabel,
}: {
    title: string;
    price: string;
    locale: 'zh-Hans' | 'en';
    ownedLabel: string;
    priceLabel: string;
}) => (
    <div className="bg-app-surface rounded-lg p-3 flex flex-col items-center">
        <div className="w-20 h-20 rounded-lg bg-gray-100 mb-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">
                📦
            </div>
        </div>
        <div className="w-full text-left">
            <div className="text-xs font-bold text-app-primary border border-app-primary inline-block px-1 rounded-sm scale-90 origin-left mb-1">{ownedLabel}</div>
            <h4 className="text-xs text-app-text font-medium line-clamp-2 leading-tight h-8 overflow-hidden">{title}</h4>
            <p className="text-xs text-app-primary font-bold mt-1">{priceLabel} ¥<span className="text-sm">{price}</span>{locale === 'en' ? '+' : '起'}</p>
        </div>
    </div>
);

export const ShopPage: React.FC = () => {
    const locale = useLocale();
    const s = useBilibiliStrings();
    const text = locale === 'en'
        ? {
            title: 'Shop',
            searchHint: 'Mob Psycho 100',
            search: 'Search',
            orders: 'Orders',
            cart: 'Cart',
            coupons: 'Coupons',
            favorites: 'Saved items',
            history: 'Footprints',
            ownedLabel: 'Official',
            priceLabel: 'New-user price',
            couponPack: 'New user coupons',
            couponDesc: 'Starting at ¥1 with free shipping',
            useNow: 'Use now',
            products: [
                'BEMOE Hatsune Miku 2025 Spring Collection',
                'Best-selling merch blind box event',
                'FURYU Blue Archive Yuuka figure',
                'APEX Legends Octane collectible',
                'Genshin Keqing Thunderclap figure',
                'Arknights Rhodes Island tactical backpack',
            ],
        }
        : {
            title: '会员购',
            searchHint: '灵能百分百',
            search: '搜索',
            orders: '我的订单',
            cart: '购物车',
            coupons: '优惠券',
            favorites: '商品收藏',
            history: '商品足迹',
            ownedLabel: '自营',
            priceLabel: '新人价',
            couponPack: '新人券包',
            couponDesc: '新人包邮1元起',
            useNow: '去使用',
            products: [
                'BEMOE 初音未来 2025新春系列',
                '会员购爆款周边 抽盲盒赢黄金',
                'FURYU 碧蓝档案 优香 手办',
                'APEX 英雄 动力小子',
                '原神 刻晴 霆霓快雨',
                '明日方舟 罗德岛 战术背包',
            ],
        };

    const shopItems = [
        { title: s.shop_figure, icon: '🎨' },
        { title: s.shop_blind_box, icon: '🎁' },
        { title: s.shop_event_show, icon: '🎫' },
        { title: s.shop_all_categories, icon: 'all' },
    ];

    return (
        <div className="flex flex-col h-full bg-app-bg pt-0">
            <div className="bg-app-surface px-3 pt-10 py-2 flex items-center gap-3">
                <span className="font-bold text-lg">{text.title}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-full flex items-center px-3 text-sm text-gray-500 gap-2">
                    <Search size={14} />
                    <span className="text-xs">{text.searchHint}</span>
                    <button className="bg-app-primary text-white text-xs px-3 py-1 rounded-full ml-auto">{text.search}</button>
                </div>
            </div>

            <div className="bg-app-surface px-2 py-3 flex text-[10px] text-gray-600 justify-between items-center text-center">
                <div className="flex flex-col items-center gap-1"><div className="p-2"><Grid size={20} /></div>{text.orders}</div>
                <div className="flex flex-col items-center gap-1"><div className="p-2"><ShoppingCart size={20} /></div>{text.cart}</div>
                <div className="flex flex-col items-center gap-1"><div className="p-2"><Ticket size={20} /></div>{text.coupons}</div>
                <div className="flex flex-col items-center gap-1"><div className="p-2"><Star size={20} /></div>{text.favorites}</div>
                <div className="flex flex-col items-center gap-1"><div className="p-2"><Clock size={20} /></div>{text.history}</div>
            </div>

            <div className="bg-app-surface pt-2 pb-4 grid grid-cols-4 gap-2 px-2 text-center text-xs">
                {shopItems.map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-xl">
                            {item.icon === 'all' ? <Grid size={16} className="text-app-primary" /> : item.icon}
                        </div>
                        <span>{item.title}</span>
                    </div>
                ))}
            </div>

            <div className="px-3 mt-2">
                <div className="bg-gradient-to-r from-pink-400 to-pink-500 rounded-lg p-3 text-white flex justify-between items-center shadow-sm">
                    <div>
                        <span className="font-bold text-lg mr-1">¥45</span>
                        <span className="font-bold text-sm">{text.couponPack}</span>
                        <span className="text-xs opacity-80 ml-2">{text.couponDesc}</span>
                    </div>
                    <button className="bg-yellow-300 text-pink-600 text-xs font-bold px-3 py-1.5 rounded-full">{text.useNow}</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 grid grid-cols-2 gap-2 pb-20 no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {text.products.map((title, index) => (
                    <ShopItem
                        key={title}
                        title={title}
                        price={['41', '1', '139', '899', '868', '299'][index]}
                        locale={locale}
                        ownedLabel={text.ownedLabel}
                        priceLabel={text.priceLabel}
                    />
                ))}
            </div>
        </div>
    );
};

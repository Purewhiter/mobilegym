import React from 'react';
import { IcSearch, IcCart, IcTicket, IcGrid, IcClock, IcStar } from '../res/icons';
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
    ownedLabel,
    priceLabel,
    priceSuffix,
}: {
    title: string;
    price: string;
    ownedLabel: string;
    priceLabel: string;
    priceSuffix: string;
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
            <p className="text-xs text-app-primary font-bold mt-1">{priceLabel} ¥<span className="text-sm">{price}</span>{priceSuffix}</p>
        </div>
    </div>
);

export const ShopPage: React.FC = () => {
    const s = useBilibiliStrings();
    const text = {
        title: s.shop_title,
        searchHint: s.shop_search_hint,
        search: s.shop_search,
        orders: s.shop_orders,
        cart: s.shop_cart,
        coupons: s.shop_coupons,
        favorites: s.shop_favorites,
        history: s.shop_history,
        ownedLabel: s.shop_owned_label,
        priceLabel: s.shop_price_label,
        couponPack: s.shop_coupon_pack,
        couponDesc: s.shop_coupon_desc,
        useNow: s.shop_use_now,
        products: [
            s.shop_product_1,
            s.shop_product_2,
            s.shop_product_3,
            s.shop_product_4,
            s.shop_product_5,
            s.shop_product_6,
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
                        ownedLabel={text.ownedLabel}
                        priceLabel={text.priceLabel}
                        priceSuffix={s.shop_price_suffix}
                    />
                ))}
            </div>
        </div>
    );
};

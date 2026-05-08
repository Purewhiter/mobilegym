// Data generator for eBay-like catalog with rich attributes for sort and filter
import type { BuyingFormat, ConditionType, ProductItem } from '../types';
import * as TimeService from '../../../os/TimeService';
import { cdn } from '../../../os/utils/cdn';

const EBAY_CDN = cdn('ebay/images');

export type { BuyingFormat, ConditionType, ProductItem } from '../types';

export const CATEGORIES_DEF: { id: string; label: string; types: { id: string; label: string; image: string; brands: string[] }[] }[] = [
  {
    id: 'electronics',
    label: '电子产品',
    types: [
      { id: 'fan', label: '电风扇', image: `${EBAY_CDN}/unsplash/photo-1585771724684-38269d6639fd.jpg`, brands: ['Dyson', 'Midea', 'Gree', 'Panasonic', 'Xiaomi'] },
      { id: 'laptop', label: '电脑', image: `${EBAY_CDN}/unsplash/photo-1517336714731-489689fd1ca8.jpg`, brands: ['Apple', 'Dell', 'Lenovo', 'HP', 'Asus', 'Acer'] },
      { id: 'tv', label: '电视', image: `${EBAY_CDN}/unsplash/photo-1588459468346-7c1d4a5963d8.jpg`, brands: ['Sony', 'Samsung', 'LG', 'TCL', 'Hisense'] },
      { id: 'watch', label: '手表', image: `${EBAY_CDN}/unsplash/photo-1523275335684-37898b6baf30.jpg`, brands: ['Apple', 'Garmin', 'Huawei', 'Xiaomi', 'Fitbit'] },
    ],
  },
  {
    id: 'home-garden',
    label: '家庭和花园',
    types: [
      { id: 'sofa', label: '沙发', image: `${EBAY_CDN}/unsplash/photo-1540574163026-643ea20ade25.jpg`, brands: ['Ikea', 'Wayfair', 'Ashley', 'Muji'] },
      { id: 'lamp', label: '灯具', image: `${EBAY_CDN}/unsplash/photo-1518614189403-1d5d7c17298e.jpg`, brands: ['Philips', 'Osram', 'Yeelight', 'Nanoleaf'] },
    ],
  },
  {
    id: 'fashion',
    label: '服装、鞋子和配饰',
    types: [
      { id: 'sneaker', label: '运动鞋', image: `${EBAY_CDN}/unsplash/photo-1519741497674-611481863552.jpg`, brands: ['Nike', 'Adidas', 'Puma', 'NewBalance', 'Skechers'] },
      { id: 'dress', label: '连衣裙', image: `${EBAY_CDN}/unsplash/photo-1520975954735-40a44c32c1d1.jpg`, brands: ['Zara', 'H&M', 'Uniqlo', 'Shein'] },
      { id: 'sunglasses', label: '太阳镜', image: `${EBAY_CDN}/unsplash/photo-1511497584788-876760111969.jpg`, brands: ['RayBan', 'Oakley', 'Gucci', 'Prada'] },
    ],
  },
  {
    id: 'motors',
    label: 'eBay 汽车',
    types: [
      { id: 'pickup', label: '皮卡车', image: `${EBAY_CDN}/unsplash/photo-1541899481282-d53bffe3c35d.jpg`, brands: ['Ford', 'Chevrolet', 'Toyota', 'Nissan'] },
      { id: 'radiator-fan', label: '散热风扇', image: `${EBAY_CDN}/unsplash/photo-1565691079548-77275b22b91a.jpg`, brands: ['DNA', 'DaviesCraig', 'Mishimoto'] },
    ],
  },
  {
    id: 'sports',
    label: '运动用品',
    types: [
      { id: 'dumbbell', label: '哑铃', image: `${EBAY_CDN}/unsplash/photo-1517964603305-11c1f3f71fd2.jpg`, brands: ['Bowflex', 'Yes4All', 'Rogue'] },
      { id: 'yoga-mat', label: '瑜伽垫', image: `${EBAY_CDN}/unsplash/photo-1518313451760-4eac1a1b2656.jpg`, brands: ['Liforme', 'Manduka', 'Gaiam'] },
    ],
  },
  {
    id: 'pets',
    label: '宠物用品',
    types: [
      { id: 'pet-bed', label: '宠物床', image: `${EBAY_CDN}/unsplash/photo-1548199973-03cce0bbc87b.jpg`, brands: ['PetFusion', 'Furhaven', 'Kuranda'] },
    ],
  },
  {
    id: 'travel',
    label: '机票及旅游',
    types: [
      { id: 'ticket', label: '机票', image: `${EBAY_CDN}/unsplash/photo-1500530855697-b586d89ba3ee.jpg`, brands: ['AirAsia', 'Qantas', 'United', 'Delta'] },
    ],
  },
  {
    id: 'giftcards',
    label: '礼品卡和优惠券',
    types: [
      { id: 'gift-card', label: '礼品卡', image: `${EBAY_CDN}/unsplash/photo-1601598851547-4302969d0614.jpg`, brands: ['eBay', 'Apple', 'Amazon', 'Starbucks'] },
    ],
  },
  {
    id: 'jewelry',
    label: '珠宝和手表',
    types: [
      { id: 'watch', label: '腕表', image: `${EBAY_CDN}/unsplash/photo-1523275335684-37898b6baf30.jpg`, brands: ['Rolex', 'Omega', 'Seiko', 'Casio'] },
    ],
  },
];

const LOCATIONS = ['中国', '美国', '澳大利亚', '英国', '德国', '日本'];

function rand(seed: number) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateCatalog(totalPerType = 60): ProductItem[] {
  const items: ProductItem[] = [];
  let idCounter = 1;
  const now = TimeService.now();
  for (const cat of CATEGORIES_DEF) {
    for (const type of cat.types) {
      for (let i = 0; i < totalPerType; i++) {
        const brand = type.brands[i % type.brands.length];
        const priceTier = (i % 5) + 1; // 1..5
        const basePrice = 20 * priceTier + rand(i + idCounter) * 50;
        const shipping = [0, 25, 45, 65][i % 4];
        const freeShipping = shipping === 0;
        const condition: ConditionType = (['全新', '二手', '翻新'] as ConditionType[])[i % 3];
        const buyingFormat: BuyingFormat = (['buyItNow', 'auction', 'offer'] as BuyingFormat[])[i % 3];
        const distanceKm = Math.round(rand(idCounter) * 3000);
        const location = LOCATIONS[i % LOCATIONS.length];
        const dateListed = now - Math.round(rand(idCounter + i) * 60 * 24 * 3600 * 1000);
        const endingSoon = now + Math.round(rand(idCounter + i * 7) * 60 * 24 * 3600 * 1000);

        const title = `${brand} ${type.label} ${cat.label} ${i + 1}`;

        items.push({
          id: String(idCounter++),
          title,
          categoryId: cat.id,
          categoryLabel: cat.label,
          typeId: type.id,
          typeLabel: type.label,
          brand,
          condition,
          price: Number((basePrice + (freeShipping ? 0 : 10)).toFixed(2)),
          originalPrice: Math.random() > 0.6 ? Number((basePrice * 1.2).toFixed(2)) : undefined,
          shipping,
          freeShipping,
          buyingFormat,
          dateListed,
          endingSoon,
          distanceKm,
          location,
          sales: Math.random() > 0.7 ? `已售出 ${Math.floor(rand(i) * 1000)}+` : undefined,
          isSponsored: Math.random() > 0.92,
          image: type.image,
        });
      }
    }
  }
  return items;
}

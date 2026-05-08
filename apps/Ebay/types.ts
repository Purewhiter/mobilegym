export type BuyingFormat = 'buyItNow' | 'auction' | 'offer';
export type ConditionType = '全新' | '二手' | '翻新';

export type ProductItem = {
  id: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  typeId: string;
  typeLabel: string;
  brand: string;
  condition: ConditionType;
  price: number;
  originalPrice?: number;
  shipping: number;
  freeShipping: boolean;
  buyingFormat: BuyingFormat;
  dateListed: number;
  endingSoon: number;
  distanceKm: number;
  location: string;
  sales?: string;
  isSponsored?: boolean;
  image: string;
};


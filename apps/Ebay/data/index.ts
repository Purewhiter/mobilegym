import defaults from './defaults.json';
import { resolveEbayImage } from './loader';

// defaults.homeProducts 里的 image 字段是 './images/...' 相对路径，统一解析为 CDN URL
const resolvedDefaults = {
  ...defaults,
  homeProducts: (defaults.homeProducts ?? []).map(p => ({
    ...p,
    image: typeof p.image === 'string' ? resolveEbayImage(p.image) : p.image,
  })),
};

export const EBAY_CONFIG = resolvedDefaults;

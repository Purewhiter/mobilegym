import { defineRoutes } from '../../os/navigation/routes';

/** Ebay's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: 'eBay 首页' },
  me: { path: '/me', description: '我的 eBay 页面' },
  search: {
    path: '/search',
    search: {
      sheet: ['sort', 'filter'],
      filterPage: ['sort', 'buyingFormat', 'condition', 'price', 'category', 'brand', 'location', 'shipping', 'custom'],
    },
    description: '搜索页面（q 为搜索词时显示结果）',
    states: {
      'sheet=sort': '排序弹窗',
      'sheet=filter': '筛选抽屉',
      'filterPage=sort&sheet=filter': '筛选 - 排序',
      'filterPage=buyingFormat&sheet=filter': '筛选 - 购买形式',
      'filterPage=condition&sheet=filter': '筛选 - 状况',
      'filterPage=price&sheet=filter': '筛选 - 价格',
      'filterPage=category&sheet=filter': '筛选 - 类别',
      'filterPage=brand&sheet=filter': '筛选 - 品牌',
      'filterPage=location&sheet=filter': '筛选 - 物品所在地',
      'filterPage=shipping&sheet=filter': '筛选 - 运送',
      'filterPage=custom&sheet=filter': '筛选 - 自定义',
    },
  },
  sell: { path: '/sell', description: '出售页面' },
  inbox: { path: '/inbox', description: '收件箱页面' },
  cart: { path: '/cart', description: '购物车页面' },
  categories: { path: '/categories', description: '类别页面' },
  settings: { path: '/settings', search: { dialog: ['theme'] }, description: '设置页面', states: { 'dialog=theme': '主题选择' } },
  item: { path: '/item/:id', description: '商品详情页' },
});

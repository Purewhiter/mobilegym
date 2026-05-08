import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'theme_store',
  routes: [
    {
      path: '/',
      component: 'ThemeStoreHomePage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'themeStore.home.base', search: {}, description: '主题商店首页' }],
      queryParams: {},
      description: '主题商店首页',
    },
    {
      path: '/item/:kind/:id',
      component: 'StoreItemDetailPage',
      params: { kind: 'string', id: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'themeStore.item.base', search: {}, description: '主题详情页' }],
      queryParams: {},
      description: '主题详情页',
    },
  ],
  transitions: [
    {
      id: 'item.open',
      from: '/',
      to: '/item/:kind/:id',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { kind: 'string', id: 'string' },
      label: '打开主题详情页',
      ui: { placement: 'content', icon: 'item', gesture: 'tap' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

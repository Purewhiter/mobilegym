import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '长列表主滚动区域' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'scroll_lab',
  routes: [
    {
      path: '/',
      component: 'ScrollLabListPage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'scroll_lab.list.base', search: {}, description: '固定长列表' },
      ],
      queryParams: {},
      description: '固定长列表',
    },
    {
      path: '/item/:itemId',
      component: 'ScrollLabDetailPage',
      params: { itemId: 'string' },
      entryPoint: 'deepLink',
      uiStates: [
        { id: 'scroll_lab.detail.base', search: {}, description: '列表项详情' },
      ],
      queryParams: {},
      description: '列表项详情',
    },
  ],
  transitions: [
    {
      id: 'scroll_lab.list.openItem',
      from: '/',
      to: '/item/:itemId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { itemId: 'string' },
      label: '打开指定列表项',
      ui: { placement: 'content', icon: 'list-item', gesture: 'tap' },
      dataSource: { ref: 'items', paramMapping: { itemId: 'id' }, labelField: 'code' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

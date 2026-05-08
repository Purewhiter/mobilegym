import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'browser',
  routes: [
    {
      path: '/',
      component: 'BrowserHome',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'browser.home.base', search: {}, description: '浏览器首页' }],
      queryParams: {},
      description: '浏览器首页',
    },
    {
      path: '/view',
      component: 'BrowserView',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'browser.view.base', search: {}, description: '网页浏览页' }],
      queryParams: {},
      description: '网页浏览页',
    },
  ],
  transitions: [
    {
      id: 'view.open',
      from: ['/', '/view'],
      to: '/view',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开网页浏览页',
      ui: { placement: 'content', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'home.open',
      from: ['/view', '/'],
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '返回浏览器首页',
      ui: { placement: 'tabbar', icon: 'home', gesture: 'tap' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

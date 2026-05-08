import type { NavigationDeclaration, ScrollContainerDeclaration } from './navigation.types';

const NO_SCROLL: ScrollContainerDeclaration[] = [];

export const NAVIGATION_DECLARATION = {
  app: 'compass',

  routes: [
    {
      path: '/',
      component: 'CompassPage',
      params: {},
      entryPoint: 'home',
      scrollContainers: NO_SCROLL,
      uiStates: [
        { id: 'compass.base', search: { menu: null }, description: '指南针-主界面' },
        { id: 'compass.menu', search: { menu: 'true' }, description: '指南针-更多菜单' },
      ],
      queryParams: {},
      description: '指南针',
    },
    {
      path: '/level',
      component: 'LevelPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: NO_SCROLL,
      uiStates: [
        { id: 'level.base', search: { menu: null }, description: '水平仪-主界面' },
        { id: 'level.menu', search: { menu: 'true' }, description: '水平仪-更多菜单' },
      ],
      queryParams: {},
      description: '水平仪',
    },
    {
      path: '/permissions',
      component: 'PermissionsPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: NO_SCROLL,
      uiStates: [{ id: 'permissions.base', search: {}, description: '权限说明页' }],
      queryParams: {},
      description: '权限说明',
    },
    {
      path: '/privacy',
      component: 'PrivacyPolicyPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: NO_SCROLL,
      uiStates: [{ id: 'privacy.base', search: {}, description: '隐私政策（内置页/占位）' }],
      queryParams: {},
      description: '隐私政策',
    },
  ],

  transitions: [
    // =========================
    // Main mode switching
    // =========================
    {
      id: 'tab.compass',
      from: [
        { path: '/level', search: { menu: null } },
        { path: '/level', search: { menu: '*' } },
      ],
      to: '/',
      search: { menu: null },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到指南针',
      ui: { placement: 'topbar', icon: 'tab_compass', gesture: 'tap' },
    },
    {
      id: 'tab.level',
      from: [
        { path: '/', search: { menu: null } },
        { path: '/', search: { menu: '*' } },
      ],
      to: '/level',
      search: { menu: null },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到水平仪',
      ui: { placement: 'topbar', icon: 'tab_level', gesture: 'tap' },
    },

    // =========================
    // More menu (blocking overlay, represented in URL)
    // =========================
    {
      id: 'menu.open.compass',
      from: { path: '/', search: { menu: null } },
      to: '/',
      search: { menu: 'true' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开更多菜单',
      ui: { placement: 'topbar', icon: 'more', gesture: 'tap' },
    },
    {
      id: 'menu.open.level',
      from: { path: '/level', search: { menu: null } },
      to: '/level',
      search: { menu: 'true' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开更多菜单',
      ui: { placement: 'topbar', icon: 'more', gesture: 'tap' },
    },

    // =========================
    // Menu items
    // =========================
    {
      id: 'privacy.open',
      from: [
        { path: '/', search: { menu: 'true' } },
        { path: '/level', search: { menu: 'true' } },
      ],
      to: '/privacy',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '查看隐私政策',
      ui: { placement: 'content', icon: 'privacy', gesture: 'tap' },
    },
    {
      id: 'permissions.open',
      from: [
        { path: '/', search: { menu: 'true' } },
        { path: '/level', search: { menu: 'true' } },
      ],
      to: '/permissions',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '打开权限说明',
      ui: { placement: 'content', icon: 'permissions', gesture: 'tap' },
    },
  ],

  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];


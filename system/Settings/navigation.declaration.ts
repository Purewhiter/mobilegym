/**
 * Settings 导航声明（用于静态分析 / 任务生成）
 *
 * 注意：
 * - Settings 历史上使用过自定义结构的 navigation.declaration.ts，脚本无法识别。
 * - 这里统一为标准 NAVIGATION_DECLARATION（与其它 App 一致），以便 `build_nav_artifacts.mjs` 工作。
 */

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'settings',
  routes: [
    {
      path: '/',
      component: 'SettingsMainPage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'settings.main.base', search: {}, description: '设置首页' }],
      queryParams: {},
      description: '设置首页',
    },
    {
      path: '/search',
      component: 'SettingsSearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'settings.search.base', search: {}, description: '设置搜索页' }],
      queryParams: {},
      description: '设置搜索页',
    },
    {
      path: '/page/:pageId',
      component: 'PreferenceScreenPage',
      params: { pageId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'settings.page.base', search: {}, description: '设置详情页' }],
      queryParams: {},
      description: '设置详情页',
    },
  ],
  transitions: [
    {
      id: 'search.open',
      from: '/',
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开设置搜索',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'page.open',
      from: ['/', '/search', '/page/:pageId'],
      to: '/page/:pageId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '打开设置项详情',
      ui: { placement: 'content', icon: 'page', gesture: 'tap' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

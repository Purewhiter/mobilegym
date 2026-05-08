import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'calculator',
  routes: [
    {
      path: '/',
      component: 'CalculatorContent',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'calculator.home.base', search: {}, description: '计算器主页' }],
      queryParams: {},
      description: '计算器主页',
    },
  ],
  transitions: [],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

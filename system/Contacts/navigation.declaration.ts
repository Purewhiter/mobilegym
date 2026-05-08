import type { NavigationDeclaration, ScrollContainerDeclaration } from './navigation.types';

const MAIN_SCROLL: ScrollContainerDeclaration[] = [
  { name: 'main', direction: 'vertical', description: '主滚动区域' },
];

export const NAVIGATION_DECLARATION = {
  app: 'contacts',

  routes: [
    // =========================
    // Main tabs (bottom navigation)
    // =========================
    {
      path: '/',
      component: 'CallsPage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'calls.base', search: {}, description: '通话-通话记录列表' },
        { id: 'calls.dialpad', search: { dialpad: 'true' }, description: '通话-拨号盘浮层' },
      ],
      queryParams: {},
      description: '通话',
    },
    {
      path: '/contacts',
      component: 'ContactsPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'phoneContacts.base', search: {}, description: '联系人-列表' },
        { id: 'phoneContacts.favorites', search: { fav: 'true' }, description: '联系人-收藏筛选' },
      ],
      queryParams: {},
      description: '联系人',
    },
    {
      path: '/business',
      component: 'BusinessHallPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'business.base', search: {}, description: '营业厅-首页' }],
      queryParams: {},
      description: '营业厅',
    },

    // =========================
    // Search
    // =========================
    {
      path: '/search',
      component: 'SearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'search.base', search: {}, description: '联系人-搜索' }],
      queryParams: {},
      description: '搜索',
    },

    // =========================
    // Details
    // =========================
    {
      path: '/contact/:contactId',
      component: 'ContactDetailPage',
      params: { contactId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'contactDetail.base', search: {}, description: '联系人详情' }],
      queryParams: {},
      description: '联系人详情',
    },
    {
      path: '/call/:callLogId',
      component: 'CallDetailPage',
      params: { callLogId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'callDetail.base', search: {}, description: '通话详情' }],
      queryParams: {},
      description: '通话详情',
    },

    // =========================
    // Contacts flow
    // =========================
    {
      path: '/contacts/new',
      component: 'NewContactPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'contactNew.base', search: {}, description: '新建联系人（小米账号）' }],
      queryParams: {},
      description: '新建联系人',
    },

    // =========================
    // Settings (from decompiled preference_*.xml)
    // =========================
    {
      path: '/settings/calls',
      component: 'PhoneSettingsHomePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'dialerSettings.base', search: {}, description: '电话设置-通话' }],
      queryParams: {},
      description: '电话设置（通话）',
    },
    {
      path: '/settings/contacts',
      component: 'PhoneSettingsHomePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'contactsSettings.base', search: {}, description: '电话设置-联系人' }],
      queryParams: {},
      description: '电话设置（联系人）',
    },
    {
      path: '/settings/page/:pageId',
      component: 'PhonePreferenceScreenPage',
      params: { pageId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'phonePref.base', search: {}, description: '电话设置-偏好页' }],
      queryParams: {},
      description: '电话设置-偏好页',
    },
  ],

  transitions: [
    // =========================
    // Main tab switching (bottom nav)
    // =========================
    {
      id: 'tab.calls',
      from: ['/contacts', '/business'],
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到通话',
      ui: { placement: 'tabbar', icon: 'tab_calls', gesture: 'tap' },
    },
    {
      id: 'tab.contacts',
      from: ['/', '/business'],
      to: '/contacts',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到联系人',
      ui: { placement: 'tabbar', icon: 'tab_contacts', gesture: 'tap' },
    },
    {
      id: 'tab.business',
      from: ['/', '/contacts'],
      to: '/business',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到营业厅',
      ui: { placement: 'tabbar', icon: 'tab_business', gesture: 'tap' },
    },

    // =========================
    // Dialpad overlay
    // =========================
    {
      id: 'dialpad.open',
      from: { path: '/', search: { dialpad: null } },
      to: '/',
      search: { dialpad: 'true' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开拨号盘',
      ui: { placement: 'fab', icon: 'dialpad', gesture: 'tap' },
    },

    // =========================
    // Contacts actions
    // =========================
    {
      id: 'contacts.favorites.on',
      from: '/contacts',
      to: '/contacts',
      search: { fav: 'true' },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '筛选收藏联系人',
      ui: { placement: 'content', icon: 'favorite', gesture: 'tap' },
    },
    {
      id: 'contacts.favorites.off',
      from: '/contacts',
      to: '/contacts',
      search: { fav: null },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '退出收藏筛选',
      ui: { placement: 'content', icon: 'favorite_off', gesture: 'tap' },
    },
    {
      id: 'contact.new.open',
      from: '/contacts',
      to: '/contacts/new',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '新建联系人',
      ui: { placement: 'fab', icon: 'add', gesture: 'tap' },
    },

    // =========================
    // Search / detail (placeholders for upcoming pages)
    // =========================
    {
      id: 'search.open',
      from: ['/', '/contacts'],
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开搜索',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'contact.open',
      from: ['/contacts', '/search'],
      to: '/contact/:contactId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { contactId: 'string' },
      label: '打开联系人详情',
      ui: { placement: 'content', icon: 'contact', gesture: 'tap' },
    },
    {
      id: 'call.open',
      from: ['/', '/contact/:contactId'],
      to: '/call/:callLogId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { callLogId: 'string' },
      label: '打开通话详情',
      ui: { placement: 'content', icon: 'call', gesture: 'tap' },
    },

    // =========================
    // Settings entry
    // =========================
    {
      id: 'settings.open.calls',
      from: '/',
      to: '/settings/calls',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开电话设置（通话）',
      ui: { placement: 'topbar', icon: 'settings', gesture: 'tap' },
    },
    {
      id: 'settings.open.contacts',
      from: '/contacts',
      to: '/settings/contacts',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开电话设置（联系人）',
      ui: { placement: 'topbar', icon: 'settings', gesture: 'tap' },
    },
    {
      id: 'settings.open.business',
      from: '/business',
      to: '/settings/calls',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开电话设置',
      ui: { placement: 'topbar', icon: 'settings', gesture: 'tap' },
    },
    {
      id: 'settings.page.open',
      from: ['/settings/calls', '/settings/contacts', '/settings/page/:pageId'],
      to: '/settings/page/:pageId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '打开设置子页',
      ui: { placement: 'content', icon: 'chevron', gesture: 'tap' },
    },
  ],

  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];


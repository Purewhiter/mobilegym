/**
 * Railway12306 导航声明（完整版）
 */

import type { NavigationDeclaration } from './navigation.types';

export type TransitionId =
  | 'tab.home'
  | 'tab.travel'
  | 'tab.orders'
  | 'tab.member'
  | 'tab.my'
  | 'home.stationSelect.from'
  | 'home.stationSelect.to'
  | 'home.dateSelect'
  | 'home.queryResult'
  | 'home.allApps'
  | 'orders.myTickets'
  | 'orders.paidOrders'
  | 'orders.incompleteOrders'
  | 'orders.invoice'
  | 'travel.goHome'
  | 'my.settings'
  | 'my.notifications'
  | 'my.account'
  | 'settings.changePassword'
  | 'settings.notificationSettings'
  | 'settings.idVerify'
  | 'settings.fingerprint'
  | 'settings.versionSwitch'
  | 'settings.fontSize'
  | 'settings.cancelAccount'
  | 'settings.paymentPassword'
  | 'account.studentVerify'
  | 'account.changePhone'
  | 'account.editProfile'
  | 'service.stationBoard'
  | 'service.timetable'
  | 'service.servicePhone'
  | 'service.specialPassenger'
  | 'service.airRail'
  | 'service.busTicket'
  | 'trainDetail.book'
  | 'orderConfirm.passengers'
  | 'incompleteOrders.backHome'
  | 'incompleteOrders.backOrders'
  | 'incompleteOrders.paymentPlatform.open'
  | 'paymentPlatform.paymentSuccess'
  | 'paymentSuccess.backHome'
  | 'paymentSuccess.backOrders'
  | 'paidOrders.openRefundNotice'
  | 'paidOrders.refundConfirm'
  | 'orderDetail.openRefundNotice'
  | 'orderDetail.refundConfirm'
  | 'myTickets.openRefundNotice'
  | 'myTickets.refundConfirm'
  | 'refundConfirm.openRefundNotice'
  | 'refundConfirm.refundSuccess'
  | 'paidOrders.orderDetail'
  | 'my.passengers'
  | 'passengers.addPassenger'
  | 'addPassenger.openIdTypePicker'
  | 'addPassenger.openTicketTypePicker'
  | 'addPassenger.showAlert'
  | 'auth.login.success'
  | 'auth.forgotPassword.open'
  | 'auth.register.open'
  | 'auth.register.verify'
  | 'auth.forgotPassword.done'
  | 'refundSuccess.backOrders'
  | 'invoice.invoiceHeaders'
  | 'invoice.addHeader'
  | 'invoice.emailSettings'
  | 'fontSize.switchNow';

export const NAVIGATION_DECLARATION: NavigationDeclaration = {
  app: 'railway12306',
  routes: [
    // ── Main tabs ──
    {
      path: '/', component: 'HomePage', params: {}, entryPoint: 'home',
      uiStates: [{
        id: 'home.base', search: {}, description: '首页默认状态',
        actions: [
          { id: 'home.form.swapStations', label: '交换出发/到达站', behavior: 'other' },
          { id: 'home.form.toggleStudent', label: '切换学生票', behavior: 'toggle' },
        ],
      }],
      queryParams: {}, description: '首页',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '首页主滚动' }],
    },
    {
      path: '/travel', component: 'TravelServicePage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'travel.base', search: {}, description: '出行服务' }],
      queryParams: {}, description: '出行服务',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/orders', component: 'OrdersPage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'orders.base', search: {}, description: '订单' }],
      queryParams: {}, description: '订单',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/member', component: 'MemberPage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'member.base', search: {}, description: '铁路会员' }],
      queryParams: {}, description: '铁路会员',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/my', component: 'MyPage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'my.base', search: {}, description: '我的' }],
      queryParams: {}, description: '我的',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    // ── Sub-pages ──
    {
      path: '/station-select', component: 'StationSelectPage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'stationSelect.base', search: {}, description: '车站选择' }],
      queryParams: {}, description: '车站选择',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/date-select', component: 'DateSelectPage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'dateSelect.base', search: {}, description: '日期选择' }],
      queryParams: {}, description: '日期选择',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/query-result', component: 'QueryResultPage', params: {}, entryPoint: 'none',
      uiStates: [
        { id: 'queryResult.direct', search: { tab: 'direct' }, description: '直达结果' },
        { id: 'queryResult.transfer', search: { tab: 'transfer' }, description: '中转结果' },
        { id: 'queryResult.filterPanel', search: { tab: 'direct', filterPanel: 'open' }, description: '筛选面板' },
      ],
      queryParams: {}, description: '查询结果',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/my-tickets', component: 'MyTicketsPage', params: {}, entryPoint: 'none',
      uiStates: [
        { id: 'myTickets.base', search: {}, description: '本人车票' },
        { id: 'myTickets.refundNotice', search: { dialog: 'refundNotice' }, description: '退票提示弹窗' },
      ],
      queryParams: { id: 'string' }, description: '本人车票',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/paid-orders', component: 'PaidOrdersPage', params: {}, entryPoint: 'none',
      uiStates: [
        { id: 'paidOrders.base', search: {}, description: '已支付' },
        { id: 'paidOrders.refundNotice', search: { dialog: 'refundNotice' }, description: '退票提示弹窗' },
      ],
      queryParams: { id: 'string' }, description: '已支付',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/order-detail', component: 'OrderDetailPage', params: {}, entryPoint: 'none',
      uiStates: [
        { id: 'orderDetail.base', search: {}, description: '订单详情' },
        { id: 'orderDetail.refundNotice', search: { dialog: 'refundNotice' }, description: '退票提示弹窗' },
      ],
      queryParams: { id: 'string' }, description: '订单详情',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    {
      path: '/incomplete-orders', component: 'IncompleteOrdersPage', params: {}, entryPoint: 'none',
      uiStates: [{ id: 'incompleteOrders.base', search: {}, description: '未完成' }],
      queryParams: {}, description: '未完成',
      scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }],
    },
    // ── 新增页面 ──
    { path: '/settings', component: 'SettingsPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'settings.base', search: {}, description: '系统设置' }], queryParams: {}, description: '系统设置', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/all-apps', component: 'AllAppsPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'allApps.base', search: {}, description: '全部应用' }], queryParams: {}, description: '全部应用', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/station-board', component: 'StationBoardPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'stationBoard.base', search: {}, description: '车站大屏' }], queryParams: {}, description: '车站大屏', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/timetable', component: 'TimetablePage', params: {}, entryPoint: 'none', uiStates: [{ id: 'timetable.base', search: {}, description: '时刻表' }], queryParams: {}, description: '时刻表', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/notifications', component: 'NotificationsPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'notifications.base', search: {}, description: '通知消息' }], queryParams: {}, description: '通知消息', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/invoice', component: 'InvoicePage', params: {}, entryPoint: 'none', uiStates: [{ id: 'invoice.base', search: {}, description: '电子发票' }], queryParams: {}, description: '电子发票', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/invoice-headers', component: 'InvoiceHeadersPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'invoiceHeaders.base', search: {}, description: '发票抬头管理' }], queryParams: {}, description: '发票抬头管理', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/add-invoice-header', component: 'AddInvoiceHeaderPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'addInvoiceHeader.base', search: {}, description: '添加发票抬头' }], queryParams: {}, description: '添加发票抬头', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/invoice-email', component: 'InvoiceEmailPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'invoiceEmail.base', search: {}, description: '发送邮箱设置' }], queryParams: {}, description: '发送邮箱设置', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/service-phone', component: 'ServicePhonePage', params: {}, entryPoint: 'none', uiStates: [{ id: 'servicePhone.base', search: {}, description: '客服电话' }], queryParams: {}, description: '客服电话', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/my-account', component: 'MyAccountPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'myAccount.base', search: {}, description: '我的账户' }], queryParams: {}, description: '我的账户', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/change-password', component: 'ChangePasswordPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'changePassword.base', search: {}, description: '修改密码' }], queryParams: {}, description: '修改密码', scrollContainers: [] },
    { path: '/notification-settings', component: 'NotificationSettingsPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'notificationSettings.base', search: {}, description: '通知设置' }], queryParams: {}, description: '通知设置', scrollContainers: [] },
    { path: '/id-verify', component: 'IdVerifyPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'idVerify.base', search: {}, description: '人证核验' }], queryParams: {}, description: '人证核验', scrollContainers: [] },
    { path: '/fingerprint', component: 'FingerprintPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'fingerprint.base', search: {}, description: '指纹登录' }], queryParams: {}, description: '指纹登录', scrollContainers: [] },
    { path: '/version-switch', component: 'VersionSwitchPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'versionSwitch.base', search: {}, description: '版本切换' }], queryParams: {}, description: '版本切换', scrollContainers: [] },
    { path: '/font-size', component: 'FontSizePage', params: {}, entryPoint: 'none', uiStates: [{ id: 'fontSize.base', search: {}, description: '字体大小及对比度' }], queryParams: {}, description: '字体大小及对比度', scrollContainers: [] },
    { path: '/cancel-account', component: 'CancelAccountPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'cancelAccount.base', search: {}, description: '注销原因' }], queryParams: {}, description: '注销原因', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/payment-password', component: 'PaymentPasswordPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'paymentPassword.base', search: {}, description: '消费密码' }], queryParams: {}, description: '消费密码', scrollContainers: [] },
    { path: '/student-verify', component: 'StudentVerifyPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'studentVerify.base', search: {}, description: '学生优惠资质信息' }], queryParams: {}, description: '学生优惠资质信息', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/change-phone', component: 'ChangePhonePage', params: {}, entryPoint: 'none', uiStates: [{ id: 'changePhone.base', search: {}, description: '修改手机号' }], queryParams: {}, description: '修改手机号', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/special-passenger', component: 'SpecialPassengerPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'specialPassenger.base', search: {}, description: '重点旅客预约' }], queryParams: {}, description: '重点旅客预约', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/air-rail', component: 'AirRailPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'airRail.base', search: {}, description: '机票·空铁联运' }], queryParams: {}, description: '机票·空铁联运', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/bus-ticket', component: 'BusTicketPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'busTicket.base', search: {}, description: '汽车票' }], queryParams: {}, description: '汽车票', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/order-confirm', component: 'OrderConfirmPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'orderConfirm.base', search: {}, description: '确认订单' }], queryParams: { idx: 'number', seat: 'string' }, description: '确认订单', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/passengers', component: 'PassengerListPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'passengers.manage', search: { mode: 'manage' }, description: '乘车人管理' }, { id: 'passengers.select', search: { mode: 'select' }, description: '选择乘车人' }], queryParams: {}, description: '乘车人', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/add-passenger', component: 'AddPassengerPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'addPassenger.base', search: {}, description: '添加乘车人' }, { id: 'addPassenger.idTypePicker', search: { dialog: 'idType' }, description: '证件类型选择' }, { id: 'addPassenger.ticketTypePicker', search: { dialog: 'ticketType' }, description: '优惠类型选择' }, { id: 'addPassenger.alert', search: { dialog: 'alert' }, description: '提示弹窗' }], queryParams: {}, description: '添加乘车人', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/edit-profile', component: 'EditProfilePage', params: {}, entryPoint: 'none', uiStates: [{ id: 'editProfile.base', search: {}, description: '修改个人信息' }], queryParams: {}, description: '修改个人信息', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/payment-platform', component: 'PaymentPlatformPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'paymentPlatform.base', search: {}, description: '请您支付' }], queryParams: {}, description: '支付平台', scrollContainers: [] },
    { path: '/payment-success', component: 'PaymentSuccessPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'paymentSuccess.base', search: {}, description: '支付成功' }], queryParams: {}, description: '支付成功', scrollContainers: [] },
    { path: '/refund-confirm', component: 'RefundConfirmPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'refundConfirm.base', search: {}, description: '退票确认' }, { id: 'refundConfirm.refundNotice', search: { dialog: 'refundNotice' }, description: '退票二次提示弹窗' }], queryParams: { id: 'string' }, description: '退票确认', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/refund-success', component: 'RefundSuccessPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'refundSuccess.base', search: {}, description: '退票成功' }], queryParams: {}, description: '退票成功', scrollContainers: [] },
    { path: '/auth/login', component: 'LoginPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'authLogin.base', search: {}, description: '登录' }], queryParams: {}, description: '登录', scrollContainers: [] },
    { path: '/auth/register', component: 'RegisterPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'authRegister.base', search: {}, description: '注册' }], queryParams: {}, description: '注册', scrollContainers: [{ name: 'main', direction: 'vertical', description: '主滚动' }] },
    { path: '/auth/register-verify', component: 'RegisterVerifyPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'authRegisterVerify.base', search: {}, description: '注册验证' }], queryParams: {}, description: '注册验证', scrollContainers: [] },
    { path: '/auth/forgot-password', component: 'ForgotPasswordPage', params: {}, entryPoint: 'none', uiStates: [{ id: 'authForgotPassword.base', search: {}, description: '找回密码' }], queryParams: {}, description: '找回密码', scrollContainers: [] },
  ],
  transitions: [
    // ── TabBar ──
    { id: 'tab.home', from: ['/', '/travel', '/orders', '/member', '/my'], to: '/', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '首页', ui: { placement: 'tabbar', icon: 'Home', gesture: 'tap' } },
    { id: 'tab.travel', from: ['/', '/travel', '/orders', '/member', '/my'], to: '/travel', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '出行服务', ui: { placement: 'tabbar', icon: 'Bus', gesture: 'tap' } },
    { id: 'tab.orders', from: ['/', '/travel', '/orders', '/member', '/my'], to: '/orders', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '订单', ui: { placement: 'tabbar', icon: 'FileText', gesture: 'tap' } },
    { id: 'tab.member', from: ['/', '/travel', '/orders', '/member', '/my'], to: '/member', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '铁路会员', ui: { placement: 'tabbar', icon: 'Award', gesture: 'tap' } },
    { id: 'tab.my', from: ['/', '/travel', '/orders', '/member', '/my'], to: '/my', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '我的', ui: { placement: 'tabbar', icon: 'User', gesture: 'tap' } },
    // ── 首页 → 子页面 ──
    { id: 'home.stationSelect.from', from: '/', to: '/station-select', search: {}, searchParams: {}, mode: 'push', params: {}, label: '选择出发站', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'home.stationSelect.to', from: '/', to: '/station-select', search: {}, searchParams: {}, mode: 'push', params: {}, label: '选择到达站', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'home.dateSelect', from: ['/', '/query-result'], to: '/date-select', search: {}, searchParams: {}, mode: 'push', params: {}, label: '选择日期', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'home.queryResult', from: '/', to: '/query-result', search: { tab: 'direct' }, searchParams: {}, mode: 'push', params: {}, label: '查询车票', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 订单 → 子页面 ──
    { id: 'orders.myTickets', from: '/orders', to: '/my-tickets', search: {}, searchParams: {}, mode: 'push', params: {}, label: '本人车票', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'orders.paidOrders', from: '/orders', to: '/paid-orders', search: {}, searchParams: {}, mode: 'push', params: {}, label: '已支付', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'orders.incompleteOrders', from: ['/orders', '/order-confirm'], to: '/incomplete-orders', search: {}, searchParams: { from: 'string' }, mode: 'push', params: {}, label: '未完成', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'incompleteOrders.backHome', from: '/incomplete-orders', to: '/', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '返回首页', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'incompleteOrders.backOrders', from: '/incomplete-orders', to: '/orders', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '返回订单', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 出行服务 → 首页 ──
    { id: 'travel.goHome', from: '/travel', to: '/', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '去购票', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 首页 → 新增子页面 ──
    { id: 'home.allApps', from: '/', to: '/all-apps', search: {}, searchParams: {}, mode: 'push', params: {}, label: '全部应用', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'service.stationBoard', from: ['/', '/my', '/all-apps'], to: '/station-board', search: {}, searchParams: {}, mode: 'push', params: {}, label: '车站大屏', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'service.timetable', from: ['/', '/my', '/all-apps'], to: '/timetable', search: {}, searchParams: {}, mode: 'push', params: {}, label: '时刻表', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'service.servicePhone', from: ['/', '/my', '/all-apps'], to: '/service-phone', search: {}, searchParams: {}, mode: 'push', params: {}, label: '客服电话', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'service.specialPassenger', from: ['/my', '/all-apps'], to: '/special-passenger', search: {}, searchParams: {}, mode: 'push', params: {}, label: '重点旅客预约', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'service.airRail', from: ['/', '/all-apps'], to: '/air-rail', search: {}, searchParams: {}, mode: 'push', params: {}, label: '空铁联运', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'service.busTicket', from: ['/', '/all-apps'], to: '/bus-ticket', search: {}, searchParams: {}, mode: 'push', params: {}, label: '汽车票', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 订单 → 发票 ──
    { id: 'orders.invoice', from: '/orders', to: '/invoice', search: {}, searchParams: {}, mode: 'push', params: {}, label: '电子发票', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'invoice.invoiceHeaders', from: '/invoice', to: '/invoice-headers', search: {}, searchParams: {}, mode: 'push', params: {}, label: '发票抬头管理', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'invoice.addHeader', from: '/invoice-headers', to: '/add-invoice-header', search: {}, searchParams: {}, mode: 'push', params: {}, label: '添加发票抬头', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'invoice.emailSettings', from: '/invoice', to: '/invoice-email', search: {}, searchParams: {}, mode: 'push', params: {}, label: '发送邮箱设置', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 我的 → 子页面 ──
    { id: 'my.settings', from: '/my', to: '/settings', search: {}, searchParams: {}, mode: 'push', params: {}, label: '系统设置', ui: { placement: 'topbar', icon: 'Settings', gesture: 'tap' } },
    { id: 'my.notifications', from: '/my', to: '/notifications', search: {}, searchParams: {}, mode: 'push', params: {}, label: '通知消息', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'my.account', from: '/my', to: '/my-account', search: {}, searchParams: {}, mode: 'push', params: {}, label: '我的账户', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 设置 → 子页面 ──
    { id: 'settings.changePassword', from: ['/settings', '/my-account'], to: '/change-password', search: {}, searchParams: {}, mode: 'push', params: {}, label: '修改密码', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.notificationSettings', from: '/settings', to: '/notification-settings', search: {}, searchParams: {}, mode: 'push', params: {}, label: '通知设置', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.idVerify', from: '/settings', to: '/id-verify', search: {}, searchParams: {}, mode: 'push', params: {}, label: '人证核验', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.fingerprint', from: '/settings', to: '/fingerprint', search: {}, searchParams: {}, mode: 'push', params: {}, label: '指纹登录', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.versionSwitch', from: '/settings', to: '/version-switch', search: {}, searchParams: {}, mode: 'push', params: {}, label: '版本切换', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.fontSize', from: '/settings', to: '/font-size', search: {}, searchParams: {}, mode: 'push', params: {}, label: '字体大小及对比度', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'fontSize.switchNow', from: '/font-size', to: '/', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '立即切换', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.cancelAccount', from: '/settings', to: '/cancel-account', search: {}, searchParams: {}, mode: 'push', params: {}, label: '注销账户', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'settings.paymentPassword', from: '/settings', to: '/payment-password', search: {}, searchParams: {}, mode: 'push', params: {}, label: '消费密码', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 我的账户 → 子页面 ──
    { id: 'account.editProfile', from: '/my-account', to: '/edit-profile', search: {}, searchParams: {}, mode: 'push', params: {}, label: '修改个人信息', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'account.studentVerify', from: ['/my-account', '/edit-profile'], to: '/student-verify', search: {}, searchParams: {}, mode: 'push', params: {}, label: '学生资质查询', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'account.changePhone', from: '/my-account', to: '/change-phone', search: {}, searchParams: {}, mode: 'push', params: {}, label: '修改手机号', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 购票流程 ──
    { id: 'trainDetail.book', from: { path: '/query-result', search: { tab: 'direct' } }, to: '/order-confirm', search: {}, searchParams: { idx: 'number', seat: 'string' }, mode: 'push', params: {}, label: '预订', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'orderConfirm.passengers', from: '/order-confirm', to: '/passengers', search: { mode: 'select' }, searchParams: {}, mode: 'push', params: {}, label: '选择乘车人', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'my.passengers', from: '/my', to: '/passengers', search: { mode: 'manage' }, searchParams: {}, mode: 'push', params: {}, label: '乘车人管理', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'passengers.addPassenger', from: '/passengers', to: '/add-passenger', search: {}, searchParams: {}, mode: 'push', params: {}, label: '添加乘车人', ui: { placement: 'topbar', icon: '', gesture: 'tap' } },
    { id: 'addPassenger.openIdTypePicker', from: '/add-passenger', to: '/add-passenger', search: { dialog: 'idType' }, searchParams: {}, mode: 'push', params: {}, label: '证件类型选择', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'addPassenger.openTicketTypePicker', from: '/add-passenger', to: '/add-passenger', search: { dialog: 'ticketType' }, searchParams: {}, mode: 'push', params: {}, label: '优惠类型选择', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'addPassenger.showAlert', from: '/add-passenger', to: '/add-passenger', search: { dialog: 'alert' }, searchParams: {}, mode: 'push', params: {}, label: '提示弹窗', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    // ── Auth ──
    { id: 'auth.login.success', from: '/auth/login', to: '/', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '登录成功', ui: { placement: 'none', icon: 'home', gesture: 'tap' } },
    { id: 'auth.forgotPassword.open', from: '/auth/login', to: '/auth/forgot-password', search: {}, searchParams: {}, mode: 'push', params: {}, label: '找回密码', ui: { placement: 'content', icon: 'forgot_password', gesture: 'tap' } },
    { id: 'auth.register.open', from: '/auth/login', to: '/auth/register', search: {}, searchParams: {}, mode: 'push', params: {}, label: '注册账号', ui: { placement: 'content', icon: 'register', gesture: 'tap' } },
    { id: 'auth.register.verify', from: '/auth/register', to: '/auth/register-verify', search: {}, searchParams: {}, mode: 'push', params: {}, label: '注册验证', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    { id: 'auth.forgotPassword.done', from: '/auth/forgot-password', to: '/auth/login', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '返回登录', ui: { placement: 'none', icon: 'login', gesture: 'tap' } },
    { id: 'refundSuccess.backOrders', from: '/refund-success', to: '/orders', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '返回订单', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 未完成 → 支付平台 ──
    { id: 'incompleteOrders.paymentPlatform.open', from: '/incomplete-orders', to: '/payment-platform', search: {}, searchParams: { from: 'string' }, mode: 'push', params: {}, label: '打开支付平台', ui: { placement: 'content', icon: 'payment', gesture: 'tap' } },
    // ── 支付平台 → 支付成功 ──
    { id: 'paymentPlatform.paymentSuccess', from: '/payment-platform', to: '/payment-success', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '支付成功', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    { id: 'paymentSuccess.backHome', from: '/payment-success', to: '/', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '返回首页', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'paymentSuccess.backOrders', from: '/payment-success', to: '/paid-orders', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '订单详情', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    // ── 退票流程 ──
    { id: 'paidOrders.openRefundNotice', from: '/paid-orders', to: '/paid-orders', search: { dialog: 'refundNotice' }, searchParams: { id: 'string' }, mode: 'push', params: {}, label: '退票提示', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'paidOrders.refundConfirm', from: '/paid-orders', to: '/refund-confirm', search: {}, searchParams: { id: 'string' }, mode: 'replace', params: {}, label: '退票确认', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    { id: 'orderDetail.openRefundNotice', from: '/order-detail', to: '/order-detail', search: { dialog: 'refundNotice' }, searchParams: { id: 'string' }, mode: 'push', params: {}, label: '退票提示', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'orderDetail.refundConfirm', from: '/order-detail', to: '/refund-confirm', search: {}, searchParams: { id: 'string' }, mode: 'replace', params: {}, label: '退票确认', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    { id: 'myTickets.openRefundNotice', from: '/my-tickets', to: '/my-tickets', search: { dialog: 'refundNotice' }, searchParams: { id: 'string' }, mode: 'push', params: {}, label: '退票提示', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'myTickets.refundConfirm', from: '/my-tickets', to: '/refund-confirm', search: {}, searchParams: { id: 'string' }, mode: 'replace', params: {}, label: '退票确认', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    { id: 'refundConfirm.openRefundNotice', from: '/refund-confirm', to: '/refund-confirm', search: { dialog: 'refundNotice' }, searchParams: { id: 'string' }, mode: 'push', params: {}, label: '确认退票提示', ui: { placement: 'content', icon: '', gesture: 'tap' } },
    { id: 'refundConfirm.refundSuccess', from: '/refund-confirm', to: '/refund-success', search: {}, searchParams: {}, mode: 'replace', params: {}, label: '退票成功', ui: { placement: 'none', icon: '', gesture: 'tap' } },
    { id: 'paidOrders.orderDetail', from: '/paid-orders', to: '/order-detail', search: {}, searchParams: { id: 'string' }, mode: 'push', params: {}, label: '订单详情', ui: { placement: 'content', icon: '', gesture: 'tap' } },
  ],
  capabilities: { historyBack: true },
};

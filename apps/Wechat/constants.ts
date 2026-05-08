
import type { LucideIcon } from './res/icons';
import {
  IcCard, IcBanknote, IcShieldCheck, IcSmartphone, IcZap, IcDroplet,
  IcHeart, IcBus, IcPlane, IcCar, IcBed, IcShoppingBag,
  IcGift, IcFilm, IcTicket, IcAdd, IcMessage,
} from './res/icons';
import { ServiceGroup } from './types';
import { strings } from './res/strings';
import type { WechatStringKey } from './hooks/useWechatStrings';

type Strings = typeof strings;

export function getServicesData(t: Strings): ServiceGroup[] {
  return [
    {
      title: t.service_group_finance,
      items: [
        { label: t.service_credit_card_repay, icon: IcCard, color: 'text-green-600' },
        { label: t.service_wealth_management, icon: IcBanknote, color: 'text-orange-500' },
        { label: t.service_insurance, icon: IcShieldCheck, color: 'text-orange-600' },
      ],
    },
    {
      title: t.service_group_daily_life,
      items: [
        { label: t.service_phone_topup, icon: IcSmartphone, color: 'text-blue-500' },
        { label: t.service_utility_payment, icon: IcZap, color: 'text-green-500' },
        { label: t.service_qcoin_topup, icon: IcDroplet, color: 'text-blue-400' },
        { label: t.service_city_service, icon: IcBus, color: 'text-green-600' },
        { label: t.service_tencent_charity, icon: IcHeart, color: 'text-red-500' },
        { label: t.service_healthcare, icon: IcAdd, color: 'text-orange-400' },
      ],
    },
    {
      title: t.service_group_transport,
      items: [
        { label: t.service_travel, icon: IcBus, color: 'text-blue-600' },
        { label: t.service_train_air_ticket, icon: IcPlane, color: 'text-blue-500' },
        { label: t.service_didi, icon: IcCar, color: 'text-orange-500' },
        { label: t.service_hotel, icon: IcBed, color: 'text-green-600' },
      ],
    },
    {
      title: t.service_group_shopping,
      items: [
        { label: t.service_brand_discovery, icon: IcShoppingBag, color: 'text-red-500' },
        { label: t.service_jd_shopping, icon: IcGift, color: 'text-red-600' },
        { label: t.service_meituan_delivery, icon: IcShoppingBag, color: 'text-yellow-500' },
        { label: t.service_entertainment, icon: IcFilm, color: 'text-red-500' },
        { label: t.service_meituan_group_buy, icon: IcTicket, color: 'text-orange-500' },
        { label: t.service_pinduoduo, icon: IcGift, color: 'text-red-600' },
        { label: t.service_vip_sale, icon: IcShoppingBag, color: 'text-pink-600' },
        { label: t.service_zhuanzhuan, icon: IcZap, color: 'text-red-500' },
      ],
    },
  ];
}

// ============================================================================
// 可搜索内置功能注册表
//
// 搜索页(/search)除联系人外还能搜到内置功能入口(如"微信运动")。
// 每条 feature 点击后可能:
//   - 直接跳到功能主页(route)
//   - 根据 enabled 开关分流:未启用→启用页、已启用→功能主页(gate)
//
// 匹配:对当前 locale 下的显示名(nameKey 解析后)做大小写不敏感的子串匹配,
// 不做同义词/拼音/跨语言映射。
// ============================================================================

/** settings store 中的布尔值 ref 路径,点分隔 */
export type EnabledRef = string;

export interface FeatureGate {
  /** 读取此路径的 boolean 作为 enabled 判定 */
  enabledRef: EnabledRef;
  /** 已启用时跳转的路径 */
  whenEnabledRoute: string;
  /** 未启用时跳转的路径(通常是启用设置页) */
  whenDisabledRoute: string;
  /** 已启用分支的 transition id(bench 可消费,Search.tsx 内部以字面量再次引用) */
  enabledTransitionId: string;
  /** 未启用分支的 transition id */
  disabledTransitionId: string;
}

export interface SearchableFeature {
  /** 与功能/模块 id 对齐(如 'wechatSports') */
  id: string;
  /** i18n key,显示名 = useWechatStrings()[nameKey],匹配也用它 */
  nameKey: WechatStringKey;
  /** 图标组件,必须使用 res/icons.tsx 导出的 Ic* 别名(CLAUDE.md 资源规范) */
  icon: LucideIcon;
  /** 图标圆角方块背景色 tailwind class */
  iconBg: string;
  /**
   * 入口路由策略:
   * - 声明了 gate 则按 enabled 分流
   * - 否则使用 route + routeTransitionId 直接跳转
   */
  gate?: FeatureGate;
  route?: string;
  routeTransitionId?: string;
}

export const SEARCHABLE_FEATURES: SearchableFeature[] = [
  {
    id: 'wechatSports',
    nameKey: 'settings_wechat_sports',
    icon: IcMessage,
    iconBg: 'bg-app-primary',
    gate: {
      enabledRef: 'settings.accessibility.wechatSports.enabled',
      whenEnabledRoute: '/wechat-sports',
      whenDisabledRoute: '/settings/general/accessibility/wechatSports',
      enabledTransitionId: 'discover.search.feature.wechatSports.open',
      disabledTransitionId: 'discover.search.feature.wechatSports.enable.open',
    },
  },
];

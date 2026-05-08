import type { AlipayBillCategoryId, AlipayBillQuickFilterId } from './types';

export const ALIPAY_CONSTANTS = {} as const;

// ── 服务目录（静态结构，用户不可修改）──────────────────────────────

export const QUICK_ACTIONS = [
  { id: 'scan', name: '扫一扫', icon: 'IcScan', color: '#ffffff' },
  { id: 'pay', name: '收付款', icon: 'IcQrCode', color: '#ffffff' },
  { id: 'travel', name: '出行', icon: 'IcBus', color: '#ffffff', badgeText: '年车票' },
  { id: 'card', name: '卡包', icon: 'IcWalletCards', color: '#ffffff', dotBadge: true },
];

export const MAIN_SERVICES = [
  { id: 'antInsure', name: '蚂蚁保', icon: 'IcSecureCheck', color: '#1677FF' },
  { id: 'lifePay', name: '生活缴费', icon: 'IcFastPay', color: '#FF7D00' },
  { id: 'train', name: '火车票机票', icon: 'IcTicket', color: '#FF7D00' },
  { id: 'didi', name: '高德打车', icon: 'IcTaxi', color: '#1677FF' },
  { id: 'movie', name: '淘票票', icon: 'IcMovie', color: '#FF7D00' },
  { id: 'transfer', name: '转账', icon: 'IcTransfer', color: '#1677FF' },
  { id: 'creditCard', name: '我的信用卡', icon: 'IcCard', color: '#1677FF' },
  { id: 'phone', name: '手机营业厅', icon: 'IcPhone', color: '#FF7D00' },
  { id: 'miniPrograms', name: '我的小程序', icon: 'IcApp', color: '#1677FF' },
  { id: 'more', name: '更多', icon: 'IcGrid', color: '#666666' },
];

export const COMMON_SERVICES = [
  { id: 'jinling', name: '金陵网证', icon: 'IcIdCard', color: '#1677FF' },
  { id: 'huabei', name: '花呗', icon: 'IcCircle', color: '#1677FF' },
  { id: 'meituan', name: '美团骑行', icon: 'IcBike', color: '#FFC107' },
  { id: 'haidilao', name: '海底捞火锅', icon: 'IcFood', color: '#FF3B30' },
  { id: 'duodian', name: '多点', icon: 'IcFlame', color: '#FF7D00' },
];

export const FINANCE_SERVICES = [
  { id: '余额宝', name: '余额宝', icon: 'IcPiggyBank', color: '#1677FF' },
  { id: '稳健理财', name: '稳健理财', icon: 'IcSecureCheck', color: '#1677FF' },
  { id: '指数+', name: '指数+', icon: 'IcTrend', color: '#1677FF' },
  { id: '基金', name: '基金', icon: 'IcChart', color: '#1677FF' },
  { id: '黄金', name: '黄金', icon: 'IcCoins', color: '#FFD700' },
  { id: '股票', name: '股票', icon: 'IcTrend', color: '#1677FF' },
  { id: '定期', name: '定期', icon: 'IcPay', color: '#1677FF' },
  { id: '保险', name: '保险', icon: 'IcShield', color: '#1677FF' },
  { id: '帮你投', name: '帮你投', icon: 'IcReceive', color: '#1677FF' },
  { id: '高端理财', name: '高端理财', icon: 'IcWallet', color: '#1677FF' },
];

export const MY_SERVICES_LIST = [
  { id: 'bill', name: '账单', icon: 'IcFile', color: '#FF7D00', extra: '' },
  { id: 'assets', name: '总资产', icon: 'IcChart', color: '#1677FF', extra: '查看账户余额' },
  { id: 'balance', name: '余额', icon: 'IcWallet', color: '#1677FF', extra: '' },
  { id: 'yuebao', name: '余额宝', icon: 'IcPiggyBank', color: '#FF7D00', extra: '余额宝收益到账啦' },
  { id: 'huabei', name: '花呗', icon: 'IcCircle', color: '#1677FF', extra: '花呗还款减负担' },
];

export const MY_SERVICES_GRID = [
  { id: 'antInsure', name: '蚂蚁保', icon: 'IcSecureCheck', color: '#1677FF' },
  { id: 'sesame', name: '芝麻信用', icon: 'IcDroplet', color: '#1677FF' },
  { id: 'bankCard', name: '银行卡', icon: 'IcCard', color: '#FF7D00', tag: '可看银行卡号' },
  { id: 'yulibao', name: '余利宝', icon: 'IcBusiness', color: '#1677FF' },
  { id: 'loan', name: '网商贷', icon: 'IcBank', color: '#1677FF' },
  { id: 'mybank', name: '网商银行', icon: 'IcBuilding', color: '#1677FF' },
];

// ── 银行目录（静态结构，用户不可修改）──────────────────────────────

export type BankOption = {
  id: string;
  bankName: string;
  promo?: string;
};

export const BANK_OPTIONS: BankOption[] = [
  { id: 'abc', bankName: '中国农业银行', promo: '信用卡得10元红包' },
  { id: 'icbc', bankName: '中国工商银行', promo: '信用卡得15元红包' },
  { id: 'ccb', bankName: '中国建设银行', promo: '信用卡得8元红包' },
  { id: 'psbc', bankName: '中国邮政储蓄银行' },
  { id: 'boc', bankName: '中国银行' },
  { id: 'cmb', bankName: '招商银行' },
  { id: 'bocom', bankName: '交通银行' },
  { id: 'pab', bankName: '平安银行' },
  { id: 'citic', bankName: '中信银行' },
  { id: 'spdb', bankName: '浦发银行' },
  { id: 'cmbc', bankName: '中国民生银行' },
  { id: 'cgb', bankName: '广发银行' },
  { id: 'cib', bankName: '兴业银行' },
  { id: 'ceb', bankName: '中国光大银行' },
  { id: 'hxb', bankName: '华夏银行' },
];

export const MY_CIVIC_SERVICES = [
  { id: 'medical', name: '医保', icon: 'IcMedical', color: '#1677FF' },
  { id: 'social', name: '社保', icon: 'IcHeart', color: '#1677FF' },
  { id: 'housing', name: '住房公积金', icon: 'IcTabHome', color: '#1677FF' },
  { id: 'job', name: '就业', icon: 'IcUser', color: '#1677FF' },
];

export type BillQuickFilterOption = {
  id: AlipayBillQuickFilterId;
  label: string;
};

export const BILL_QUICK_FILTERS: BillQuickFilterOption[] = [
  { id: 'expense', label: '支出' },
  { id: 'shopping', label: '网购' },
  { id: 'offline', label: '线下消费' },
  { id: 'wealth', label: '理财' },
  { id: 'transfer', label: '转账' },
  { id: 'withdrawal', label: '提现' },
  { id: 'redPacket', label: '红包' },
  { id: 'repayment', label: '还款' },
  { id: 'utility', label: '缴费' },
  { id: 'phoneRecharge', label: '手机充值' },
  { id: 'merchantCollection', label: '二维码收款' },
  { id: 'freeze', label: '冻结/解冻' },
  { id: 'order', label: '订单' },
];

export type BillCategoryOption = {
  id: AlipayBillCategoryId;
  name: string;
  icon: string;
};

export const BILL_CATEGORIES: BillCategoryOption[] = [
  { id: 'dining', name: '餐饮美食', icon: 'IcFood' },
  { id: 'apparel', name: '服饰装扮', icon: 'IcShirt' },
  { id: 'department', name: '日用百货', icon: 'IcShoppingBag' },
  { id: 'home', name: '家居家装', icon: 'IcSofa' },
  { id: 'digital', name: '数码电器', icon: 'IcPhone' },
  { id: 'sports', name: '运动户外', icon: 'IcBike' },
  { id: 'beauty', name: '美容美发', icon: 'IcFeature' },
  { id: 'parentChild', name: '母婴亲子', icon: 'IcBaby' },
  { id: 'pets', name: '宠物', icon: 'IcPawPrint' },
  { id: 'transport', name: '交通出行', icon: 'IcBus' },
  { id: 'auto', name: '爱车养车', icon: 'IcTaxi' },
  { id: 'housing', name: '住房物业', icon: 'IcTabHome' },
  { id: 'travel', name: '酒店旅游', icon: 'IcTicket' },
  { id: 'leisure', name: '文化休闲', icon: 'IcMovie' },
  { id: 'education', name: '教育培训', icon: 'IcEducation' },
  { id: 'medical', name: '医疗健康', icon: 'IcMedical' },
  { id: 'lifeService', name: '生活服务', icon: 'IcApp' },
  { id: 'publicService', name: '公共服务', icon: 'IcGlobe' },
  { id: 'businessService', name: '商业服务', icon: 'IcBusiness' },
  { id: 'charity', name: '公益捐赠', icon: 'IcHeart' },
  { id: 'mutualAid', name: '互助保障', icon: 'IcSecureCheck' },
  { id: 'investment', name: '投资理财', icon: 'IcTrend' },
  { id: 'insurance', name: '保险', icon: 'IcShield' },
  { id: 'creditRepayment', name: '信用借还', icon: 'IcCard' },
  { id: 'topUp', name: '充值缴费', icon: 'IcPhone' },
  { id: 'income', name: '收入', icon: 'IcReceive' },
  { id: 'transferRedPacket', name: '转账红包', icon: 'IcGift' },
  { id: 'friendPayment', name: '亲友代付', icon: 'IcContacts' },
  { id: 'accountDepositWithdraw', name: '账户存取', icon: 'IcWallet' },
  { id: 'refund', name: '退款', icon: 'IcRefresh' },
  { id: 'other', name: '其他', icon: 'IcGrid' },
];

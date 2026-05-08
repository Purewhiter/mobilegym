import { BILL_CATEGORIES, BILL_QUICK_FILTERS } from '../constants';
import type {
  AlipayBankCard,
  AlipayBillCategoryId,
  AlipayBillQuickFilterId,
  AlipayTransferKind,
  AlipayTransferRecord,
} from '../types';
import {
  isBankPaymentMethodLabel,
  localizeBillCategoryName,
  localizeBillDetailTimeLabel,
  localizeBillTabLabel,
  localizePaymentMethodLabel,
  localizeStoredAlipayText,
} from './localizeCatalog';

export type BillTabDef = {
  filterId: AlipayBillQuickFilterId | null;
  label: string;
};

export type BillTitleContext = 'list' | 'detail';

export const BILL_TABS: BillTabDef[] = [
  { filterId: null, label: '\u5168\u90e8' },
  { filterId: 'expense', label: '\u652f\u51fa' },
  { filterId: 'transfer', label: '\u8f6c\u8d26' },
  { filterId: 'refund', label: '\u9000\u6b3e' },
  { filterId: 'order', label: '\u8ba2\u5355' },
  { filterId: 'offline', label: '\u7ebf\u4e0b\u6d88\u8d39' },
  { filterId: 'topUp', label: '\u5145\u503c\u7f34\u8d39' },
  { filterId: 'shopping', label: '\u7f51\u8d2d' },
  { filterId: 'merchantCollection', label: '\u4e8c\u7ef4\u7801\u6536\u6b3e' },
];

export function getBillTabs(isEnglish = false): BillTabDef[] {
  return BILL_TABS.map(tab => ({
    ...tab,
    label: localizeBillTabLabel(tab.filterId, tab.label, isEnglish),
  }));
}

const BILL_TAB_FILTER_IDS = new Set(
  BILL_TABS.map(t => t.filterId).filter(Boolean) as AlipayBillQuickFilterId[],
);

export function isTabFilter(id: AlipayBillQuickFilterId): boolean {
  return BILL_TAB_FILTER_IDS.has(id);
}

const BILL_DRAWER_FILTER_IDS = new Set(BILL_QUICK_FILTERS.map(f => f.id));

export function isDrawerFilter(id: AlipayBillQuickFilterId): boolean {
  return BILL_DRAWER_FILTER_IDS.has(id);
}

export type BillFilterValues = {
  quickFilter: AlipayBillQuickFilterId | null;
  category: AlipayBillCategoryId | null;
  minAmount: string;
  maxAmount: string;
};

const DEFAULT_EXPENSE_METHODS = [
  '\u82b1\u5457',
  '\u4f59\u989d',
  '\u4f59\u989d\u5b9d',
  '\u4e2d\u56fd\u5efa\u8bbe\u94f6\u884c\u50a8\u84c4\u5361(\u5c3e\u53f71024)',
  '\u4e2d\u56fd\u5de5\u5546\u94f6\u884c\u50a8\u84c4\u5361(\u5c3e\u53f72318)',
];

const DEFAULT_INCOME_METHODS = [
  '\u4f59\u989d',
  '\u4f59\u989d\u5b9d',
  '\u4e2d\u56fd\u5efa\u8bbe\u94f6\u884c\u50a8\u84c4\u5361(\u5c3e\u53f71024)',
];

const BILL_CATEGORY_MAP = new Map(BILL_CATEGORIES.map(item => [item.id, item]));

export function formatBillCounterpartyName(name: string, delta: number) {
  const text = String(name || '');
  if (Number(delta) > 0) return text.replace(/\([^)]*\)$/, '');
  return text;
}

export function getBillCategoryName(category?: AlipayBillCategoryId, isEnglish = false) {
  const fallback = category ? BILL_CATEGORY_MAP.get(category)?.name ?? '\u5176\u4ed6' : '\u5176\u4ed6';
  return localizeBillCategoryName(category ?? 'other', fallback, isEnglish);
}

export function getBillCategoryIcon(category?: AlipayBillCategoryId) {
  if (!category) return 'IcGrid';
  return BILL_CATEGORY_MAP.get(category)?.icon ?? 'IcGrid';
}

export function getBillAvatarFallback(record: AlipayTransferRecord): 'image' | 'defaultAvatar' {
  return record.counterpartyAvatar ? 'image' : 'defaultAvatar';
}

export function isRedPacketRecord(record: AlipayTransferRecord) {
  return record.kind === 'redPacket';
}

export function getRedPacketDirectionLabel(record: AlipayTransferRecord, isEnglish = false) {
  if (!isRedPacketRecord(record)) return '';
  if (record.delta >= 0) return isEnglish ? 'Received Normal Red Packet' : '收到普通红包';
  return isEnglish ? 'Sent Normal Red Packet' : '发普通红包';
}

export function getBillDisplayTitle(
  record: AlipayTransferRecord,
  isEnglish = false,
  context: BillTitleContext = 'list',
) {
  if (isRedPacketRecord(record)) {
    if (context === 'list') return getRedPacketDirectionLabel(record, isEnglish);
    if (record.delta < 0) return isEnglish ? 'Alipay Red Packet' : '支付宝红包';
  }
  const raw = record.displayTitle || formatBillCounterpartyName(record.counterpartyName, record.delta);
  return localizeStoredAlipayText(raw, isEnglish);
}

export function getBillDescription(record: AlipayTransferRecord, isEnglish = false) {
  const raw = record.description || getBillCategoryName(record.category, false);
  if (!record.description) return getBillCategoryName(record.category, isEnglish);
  return localizeStoredAlipayText(raw, isEnglish);
}

export function getBillPaymentMethod(record: AlipayTransferRecord, isEnglish = false) {
  if (!record.paymentMethod) return '';
  return localizePaymentMethodLabel(record.paymentMethod, isEnglish);
}

export function getBillDetailTimeLabel(record: AlipayTransferRecord, isEnglish = false) {
  return localizeBillDetailTimeLabel(record.detailTimeLabel || '\u652f\u4ed8\u65f6\u95f4', isEnglish);
}

export function getBillRefundStatusLabel(isEnglish = false) {
  return isEnglish ? 'Fully refunded' : '\u5df2\u5168\u989d\u9000\u6b3e';
}

function hashSeed(value: string) {
  let hash = 7;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000000007;
  }
  return Math.abs(hash) || 1;
}

function pickStableMethod(seed: string, methods: string[]) {
  const index = hashSeed(seed) % methods.length;
  return methods[index];
}

function resolvePaymentMethodLabel(
  record: AlipayTransferRecord,
  bankCards: AlipayBankCard[],
) {
  if (record.paymentMethod) return record.paymentMethod;
  if (record.methodId === 'balance') return '\u4f59\u989d';
  if (record.methodId === 'yuebao') return '\u4f59\u989d\u5b9d';
  if (record.methodId === 'huabei') return '\u82b1\u5457';
  if (record.methodId) {
    const card = bankCards.find(item => item.id === record.methodId);
    if (card) return `${card.bankName}(\u5c3e\u53f7${card.last4})`;
  }
  return record.delta >= 0
    ? pickStableMethod(`${record.id}:income`, DEFAULT_INCOME_METHODS)
    : pickStableMethod(`${record.id}:expense`, DEFAULT_EXPENSE_METHODS);
}

function inferTransferKind(record: AlipayTransferRecord): AlipayTransferKind {
  if (record.kind) return record.kind;
  const name = String(record.counterpartyName || '');
  if (/\u9000\u6b3e/.test(name)) return 'refund';
  if (/\u63d0\u73b0|\u8d26\u6237\u5b58\u53d6/.test(name)) return 'withdrawal';
  if (/\u624b\u673a\u5145\u503c|\u8bdd\u8d39|\u5145\u503c/.test(name)) return 'recharge';
  if (/\u7ea2\u5305/.test(name)) return 'redPacket';
  if (/\u8f6c\u8d26/.test(name)) return 'transfer';
  if (/\u5de5\u8d44|\u5e74\u7ec8\u5956|\u85aa\u8d44|\u5956\u91d1|\u6536\u76ca/.test(name)) return 'salary';
  if (/\u7f34\u8d39|\u6c34\u8d39|\u7535\u8d39|\u71c3\u6c14\u8d39/.test(name)) return 'utility';
  return 'payment';
}

export function inferBillCategory(record: AlipayTransferRecord): AlipayBillCategoryId {
  if (record.category) return record.category;
  const name = String(record.counterpartyName || '');
  const kind = inferTransferKind(record);

  if (kind === 'transfer' || kind === 'redPacket' || /\u8f6c\u8d26|\u7ea2\u5305/.test(name)) return 'transferRedPacket';
  if (kind === 'withdrawal' || /\u63d0\u73b0|\u8d26\u6237\u5b58\u53d6/.test(name)) return 'accountDepositWithdraw';
  if (/\u5de5\u8d44|\u5e74\u7ec8\u5956|\u85aa\u8d44|\u5956\u91d1/.test(name)) return 'income';
  if (/\u4f59\u989d\u5b9d|\u7406\u8d22|\u57fa\u91d1|\u6536\u76ca/.test(name)) return 'investment';
  if (/\u4fdd\u9669|\u4fdd\u969c/.test(name)) return 'insurance';
  if (/\u82b1\u5457|\u4fe1\u7528\u5361|\u8fd8\u6b3e/.test(name)) return 'creditRepayment';
  if (/\u751f\u6d3b\u7f34\u8d39|\u6c34\u8d39|\u7535\u8d39|\u71c3\u6c14\u8d39/.test(name)) return 'publicService';
  if (/\u8bdd\u8d39|\u624b\u673a\u5145\u503c|\u5145\u503c\u7f34\u8d39/.test(name)) return 'topUp';
  if (/\u6ef4\u6ef4|\u516c\u4ea4|\u5730\u94c1|\u6253\u8f66|\u51fa\u884c/.test(name)) return 'transport';
  if (/\u706b\u8f66\u7968|\u9ad8\u94c1|\u673a\u7968|\u52a8\u8f66|\u9152\u5e97|\u65c5\u6e38/.test(name)) return 'travel';
  if (/\u7f8e\u56e2|\u997f\u4e86\u4e48|\u5916\u5356|\u5348\u9910|\u706b\u9505|\u65e9\u9910|\u5976\u8336|\u5496\u5561/.test(name)) return 'dining';
  if (/\u6dd8\u5b9d|\u4eac\u4e1c|\u767e\u8d27|\u65e5\u7528\u54c1|\u8d2d\u7269/.test(name)) return 'department';
  if (/\u6570\u7801|\u7535\u5668|\u7535\u8111|\u624b\u673a|API/.test(name)) return 'digital';
  if (/\u670d\u9970|\u978b|\u8863/.test(name)) return 'apparel';
  if (/\u6bcd\u5a74|\u4eb2\u5b50/.test(name)) return 'parentChild';
  if (/\u5ba0\u7269/.test(name)) return 'pets';
  if (/\u6559\u80b2|\u57f9\u8bad|\u8bfe\u7a0b/.test(name)) return 'education';
  if (/\u533b\u7597|\u5065\u5eb7|\u836f/.test(name)) return 'medical';
  if (/\u7269\u4e1a|\u623f\u79df|\u4f4f\u623f/.test(name)) return 'housing';
  if (/\u516c\u76ca|\u6350\u8d60/.test(name)) return 'charity';
  if (/\u4ee3\u4ed8/.test(name)) return 'friendPayment';
  if (/\u4f1a\u5458|\u8ba2\u9605/.test(name)) return 'businessService';
  if (kind === 'refund') return 'refund';
  if (record.delta > 0) return 'income';
  return 'other';
}

function buildDisplayTitle(record: AlipayTransferRecord) {
  if (record.displayTitle) return record.displayTitle;
  const name = String(record.counterpartyName || '');
  if (/\u7f8e\u56e2/.test(name)) return '\u7f8e\u56e2';
  if (/\u997f\u4e86\u4e48/.test(name)) return '\u997f\u4e86\u4e48';
  if (/\u6ef4\u6ef4/.test(name)) return '\u6ef4\u6ef4\u51fa\u884c';
  if (/\u6dd8\u5b9d|\u5929\u732b/.test(name)) return '\u6dd8\u5b9d';
  if (/\u4eac\u4e1c/.test(name)) return '\u4eac\u4e1c';
  if (/\u643a\u7a0b/.test(name)) return '\u643a\u7a0b\u65c5\u884c\u7f51';
  if (/\u706b\u8f66\u7968|\u9ad8\u94c1|\u52a8\u8f66/.test(name)) return '\u706b\u8f66\u7968';
  if (/\u673a\u7968/.test(name)) return '\u673a\u7968';
  if (/\u4f59\u989d\u63d0\u73b0/.test(name)) return '\u4f59\u989d\u63d0\u73b0';
  if (/\u4f59\u989d\u5b9d.*\u6536\u76ca/.test(name)) return '\u4f59\u989d\u5b9d\u6536\u76ca';
  if (/\u8bdd\u8d39/.test(name)) return '\u8bdd\u8d39\u5145\u503c';
  return formatBillCounterpartyName(name, record.delta);
}

function buildDescription(record: AlipayTransferRecord, category: AlipayBillCategoryId) {
  if (record.description) return record.description;
  return getBillCategoryName(category, false);
}

function buildDetailTimeLabel(record: AlipayTransferRecord, kind: AlipayTransferKind) {
  if (record.detailTimeLabel) return record.detailTimeLabel;
  if (kind === 'transfer' || kind === 'withdrawal' || kind === 'recharge') return '\u521b\u5efa\u65f6\u95f4' as const;
  return '\u652f\u4ed8\u65f6\u95f4' as const;
}

function matchesOrderQuickFilter(
  record: AlipayTransferRecord,
  kind: AlipayTransferKind,
  category: AlipayBillCategoryId,
) {
  if (record.merchantOrderId) return true;
  if (!record.orderId) return false;
  if (kind === 'transfer' || kind === 'redPacket' || kind === 'salary' || kind === 'withdrawal' || kind === 'refund') {
    return false;
  }
  if (category === 'transferRedPacket' || category === 'income' || category === 'investment' || category === 'accountDepositWithdraw' || category === 'refund') {
    return false;
  }
  return true;
}

export function enrichTransferRecord(
  record: AlipayTransferRecord,
  bankCards: AlipayBankCard[] = [],
): AlipayTransferRecord {
  const kind = inferTransferKind(record);
  const category = inferBillCategory(record);
  return {
    ...record,
    displayTitle: buildDisplayTitle(record),
    kind,
    category,
    description: buildDescription(record, category),
    detailTimeLabel: buildDetailTimeLabel(record, kind),
    paymentMethod: resolvePaymentMethodLabel(record, bankCards),
    includeInBudget: record.includeInBudget ?? true,
  };
}

export function matchesBillQuickFilter(
  record: AlipayTransferRecord,
  quickFilter: AlipayBillQuickFilterId,
) {
  const name = String(record.counterpartyName || '');
  const kind = inferTransferKind(record);
  const category = inferBillCategory(record);

  switch (quickFilter) {
    case 'expense':
      return record.delta < 0;
    case 'shopping':
      return ['apparel', 'department', 'digital'].includes(category);
    case 'offline':
      return ['dining', 'transport', 'auto', 'lifeService'].includes(category);
    case 'wealth':
      return ['investment', 'insurance', 'mutualAid'].includes(category);
    case 'transfer':
      return kind === 'transfer';
    case 'withdrawal':
      return kind === 'withdrawal' || /\u63d0\u73b0/.test(name);
    case 'redPacket':
      return kind === 'redPacket';
    case 'repayment':
      return category === 'creditRepayment' || /\u8fd8\u6b3e/.test(name);
    case 'utility':
      return category === 'publicService' || /\u7f34\u8d39|\u6c34\u8d39|\u7535\u8d39|\u71c3\u6c14\u8d39/.test(name);
    case 'phoneRecharge':
      return category === 'topUp' || /\u8bdd\u8d39|\u5145\u503c/.test(name);
    case 'merchantCollection':
      return /\u6536\u6b3e|\u4e8c\u7ef4\u7801/.test(name);
    case 'freeze':
      return /\u51bb\u7ed3|\u89e3\u51bb/.test(name);
    case 'order':
      return matchesOrderQuickFilter(record, kind, category);
    case 'refund':
      return kind === 'refund';
    case 'topUp':
      return category === 'topUp' || category === 'publicService';
    default:
      return false;
  }
}

export function recordMatchesBillFilters(
  record: AlipayTransferRecord,
  options: {
    query?: string;
    minAmount?: string;
    maxAmount?: string;
    quickFilter?: AlipayBillQuickFilterId | null;
    category?: AlipayBillCategoryId | null;
  },
) {
  const {
    query = '',
    minAmount = '',
    maxAmount = '',
    quickFilter = null,
    category: filterCategory = null,
  } = options;
  const category = inferBillCategory(record);
  const amount = Math.abs(Number(record.delta) || 0);

  if (quickFilter && !matchesBillQuickFilter(record, quickFilter)) return false;
  if (filterCategory) {
    if (filterCategory === 'refund') {
      if (inferTransferKind(record) !== 'refund') return false;
    } else if (category !== filterCategory) {
      return false;
    }
  }

  const minValue = Number(minAmount);
  if (minAmount && Number.isFinite(minValue) && amount < minValue) return false;

  const maxValue = Number(maxAmount);
  if (maxAmount && Number.isFinite(maxValue) && amount > maxValue) return false;

  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  const haystack = [
    record.displayTitle,
    record.counterpartyName,
    record.description,
    record.transferNote,
    record.targetAccount,
    record.rechargeDescription,
    record.productDescription,
    record.phoneNumber,
    record.transactionTarget,
    record.acquiringInstitution,
    record.clearingInstitution,
    record.payeeFullName,
    record.serviceDetail,
    record.transactionDetail,
    record.orderId,
    record.merchantOrderId,
    record.paymentMethod,
    getBillDisplayTitle(record, true),
    getBillDescription(record, true),
    getBillCategoryName(category, true),
    localizePaymentMethodLabel(record.paymentMethod || '', true),
    localizeStoredAlipayText(record.counterpartyName || '', true),
    localizeStoredAlipayText(record.transferNote || '', true),
    localizeStoredAlipayText(record.rechargeDescription || '', true),
    localizeStoredAlipayText(record.productDescription || '', true),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(keyword);
}

export function isBankPaymentMethod(record: AlipayTransferRecord) {
  return isBankPaymentMethodLabel(record.paymentMethod || '');
}

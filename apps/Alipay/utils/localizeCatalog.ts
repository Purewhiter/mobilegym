import type { AlipayBillCategoryId, AlipayBillQuickFilterId } from '../types';
import { localizeBankName } from './localizeBankName';

const SERVICE_NAME_EN_BY_ID: Record<string, string> = {
  scan: 'Scan',
  pay: 'Pay/Receive',
  travel: 'Travel',
  card: 'Cards',
  antInsure: 'Ant Insurance',
  lifePay: 'Utility Bills',
  train: 'Train & Flights',
  didi: 'Taxi',
  movie: 'Movies',
  transfer: 'Transfer',
  creditCard: 'My Credit Cards',
  phone: 'Mobile Service',
  miniPrograms: 'Mini Programs',
  more: 'More',
  jinling: 'Jinling e-ID',
  huabei: 'Huabei',
  meituan: 'Meituan Ride',
  haidilao: 'Haidilao',
  duodian: 'Dmall',
  bill: 'Bills',
  assets: 'Total Assets',
  balance: 'Balance',
  yuebao: "Yu'e Bao",
  sesame: 'Zhima Credit',
  bankCard: 'Bank Cards',
  yulibao: 'Yu Li Bao',
  loan: 'MYbank Loan',
  mybank: 'MYbank',
  medical: 'Medical Insurance',
  social: 'Social Security',
  housing: 'Housing Fund',
  job: 'Employment',
};

const SERVICE_NAME_EN_BY_TEXT: Record<string, string> = {
  '\u4f59\u989d\u5b9d': "Yu'e Bao",
  '\u7a33\u5065\u7406\u8d22': 'Stable Wealth',
  '\u6307\u6570+': 'Index+',
  '\u57fa\u91d1': 'Funds',
  '\u9ec4\u91d1': 'Gold',
  '\u80a1\u7968': 'Stocks',
  '\u5b9a\u671f': 'Fixed Income',
  '\u4fdd\u9669': 'Insurance',
  '\u5e2e\u4f60\u6295': 'Managed Investment',
  '\u9ad8\u7aef\u7406\u8d22': 'Premium Wealth',
  '\u8682\u8681\u4fdd': 'Ant Insurance',
  '\u751f\u6d3b\u7f34\u8d39': 'Utility Bills',
  '\u706b\u8f66\u7968\u673a\u7968': 'Train & Flights',
  '\u9ad8\u5fb7\u6253\u8f66': 'Amap Taxi',
  '\u6dd8\u7968\u7968': 'Taopiaopiao',
  '\u6211\u7684\u4fe1\u7528\u5361': 'My Credit Cards',
  '\u624b\u673a\u8425\u4e1a\u5385': 'Mobile Service',
  '\u6211\u7684\u5c0f\u7a0b\u5e8f': 'Mini Programs',
  '\u66f4\u591a': 'More',
  '\u91d1\u9675\u7f51\u8bc1': 'Jinling e-ID',
  '\u82b1\u5457': 'Huabei',
  '\u7f8e\u56e2\u9a91\u884c': 'Meituan Ride',
  '\u6d77\u5e95\u635e\u706b\u9505': 'Haidilao',
  '\u591a\u70b9': 'Dmall',
  '\u8d26\u5355': 'Bills',
  '\u603b\u8d44\u4ea7': 'Total Assets',
  '\u829d\u9ebb\u4fe1\u7528': 'Zhima Credit',
  '\u4f59\u5229\u5b9d': 'Yu Li Bao',
  '\u7f51\u5546\u8d37': 'MYbank Loan',
  '\u7f51\u5546\u94f6\u884c': 'MYbank',
  '\u533b\u4fdd': 'Medical Insurance',
  '\u793e\u4fdd': 'Social Security',
  '\u4f4f\u623f\u516c\u79ef\u91d1': 'Housing Fund',
  '\u5c31\u4e1a': 'Employment',
};

const SERVICE_EXTRA_EN_BY_TEXT: Record<string, string> = {
  '\u67e5\u770b\u8d26\u6237\u4f59\u989d': 'View account balance',
  '\u4f59\u989d\u5b9d\u6536\u76ca\u5230\u8d26\u5566': "Yu'e Bao earnings received",
  '\u82b1\u5457\u8fd8\u6b3e\u51cf\u8d1f\u62c5': 'Huabei repayment support',
  '\u53ef\u770b\u94f6\u884c\u5361\u53f7': 'View card number',
};

const BILL_QUICK_FILTER_EN: Record<AlipayBillQuickFilterId, string> = {
  expense: 'Expenses',
  shopping: 'Online Shopping',
  offline: 'In-store',
  wealth: 'Wealth',
  transfer: 'Transfer',
  withdrawal: 'Withdrawal',
  redPacket: 'Red Packets',
  repayment: 'Repayment',
  utility: 'Bills',
  phoneRecharge: 'Mobile Top-up',
  merchantCollection: 'QR Collection',
  freeze: 'Freeze/Unfreeze',
  order: 'Orders',
  refund: 'Refunds',
  topUp: 'Top-up',
};

const BILL_CATEGORY_EN: Record<AlipayBillCategoryId, string> = {
  dining: 'Dining',
  apparel: 'Apparel',
  department: 'General Merchandise',
  home: 'Home',
  digital: 'Electronics',
  sports: 'Sports',
  beauty: 'Beauty',
  parentChild: 'Parent & Child',
  pets: 'Pets',
  transport: 'Transport',
  auto: 'Car Services',
  housing: 'Housing',
  travel: 'Travel',
  leisure: 'Leisure',
  education: 'Education',
  medical: 'Healthcare',
  lifeService: 'Life Services',
  publicService: 'Public Services',
  businessService: 'Business Services',
  charity: 'Charity',
  mutualAid: 'Mutual Aid',
  investment: 'Investment',
  insurance: 'Insurance',
  creditRepayment: 'Credit & Repayment',
  topUp: 'Top-up & Bills',
  income: 'Income',
  transferRedPacket: 'Transfer & Red Packet',
  friendPayment: 'Pay for Friends',
  accountDepositWithdraw: 'Account Deposits/Withdrawals',
  refund: 'Refund',
  other: 'Other',
};

const BANK_PROMO_EN: Record<string, string> = {
  '\u4fe1\u7528\u5361\u5f9710\u5143\u7ea2\u5305': 'Get a \u00a510 credit card bonus',
  '\u4fe1\u7528\u5361\u5f9715\u5143\u7ea2\u5305': 'Get a \u00a515 credit card bonus',
  '\u4fe1\u7528\u5361\u5f978\u5143\u7ea2\u5305': 'Get a \u00a58 credit card bonus',
};

const MARKET_INDEX_EN: Record<string, string> = {
  '\u9053\u743c\u65af': 'Dow Jones',
  '\u7eb3\u65af\u8fbe\u514b': 'Nasdaq',
  '\u6807\u666e500': 'S&P 500',
};

const STORED_TEXT_EN: Record<string, string> = {
  '\u4f59\u989d\u5145\u503c': 'Balance Top-up',
  '\u591a\u5361\u5145\u503c': 'Multi-card Top-up',
  '\u666e\u901a\u5145\u503c': 'Standard Top-up',
  '\u5145\u503c': 'Top-up',
  '\u8f6c\u8d26': 'Transfer',
  '\u9000\u6b3e': 'Refund',
  '\u4f59\u989d\u63d0\u73b0': 'Balance Withdrawal',
  '\u4f59\u989d\u5b9d\u6536\u76ca': "Yu'e Bao Earnings",
  '\u8bdd\u8d39\u5145\u503c': 'Mobile Top-up',
  '\u7f8e\u56e2': 'Meituan',
  '\u997f\u4e86\u4e48': 'Ele.me',
  '\u6ef4\u6ef4\u51fa\u884c': 'Didi',
  '\u6dd8\u5b9d': 'Taobao',
  '\u5929\u732b': 'Tmall',
  '\u4eac\u4e1c': 'JD.com',
  '\u643a\u7a0b\u65c5\u884c\u7f51': 'Ctrip',
  '\u706b\u8f66\u7968': 'Train Tickets',
  '\u673a\u7968': 'Flights',
  '\u751f\u6d3b\u7f34\u8d39': 'Utility Bills',
  '\u7ebf\u4e0b\u6d88\u8d39': 'In-store Spending',
  '\u7406\u8d22': 'Wealth',
  '\u7ea2\u5305': 'Red Packet',
  '\u7f34\u8d39': 'Bills',
  '\u4e8c\u7ef4\u7801\u6536\u6b3e': 'QR Collection',
  '\u51bb\u7ed3/\u89e3\u51bb': 'Freeze/Unfreeze',
  '\u8ba2\u5355': 'Order',
  '\u5df2\u5168\u989d\u9000\u6b3e': 'Fully refunded',
  '\u521b\u5efa\u65f6\u95f4': 'Created time',
  '\u652f\u4ed8\u65f6\u95f4': 'Payment time',
};

const STORED_SUBSTRING_EN: Array<[string, string]> = [
  ['\u8f6c\u8d26-', 'Transfer - '],
  ['\u4f59\u989d\u5b9d\u6536\u76ca', "Yu'e Bao Earnings"],
  ['\u8bdd\u8d39\u5145\u503c', 'Mobile Top-up'],
  ['\u751f\u6d3b\u7f34\u8d39', 'Utility Bills'],
  ['\u7f8e\u56e2', 'Meituan'],
  ['\u997f\u4e86\u4e48', 'Ele.me'],
  ['\u6ef4\u6ef4', 'Didi'],
  ['\u6dd8\u5b9d', 'Taobao'],
  ['\u5929\u732b', 'Tmall'],
  ['\u4eac\u4e1c', 'JD.com'],
  ['\u643a\u7a0b', 'Ctrip'],
];

const PAYMENT_METHOD_EN: Record<string, string> = {
  '\u4f59\u989d': 'Balance',
  '\u8d26\u6237\u4f59\u989d': 'Balance',
  '\u4f59\u989d\u5b9d': "Yu'e Bao",
  '\u82b1\u5457': 'Huabei',
};

function isMostlyAscii(value: string): boolean {
  return /^[\x00-\x7F\s]*$/.test(value);
}

function trimText(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

export function localizeServiceName(id: string, fallback: string, isEnglish: boolean): string {
  const raw = trimText(fallback);
  if (!isEnglish || !raw) return raw;
  return SERVICE_NAME_EN_BY_ID[id] ?? SERVICE_NAME_EN_BY_TEXT[raw] ?? raw;
}

export function localizeServiceExtra(extra: string, isEnglish: boolean): string {
  const raw = trimText(extra);
  if (!isEnglish || !raw) return raw;
  return SERVICE_EXTRA_EN_BY_TEXT[raw] ?? localizeStoredAlipayText(raw, true);
}

export function localizeBillQuickFilterLabel(
  id: AlipayBillQuickFilterId,
  fallback: string,
  isEnglish: boolean,
): string {
  if (!isEnglish) return fallback;
  return BILL_QUICK_FILTER_EN[id] ?? fallback;
}

export function localizeBillCategoryName(
  id: AlipayBillCategoryId,
  fallback: string,
  isEnglish: boolean,
): string {
  if (!isEnglish) return fallback;
  return BILL_CATEGORY_EN[id] ?? fallback;
}

export function localizeBillTabLabel(
  filterId: AlipayBillQuickFilterId | null,
  fallback: string,
  isEnglish: boolean,
): string {
  if (!isEnglish) return fallback;
  if (filterId === null) return 'All';
  return localizeBillQuickFilterLabel(filterId, fallback, true);
}

export function localizeBankPromo(promo: string | undefined, isEnglish: boolean): string {
  const raw = trimText(promo);
  if (!isEnglish || !raw) return raw;
  return BANK_PROMO_EN[raw] ?? raw;
}

export function localizeMarketIndexName(name: string, isEnglish: boolean): string {
  const raw = trimText(name);
  if (!isEnglish || !raw) return raw;
  return MARKET_INDEX_EN[raw] ?? raw;
}

export function localizeStoredAlipayText(text: string, isEnglish: boolean): string {
  const raw = trimText(text);
  if (!isEnglish || !raw || isMostlyAscii(raw)) return raw;
  if (STORED_TEXT_EN[raw]) return STORED_TEXT_EN[raw];

  let result = raw;
  for (const [source, target] of STORED_SUBSTRING_EN) {
    result = result.split(source).join(target);
  }
  return result;
}

export function localizeBillDetailTimeLabel(label: string, isEnglish: boolean): string {
  const raw = trimText(label);
  if (!isEnglish || !raw) return raw;
  return STORED_TEXT_EN[raw] ?? raw;
}

export function localizePaymentMethodLabel(label: string, isEnglish: boolean): string {
  const raw = trimText(label);
  if (!isEnglish || !raw || isMostlyAscii(raw)) return raw;
  if (PAYMENT_METHOD_EN[raw]) return PAYMENT_METHOD_EN[raw];

  const bankTailMatch = raw.match(/^(.*?)(?:\(|\uff08)?(?:\u5c3e\u53f7)?(\d{4})(?:\)|\uff09)?$/);
  if (bankTailMatch) {
    const bankName = trimText(bankTailMatch[1]);
    const localizedBank = localizeBankName(bankName, true);
    if (localizedBank && localizedBank !== bankName) {
      return `${localizedBank} (${bankTailMatch[2]})`;
    }
  }

  return localizeStoredAlipayText(localizeBankName(raw, true), true);
}

export function isBankPaymentMethodLabel(label: string): boolean {
  const raw = trimText(label);
  if (!raw) return false;
  if (/\d{4}/.test(raw)) return true;
  if (raw.includes('\u94f6\u884c')) return true;

  const localized = localizeBankName(raw, true);
  return localized !== raw && !['Balance', "Yu'e Bao", 'Huabei', 'Bank Card'].includes(localized);
}

export function splitBankPaymentMethod(
  label: string,
  isEnglish: boolean,
): { bankName: string; last4: string } {
  const localized = localizePaymentMethodLabel(label, isEnglish);
  const last4 = localized.match(/(\d{4})/)?.[1] ?? '';
  const bankName = localized
    .replace(/\s*\((?:ending in )?\d{4}\)\s*$/, '')
    .replace(/\s+\d{4}\s*$/, '')
    .trim();

  return {
    bankName: bankName || (isEnglish ? 'Bank Card' : '\u94f6\u884c\u5361'),
    last4,
  };
}

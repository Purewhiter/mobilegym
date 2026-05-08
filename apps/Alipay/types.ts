export type AlipayTheme = {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  textSecondary: string;
};

export type AlipayUserInfo = {
  name: string;
  phone: string;
  avatar: string;
  paymentPassword: string;
};

export type AlipayBalance = {
  total: number;
  dailyIncome: number;
};

export type AlipayBillCategoryId =
  | 'dining'
  | 'apparel'
  | 'department'
  | 'home'
  | 'digital'
  | 'sports'
  | 'beauty'
  | 'parentChild'
  | 'pets'
  | 'transport'
  | 'auto'
  | 'housing'
  | 'travel'
  | 'leisure'
  | 'education'
  | 'medical'
  | 'lifeService'
  | 'publicService'
  | 'businessService'
  | 'charity'
  | 'mutualAid'
  | 'investment'
  | 'insurance'
  | 'creditRepayment'
  | 'topUp'
  | 'income'
  | 'transferRedPacket'
  | 'friendPayment'
  | 'accountDepositWithdraw'
  | 'refund'
  | 'other';

export type AlipayBillQuickFilterId =
  | 'expense'
  | 'shopping'
  | 'offline'
  | 'wealth'
  | 'transfer'
  | 'withdrawal'
  | 'redPacket'
  | 'repayment'
  | 'utility'
  | 'phoneRecharge'
  | 'merchantCollection'
  | 'freeze'
  | 'order'
  | 'refund'
  | 'topUp';

export type AlipayTransferKind =
  | 'transfer'
  | 'payment'
  | 'refund'
  | 'recharge'
  | 'withdrawal'
  | 'redPacket'
  | 'salary'
  | 'utility';

/**
 * 支付宝账单统一字段池：
 *
 * 1. 所有账单都使用同一个 record 结构，某个字段不适用时直接不写
 * 2. 列表展示优先使用 `displayTitle`，没有时再回退到 `counterpartyName`
 * 3. 详情页只渲染有值的字段，因此新增数据时通常只需要补数据，不需要改页面
 *
 * 常见类型建议填法：
 *
 * - 转账：
 *   `detailTimeLabel='创建时间'` `paymentMethod` `transferNote` `targetAccount`
 *   `rewardPoints` `orderId`
 *
 * - 余额充值：
 *   `detailTimeLabel='创建时间'` `paymentMethod` `rechargeDescription`
 *   `orderId`
 *
 * - 多卡充值：
 *   `detailTimeLabel='创建时间'` `paymentMethod` `productDescription`
 *   `merchantOrderId`
 *
 * - 话费充值：
 *   `detailTimeLabel='支付时间'` `paymentMethod` `productDescription`
 *   `phoneNumber` `transactionTarget` `rewardPoints` `acquiringInstitution`
 *   `transactionDetail` `orderId` `merchantOrderId`
 *
 * - 餐饮/智能货柜消费：
 *   `detailTimeLabel='支付时间'` `paymentMethod` `productDescription`
 *   `rewardPoints` `payeeFullName` `serviceDetail`
 *   `orderId` `merchantOrderId`
 *
 * - 超市订单：
 *   `detailTimeLabel='支付时间'` `paymentMethod` `productDescription`
 *   `rewardPoints` `acquiringInstitution` `clearingInstitution`
 *   `payeeFullName` `orderId` `merchantOrderId`
 *
 * - 给个人商家转账：
 *   `detailTimeLabel='创建时间'` `productDescription` `acquiringInstitution`
 *   `payeeFullName` `orderId` `merchantOrderId`
 *
 * - 虚拟充值（如起点币）：
 *   `detailTimeLabel='支付时间'` `paymentMethod` `productDescription`
 *   `rewardPoints` `payeeFullName` `orderId` `merchantOrderId`
 *
 * - 12306 车票：
 *   `detailTimeLabel='支付时间'` `paymentMethod` `payeeFullName`
 *   `transactionDetail` `orderId` `merchantOrderId`
 *
 * - 闲鱼订单：
 *   `detailTimeLabel='支付时间'` `paymentMethod` `productDescription`
 *   `orderId` `merchantOrderId`
 */
export type AlipayTransferRecord = {
  id: string;
  counterpartyName: string;
  counterpartyAvatar: string;
  delta: number;
  timestamp: number;
  displayTitle?: string;
  description?: string;
  note?: string;
  methodId?: string;
  orderId?: string;
  subject?: string;
  kind?: AlipayTransferKind;
  category?: AlipayBillCategoryId;
  detailTimeLabel?: '创建时间' | '支付时间';
  paymentMethod?: string;
  transferNote?: string;
  targetAccount?: string;
  rechargeDescription?: string;
  productDescription?: string;
  phoneNumber?: string;
  transactionTarget?: string;
  acquiringInstitution?: string;
  clearingInstitution?: string;
  payeeFullName?: string;
  serviceDetail?: string;
  transactionDetail?: string;
  merchantOrderId?: string;
  rewardPoints?: number;
  includeInBudget?: boolean;
};

export type AlipayBankCard = {
  id: string;
  bankName: string;
  last4: string;
  bound: boolean;
  available: number;
};

export type AlipaySubscription = {
  id: string;
  membershipType: string;
  price: number;
  billingCycle: string;
  autoRenew: boolean;
  createdAt: number;
};

export type AlipayRechargeCard = {
  id: string;
  code: string;
  value: number;
  redeemed: boolean;
  redeemedAt?: number;
};

// ── Chat / Messaging ──────────────────────────────────────────────

export type PersonConversation = {
  id: string;
  kind: 'person';
  contactId: string;
  name: string;
  avatar?: string;
  lastContent: string;
  lastTimestamp: number;
  lastReadAt: number;
  isMuted?: boolean;
  isSticky?: boolean;
};

export type ServiceConversation = {
  id: string;
  kind: 'service' | 'box' | 'birthday';
  name: string;
  avatar?: string;
  lastContent: string;
  lastTimestamp: number;
  lastReadAt: number;
  isMuted?: boolean;
  isSticky?: boolean;
};

export type ConversationItem = PersonConversation | ServiceConversation;

export type ChatMessage = {
  id: string;
  senderId: string;          // 'self' | contactId | 'system'
  type: 'text' | 'transfer' | 'image' | 'system' | 'time';
  content: string;
  timestamp: number;
};

export type NotificationCard = {
  id: string;
  title: string;
  content: string;
  icon: string;
  timestamp: number;
  read: boolean;
};

import { createAppStoreWithActions } from '../../os/createAppStore';
import { ALIPAY_CONFIG } from './data';
import * as TimeService from '../../os/TimeService';
import type {
  AlipayBankCard,
  AlipaySubscription,
  AlipayRechargeCard,
  ConversationItem,
  ChatMessage,
  NotificationCard,
  AlipayBillCategoryId,
  AlipayTransferKind,
  AlipayTransferRecord,
} from './types';
import { enrichTransferRecord } from './utils/bills';

// ── Types ──────────────────────────────────────────────────────────

type DarkMode = 'light' | 'dark';

type NotificationToggleKey =
  | 'tradeSecurity'
  | 'service'
  | 'activity'
  | 'avCall'
  | 'avCallPopup'
  | 'friendReminder'
  | 'friendDetail'
  | 'sound'
  | 'vibration'
  | 'avCallRing';

type NotificationSettings = Record<NotificationToggleKey, boolean>;

type PayOrderMode = 'system' | 'custom';

type MyManageToggleKey =
  | 'documents'
  | 'yuebao'
  | 'huabei'
  | 'antInsure'
  | 'sesame'
  | 'yulibao'
  | 'mybankLoan'
  | 'mybank'
  | 'civic'
  | 'orders'
  | 'moreServices';

type MyManageSettings = Record<MyManageToggleKey, boolean>;

export interface AlipayPaymentSettings {
  payOrder: { mode: PayOrderMode; customOrderIds: string[] };
  fastPay: { enabled: boolean; noPwdEnabled: boolean; easterEggEnabled: boolean };
}

export interface AlipayGeneralSettings {
  refreshSoundEnabled: boolean;
  fontSizeLevel: number; // 0..4
  darkMode: { followSystem: boolean; mode: DarkMode };
  speedModeEnabled: boolean;
  clipboardAllowRead: boolean;
  homeManage: {
    searchBoxRecommendEnabled: boolean;
    searchBoxAmbienceEnabled: boolean;
    searchPreEnabled: boolean;
    voiceFloatEnabled: boolean;
    activityAmbienceEnabled: boolean;
    appDynamicEnabled: boolean;
    featureColumnEnabled: boolean;
    smartSceneEnabled: boolean;
  };
  myManage: MyManageSettings;
}

export interface AlipaySettings {
  visualRefreshEnabled: boolean;
  payment: AlipayPaymentSettings;
  notifications: NotificationSettings;
  general: AlipayGeneralSettings;
}

const defaultSettings = ALIPAY_CONFIG.settings as AlipaySettings;

// ── Derived unread helper ───────────────────────────────────────────

export function computeUnread(conv: ConversationItem, chatHistory: Record<string, ChatMessage[]>): number {
  const msgs = chatHistory[conv.id] || [];
  return msgs.filter(m => m.senderId !== 'self' && m.timestamp > conv.lastReadAt).length;
}

// ── State interface ─────────────────────────────────────────────────

export interface AlipayStoreState {
  userInfo: typeof ALIPAY_CONFIG.userInfo;
  language: typeof ALIPAY_CONFIG.language | null;
  balance: typeof ALIPAY_CONFIG.balance;
  transferRecords: typeof ALIPAY_CONFIG.transferRecords;
  notifications: NotificationCard[];
  quickActions: typeof ALIPAY_CONFIG.quickActions;
  mainServices: typeof ALIPAY_CONFIG.mainServices;
  commonServices: typeof ALIPAY_CONFIG.commonServices;
  flashSale: typeof ALIPAY_CONFIG.flashSale;
  financeServices: typeof ALIPAY_CONFIG.financeServices;
  myServicesList: typeof ALIPAY_CONFIG.myServicesList;
  myServicesGrid: typeof ALIPAY_CONFIG.myServicesGrid;
  myCivicServices: typeof ALIPAY_CONFIG.myCivicServices;
  conversations: ConversationItem[];
  chatHistory: Record<string, ChatMessage[]>;
  contacts: typeof ALIPAY_CONFIG.contacts;
  settings: AlipaySettings;
  // Payment extensions
  bankCards: AlipayBankCard[];
  subscriptions: AlipaySubscription[];
  lastPaymentHint: string | null;
  rechargeCards: AlipayRechargeCard[];
  billSearchHistory: string[];
  // Ephemeral (excluded from persistence)
  transferDraft: { contact?: any; inputValue?: string } | null;
  transferReceipt: { amount: string; contact?: any; paymentMethod?: string } | null;
}

// ── Actions interface ───────────────────────────────────────────────

export interface AlipayActions {
  setLanguage: (lang: typeof ALIPAY_CONFIG.language | null) => void;
  deductBalance: (amount: number) => void;
  recordTransfer: (params: {
    counterpartyName: string;
    counterpartyAvatar?: string;
    delta: number;
    timestamp?: number;
    note?: string;
    methodId?: string;
    orderId?: string;
    subject?: string;
    description?: string;
    kind?: AlipayTransferKind;
    category?: AlipayBillCategoryId;
    displayTitle?: string;
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
  }) => void;
  updateTransferRecord: (id: string, patch: Partial<Pick<AlipayTransferRecord, 'note' | 'category' | 'includeInBudget'>>) => void;
  setSettings: (updater: AlipaySettings | ((prev: AlipaySettings) => AlipaySettings)) => void;
  setTransferDraft: (draft: { contact?: any; inputValue?: string } | null) => void;
  setTransferReceipt: (receipt: { amount: string; contact?: any; paymentMethod?: string } | null) => void;
  setLastPaymentHint: (hint: string | null) => void;
  // Payment extensions
  bindBankCard: (card: Omit<AlipayBankCard, 'bound'>) => void;
  unbindBankCard: (cardId: string) => void;
  addBankCard: (params: { bankName: string; cardNumber?: string; available?: number; bound?: boolean }) => AlipayBankCard;
  upsertSubscription: (sub: AlipaySubscription) => void;
  redeemRechargeCard: (code: string) => { ok: boolean; value?: number; reason?: string };
  setPaymentPassword: (oldPwd: string | null, newPwd: string) => { ok: boolean; reason?: string };
  sendChatMessage: (conversationId: string, text: string) => void;
  markConversationRead: (conversationId: string) => void;
  markAllConversationsRead: () => void;
  addBillSearchHistory: (keyword: string) => void;
  clearBillSearchHistory: () => void;
}

// ── Initial state ───────────────────────────────────────────────────

const initialState: AlipayStoreState = {
  userInfo: ALIPAY_CONFIG.userInfo,
  language: ALIPAY_CONFIG.language,
  balance: ALIPAY_CONFIG.balance,
  transferRecords: ALIPAY_CONFIG.transferRecords,
  notifications: ALIPAY_CONFIG.notifications as NotificationCard[],
  quickActions: ALIPAY_CONFIG.quickActions,
  mainServices: ALIPAY_CONFIG.mainServices,
  commonServices: ALIPAY_CONFIG.commonServices,
  flashSale: ALIPAY_CONFIG.flashSale,
  financeServices: ALIPAY_CONFIG.financeServices,
  myServicesList: ALIPAY_CONFIG.myServicesList,
  myServicesGrid: ALIPAY_CONFIG.myServicesGrid,
  myCivicServices: ALIPAY_CONFIG.myCivicServices,
  conversations: ALIPAY_CONFIG.conversations as ConversationItem[],
  chatHistory: ALIPAY_CONFIG.chatHistory as Record<string, ChatMessage[]>,
  contacts: ALIPAY_CONFIG.contacts,
  settings: defaultSettings,
  // Payment extensions
  bankCards: ALIPAY_CONFIG.bankCards as AlipayBankCard[],
  subscriptions: [],
  lastPaymentHint: null,
  rechargeCards: ALIPAY_CONFIG.rechargeCards as AlipayRechargeCard[],
  billSearchHistory: [],
  transferDraft: null,
  transferReceipt: null,
};

// ── Store ──────────────────────────────────────────────────────────

export const useAlipayStore = createAppStoreWithActions<AlipayStoreState, AlipayActions>(
  'alipay',
  initialState,
  (set, get) => ({

    // ── Language ────────────────────────────────────────────────
    setLanguage: (lang) => {
      set({ language: lang });
    },

    // ── Balance ─────────────────────────────────────────────────
    deductBalance: (amount) => {
      const amt = isFinite(amount) && amount > 0 ? amount : 0;
      const s = get();
      set({
        balance: {
          ...s.balance,
          total: Math.max(0, s.balance.total - amt),
        },
      });
    },

    // ── Transfer ────────────────────────────────────────────────
    recordTransfer: (params) => {
      const delta = isFinite(params.delta) ? params.delta : 0;
      const timestamp = typeof params.timestamp === 'number' ? params.timestamp : TimeService.now();
      const methodId = params.methodId;
      const s = get();
      const kind = params.kind;
      let nextBalanceTotal = s.balance.total;
      let nextBankCards = s.bankCards;

      if (kind === 'recharge' && methodId && methodId !== 'balance') {
        // Recharge flow: Alipay balance increases, selected bank card decreases.
        const amt = Math.abs(delta);
        nextBalanceTotal = Math.max(0, s.balance.total + amt);
        nextBankCards = s.bankCards.map(c => (
          c.id === methodId ? { ...c, available: Math.max(0, c.available - amt) } : c
        ));
      } else if (!methodId || methodId === 'balance') {
        // Balance payment/transfer directly affects balance total.
        nextBalanceTotal = Math.max(0, s.balance.total + delta);
      } else {
        // Non-balance method (bank card): update selected card available amount.
        nextBankCards = s.bankCards.map(c => (
          c.id === methodId ? { ...c, available: Math.max(0, c.available + delta) } : c
        ));
      }

      const nextRecord = enrichTransferRecord({
        id: `tr_${timestamp}_${Math.random().toString(16).slice(2)}`,
        counterpartyName: params.counterpartyName,
        counterpartyAvatar: params.counterpartyAvatar ?? '',
        delta,
        timestamp,
        ...(params.note ? { note: params.note } : {}),
        ...(params.methodId ? { methodId: params.methodId } : {}),
        ...(params.orderId ? { orderId: params.orderId } : {}),
        ...(params.subject ? { subject: params.subject } : {}),
        ...(params.description ? { description: params.description } : {}),
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.category ? { category: params.category } : {}),
        ...(params.displayTitle ? { displayTitle: params.displayTitle } : {}),
        ...(params.detailTimeLabel ? { detailTimeLabel: params.detailTimeLabel } : {}),
        ...(params.paymentMethod ? { paymentMethod: params.paymentMethod } : {}),
        ...(params.transferNote ? { transferNote: params.transferNote } : {}),
        ...(params.targetAccount ? { targetAccount: params.targetAccount } : {}),
        ...(params.rechargeDescription ? { rechargeDescription: params.rechargeDescription } : {}),
        ...(params.productDescription ? { productDescription: params.productDescription } : {}),
        ...(params.phoneNumber ? { phoneNumber: params.phoneNumber } : {}),
        ...(params.transactionTarget ? { transactionTarget: params.transactionTarget } : {}),
        ...(params.acquiringInstitution ? { acquiringInstitution: params.acquiringInstitution } : {}),
        ...(params.clearingInstitution ? { clearingInstitution: params.clearingInstitution } : {}),
        ...(params.payeeFullName ? { payeeFullName: params.payeeFullName } : {}),
        ...(params.serviceDetail ? { serviceDetail: params.serviceDetail } : {}),
        ...(params.transactionDetail ? { transactionDetail: params.transactionDetail } : {}),
        ...(params.merchantOrderId ? { merchantOrderId: params.merchantOrderId } : {}),
        ...(typeof params.rewardPoints === 'number' ? { rewardPoints: params.rewardPoints } : {}),
        ...(typeof params.includeInBudget === 'boolean' ? { includeInBudget: params.includeInBudget } : {}),
      }, nextBankCards);

      set({
        balance: {
          ...s.balance,
          total: nextBalanceTotal,
        },
        bankCards: nextBankCards,
        transferRecords: [
          nextRecord,
          ...s.transferRecords,
        ],
      });
    },

    updateTransferRecord: (id, patch) => {
      const s = get();
      set({
        transferRecords: s.transferRecords.map(record => (
          record.id === id ? { ...record, ...patch } : record
        )),
      });
    },

    // ── Settings ──────────────────────────────────────────────
    setSettings: (updater) => {
      const s = get();
      const cur = s.settings ?? defaultSettings;
      const merged: AlipaySettings = {
        ...defaultSettings,
        ...cur,
        payment: {
          ...defaultSettings.payment,
          ...(cur.payment || {}),
          payOrder: { ...defaultSettings.payment.payOrder, ...((cur.payment || {}).payOrder || {}) },
          fastPay: { ...defaultSettings.payment.fastPay, ...((cur.payment || {}).fastPay || {}) },
        },
        notifications: { ...defaultSettings.notifications, ...(cur.notifications || {}) },
        general: {
          ...defaultSettings.general,
          ...(cur.general || {}),
          darkMode: { ...defaultSettings.general.darkMode, ...((cur.general || {}).darkMode || {}) },
          homeManage: { ...defaultSettings.general.homeManage, ...((cur.general || {}).homeManage || {}) },
          myManage: { ...defaultSettings.general.myManage, ...((cur.general || {}).myManage || {}) },
        },
      };
      const next = typeof updater === 'function' ? updater(merged) : updater;
      set({ settings: next });
    },

    // ── Ephemeral navigation state ──────────────────────────────
    setTransferDraft: (draft) => {
      set({ transferDraft: draft });
    },

    setTransferReceipt: (receipt) => {
      set({ transferReceipt: receipt });
    },

    setLastPaymentHint: (hint) => {
      set({ lastPaymentHint: hint });
    },

    // ── Payment extensions ───────────────────────────────────────
    bindBankCard: (card) => {
      const s = get();
      const newCard: AlipayBankCard = { ...card, bound: true };
      const exists = s.bankCards.some(c => c.id === card.id);
      if (exists) {
        set({
          bankCards: s.bankCards.map(c => c.id === card.id ? newCard : c),
        });
      } else {
        set({
          bankCards: [...s.bankCards, newCard],
        });
      }
    },

    unbindBankCard: (cardId) => {
      const s = get();
      set({
        bankCards: s.bankCards.map(c => c.id === cardId ? { ...c, bound: false } : c),
      });
    },

    addBankCard: (params) => {
      const bankName = String(params.bankName || '').trim() || '银行卡';
      const digits = String(params.cardNumber || '').replace(/\D/g, '');
      const last4 = digits.slice(-4) || String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const bankCodeMap: Record<string, string> = {
        建设银行: 'ccb', 工商银行: 'icbc', 农业银行: 'abc', 中国银行: 'boc',
        邮储银行: 'psbc', 邮政储蓄银行: 'psbc', 招商银行: 'cmb', 交通银行: 'bcm',
        中信银行: 'citic', 民生银行: 'cmbc', 光大银行: 'ceb', 兴业银行: 'cib', 浦发银行: 'spdb',
      };
      const baseCode = Object.entries(bankCodeMap).find(([k]) => bankName.includes(k))?.[1] || 'card';
      const bound = typeof params.bound === 'boolean' ? params.bound : true;
      const explicitAvailable = Number.isFinite(params.available) ? Number(params.available) : null;
      const s = get();

      // Inherit available from existing unbound card: last4 → explicit bankCode → legacy id prefix
      let donor = s.bankCards.find(c => c.last4 === last4 && !c.bound);
      if (!donor) {
        donor = s.bankCards.find(c => !c.bound && String((c as any).bankCode || '') === baseCode);
      }
      if (!donor) {
        donor = s.bankCards.find(c => c.id.startsWith(baseCode) && !c.bound && c.available !== 1000);
      }
      const available = (explicitAvailable === null || explicitAvailable === 1000) && donor
        ? donor.available
        : explicitAvailable ?? 1000;

      let newId = `${baseCode}_${last4}`;
      const used = new Set(s.bankCards.map(c => c.id));
      let suffix = 1;
      while (used.has(newId)) {
        suffix += 1;
        newId = `${baseCode}_${last4}_${suffix}`;
      }
      const next: AlipayBankCard = { id: newId, bankName, last4, bound, available };
      const remainingCards = donor
        ? s.bankCards.filter(c => c !== donor)
        : s.bankCards;
      set({ bankCards: [next, ...remainingCards] });
      return next;
    },

    upsertSubscription: (sub) => {
      const s = get();
      const exists = s.subscriptions.some(x => x.id === sub.id);
      if (exists) {
        set({
          subscriptions: s.subscriptions.map(x => x.id === sub.id ? sub : x),
        });
      } else {
        set({
          subscriptions: [...s.subscriptions, sub],
        });
      }
    },

    redeemRechargeCard: (code) => {
      const s = get();
      const card = s.rechargeCards.find(c => c.code === code);
      if (!card) {
        set({ lastPaymentHint: 'invalid_code' });
        return { ok: false, reason: 'invalid_code' };
      }
      if (card.redeemed) {
        set({ lastPaymentHint: 'already_redeemed' });
        return { ok: false, reason: 'already_redeemed' };
      }
      const now = TimeService.now();
      set({
        rechargeCards: s.rechargeCards.map(c => c.id === card.id ? { ...c, redeemed: true, redeemedAt: now } : c),
        balance: { ...s.balance, total: s.balance.total + card.value },
        lastPaymentHint: 'redeemed',
      });
      return { ok: true, value: card.value };
    },

    setPaymentPassword: (oldPwd, newPwd) => {
      const s = get();
      if (oldPwd !== null && s.userInfo.paymentPassword !== oldPwd) {
        set({ lastPaymentHint: 'wrong_password' });
        return { ok: false, reason: 'wrong_password' };
      }
      set({
        userInfo: {
          ...s.userInfo,
          paymentPassword: newPwd,
        },
        lastPaymentHint: 'password_changed',
      });
      return { ok: true };
    },

    sendChatMessage: (conversationId, text) => {
      const s = get();
      const now = TimeService.now();
      const newMsg: ChatMessage = {
        id: `cm_${now}_${Math.random().toString(16).slice(2, 8)}`,
        senderId: 'self',
        type: 'text',
        content: text,
        timestamp: now,
      };
      const history = { ...s.chatHistory };
      history[conversationId] = [...(history[conversationId] || []), newMsg];

      const idx = s.conversations.findIndex(c => c.id === conversationId);
      let nextConversations: ConversationItem[];
      if (idx >= 0) {
        const existing = s.conversations[idx];
        const updated: ConversationItem = { ...existing, lastContent: text, lastTimestamp: now, lastReadAt: now };
        const rest = s.conversations.filter((_, i) => i !== idx);
        nextConversations = [updated, ...rest];
      } else {
        const contactId = conversationId.replace('conv_p_', '');
        const contact = s.contacts.find(c => String(c.id) === contactId);
        nextConversations = [{
          id: conversationId,
          kind: 'person' as const,
          contactId,
          name: contact?.name ?? 'Unknown',
          avatar: contact?.avatar ?? '',
          lastContent: text,
          lastTimestamp: now,
          lastReadAt: now,
        }, ...s.conversations];
      }
      set({ conversations: nextConversations, chatHistory: history });
    },

    markConversationRead: (conversationId) => {
      const s = get();
      const idx = s.conversations.findIndex(c => c.id === conversationId);
      if (idx < 0) return;
      const conv = s.conversations[idx];
      const history = s.chatHistory[conversationId] || [];
      const latestTs = history.length > 0 ? history[history.length - 1].timestamp : TimeService.now();
      const updated: ConversationItem = {
        ...conv,
        lastReadAt: Math.max(latestTs, TimeService.now()),
      };
      set({
        conversations: s.conversations.map((c, i) => i === idx ? updated : c),
      });
    },
    markAllConversationsRead: () => {
      const s = get();
      const now = TimeService.now();
      set({
        conversations: s.conversations.map(conv => {
          const history = s.chatHistory[conv.id] || [];
          const latestTs = history.length > 0 ? history[history.length - 1].timestamp : now;
          return { ...conv, lastReadAt: Math.max(latestTs, now) };
        }),
      });
    },

    addBillSearchHistory: (keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;
      const prev = get().billSearchHistory.filter(k => k !== trimmed);
      set({ billSearchHistory: [trimmed, ...prev].slice(0, 10) });
    },
    clearBillSearchHistory: () => {
      set({ billSearchHistory: [] });
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        // Exclude ephemeral state from persistence
        if (k === 'transferDraft' || k === 'transferReceipt') continue;
        result[k] = v;
      }
      return result as Partial<AlipayStoreState>;
    },
  },
);

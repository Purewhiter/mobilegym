import { createAppStoreWithActions, registerStateAdapter, memoSelector } from '../../os/createAppStore';
import { RAILWAY12306_CONFIG } from './data';
import { getDate, now as timeNow } from '../../os/TimeService';
import { SmsGateway } from '../../os/SmsGateway';
import { initStations } from './services/stationService';
import { queryDirectTrains, queryTransferPlans } from './services/trainService';
import type {
  OrderRecord, Passenger, RailwaySettings, SelectedTrainDraft,
  TrainInfo, TransferPlan, TicketInfo, InvoiceHeader,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────────

function getDefaultDate(): string {
  const d = getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function maskName(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const compact = s.replace(/\s+/g, '');
  if (compact.length <= 1) return `${compact}**`;
  return `${compact.slice(0, 1)}**`;
}

export function maskPhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D+/g, '');
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

export function maskEmail(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const at = s.indexOf('@');
  if (at <= 0) return `${s.slice(0, Math.min(2, s.length))}******`;
  return `${s.slice(0, Math.min(2, at))}******${s.slice(at)}`;
}

export function maskIdNo(raw: string): string {
  const s = String(raw ?? '').trim();
  if (s.length <= 7) return s;
  return `${s.slice(0, 4)}${'*'.repeat(s.length - 7)}${s.slice(-3)}`;
}

type AuthAccount = { username: string; password: string; name?: string; idNo?: string; phone?: string; email?: string };
type AuthAttempt = { username: string; password: string; ok: boolean; at: number; reason?: string };
type ResetVerification = {
  phone: string;
  code: string;
  issuedAt: number;
  expiresInSec: number;
  used: boolean;
};

interface AuthState {
  accounts: AuthAccount[];
  loginAttempts: AuthAttempt[];
  lastLoginHint?: string;
  resetVerification?: ResetVerification | null;
  resetVerificationAttempts?: Array<{ phone: string; code: string; ok: boolean; at: number; reason?: string }>;
}

function buildUserProfile(input: { name: string; phone: string }): typeof RAILWAY12306_CONFIG.user {
  const now = getDate();
  const expire = `${now.getFullYear()}年${now.getMonth() + 6}月${now.getDate()}日`;
  return {
    ...RAILWAY12306_CONFIG.user,
    name: maskName(input.name),
    phone: maskPhone(input.phone),
    phoneVerified: true,
    realNameVerified: true,
    memberLevel: '一星会员',
    points: 0,
    diningPoints: 0,
    pointsExpireDate: expire,
    upgradeNeeded: 500,
  };
}

const cfgAuth = (RAILWAY12306_CONFIG as any).auth ?? {};

const DEFAULT_AUTH: AuthState = {
  accounts: (cfgAuth.accounts as AuthAccount[]) ?? [],
  loginAttempts: cfgAuth.loginAttempts ?? [],
  lastLoginHint: undefined,
  resetVerification: cfgAuth.resetVerification ?? null,
  resetVerificationAttempts: cfgAuth.resetVerificationAttempts ?? [],
};

// ── State interface ─────────────────────────────────────────────────

export interface RailwayState {
  // Persisted
  from: string;
  to: string;
  date: string;  // YYYY-MM-DD
  isStudent: boolean;
  searchHistory: string[];
  stationSelectTarget: 'from' | 'to';
  orders: OrderRecord[];
  passengers: Passenger[];
  settings: RailwaySettings;
  selectedTrain: SelectedTrainDraft | null;
  notificationsRead: string[];
  lastQuerySummary: { from: string; to: string; date: string; count: number } | null;
  invoiceHeaders: InvoiceHeader[];
  invoiceEmail: string;
  userProfile: typeof RAILWAY12306_CONFIG.user;
  isLoggedIn: boolean;
  loginUser: { username: string; password?: string; phone?: string; email?: string } | null;
  auth: AuthState;

  // Ephemeral (excluded from persistence)
  directTrains: TrainInfo[];
  transferPlans: TransferPlan[];
  _temp: {
    queryLoading: boolean;
    queryError: string | null;
  };
}

// ── Actions interface ───────────────────────────────────────────────

export interface RailwayActions {
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setDate: (v: string) => void;
  setIsStudent: (v: boolean) => void;
  swapStations: () => void;
  setStationSelectTarget: (v: 'from' | 'to') => void;
  addSearchHistory: (entry: string) => void;
  executeQuery: () => Promise<void>;
  executeTransferQuery: () => Promise<void>;
  addOrder: (order: OrderRecord) => void;
  updateOrder: (id: string, patch: Partial<OrderRecord>) => void;
  updateOrderTickets: (id: string, ticketUpdater: (tickets: TicketInfo[]) => TicketInfo[]) => void;
  updatePassengers: (passengers: Passenger[]) => void;
  updateSettings: (patch: Partial<RailwaySettings>) => void;
  setSelectedTrain: (v: SelectedTrainDraft | null) => void;
  markNotificationRead: (id: string) => void;
  // Auth actions
  login: (username: string, password?: string) => { ok: boolean; reason?: string };
  registerAccount: (payload: { username: string; password: string; name: string; idNo: string; phone: string; email?: string }) => { ok: boolean; reason?: string };
  logout: () => void;
  changePassword: (oldPwd: string, newPwd: string) => { ok: boolean; reason?: string };
  resetPassword: (phone: string, newPassword: string) => boolean;
  requestResetCode: (phone: string) => string;
  resetPasswordWithCode: (phone: string, idNo: string, code: string, newPassword: string) => { ok: boolean; reason?: string };
  addInvoiceHeader: (header: Omit<InvoiceHeader, 'id'>) => void;
  setInvoiceEmail: (email: string) => void;
}

// ── Initial state ───────────────────────────────────────────────────

const initialState: RailwayState = {
  from: RAILWAY12306_CONFIG.from,
  to: RAILWAY12306_CONFIG.to,
  date: getDefaultDate(),
  isStudent: false,
  searchHistory: [...RAILWAY12306_CONFIG.searchHistory],
  stationSelectTarget: 'from',
  orders: [...RAILWAY12306_CONFIG.orders] as OrderRecord[],
  passengers: RAILWAY12306_CONFIG.passengers.map(p => ({ ...p })),
  settings: { ...RAILWAY12306_CONFIG.settings } as RailwaySettings,
  selectedTrain: null,
  notificationsRead: [],
  lastQuerySummary: null,
  invoiceHeaders: (RAILWAY12306_CONFIG as any).invoiceHeaders ?? [],
  invoiceEmail: '',
  userProfile: RAILWAY12306_CONFIG.user,
  isLoggedIn: cfgAuth.session?.isLoggedIn ?? true,
  loginUser: cfgAuth.session?.loginUser ?? null,
  auth: DEFAULT_AUTH,

  // Ephemeral
  directTrains: [],
  transferPlans: [],
  _temp: {
    queryLoading: false,
    queryError: null,
  },
};

// ── Store ───────────────────────────────────────────────────────────

export const useRailwayStore = createAppStoreWithActions<RailwayState, RailwayActions>(
  'railway12306',
  initialState,
  (set, get) => {
    return {
      // ── Search form mutators ────────────────────────────────────
      setFrom: (v) => set({ from: v }),
      setTo: (v) => set({ to: v }),
      setDate: (v) => set({ date: v }),
      setIsStudent: (v) => set({ isStudent: v }),
      setStationSelectTarget: (v) => set({ stationSelectTarget: v }),
      swapStations: () => {
        const { from, to } = get();
        set({ from: to, to: from });
      },
      addSearchHistory: (entry) => {
        const filtered = get().searchHistory.filter(h => h !== entry);
        set({ searchHistory: [entry, ...filtered].slice(0, 5) });
      },

      // ── Order / passenger / settings mutators ───────────────────
      addOrder: (order) => {
        set({ orders: [order, ...get().orders] });
      },
      updateOrder: (id, patch) => {
        set({ orders: get().orders.map(o => o.id === id ? { ...o, ...patch } : o) });
      },
      updateOrderTickets: (id, ticketUpdater) => {
        set({ orders: get().orders.map(o => o.id === id ? { ...o, tickets: ticketUpdater(o.tickets) } : o) });
      },
      updatePassengers: (passengers) => set({ passengers }),
      updateSettings: (patch) => {
        set({ settings: { ...get().settings, ...patch } });
      },
      setSelectedTrain: (v) => set({ selectedTrain: v }),
      markNotificationRead: (id) => {
        const { notificationsRead } = get();
        if (!notificationsRead.includes(id)) {
          set({ notificationsRead: [...notificationsRead, id] });
        }
      },

      // ── Query actions ───────────────────────────────────────────
      executeQuery: async () => {
        set((s) => ({ _temp: { ...s._temp, queryLoading: true, queryError: null } }));
        try {
          await initStations();
          const { from, to, date } = get();
          const { trains } = await queryDirectTrains(from, to, date);
          set((s) => ({ directTrains: trains, _temp: { ...s._temp, queryLoading: false } }));
          get().addSearchHistory(`${from}--${to}`);
          set({ lastQuerySummary: { from, to, date, count: trains.length } });
        } catch (e: any) {
          set((s) => ({ _temp: { ...s._temp, queryLoading: false, queryError: e?.message || '查询失败' } }));
        }
      },
      executeTransferQuery: async () => {
        set((s) => ({ _temp: { ...s._temp, queryLoading: true, queryError: null } }));
        try {
          await initStations();
          const { from, to, date } = get();
          const plans = await queryTransferPlans(from, to, date);
          set((s) => ({ transferPlans: plans, _temp: { ...s._temp, queryLoading: false } }));
        } catch (e: any) {
          set((s) => ({ _temp: { ...s._temp, queryLoading: false, queryError: e?.message || '查询失败' } }));
        }
      },

      // ── Auth actions ────────────────────────────────────────────────
      login: (username, password) => {
        const uname = String(username ?? '').trim();
        const pwd = String(password ?? '').trim();
        if (!uname) return { ok: false, reason: 'missing_username' };
        if (!pwd) return { ok: false, reason: 'missing_password' };

        const s = get();
        const accounts = s.auth?.accounts ?? [];
        const account = accounts.find((a) => a.username === uname || a.phone === uname || a.email === uname);
        const now = timeNow();

        if (!account) {
          set({
            isLoggedIn: false,
            loginUser: null,
            auth: {
              ...s.auth,
              lastLoginHint: 'no_account',
              loginAttempts: [...(s.auth.loginAttempts || []), { username: uname, password: pwd, ok: false, at: now, reason: 'no_account' }],
            },
          });
          return { ok: false, reason: 'no_account' };
        }
        if (String(account.password) !== pwd) {
          set({
            isLoggedIn: false,
            loginUser: null,
            auth: {
              ...s.auth,
              lastLoginHint: 'wrong_password',
              loginAttempts: [...(s.auth.loginAttempts || []), { username: uname, password: pwd, ok: false, at: now, reason: 'wrong_password' }],
            },
          });
          return { ok: false, reason: 'wrong_password' };
        }
        const nextProfile = (account.name && account.phone) ? buildUserProfile({ name: String(account.name), phone: String(account.phone) }) : s.userProfile;
        set({
          isLoggedIn: true,
          loginUser: { username: account.username, password: account.password, phone: account.phone, email: account.email },
          userProfile: nextProfile,
          auth: {
            ...s.auth,
            lastLoginHint: 'success',
            loginAttempts: [...(s.auth.loginAttempts || []), { username: uname, password: pwd, ok: true, at: now }],
          },
        });
        return { ok: true };
      },

      registerAccount: (payload) => {
        const uname = String(payload?.username ?? '').trim();
        const pwd = String(payload?.password ?? '').trim();
        const name = String(payload?.name ?? '').trim();
        const idNo = String(payload?.idNo ?? '').trim();
        const phone = String(payload?.phone ?? '').trim();
        const email = String(payload?.email ?? '').trim();
        if (!uname || pwd.length < 6 || !name || !idNo || !phone) return { ok: false, reason: 'invalid' };

        const s = get();
        const accounts = s.auth?.accounts ?? [];
        const exists = accounts.some((a) => a.username === uname || a.phone === phone || (email && a.email === email));
        if (exists) return { ok: false, reason: 'exists' };

        const now = timeNow();
        const nextProfile = buildUserProfile({ name, phone });
        set({
          auth: {
            ...s.auth,
            accounts: [...accounts, { username: uname, password: pwd, name, idNo, phone, email }],
            lastLoginHint: 'registered',
            loginAttempts: [...(s.auth.loginAttempts || []), { username: uname, password: pwd, ok: true, at: now, reason: 'registered' }],
          },
          isLoggedIn: true,
          loginUser: { username: uname, password: pwd, phone, email },
          userProfile: nextProfile,
          passengers: [
            { id: 'p_new_1', name, idType: '身份证', idNo, isDefault: true, ticketType: '成人票' },
          ],
        });
        return { ok: true };
      },

      logout: () => {
        set({
          isLoggedIn: false,
          loginUser: null,
        });
      },
      changePassword: (oldPwd, newPwd) => {
        const { loginUser, auth } = get();
        if (!loginUser) {
          return { ok: false, reason: 'not_logged_in' };
        }
        if (loginUser.password && loginUser.password !== oldPwd) {
          return { ok: false, reason: 'wrong_password' };
        }
        set({
          loginUser: { ...loginUser, password: newPwd },
          auth: {
            ...auth,
            accounts: (auth.accounts || []).map((a) =>
              loginUser && a.username === loginUser.username ? { ...a, password: newPwd } : a
            ),
          },
        });
        return { ok: true };
      },

      resetPassword: (phone, newPassword) => {
        const p = String(phone ?? '').trim();
        const np = String(newPassword ?? '').trim();
        if (!p || np.length < 6) return false;
        const { auth } = get();
        const accounts = auth?.accounts || [];
        const exists = accounts.some((a) => a.phone === p);
        if (!exists) return false;
        set({
          auth: {
            ...auth,
            accounts: accounts.map((a) => (a.phone === p ? { ...a, password: np } : a)),
          },
        });
        return true;
      },

      requestResetCode: (phone) => {
        const p = String(phone ?? '').trim();
        const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
        SmsGateway.receiveMessage({ from: '铁路12306', body: `【铁路12306】验证码：${code}，5分钟内有效` });
        const s = get();
        set({
          auth: {
            ...s.auth,
            resetVerification: {
              phone: p,
              code,
              issuedAt: timeNow(),
              expiresInSec: 300,
              used: false,
            },
          },
        });
        return code;
      },

      resetPasswordWithCode: (phone, idNo, code, newPassword) => {
        const p = String(phone ?? '').trim();
        const id = String(idNo ?? '').trim();
        const c = String(code ?? '').trim();
        const np = String(newPassword ?? '').trim();
        const s = get();
        const accounts = s.auth?.accounts || [];
        const account = accounts.find((a) => a.phone === p);
        if (!account) return { ok: false, reason: 'no_account' };
        if (account.idNo !== id) return { ok: false, reason: 'id_mismatch' };

        const rv = s.auth?.resetVerification;
        const now = timeNow();
        const nextAttempts = [...(s.auth?.resetVerificationAttempts || [])];

        if (!rv || rv.phone !== p) {
          nextAttempts.push({ phone: p, code: c, ok: false, at: now, reason: 'no_code' });
          set({ auth: { ...s.auth, resetVerificationAttempts: nextAttempts } });
          return { ok: false, reason: 'no_code' };
        }
        if (rv.used) {
          nextAttempts.push({ phone: p, code: c, ok: false, at: now, reason: 'code_used' });
          set({ auth: { ...s.auth, resetVerificationAttempts: nextAttempts } });
          return { ok: false, reason: 'code_used' };
        }
        if (now > rv.issuedAt + rv.expiresInSec * 1000) {
          nextAttempts.push({ phone: p, code: c, ok: false, at: now, reason: 'code_expired' });
          set({ auth: { ...s.auth, resetVerificationAttempts: nextAttempts } });
          return { ok: false, reason: 'code_expired' };
        }
        if (rv.code !== c) {
          nextAttempts.push({ phone: p, code: c, ok: false, at: now, reason: 'code_wrong' });
          set({ auth: { ...s.auth, resetVerificationAttempts: nextAttempts } });
          return { ok: false, reason: 'code_wrong' };
        }
        if (np.length < 6) {
          nextAttempts.push({ phone: p, code: c, ok: false, at: now, reason: 'invalid_password' });
          set({ auth: { ...s.auth, resetVerificationAttempts: nextAttempts } });
          return { ok: false, reason: 'invalid_password' };
        }

        nextAttempts.push({ phone: p, code: c, ok: true, at: now });
        set({
          auth: {
            ...s.auth,
            accounts: accounts.map((a) => (a.phone === p ? { ...a, password: np } : a)),
            resetVerification: { ...rv, used: true },
            resetVerificationAttempts: nextAttempts,
          },
        });
        return { ok: true };
      },

      addInvoiceHeader: (header) => {
        const s = get();
        const id = `ih_${timeNow()}`;
        const existing = header.isDefault
          ? s.invoiceHeaders.map(h => ({ ...h, isDefault: false }))
          : [...s.invoiceHeaders];
        set({ invoiceHeaders: [{ ...header, id }, ...existing] });
      },

      setInvoiceEmail: (email) => set({ invoiceEmail: email }),
    };
  },
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      // Exclude functions and ephemeral state from persistence
      const ephemeralKeys = new Set([
        'directTrains', 'transferPlans', '_temp',
      ]);
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (ephemeralKeys.has(k)) continue;
        result[k] = v;
      }
      return result as Partial<RailwayState>;
    },
  },
);

// ── Memoized selectors ──────────────────────────────────────────────

/** Select pending orders (filtered array) */
export const selectPendingOrders = memoSelector(
  (s: RailwayState & RailwayActions) => s.orders,
  orders => orders.filter(o => o.status === 'pending'),
);

/** Select completed orders (filtered array) */
export const selectCompletedOrders = memoSelector(
  (s: RailwayState & RailwayActions) => s.orders,
  orders => orders.filter(o => o.status === 'completed'),
);

// ── State adapter ────────────────────────────────────────────────────

function sanitizeTrainsForExport(trains: TrainInfo[]): TrainInfo[] {
  return trains.map(t => ({
    ...t,
    seats: t.seats.map(s => ({
      ...s,
      count: Number.isFinite(s.count) ? s.count : 99,
    })),
  }));
}

function sanitizeTransferPlansForExport(plans: TransferPlan[]): TransferPlan[] {
  return plans.map(plan => ({
    ...plan,
    leg1: {
      ...plan.leg1,
      seats: plan.leg1.seats.map(s => ({
        ...s,
        count: Number.isFinite(s.count) ? s.count : 99,
      })),
    },
    leg2: {
      ...plan.leg2,
      seats: plan.leg2.seats.map(s => ({
        ...s,
        count: Number.isFinite(s.count) ? s.count : 99,
      })),
    },
  }));
}

registerStateAdapter('railway12306', (state) => {
  const safeTrains = sanitizeTrainsForExport(state.directTrains);
  const safeTransferPlans = sanitizeTransferPlansForExport(state.transferPlans);
  return {
  ...state,
  directTrains: safeTrains,
  transferPlans: safeTransferPlans,
  searchForm: {
    from: state.from,
    to: state.to,
    date: state.date,
    isStudent: state.isStudent,
  },
  user: state.userProfile ?? RAILWAY12306_CONFIG.user,
  notifications: RAILWAY12306_CONFIG.notifications,
  account: {
    ...(RAILWAY12306_CONFIG.account ?? {}),
    personalInfo: {
      ...(RAILWAY12306_CONFIG.account?.personalInfo ?? {}),
      username: state.loginUser?.username ?? RAILWAY12306_CONFIG.account?.personalInfo?.username ?? '',
      name: state.userProfile?.name ?? RAILWAY12306_CONFIG.account?.personalInfo?.name ?? '',
    },
    phone: {
      ...(RAILWAY12306_CONFIG.account?.phone ?? {}),
      number: state.loginUser?.phone ?? RAILWAY12306_CONFIG.account?.phone?.number ?? '',
      status: state.userProfile?.phoneVerified ? '已核验' : (RAILWAY12306_CONFIG.account?.phone?.status ?? ''),
    },
    email: {
      ...(RAILWAY12306_CONFIG.account?.email ?? {}),
      address: state.loginUser?.email ?? RAILWAY12306_CONFIG.account?.email?.address ?? '',
    },
  },
  studentVerify: RAILWAY12306_CONFIG.studentVerify ?? {},
  servicePhones: RAILWAY12306_CONFIG.servicePhones ?? [],
  queryState: {
    directTrains: safeTrains,
    transferPlans: safeTransferPlans,
    loading: state._temp?.queryLoading ?? false,
    error: state._temp?.queryError ?? null,
  },
  lastPickedTrain: (() => {
    const draft = state.selectedTrain;
    if (!draft) return null;
    const picked = safeTrains[draft.trainIndex] ?? null;
    return picked ? { ...picked, ...draft } : { ...draft };
  })(),
  auth: state.auth,
  lastLoginHint: state.auth?.lastLoginHint,
};
});

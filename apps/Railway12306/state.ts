import { registerStateAdapter, memoSelector } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import { RAILWAY12306_CONFIG } from './data';
import { getDate } from '../../os/TimeService';
import { SmsGateway } from '../../os/SmsGateway';
import { initStations } from './services/stationService';
import { queryDirectTrains, queryTransferPlans } from './services/trainService';
import type {
  OrderRecord, Passenger, RailwaySettings, SelectedTrainDraft,
  TrainInfo, TransferPlan, InvoiceHeader,
} from './types';
import type { AuthResult, AuthState, RailwayDeviceState } from './device';
import { digits, nextStream } from '../../os/RandomService';

// ── Helpers ─────────────────────────────────────────────────────────

function getDefaultDate(): string {
  const d = getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Points expiry shown on a freshly signed-in profile (formatted with the simulated calendar). */
function newProfileExpireDate(): string {
  const now = getDate();
  return `${now.getFullYear()}年${now.getMonth() + 6}月${now.getDate()}日`;
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

const cfgAuth = (RAILWAY12306_CONFIG as any).auth ?? {};

const DEFAULT_AUTH: AuthState = {
  accounts: cfgAuth.accounts ?? [],
  loginAttempts: cfgAuth.loginAttempts ?? [],
  lastLoginHint: undefined,
  resetVerification: cfgAuth.resetVerification ?? null,
  resetVerificationAttempts: cfgAuth.resetVerificationAttempts ?? [],
};

// ── State interface ─────────────────────────────────────────────────

/**
 * The user's data (orders, passengers, settings, account, login) lives in the
 * device server session (apps/Railway12306/device); the rest is the page's
 * own: the search form, the train being booked and the query results.
 */
export interface RailwayState extends RailwayDeviceState {
  // Page-only
  from: string;
  to: string;
  date: string;  // YYYY-MM-DD
  isStudent: boolean;
  stationSelectTarget: 'from' | 'to';
  selectedTrain: SelectedTrainDraft | null;
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
  executeQuery: () => Promise<void>;
  executeTransferQuery: () => Promise<void>;
  addOrder: (order: OrderRecord) => Promise<void>;
  updateOrder: (id: string, patch: Partial<OrderRecord>) => Promise<void>;
  /** Cancel every unpaid order (a new booking replaces it). */
  cancelPendingOrders: () => Promise<void>;
  updatePassengers: (passengers: Passenger[]) => Promise<void>;
  updateSettings: (patch: Partial<RailwaySettings>) => Promise<void>;
  /** Flip a boolean setting on the server (taps faster than a round trip each count). */
  toggleSetting: (key: BooleanSettingKey) => Promise<void>;
  setSelectedTrain: (v: SelectedTrainDraft | null) => void;
  markNotificationRead: (id: string) => Promise<void>;
  // Auth actions
  login: (username: string, password?: string) => Promise<AuthResult>;
  registerAccount: (payload: { username: string; password: string; name: string; idNo: string; phone: string; email?: string }) => Promise<AuthResult>;
  logout: () => Promise<void>;
  changePassword: (oldPwd: string, newPwd: string) => Promise<AuthResult>;
  resetPassword: (phone: string, newPassword: string) => Promise<boolean>;
  requestResetCode: (phone: string) => Promise<string>;
  resetPasswordWithCode: (phone: string, idNo: string, code: string, newPassword: string) => Promise<AuthResult>;
  addInvoiceHeader: (header: Omit<InvoiceHeader, 'id'>) => Promise<void>;
  setInvoiceEmail: (email: string) => Promise<void>;
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

  directTrains: [],
  transferPlans: [],
  _temp: {
    queryLoading: false,
    queryError: null,
  },
};

const PAGE_ONLY_KEYS: (keyof RailwayState)[] = [
  'from', 'to', 'date', 'isStudent', 'stationSelectTarget', 'selectedTrain',
  'directTrains', 'transferPlans', '_temp',
];

type BooleanSettingKey = { [K in keyof RailwaySettings]: RailwaySettings[K] extends boolean ? K : never }[keyof RailwaySettings];

/** A reset can abandon a command (resolves undefined): report it as not done. */
const notDone: AuthResult = { ok: false, reason: 'abandoned' };

// ── Store ───────────────────────────────────────────────────────────

export const useRailwayStore = createDeviceAppStore<RailwayState, RailwayActions>(
  'railway12306',
  initialState,
  { localKeys: PAGE_ONLY_KEYS },
  ({ command }, set, get) => {
    const run = (name: string) => async (...args: unknown[]) => {
      await command(name, ...args);
    };
    const auth = async (name: string, ...args: unknown[]) =>
      ((await command(name, ...args)) as AuthResult | undefined) ?? notDone;

    return {
      // ── Search form (page-only) ─────────────────────────────────
      setFrom: (v) => set({ from: v }),
      setTo: (v) => set({ to: v }),
      setDate: (v) => set({ date: v }),
      setIsStudent: (v) => set({ isStudent: v }),
      setStationSelectTarget: (v) => set({ stationSelectTarget: v }),
      swapStations: () => {
        const { from, to } = get();
        set({ from: to, to: from });
      },
      setSelectedTrain: (v) => set({ selectedTrain: v }),

      // ── Orders / passengers / settings ──────────────────────────
      addOrder: run('addOrder'),
      updateOrder: run('updateOrder'),
      cancelPendingOrders: run('cancelPendingOrders'),
      updatePassengers: run('updatePassengers'),
      updateSettings: run('updateSettings'),
      toggleSetting: run('toggleSetting'),
      markNotificationRead: run('markNotificationRead'),
      addInvoiceHeader: run('addInvoiceHeader'),
      setInvoiceEmail: run('setInvoiceEmail'),

      // ── Query actions ───────────────────────────────────────────
      executeQuery: async () => {
        set((s) => ({ _temp: { ...s._temp, queryLoading: true, queryError: null } }));
        try {
          await initStations();
          const { from, to, date } = get();
          const { trains } = await queryDirectTrains(from, to, date);
          set((s) => ({ directTrains: trains, _temp: { ...s._temp, queryLoading: false } }));
          await command('recordQuery', from, to, date, trains.length);
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

      // ── Auth ────────────────────────────────────────────────────
      login: (username, password) => auth('login', username, password, newProfileExpireDate()),
      registerAccount: (payload) => auth('registerAccount', payload, newProfileExpireDate()),
      logout: run('logout'),
      changePassword: (oldPwd, newPwd) => auth('changePassword', oldPwd, newPwd),
      resetPassword: async (phone, newPassword) =>
        Boolean(await command('resetPassword', phone, newPassword)),
      requestResetCode: async (phone) => {
        const code = digits(nextStream('railway12306.resetCode'), 6);
        SmsGateway.receiveMessage({ from: '铁路12306', body: `【铁路12306】验证码：${code}，5分钟内有效` });
        await command('issueResetCode', String(phone ?? '').trim(), code);
        return code;
      },
      resetPasswordWithCode: (phone, idNo, code, newPassword) =>
        auth('resetPasswordWithCode', phone, idNo, code, newPassword),
    };
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

/**
 * Railway12306 on the device server.
 *
 * The offline train catalog (data/catalog/trainCatalog.json, ~24MB) is loaded
 * and indexed once per server process instead of once per page that searches
 * for trains. The queries take the page's simulated clock (today's departures
 * already gone, presale window), so results match what the page computed
 * before.
 *
 * Session state is the user's own data (orders, passengers, settings, account
 * and login), in the same shape as before, so
 * `__SIM__.getState().apps.railway12306` and every bench judge keep working
 * unchanged. Commands are the former store actions. The search form and the
 * query results stay on the page (see state.ts).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppContext, AppModule, Catalog } from '../../../device/engine';
import defaults from '../data/defaults.json';
import { createTrainCatalog, type CatalogClock, type CatalogJson, type TrainCatalog } from '../services/catalogService';
import type { InvoiceHeader, OrderRecord, Passenger, RailwaySettings } from '../types';

export type AuthAccount = { username: string; password: string; name?: string; idNo?: string; phone?: string; email?: string };
type AuthAttempt = { username: string; password: string; ok: boolean; at: number; reason?: string };
type ResetVerification = {
  phone: string;
  code: string;
  issuedAt: number;
  expiresInSec: number;
  used: boolean;
};

export interface AuthState {
  accounts: AuthAccount[];
  loginAttempts: AuthAttempt[];
  lastLoginHint?: string;
  resetVerification?: ResetVerification | null;
  resetVerificationAttempts?: Array<{ phone: string; code: string; ok: boolean; at: number; reason?: string }>;
}

export type RailwayUserProfile = typeof defaults.user;

export interface RailwayDeviceState {
  searchHistory: string[];
  orders: OrderRecord[];
  passengers: Passenger[];
  settings: RailwaySettings;
  notificationsRead: string[];
  lastQuerySummary: { from: string; to: string; date: string; count: number } | null;
  invoiceHeaders: InvoiceHeader[];
  invoiceEmail: string;
  userProfile: RailwayUserProfile;
  isLoggedIn: boolean;
  loginUser: { username: string; password?: string; phone?: string; email?: string } | null;
  auth: AuthState;
}

export const RAILWAY_STATE_KEYS = [
  'searchHistory', 'orders', 'passengers', 'settings', 'notificationsRead', 'lastQuerySummary',
  'invoiceHeaders', 'invoiceEmail', 'userProfile', 'isLoggedIn', 'loginUser', 'auth',
] as const satisfies readonly (keyof RailwayDeviceState)[];

type Ctx = AppContext<RailwayDeviceState>;
export type AuthResult = { ok: boolean; reason?: string };

const trainCatalog = (catalog: Catalog) => catalog.extras.trains as TrainCatalog;

function clockArg(args: Record<string, unknown>): CatalogClock {
  const today = String(args.today ?? '');
  const nowHHmm = String(args.nowHHmm ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !/^\d{2}:\d{2}$/.test(nowHHmm)) {
    throw new Error('railway12306 catalog queries need today (YYYY-MM-DD) and nowHHmm (HH:mm)');
  }
  return { today, nowHHmm };
}

function maskName(raw: string): string {
  const compact = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!compact) return '';
  return `${compact.slice(0, 1)}**`;
}

function maskPhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D+/g, '');
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/**
 * Profile of a freshly signed-in account. `pointsExpireDate` is formatted by
 * the page, which owns the simulated calendar and time zone.
 */
function buildUserProfile(name: string, phone: string, pointsExpireDate: string): RailwayUserProfile {
  return {
    ...defaults.user,
    name: maskName(name),
    phone: maskPhone(phone),
    phoneVerified: true,
    realNameVerified: true,
    memberLevel: '一星会员',
    points: 0,
    diningPoints: 0,
    pointsExpireDate,
    upgradeNeeded: 500,
  };
}

const str = (value: unknown) => String(value ?? '').trim();

function patchAuth(ctx: Ctx, patch: Partial<AuthState>): void {
  ctx.state = { ...ctx.state, auth: { ...ctx.state.auth, ...patch } };
}

function patchOrder(ctx: Ctx, id: string, patch: Partial<OrderRecord>): void {
  ctx.state = { ...ctx.state, orders: ctx.state.orders.map(o => (o.id === id ? { ...o, ...patch } : o)) };
}

// ── Commands (one per store action) ─────────────────────────────────

const commands: AppModule<RailwayDeviceState>['commands'] = {
  recordQuery(ctx, [from, to, date, count]) {
    const entry = `${from}--${to}`;
    const history = ctx.state.searchHistory.filter(h => h !== entry);
    ctx.state = {
      ...ctx.state,
      searchHistory: [entry, ...history].slice(0, 5),
      lastQuerySummary: { from: String(from), to: String(to), date: String(date), count: Number(count) },
    };
  },

  addOrder(ctx, [order]) {
    ctx.state = { ...ctx.state, orders: [order as OrderRecord, ...ctx.state.orders] };
  },
  updateOrder(ctx, [id, patch]) {
    patchOrder(ctx, String(id), patch as Partial<OrderRecord>);
  },
  /** Cancel every pending order (a new booking replaces the unpaid one). */
  cancelPendingOrders(ctx) {
    ctx.state = {
      ...ctx.state,
      orders: ctx.state.orders.map(o => (o.status === 'pending' ? { ...o, status: 'cancelled' as const } : o)),
    };
  },
  updatePassengers(ctx, [passengers]) {
    ctx.state = { ...ctx.state, passengers: passengers as Passenger[] };
  },
  updateSettings(ctx, [patch]) {
    ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, ...(patch as Partial<RailwaySettings>) } };
  },
  toggleSetting(ctx, [key]) {
    const name = String(key) as keyof RailwaySettings;
    if (typeof ctx.state.settings[name] !== 'boolean') throw new Error(`railway12306 setting ${name} is not a switch`);
    ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, [name]: !ctx.state.settings[name] } };
  },
  markNotificationRead(ctx, [id]) {
    const key = String(id);
    if (ctx.state.notificationsRead.includes(key)) return;
    ctx.state = { ...ctx.state, notificationsRead: [...ctx.state.notificationsRead, key] };
  },
  addInvoiceHeader(ctx, [header], { now }) {
    const next = header as Omit<InvoiceHeader, 'id'>;
    const existing = next.isDefault
      ? ctx.state.invoiceHeaders.map(h => ({ ...h, isDefault: false }))
      : [...ctx.state.invoiceHeaders];
    ctx.state = { ...ctx.state, invoiceHeaders: [{ ...next, id: `ih_${now}` }, ...existing] };
  },
  setInvoiceEmail(ctx, [email]) {
    ctx.state = { ...ctx.state, invoiceEmail: String(email ?? '') };
  },

  // ── Auth ──
  login(ctx, [username, password, pointsExpireDate], { now }): AuthResult {
    const uname = str(username);
    const pwd = str(password);
    if (!uname) return { ok: false, reason: 'missing_username' };
    if (!pwd) return { ok: false, reason: 'missing_password' };

    const { auth } = ctx.state;
    const account = (auth.accounts ?? []).find(a => a.username === uname || a.phone === uname || a.email === uname);
    const fail = (reason: string): AuthResult => {
      ctx.state = {
        ...ctx.state,
        isLoggedIn: false,
        loginUser: null,
        auth: {
          ...auth,
          lastLoginHint: reason,
          loginAttempts: [...(auth.loginAttempts || []), { username: uname, password: pwd, ok: false, at: now, reason }],
        },
      };
      return { ok: false, reason };
    };
    if (!account) return fail('no_account');
    if (String(account.password) !== pwd) return fail('wrong_password');

    ctx.state = {
      ...ctx.state,
      isLoggedIn: true,
      loginUser: { username: account.username, password: account.password, phone: account.phone, email: account.email },
      userProfile: account.name && account.phone
        ? buildUserProfile(String(account.name), String(account.phone), String(pointsExpireDate ?? ''))
        : ctx.state.userProfile,
      auth: {
        ...auth,
        lastLoginHint: 'success',
        loginAttempts: [...(auth.loginAttempts || []), { username: uname, password: pwd, ok: true, at: now }],
      },
    };
    return { ok: true };
  },

  registerAccount(ctx, [payload, pointsExpireDate], { now }): AuthResult {
    const p = (payload ?? {}) as Record<string, unknown>;
    const uname = str(p.username);
    const pwd = str(p.password);
    const name = str(p.name);
    const idNo = str(p.idNo);
    const phone = str(p.phone);
    const email = str(p.email);
    if (!uname || pwd.length < 6 || !name || !idNo || !phone) return { ok: false, reason: 'invalid' };

    const { auth } = ctx.state;
    const accounts = auth.accounts ?? [];
    if (accounts.some(a => a.username === uname || a.phone === phone || (email && a.email === email))) {
      return { ok: false, reason: 'exists' };
    }
    ctx.state = {
      ...ctx.state,
      auth: {
        ...auth,
        accounts: [...accounts, { username: uname, password: pwd, name, idNo, phone, email }],
        lastLoginHint: 'registered',
        loginAttempts: [...(auth.loginAttempts || []), { username: uname, password: pwd, ok: true, at: now, reason: 'registered' }],
      },
      isLoggedIn: true,
      loginUser: { username: uname, password: pwd, phone, email },
      userProfile: buildUserProfile(name, phone, String(pointsExpireDate ?? '')),
      passengers: [{ id: 'p_new_1', name, idType: '身份证', idNo, isDefault: true, ticketType: '成人票' }],
    };
    return { ok: true };
  },

  logout(ctx) {
    ctx.state = { ...ctx.state, isLoggedIn: false, loginUser: null };
  },

  changePassword(ctx, [oldPwd, newPwd]): AuthResult {
    const { loginUser, auth } = ctx.state;
    if (!loginUser) return { ok: false, reason: 'not_logged_in' };
    if (loginUser.password && loginUser.password !== oldPwd) return { ok: false, reason: 'wrong_password' };
    const password = String(newPwd);
    ctx.state = {
      ...ctx.state,
      loginUser: { ...loginUser, password },
      auth: {
        ...auth,
        accounts: (auth.accounts || []).map(a => (a.username === loginUser.username ? { ...a, password } : a)),
      },
    };
    return { ok: true };
  },

  resetPassword(ctx, [phone, newPassword]): boolean {
    const p = str(phone);
    const np = str(newPassword);
    if (!p || np.length < 6) return false;
    const accounts = ctx.state.auth.accounts || [];
    if (!accounts.some(a => a.phone === p)) return false;
    patchAuth(ctx, { accounts: accounts.map(a => (a.phone === p ? { ...a, password: np } : a)) });
    return true;
  },

  /** The page draws the code (seeded RandomService) and sends the SMS. */
  issueResetCode(ctx, [phone, code], { now }) {
    patchAuth(ctx, {
      resetVerification: { phone: str(phone), code: String(code), issuedAt: now, expiresInSec: 300, used: false },
    });
  },

  resetPasswordWithCode(ctx, [phone, idNo, code, newPassword], { now }): AuthResult {
    const p = str(phone);
    const id = str(idNo);
    const c = str(code);
    const np = str(newPassword);
    const { auth } = ctx.state;
    const accounts = auth.accounts || [];
    const account = accounts.find(a => a.phone === p);
    if (!account) return { ok: false, reason: 'no_account' };
    if (account.idNo !== id) return { ok: false, reason: 'id_mismatch' };

    const rv = auth.resetVerification;
    const attempts = [...(auth.resetVerificationAttempts || [])];
    const fail = (reason: string): AuthResult => {
      attempts.push({ phone: p, code: c, ok: false, at: now, reason });
      patchAuth(ctx, { resetVerificationAttempts: attempts });
      return { ok: false, reason };
    };
    if (!rv || rv.phone !== p) return fail('no_code');
    if (rv.used) return fail('code_used');
    if (now > rv.issuedAt + rv.expiresInSec * 1000) return fail('code_expired');
    if (rv.code !== c) return fail('code_wrong');
    if (np.length < 6) return fail('invalid_password');

    attempts.push({ phone: p, code: c, ok: true, at: now });
    patchAuth(ctx, {
      accounts: accounts.map(a => (a.phone === p ? { ...a, password: np } : a)),
      resetVerification: { ...rv, used: true },
      resetVerificationAttempts: attempts,
    });
    return { ok: true };
  },
};

export function createRailway12306Module(): AppModule<RailwayDeviceState> {
  return {
    appId: 'railway12306',
    loadCatalog(root) {
      const json = JSON.parse(
        readFileSync(join(root, 'apps', 'Railway12306', 'data', 'catalog', 'trainCatalog.json'), 'utf8'),
      ) as CatalogJson;
      return { collections: new Map(), extras: { trains: createTrainCatalog(json) } };
    },
    materialize() {},
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('railway12306 state must be an object');
      const source = raw as Record<string, unknown>;
      const state: Record<string, unknown> = {};
      for (const key of RAILWAY_STATE_KEYS) state[key] = source[key];
      return state as unknown as RailwayDeviceState;
    },
    commands,
    queries: {
      /** Direct trains; `null` = the catalog does not cover this OD (page falls back to the live API). */
      directTrains(ctx, args) {
        return trainCatalog(ctx.catalog).queryDirect(
          String(args.from ?? ''), String(args.to ?? ''), String(args.date ?? ''), clockArg(args),
        );
      },
      /** Stop list by internal train number; `null` = train not in the catalog. */
      trainStops(ctx, args) {
        return trainCatalog(ctx.catalog).trainStops(String(args.trainNo ?? ''));
      },
      /** Transfer plans; `null` = not covered. */
      transferPlans(ctx, args) {
        return trainCatalog(ctx.catalog).queryTransfer(
          String(args.from ?? ''), String(args.to ?? ''), String(args.date ?? ''), clockArg(args),
        );
      },
    },
  };
}

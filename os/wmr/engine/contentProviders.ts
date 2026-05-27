/**
 * WMR widget data dispatcher.
 *
 * Responsibilities (all generic — no domain knowledge):
 *
 * 1. **Explicit binders** — `<ContentProviderBinder>` nodes in MAML XML.
 *    {@link applyBinderData} parses each binder's URI/projection, calls
 *    `ContentResolver.query(uri, projection)`, and maps Cursor columns to
 *    `VarContext` variables (array vs scalar based on `Variable.type`).
 *    Apps own the providers; this file never knows which authority handles
 *    what.
 *
 * 2. **Ambient injection** — bundles also reference vars like
 *    `weather_temperature`, `battery_level`, `next_alarm_time` without
 *    declaring binders. {@link injectProviderData} looks up
 *    `WmrProviderDependencies` (inferred from bundle expressions in
 *    `WmrBundleCache`) and queries the matching ambient adapter from
 *    `ambientAdapters.ts`. Adapters live in the owning app/system module
 *    and register themselves at load time via the eager glob in
 *    `os/ContentResolver.ts:132`.
 *
 * 3. **Host broadcasts** — {@link handleWmrHostBroadcast} forwards system
 *    MAML broadcasts (`CLEAN_MEMORY`, `VIBRATE`, ...) to the OS-owned
 *    `SystemWidgetProvider` which mutates the underlying state.
 *
 * Each ambient adapter call is wrapped in try/catch so a single broken
 * adapter can't crash an entire widget render pass.
 */
import ContentResolver from '../../ContentResolver';
import {
  getAmbientAdapter,
  type WmrAmbientDomain,
} from './ambientAdapters';
import { evalStr } from './expression';
import { handleSystemWidgetBroadcast } from '../../providers/SystemWidgetProvider';
import type { VarValue, WmrNode, WmrContentProviderBinder, WmrProviderDependencies } from './types';
import type { VarContext } from './variables';

function normalizeProviderValue(value: unknown): VarValue {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value == null) return '';
  return String(value);
}

// ---------------------------------------------------------------------------
// Explicit ContentProviderBinder dispatch (generic — pure ContentResolver).
// ---------------------------------------------------------------------------

/**
 * Resolve the concrete URI for a binder by substituting `%s` placeholders in
 * `uriFormat` with values evaluated from `uriParas` against the current
 * VarContext. `uriParas` is a comma-separated list of MAML expressions; one
 * substitution per `%s` in declaration order.
 *
 * Values are URL-encoded so untrusted city/account ids can't break path
 * parsing in downstream providers.
 */
function resolveBinderUri(binder: WmrContentProviderBinder, ctx: VarContext): string {
  const template = binder.uriFormat ?? binder.uri ?? '';
  if (!template) return '';
  if (!binder.uriParas || !template.includes('%s')) return template;

  const paras = binder.uriParas.split(',').map((expr) => evalStr(expr.trim(), ctx));
  let result = template;
  for (const value of paras) {
    if (!result.includes('%s')) break;
    result = result.replace('%s', encodeURIComponent(String(value ?? '')));
  }
  return result;
}

function queryGenericProviderColumns(
  binder: WmrContentProviderBinder,
  ctx: VarContext,
): Record<string, VarValue | VarValue[]> {
  const uri = resolveBinderUri(binder, ctx);
  if (!uri.startsWith('content://')) return {};

  try {
    const projection = binder.variables.map((variable) => variable.column).filter(Boolean);
    const cursor = ContentResolver.query<Record<string, unknown>>(uri, projection);
    const items = Array.isArray(cursor?.items) ? cursor.items : [];
    if (items.length === 0) return {};

    const columns: Record<string, VarValue | VarValue[]> = {};
    for (const variable of binder.variables) {
      const values = items.map((item) => normalizeProviderValue(item?.[variable.column]));
      columns[variable.column] = variable.type.endsWith('[]')
        ? values
        : (values[0] ?? '');
    }
    return columns;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn(`[WMR] ContentProvider query failed for ${uri}:`, err);
    }
    return {};
  }
}

export function applyBinderData(
  ctx: VarContext,
  binder: WmrContentProviderBinder,
): void {
  const columns = queryGenericProviderColumns(binder, ctx);
  let maxCount = 0;
  for (const variable of binder.variables) {
    const source = columns[variable.column];
    if (source === undefined) continue;

    if (Array.isArray(source)) {
      const arraySource = source as VarValue[];
      maxCount = Math.max(maxCount, source.length);
      if (variable.type.endsWith('[]')) {
        ctx.setArray(variable.name, arraySource);
      } else {
        const row = variable.row ? Math.max(0, parseInt(variable.row, 10) || 0) : 0;
        ctx.set(
          variable.name,
          (arraySource[row] ?? (variable.type.startsWith('int') || variable.type.startsWith('number') ? 0 : '')) as VarValue,
        );
      }
      continue;
    }

    maxCount = Math.max(maxCount, 1);
    if (variable.type.endsWith('[]')) {
      ctx.setArray(variable.name, [source]);
    } else {
      ctx.set(variable.name, source);
    }
  }

  if (binder.countName) {
    ctx.set(binder.countName, maxCount);
  }
}

function walkBinders(nodes: WmrNode[], visit: (binder: WmrContentProviderBinder) => void): void {
  for (const node of nodes) {
    if (node.tag === 'ContentProviderBinder') {
      visit(node);
      continue;
    }
    if ('children' in node && Array.isArray((node as any).children)) {
      walkBinders((node as any).children, visit);
    }
    if ('normalChildren' in node && Array.isArray((node as any).normalChildren)) {
      walkBinders((node as any).normalChildren, visit);
    }
    if ('pressedChildren' in node && Array.isArray((node as any).pressedChildren)) {
      walkBinders((node as any).pressedChildren, visit);
    }
  }
}

// ---------------------------------------------------------------------------
// Ambient injection (registry-driven, per-domain isolation).
// ---------------------------------------------------------------------------

const AMBIENT_DOMAINS: readonly WmrAmbientDomain[] = [
  'weather',
  'device',
  'clock',
  'music',
  'hostFlags',
];

function injectDomain(
  ctx: VarContext,
  domain: WmrAmbientDomain,
): void {
  const adapter = getAmbientAdapter(domain);
  if (!adapter) return; // Silent skip — see ambientAdapters.ts failure modes.
  try {
    const { vars, arrays } = adapter(ctx);
    ctx.setProviderData(vars);
    ctx.setProviderArrayData(arrays);
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn(`[WMR] ambient adapter "${domain}" threw — skipping domain:`, err);
    }
  }
}

export interface InjectProviderDataOptions {
  nodes?: WmrNode[];
  binders?: WmrContentProviderBinder[];
  dependencies?: Partial<WmrProviderDependencies>;
}

/**
 * Resolve all content provider data and inject into VarContext.
 *
 * Ambient pass goes first (domain-keyed adapters via registry), then explicit
 * binders pulled out of the bundle nodes (or the caller-supplied list).
 */
export function injectProviderData(
  ctx: VarContext,
  options: InjectProviderDataOptions = {},
): void {
  const deps: WmrProviderDependencies = {
    weather: options.dependencies?.weather ?? true,
    device: options.dependencies?.device ?? true,
    clock: options.dependencies?.clock ?? true,
    music: options.dependencies?.music ?? true,
    hostFlags: options.dependencies?.hostFlags ?? true,
  };

  for (const domain of AMBIENT_DOMAINS) {
    if (!deps[domain]) continue;
    injectDomain(ctx, domain);
  }

  if (options.binders?.length) {
    for (const binder of options.binders) {
      applyBinderData(ctx, binder);
    }
    return;
  }

  if (options.nodes) {
    walkBinders(options.nodes, (binder) => applyBinderData(ctx, binder));
  }
}

// ---------------------------------------------------------------------------
// WMR host broadcasts — delegated to OS-owned SystemWidgetProvider.
// ---------------------------------------------------------------------------

export function handleWmrHostBroadcast(
  action: string,
  extras?: Record<string, unknown>,
  valueHints?: Record<string, number>,
): boolean {
  return handleSystemWidgetBroadcast(action, extras, valueHints);
}

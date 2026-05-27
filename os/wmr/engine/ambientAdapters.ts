/**
 * Registry for WMR ambient widget data adapters.
 *
 * Background
 * ----------
 * MAML widget bundles reference variables (`weather_temperature`, `battery_level`,
 * `next_alarm_time`, `music_control.title`, `__darkmode`, ...) without
 * declaring an explicit `<ContentProviderBinder>` for them. The WMR engine
 * scans each bundle's expression namespace to figure out which "domains" it
 * needs (`WmrProviderDependencies`) and unconditionally pre-populates those
 * variables before render.
 *
 * Previously the OS-side `contentProviders.ts` hardcoded
 * `getWeatherData() / getClockData() / getMusicData() / getDeviceData() /
 * getWidgetHostFlags()`, which violated the "OS knows nothing about specific
 * apps" rule (`AGENTS.md`, `docs/platform/app/module-contract.md`).
 *
 * This module owns a tiny `domain -> adapter` registry. Each domain's owner
 * (an app for app-bound domains, the OS for `device`/`hostFlags`) registers
 * its adapter as a side-effect on module load. The engine looks up adapters
 * via {@link getAmbientAdapter} and never imports app code directly.
 *
 * Discovery
 * ---------
 * Apps' adapter modules are auto-discovered by the existing
 * `os/ContentResolver.ts:132` glob (`apps/* /providers/*.ts`,
 * `system/* /providers/*.ts`). OS-owned adapters register through
 * `os/providers/bootstrap.ts`. No additional bootstrap is needed here.
 *
 * Failure modes
 * -------------
 * - Adapter not registered for a domain a bundle depends on → engine silently
 *   skips that domain (matches the pre-refactor behavior of returning empty
 *   vars when stores were missing).
 * - Adapter throws → caller wraps each invocation in try/catch and skips the
 *   single domain instead of crashing the whole injection pass. See
 *   `injectProviderData` in `contentProviders.ts`.
 *
 * Locale caching
 * --------------
 * Adapters MUST read locale fresh on every invocation (via
 * `localeApi.getLocale()` inside the adapter body). Do not memoize localized
 * output across calls — `WmrRenderer` re-runs injection on each render tick
 * and on locale change, and adapter output must reflect the current locale.
 */
import type { VarValue } from './types';
import type { VarContext } from './variables';

export type WmrAmbientDomain = 'weather' | 'device' | 'clock' | 'music' | 'hostFlags';

export type WmrAmbientAdapterResult = {
  vars: Record<string, VarValue>;
  arrays: Record<string, VarValue[]>;
};

export type WmrAmbientAdapter = (ctx: VarContext) => WmrAmbientAdapterResult;

const adapters = new Map<WmrAmbientDomain, WmrAmbientAdapter>();

export function registerAmbientAdapter(
  domain: WmrAmbientDomain,
  adapter: WmrAmbientAdapter,
): void {
  adapters.set(domain, adapter);
}

export function getAmbientAdapter(domain: WmrAmbientDomain): WmrAmbientAdapter | undefined {
  return adapters.get(domain);
}

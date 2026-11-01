/**
 * Every app's route table, found the same way the app itself is (by directory),
 * for tooling that needs an app's destinations at runtime: the navigation
 * explorer groups the URLs it visits by route and checks which routes it reached.
 */

import { matchRoutes } from 'react-router-dom';
import PackageManagerService from '../PackageManagerService';
import type { AppRoute } from './routes';

const routeModules = import.meta.glob<{ routes: Record<string, AppRoute> }>(
  ['../../apps/*/routes.ts', '../../system/*/routes.ts'],
);

const loaderByAppId = new Map<string, () => Promise<{ routes: Record<string, AppRoute> }>>();
for (const [path, load] of Object.entries(routeModules)) {
  const m = path.match(/\/(apps|system)\/([^/]+)\/routes\.ts$/);
  const appId = m && PackageManagerService.dirToAppId.get(m[2]);
  if (appId && !loaderByAppId.has(appId)) loaderByAppId.set(appId, load);
}

/** The app's routes in table order, or `null` when it has no route table. */
export async function getRouteTable(appId: string): Promise<AppRoute[] | null> {
  const load = loaderByAppId.get(appId);
  if (!load) return null;
  const { routes } = await load();
  return Object.values(routes).map(r => ({ ...r }));
}

/** Name of the route a pathname renders, matched as the app's `<Routes>` do, or null. */
export async function matchRoute(appId: string, pathname: string): Promise<string | null> {
  const table = await getRouteTable(appId);
  if (!table) return null;
  const matches = matchRoutes(table.map(r => ({ path: r.path, id: r.name })), pathname);
  return matches?.[matches.length - 1]?.route.id ?? null;
}

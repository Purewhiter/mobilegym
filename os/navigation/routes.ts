/**
 * App routes: the destinations an app has (its pages, plus the finite UI states
 * a page keeps in its URL, such as `?dialog=chat`), like the destinations of an
 * Android nav graph. Jumps between them are written in code with `useNav()`;
 * there is no per-button transition table to keep in sync.
 *
 *   export const routes = defineRoutes({
 *     meeting:       { path: '/meeting', search: { dialog: ['chat', 'exit'] } },
 *     historyDetail: { path: '/history/:meetingId' },
 *   });
 *   nav.push(routes.historyDetail, { meetingId });
 *   nav.push(routes.meeting, {}, { search: { dialog: 'chat' } });
 */

/** Finite values a route's query keys can take (`null` in a jump clears a key). */
export type SearchSpec = Readonly<Record<string, readonly string[]>>;

type ParamNames<P extends string> =
  P extends `${string}:${infer Name}/${infer Rest}`
    ? Name | ParamNames<`/${Rest}`>
    : P extends `${string}:${infer Name}`
      ? Name
      : never;

/** Path params of a route path, e.g. `{ meetingId: string | number }` for `/history/:meetingId`. */
export type RouteParams<P extends string> = { [K in ParamNames<P>]: string | number };

/** Query values for a jump: a declared value, `null` (clear), or a free value for undeclared keys. */
export type SearchValues<S extends SearchSpec> = { [K in keyof S]?: S[K][number] | null } & Record<string, string | number | null | undefined>;

export interface AppRoute<P extends string = string, S extends SearchSpec = SearchSpec> {
  /** Key in the app's route table; DOM tags carry it as `nav.<name>`. */
  readonly name: string;
  readonly path: P;
  readonly search: S;
}

type RouteDefs = Record<string, { readonly path: string; readonly search?: SearchSpec }>;

export type RouteTable<T extends RouteDefs> = {
  readonly [K in keyof T]: AppRoute<T[K]['path'], T[K]['search'] extends SearchSpec ? T[K]['search'] : Record<never, never>>;
};

export function defineRoutes<const T extends RouteDefs>(defs: T): RouteTable<T> {
  const table: Record<string, AppRoute> = {};
  for (const [name, def] of Object.entries(defs)) {
    table[name] = { name, path: def.path, search: def.search ?? {} };
  }
  return table as RouteTable<T>;
}

export interface NavTarget {
  /** Query of the target URL. Starts empty: keys not given here (or in `keep`) are dropped. */
  search?: Record<string, string | number | null | undefined>;
  /** Query keys copied from the current URL before `search` applies. */
  keep?: readonly string[];
}

/** The URL a jump lands on: path params filled in, query built from `keep` and `search`. */
export function buildHref(
  route: AppRoute,
  params: Record<string, string | number> = {},
  target: NavTarget = {},
  currentSearch: URLSearchParams = new URLSearchParams(),
): string {
  const pathname = route.path.replace(/:(\w+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing param "${key}" for route "${route.name}" (${route.path})`);
    return String(value);
  });
  const query = new URLSearchParams();
  for (const key of target.keep ?? []) {
    const value = currentSearch.get(key);
    if (value !== null) query.set(key, value);
  }
  for (const [key, value] of Object.entries(target.search ?? {})) {
    if (value === null || value === undefined) query.delete(key);
    else query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

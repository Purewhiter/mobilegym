import { useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { NAVIGATION_DECLARATION, TransitionId } from './navigation.declaration';
import {
  CaseDeclaration,
  Condition,
  FromConstraint,
  Primitive,
  TransitionDeclaration,
  ValueRef,
} from './navigation.types';
import { memoryHistoryPopTo } from '../../os/utils/memoryHistoryPopTo';

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const go = (
    id: TransitionId,
    params: Record<string, string | number> = {},
    options?: { mode?: 'push' | 'replace'; popTo?: string; popToInclusive?: boolean },
  ) => {
    const t = NAVIGATION_DECLARATION.transitions.find(
      transition => transition.id === id,
    ) as TransitionDeclaration | undefined;
    if (!t) {
      throw new Error(`Transition not found: ${id}`);
    }

    if (!matchFrom(t.from, location.pathname, searchParams)) {
      throw new Error(
        `Transition "${id}" not allowed from "${location.pathname}${location.search}"`,
      );
    }

    const chosen = chooseCase(t, { pathname: location.pathname, searchParams, params });
    const effectiveTo = chosen ? chosen.to : t.to;
    const effectiveSearch = chosen ? chosen.search : t.search;
    const effectiveSearchParams = chosen?.searchParams || t.searchParams;

    const targetPathname = replaceParams(effectiveTo, params);

    const newParams = buildSearchParams({
      currentSearchParams: searchParams,
      preserveParams: t.preserveParams || [],
      staticSearch: effectiveSearch,
      dynamicSearchParams: effectiveSearchParams,
      runtimeParams: params,
    });

    const searchStr = newParams.toString();
    const targetUrl = searchStr ? `${targetPathname}?${searchStr}` : targetPathname;

    if (options?.popTo) {
      memoryHistoryPopTo(navigator, options.popTo, { inclusive: options.popToInclusive });
    }
    const mode = options?.mode ?? t.mode;
    navigate(targetUrl, mode === 'replace' ? { replace: true } : undefined);
  };

  const back = (steps: number = 1) => {
    navigate(-steps);
  };

  return { go, back };
}

function matchFrom(
  from: TransitionDeclaration['from'],
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (from === '*') return true;
  const constraints = Array.isArray(from) ? from : [from];

  return constraints.some(constraint => {
    if (constraint === '*') return true;
    if (typeof constraint === 'string') {
      return matchRoute(constraint, pathname);
    }

    if (!matchRoute(constraint.path, pathname)) {
      return false;
    }

    if (constraint.search) {
      for (const [key, expected] of Object.entries(constraint.search)) {
        const actual = searchParams.get(key);

        if (expected === '*') {
          if (!actual) return false;
        } else if (expected === null) {
          if (actual !== null) return false;
        } else if (actual !== expected) {
          return false;
        }
      }
    }

    return true;
  });
}

function buildSearchParams(options: {
  currentSearchParams: URLSearchParams;
  preserveParams: string[];
  staticSearch: Record<string, string | null>;
  dynamicSearchParams: Record<string, 'string' | 'number'>;
  runtimeParams: Record<string, string | number>;
}): URLSearchParams {
  const { currentSearchParams, preserveParams, staticSearch, dynamicSearchParams, runtimeParams } =
    options;

  const newParams = new URLSearchParams();

  for (const key of preserveParams) {
    const value = currentSearchParams.get(key);
    if (value !== null) {
      newParams.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(staticSearch)) {
    if (value === null) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  }

  for (const key of Object.keys(dynamicSearchParams)) {
    const value = runtimeParams[key];
    if (value !== undefined) {
      newParams.set(key, String(value));
    }
  }

  return newParams;
}

function replaceParams(path: string, params: Record<string, string | number>): string {
  return path.replace(/:(\w+)/g, (_, key) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`Missing param "${key}" for path "${path}"`);
    }
    return String(value);
  });
}

function matchRoute(template: string, path: string): boolean {
  if (template === '*') return true;
  const regex = new RegExp('^' + template.replace(/:\w+/g, '[^/]+') + '$');
  return regex.test(path);
}

function chooseCase(
  t: TransitionDeclaration,
  ctx: { pathname: string; searchParams: URLSearchParams; params: Record<string, string | number> },
): CaseDeclaration | null {
  if (!t.cases || t.cases.length === 0) {
    return null;
  }

  for (const c of t.cases) {
    if (evalCondition(c.when, ctx)) return c;
  }

  throw new Error(
    `Transition "${t.id}" cases has no matching branch. Non-empty cases must end with { when: { op: 'always' } }.`,
  );
}

function evalCondition(
  cond: Condition,
  ctx: { pathname: string; searchParams: URLSearchParams; params: Record<string, string | number> },
): boolean {
  switch (cond.op) {
    case 'always':
      return true;
    case 'and':
      return cond.items.every(item => evalCondition(item, ctx));
    case 'or':
      return cond.items.some(item => evalCondition(item, ctx));
    case 'not':
      return !evalCondition(cond.item, ctx);
    case 'exists': {
      const v = resolveValue(cond.ref, ctx);
      return v !== null && v !== undefined && String(v) !== '';
    }
    case 'eq':
      return resolveValue(cond.left, ctx) === cond.right;
    case 'in': {
      const value = resolveValue(cond.left, ctx);
      return cond.right.includes(value);
    }
    case 'match': {
      const v = resolveValue(cond.left, ctx);
      if (v === null || v === undefined) return false;
      const re = new RegExp(cond.right);
      return re.test(String(v));
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const v = resolveValue(cond.left, ctx);
      const num = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(num)) return false;
      if (cond.op === 'gt') return num > cond.right;
      if (cond.op === 'gte') return num >= cond.right;
      if (cond.op === 'lt') return num < cond.right;
      return num <= cond.right;
    }
    default:
      return false;
  }
}

function resolveValue(
  ref: ValueRef,
  ctx: { pathname: string; searchParams: URLSearchParams; params: Record<string, string | number> },
): Primitive {
  if (ref.ref === 'search') {
    const v = ctx.searchParams.get(ref.key);
    return v === null ? null : v;
  }
  if (ref.ref === 'param') {
    const value = ctx.params[ref.key];
    if (value === undefined) return null;
    return typeof value === 'number' || typeof value === 'boolean' ? value : String(value);
  }
  // appState 未接入，默认返回 null
  return null;
}

export type { TransitionId } from './navigation.declaration';

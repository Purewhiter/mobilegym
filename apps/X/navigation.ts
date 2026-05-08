import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_DECLARATION, TransitionId } from './navigation.declaration';
import type {
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
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const go = useCallback(
    (
      id: TransitionId,
      params: Record<string, string | number> = {},
      options?: { mode?: 'push' | 'replace'; popTo?: string; popToInclusive?: boolean },
    ) => {
      const searchParams = new URLSearchParams(location.search);
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

      const chosen = chooseCase(t, {
        pathname: location.pathname,
        searchParams,
        params,
      });
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
    },
    [navigate, location.pathname, location.search, navigator],
  );

  const back = useCallback(
    (steps: number = 1) => {
      navigate(-steps);
    },
    [navigate],
  );

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

  for (const [k, v] of Object.entries(staticSearch)) {
    if (v === null) {
      newParams.delete(k);
      continue;
    }
    newParams.set(k, v);
  }

  for (const k of Object.keys(dynamicSearchParams)) {
    const val = runtimeParams[k];
    if (val !== undefined) {
      newParams.set(k, String(val));
    }
  }

  return newParams;
}

function replaceParams(template: string, params: Record<string, string | number>): string {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const val = params[key];
    if (val === undefined) {
      throw new Error(`Missing param "${key}" for path "${template}"`);
    }
    return encodeURIComponent(String(val));
  });
}

function matchRoute(pattern: string, pathname: string): boolean {
  if (!pattern.includes(':')) return pattern === pathname;

  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) continue;
    if (p !== v) return false;
  }
  return true;
}

function chooseCase(
  t: TransitionDeclaration,
  ctx: {
    pathname: string;
    searchParams: URLSearchParams;
    params: Record<string, string | number>;
  },
): (CaseDeclaration & { searchParams?: Record<string, 'string' | 'number'> }) | null {
  const cases = t.cases || [];
  for (const c of cases) {
    if (evaluateCondition(c.when, ctx)) {
      return c;
    }
  }
  return null;
}

function evaluateCondition(
  cond: Condition,
  ctx: {
    pathname: string;
    searchParams: URLSearchParams;
    params: Record<string, string | number>;
  },
): boolean {
  switch (cond.op) {
    case 'always':
      return true;
    case 'and':
      return cond.items.every(item => evaluateCondition(item, ctx));
    case 'or':
      return cond.items.some(item => evaluateCondition(item, ctx));
    case 'not':
      return !evaluateCondition(cond.item, ctx);
    case 'exists': {
      const v = resolveValueRef(cond.ref, ctx);
      return v !== null && v !== undefined && String(v).length > 0;
    }
    case 'eq': {
      const left = resolveValueRef(cond.left, ctx);
      return primitiveEquals(left, cond.right);
    }
    case 'in': {
      const left = resolveValueRef(cond.left, ctx);
      return cond.right.some(x => primitiveEquals(left, x));
    }
    case 'match': {
      const left = resolveValueRef(cond.left, ctx);
      if (left === null || left === undefined) return false;
      try {
        return new RegExp(cond.right).test(String(left));
      } catch {
        return false;
      }
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const left = resolveValueRef(cond.left, ctx);
      if (left === null || left === undefined) return false;
      const n = Number(left);
      if (Number.isNaN(n)) return false;
      if (cond.op === 'gt') return n > cond.right;
      if (cond.op === 'gte') return n >= cond.right;
      if (cond.op === 'lt') return n < cond.right;
      return n <= cond.right;
    }
    default:
      return false;
  }
}

function resolveValueRef(
  ref: ValueRef,
  ctx: {
    pathname: string;
    searchParams: URLSearchParams;
    params: Record<string, string | number>;
  },
): Primitive {
  if (ref.ref === 'search') {
    const v = ctx.searchParams.get(ref.key);
    return v === null ? null : v;
  }
  if (ref.ref === 'param') {
    const v = ctx.params[ref.key];
    return v === undefined ? null : (v as any);
  }
  // appState 暂不支持（X 目前不需要 cases 基于 appState 的分支）
  return null;
}

function primitiveEquals(left: Primitive, right: Primitive): boolean {
  // Treat null/undefined equivalently as "absent"
  if (left === null || left === undefined) return right === null;
  return String(left) === String(right);
}

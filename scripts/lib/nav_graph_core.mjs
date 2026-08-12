/**
 * Graph primitive semantics for the navigation toolchain.
 *
 * Node identity (search normalization/serialization, node id construction and
 * resolution incl. the `#missing-route` suffix), from-constraint matching and
 * wildcard expansion, path param helpers, entryPoint declaration
 * normalization, edge typing, and preserveParams application.
 *
 * Extracted from navigation_declaration_analyzer.mjs (pure move, no behavior
 * change). Consumers: nav_schema_graph.mjs, nav_data_expand.mjs, the analyzer
 * CLI.
 */

/**
 * Match from constraint against source node
 */
export function matchFromConstraint(fromConstraint, sourceRoutePath, sourceSearch) {
  if (fromConstraint === '*') return true;

  if (typeof fromConstraint === 'string') {
    return fromConstraint === sourceRoutePath;
  }

  if (typeof fromConstraint === 'object' && fromConstraint.path) {
    if (fromConstraint.path !== sourceRoutePath) return false;

    const constraintSearch = fromConstraint.search ?? {};
    for (const [key, value] of Object.entries(constraintSearch)) {
      if (value === '*') {
        // Wildcard matches any value, but key must exist
        if (!(key in sourceSearch)) return false;
      } else if (value === null) {
        // null means key must NOT exist
        if (key in sourceSearch) return false;
      } else {
        // Exact match
        if (sourceSearch[key] !== value) return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Check if a path contains parameters (e.g., /book/:bookId)
 */
export function pathHasParams(path) {
  return /:(\w+)/.test(path);
}

/**
 * Extract param names from path
 */
export function extractPathParams(path) {
  const matches = path.matchAll(/:(\w+)/g);
  return Array.from(matches).map(m => m[1]);
}

/**
 * Build concrete node ID by replacing :params with values
 */
export function buildConcreteNodeId(schemaId, boundParams, routeParams) {
  let result = schemaId;

  for (const [param, value] of Object.entries(boundParams)) {
    result = result.replace(`:${param}`, value);
  }

  return result;
}

export function normalizeFrom(from) {
  if (Array.isArray(from)) {
    return from;
  }
  return [from];
}

export function fromToString(from) {
  if (from === '*') return '*';
  if (typeof from === 'string') return from;
  let constraint = from.path;
  if (from.search && Object.keys(from.search).length > 0) {
    const parts = Object.entries(from.search)
      .map(([key, value]) => {
        if (value === '*') return `${key}=*`;
        if (value === null) return `!${key}`;
        return `${key}=${value}`;
      })
      .join('&');
    constraint += `?${parts}`;
  }
  return constraint;
}

export function normalizeEntryPointDeclaration(entryPoint) {
  // No legacy compatibility: must be explicit enum string.
  if (typeof entryPoint !== 'string') {
    throw new Error(
      `[NavDeclAnalyzer] Invalid route.entryPoint: expected 'none'|'home'|'deepLink'|'both', got ${String(entryPoint)}`,
    );
  }

  switch (entryPoint) {
    case 'home':
      return { kind: 'home', home: true, deepLink: false };
    case 'deepLink':
      return { kind: 'deepLink', home: false, deepLink: true };
    case 'both':
      return { kind: 'both', home: true, deepLink: true };
    case 'none':
    default:
      return { kind: 'none', home: false, deepLink: false };
  }
}

export function normalizeSearch(search) {
  const normalized = {};
  for (const [key, value] of Object.entries(search)) {
    if (value === null || value === undefined) continue;
    normalized[key] = value;
  }
  return normalized;
}

export function serializeSearch(search) {
  const entries = Object.entries(search).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
}

export function buildNodeId(path, search, queryParams) {
  const parts = [];
  for (const [key, value] of Object.entries(search)) {
    parts.push(`${key}=${value}`);
  }
  // Dynamic query params (queryParams) are represented as placeholders in nodeId for readability,
  // e.g. `/search?q=:q`. They are NOT discrete uiStates, and should not be expanded/enumerated.
  // Keep ordering stable for deterministic outputs.
  for (const key of Object.keys(queryParams ?? {}).sort()) {
    parts.push(`${key}=:${key}`);
  }
  if (parts.length === 0) {
    return path;
  }
  return `${path}?${parts.join('&')}`;
}

export function resolveTargetNodeId(path, search, stateIndex, routeIndex) {
  const searchKey = serializeSearch(search);
  const pathStates = stateIndex.get(path);
  if (pathStates && pathStates.has(searchKey)) {
    return pathStates.get(searchKey);
  }

  const route = routeIndex.get(path);
  if (!route) {
    return `${path}#missing-route`;
  }
  return buildNodeId(path, search, route.queryParams ?? {});
}

export function resolveSourceNodeId(from, stateIndex, routeIndex) {
  if (from === '*') return '*';
  if (typeof from === 'string') {
    return resolveTargetNodeId(from, {}, stateIndex, routeIndex);
  }
  if (Array.isArray(from)) {
    return fromToString(from);
  }

  if (from.search) {
    const hasWildcard = Object.values(from.search).some(value => value === '*');
    if (hasWildcard) {
      return fromToString(from);
    }
  }

  const normalizedSearch = normalizeSearch(from.search ?? {});
  return resolveTargetNodeId(from.path, normalizedSearch, stateIndex, routeIndex);
}

export function isNodeId(value) {
  return typeof value === 'string' && value.startsWith('/');
}

export function expandFromConstraint(from, stateIndex, routeIndex) {
  // Simple string path - no expansion needed
  if (typeof from === 'string') {
    return [from];
  }

  // Check if search contains wildcards
  const search = from.search ?? {};
  const hasWildcard = Object.values(search).some(value => value === '*');
  
  if (!hasWildcard) {
    return [from];
  }

  // Expand wildcards based on route's uiStates
  const route = routeIndex.get(from.path);
  if (!route || !route.uiStates) {
    return [from]; // Can't expand, keep original
  }

  const wildcardKeys = Object.entries(search)
    .filter(([_, value]) => value === '*')
    .map(([key]) => key);

  const matchingStates = route.uiStates.filter(state => {
    const stateSearch = normalizeSearch(state.search ?? {});
    // Must satisfy full constraint semantics:
    // - wildcard keys must exist
    // - null means key must NOT exist
    // - exact values must match
    return (
      wildcardKeys.every(key => key in stateSearch) &&
      matchFromConstraint(from, from.path, stateSearch)
    );
  });

  if (matchingStates.length === 0) {
    return [from]; // No matching states, keep original
  }

  return matchingStates.map(state => ({
    path: from.path,
    // Build an expanded constraint that points to a concrete uiState search.
    // Important: do NOT let uiState search overwrite constraint semantics like { modal: null }.
    search: (() => {
      const stateSearch = { ...(state.search ?? {}) };
      for (const [key, value] of Object.entries(search)) {
        if (value === null) {
          delete stateSearch[key];
        } else if (value !== '*') {
          stateSearch[key] = value;
        }
      }
      return stateSearch;
    })(),
  }));
}

export function extractRoutePath(nodeId) {
  if (!nodeId || typeof nodeId !== 'string') return nodeId;
  const questionIndex = nodeId.indexOf('?');
  return questionIndex >= 0 ? nodeId.substring(0, questionIndex) : nodeId;
}

/**
 * Determine edge type by comparing source/target pathname.
 *
 * - navigation: pathname changes
 * - state: same pathname, only query changes
 *
 * @param {string} source - nodeId or route path
 * @param {string | undefined} target - nodeId or route path
 * @returns {'navigation' | 'state'}
 */
export function determineEdgeType(source, target) {
  if (!target) return 'state';
  return extractRoutePath(source) === extractRoutePath(target) ? 'state' : 'navigation';
}

export function applyPreserveParamsToSearch(baseSearch, preserveParams, sourceNodeSearch) {
  if (!preserveParams || preserveParams.length === 0) return baseSearch;
  const out = { ...(baseSearch ?? {}) };
  for (const k of preserveParams) {
    const v = sourceNodeSearch?.[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Declaration → schema graph builder for the navigation toolchain.
 *
 * - buildGraph: routes × uiStates become nodes (home entry takes uiStates[0]);
 *   transitions expand into edges via two paths (cases branches vs plain),
 *   including searchParams discrete expansion, self-loop keep rules and
 *   preserveParams. Warns on duplicate (source,target,id) triplets to stderr,
 *   then de-duplicates fully identical edges (16-field key).
 * - buildSimplifiedGraph: route-level aggregated companion view (one node per
 *   routePath, action aggregation, cross-route edges merged by transition id).
 *
 * Extracted from navigation_declaration_analyzer.mjs (pure move, no behavior
 * change — edge object key order is JSON output byte order; do not reorder).
 * Consumer: the analyzer CLI.
 */
import {
  normalizeFrom,
  normalizeEntryPointDeclaration,
  normalizeSearch,
  serializeSearch,
  buildNodeId,
  resolveTargetNodeId,
  resolveSourceNodeId,
  isNodeId,
  expandFromConstraint,
  extractRoutePath,
  determineEdgeType,
  applyPreserveParamsToSearch,
} from './nav_graph_core.mjs';

export function buildGraph(declaration) {
  const routeIndex = new Map();
  const stateIndex = new Map(); // path -> Map(searchKey -> nodeId)
  const nodes = [];

  for (const route of declaration.routes) {
    routeIndex.set(route.path, route);
    const entry = normalizeEntryPointDeclaration(route.entryPoint);
    const uiStates =
      route.uiStates && route.uiStates.length > 0
        ? route.uiStates
        : [{ id: 'base', search: {}, description: route.description ?? '' }];

    // Home entry semantics:
    // - Only routes marked as "home" (or "both") contribute a start node.
    // - Default home entry uiState is uiStates[0] (per request).
    let defaultHomeEntryNodeId = null;
    if (entry.home) {
      const candidate = uiStates[0];
      const normalizedSearch = normalizeSearch(candidate?.search ?? {});
      defaultHomeEntryNodeId = buildNodeId(route.path, normalizedSearch, route.queryParams ?? {});
    }

    for (const state of uiStates) {
      const normalizedSearch = normalizeSearch(state.search ?? {});
      const nodeId = buildNodeId(route.path, normalizedSearch, route.queryParams ?? {});
      const searchKey = serializeSearch(normalizedSearch);

      if (!stateIndex.has(route.path)) {
        stateIndex.set(route.path, new Map());
      }
      stateIndex.get(route.path).set(searchKey, nodeId);

      nodes.push({
        id: nodeId,
        routePath: route.path,
        uiStateId: state.id ?? 'base',
        component: route.component,
        // Node-level entryPoint means: this node is the HOME start node.
        entryPoint: Boolean(entry.home) && nodeId === defaultHomeEntryNodeId,
        // Route-level entry semantics for viewer/debugging.
        entry,
        params: route.params ?? {},
        scrollContainers: route.scrollContainers ?? [],
        description: state.description ?? route.description ?? '',
        search: normalizedSearch,
        queryParams: route.queryParams ?? {},
        // v1.0: node-level actions (declaration only; execution is out of scope)
        actions: state.actions ?? [],
        // v0.5: node-level existence condition
        stateCondition: state.stateCondition ?? undefined,
      });
    }
  }

  const edges = [];

  for (const transition of declaration.transitions) {
    const fromItems = normalizeFrom(transition.from);

    if (transition.cases && transition.cases.length > 0) {
      // Expand from constraints with wildcards (same as non-cases path),
      // so { path:'/', search:{ tab:'*' } } becomes concrete "/?tab=recommend" etc,
      // instead of producing a virtual "/?tab=*" node.
      const expandedFromItems = [];
      for (const from of fromItems) {
        const expanded = expandFromConstraint(from, stateIndex, routeIndex);
        expandedFromItems.push(...expanded);
      }

      for (const from of expandedFromItems) {
        const sourceId = resolveSourceNodeId(from, stateIndex, routeIndex);

        for (const caseItem of transition.cases) {
          const effectiveTo = caseItem.to;
          const effectiveSearch = caseItem.search ?? transition.search ?? {};
          const effectiveSearchParams = caseItem.searchParams ?? transition.searchParams ?? {};

          const searchState = normalizeSearch(effectiveSearch);
          const targetRoute = effectiveTo ? routeIndex.get(effectiveTo) : null;
          const routeQueryParams = new Set(Object.keys(targetRoute?.queryParams ?? {}));
          // Only treat searchParams keys as "dynamic discrete" when they are NOT already fixed
          // by static search in this branch. Otherwise we may over-expand to states that override
          // the fixed value (and even create duplicated (source,target,id) edges across cases).
          const discreteSearchParamKeys = Object.keys(effectiveSearchParams ?? {}).filter(k => {
            if (routeQueryParams.has(k)) return false;
            const fixed = (effectiveSearch ?? {})[k];
            return fixed === undefined || fixed === null;
          });
          const hasSearchParams = effectiveTo && discreteSearchParamKeys.length > 0;

          // Expand target based on searchParams (same logic as non-cases path)
          let targetStates = [];
          if (effectiveTo && hasSearchParams) {
            if (targetRoute && targetRoute.uiStates) {
              const staticKeys = Object.keys(effectiveSearch).filter(k => effectiveSearch[k] !== null);
              const expectedKeys = new Set([...staticKeys, ...discreteSearchParamKeys]);
              targetStates = targetRoute.uiStates.filter(state => {
                const stateSearch = state.search ?? {};
                const stateDiscreteKeys = new Set(
                  Object.keys(stateSearch).filter(k => !routeQueryParams.has(k)),
                );
                if (expectedKeys.size !== stateDiscreteKeys.size) return false;
                for (const key of expectedKeys) {
                  if (!stateDiscreteKeys.has(key)) return false;
                }
                return true;
              });
            }
          }

          if (targetStates.length > 0) {
            for (const targetState of targetStates) {
              const targetSearch = normalizeSearch({ ...searchState, ...targetState.search });
              const targetNodeId = resolveTargetNodeId(effectiveTo, targetSearch, stateIndex, routeIndex);
              const type = determineEdgeType(sourceId, targetNodeId);

              // Self-loops: only keep when it's a "new entity" navigation:
              // - mode=push (new history entry)
              // - target pathname has path params (e.g. /video/:bvid)
              if (sourceId === targetNodeId) {
                const mode = transition.mode ?? 'push';
                const targetHasPathParams = /:\w+/.test(effectiveTo);
                const hasSemanticChange = Object.keys(effectiveSearchParams ?? {}).length > 0 || Object.keys(effectiveSearch ?? {}).length > 0;
                if (!(mode === 'push' && targetHasPathParams) && !hasSemanticChange) {
                  continue;
                }
              }

              const baseLabel = transition.label ?? '';
              const stateDesc = targetState.description || '';
              const expandedLabel = stateDesc ? `${baseLabel} → ${stateDesc}` : baseLabel;

              edges.push({
                source: sourceId,
                sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
                target: targetNodeId,
                targetNodeId,
                id: transition.id,
                label: expandedLabel,
                type,
                mode: transition.mode ?? 'push',
                search: targetState.search ?? {},
                searchParams: {},
                params: transition.params ?? {},
                availability: caseItem.availability ?? transition.availability ?? undefined,
                availabilityNote: caseItem.availabilityNote ?? transition.availabilityNote ?? undefined,
                when: caseItem.when ?? null,
                preserveParams: transition.preserveParams ?? [],
                fromConstraint: typeof from === 'object' ? from : undefined,
                uiCondition: transition.ui?.condition ?? undefined,
                uiMeta: transition.ui
                  ? {
                      placement: transition.ui.placement,
                      icon: transition.ui.icon,
                      gesture: transition.ui.gesture,
                    }
                  : undefined,
              });
            }
          } else {
            const sourceNodeObj = nodes.find(n => n.id === sourceId);
            const preserved = applyPreserveParamsToSearch(searchState, transition.preserveParams ?? [], sourceNodeObj?.search ?? {});
            const targetNodeId = resolveTargetNodeId(effectiveTo, normalizeSearch(preserved), stateIndex, routeIndex);
            const type = determineEdgeType(sourceId, targetNodeId);

            // Self-loops: only keep when it's a "new entity" navigation:
            // - mode=push (new history entry)
            // - target pathname has path params (e.g. /video/:bvid)
            if (sourceId === targetNodeId) {
              const mode = transition.mode ?? 'push';
              const targetHasPathParams = /:\w+/.test(effectiveTo);
              const hasSemanticChange = Object.keys(effectiveSearchParams ?? {}).length > 0 || Object.keys(effectiveSearch ?? {}).length > 0;
              if (!(mode === 'push' && targetHasPathParams) && !hasSemanticChange) {
                continue;
              }
            }

            edges.push({
              source: sourceId,
              sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
              target: targetNodeId,
              targetNodeId,
              id: transition.id,
              label: transition.label ?? '',
              type,
              mode: transition.mode ?? 'push',
              search: effectiveSearch,
              searchParams: effectiveSearchParams,
              params: transition.params ?? {},
              availability: caseItem.availability ?? transition.availability ?? undefined,
              availabilityNote: caseItem.availabilityNote ?? transition.availabilityNote ?? undefined,
              when: caseItem.when ?? null,
              preserveParams: transition.preserveParams ?? [],
              fromConstraint: typeof from === 'object' ? from : undefined,
              uiCondition: transition.ui?.condition ?? undefined,
              uiMeta: transition.ui
                ? {
                    placement: transition.ui.placement,
                    icon: transition.ui.icon,
                    gesture: transition.ui.gesture,
                  }
                : undefined,
            });
          }
        }
      }
      continue;
    }

    const searchState = normalizeSearch(transition.search ?? {});
    const target = transition.to;
    const searchParams = transition.searchParams ?? {};
    const targetRouteForParams = target ? routeIndex.get(target) : null;
    const routeQueryParamsForParams = new Set(Object.keys(targetRouteForParams?.queryParams ?? {}));
    const discreteSearchParamKeys = Object.keys(searchParams).filter(k => {
      if (routeQueryParamsForParams.has(k)) return false;
      const fixed = (transition.search ?? {})[k];
      return fixed === undefined || fixed === null;
    });
    const hasSearchParams = target && discreteSearchParamKeys.length > 0;

    // Expand from constraints with wildcards
    const expandedFromItems = [];
    for (const from of fromItems) {
      const expanded = expandFromConstraint(from, stateIndex, routeIndex);
      expandedFromItems.push(...expanded);
    }

    // Expand target based on searchParams for all transitions
    // searchParams means runtime-determined target, expand to show all possibilities
    // 
    // Key insight: We should match uiStates whose discrete param structure matches
    // the expected structure: (search keys where value != null) + (searchParams keys)
    let targetStates = [];
    if (target && hasSearchParams) {
      const targetRoute = targetRouteForParams;
      if (targetRoute && targetRoute.uiStates) {
        // Build expected discrete param structure:
        // 1. Keys from transition.search where value !== null (null means "delete")
        // 2. Keys from searchParams that are NOT queryParams (discrete dynamic)
        const transitionSearch = transition.search ?? {};
        const staticKeys = Object.keys(transitionSearch).filter(k => transitionSearch[k] !== null);
        const expectedKeys = new Set([...staticKeys, ...discreteSearchParamKeys]);
        
        // Also respect queryParams - they are dynamic and shouldn't affect discrete matching
        const routeQueryParams = new Set(Object.keys(targetRoute.queryParams ?? {}));
        
        targetStates = targetRoute.uiStates.filter(state => {
          const stateSearch = state.search ?? {};
          // Get discrete keys (exclude queryParams which are dynamic)
          const stateDiscreteKeys = new Set(
            Object.keys(stateSearch).filter(k => !routeQueryParams.has(k))
          );
          
          // Check if discrete param structure matches exactly
          if (expectedKeys.size !== stateDiscreteKeys.size) return false;
          for (const key of expectedKeys) {
            if (!stateDiscreteKeys.has(key)) return false;
          }
          return true;
        });
      }
    }

    for (const from of expandedFromItems) {
      const sourceId = resolveSourceNodeId(from, stateIndex, routeIndex);
      const sourceNodeObj = nodes.find(n => n.id === sourceId);
      const sourceSearchForPreserve = sourceNodeObj?.search ?? (typeof from === 'object' ? normalizeSearch(from.search ?? {}) : {});
      const effectiveSearchState = normalizeSearch(
        applyPreserveParamsToSearch(searchState, transition.preserveParams ?? [], sourceSearchForPreserve),
      );
      
      if (targetStates.length > 0) {
        // Expand to multiple edges for each target state
        for (const targetState of targetStates) {
          const targetSearch = normalizeSearch({ ...effectiveSearchState, ...targetState.search });
          const targetNodeId = resolveTargetNodeId(target, targetSearch, stateIndex, routeIndex);
          const type = determineEdgeType(sourceId, targetNodeId);
          
          // Self-loops (source node === target node):
          //
          // A route-state edge should represent a meaningful change in the discrete URL state.
          // However, schema graphs use pathname templates (e.g. /video/:bvid), so a "new entity"
          // navigation like /video/BV1 -> /video/BV2 becomes a self-loop in schema mode.
          //
          // Rule:
          // - If the discrete search state does NOT change (noop), drop the edge.
          // - EXCEPT: keep when mode=push AND target pathname has path params (treat as "new entity").
          if (sourceId === targetNodeId) {
            const mode = transition.mode ?? 'push';
            const targetHasPathParams = /:\w+/.test(target);

            const sourceSearch = normalizeSearch(sourceNodeObj?.search ?? {});
            const isNoopSearch =
              serializeSearch(sourceSearch) === serializeSearch(normalizeSearch(targetSearch));

            if (isNoopSearch && !(mode === 'push' && targetHasPathParams)) {
              continue;
            }
          }
          
          // Build label with target state description
          const baseLabel = transition.label ?? '';
          const stateDesc = targetState.description || '';
          const expandedLabel = stateDesc 
            ? `${baseLabel} → ${stateDesc}`
            : baseLabel;
          
          edges.push({
            source: sourceId,
            sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
            target: targetNodeId,
            targetNodeId,
            id: transition.id,
            label: expandedLabel,
            type,
            mode: transition.mode ?? 'push',
            search: targetState.search ?? {},
            searchParams: {},
            params: transition.params ?? {},
            availability: transition.availability ?? undefined,
            availabilityNote: transition.availabilityNote ?? undefined,
            preserveParams: transition.preserveParams ?? [],
            fromConstraint: typeof from === 'object' ? from : undefined,
            expandedFrom: 'searchParams',
            uiCondition: transition.ui?.condition ?? undefined,
            uiMeta: transition.ui
              ? {
                  placement: transition.ui.placement,
                  icon: transition.ui.icon,
                  gesture: transition.ui.gesture,
                }
              : undefined,
          });
        }
      } else {
        const targetNodeId = target
          ? resolveTargetNodeId(target, effectiveSearchState, stateIndex, routeIndex)
          : undefined;
        const type = determineEdgeType(sourceId, targetNodeId || sourceId);
        
        // Self-loops (source node === target node):
        //
        // Same semantics as the branch above (targetStates expansion):
        // - Drop noop self-loops (sourceId === targetNodeId).
        // - EXCEPT: keep when mode=push AND target pathname has path params (treat as "new entity").
        if (sourceId === targetNodeId) {
          const mode = transition.mode ?? 'push';
          const targetHasPathParams = /:\w+/.test(target);
          if (!(mode === 'push' && targetHasPathParams)) {
            continue;
          }
        }
        
        edges.push({
          source: sourceId,
          sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
          target: targetNodeId || sourceId,
          targetNodeId,
          id: transition.id,
          label: transition.label ?? '',
          type,
          mode: transition.mode ?? 'push',
          search: transition.search ?? {},
          searchParams: transition.searchParams ?? {},
          params: transition.params ?? {},
          availability: transition.availability ?? undefined,
          availabilityNote: transition.availabilityNote ?? undefined,
          preserveParams: transition.preserveParams ?? [],
          fromConstraint: typeof from === 'object' ? from : undefined,
          uiCondition: transition.ui?.condition ?? undefined,
          uiMeta: transition.ui
            ? {
                placement: transition.ui.placement,
                icon: transition.ui.icon,
                gesture: transition.ui.gesture,
              }
            : undefined,
        });
      }
    }
  }

  // Warn on duplicate edges (same source + target + transitionId).
  // In a correct declaration+analyzer, these should not exist; duplicates inflate edgeCount
  // and can indicate overlapping from-constraints or buggy wildcard/searchParams expansion.
  const tripletCounts = new Map();
  for (const e of edges) {
    const k = `${e.source}→${e.target}#${e.id}`;
    tripletCounts.set(k, (tripletCounts.get(k) ?? 0) + 1);
  }
  const dupTriplets = [...tripletCounts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);
  if (dupTriplets.length > 0) {
    const maxMult = dupTriplets[0][1];
    console.warn(
      `[NavDeclAnalyzer] WARN: duplicate edges detected ` +
        `(${dupTriplets.length} duplicate triplets, max multiplicity ${maxMult}). ` +
        `Showing up to 20:`,
    );
    for (const [k, c] of dupTriplets.slice(0, 20)) {
      const [srcTo, id] = k.split('#');
      console.warn(`  ${c}x ${id} ${srcTo}`);
    }
    if (dupTriplets.length > 20) {
      console.warn(`  ... (${dupTriplets.length - 20} more)`);
    }
  }

  // De-duplicate *identical* edges.
  // Why: overlapping from-constraints / wildcard expansion can cause the exact same
  // (source,target,id,metadata...) edge to be emitted multiple times, which inflates
  // edgeCount without adding semantic reachability.
  const seen = new Set();
  const dedupedEdges = [];
  for (const e of edges) {
    const key = [
      e.source,
      e.target,
      e.id,
      e.mode ?? '',
      e.label ?? '',
      JSON.stringify(e.when ?? null),
      JSON.stringify(e.fromConstraint ?? null),
      JSON.stringify(e.search ?? null),
      JSON.stringify(e.searchParams ?? null),
      JSON.stringify(e.params ?? null),
      JSON.stringify(e.preserveParams ?? null),
      JSON.stringify(e.uiCondition ?? null),
      JSON.stringify(e.uiMeta ?? null),
      JSON.stringify(e.availability ?? null),
      JSON.stringify(e.availabilityNote ?? null),
      JSON.stringify(e.expandedFrom ?? null),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedEdges.push(e);
  }

  return { nodes, edges: dedupedEdges };
}

export function buildSimplifiedGraph(graph) {
  // Build simplified nodes (one per route path)
  const routeNodes = new Map();
  for (const node of graph.nodes) {
    if (!routeNodes.has(node.routePath)) {
      routeNodes.set(node.routePath, {
        id: node.routePath,
        routePath: node.routePath,
        component: node.component,
        entryPoint: Boolean(node.entryPoint),
        entry: node.entry ?? undefined,
        description: node.description,
        stateCount: 0,
        states: [],
        // actions aggregated across uiStates
        actionCount: 0,
        actionIds: [],
        actions: [],
      });
    }
    const routeNode = routeNodes.get(node.routePath);
    if (node.entryPoint) routeNode.entryPoint = true;
    if (!routeNode.entry && node.entry) routeNode.entry = node.entry;
    routeNode.stateCount++;
    routeNode.states.push(node.id);

    // Aggregate actions for simplified view
    const actions = Array.isArray(node.actions) ? node.actions : [];
    if (actions.length > 0) {
      const seen = routeNode.__actionIdSet ?? (routeNode.__actionIdSet = new Set());
      for (const a of actions) {
        const id = a?.id;
        if (!id || typeof id !== 'string') continue;
        if (seen.has(id)) continue;
        seen.add(id);
        routeNode.actionIds.push(id);
        routeNode.actions.push(a);
      }
      routeNode.actionCount = routeNode.actionIds.length;
    }
  }

  // Build simplified edges (deduplicated by source route -> target route)
  const edgeMap = new Map();
  for (const edge of graph.edges) {
    const sourceRoute = extractRoutePath(edge.source);
    const targetRoute = extractRoutePath(edge.target);
    
    // Skip internal edges (same route)
    if (sourceRoute === targetRoute) continue;
    
    const edgeKey = `${sourceRoute}|${targetRoute}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, {
        source: sourceRoute,
        target: targetRoute,
        transitions: [],
        type: 'navigation',
      });
    }
    const simplifiedEdge = edgeMap.get(edgeKey);
    if (!simplifiedEdge.transitions.includes(edge.id)) {
      simplifiedEdge.transitions.push(edge.id);
    }
  }

  // Add label to each edge (join transitions)
  for (const edge of edgeMap.values()) {
    edge.label = edge.transitions.join(', ');
    edge.id = edge.transitions[0] || 'edge';
  }

  return {
    nodes: Array.from(routeNodes.values()).map(n => {
      // remove internal helper
      if (n.__actionIdSet) delete n.__actionIdSet;
      return n;
    }),
    edges: Array.from(edgeMap.values()),
  };
}

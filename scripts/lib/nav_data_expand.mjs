/**
 * Data-mode graph expansion for the navigation toolchain.
 *
 * expandEdgesWithData runs a two-pass strategy over schema edges: pass 0
 * expands static dataSource refs and keeps unparameterized edges, pass 1
 * expands parameterized refs against concrete source nodes' boundParams
 * (dataSource / param inheritance), then drops orphan parameterized schema
 * nodes. All mutable state is function-local (edgeKeySet / expandedNodes /
 * inner closures) — the module is stateless.
 *
 * Extracted from navigation_declaration_analyzer.mjs (pure move, no behavior
 * change — edge/node object key order is JSON output byte order). Consumer:
 * the analyzer CLI.
 */
import { resolveRefData, refNeedsParams, applyFilterFn } from './nav_ref_resolver.mjs';
import { evaluateCondition } from './nav_condition_eval.mjs';
import {
  matchFromConstraint,
  pathHasParams,
  extractPathParams,
  buildConcreteNodeId,
  normalizeSearch,
  serializeSearch,
  extractRoutePath,
} from './nav_graph_core.mjs';

/**
 * Find matching dataSource for a source node
 */
export function findMatchingDataSource(dataSources, sourceRoutePath, sourceSearch) {
  if (!dataSources) return null;

  const sources = Array.isArray(dataSources) ? dataSources : [dataSources];

  // Find first matching source (priority by specificity)
  for (const ds of sources) {
    const fromConstraint = ds.from ?? '*';
    if (matchFromConstraint(fromConstraint, sourceRoutePath, sourceSearch)) {
      return ds;
    }
  }

  return null;
}

/**
 * Expand edges using dataSource - Complete rewrite
 * 
 * Strategy:
 * 1. For edges with dataSource: expand target params from data
 * 2. For edges where target inherits source params: expand source first, then propagate
 * 3. Keep schema edges that don't need expansion
 */
export function expandEdgesWithData(schemaEdges, nodes, data, routeIndex, declaration, dataLimit = 10) {
  const expandedEdges = [];
  const expandedNodes = new Map(); // nodeId -> node

  // Add all schema nodes first (but mark parameterized ones)
  for (const node of nodes) {
    expandedNodes.set(node.id, node);
  }

  const edgeKeySet = new Set();
  const pushEdgeOnce = (edge) => {
    const key = `${edge.id}@@${edge.source}@@${edge.target}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    expandedEdges.push(edge);
  };

  // Build a map of transition ID to full transition definition
  const transitionMap = new Map();
  for (const t of declaration.transitions) {
    transitionMap.set(t.id, t);
  }

  const searchKeyOf = (searchObj) => serializeSearch(normalizeSearch(searchObj ?? {}));

  function shouldKeepEdgeByUiCondition(condition, sourceNode, binding) {
    if (!condition || !data) return { keep: true, evaluable: false };

    // Prefer explicit binding values (edge-level), fallback to source node boundParams.
    const boundParams = {};
    if (binding) {
      for (const [k, v] of Object.entries(binding)) {
        boundParams[k] = String(v?.value);
      }
    }
    if (sourceNode?.boundParams) {
      for (const [k, v] of Object.entries(sourceNode.boundParams)) {
        if (boundParams[k] === undefined) boundParams[k] = String(v);
      }
    }

    const { satisfied, evaluable } = evaluateCondition(condition, { boundParams, data });
    if (evaluable && !satisfied) return { keep: false, evaluable: true };
    return { keep: true, evaluable };
  }

  function addConcreteTargetNode(targetId, targetSchemaId, boundParams, expandedFrom) {
    if (expandedNodes.has(targetId)) return;
    // Prefer the exact schema node (uiState) when possible; fall back to routePath match.
    const targetRoutePath = extractRoutePath(targetSchemaId);
    const targetSchemaNode =
      nodes.find(n => n.id === targetSchemaId) ??
      nodes.find(n => n.routePath === targetRoutePath);
    if (!targetSchemaNode) return;
    expandedNodes.set(targetId, {
      ...targetSchemaNode,
      id: targetId,
      boundParams: { ...boundParams },
      expandedFrom,
    });
  }

  function addDataSourceEdges(edge, sourceNode, sourceRoutePath, targetRoutePath, ds, sourceBindingHint) {
    let refData = resolveRefData(ds.ref, sourceBindingHint ?? {}, data);

    if (!refData || (Array.isArray(refData) && refData.length === 0)) {
      return false;
    }

    if (ds.filterFn && Array.isArray(refData)) {
      refData = applyFilterFn(refData, ds.filterFn, data);
      if (refData.length === 0) {
        return false;
      }
    }

    const paramMapping = ds.paramMapping ?? {};
    const usesKeyExpansion = Object.values(paramMapping).some(v => v === '$key');

    const itemsRaw = (() => {
      if (Array.isArray(refData)) return refData;
      // If refData is an object and the mapping asks for '$key', expand object entries deterministically.
      if (usesKeyExpansion && refData && typeof refData === 'object') {
        return Object.keys(refData)
          .sort()
          .map(k => ({ $key: k, $value: refData[k] }));
      }
      return [refData];
    })();
    const items =
      typeof dataLimit === 'number' && dataLimit > 0 ? itemsRaw.slice(0, dataLimit) : itemsRaw;
    let addedAny = false;

    for (const item of items) {
      const targetBoundParams = {};
      for (const [targetParam, sourceField] of Object.entries(paramMapping)) {
        if (sourceField === '$value') {
          // Special-case: object-key expansion creates { $key, $value } items.
          targetBoundParams[targetParam] = String(item && typeof item === 'object' && '$value' in item ? item.$value : item);
        } else if (sourceField === '$key') {
          targetBoundParams[targetParam] = String(item && typeof item === 'object' && '$key' in item ? item.$key : '');
        } else if (item && item[sourceField] !== undefined) {
          targetBoundParams[targetParam] = String(item[sourceField]);
        }
      }

      // Build concrete target from to-path params
      const concreteTarget = buildConcreteNodeId(edge.target, targetBoundParams, {});

      // Build binding: include inherited params from sourceBindingHint (if any),
      // and dataSource params for the target.
      const binding = {
        ...(sourceBindingHint
          ? Object.fromEntries(
              Object.entries(sourceBindingHint).map(([k, v]) => [k, { source: 'inherited', value: String(v) }]),
            )
          : {}),
        ...Object.fromEntries(
          Object.entries(targetBoundParams).map(([k, v]) => [k, { source: 'dataSource', value: v }]),
        ),
      };

      const uiCond = edge.uiCondition;
      const { keep } = shouldKeepEdgeByUiCondition(uiCond, sourceNode, binding);
      if (!keep) {
        continue;
      }

      pushEdgeOnce({
        ...edge,
        source: sourceNode.id,
        sourceNodeId: sourceNode.id,
        target: concreteTarget,
        targetNodeId: concreteTarget,
        binding,
        expandedFrom: 'dataSource',
        dataSourceRef: ds.ref,
      });

      addConcreteTargetNode(concreteTarget, edge.target, targetBoundParams, 'dataSource');
      addedAny = true;
    }

    return addedAny;
  }

  // Two-pass strategy:
  // - Pass 0: expand static dataSource refs (no {param}) + inherited edges
  // - Pass 1: expand parameterized dataSource refs using concrete source nodes' boundParams
  for (let pass = 0; pass < 2; pass++) {
    for (const edge of schemaEdges) {
      const transition = transitionMap.get(edge.id);
      const sourceNode = nodes.find(n => n.id === edge.source);

      if (!sourceNode) {
        if (pass === 0) pushEdgeOnce(edge);
        continue;
      }

      const sourceRoutePath = sourceNode.routePath;
      const targetRoutePath = extractRoutePath(edge.target);
      const sourceHasParams = pathHasParams(sourceRoutePath);
      const targetHasParams = pathHasParams(targetRoutePath);

      // Case 1: No params in source or target - keep as is (only once)
      if (!sourceHasParams && !targetHasParams) {
        if (pass === 0) pushEdgeOnce(edge);
        continue;
      }

      // Case 2: Target has params, need dataSource to expand
      if (targetHasParams && transition?.dataSource) {
        const ds = findMatchingDataSource(
          transition.dataSource,
          sourceRoutePath,
          sourceNode.search ?? {},
        );

        if (ds) {
          const needsParams = refNeedsParams(ds.ref);

          // Pass 0: static refs only
          if (pass === 0 && !needsParams) {
            // Special-case: allow source also to be concrete if it shares params with target mapping
            // (existing behavior preserved)
            let refData = resolveRefData(ds.ref, {}, data);
            if (!refData || (Array.isArray(refData) && refData.length === 0)) {
              continue;
            }
            if (ds.filterFn && Array.isArray(refData)) {
              refData = applyFilterFn(refData, ds.filterFn, data);
              if (refData.length === 0) continue;
            }

            const paramMapping = ds.paramMapping ?? {};
            const usesKeyExpansion = Object.values(paramMapping).some(v => v === '$key');

            const itemsRaw = (() => {
              if (Array.isArray(refData)) return refData;
              if (usesKeyExpansion && refData && typeof refData === 'object') {
                return Object.keys(refData)
                  .sort()
                  .map(k => ({ $key: k, $value: refData[k] }));
              }
              return [refData];
            })();
            const items =
              typeof dataLimit === 'number' && dataLimit > 0
                ? itemsRaw.slice(0, dataLimit)
                : itemsRaw;

            for (const item of items) {
              const boundParams = {};
              for (const [targetParam, sourceField] of Object.entries(paramMapping)) {
                if (sourceField === '$value') {
                  boundParams[targetParam] = String(item && typeof item === 'object' && '$value' in item ? item.$value : item);
                } else if (sourceField === '$key') {
                  boundParams[targetParam] = String(item && typeof item === 'object' && '$key' in item ? item.$key : '');
                } else if (item[sourceField] !== undefined) {
                  boundParams[targetParam] = String(item[sourceField]);
                }
              }

              const concreteTarget = buildConcreteNodeId(edge.target, boundParams, {});

              let concreteSourceId = edge.source;
              if (sourceHasParams) {
                const sourceParams = extractPathParams(sourceRoutePath);
                const canExpandSource = sourceParams.every(p => boundParams[p] !== undefined);
                if (canExpandSource) {
                  concreteSourceId = buildConcreteNodeId(edge.source, boundParams, {});
                  if (!expandedNodes.has(concreteSourceId)) {
                    expandedNodes.set(concreteSourceId, {
                      ...sourceNode,
                      id: concreteSourceId,
                      boundParams: { ...boundParams },
                      expandedFrom: 'dataSource',
                    });
                  }
                }
              }

              const binding = Object.fromEntries(
                Object.entries(boundParams).map(([k, v]) => [k, { source: 'dataSource', value: v }]),
              );

              const uiCond = edge.uiCondition;
              const sourceForCond = expandedNodes.get(concreteSourceId) ?? sourceNode;
              const { keep } = shouldKeepEdgeByUiCondition(uiCond, sourceForCond, binding);
              if (!keep) {
                continue;
              }

              pushEdgeOnce({
                ...edge,
                source: concreteSourceId,
                sourceNodeId: concreteSourceId,
                target: concreteTarget,
                targetNodeId: concreteTarget,
                binding,
                expandedFrom: 'dataSource',
                dataSourceRef: ds.ref,
              });

              addConcreteTargetNode(concreteTarget, edge.target, boundParams, 'dataSource');
            }
            continue;
          }

          // Pass 1: parameterized refs (use concrete sources' boundParams)
          if (pass === 1 && needsParams) {
            const wantedSearchKey = searchKeyOf(sourceNode.search);
            const concreteSources = Array.from(expandedNodes.values()).filter(n =>
              n.routePath === sourceRoutePath &&
              n.boundParams &&
              searchKeyOf(n.search) === wantedSearchKey,
            );

            if (concreteSources.length === 0) {
              continue;
            }

            let expandedAny = false;
            for (const concreteSource of concreteSources) {
              const ok = addDataSourceEdges(
                edge,
                concreteSource,
                sourceRoutePath,
                targetRoutePath,
                ds,
                concreteSource.boundParams,
              );
              if (ok) expandedAny = true;
            }

            if (expandedAny) {
              continue;
            }
          }
        }
      }

      // Case 3: Source has params that target inherits (e.g., /book/:bookId -> /read/:bookId)
      if (sourceHasParams && targetHasParams) {
        const sourceParams = extractPathParams(sourceRoutePath);
        const targetParams = extractPathParams(targetRoutePath);
        const allInherited = targetParams.every(p => sourceParams.includes(p));

        if (allInherited) {
          const wantedSearchKey = searchKeyOf(sourceNode.search);
          const concreteSourceNodes = Array.from(expandedNodes.values()).filter(n =>
            n.routePath === sourceRoutePath && n.boundParams && searchKeyOf(n.search) === wantedSearchKey,
          );

          if (concreteSourceNodes.length > 0) {
            for (const concreteSource of concreteSourceNodes) {
              const boundParams = concreteSource.boundParams;
              const concreteTarget = buildConcreteNodeId(edge.target, boundParams, {});

              const binding = Object.fromEntries(
                Object.entries(boundParams).map(([k, v]) => [k, { source: 'inherited', value: v }]),
              );

              const uiCond = edge.uiCondition;
              const { keep } = shouldKeepEdgeByUiCondition(uiCond, concreteSource, binding);
              if (!keep) {
                continue;
              }

              pushEdgeOnce({
                ...edge,
                source: concreteSource.id,
                sourceNodeId: concreteSource.id,
                target: concreteTarget,
                targetNodeId: concreteTarget,
                binding,
                expandedFrom: 'inherited',
              });

              addConcreteTargetNode(concreteTarget, edge.target, boundParams, 'inherited');
            }
            continue;
          }
        }
      }

      // Case 3b: Source has params, target has NO params.
      // Expand edge to each concrete source node (so we don't keep a dangling "/:id" schema source).
      if (sourceHasParams && !targetHasParams) {
        const wantedSearchKey = searchKeyOf(sourceNode.search);
        const concreteSourceNodes = Array.from(expandedNodes.values()).filter(n =>
          n.routePath === sourceRoutePath && n.boundParams && searchKeyOf(n.search) === wantedSearchKey,
        );

        if (concreteSourceNodes.length > 0) {
          for (const concreteSource of concreteSourceNodes) {
            const boundParams = concreteSource.boundParams ?? {};
            const binding = Object.fromEntries(
              Object.entries(boundParams).map(([k, v]) => [k, { source: 'inherited', value: String(v) }]),
            );

            const uiCond = edge.uiCondition;
            const { keep } = shouldKeepEdgeByUiCondition(uiCond, concreteSource, binding);
            if (!keep) continue;

            pushEdgeOnce({
              ...edge,
              source: concreteSource.id,
              sourceNodeId: concreteSource.id,
              binding,
              expandedFrom: 'inherited',
            });
          }
          continue;
        }
      }

      // Case 4: Cannot expand
      if (pass === 0) {
        // Data mode: if an edge involves parameterized source/target but cannot be expanded to
        // concrete nodes, skip it (to avoid dangling "/:id" schema islands in data graphs).
        continue;
      }
    }
  }

  // Remove orphan schema nodes (parameterized nodes without concrete instances)
  const referencedNodeIds = new Set();
  for (const edge of expandedEdges) {
    referencedNodeIds.add(edge.source);
    referencedNodeIds.add(edge.target);
  }

  // Keep nodes that are: entry points, referenced by edges, or non-parameterized
  const finalNodes = Array.from(expandedNodes.values()).filter(node => {
    if (node.entryPoint) return true;
    if (referencedNodeIds.has(node.id)) return true;
    if (!pathHasParams(node.routePath)) return true;
    return false;
  });

  return {
    nodes: finalNodes,
    edges: expandedEdges,
  };
}

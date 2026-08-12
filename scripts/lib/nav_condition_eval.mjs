/**
 * Condition evaluation DSL (v0.5/v0.8) for the navigation toolchain.
 *
 * `evaluateCondition` supports 12 ops (always/and/or/not/notEmpty/memberOf/
 * eq/equals/notEquals/empty/paramEq/paramNeq) and returns a tri-state
 * `{ satisfied, evaluable, reason? }`: `evaluable: false` means the condition
 * could not be decided against the given data/params — callers must treat it
 * as "keep, but mark unevaluable" rather than pruning.
 *
 * Extracted from navigation_declaration_analyzer.mjs (pure move, no behavior
 * change). Consumers: nav_graph_prune.mjs, nav_data_expand.mjs.
 */
import { resolveRefData, applyFilterFn } from './nav_ref_resolver.mjs';

export function evaluateCondition(condition, context) {
  const boundParams = context?.boundParams ?? {};
  const data = context?.data;

  if (!condition || !data) {
    return { satisfied: true, evaluable: false, reason: 'missing condition or data' };
  }

  // Composite ops (v0.8)
  if (condition.op === 'always') {
    return { satisfied: true, evaluable: true };
  }

  if (condition.op === 'and') {
    if (!Array.isArray(condition.items) || condition.items.length === 0) {
      return { satisfied: true, evaluable: false, reason: 'and.items missing/empty' };
    }
    let hasUnevaluable = false;
    for (const item of condition.items) {
      const r = evaluateCondition(item, { boundParams, data });
      if (r.evaluable && !r.satisfied) return { satisfied: false, evaluable: true };
      if (!r.evaluable) hasUnevaluable = true;
    }
    if (hasUnevaluable) return { satisfied: true, evaluable: false, reason: 'and has unevaluable items' };
    return { satisfied: true, evaluable: true };
  }

  if (condition.op === 'or') {
    if (!Array.isArray(condition.items) || condition.items.length === 0) {
      return { satisfied: true, evaluable: false, reason: 'or.items missing/empty' };
    }
    let hasUnevaluable = false;
    let anyEvaluable = false;
    for (const item of condition.items) {
      const r = evaluateCondition(item, { boundParams, data });
      if (r.evaluable) anyEvaluable = true;
      if (r.evaluable && r.satisfied) return { satisfied: true, evaluable: true };
      if (!r.evaluable) hasUnevaluable = true;
    }
    if (anyEvaluable && !hasUnevaluable) {
      // all evaluable and none satisfied
      return { satisfied: false, evaluable: true };
    }
    return { satisfied: true, evaluable: false, reason: 'or has unevaluable items' };
  }

  if (condition.op === 'not') {
    if (!condition.item) {
      return { satisfied: true, evaluable: false, reason: 'not.item missing' };
    }
    const r = evaluateCondition(condition.item, { boundParams, data });
    if (!r.evaluable) return { satisfied: true, evaluable: false, reason: 'not has unevaluable item' };
    return { satisfied: !r.satisfied, evaluable: true };
  }

  // Existing ops (v0.5)
  if (condition.op === 'notEmpty') {
    let items = resolveRefData(condition.ref, boundParams, data);
    if (!Array.isArray(items)) {
      return { satisfied: false, evaluable: true, reason: 'ref is not array' };
    }
    if (condition.filterFn) {
      items = applyFilterFn(items, condition.filterFn, data);
    }
    return { satisfied: items.length > 0, evaluable: true };
  }

  if (condition.op === 'memberOf') {
    if (!condition.param) {
      return { satisfied: false, evaluable: false, reason: 'missing param' };
    }
    const paramValue = boundParams[condition.param];
    if (paramValue === undefined) {
      return { satisfied: false, evaluable: false, reason: `param ${condition.param} not bound` };
    }

    let collection = resolveRefData(condition.ref, boundParams, data);
    if (!Array.isArray(collection)) {
      return { satisfied: false, evaluable: false, reason: 'ref is not array' };
    }
    if (condition.filterFn) {
      collection = applyFilterFn(collection, condition.filterFn, data);
    }

    const field = condition.field ?? '$value';

    const inSet = collection.some(item =>
      field === '$value' ? String(item) === String(paramValue) : String(item?.[field]) === String(paramValue),
    );
    return { satisfied: inSet, evaluable: true };
  }

  if (condition.op === 'eq') {
    if (!('equals' in condition)) {
      return { satisfied: false, evaluable: false, reason: 'missing equals' };
    }
    const value = resolveRefData(condition.ref, boundParams, data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value === condition.equals, evaluable: true };
  }

  // TencentMeeting legacy ops support (compat)
  if (condition.op === 'equals') {
    if (!('value' in condition)) {
      return { satisfied: false, evaluable: false, reason: 'missing value' };
    }
    const value = resolveRefData(condition.ref, boundParams, data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value === condition.value, evaluable: true };
  }

  if (condition.op === 'notEquals') {
    if (!('value' in condition)) {
      return { satisfied: false, evaluable: false, reason: 'missing value' };
    }
    const value = resolveRefData(condition.ref, boundParams, data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value !== condition.value, evaluable: true };
  }

  if (condition.op === 'empty') {
    const value = resolveRefData(condition.ref, boundParams, data);
    if (!Array.isArray(value)) {
      return { satisfied: false, evaluable: true, reason: 'ref is not array' };
    }
    return { satisfied: value.length === 0, evaluable: true };
  }

  // Param vs data ref comparison (v0.8)
  if (condition.op === 'paramEq' || condition.op === 'paramNeq') {
    if (!condition.param) {
      return { satisfied: false, evaluable: false, reason: 'missing param' };
    }
    const paramValue = boundParams[condition.param];
    if (paramValue === undefined) {
      return { satisfied: false, evaluable: false, reason: `param ${condition.param} not bound` };
    }

    const refValue = resolveRefData(condition.ref, boundParams, data);
    if (refValue === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    if (refValue !== null && typeof refValue === 'object') {
      return { satisfied: true, evaluable: false, reason: 'ref is not primitive' };
    }

    const eq = String(paramValue) === String(refValue);
    return { satisfied: condition.op === 'paramEq' ? eq : !eq, evaluable: true };
  }

  return { satisfied: true, evaluable: false, reason: `unknown op: ${condition.op}` };
}

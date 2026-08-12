/**
 * dataSource ref path DSL for the navigation toolchain.
 *
 * Parses ref strings like `users[id={userId}].recentBooks` into tokens and
 * resolves them against a data config object, supporting four token kinds:
 * parameterized lookup `[field={param}]`, static filter `[field=value]` /
 * `[field!=value]`, object index `{param}`, and plain field access.
 * Also hosts the `filterFn` dynamic evaluator (new Function; errors keep the
 * item — conservative).
 *
 * Extracted from navigation_declaration_analyzer.mjs (pure move, no behavior
 * change). Consumers: nav_condition_eval.mjs, nav_data_expand.mjs, the
 * analyzer CLI.
 */

/**
 * Parse ref string into tokens
 * e.g., 'users[id={userId}].recentBooks' → ['users', '[id={userId}]', 'recentBooks']
 */
export function parseRefTokens(ref) {
  const tokens = [];
  let current = '';
  let inBracket = false;

  for (const char of ref) {
    if (char === '[') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      inBracket = true;
      current = '[';
    } else if (char === ']') {
      current += ']';
      tokens.push(current);
      current = '';
      inBracket = false;
    } else if (char === '.' && !inBracket) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse static value string to appropriate type
 */
export function parseStaticValue(valueStr) {
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (/^\d+$/.test(valueStr)) return Number(valueStr);
  return valueStr;
}

/**
 * Resolve parameterized ref and get data
 * 
 * @param {string} ref - Data reference path with optional [field={param}] or [field=value] syntax
 * @param {Object} boundParams - Bound parameters from source node
 * @param {Object} data - Root config data object
 * @returns {any} Resolved data or null
 */
export function resolveRefData(ref, boundParams, data) {
  const tokens = parseRefTokens(ref);
  let current = data;

  for (const token of tokens) {
    if (current === undefined || current === null) {
      return null;
    }

    // Pattern 1: Parameterized array lookup [field={paramName}] → single element
    const paramLookupMatch = token.match(/^\[(\w+)=\{(\w+)\}\]$/);
    if (paramLookupMatch) {
      const [, field, paramName] = paramLookupMatch;
      const paramValue = boundParams?.[paramName];

      if (paramValue === undefined) return null;
      if (!Array.isArray(current)) return null;

      current = current.find(item => String(item[field]) === String(paramValue));
      continue;
    }

    // Pattern 2: Static filter [field=value] or [field!=value] → array subset
    const staticFilterMatch = token.match(/^\[(\w+)(=|!=)(\w+)\]$/);
    if (staticFilterMatch) {
      const [, field, op, valueStr] = staticFilterMatch;
      if (!Array.isArray(current)) return null;

      const value = parseStaticValue(valueStr);

      current = current.filter(item =>
        op === '=' ? item[field] === value : item[field] !== value
      );
      continue;
    }

    // Pattern 3: Object index {paramName}
    const objectIndexMatch = token.match(/^\{(\w+)\}$/);
    if (objectIndexMatch) {
      const paramName = objectIndexMatch[1];
      const paramValue = boundParams?.[paramName];

      if (paramValue === undefined) return null;
      current = current[paramValue];
      continue;
    }

    // Pattern 4: Simple field access
    current = current[token];
  }

  return current;
}

/**
 * Check if ref contains parameter references that need bound params
 */
export function refNeedsParams(ref) {
  return /\{(\w+)\}/.test(ref);
}

/**
 * Apply filterFn to data array
 * 
 * @param {Array} items - Array of items to filter
 * @param {string} filterFnStr - Filter function as string, e.g., "(item, data) => ..."
 * @param {Object} data - Root config data object
 * @returns {Array} Filtered items
 */
export function applyFilterFn(items, filterFnStr, data) {
  if (!filterFnStr || !Array.isArray(items)) {
    return items;
  }

  try {
    // Create filter function from string
    // filterFnStr should be like "(item, data) => expression"
    const filterFn = new Function('item', 'data', `return (${filterFnStr})(item, data)`);
    return items.filter(item => {
      try {
        return filterFn(item, data);
      } catch (e) {
        console.warn(`[DataExpand] filterFn error for item:`, e.message);
        return true; // Keep item on error (conservative)
      }
    });
  } catch (e) {
    console.warn(`[DataExpand] Invalid filterFn "${filterFnStr}":`, e.message);
    return items;
  }
}

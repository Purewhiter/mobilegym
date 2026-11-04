const ARRAY_MATCH_RE = /^(\w+)\[(\w+)=(.+)\]$/;
const ARRAY_PUSH_RE = /^(\w+)\[\]$/;

/**
 * Deep-merge a state patch into a mutable draft, as `__SIM__.setState` applies it:
 * objects merge, arrays and scalars replace, and two key forms edit arrays in place —
 * `arr[field=value]` patches (or, with null, deletes) the matching elements and
 * `arr[]` appends.
 */
export function mergeIntoDraft(target: any, source: any): void {
  if (!source || typeof source !== 'object') return;
  Object.entries(source).forEach(([key, value]) => {
    // arr[field=value] — update or delete matched array elements
    const matchM = key.match(ARRAY_MATCH_RE);
    if (matchM) {
      const [, arrKey, matchField, matchVal] = matchM;
      const arr = target[arrKey];
      if (Array.isArray(arr)) {
        if (value === null || value === undefined) {
          target[arrKey] = arr.filter(
            (item: any) => !(item && typeof item === 'object' && String(item[matchField]) === matchVal)
          );
        } else {
          target[arrKey] = arr.map((item: any) => {
            if (item && typeof item === 'object' && String(item[matchField]) === matchVal) {
              const patched = { ...item };
              mergeIntoDraft(patched, value);
              return patched;
            }
            return item;
          });
        }
      }
      return;
    }

    // arr[] — append element(s)
    const pushM = key.match(ARRAY_PUSH_RE);
    if (pushM) {
      const arrKey = pushM[1];
      const existing = Array.isArray(target[arrKey]) ? target[arrKey] : [];
      target[arrKey] = Array.isArray(value) ? [...existing, ...value] : [...existing, value];
      return;
    }

    if (Array.isArray(value)) {
      target[key] = structuredClone(value);
      return;
    }
    if (value && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      mergeIntoDraft(target[key], value);
      return;
    }
    target[key] = value;
  });
}

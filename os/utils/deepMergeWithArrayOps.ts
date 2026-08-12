/**
 * 深合并工具 — 统一支持 __SIM__.setState 的数组操作语法：
 *   - `arr[field=value]`: 值为对象 → 深合并进所有匹配元素；值为 null/undefined → 删除所有匹配元素
 *   - `arr[]`: 追加元素（值为数组 → 逐个追加）
 *
 * 提供两个变体（语义与原三处内嵌实现一一对应，不合并语义）：
 *   - deepMergeWithArrayOps: 纯函数版（返回新对象），原 OSContext.setState / createOsStore.patchProviders 内嵌实现
 *   - mergeIntoDraftWithArrayOps: 原地修改版（用于 immer draft），原 simState.mergeIntoDraft 实现
 */

const ARRAY_MATCH_RE = /^(\w+)\[(\w+)=(.+)\]$/;
const ARRAY_PUSH_RE = /^(\w+)\[\]$/;
// 形如 `xxx[...]` 但不匹配上面两种已支持语法的 key（如 `arr[0]`、`arr[a=1][b=2]`）
const ARRAY_LIKE_RE = /^\w+\[[\s\S]*\]$/;

function warnIfUnrecognizedArrayKey(key: string): void {
  if (ARRAY_LIKE_RE.test(key) && !ARRAY_MATCH_RE.test(key) && !ARRAY_PUSH_RE.test(key)) {
    console.warn(`[deepMerge] unrecognized array-op key '${key}' — treated as a regular key`);
  }
}

/** 纯函数版：返回合并后的新对象，target/source 均不被修改。 */
export function deepMergeWithArrayOps(target: any, source: any): any {
  if (source === undefined) return target;
  if (source === null) return null;
  if (typeof source !== 'object' || Array.isArray(source)) return source;
  if (typeof target !== 'object' || target === null || Array.isArray(target)) return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    // arr[field=value] — update or delete matched array elements
    const matchM = key.match(ARRAY_MATCH_RE);
    if (matchM) {
      const [, arrKey, matchField, matchVal] = matchM;
      const arr = result[arrKey];
      if (Array.isArray(arr)) {
        const val = source[key];
        if (val === null || val === undefined) {
          // DELETE: remove all matched elements
          result[arrKey] = arr.filter(item =>
            !(item && typeof item === 'object' && String(item[matchField]) === matchVal)
          );
        } else {
          // UPDATE: deepMerge into all matched elements
          result[arrKey] = arr.map(item =>
            item && typeof item === 'object' && String(item[matchField]) === matchVal
              ? deepMergeWithArrayOps(item, val)
              : item
          );
        }
      }
      continue;
    }

    // arr[] — append element(s)
    const pushM = key.match(ARRAY_PUSH_RE);
    if (pushM) {
      const arrKey = pushM[1];
      const existing = Array.isArray(result[arrKey]) ? result[arrKey] : [];
      const val = source[key];
      result[arrKey] = Array.isArray(val) ? [...existing, ...val] : [...existing, val];
      continue;
    }

    warnIfUnrecognizedArrayKey(key);

    // Regular key — recursive deepMerge
    result[key] = deepMergeWithArrayOps(target[key], source[key]);
  }
  return result;
}

/** 原地修改版：把 source 合并进 target（immer draft 友好），数组值 structuredClone 后整体替换。 */
export function mergeIntoDraftWithArrayOps(target: any, source: any): void {
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
              mergeIntoDraftWithArrayOps(patched, value);
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

    warnIfUnrecognizedArrayKey(key);

    if (Array.isArray(value)) {
      target[key] = structuredClone(value);
      return;
    }
    if (value && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      mergeIntoDraftWithArrayOps(target[key], value);
      return;
    }
    target[key] = value;
  });
}

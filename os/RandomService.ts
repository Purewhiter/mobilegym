/**
 * RandomService — seeded randomness for the simulator (the `TimeService` of
 * random numbers). Apps must not call `Math.random()` (ESLint enforces it):
 * every random value a page shows or stores comes from here, so a run is
 * reproducible from its seed.
 *
 * Two ways to draw, both derived from the session seed:
 *
 *  - `stream(key)`: a generator for a stable business key, e.g.
 *    `railway.seat|<orderId>|<passenger>`. Same seed + same key = same numbers,
 *    whatever happened before. Prefer this whenever the value belongs to
 *    something with an identity (an order, a track, a list position).
 *
 *  - `nextStream(scope)`: a generator for the next item in a scope (new ids,
 *    verification codes, one-off draws). Item n of a scope is the same in every
 *    run with the same seed; the per-scope counters persist across reloads and
 *    are cleared by `__SIM__.reset()` with the rest of localStorage.
 *
 * The seed is set per episode by the benchmark (`__SIM__.setRandomSeed`, see
 * bench_env MobileGymEnv.apply_random_seed). Without one it is `DEFAULT_SEED`,
 * so plain page loads are deterministic too.
 */

import { debouncedSetItem } from './debouncedPersist';

export type Rng = () => number;

const STORAGE_KEY = 'mg_random';
export const DEFAULT_SEED = 0;

interface RandomState {
  seed: number;
  counters: Record<string, number>;
}

let state: RandomState | null = null;

function load(): RandomState {
  if (state) return state;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? (JSON.parse(raw) as Partial<RandomState>) : null;
    if (parsed && Number.isFinite(parsed.seed) && parsed.counters && typeof parsed.counters === 'object') {
      state = { seed: parsed.seed as number, counters: { ...parsed.counters } };
      return state;
    }
  } catch {
    // Unreadable state: start over from the default seed.
  }
  state = { seed: DEFAULT_SEED, counters: {} };
  return state;
}

function save(): void {
  if (!state || typeof localStorage === 'undefined') return;
  debouncedSetItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Hashing ────────────────────────────────────────────────────────

function fnv1a(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for UI and test data. */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Seed ───────────────────────────────────────────────────────────

export function getSeed(): number {
  return load().seed;
}

/** Set the session seed. Changing it restarts every scope's sequence. */
export function setSeed(seed: number): void {
  if (!Number.isFinite(seed)) throw new Error(`invalid random seed: ${seed}`);
  const s = load();
  const next = Math.trunc(seed) >>> 0;
  if (s.seed === next) return;
  state = { seed: next, counters: {} };
  save();
}

// ── Draws ──────────────────────────────────────────────────────────

/** Generator for a stable business key (same seed + key = same sequence). */
export function stream(key: string): Rng {
  return mulberry32(fnv1a(`${load().seed}|${key}`));
}

/** Generator for the next item of `scope` (item n is the same in every run with the same seed). */
export function nextStream(scope: string): Rng {
  const s = load();
  const n = s.counters[scope] ?? 0;
  s.counters[scope] = n + 1;
  save();
  return stream(`${scope}#${n}`);
}

/** One number in [0, 1) for the next item of `scope`. */
export function next(scope: string): number {
  return nextStream(scope)();
}

// ── Helpers on a generator ─────────────────────────────────────────

/** Integer in [min, maxExclusive). */
export function int(rng: Rng, min: number, maxExclusive: number): number {
  return min + Math.floor(rng() * (maxExclusive - min));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** `length` decimal digits (verification codes, card numbers). */
export function digits(rng: Rng, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += Math.floor(rng() * 10);
  return out;
}

/** `length` base-36 characters (id suffixes). */
export function base36(rng: Rng, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += Math.floor(rng() * 36).toString(36);
  return out;
}

/** Shuffled copy (Fisher–Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Test hook: forget cached state (next draw re-reads localStorage). */
export function _resetForTests(): void {
  state = null;
}

# RandomService — seeded randomness

Apps must not call `Math.random()`, `crypto.randomUUID()` or `crypto.getRandomValues()` (ESLint enforces this for `os/`, `apps/` and `system/`). Every random value a page shows or stores — seat numbers, verification codes, generated ids, shuffled lists, decorative numbers — comes from `os/RandomService.ts`, so an episode is reproducible from its seed.

## Two kinds of seed

| | Task sampling seed (`--sample-seed`) | Environment seed (`--env-seed`) |
|---|---|---|
| Runs in | Python, before the episode | The simulator, during the episode |
| Decides | What the task asks (date, passenger, keyword) | What the app produces while the agent works (which seat, which code, which id) |
| Default | Random 32-bit value, stored in `meta.json` | `--sample-seed` |

Each episode's seed is derived from the environment seed and the task id (`MobileGymEnv.apply_random_seed`, called right after `reset()`), and recorded as `execution.random_seed` in `results.jsonl`. Re-running with the same `--sample-seed` therefore reproduces both the task and the in-app draws; passing a different `--env-seed` keeps the tasks and varies only the in-app draws.

## API

```ts
import { stream, nextStream, next, int, pick, digits, base36, shuffle } from '@/os/RandomService';

// Keyed: same seed + same key → same numbers, whatever happened before.
const rng = stream(`railway.seat|${orderId}|${passengerIndex}`);
const car = int(rng, 1, 17);

// Sequence: item n of a scope is the same in every run with the same seed.
const code = digits(nextStream('railway12306.resetCode'), 6);
const id = `note_${base36(nextStream('notes.note'), 8)}`;
```

| Use | When |
|---|---|
| `stream(key)` | The value belongs to something with an identity (an order, a track, a list position). Prefer it: it does not shift when the agent takes extra steps. |
| `nextStream(scope)` / `next(scope)` | New ids, verification codes, one-off draws with no natural key. Per-scope counters persist across reloads (no id reuse) and are cleared by `__SIM__.reset()`. |

Helpers take a generator: `int(rng, min, maxExclusive)`, `pick(rng, items)`, `digits(rng, n)`, `base36(rng, n)`, `shuffle(rng, items)`.

The benchmark sets the seed with `__SIM__.setRandomSeed(seed)` (read it back with `__SIM__.getRandomSeed()`). Without one, the seed is `0`, so plain page loads are deterministic too.

## Exceptions

Two values must stay unique per page and are never shown, so they keep `crypto` / `Math.random` with an inline ESLint exemption:

- `os/storageIsolation.ts` — the localStorage namespace that separates parallel pages on one origin.
- `os/NetworkService.ts` — the gateway cookie-jar id of a tab.

The device server does not use the seed: its file-system ids are a hash of the node's path and creation time (`device/fs.ts`), which is deterministic on its own.

type MetricSample = {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
};

type MamlPerfStore = {
  metrics: Record<string, Record<string, MetricSample>>;
};

declare global {
  interface Window {
    __MAML_PERF__?: MamlPerfStore;
  }
}

function isPerfEnabled(): boolean {
  return typeof window !== 'undefined' && !!import.meta.env.DEV;
}

function getPerfStore(): MamlPerfStore | null {
  if (!isPerfEnabled()) return null;
  if (!window.__MAML_PERF__) {
    window.__MAML_PERF__ = { metrics: {} };
  }
  return window.__MAML_PERF__;
}

export function recordMamlPerf(metric: string, key: string, durationMs: number): void {
  const store = getPerfStore();
  if (!store) return;
  const byMetric = store.metrics[metric] ?? (store.metrics[metric] = {});
  const sample = byMetric[key] ?? (byMetric[key] = {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    lastMs: 0,
  });
  sample.count += 1;
  sample.totalMs += durationMs;
  sample.maxMs = Math.max(sample.maxMs, durationMs);
  sample.lastMs = durationMs;
}

export function beginMamlPerf(metric: string, key: string): () => void {
  if (!isPerfEnabled()) return () => {};
  const startedAt = performance.now();
  return () => {
    recordMamlPerf(metric, key, performance.now() - startedAt);
  };
}

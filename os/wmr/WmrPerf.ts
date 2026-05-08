type MetricSample = {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
};

type WmrPerfStore = {
  metrics: Record<string, Record<string, MetricSample>>;
};

declare global {
  interface Window {
    __WMR_PERF__?: WmrPerfStore;
  }
}

function isPerfEnabled(): boolean {
  return typeof window !== 'undefined' && !!import.meta.env.DEV;
}

function getPerfStore(): WmrPerfStore | null {
  if (!isPerfEnabled()) return null;
  if (!window.__WMR_PERF__) {
    window.__WMR_PERF__ = { metrics: {} };
  }
  return window.__WMR_PERF__;
}

export function recordWmrPerf(metric: string, key: string, durationMs: number): void {
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

export function beginWmrPerf(metric: string, key: string): () => void {
  if (!isPerfEnabled()) return () => {};
  const startedAt = performance.now();
  return () => {
    recordWmrPerf(metric, key, performance.now() - startedAt);
  };
}

import * as TimeService from '../TimeService';

/**
 * Real ms from now until just after the next boundary the widget's `useVariableUpdater`
 * asks for (next simulated second / minute / hour), or a 60 s heartbeat when it asks for
 * none. The render loop turns this into an absolute due time at each refresh, so passive
 * widgets repaint when the boundary passes rather than one interval after mount.
 */
export function getPassiveDataUpdateDelayMs(updaters: string[]): number {
  const cfg = TimeService.getTimeConfig();
  // Frozen simulated time never crosses a boundary; keep the provider-data heartbeat.
  if (cfg.mode === 'simulated' && cfg.flowing === false) return 60_000;

  const now = TimeService.getDate();
  const ms = now.getMilliseconds();
  const sec = now.getSeconds();
  const minute = now.getMinutes();

  let simDelay: number | null = null;
  if (updaters.includes('DateTime.Second')) {
    simDelay = 1000 - ms;
  } else if (updaters.includes('DateTime.Minute')) {
    simDelay = (59 - sec) * 1000 + (1000 - ms);
  } else if (updaters.includes('DateTime.Hour')) {
    simDelay = ((59 - minute) * 60 + (59 - sec)) * 1000 + (1000 - ms);
  }

  // No explicit time updater: keep a very low-frequency heartbeat for provider data
  // instead of polling every frame.
  if (simDelay === null) return 60_000;
  // Simulated time may run faster or slower than the real clock the loop schedules on.
  return Math.max(1, Math.ceil(simDelay / (cfg.speed > 0 ? cfg.speed : 1)));
}

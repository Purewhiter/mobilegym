/**
 * System Time Service
 *
 * Provides a centralized way to get the current system time.
 * Supports two modes:
 * 1. Real time: Uses the actual current time (optionally accelerated)
 * 2. Simulated time: Uses a manually specified time, with optional flowing
 *
 * Simulated time supports two sub-modes via the `flowing` flag:
 * - flowing (default): Time advances from the simulated start point.
 *     now() = simulatedAnchor + (Date.now() - realAnchor) * speed
 * - frozen: Time stays fixed at the specified point. Useful for deterministic benchmarks.
 *     now() = simulatedAnchor
 *
 * Speed multiplier (`speed`, default 1) applies to both real and simulated flowing modes.
 * E.g. speed=100 means 1 real second = 100 simulated seconds.
 *
 * All code should use this service instead of directly calling Date.now() or new Date():
 * - `now()`     — simulated system time (display, timestamps in data, state judgment)
 * - `realNow()` — real wall-clock time (debounce, animation, gesture timing, cache TTL)
 */

import BroadcastBus, { ACTION_TIME_SET, ACTION_TIME_TICK } from './BroadcastBus';
import { SIMULATOR_CONFIG } from './data';
import { getLocale } from './locale';

export interface TimeConfig {
    mode: 'real' | 'simulated';
    simulatedTime?: string | number; // "2024-12-25 21:00:00" or timestamp in ms
    /** When true (default), simulated time flows at real speed. When false, time is frozen. */
    flowing?: boolean;
    /** Speed multiplier. 1 = real-time, 100 = 100x faster. Default 1. */
    speed?: number;
}

// Initialize from SIMULATOR_CONFIG at module load time so that eager-loaded app
// stores (import.meta.glob({ eager })) see the correct time from the start.
// initTimeService() called later in index.tsx is idempotent (same values + broadcast).
const _cfgSpeed = SIMULATOR_CONFIG.time.speed ?? 1;
const _cfgParsedTime = parseTime(SIMULATOR_CONFIG.time.simulatedTime);
const _cfgIsSimulated = (SIMULATOR_CONFIG.time.mode ?? 'real') === 'simulated' && _cfgParsedTime !== undefined;

let timeConfig: TimeConfig = {
    mode: SIMULATOR_CONFIG.time.mode ?? 'real',
    simulatedTime: SIMULATOR_CONFIG.time.simulatedTime,
    flowing: SIMULATOR_CONFIG.time.flowing ?? true,
    speed: _cfgSpeed,
};

let parsedSimulatedTime: number | undefined = _cfgParsedTime;

let realAnchorTime: number | undefined = _cfgIsSimulated ? Date.now() : undefined;

let speedMultiplier: number = _cfgSpeed;

let realModeAnchorReal: number | undefined = (!_cfgIsSimulated && _cfgSpeed !== 1) ? Date.now() : undefined;
let realModeAnchorSimulated: number | undefined = (!_cfgIsSimulated && _cfgSpeed !== 1) ? Date.now() : undefined;

let _bootTime: number = 0;

let timeTickTimer: number | null = null;

function clearTimeTickTimer(): void {
    if (timeTickTimer === null) return;
    try {
        clearTimeout(timeTickTimer);
    } catch {
        // ignore
    }
    timeTickTimer = null;
}

function resetTimeTickScheduler(): void {
    clearTimeTickTimer();
    if (typeof window === 'undefined') return;
    // Frozen simulated time should not tick.
    if (timeConfig.mode === 'simulated' && timeConfig.flowing === false) return;

    const cur = now();
    const next = Math.floor(cur / 60000) * 60000 + 60000;
    const delay = Math.max(0, Math.min(60000, next - cur));

    timeTickTimer = window.setTimeout(() => {
        timeTickTimer = null;
        if (!(timeConfig.mode === 'simulated' && timeConfig.flowing === false)) {
            BroadcastBus.sendBroadcast({
                action: ACTION_TIME_TICK,
                extras: { now: now() },
            });
        }
        resetTimeTickScheduler();
    }, delay);
}

function emitTimeSetBroadcast() {
    BroadcastBus.sendBroadcast({
        action: ACTION_TIME_SET,
        extras: {
            mode: timeConfig.mode,
            simulatedTime: parsedSimulatedTime,
            flowing: timeConfig.flowing !== false,
            speed: speedMultiplier,
            now: now(),
        },
    });
    resetTimeTickScheduler();
}

/**
 * Parse time string to timestamp
 * Supports formats:
 * - "2024-12-25 21:00:00" (local time)
 * - "2024-12-25T21:00:00" (ISO format)
 * - "2024-12-25" (date only, 00:00:00)
 * - number (timestamp in ms)
 */
function parseTime(time: string | number | undefined): number | undefined {
    if (time === undefined) return undefined;
    if (typeof time === 'number') return time;

    // Replace space with T for ISO format compatibility
    const isoString = time.includes('T') ? time : time.replace(' ', 'T');
    const date = new Date(isoString);

    if (isNaN(date.getTime())) {
        console.error(`Invalid time format: ${time}`);
        return undefined;
    }

    return date.getTime();
}

/**
 * Initialize the time service with a configuration
 */
export function initTimeService(config: TimeConfig): void {
    timeConfig = { flowing: true, ...config };
    speedMultiplier = config.speed ?? 1;
    parsedSimulatedTime = parseTime(config.simulatedTime);
    if (config.mode === 'simulated' && parsedSimulatedTime !== undefined) {
        realAnchorTime = Date.now();
        realModeAnchorReal = undefined;
        realModeAnchorSimulated = undefined;
    } else {
        realAnchorTime = undefined;
        if (speedMultiplier !== 1) {
            realModeAnchorReal = Date.now();
            realModeAnchorSimulated = Date.now();
        } else {
            realModeAnchorReal = undefined;
            realModeAnchorSimulated = undefined;
        }
    }
    _bootTime = now();
    emitTimeSetBroadcast();
}

/**
 * Get the current system time configuration
 */
export function getTimeConfig(): TimeConfig & { speed: number } {
    return { ...timeConfig, speed: speedMultiplier };
}

/**
 * Set time mode to real
 */
export function useRealTime(): void {
    timeConfig = { mode: 'real' };
    parsedSimulatedTime = undefined;
    realAnchorTime = undefined;
    if (speedMultiplier !== 1) {
        realModeAnchorReal = Date.now();
        realModeAnchorSimulated = Date.now();
    } else {
        realModeAnchorReal = undefined;
        realModeAnchorSimulated = undefined;
    }
    emitTimeSetBroadcast();
}

/**
 * Set time mode to simulated with a specific time
 * @param time - "2024-12-25 21:00:00" or timestamp in ms
 * @param flowing - if true (default), time advances at real speed from the start point;
 *                  if false, time is frozen at the specified point
 */
export function useSimulatedTime(time: string | number, flowing = true): void {
    timeConfig = { mode: 'simulated', simulatedTime: time, flowing };
    parsedSimulatedTime = parseTime(time);
    realAnchorTime = Date.now();
    emitTimeSetBroadcast();
}

/**
 * Toggle flowing mode for the current simulated time.
 * No-op if not in simulated mode.
 */
export function setFlowing(flowing: boolean): void {
    if (timeConfig.mode !== 'simulated' || parsedSimulatedTime === undefined) return;

    const wasFlowing = timeConfig.flowing !== false;
    if (wasFlowing === flowing) return;

    if (!flowing) {
        // Freezing: capture the current flowing time as the new frozen anchor
        parsedSimulatedTime = now();
        realAnchorTime = undefined;
    } else {
        // Unfreezing: start flowing from the current frozen time
        realAnchorTime = Date.now();
    }
    timeConfig = { ...timeConfig, flowing };
    emitTimeSetBroadcast();
}

/**
 * Set the speed multiplier.
 * 1 = real-time, 10 = 10x faster, 0.5 = half speed, etc.
 * Re-anchors the current time so there's no jump when changing speed.
 */
export function setSpeed(speed: number): void {
    if (speed <= 0) {
        console.error(`[TimeService] Invalid speed: ${speed}, must be > 0`);
        return;
    }
    if (speed === speedMultiplier) return;

    // Re-anchor: capture current simulated time, then restart from here at new speed
    const currentNow = now();
    speedMultiplier = speed;
    timeConfig = { ...timeConfig, speed };

    if (timeConfig.mode === 'simulated' && parsedSimulatedTime !== undefined) {
        if (timeConfig.flowing !== false) {
            parsedSimulatedTime = currentNow;
            realAnchorTime = Date.now();
        }
    } else {
        realModeAnchorSimulated = currentNow;
        realModeAnchorReal = Date.now();
    }
    emitTimeSetBroadcast();
}

/**
 * Get the current speed multiplier.
 */
export function getSpeed(): number {
    return speedMultiplier;
}

/**
 * Get the current timestamp (equivalent to Date.now())
 * This is the main function that should be used instead of Date.now()
 *
 * In simulated mode:
 * - flowing:  simulatedAnchor + (Date.now() - realAnchor) * speed
 * - frozen:   simulatedAnchor (constant)
 *
 * In real mode:
 * - speed == 1: Date.now()
 * - speed != 1: realModeAnchorSimulated + (Date.now() - realModeAnchorReal) * speed
 */
export function now(): number {
    if (timeConfig.mode === 'simulated' && parsedSimulatedTime !== undefined) {
        if (timeConfig.flowing !== false && realAnchorTime !== undefined) {
            return parsedSimulatedTime + (Date.now() - realAnchorTime) * speedMultiplier;
        }
        return parsedSimulatedTime;
    }
    if (speedMultiplier !== 1 && realModeAnchorReal !== undefined && realModeAnchorSimulated !== undefined) {
        return realModeAnchorSimulated + (Date.now() - realModeAnchorReal) * speedMultiplier;
    }
    return Date.now();
}

/**
 * Get the real wall-clock timestamp (always Date.now()).
 *
 * Use this for UI timing / debounce / animation / gesture detection /
 * cache TTL — anything that measures real elapsed time between events,
 * as opposed to "what time should the simulated clock display."
 *
 * Providing this as an explicit API so we can lint against bare `Date.now()`
 * while still making "I need real time" an intentional, self-documenting choice.
 */
export function realNow(): number {
    return Date.now();
}

/**
 * Get the current Date object (equivalent to new Date())
 * This is the main function that should be used instead of new Date()
 */
export function getDate(): Date {
    return new Date(now());
}

/**
 * Get a Date object from a timestamp
 */
export function fromTimestamp(timestamp: number): Date {
    return new Date(timestamp);
}

/**
 * Get a local Date object from date parts.
 * Month is 0-based to match the JS Date API.
 */
export function fromLocalParts(
    year: number,
    monthIndex: number,
    day: number,
    hours = 0,
    minutes = 0,
    seconds = 0,
    milliseconds = 0,
): Date {
    const date = new Date(0);
    date.setFullYear(year, monthIndex, day);
    date.setHours(hours, minutes, seconds, milliseconds);
    return date;
}

/**
 * Parse time string or number to timestamp (ms).
 * Supports formats: "2024-12-25 21:00:00", "2024-12-25T21:00:00", "2024-12-25", or number.
 * Returns 0 for invalid input.
 */
export function parseToTimestamp(time: string | number): number {
    const t = parseTime(time);
    return t ?? 0;
}

/**
 * Get the boot time — captured once at TimeService initialization.
 * All relative data timestamps are anchored to this value.
 */
export function getBootTime(): number {
    return _bootTime;
}

/**
 * Parse a human-readable relative offset string (e.g. "-1d2h30m") into milliseconds.
 * Supported units: w(week) d(day) h(hour) m(minute) s(second).
 * A leading "-" makes the result negative.
 */
function parseRelativeOffset(s: string): number {
    const re = /(\d+)(w|d|h|m|s)/g;
    const units: Record<string, number> = { w: 604_800_000, d: 86_400_000, h: 3_600_000, m: 60_000, s: 1_000 };
    let total = 0;
    for (const [, n, u] of s.matchAll(re)) total += parseInt(n) * units[u];
    return s.startsWith('-') ? -total : total;
}

/**
 * Resolve a data timestamp in any of 4 supported formats to an absolute epoch ms value.
 *
 * Formats:
 * - `number >= 0` — absolute timestamp, returned as-is
 * - `number < 0` — ms offset relative to bootTime (e.g. -3600000 = 1h before boot)
 * - `string` matching `[+-]?(\d+[wdhms])+` — human-readable relative offset
 *   (e.g. "-1d2h30m" = before boot, "+2h" or "2h" = after boot)
 * - `string` date — parsed via parseToTimestamp (e.g. "2026-03-01 15:30:00")
 */
export function resolveDataTimestamp(raw: string | number): number {
    if (typeof raw === 'number') return raw < 0 ? _bootTime + raw : raw;
    const s = raw.trim();
    if (/^[+-]?(\d+[wdhms])+$/.test(s)) return _bootTime + parseRelativeOffset(s);
    return parseToTimestamp(s) || _bootTime;
}

/**
 * Format time for display (HH:MM)
 */
export function formatTime(): string {
    const d = getDate();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function getIntlLocale(): string {
    return getLocale() === 'en' ? 'en-US' : 'zh-CN';
}

function formatDateByLocale(date: Date): string {
    if (getLocale() === 'en') {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
        }).format(date);
    }
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatWeekdayByLocale(date: Date): string {
    if (getLocale() === 'en') {
        return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    }
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
}

export function formatDate(): string {
    return formatDateByLocale(getDate());
}

export function getDayOfWeek(): string {
    return formatWeekdayByLocale(getDate());
}

export function formatDateTimeForLocale(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(getIntlLocale(), options).format(date);
}

/**
 * Format date for display (M月D日)
 */
export function formatDateCN(): string {
    const d = getDate();
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * Get current time as ISO string (YYYY-MM-DDTHH:mm:ss)
 * Useful for storing timestamps in human-readable format
 */
export function getISOString(): string {
    const d = getDate();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
export function getToday(): string {
    return getDate().toISOString().split('T')[0];
}

/**
 * Get the day of week in Chinese
 */
export function getDayOfWeekCN(): string {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[getDate().getDay()];
}

// Capture boot time after eager init so data/index.ts resolvers see the correct value.
_bootTime = now();

// Start TIME_TICK in browser env (best-effort; timers may be clamped in background tabs).
if (typeof window !== 'undefined') {
    resetTimeTickScheduler();
}

// Expose to window for Agent access
if (typeof window !== 'undefined') {
    window.__SIM_TIME__ = {
        now,
        getDate,
        setRealTime: useRealTime,
        setSimulatedTime: useSimulatedTime,
        setFlowing,
        setSpeed,
        getSpeed,
        getConfig: getTimeConfig,
    };
}

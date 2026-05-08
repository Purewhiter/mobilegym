import type { TempUnit, WindUnit, PressureUnit } from '../types';
import { beaufortScaleFromKmh } from '../services/weatherService';

// ── 温度 ──────────────────────────────────────────────────────────

export function convertTemp(celsiusRaw: string | number, unit: TempUnit): number {
  const c = typeof celsiusRaw === 'string' ? parseFloat(celsiusRaw) : celsiusRaw;
  if (!Number.isFinite(c)) return 0;
  if (unit === 'fahrenheit') return Math.round(c * 9 / 5 + 32);
  return Math.round(c);
}

export function formatTemp(celsiusRaw: string | number, unit: TempUnit): string {
  return `${convertTemp(celsiusRaw, unit)}°`;
}

// ── 风速 ──────────────────────────────────────────────────────────

export function formatWind(
  windSpeedKmh: string,
  windScale: string,
  unit: WindUnit,
  scaleSuffix: string,
): string {
  if (unit === 'beaufort') {
    const speed = parseFloat(windSpeedKmh);
    const scale = Number.isFinite(speed) ? beaufortScaleFromKmh(speed) : windScale;
    return scale ? `${scale}${scaleSuffix}` : '';
  }

  const kmh = parseFloat(windSpeedKmh);
  if (!Number.isFinite(kmh)) {
    return windScale ? `${windScale}${scaleSuffix}` : '';
  }

  let value: number;
  let suffix: string;
  switch (unit) {
    case 'kmh':
      value = Math.round(kmh);
      suffix = 'km/h';
      break;
    case 'ms':
      value = Math.round(kmh / 3.6);
      suffix = 'm/s';
      break;
    case 'mph':
      value = Math.round(kmh * 0.621371);
      suffix = 'mph';
      break;
    case 'kn':
      value = Math.round(kmh * 0.539957);
      suffix = 'kn';
      break;
    default:
      return windScale ? `${windScale}${scaleSuffix}` : '';
  }
  return `${value}${suffix}`;
}

// ── 气压 ──────────────────────────────────────────────────────────

export function convertPressure(hpaRaw: string | number, unit: PressureUnit): number {
  const hpa = typeof hpaRaw === 'string' ? parseFloat(hpaRaw) : hpaRaw;
  if (!Number.isFinite(hpa)) return 0;
  switch (unit) {
    case 'mmhg':
      return Math.round(hpa * 0.750062);
    case 'inhg':
      return +(hpa * 0.02953).toFixed(2);
    default:
      return Math.round(hpa);
  }
}

export function pressureSuffix(unit: PressureUnit): string {
  switch (unit) {
    case 'mmhg': return 'mmHg';
    case 'inhg': return 'inHg';
    default: return 'hPa';
  }
}

export function formatPressure(hpaRaw: string | number, unit: PressureUnit): string {
  return `${convertPressure(hpaRaw, unit)}`;
}

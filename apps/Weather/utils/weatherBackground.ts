import * as TimeService from '@/os/TimeService';
import type { WeatherBundle } from '../services/weatherService';

export type WeatherBackgroundKind =
  | 'clear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'sand'
  | 'storm'
  | 'haze'
  | 'hail';

export type WeatherParticleType =
  | 'none'
  | 'rain-light'
  | 'rain-medium'
  | 'rain-heavy'
  | 'snow-light'
  | 'snow-medium'
  | 'snow-heavy'
  | 'stars';

export interface WeatherGradientSpec {
  colors: [string, string, string, string, string];
  positions: [number, number, number];
}

export interface WeatherCloudSpec {
  top: number;
  left: number;
  width: number;
  height: number;
  opacity: number;
  blur: number;
  scale: number;
  animation: 'cloudA' | 'cloudB' | 'cloudC';
}

export interface WeatherGlowSpec {
  enabled: boolean;
  color: string;
  opacity: number;
  size: number;
  top: number;
  left: number;
}

export interface WeatherBackgroundState {
  kind: WeatherBackgroundKind;
  phaseIndex: number;
  isNight: boolean;
  gradient: WeatherGradientSpec;
  particleType: WeatherParticleType;
  cloudTextureOpacity: number;
  cloudOpacity: number;
  cloudBlendMode: 'screen' | 'soft-light' | 'overlay';
  cloudTint: string;
  cloudSpecs: WeatherCloudSpec[];
  glow: WeatherGlowSpec;
  atmosphereOverlay: string;
  contentScrim: string;
}

type PaletteByStops = {
  top: readonly string[];
  mid1: readonly string[];
  mid2: readonly string[];
  mid3: readonly string[];
  bottom: readonly string[];
};

type CategorySpec = {
  gradientDay: WeatherGradientSpec;
  gradientNight: WeatherGradientSpec;
  particleType: WeatherParticleType;
  cloudOpacity: number;
  cloudBlendMode: 'screen' | 'soft-light' | 'overlay';
  cloudTint: string;
  cloudTextureOpacity: number;
  atmosphereOverlay: string;
};

const CLEAR_PALETTE: PaletteByStops = {
  top: ['#0F1222', '#10152C', '#1A1F48', '#262755', '#323264', '#394887', '#36559B', '#2A4E99', '#2D529B', '#34559C', '#4466AB', '#414B8B', '#46447D', '#3E3A69', '#251E3F', '#17183A'],
  mid1: ['#101424', '#131831', '#1D224F', '#2A2B5D', '#383970', '#3F4F93', '#4064B0', '#345FAF', '#3E6BBB', '#375AA4', '#4C70B7', '#485294', '#55508C', '#514878', '#3B2E5A', '#1B1D43'],
  mid2: ['#212842', '#151B38', '#383C75', '#36356E', '#484786', '#4E60AA', '#6D99E4', '#345EAA', '#3E6BBB', '#446DBA', '#5F87CD', '#505A9E', '#B4899C', '#98707B', '#885A6E', '#222451'],
  mid3: ['#2E3552', '#242D55', '#525082', '#6D5D8F', '#9280C6', '#8794DD', '#A2C8F2', '#74AEEA', '#4473C4', '#76A4E5', '#8DB4E5', '#7F82BD', '#FD9B71', '#D77D5A', '#AC6157', '#34356D'],
  bottom: ['#3F4561', '#424C7C', '#6B5F7F', '#966C84', '#E49DAB', '#EFCBD3', '#DAE4E6', '#AAD3E4', '#92C4EA', '#ADCFE7', '#CFDEDF', '#FFB58D', '#FF965B', '#FE6F38', '#BA583C', '#5B568B'],
};

const CLEAR_POSITIONS = {
  mid1: [0.3346, 0.471, 0.3642, 0.3281, 0.265, 0.2962, 0.3115, 0.2962, 0.2677, 0.2962, 0.2614, 0.1478, 0.3074, 0.3854, 0.5564, 0.3457],
  mid2: [0.7321, 0.75, 0.7309, 0.5876, 0.4594, 0.5021, 0.5968, 0.5021, 0.4663, 0.5021, 0.4467, 0.3239, 0.7044, 0.7704, 0.8342, 0.734],
  mid3: [0.8877, 0.8706, 0.8847, 0.8366, 0.801, 0.8215, 0.8615, 0.7813, 0.691, 0.7813, 0.7803, 0.619, 0.902, 0.8818, 0.9351, 0.873],
} as const;

const CATEGORY_INDEX = {
  overcast: 4,
  fog: 5,
  rain: 6,
  snow: 7,
  sand: 8,
  storm: 9,
  haze: 10,
  hail: 11,
} as const;

const DAY_CATEGORY_PALETTE: PaletteByStops = {
  top: ['#3E5482', '#52647C', '#52647C', '#59679E', '#765E3A', '#37230F', '#765E3A', '#52647C'],
  mid1: ['#465D8B', '#5B6D84', '#5B6D84', '#616FA7', '#9D8257', '#855B2C', '#967C52', '#5B6D84'],
  mid2: ['#526893', '#66788C', '#66788C', '#808CC7', '#AF996F', '#A0753D', '#AFA284', '#66788C'],
  mid3: ['#708099', '#768793', '#768793', '#B4B7E3', '#AFA283', '#9F834D', '#AFA284', '#768793'],
  bottom: ['#7C8794', '#879596', '#879596', '#C7C3E6', '#ADA288', '#9B8652', '#ADA288', '#879596'],
};

const NIGHT_CATEGORY_PALETTE: PaletteByStops = {
  top: ['#0F1222', '#0F1222', '#0F1222', '#262C43', '#443A24', '#443A24', '#343230', '#0F1222'],
  mid1: ['#101424', '#101424', '#101424', '#2A3048', '#463820', '#463820', '#36332E', '#101424'],
  mid2: ['#212842', '#212842', '#212842', '#313750', '#46331B', '#46331B', '#332D25', '#212842'],
  mid3: ['#2E3552', '#2E3552', '#2E3552', '#45495E', '#372512', '#372512', '#2B251D', '#2E3552'],
  bottom: ['#3F4561', '#3F4561', '#3F4561', '#525260', '#1A1107', '#1A1107', '#241F16', '#3F4561'],
};

const DAY_CATEGORY_POSITIONS = {
  mid1: [0.4792, 0.5871, 0.4167, 0.3619, 0.3643, 0.1198, 0.1763, 0.276],
  mid2: [0.7427, 0.7521, 0.6157, 0.6263, 0.6604, 0.5053, 0.4818, 0.6287],
  mid3: [0.901, 0.8649, 0.8021, 0.8402, 0.8484, 0.8179, 0.7897, 0.8249],
} as const;

const NIGHT_CATEGORY_POSITIONS = {
  mid1: [0.2538, 0.2538, 0.2538, 0.2009, 0.2009, 0.2009, 0.4066, 0.6193],
  mid2: [0.6204, 0.6204, 0.6204, 0.4536, 0.4536, 0.4536, 0.4877, 0.7609],
  mid3: [0.8179, 0.8179, 0.8179, 0.8519, 0.8519, 0.8519, 0.738, 0.8754],
} as const;

const CATEGORY_SPECS: Record<Exclude<WeatherBackgroundKind, 'clear' | 'partlyCloudy'>, CategorySpec> = {
  overcast: buildCategorySpec('overcast', 'none', 0.6, 'screen', 'rgba(240,246,255,0.28)', 0.52, 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.08) 55%, rgba(0,0,0,0.2))'),
  fog: buildCategorySpec('fog', 'none', 0.72, 'screen', 'rgba(248,250,255,0.42)', 0.48, 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05) 48%, rgba(0,0,0,0.18))'),
  rain: buildCategorySpec('rain', 'rain-medium', 0.78, 'soft-light', 'rgba(214,226,255,0.24)', 0.62, 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.18) 42%, rgba(0,0,0,0.28))'),
  snow: buildCategorySpec('snow', 'snow-medium', 0.64, 'screen', 'rgba(245,248,255,0.30)', 0.56, 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.18))'),
  sand: buildCategorySpec('sand', 'none', 0.58, 'overlay', 'rgba(255,220,168,0.22)', 0.38, 'linear-gradient(180deg, rgba(255,216,140,0.06), rgba(0,0,0,0.1) 44%, rgba(0,0,0,0.24))'),
  storm: buildCategorySpec('storm', 'rain-heavy', 0.88, 'soft-light', 'rgba(191,204,236,0.20)', 0.68, 'linear-gradient(180deg, rgba(0,0,0,0.16), rgba(0,0,0,0.28) 36%, rgba(0,0,0,0.38))'),
  haze: buildCategorySpec('haze', 'none', 0.66, 'overlay', 'rgba(244,223,188,0.20)', 0.4, 'linear-gradient(180deg, rgba(255,222,181,0.05), rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.26))'),
  hail: buildCategorySpec('hail', 'rain-medium', 0.76, 'screen', 'rgba(232,240,255,0.24)', 0.54, 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.14) 42%, rgba(0,0,0,0.26))'),
};

export function deriveWeatherBackgroundState(bundle: WeatherBundle | null): WeatherBackgroundState {
  const phaseIndex = resolvePhaseIndex(bundle);
  const isNight = phaseIndex <= 3 || phaseIndex >= 12;
  const weatherKind = resolveWeatherKind(bundle);

  if (weatherKind === 'clear' || weatherKind === 'partlyCloudy') {
    const gradient = buildClearGradient(phaseIndex);
    const cloudOpacity = weatherKind === 'partlyCloudy'
      ? (isNight ? 0.62 : 0.82)
      : (isNight ? 0.36 : 0.5);
    const glow = buildGlowSpec(phaseIndex, weatherKind);
    return {
      kind: weatherKind,
      phaseIndex,
      isNight,
      gradient,
      particleType: isNight ? 'stars' : 'none',
      cloudTextureOpacity: weatherKind === 'partlyCloudy' ? 0.44 : 0.22,
      cloudOpacity,
      cloudBlendMode: 'screen',
      cloudTint: isNight ? 'rgba(226,235,255,0.34)' : 'rgba(255,255,255,0.54)',
      cloudSpecs: buildCloudSpecs(weatherKind, cloudOpacity),
      glow,
      atmosphereOverlay: isNight
        ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.12) 48%, rgba(0,0,0,0.24))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.00) 40%, rgba(0,0,0,0.12))',
      contentScrim: 'linear-gradient(180deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.04) 48%, rgba(0,0,0,0.18) 100%)',
    };
  }

  const spec = CATEGORY_SPECS[weatherKind];
  const particleType = adjustParticleType(spec.particleType, bundle);

  return {
    kind: weatherKind,
    phaseIndex,
    isNight,
    gradient: isNight ? spec.gradientNight : spec.gradientDay,
    particleType,
    cloudTextureOpacity: spec.cloudTextureOpacity,
    cloudOpacity: spec.cloudOpacity,
    cloudBlendMode: spec.cloudBlendMode,
    cloudTint: spec.cloudTint,
    cloudSpecs: buildCloudSpecs(weatherKind, spec.cloudOpacity),
    glow: buildGlowSpec(phaseIndex, weatherKind),
    atmosphereOverlay: spec.atmosphereOverlay,
    contentScrim: 'linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.06) 46%, rgba(0,0,0,0.22) 100%)',
  };
}

export function buildGradientCss(gradient: WeatherGradientSpec): string {
  const [c0, c1, c2, c3, c4] = gradient.colors;
  const [p1, p2, p3] = gradient.positions;
  return `linear-gradient(180deg, ${c0} 0%, ${c1} ${toPercent(p1)}, ${c2} ${toPercent(p2)}, ${c3} ${toPercent(p3)}, ${c4} 100%)`;
}

function buildCategorySpec(
  kind: Exclude<WeatherBackgroundKind, 'clear' | 'partlyCloudy'>,
  particleType: CategorySpec['particleType'],
  cloudOpacity: number,
  cloudBlendMode: CategorySpec['cloudBlendMode'],
  cloudTint: string,
  cloudTextureOpacity: number,
  atmosphereOverlay: string,
): CategorySpec {
  const dayIdx = CATEGORY_INDEX[kind] - 4;
  return {
    gradientDay: {
      colors: [
        DAY_CATEGORY_PALETTE.top[dayIdx],
        DAY_CATEGORY_PALETTE.mid1[dayIdx],
        DAY_CATEGORY_PALETTE.mid2[dayIdx],
        DAY_CATEGORY_PALETTE.mid3[dayIdx],
        DAY_CATEGORY_PALETTE.bottom[dayIdx],
      ],
      positions: [
        DAY_CATEGORY_POSITIONS.mid1[dayIdx],
        DAY_CATEGORY_POSITIONS.mid2[dayIdx],
        DAY_CATEGORY_POSITIONS.mid3[dayIdx],
      ],
    },
    gradientNight: {
      colors: [
        NIGHT_CATEGORY_PALETTE.top[dayIdx],
        NIGHT_CATEGORY_PALETTE.mid1[dayIdx],
        NIGHT_CATEGORY_PALETTE.mid2[dayIdx],
        NIGHT_CATEGORY_PALETTE.mid3[dayIdx],
        NIGHT_CATEGORY_PALETTE.bottom[dayIdx],
      ],
      positions: [
        NIGHT_CATEGORY_POSITIONS.mid1[dayIdx],
        NIGHT_CATEGORY_POSITIONS.mid2[dayIdx],
        NIGHT_CATEGORY_POSITIONS.mid3[dayIdx],
      ],
    },
    particleType,
    cloudOpacity,
    cloudBlendMode,
    cloudTint,
    cloudTextureOpacity,
    atmosphereOverlay,
  };
}

function buildClearGradient(phaseIndex: number): WeatherGradientSpec {
  return {
    colors: [
      CLEAR_PALETTE.top[phaseIndex],
      CLEAR_PALETTE.mid1[phaseIndex],
      CLEAR_PALETTE.mid2[phaseIndex],
      CLEAR_PALETTE.mid3[phaseIndex],
      CLEAR_PALETTE.bottom[phaseIndex],
    ],
    positions: [
      CLEAR_POSITIONS.mid1[phaseIndex],
      CLEAR_POSITIONS.mid2[phaseIndex],
      CLEAR_POSITIONS.mid3[phaseIndex],
    ],
  };
}

function buildGlowSpec(phaseIndex: number, kind: WeatherBackgroundKind): WeatherGlowSpec {
  const clearLike = kind === 'clear' || kind === 'partlyCloudy';
  const opacityScale = clearLike ? 1 : 0.45;

  if (phaseIndex >= 2 && phaseIndex <= 4) {
    return {
      enabled: true,
      color: 'rgba(255, 191, 129, 0.92)',
      opacity: 0.28 * opacityScale,
      size: 56,
      top: 10,
      left: 50,
    };
  }

  if (phaseIndex >= 5 && phaseIndex <= 10) {
    return {
      enabled: clearLike,
      color: 'rgba(255, 245, 218, 0.95)',
      opacity: phaseIndex <= 7 ? 0.24 : 0.18,
      size: 78,
      top: 8,
      left: phaseIndex <= 7 ? 56 : 44,
    };
  }

  if (phaseIndex >= 11 && phaseIndex <= 13) {
    return {
      enabled: true,
      color: 'rgba(255, 155, 96, 0.9)',
      opacity: 0.24 * opacityScale,
      size: 64,
      top: 12,
      left: 46,
    };
  }

  return {
    enabled: clearLike && (phaseIndex <= 1 || phaseIndex >= 14),
    color: 'rgba(209, 227, 255, 0.7)',
    opacity: clearLike ? 0.1 : 0.03,
    size: 48,
    top: 10,
    left: 50,
  };
}

function buildCloudSpecs(kind: WeatherBackgroundKind, cloudOpacity: number): WeatherCloudSpec[] {
  const base = [
    { top: 8, left: -8, width: 58, height: 24, opacity: cloudOpacity * 0.7, blur: 12, scale: 1.08, animation: 'cloudA' as const },
    { top: 20, left: 38, width: 52, height: 22, opacity: cloudOpacity * 0.56, blur: 14, scale: 1, animation: 'cloudB' as const },
    { top: 38, left: 10, width: 74, height: 28, opacity: cloudOpacity * 0.36, blur: 20, scale: 1.02, animation: 'cloudC' as const },
  ];

  if (kind === 'clear') {
    return [base[1]];
  }

  if (kind === 'partlyCloudy') {
    return base;
  }

  if (kind === 'snow') {
    return base.map((item, index) => ({
      ...item,
      top: item.top + (index === 0 ? 2 : 0),
      opacity: item.opacity * 1.08,
      blur: item.blur + 2,
    }));
  }

  if (kind === 'storm') {
    return base.map((item, index) => ({
      ...item,
      top: item.top + 2,
      left: item.left - (index === 0 ? 4 : 0),
      opacity: item.opacity * 1.22,
      blur: item.blur + 3,
    }));
  }

  return base.map((item, index) => ({
    ...item,
    top: item.top + (index === 2 ? 4 : 0),
    opacity: item.opacity * 1.12,
  }));
}

function adjustParticleType(base: WeatherParticleType, bundle: WeatherBundle | null): WeatherParticleType {
  if (!bundle?.now) return base;
  const icon = String(bundle.now.icon ?? '').toUpperCase();
  const text = String(bundle.now.text ?? '');

  if (base.startsWith('rain')) {
    if (icon.includes('HEAVY_RAIN') || icon.includes('STORM') || text.includes('暴雨') || text.includes('雷')) {
      return 'rain-heavy';
    }
    if (icon.includes('LIGHT_RAIN') || text.includes('小雨') || text.includes('阵雨')) {
      return 'rain-light';
    }
    return 'rain-medium';
  }

  if (base.startsWith('snow')) {
    if (icon.includes('HEAVY_SNOW') || icon.includes('STORM_SNOW') || text.includes('暴雪') || text.includes('大雪')) {
      return 'snow-heavy';
    }
    if (icon.includes('LIGHT_SNOW') || text.includes('小雪') || text.includes('阵雪')) {
      return 'snow-light';
    }
    return 'snow-medium';
  }

  return base;
}

function resolveWeatherKind(bundle: WeatherBundle | null): WeatherBackgroundKind {
  const icon = String(bundle?.now?.icon ?? bundle?.daily?.[0]?.iconDay ?? '').toUpperCase();
  const text = String(bundle?.now?.text ?? bundle?.daily?.[0]?.textDay ?? '');

  if (icon.includes('THUNDER') || icon.includes('STORM') || text.includes('雷')) return 'storm';
  if (icon.includes('ICE_RAIN') || text.includes('冻雨') || text.includes('冰雹')) return 'hail';
  if (icon.includes('RAIN') || text.includes('雨')) return 'rain';
  if (icon.includes('SNOW') || text.includes('雪')) return 'snow';
  if (icon.includes('FOG') || text.includes('雾')) return 'fog';
  if (icon.includes('HAZE') || text.includes('霾')) return 'haze';
  if (icon.includes('DUST') || icon.includes('SAND') || text.includes('沙') || text.includes('尘')) return 'sand';
  if (icon.includes('CLOUDY') || text.includes('阴')) return 'overcast';
  if (icon.includes('PARTLY_CLOUDY') || text.includes('多云') || (text.includes('云') && !text.includes('阴'))) return 'partlyCloudy';
  return 'clear';
}

function resolvePhaseIndex(bundle: WeatherBundle | null): number {
  const now = TimeService.getDate();
  const today = bundle?.daily?.[0];
  const sunriseAt = parseClockToTodayMs(today?.sunrise, now, 6, 0);
  const sunsetAt = parseClockToTodayMs(today?.sunset, now, 18, 0);

  if (sunsetAt <= sunriseAt) {
    return now.getHours() >= 19 || now.getHours() <= 5 ? 15 : 7;
  }

  const current = now.getTime();
  const daylight = sunsetAt - sunriseAt;
  const night = sunriseAt - (sunsetAt - 86_400_000);
  const h12 = daylight / 12;
  const h6 = daylight / 6;
  const n12 = night / 12;
  const n36 = night / 36;

  if (current >= sunriseAt - 3 * n12 && current < sunriseAt - 2 * n12) return 1;
  if (current >= sunriseAt - 2 * n12 && current < sunriseAt - n12) return 2;
  if (current >= sunriseAt - n12 && current < sunriseAt) return 3;
  if (current >= sunriseAt && current < sunriseAt + h12) return 4;
  if (current >= sunriseAt + h12 && current < sunriseAt + 2 * h12) return 5;
  if (current >= sunriseAt + 2 * h12 && current < sunriseAt + 2 * h12 + h6) return 6;
  if (current >= sunriseAt + 2 * h12 + h6 && current < sunriseAt + 2 * h12 + 2 * h6) return 7;
  if (current >= sunriseAt + 2 * h12 + 2 * h6 && current < sunriseAt + 2 * h12 + 3 * h6) return 8;
  if (current >= sunriseAt + 2 * h12 + 3 * h6 && current < sunriseAt + 2 * h12 + 4 * h6) return 9;
  if (current >= sunriseAt + 2 * h12 + 4 * h6 && current < sunriseAt + 2 * h12 + 4 * h6 + h12) return 10;
  if (current >= sunriseAt + 2 * h12 + 4 * h6 + h12 && current < sunsetAt) return 11;
  if (current >= sunsetAt && current < sunsetAt + n36) return 12;
  if (current >= sunsetAt + n36 && current < sunsetAt + 2 * n36) return 13;
  if (current >= sunsetAt + 2 * n36 && current < sunsetAt + 3 * n36) return 14;
  if (current >= sunsetAt + 3 * n36 && current < sunsetAt + 3 * n36 + n12) return 15;
  return 0;
}

function parseClockToTodayMs(
  value: string | undefined,
  now: Date,
  fallbackHour: number,
  fallbackMinute: number,
): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  const hour = match ? clampNumber(parseInt(match[1], 10), 0, 23) : fallbackHour;
  const minute = match ? clampNumber(parseInt(match[2], 10), 0, 59) : fallbackMinute;
  return TimeService
    .fromLocalParts(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
    .getTime();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function toPercent(value: number): string {
  return `${Math.max(0, Math.min(1, value)) * 100}%`;
}

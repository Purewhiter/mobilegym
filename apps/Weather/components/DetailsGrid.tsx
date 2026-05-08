import React from 'react';
import { WeatherNow, WeatherDaily } from '../types';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '../../../os/TimeService';
import { useWeatherStore } from '../state';
import { getLocalizedWindDirection } from '../utils/localizedText';
import { convertTemp, formatWind, formatPressure, pressureSuffix } from '../utils/unitConversion';

interface DetailsGridProps {
  weather: WeatherNow;
  today: WeatherDaily | null;
}

// ── 公共常量 & 辅助 ──────────────────────────────────────────────
// 角度系统对齐 Android Canvas：0° 在“正右(3点钟)”，正向为顺时针
const ARC_START = -225; // 与反编译 smali 一致（RealTime*Graph 系列）
const ARC_SWEEP = 270;
const ARC_RADIUS = 38;
const ARC_STROKE = 6;
const SVG_CENTER = 50;
const GAUGE_SIZE_PX = 68; // 源: real_time_circle_graph_common_width=68dp
const detailCardClassName = 'backdrop-blur-lg border rounded-[20px] pl-5 pr-3 pt-4 pb-3 flex h-[92px] text-white relative overflow-hidden';
const detailCardStyle = { backgroundColor: colors.card_surface_detail, borderColor: colors.card_border };

// Android drawArc 的极坐标（y 轴向下，角度顺时针）
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const sweep = endAngle - startAngle;
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  // sweepFlag=1：顺时针
  const sweepFlag = sweep >= 0 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`;
};

const pointOnArc = (cx: number, cy: number, r: number, percent: number) => {
  const angle = ARC_START + ARC_SWEEP * percent;
  return polar(cx, cy, r, angle);
};

// ── 颜色/渐变：来自 decompiled/Weather_decompiled ────────────────
// UV：源 smali: LL1/c;->c 与 RealTimeUvDetailNewGraph;->G
const UV_STOP_POS = [0.12, 0.2, 0.37, 0.5, 0.63, 0.74, 0.88, 1.0];
const UV_STOP_COLORS_ARGB = [
  -0x00c01f47, // -0xc01f47
  -0x00ea198e, // -0xea198e
  -0x000a20ef, // -0xa20ef
  -0x000352c9, // -0x352c9
  -0x0000b7a8, // -0xb7a8
  -0x001aa60f, // -0x1aa60f
  -0x008a9704, // -0x8a9704
  -0x00b4c701, // -0xb4c701
];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.trunc(n)));

const argbToCss = (argb: number) => {
  const u = argb >>> 0;
  const a = (u >>> 24) & 0xff;
  const r = (u >>> 16) & 0xff;
  const g = (u >>> 8) & 0xff;
  const b = u & 0xff;
  if (a === 255) {
    const to2 = (x: number) => x.toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(3))})`;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpArgb = (c1: number, c2: number, t: number) => {
  const u1 = c1 >>> 0;
  const u2 = c2 >>> 0;
  const a1 = (u1 >>> 24) & 0xff, r1 = (u1 >>> 16) & 0xff, g1 = (u1 >>> 8) & 0xff, b1 = u1 & 0xff;
  const a2 = (u2 >>> 24) & 0xff, r2 = (u2 >>> 16) & 0xff, g2 = (u2 >>> 8) & 0xff, b2 = u2 & 0xff;
  const a = Math.round(lerp(a1, a2, t));
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  // 重新拼 ARGB（保持 32-bit）
  return ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
};

const gradientColorAt = (positions: number[], colors: number[], p: number) => {
  const x = clamp01(p);
  if (x <= positions[0]) return colors[0];
  for (let i = 1; i < positions.length; i++) {
    if (x <= positions[i]) {
      const t = (x - positions[i - 1]) / (positions[i] - positions[i - 1]);
      return lerpArgb(colors[i - 1], colors[i], t);
    }
  }
  return colors[colors.length - 1];
};

const SegmentedArcStroke = ({
  startAngle,
  sweepAngle,
  segments,
  strokeWidth,
  radius,
  colorAtT,
  opacity = 1,
  gapCenterT,
  gapTWidth,
}: {
  startAngle: number;
  sweepAngle: number;
  segments: number;
  strokeWidth: number;
  radius: number;
  colorAtT: (t: number) => string;
  opacity?: number;
  gapCenterT?: number; // 0~1（沿 sweepAngle）
  gapTWidth?: number; // 0~1（沿 sweepAngle）
}) => {
  const hasGap = typeof gapCenterT === 'number' && typeof gapTWidth === 'number' && gapTWidth! > 0;
  const gap0 = hasGap ? clamp01(gapCenterT! - gapTWidth! / 2) : 0;
  const gap1 = hasGap ? clamp01(gapCenterT! + gapTWidth! / 2) : 0;

  const segs = Array.from({ length: segments }).map((_, i) => {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const midT = (t0 + t1) / 2;
    const inGap = hasGap && midT >= gap0 && midT <= gap1;
    const a0 = startAngle + sweepAngle * t0;
    const a1 = startAngle + sweepAngle * t1;
    return { d: arcPath(SVG_CENTER, SVG_CENTER, radius, a0, a1), color: colorAtT(midT), inGap };
  });

  const capR = strokeWidth / 2;
  const capStart = polar(SVG_CENTER, SVG_CENTER, radius, startAngle);
  const capEnd = polar(SVG_CENTER, SVG_CENTER, radius, startAngle + sweepAngle);
  const capStartColor = colorAtT(0);
  const capEndColor = colorAtT(1);

  return (
    <>
      {segs.map((s, idx) => (
        s.inGap ? null : (
          <path key={idx} d={s.d} fill="none" stroke={s.color} opacity={opacity} strokeWidth={strokeWidth} strokeLinecap="butt" />
        )
      ))}
      <circle cx={capStart.x} cy={capStart.y} r={capR} fill={capStartColor} opacity={opacity} />
      <circle cx={capEnd.x} cy={capEnd.y} r={capR} fill={capEndColor} opacity={opacity} />
    </>
  );
};

// ── 1. 紫外线 ─── 270° 渐变弧 + 中心数值 + UV 文字 ────────────
const UVGauge = ({ value }: { value: string }) => {
  // 源: RealTimeUvDetailNewGraph.smali
  // - 使用 SweepGradient 绘制“整段 270° 渐变弧”，不是“进度弧”
  // - UV 显示范围: 0~12（setShowProgress: uv/12*100）
  const uv = clampInt(parseInt(value) || 0, 0, 12);
  const percent = uv / 12;

  // 关键：SweepGradient 的起点对齐（smali: rotate 90° + drawArc start=-315°）
  // arc 覆盖的 gradient 位置区间约为 [45°, 315°] => [0.125, 0.875]
  const gradStartPos = 45 / 360;
  const gradSpanPos = 270 / 360;
  const uvArcColorAtT = (t: number) => {
    const p = gradStartPos + clamp01(t) * gradSpanPos;
    return argbToCss(gradientColorAt(UV_STOP_POS, UV_STOP_COLORS_ARGB, p));
  };

  const dot = pointOnArc(SVG_CENTER, SVG_CENTER, ARC_RADIUS, percent);
  const dotColor = uvArcColorAtT(percent);

  return (
    <svg viewBox="0 0 100 100" className="w-[62px] h-[62px]">
      {/* 整段渐变弧（用分段近似 SweepGradient） */}
      <SegmentedArcStroke
        startAngle={ARC_START}
        sweepAngle={ARC_SWEEP}
        radius={ARC_RADIUS}
        strokeWidth={ARC_STROKE}
        segments={90}
        colorAtT={uvArcColorAtT}
        opacity={0.95}
      />
      {/* 指示点（颜色取弧上对应位置） */}
      <circle cx={dot.x} cy={dot.y} r="4" fill={dotColor} stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      {/* 中心数值（真实 App 在弧心显示数字 + UV） */}
      <text x={SVG_CENTER} y="48" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">{uv}</text>
      <text x={SVG_CENTER} y="62" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">UV</text>
    </svg>
  );
};

// ── 2. 湿度 ─── 270° 蓝色弧（SweepGradient 模拟）+ 大水滴 ──────
// 源: RealTimeHumidityView.smali
//   SweepGradient colors=[#0DA8FF, #2295FF], positions=[0.78, 0.99]
const HUM_GRAD_POS = [0.78, 0.99];
const HUM_GRAD_COLORS = [-0x00f25701, -0x00dd6a01]; // #0DA8FF, #2295FF

const HumidityGauge = ({ value }: { value: string }) => {
  const s = useAppStrings(strings, stringsEn);
  const humidity = parseInt(value) || 0;
  const percent = Math.min(humidity / 100, 1);
  const progressSweep = ARC_SWEEP * percent;

  const getDesc = (h: number) => {
    if (h < 40) return s.humidity_dry;
    if (h <= 70) return s.humidity_comfortable;
    return s.humidity_humid;
  };

  // SweepGradient 沿弧方向插值（与 UV 相同原理）
  const humArcColorAtT = (t: number) => {
    const p = 45 / 360 + clamp01(t) * (270 / 360);
    return argbToCss(gradientColorAt(HUM_GRAD_POS, HUM_GRAD_COLORS, p));
  };

  const dropGradId = 'humDropGrad';

  return (
    <svg viewBox="0 0 100 100" className="w-[62px] h-[62px]">
      <defs>
        <linearGradient id={dropGradId} x1="60%" y1="15%" x2="25%" y2="90%">
          <stop offset="0%" stopColor="#0DA8FF" />
          <stop offset="100%" stopColor="#2295FF" />
        </linearGradient>
      </defs>
      {/* 底轨 */}
      <path d={arcPath(SVG_CENTER, SVG_CENTER, ARC_RADIUS, ARC_START, ARC_START + ARC_SWEEP)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={ARC_STROKE} strokeLinecap="round" />
      {/* 进度弧（分段模拟 SweepGradient，沿弧方向渐变） */}
      {percent > 0.005 && (
        <SegmentedArcStroke
          startAngle={ARC_START}
          sweepAngle={progressSweep}
          radius={ARC_RADIUS}
          strokeWidth={ARC_STROKE}
          segments={Math.max(20, Math.round(progressSweep / 3))}
          colorAtT={humArcColorAtT}
        />
      )}
      {/* 大水滴（放大居中，取自 real_time_humidity_center_icon.xml） */}
      <g transform="translate(39, 30) scale(1.7)">
        <path
          d="M1.086,7.88L5.556,1.176C5.767,0.858 6.234,0.858 6.445,1.176L10.915,7.88C13.532,11.805 10.718,17.063 6,17.063C1.283,17.063 -1.531,11.805 1.086,7.88Z"
          fill={`url(#${dropGradId})`}
        />
      </g>
      {/* 描述文字 */}
      <text x={SVG_CENTER} y="78" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">{getDesc(humidity)}</text>
    </svg>
  );
};

// ── 3. 体感温度 ─── 三段渐变弧 + 指针 ──────────────────────────
// 源: RealTimeTemperatureGraph.smali
//   冷段 SweepGradient: #25B1FF → #2295FF (蓝)
//   适宜 SweepGradient: #19DE6E → #14E772 (绿)
//   热段 SweepGradient: #FF9C39 → #FF6434 (橙→红橙), positions=[0.5509, 0.7667]
const TEMP_SEG_COLORS: Array<{ colors: number[]; positions: number[] }> = [
  { colors: [-0x00da4e01, -0x00dd6a01], positions: [0, 1] },     // #25B1FF → #2295FF
  { colors: [-0x00e62192, -0x00eb188e], positions: [0, 1] },     // #19DE6E → #14E772
  { colors: [-0x000063c7, -0x00009bcc], positions: [0.5509, 0.7667] }, // #FF9C39 → #FF6434
];

const FeelsLikeGauge = ({ value }: { value: string }) => {
  const s = useAppStrings(strings, stringsEn);
  const temp = parseInt(value) || 0;
  const rawT = (() => {
    // 源: RealTimeTemperatureGraph.smali private a(F)F (含 2 个 5° 间隙)
    const v = Math.min(55, Math.max(-55, temp));
    if (v < 13) return ((v + 55) / 68) * (135 / 270); // 0~135°
    if (v < 29) return (140 + ((v - 13) / 16) * 55) / 270; // 140~195°
    return (200 + ((v - 29) / 26) * 70) / 270; // 200~270°
  })();
  const t = clamp01(rawT);

  // 三段弧角度（-225~45，总 270°，中间留 5° 缺口）
  const seg1Start = ARC_START;
  const seg1End = ARC_START + 135;
  const seg2Start = ARC_START + 140;
  const seg2End = ARC_START + 195;
  const seg3Start = ARC_START + 200;
  const seg3End = ARC_START + 270;

  const pointerEnd = pointOnArc(SVG_CENTER, SVG_CENTER, ARC_RADIUS, t);

  // 段内 SweepGradient 颜色插值
  const segColorFn = (segIdx: number) => (localT: number) => {
    const { colors, positions } = TEMP_SEG_COLORS[segIdx];
    const p = 45 / 360 + clamp01(localT) * (270 / 360);
    return argbToCss(gradientColorAt(positions, colors, p));
  };

  const getFeelText = (t: number) => {
    if (t <= -10) return s.feels_like_extremely_cold;
    if (t <= 0) return s.feels_like_very_cold;
    if (t <= 10) return s.feels_like_cold;
    if (t <= 20) return s.feels_like_cool;
    if (t <= 28) return s.feels_like_comfortable;
    if (t <= 35) return s.feels_like_hot;
    return s.feels_like_extremely_hot;
  };

  return (
    <svg viewBox="0 0 100 100" className="w-[62px] h-[62px]">
      {/* 底轨 */}
      <path d={arcPath(SVG_CENTER, SVG_CENTER, ARC_RADIUS, ARC_START, ARC_START + ARC_SWEEP)} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={ARC_STROKE} strokeLinecap="round" />
      {/* 蓝段 (冷) — 分段渐变 #25B1FF → #2295FF */}
      <SegmentedArcStroke
        startAngle={seg1Start} sweepAngle={135} radius={ARC_RADIUS}
        strokeWidth={ARC_STROKE} segments={45} colorAtT={segColorFn(0)}
      />
      {/* 绿段 (适宜) — 分段渐变 #19DE6E → #14E772 */}
      <SegmentedArcStroke
        startAngle={seg2Start} sweepAngle={55} radius={ARC_RADIUS}
        strokeWidth={ARC_STROKE} segments={20} colorAtT={segColorFn(1)}
      />
      {/* 橙段 (热) — 分段渐变 #FF9C39 → #FF6434 */}
      <SegmentedArcStroke
        startAngle={seg3Start} sweepAngle={70} radius={ARC_RADIUS}
        strokeWidth={ARC_STROKE} segments={25} colorAtT={segColorFn(2)}
      />
      {/* 白色指针 */}
      <line x1={SVG_CENTER} y1={SVG_CENTER} x2={pointerEnd.x} y2={pointerEnd.y} stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx={SVG_CENTER} cy={SVG_CENTER} r="3" fill="white" />
      {/* 体感描述 */}
      <text x={SVG_CENTER} y="78" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">{getFeelText(temp)}</text>
    </svg>
  );
};

// ── 4. 风向 ─── 罗盘 + 风向指针 ──────────────────────────────
const WindCompass = ({ dir, deg }: { dir: string; deg: string }) => {
  const s = useAppStrings(strings, stringsEn);
  // 源 App 基于角度旋转（这里用 wind360 更接近）
  const d = clampInt(parseInt(deg) || 0, 0, 360);
  const rotate = d; // 0=北，顺时针
  const ringTicks = 60;

  return (
    <svg viewBox="0 0 100 100" className="w-[62px] h-[62px]">
      {/* 外圈刻度（真实 App 更密，这里 60 个近似） */}
      {Array.from({ length: ringTicks }).map((_, i) => (
        <line
          key={i}
          x1="50" y1="8" x2="50"
          y2={i % 15 === 0 ? 18 : i % 5 === 0 ? 16 : 14}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={i % 15 === 0 ? 2.5 : i % 5 === 0 ? 2 : 1.2}
          transform={`rotate(${i * (360 / ringTicks)} 50 50)`}
        />
      ))}
      {/* 方向标签 */}
      <text x="50" y="27" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9" fontWeight="bold">{s.wind_compass_north}</text>
      <text x="77" y="54" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">{s.wind_compass_east}</text>
      <text x="50" y="80" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">{s.wind_compass_south}</text>
      <text x="23" y="54" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9">{s.wind_compass_west}</text>

      {/* 风向指针（wind_arrow.xml，#1AABFF） */}
      <g transform={`rotate(${rotate} 50 50)`}>
        <g transform="translate(47.2, 26.8) scale(0.8)">
          <path
            d="M6.065,55.397C6.064,56.778 4.945,57.897 3.565,57.897C2.184,57.897 1.065,56.778 1.065,55.397C1.065,54.372 1.682,53.492 2.565,53.106L2.565,6.147C1.904,6.449 1.079,6.871 0.556,7.145C0.387,7.233 0.2,7.056 0.279,6.882L1.801,3.494L3.472,0.118C3.509,0.043 3.618,0.044 3.653,0.12L6.825,6.873C6.907,7.047 6.719,7.227 6.548,7.138C6.027,6.867 5.219,6.455 4.565,6.156L4.565,53.106C5.447,53.492 6.065,54.372 6.065,55.397ZM3.565,56.397C4.117,56.397 4.565,55.949 4.565,55.397C4.565,54.845 4.117,54.397 3.565,54.397C3.013,54.397 2.565,54.845 2.565,55.397C2.565,55.949 3.013,56.397 3.565,56.397Z"
            fill="#1aabff"
          />
        </g>
      </g>
      {/* 中心蓝色圆 + 白色风图标 */}
      <circle cx="50" cy="53" r="12" fill="#1AABFF" opacity="0.95" />
      <g transform="translate(40.5, 47) scale(1.3)">
        <path
          d="M1.371,5.18C2.336,4.884 3.332,4.733 4.28,4.733C4.892,4.733 5.424,4.781 5.953,4.829L5.974,4.831C6.495,4.878 7.015,4.925 7.599,4.925C8.239,4.925 8.771,4.71 9.144,4.347C9.516,3.983 9.723,3.478 9.723,2.909C9.723,1.737 8.818,0.9 7.687,0.9C6.872,0.9 6.143,1.393 5.829,2.07C5.682,2.354 5.741,2.702 6.053,2.871C6.349,3.025 6.711,2.922 6.897,2.579L6.901,2.573C7.027,2.296 7.336,2.074 7.687,2.074C7.931,2.074 8.141,2.156 8.29,2.298C8.438,2.439 8.531,2.646 8.531,2.909C8.531,3.17 8.44,3.377 8.283,3.52C8.125,3.664 7.893,3.751 7.599,3.751C7.071,3.751 6.582,3.707 6.071,3.66L6.014,3.655C5.483,3.607 4.925,3.558 4.28,3.558C3.169,3.558 2.039,3.746 1.012,4.053C0.835,4.106 0.703,4.211 0.627,4.348C0.552,4.484 0.537,4.644 0.58,4.799C0.625,4.955 0.726,5.079 0.868,5.149C1.009,5.219 1.183,5.232 1.371,5.18Z"
          fill="white"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
};

// ── 5. 日出日落 ─── 贝塞尔轨迹 + 渐变 ──────────────────────────
const SunPath = ({ sunrise, sunset }: { sunrise?: string; sunset?: string }) => {
  // 尽量贴近 RealTimeSunGraph.smali 的参数（dp）
  const W = 75; // real_time_sun_graph_width
  const H = 68; // real_time_sun_graph_height
  const waveW = 69; // real_time_sun_line_width
  const topY = 9.609985; // real_time_sun_line_margin_top
  const ampH = 34; // real_time_sun_line_height
  const bottomY = topY + ampH;
  const midY = (topY + bottomY) / 2;
  const amp = (bottomY - topY) / 2;
  const splitY = 37.5; // real_time_sun_line_split_height
  const horizonY = splitY - 2; // smali: c - 2
  const strokeW = 4.4; // real_time_sun_line_stroke_width
  const gapX = 2; // (real_time_sun_graph_gap - 1)

  const now = TimeService.getDate();
  const parseTime = (t: string | undefined) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const sunriseMin = parseTime(sunrise);
  const sunsetMin = parseTime(sunset);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 太阳位置（白天按线性插值；夜间贴边，真实 App 会继续沿曲线移动，但小卡片视觉上差别不大）
  const sunT = (() => {
    if (sunriseMin == null || sunsetMin == null || sunsetMin <= sunriseMin) return 0.5;
    return clamp01((nowMin - sunriseMin) / (sunsetMin - sunriseMin));
  })();

  // 曲线：用余弦近似（端点在下方，中间在上方）
  const curveY = (t: number) => midY + amp * Math.cos(2 * Math.PI * clamp01(t));
  const curveX = (t: number) => gapX + clamp01(t) * waveW;

  const sampleN = 80;
  const curvePoints = Array.from({ length: sampleN + 1 }).map((_, i) => {
    const t = i / sampleN;
    return { x: curveX(t), y: curveY(t) };
  });
  const curveD = curvePoints.reduce((acc, p, i) => {
    return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, '');

  const sunPos = { x: curveX(sunT), y: curveY(sunT) };
  const sunVisible = sunPos.y < splitY; // 上半部分更显眼；夜间会被弱化
  const clipR = 6; // real_time_sun_white_circle_radius
  const sunR = 4; // real_time_sun_circle_radius
  const maskId = 'sunCurveMask';
  const topClipId = 'sunTopClip';
  const bottomClipId = 'sunBottomClip';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
      <defs>
        {/* 源: RealTimeSunGraph; C = [#FBDA71, #FF784E], 垂直渐变 */}
        <linearGradient id="sunStrokeGrad" x1="0" y1="0" x2="0" y2="83.6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBDA71" />
          <stop offset="100%" stopColor="#FF784E" />
        </linearGradient>

        <clipPath id={topClipId}>
          <rect x="0" y="0" width={W} height={splitY} />
        </clipPath>
        <clipPath id={bottomClipId}>
          <rect x="0" y={splitY} width={W} height={H - splitY} />
        </clipPath>

        {/* 用 mask 在曲线上挖“太阳孔” */}
        <mask id={maskId}>
          <rect x="0" y="0" width={W} height={H} fill="white" />
          <circle cx={sunPos.x} cy={sunPos.y} r={clipR} fill="black" />
        </mask>
      </defs>

      {/* 分割虚线（地平线） */}
      <line x1="0" y1={horizonY} x2={W} y2={horizonY} stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="3,3" />

      {/* 曲线：上半段橙色渐变 */}
      <path
        d={curveD}
        fill="none"
        stroke="url(#sunStrokeGrad)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#${topClipId})`}
        mask={`url(#${maskId})`}
      />
      {/* 曲线：下半段阴影（真实 App 是 #33000000） */}
      <path
        d={curveD}
        fill="none"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath={`url(#${bottomClipId})`}
        mask={`url(#${maskId})`}
      />

      {/* 太阳点 */}
      <circle
        cx={sunPos.x}
        cy={sunPos.y}
        r={sunR}
        fill={sunVisible ? '#FBDA71' : 'rgba(255,255,255,0.18)'}
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1"
      />

      {/* 时间 */}
      <text x="1.3" y="62" textAnchor="start" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="600">
        {sunrise || '06:00'}
      </text>
      <text x={W - 1.3} y="62" textAnchor="end" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="600">
        {sunset || '18:00'}
      </text>
    </svg>
  );
};

// ── 6. 气压 ─── 270° 弧 + 大箭头 ───────────────────────────────
const PressureGauge = ({ value, pressureSuffixText = 'hPa' }: { value: string; pressureSuffixText?: string }) => {
  const pressure = parseInt(value) || 1013;
  // 源: RealTimePressureView.smali：弧是“整段”，刻度表示当前压力位置
  const min = 960;
  const max = 1066;
  const percent = clamp01((pressure - min) / (max - min));
  const tickAngle = ARC_START + ARC_SWEEP * percent;

  // 源: RealTimePressureView.smali + $real_time_pressure_arrow_*__0.xml
  const arcColorAtT = (t: number) => {
    // SweepGradient: colors [#0DA8FF, #2295FF], positions [0.787, 0.995]
    const positions = [0.787, 0.995];
    const colors = [-0x00f25701, -0x00dd6a01]; // #0DA8FF -> #2295FF
    // 旋转对齐同 UV：arc 覆盖约 [0.125,0.875]
    const p = 45 / 360 + clamp01(t) * (270 / 360);
    return argbToCss(gradientColorAt(positions, colors, p));
  };

  const arrowDir = pressure > 1013 ? 'up' : pressure < 1013 ? 'down' : 'equal';
  const arrowGradId = 'presArrowGrad';

  return (
    <svg viewBox="0 0 100 100" className="w-[62px] h-[62px]">
      <defs>
        <linearGradient id={arrowGradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0DA8FF" />
          <stop offset="100%" stopColor="#2295FF" />
        </linearGradient>
      </defs>
      {/* 整段蓝色弧（分段近似 SweepGradient） */}
      <SegmentedArcStroke
        startAngle={ARC_START}
        sweepAngle={ARC_SWEEP}
        radius={ARC_RADIUS}
        strokeWidth={ARC_STROKE}
        segments={80}
        colorAtT={arcColorAtT}
        opacity={0.95}
        gapCenterT={percent}
        gapTWidth={0.05}
      />
      {/* 当前刻度（短线） */}
      {(() => {
        const outer = polar(SVG_CENTER, SVG_CENTER, ARC_RADIUS + 2, tickAngle);
        const inner = polar(SVG_CENTER, SVG_CENTER, ARC_RADIUS - 6, tickAngle);
        return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" />;
      })()}

      {/* 箭头（居中 19x19dp，渐变填充） */}
      <g transform="translate(38.6, 36) scale(1.2)">
        {arrowDir === 'up' && (
          <path
            d="M9.48,17.199C9.189,17.199 9.043,17.199 8.927,17.156C8.736,17.086 8.586,16.936 8.516,16.745C8.473,16.629 8.473,16.483 8.473,16.192L8.473,4.317L4.308,8.481C4.102,8.687 3.999,8.79 3.887,8.842C3.702,8.927 3.49,8.927 3.306,8.842C3.193,8.79 3.09,8.687 2.884,8.481C2.679,8.276 2.576,8.173 2.524,8.06C2.439,7.876 2.439,7.663 2.524,7.479C2.576,7.366 2.679,7.263 2.884,7.058L8.762,1.18C8.968,0.974 9.071,0.871 9.184,0.819C9.278,0.776 9.379,0.754 9.48,0.755C9.581,0.754 9.682,0.776 9.776,0.819C9.889,0.871 9.992,0.974 10.198,1.18L16.076,7.058C16.281,7.263 16.384,7.366 16.436,7.479C16.521,7.663 16.521,7.876 16.436,8.06C16.384,8.173 16.281,8.276 16.076,8.481C15.87,8.687 15.767,8.79 15.654,8.842C15.47,8.927 15.258,8.927 15.073,8.842C14.96,8.79 14.858,8.687 14.652,8.481L10.486,4.316L10.486,16.192C10.486,16.483 10.486,16.629 10.443,16.745C10.373,16.936 10.223,17.086 10.033,17.156C9.916,17.199 9.771,17.199 9.48,17.199Z"
            fill={`url(#${arrowGradId})`}
          />
        )}
        {arrowDir === 'down' && (
          <path
            d="M9.52,2C9.811,2 9.957,2 10.073,2.043C10.264,2.113 10.414,2.263 10.484,2.454C10.527,2.57 10.527,2.716 10.527,3.007V14.882L14.692,10.718C14.898,10.512 15,10.409 15.113,10.357C15.298,10.272 15.51,10.272 15.694,10.357C15.807,10.409 15.91,10.512 16.116,10.718C16.322,10.924 16.424,11.026 16.476,11.139C16.561,11.324 16.561,11.536 16.476,11.72C16.424,11.833 16.322,11.936 16.116,12.142L10.238,18.02C10.032,18.225 9.929,18.328 9.816,18.38C9.722,18.424 9.621,18.445 9.52,18.444C9.419,18.445 9.318,18.424 9.224,18.38C9.111,18.328 9.008,18.225 8.802,18.02L2.924,12.142C2.719,11.936 2.616,11.833 2.564,11.72C2.479,11.536 2.479,11.324 2.564,11.139C2.616,11.026 2.719,10.924 2.924,10.718C3.13,10.512 3.233,10.409 3.346,10.357C3.53,10.272 3.742,10.272 3.927,10.357C4.039,10.409 4.142,10.512 4.348,10.718L8.514,14.883V3.007C8.514,2.716 8.514,2.57 8.556,2.454C8.627,2.263 8.777,2.113 8.967,2.043C9.084,2 9.229,2 9.52,2Z"
            fill={`url(#${arrowGradId})`}
          />
        )}
        {arrowDir === 'equal' && (
          <>
            <path d="M1.316,5.913C1.316,5.524 1.316,5.329 1.391,5.181C1.458,5.05 1.564,4.944 1.695,4.877C1.843,4.802 2.038,4.802 2.426,4.802H16.573C16.962,4.802 17.157,4.802 17.305,4.877C17.436,4.944 17.542,5.05 17.609,5.181C17.684,5.329 17.684,5.524 17.684,5.913L17.684,6.291C17.684,6.68 17.684,6.874 17.609,7.023C17.542,7.153 17.436,7.26 17.305,7.326C17.157,7.402 16.962,7.402 16.573,7.402H2.426C2.038,7.402 1.843,7.402 1.695,7.326C1.564,7.26 1.458,7.153 1.391,7.023C1.316,6.874 1.316,6.68 1.316,6.291L1.316,5.913Z" fill={`url(#${arrowGradId})`} />
            <path d="M1.316,12.909C1.316,12.52 1.316,12.325 1.391,12.177C1.458,12.046 1.564,11.94 1.695,11.873C1.843,11.798 2.038,11.798 2.426,11.798H16.573C16.962,11.798 17.157,11.798 17.305,11.873C17.436,11.94 17.542,12.046 17.609,12.177C17.684,12.325 17.684,12.52 17.684,12.909L17.684,13.287C17.684,13.676 17.684,13.87 17.609,14.019C17.542,14.149 17.436,14.256 17.305,14.322C17.157,14.398 16.962,14.398 16.573,14.398H2.426C2.038,14.398 1.843,14.398 1.695,14.322C1.564,14.256 1.458,14.149 1.391,14.019C1.316,13.87 1.316,13.676 1.316,13.287L1.316,12.909Z" fill={`url(#${arrowGradId})`} />
          </>
        )}
      </g>
      <text x={SVG_CENTER} y="80" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">{pressureSuffixText}</text>
    </svg>
  );
};

// ── 主组件 ──────────────────────────────────────────────────────
export const DetailsGrid: React.FC<DetailsGridProps> = ({ weather, today }) => {
  const s = useAppStrings(strings, stringsEn);
  const { tempUnit, windUnit, pressureUnit } = useWeatherStore((st) => st.settings);
  if (!weather) return null;
  const windDirection = getLocalizedWindDirection(weather.windDir, s);

  // UV 类别
  const uvCategory = (() => {
    const uv = parseInt(today?.uvIndex || '0');
    if (uv <= 2) return s.uv_very_weak;
    if (uv <= 4) return s.uv_weak;
    if (uv <= 6) return s.uv_moderate;
    if (uv <= 9) return s.uv_strong;
    return s.uv_very_strong;
  })();

  // 日出/日落：真实 App 在夜间显示”日出”
  const sunCard = (() => {
    const now = TimeService.getDate();
    const parseTime = (t: string | undefined) => {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const sunriseMin = parseTime(today?.sunrise) ?? 6 * 60;
    const sunsetMin = parseTime(today?.sunset) ?? 18 * 60;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const showSunrise = nowMin >= sunsetMin || nowMin < sunriseMin;
    return {
      title: showSunrise ? s.sunrise_label : s.sunset_label,
      time: showSunrise ? (today?.sunrise || '-') : (today?.sunset || '-'),
    };
  })();

  return (
    <div className="grid grid-cols-2 gap-2 px-[11px] mb-4">
      {/* 1. 紫外线：左侧大字=类别，仪表盘中心=数值+UV */}
      <div className={detailCardClassName} style={detailCardStyle}>
        <div className="flex flex-col justify-between z-10 w-[60px] flex-shrink-0">
          <span className="text-xs opacity-50">{s.uv_label}</span>
          <span className="text-[22px] leading-none font-semibold">{uvCategory}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <UVGauge value={today?.uvIndex || '0'} />
        </div>
      </div>

      {/* 2. 湿度：仪表盘中心=大水滴+描述 */}
      <div className={detailCardClassName} style={detailCardStyle}>
        <div className="flex flex-col justify-between z-10 w-[60px] flex-shrink-0">
          <span className="text-xs opacity-50">{s.humidity_label}</span>
          <span className="text-[22px] leading-none font-semibold">{weather.humidity}%</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <HumidityGauge value={weather.humidity} />
        </div>
      </div>

      {/* 3. 体感 */}
      <div className={detailCardClassName} style={detailCardStyle}>
        <div className="flex flex-col justify-between z-10 w-[60px] flex-shrink-0">
          <span className="text-xs opacity-50">{s.feels_like_label}</span>
          <span className="text-[22px] leading-none font-semibold">{convertTemp(weather.feelsLike, tempUnit)}°</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <FeelsLikeGauge value={weather.feelsLike} />
        </div>
      </div>

      {/* 4. 风向 */}
      <div className={detailCardClassName} style={detailCardStyle}>
        <div className="flex flex-col justify-between z-10 w-[60px] flex-shrink-0">
          <span className="text-xs opacity-50">{windDirection}</span>
          <span className="text-[22px] leading-none font-semibold">{formatWind(weather.windSpeed, weather.windScale, windUnit, s.wind_scale_suffix)}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <WindCompass dir={weather.windDir} deg={weather.wind360} />
        </div>
      </div>

      {/* 5. 日出日落 */}
      <div className={detailCardClassName} style={detailCardStyle}>
        <div className="flex flex-col justify-between z-10 w-[60px] flex-shrink-0">
          <span className="text-xs opacity-50">{sunCard.title}</span>
          <span className="text-[22px] leading-none font-semibold">{sunCard.time}</span>
        </div>
        <div className="flex-1 flex items-center justify-center -mr-1">
          <SunPath sunrise={today?.sunrise} sunset={today?.sunset} />
        </div>
      </div>

      {/* 6. 气压 */}
      <div className={detailCardClassName} style={detailCardStyle}>
        <div className="flex flex-col justify-between z-10 w-[60px] flex-shrink-0">
          <span className="text-xs opacity-50">{s.pressure_label}</span>
          <span className="text-[22px] leading-none font-semibold">{formatPressure(weather.pressure, pressureUnit)}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <PressureGauge value={weather.pressure} pressureSuffixText={pressureSuffix(pressureUnit)} />
        </div>
      </div>
    </div>
  );
};

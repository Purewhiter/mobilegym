/**
 * Android fling physics for the simulator.
 *
 * Real phones do not scroll by a fixed multiple of the finger travel: the
 * distance the content coasts after the finger lifts is set by the release
 * velocity, so a fast flick flies past the target while a slow drag stops
 * almost exactly where the finger left off. Modelling that is what lets the
 * simulator reproduce "scrolled one screen, landed two screens down".
 *
 * The formulas mirror AOSP android.widget.OverScroller (SplineOverScroller):
 *   DECELERATION_RATE = ln(0.78) / ln(0.9)
 *   physicalCoeff     = g * 39.37 * ppi * 0.84
 *   l                 = ln(INFLEXION * |v| / (friction * physicalCoeff))
 *   distance          = friction * physicalCoeff * exp(RATE / (RATE - 1) * l)
 *   duration          = 1000 * exp(l / (RATE - 1))
 */

const DECELERATION_RATE = Math.log(0.78) / Math.log(0.9);
const INFLEXION = 0.35;
const GRAVITY_EARTH = 9.80665; // m/s^2
const INCHES_PER_METER = 39.37;
const LOOK_AND_FEEL = 0.84;

/** ViewConfiguration.getScrollFriction() */
export const DEFAULT_SCROLL_FRICTION = 0.015;

const NB_SAMPLES = 100;
const START_TENSION = 0.5;
const END_TENSION = 1.0;
const P1 = START_TENSION * INFLEXION;
const P2 = 1.0 - END_TENSION * (1.0 - INFLEXION);

/** SPLINE_POSITION from OverScroller's static initializer. */
const SPLINE_POSITION: readonly number[] = (() => {
  const table = new Array<number>(NB_SAMPLES + 1).fill(0);
  let xMin = 0;
  for (let i = 0; i < NB_SAMPLES; i++) {
    const alpha = i / NB_SAMPLES;
    let xMax = 1;
    let x = 0;
    let coef = 0;
    for (let guard = 0; guard < 64; guard++) {
      x = xMin + (xMax - xMin) / 2;
      coef = 3 * x * (1 - x);
      const tx = coef * ((1 - x) * P1 + x * P2) + x * x * x;
      if (Math.abs(tx - alpha) < 1e-5) break;
      if (tx > alpha) xMax = x;
      else xMin = x;
    }
    table[i] = coef * ((1 - x) * START_TENSION + x) + x * x * x;
  }
  table[NB_SAMPLES] = 1;
  return table;
})();

export function physicalCoeff(ppi: number): number {
  return GRAVITY_EARTH * INCHES_PER_METER * ppi * LOOK_AND_FEEL;
}

/** Android density is dpi/160, which the simulator ties to devicePixelRatio. */
export function ppiForDpr(dpr: number): number {
  const safe = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return safe * 160;
}

function splineDeceleration(velocity: number, ppi: number, friction: number): number {
  return Math.log((INFLEXION * Math.abs(velocity)) / (friction * physicalCoeff(ppi)));
}

/** Coasting distance in the same pixel space as `velocity`. */
export function androidFlingDistance(
  velocity: number,
  ppi: number,
  friction: number = DEFAULT_SCROLL_FRICTION,
): number {
  if (!Number.isFinite(velocity) || Math.abs(velocity) < 1) return 0;
  if (!Number.isFinite(ppi) || ppi <= 0 || friction <= 0) return 0;
  const l = splineDeceleration(velocity, ppi, friction);
  return friction * physicalCoeff(ppi) * Math.exp((DECELERATION_RATE / (DECELERATION_RATE - 1)) * l);
}

/** Time the coasting phase takes, in milliseconds. */
export function androidFlingDurationMs(
  velocity: number,
  ppi: number,
  friction: number = DEFAULT_SCROLL_FRICTION,
): number {
  if (!Number.isFinite(velocity) || Math.abs(velocity) < 1) return 0;
  if (!Number.isFinite(ppi) || ppi <= 0 || friction <= 0) return 0;
  const l = splineDeceleration(velocity, ppi, friction);
  return 1000 * Math.exp(l / (DECELERATION_RATE - 1));
}

/** Fraction of the fling distance covered at `progress` in [0, 1]. */
export function androidFlingProgress(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const index = Math.min(NB_SAMPLES, Math.floor(NB_SAMPLES * progress));
  return SPLINE_POSITION[index];
}

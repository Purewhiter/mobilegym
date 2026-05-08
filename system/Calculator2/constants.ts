/**
 * AOSP Calculator 精确常量
 * 所有颜色/尺寸值来源于 /aosp-ref/apps/Calculator/res/values/
 */
// 颜色/尺寸资源已迁移到 apps/Calculator2/res/

/** 动画时长 (ms) — 来自 Android platform config */
export const ANIM_DURATION = {
  short: 200,
  medium: 400,
  long: 500,
} as const;

/** 求值常量 — 来自 CalculatorExpressionEvaluator.java */
export const EVAL_CONFIG = {
  maxDigits: 12,
  roundingDigits: 5,
} as const;

/**
 * Calculator 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '计算器',
} as const;

export type StringKey = keyof typeof strings;

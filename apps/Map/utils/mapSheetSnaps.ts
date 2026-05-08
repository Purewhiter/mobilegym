/**
 * 「本地生活脉搏」三档：露头 / 约 20% 高 / 顶满（盖住搜索栏区域）。
 */
export function computeExplorePulseSheetSnaps(containerHeight: number) {
  const h = containerHeight;
  const peek = 72;
  const middle = Math.max(Math.round(h * 0.2), peek + 48);
  const full = Math.max(h - 48, middle + 64);
  return { peek, middle, full };
}

/**
 * 「我 / 贡献」Tab Sheet 三档：露头 / **50% 屏高** / 顶满。
 * 中间档与本地生活脉搏（约 20%）不同。
 */
export function computeMapTabSheetSnaps(containerHeight: number) {
  const h = containerHeight;
  const peek = 72;
  const middle = Math.max(Math.round(h * 0.5), peek + 48);
  const full = Math.max(h - 48, middle + 64);
  return { peek, middle, full };
}

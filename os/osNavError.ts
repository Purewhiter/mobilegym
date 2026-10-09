import { now } from './TimeService';

// --- navigateToActivity 失败记录 ---
// 超时时任务栈已 push 但 UI 导航没发生，栈与界面可能不一致；外部（bench）原本无从感知。
// 记录最近一次失败，暴露在 __SIM__.getState().os.lastNavError；成功导航后清空。
// 模块级单例：页面 reload 即重置（与原 OSContext 模块作用域宿主时的语义一致）。

export interface NavError {
  route: string;
  activityId: string;
  timestamp: number;
}

let lastNavError: NavError | null = null;

export function recordNavError(route: string, activityId: string): void {
  lastNavError = { route, activityId, timestamp: now() };
}

export function clearNavError(): void {
  lastNavError = null;
}

export function getLastNavError(): NavError | null {
  return lastNavError;
}

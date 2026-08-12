import type { AppId } from './types';
import { KeyboardService } from './keyboard/KeyboardService';
import { TaskManager } from './TaskManager';
import { IntentResolver } from './IntentResolver';
import { BackDispatcher } from './BackDispatcher';
import { routeSetPreference } from './managers/registry';

/**
 * OS 动作门面：从 OSContext 提升出来的模块级命令函数。
 *
 * 提升依据（见 docs/pending/split-plans-2026-08-12.md 方案一）：这些函数原为
 * OSProvider 内 deps=[] 的 useCallback，闭包体不捕获任何 render 快照——状态
 * 一律经 TaskManager.getState() / IntentResolver.getState() 即时读取，因此
 * 提升为模块单例函数后单次会话内行为等价。
 *
 * 依赖约束：本模块不得 import osApi / sim/simApi / OSContext（组合根方向唯一）。
 */

export function buildOsDebugStack(tag: string): string {
  try {
    throw new Error(tag);
  } catch (error) {
    if (!(error instanceof Error) || !error.stack) return 'n/a';
    return error.stack
      .split('\n')
      .slice(1, 5)
      .map((line) => line.trim())
      .join(' <- ');
  }
}

export function launchApp(appId: AppId): void {
  KeyboardService.hide();
  TaskManager.launchApp(appId);
}

export function launchTaskById(taskId: string): void {
  KeyboardService.hide();
  TaskManager.activateTask(taskId);
}

export function goHome(): void {
  KeyboardService.hide();
  TaskManager.goHome();
}

export function showRecents(): void {
  KeyboardService.hide();
  TaskManager.showRecents();
}

export function setBrightness(value: number): void {
  routeSetPreference('brightness', value, { source: 'os' });
}

export function setVolume(value: number): void {
  routeSetPreference('media_volume', value, { source: 'os' });
}

export function chooseIntentActivity(appId: AppId): void {
  IntentResolver.chooseIntentActivity(appId);
}

export function cancelIntentChooser(): void {
  IntentResolver.cancelIntentChooser();
}

export function handleSystemBack(): void {
  BackDispatcher.handleBack();
}

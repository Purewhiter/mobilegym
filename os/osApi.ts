import type { AppId, OSState } from './types';
import type { OSApi } from './types/globals';
import { KeyboardService } from './keyboard/KeyboardService';
import { ClipboardService } from './ClipboardService';
import { NotificationService } from './NotificationService';
import { PermissionService } from './PermissionService';
import { QuickSettingsService } from './QuickSettingsService';
import { SystemShadeService } from './SystemShadeService';
import StatusBarService from './StatusBarService';
import localeApi from './locale';
import BroadcastBus, { BROADCAST_ACTIONS } from './BroadcastBus';
import { SmsGateway } from './SmsGateway';
import * as SkinService from './SkinService';
import {
  deriveIntentStack,
  getActiveAppId,
  getActiveTask,
  getTaskTopActivity,
} from './taskUtils';
import PackageManagerService from './PackageManagerService';
import ContentResolver from './ContentResolver';
import { AppNavigatorRegistry } from './AppNavigatorRegistry';
import { TaskManager } from './TaskManager';
import { PendingIntent } from './PendingIntent';
import { ConnectivityManager } from './managers/ConnectivityManager';
import { routeGetPreference, routeSetPreference } from './managers/registry';
import {
  launchApp,
  launchTaskById,
  goHome,
  showRecents,
  setBrightness,
  setVolume,
  handleSystemBack,
  finishActivity,
  closeTask,
  closeApp,
  startActivity,
  startActivityForResult,
  setResult,
  openApp,
} from './osActions';

/**
 * 组装 `window.__OS__` 字面量：osActions 命令函数 + 各 OS 服务单例。
 *
 * - 显式 `: OSApi` 返回标注 = globals.d.ts 契约的静态校验点（tsc --noEmit 守卫），不可移除。
 * - 工厂必须无赋值以外的副作用（OSProvider 挂载 effect 调用；StrictMode 双 mount 幂等）。
 * - `state` 字段是 render 快照：OSContext 在 deps=[osStateForApi] 的 effect 里重建整个
 *   api 对象，保证 `__OS__.state` 随任务栈刷新。其余成员全部经 getState() 即时读取。
 */
export function buildOsApi(stateSnapshot: OSState & { activeAppId?: AppId | null }): OSApi {
  return {
    state: stateSnapshot,
    launchApp,
    launchTaskById,
    goHome,
    showRecents,
    closeTask,
    closeApp,
    finishActivity,
    setBrightness,
    setVolume,
    getSkin: () => SkinService.getActiveSkinId(),
    setSkin: (id: string) => {
      const next = id === 'neutral' ? 'neutral' : id === 'test_v1' ? 'test_v1' : 'default';
      SkinService.setSkin(next);
    },
    handleBack: handleSystemBack,
    getState: () => ({ ...TaskManager.getState(), activeAppId: getActiveAppId(TaskManager.getState()) }),
    getAppRoute: (appId?: AppId | string) => AppNavigatorRegistry.getAppRoute(appId),
    openApp,
    startActivity,
    startActivityForResult,
    setResult,
    hasActiveIntent: () => deriveIntentStack(TaskManager.getState().tasks).length > 0,
    resolveActivity: (intent: { action: string; scheme?: string; type?: string }) => {
      return PackageManagerService.resolveActivityAll(intent);
    },
    getIntentPayload: (appIdOrActivityId?: AppId | string) => {
      const latestState = TaskManager.getState();
      if (appIdOrActivityId) {
        for (const task of latestState.tasks) {
          for (const act of task.stack) {
            if (act.activityId === appIdOrActivityId && act.intent) return act.intent;
          }
        }

        const activeTask = getActiveTask(latestState);
        if (!activeTask) return null;
        for (let i = activeTask.stack.length - 1; i >= 0; i -= 1) {
          const act = activeTask.stack[i];
          if (act.appId === appIdOrActivityId && act.intent) return act.intent;
        }
        return null;
      }

      const top = getTaskTopActivity(getActiveTask(latestState));
      return top?.intent ?? null;
    },

    notifications: NotificationService,
    permissions: PermissionService,
    clipboard: ClipboardService,
    statusBar: StatusBarService,
    keyboard: KeyboardService,
    quickSettings: QuickSettingsService,
    shade: SystemShadeService,
    locale: localeApi,
    device: {
      getPreference: routeGetPreference,
      setPreference: routeSetPreference,
      setNearbyWifi: ConnectivityManager.setNearbyWifi,
      setNearbyBluetooth: ConnectivityManager.setNearbyBluetooth,
      connectWifi: ConnectivityManager.connectToAP,
      disconnectWifi: ConnectivityManager.disconnectWifi,
      connectBluetooth: ConnectivityManager.connectBluetooth,
      disconnectBluetooth: ConnectivityManager.disconnectBluetooth,
    },
    broadcast: {
      sendBroadcast: BroadcastBus.sendBroadcast,
      sendOrderedBroadcast: BroadcastBus.sendOrderedBroadcast,
      registerReceiver: BroadcastBus.registerReceiver,
      actions: BROADCAST_ACTIONS,
    },
    content: ContentResolver,
    pendingIntent: PendingIntent,
    sms: SmsGateway,
  };
}

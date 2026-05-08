// Global App State Registry
// All apps now use Zustand stores via createAppStoreWithActions.
// State is read directly from the store registry.

import type { AppId } from './types';
import { getAllStoreStates } from './createAppStore';

/**
 * 获取所有 App 状态（从 Zustand store registry 读取）。
 */
export const getAllAppStates = (): Partial<Record<AppId, any>> => {
    const states: Partial<Record<AppId, any>> = {};
    const storeStates = getAllStoreStates();
    for (const [appId, state] of Object.entries(storeStates)) {
        states[appId as AppId] = state;
    }
    return states;
};

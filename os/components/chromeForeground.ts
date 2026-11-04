/**
 * Status-bar and gesture-bar foreground (light/dark text) and hidden declarations,
 * read from the DOM of the foreground activity or launcher. DOM contract: activity
 * containers are rendered by SystemShell as `#activity-container-<activityId>`;
 * the launcher root carries `data-launcher="true"`.
 */

import { getActiveTopActivityId } from '../taskUtils';

import type { AppId, OSState } from '../types';

export const getLightTextFromDeclaredForeground = (foreground: string | null | undefined): boolean | null => {
  if (foreground === 'light') return true;
  if (foreground === 'dark') return false;
  return null;
};

export const getLightTextFromManifestForeground = (foreground: 'dark' | 'light' | undefined): boolean | null => {
  if (foreground === 'light') return true;
  if (foreground === 'dark') return false;
  return null;
};

export const queryLastForegroundDeclaration = (
  root: ParentNode | null,
  attributeName: 'data-status-bar-foreground' | 'data-navigation-bar-foreground' | 'data-status-bar-hidden',
): HTMLElement | null => {
  if (!root) return null;
  if (root instanceof HTMLElement && root.hasAttribute(attributeName)) {
    return root;
  }
  // Pages kept on the back stack but not shown (ActivityRouteHost) do not declare the chrome.
  const matches = [...root.querySelectorAll<HTMLElement>(`[${attributeName}]`)]
    .filter((el) => !el.closest('[data-resident-screen="hidden"]'));
  return matches.length > 0 ? matches[matches.length - 1] : null;
};

export type ChromeTaskSnapshot = {
  activeTopActivityId: string | null;
  activeRootAppId: AppId | null;
  isLauncherVisible: boolean;
  isRecentsVisible: boolean;
};

export const getChromeTaskSnapshot = (state: OSState): ChromeTaskSnapshot => {
  const activeTask = state.activeTaskId
    ? state.tasks.find((task) => task.taskId === state.activeTaskId) ?? null
    : null;
  return {
    activeTopActivityId: getActiveTopActivityId(state),
    activeRootAppId: activeTask?.rootAppId ?? null,
    isLauncherVisible: state.isLauncherVisible,
    isRecentsVisible: state.isRecentsVisible,
  };
};

export const areChromeTaskSnapshotsEqual = (a: ChromeTaskSnapshot, b: ChromeTaskSnapshot): boolean => {
  return a.activeTopActivityId === b.activeTopActivityId
    && a.activeRootAppId === b.activeRootAppId
    && a.isLauncherVisible === b.isLauncherVisible
    && a.isRecentsVisible === b.isRecentsVisible;
};

export const getForegroundObserverTarget = (
  activeTopActivityId: string | null,
  isLauncherVisible: boolean,
  isRecentsVisible: boolean,
): ParentNode | null => {
  if (isLauncherVisible && !isRecentsVisible) {
    return document.querySelector('[data-launcher="true"]');
  }
  if (!activeTopActivityId) return null;
  return document.getElementById(`activity-container-${activeTopActivityId}`);
};

export const getDeclaredForeground = (
  root: ParentNode | null,
  attributeName: 'data-status-bar-foreground' | 'data-navigation-bar-foreground',
): boolean | null => {
  return getLightTextFromDeclaredForeground(
    queryLastForegroundDeclaration(root, attributeName)?.getAttribute(attributeName),
  );
};

export const getDeclaredHidden = (
  root: ParentNode | null,
  attributeName: 'data-status-bar-hidden',
): boolean => {
  const value = queryLastForegroundDeclaration(root, attributeName)?.getAttribute(attributeName);
  return value === 'true';
};

import React, { useEffect, useMemo, useState } from 'react';
import { BackDispatcher } from '../BackDispatcher';
import { AppIcon } from './AppIcon';
import {
  PermissionService,
  PERMISSION_REQUEST_BACK_EVENT,
  PERMISSION_REQUEST_OPEN_EVENT,
  PERMISSION_REQUEST_RESULT_EVENT,
} from '../PermissionService';
import {
  getPermissionDisplayName,
  getPermissionGroup,
  type PermissionId,
  type PermissionStatus,
} from '../permissions';
import { getAppManifest, getLocalizedAppName } from '../data/appRegistry';
import type { AppId } from '../types';

interface PermissionRequestDetail {
  requestId: string;
  appId: AppId;
  permIds: PermissionId[];
  rationale?: string;
}

export const PermissionDialogHost: React.FC = () => {
  const [request, setRequest] = useState<PermissionRequestDetail | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const denyCurrentRequest = () => {
    if (!request) return false;
    const deniedStatus: PermissionStatus = dontAskAgain ? 'denied_forever' : 'denied';
    const results: Partial<Record<PermissionId, PermissionStatus>> = {};
    for (const permissionId of request.permIds) {
      results[permissionId] = deniedStatus;
    }
    window.dispatchEvent(
      new CustomEvent(PERMISSION_REQUEST_RESULT_EVENT, {
        detail: { requestId: request.requestId, results },
      }),
    );
    setRequest(null);
    setDontAskAgain(false);
    return true;
  };

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<PermissionRequestDetail>).detail;
      if (!detail?.requestId || !detail.appId || !Array.isArray(detail.permIds) || detail.permIds.length === 0) {
        return;
      }
      setRequest({
        requestId: detail.requestId,
        appId: detail.appId,
        permIds: detail.permIds,
        rationale: detail.rationale,
      });
      setDontAskAgain(false);
    };

    window.addEventListener(PERMISSION_REQUEST_OPEN_EVENT, handleOpen as EventListener);
    return () => {
      window.removeEventListener(PERMISSION_REQUEST_OPEN_EVENT, handleOpen as EventListener);
    };
  }, []);

  const requestGroupNames = useMemo(() => {
    if (!request) return [];
    const names: string[] = [];
    const seen = new Set<string>();

    for (const permissionId of request.permIds) {
      const group = getPermissionGroup(permissionId);
      if (group) {
        if (seen.has(group.id)) continue;
        seen.add(group.id);
        names.push(group.displayName);
      } else {
        names.push(getPermissionDisplayName(permissionId));
      }
    }

    return names;
  }, [request]);

  const deniedOnce = useMemo(() => {
    if (!request) return false;
    return request.permIds.some((permissionId) => PermissionService.checkPermission(request.appId, permissionId) === 'denied');
  }, [request]);

  useEffect(() => {
    return BackDispatcher.register('permission.dialog', () => denyCurrentRequest(), 1000);
  }, [request, dontAskAgain]);

  useEffect(() => {
    const handleBack = (event: Event) => {
      if (!request) return;
      event.preventDefault();
      denyCurrentRequest();
    };

    window.addEventListener(PERMISSION_REQUEST_BACK_EVENT, handleBack as EventListener);
    return () => {
      window.removeEventListener(PERMISSION_REQUEST_BACK_EVENT, handleBack as EventListener);
    };
  }, [dontAskAgain, request]);

  if (!request) return null;

  const manifest = getAppManifest(request.appId);
  const appName = manifest ? getLocalizedAppName(request.appId) : request.appId;

  const submitResult = (status: PermissionStatus) => {
    const results: Partial<Record<PermissionId, PermissionStatus>> = {};
    for (const permissionId of request.permIds) {
      results[permissionId] = status;
    }

    window.dispatchEvent(
      new CustomEvent(PERMISSION_REQUEST_RESULT_EVENT, {
        detail: { requestId: request.requestId, results },
      }),
    );

    setRequest(null);
    setDontAskAgain(false);
  };

  return (
    <div className="fixed inset-0 z-[5200] flex items-center justify-center bg-black/45">
      <div className="mx-6 w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {manifest ? (
            <AppIcon manifest={manifest} size={40} radius={12} showShadow />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-gray-200" />
          )}
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold text-gray-900">{appName}</div>
            {manifest?.packageName ? <div className="truncate text-[12px] text-gray-400">{manifest.packageName}</div> : null}
          </div>
        </div>

        <div className="mt-6 text-[17px] leading-7 text-gray-900">
          <div>允许 {appName} 访问</div>
          <div>您的 {requestGroupNames.join('、')}？</div>
        </div>

        <div className="mt-3 text-[13px] leading-6 text-gray-500">• {requestGroupNames.join(' • ')}</div>
        {request.rationale ? <div className="mt-2 text-[12px] leading-5 text-gray-500">{request.rationale}</div> : null}

        {deniedOnce ? (
          <label className="mt-5 flex items-center gap-2 text-[14px] text-gray-700">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>不再询问</span>
          </label>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className="h-11 rounded-xl bg-gray-100 text-[15px] font-medium text-gray-700 active:bg-gray-200"
            onClick={() => submitResult(dontAskAgain ? 'denied_forever' : 'denied')}
          >
            拒绝
          </button>
          <button
            className="h-11 rounded-xl bg-blue-600 text-[15px] font-medium text-white active:bg-blue-700"
            onClick={() => submitResult('granted')}
          >
            允许
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionDialogHost;

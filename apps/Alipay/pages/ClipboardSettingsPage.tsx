import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcClipboard, IcMore, IcDot } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
export const ClipboardSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const allowRead = settings.general.clipboardAllowRead;

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.clipboard}</span>
        <div className="flex items-center gap-3">
          <button className="p-1">
            <IcMore size={22} className="text-gray-800" />
          </button>
          <button className="p-1">
            <IcDot size={22} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <div className="bg-app-surface px-4 py-5 flex items-start gap-3 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-app-primary flex items-center justify-center">
            <IcClipboard size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-base font-medium text-gray-900">{s.clipboard}</div>
            <div className="text-xs text-gray-400 mt-2 leading-relaxed">
              {s.clipboard_on_description}
            </div>
          </div>
        </div>

        <div className="bg-app-surface mt-3 border-t border-gray-100">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <div className="text-sm font-medium text-gray-900">{s.allow_clipboard_access}</div>
              <div className="text-xs text-gray-400 mt-2 leading-relaxed">
                {s.clipboard_off_description}
              </div>
            </div>
            <button
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: 'clipboard.allowRead.toggle' },
                { onTrigger: () => setSettings((prev) => ({ ...prev, general: { ...prev.general, clipboardAllowRead: !prev.general.clipboardAllowRead } })) },
              )}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${allowRead ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            >
              <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
            </button>
          </div>
        </div>
        <div className="h-10" />
      </div>
    </div>
  );
};

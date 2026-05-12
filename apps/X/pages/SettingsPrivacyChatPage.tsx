import React, { useState } from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';

const SwitchSlider: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => {
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(value ? 1 : 0);
  const startXRef = React.useRef(0);
  const startPosRef = React.useRef(pos);
  React.useEffect(() => { setPos(value ? 1 : 0); }, [value]);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => { setDragging(true); startXRef.current = e.clientX; startPosRef.current = pos; (e.target as Element).setPointerCapture?.((e as any).pointerId); };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (!dragging) return; setPos(Math.max(0, Math.min(1, startPosRef.current + (e.clientX - startXRef.current) / 40))); };
  const onPointerUp = () => { if (!dragging) return; setDragging(false); const nextVal = pos > 0.5; setPos(nextVal ? 1 : 0); onChange(nextVal); };
  return (
    <div role="switch" aria-checked={value} className={`relative h-6 w-11 rounded-full ${value ? 'bg-green-500' : 'bg-gray-200'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={() => { if (dragging) return; const next = !value; setPos(next ? 1 : 0); onChange(next); }}>
      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-white/70 transition-transform" style={{ transform: `translateX(${pos * 22}px)` }} />
    </div>
  );
};

export const SettingsPrivacyChatPage: React.FC = () => {
  const user = useXStore(selectUser);
  const settings = useXStore(s => s.settings);
  const updateSettings = useXStore(s => s.updateSettings);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const callPerms = [
    { label: isEnglish ? 'People in your address book' : '通讯录中的人', key: 'allowCallFromLogs' as const },
    { label: isEnglish ? 'People you follow' : '你关注的人', key: 'allowCallFromFollowing' as const },
    { label: isEnglish ? 'Verified users' : '认证用户', key: 'allowCallFromVerified' as const },
  ];

  const dmRequestOptions = [
    { key: 'none', label: isEnglish ? 'No one' : '没有人' },
    { key: 'verified', label: isEnglish ? 'Verified users' : '认证用户' },
    { key: 'everyone', label: isEnglish ? 'Everyone' : '每个人' },
  ] as const;

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Direct Messages' : '聊天'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">{isEnglish ? 'Manage settings related to your Direct Messages and calls.' : '管理与你的私信和通话相关的设置。'}</div>
      <div className="px-4">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Notifications' : '通知'}</div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Only enable push notifications for chats' : '仅启用聊天的推送通知'}</div>
          <SwitchSlider value={settings.pushOnlyDm} onChange={v => updateSettings({ pushOnlyDm: v })} />
        </div>
        <div className="mb-3 text-[12px] text-gray-500">{isEnglish ? 'This will disable all other push notifications from X.' : '这将禁用 X 的所有其他推送通知。'}</div>
      </div>
      <div className="px-4">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Allow message requests from' : '允许来自以下用户的私信请求'}</div>
        <div className="space-y-2">
          {dmRequestOptions.map(opt => (
            <div key={opt.key} className="flex cursor-pointer items-center justify-between rounded px-1 py-2 transition-colors active:bg-gray-50" onClick={() => updateSettings({ dmRequestFrom: opt.key })}>
              <div className="text-[15px]">{opt.label}</div>
              <div className={`h-5 w-5 rounded-full border ${settings.dmRequestFrom === opt.key ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="px-4">
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Enable audio and video calls' : '启用音频和视频通话'}</div>
          <SwitchSlider value={settings.enableAvCalls} onChange={v => updateSettings({ enableAvCalls: v })} />
        </div>
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Allow audio and video calls from' : '允许接听以下用户的音频和视频通话'}</div>
        <div className="space-y-2">
          {callPerms.map(item => (
            <div key={item.key} className="flex cursor-pointer items-center justify-between rounded px-1 py-2 transition-colors active:bg-gray-50" onClick={() => updateSettings({ [item.key]: !settings[item.key] })}>
              <div className="text-[15px]">{item.label}</div>
              <div className={`h-5 w-5 rounded-sm border ${settings[item.key] ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="px-4">
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Always relay calls' : '始终转接呼叫'}</div>
          <SwitchSlider value={settings.alwaysProxyCalls} onChange={v => updateSettings({ alwaysProxyCalls: v })} />
        </div>
        <div className="mb-3 text-[12px] text-gray-500">{isEnglish ? 'Enable this to avoid exposing your IP address to contacts during calls.' : '启用此设置可避免在通话过程中向联系人暴露你的 IP 地址。'}</div>
      </div>
      <div className="px-4">
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Filter low-quality messages' : '过滤低质量私信'}</div>
          <SwitchSlider value={settings.filterLowQualityDMs} onChange={v => updateSettings({ filterLowQualityDMs: v })} />
        </div>
        <div className="mb-3 text-[12px] text-gray-500">{isEnglish ? 'Hide message requests detected as spam or low-quality content.' : '对被检测为垃圾或低质量内容的私信请求进行隐藏。'}</div>
      </div>
      <div className="px-4">
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Enable debug logs' : '启用调试日志'}</div>
          <SwitchSlider value={settings.enableDebugLog} onChange={v => updateSettings({ enableDebugLog: v })} />
        </div>
        <div className="mb-3 text-[12px] text-gray-500">{isEnglish ? 'Logs do not include message contents, but they may include message metadata for troubleshooting.' : '日志不包含私信内容，但会包含额外元数据以便排查问题。'}</div>
      </div>
    </div>
  );
};

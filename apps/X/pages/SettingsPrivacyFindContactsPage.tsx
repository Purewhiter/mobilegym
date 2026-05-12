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

export const SettingsPrivacyFindContactsPage: React.FC = () => {
  const user = useXStore(selectUser);
  const settings = useXStore(s => s.settings);
  const updateSettings = useXStore(s => s.updateSettings);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Discoverability and contacts' : '允许认识我的人找到我和联系人'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">{isEnglish ? 'Control whether people who know you can find you, and manage imported contacts.' : '控制认识你的人是否能找到你，并管理已导入的联系人。'}</div>
      <div className="px-4 py-2">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Allow people who know you to find you' : '允许认识我的人找到我'}</div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Let others find you by your email' : '允许他人通过邮箱地址找到你'}</div>
          <SwitchSlider value={settings.allowEmail} onChange={v => updateSettings({ allowEmail: v })} />
        </div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Let others find you by your phone number' : '允许他人通过手机号找到你'}</div>
          <SwitchSlider value={settings.allowPhone} onChange={v => updateSettings({ allowPhone: v })} />
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Contacts' : '联系人'}</div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Sync address book contacts' : '同步通讯录联系人'}</div>
          <SwitchSlider value={settings.syncContacts} onChange={v => updateSettings({ syncContacts: v })} />
        </div>
        <div className="text-[13px] text-gray-600">{isEnglish ? 'Contacts from your address book will be synced regularly to help you connect with friends. Turning this off will stop syncing.' : '云端通讯录联系人将定期同步，以帮助你与好友连接。关闭后将停止同步。'} <span className="text-blue-500">{isEnglish ? 'Learn more' : '了解更多'}</span></div>
      </div>
      <div className="px-4 py-8">
        <button className="w-full rounded-full bg-red-500 py-3 text-[15px] font-semibold text-white active:bg-red-600">{isEnglish ? 'Remove all contacts' : '移除所有联系人'}</button>
      </div>
    </div>
  );
};

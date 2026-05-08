import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcMore, IcDot, IcInfo } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type ToggleKey =
  | 'tradeSecurity'
  | 'service'
  | 'activity'
  | 'avCall'
  | 'avCallPopup'
  | 'friendReminder'
  | 'friendDetail'
  | 'sound'
  | 'vibration'
  | 'avCallRing';

type IcSettings = Record<ToggleKey, boolean>;

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => {
  return (
    <button
      onClick={onChange}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${checked ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
    >
      <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
    </button>
  );
};

const InfoBadge: React.FC = () => {
  return (
    <span className="ml-2 w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center">
      <IcInfo size={12} className="text-gray-400" />
    </span>
  );
};

export const NotificationSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const appSettings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const settings = appSettings.notifications as IcSettings;
  const toggle = (key: ToggleKey) =>
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));

  const Row: React.FC<{ label: string; info?: boolean; value: boolean; toggleProps: any; disabled?: boolean }> = ({
    label,
    info,
    value,
    toggleProps,
    disabled,
  }) => {
    return (
      <div className={`flex items-center justify-between px-4 py-4 ${disabled ? 'opacity-60' : ''}`}>
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-800">{label}</span>
          {info && <InfoBadge />}
        </div>
        <button
          {...toggleProps}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${value ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
        >
          <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.notifications_2}</span>
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
        <div className="px-4 pt-4 pb-2 text-xs text-gray-400">{s.when_alipay_is_closed}</div>
        <div className="bg-app-surface divide-y divide-gray-100">
          <Row
            label={s.transaction_and_security_alerts}
            info
            value={settings.tradeSecurity}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.tradeSecurity.toggle' }, { onTrigger: () => toggle('tradeSecurity') })}
          />
          <Row
            label={s.service_notifications}
            info
            value={settings.service}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.service.toggle' }, { onTrigger: () => toggle('service') })}
          />
          <Row
            label={s.activity_notifications}
            info
            value={settings.activity}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.activity.toggle' }, { onTrigger: () => toggle('activity') })}
          />
          <Row
            label={s.voice_and_video_call_notifications}
            value={settings.avCall}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.avCall.toggle' }, { onTrigger: () => toggle('avCall') })}
          />
          <Row
            label={s.quick_answer_via_popup}
            value={settings.avCallPopup}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.avCallPopup.toggle' }, { onTrigger: () => toggle('avCallPopup') })}
          />
        </div>

        <div className="mt-3 bg-app-surface divide-y divide-gray-100">
          <Row
            label={s.friend_message_alerts}
            info
            value={settings.friendReminder}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.friendReminder.toggle' }, { onTrigger: () => toggle('friendReminder') })}
          />
          <Row
            label={s.show_message_details}
            value={settings.friendDetail}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.friendDetail.toggle' }, { onTrigger: () => toggle('friendDetail') })}
          />
        </div>

        <div className="px-4 pt-4 pb-2 text-xs text-gray-400">{s.when_alipay_is_open}</div>
        <div className="bg-app-surface divide-y divide-gray-100">
          <Row
            label={s.sound}
            value={settings.sound}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.sound.toggle' }, { onTrigger: () => toggle('sound') })}
          />
          <Row
            label={s.vibration}
            value={settings.vibration}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.vibration.toggle' }, { onTrigger: () => toggle('vibration') })}
          />
          <Row
            label={s.call_ringtone}
            value={settings.avCallRing}
            toggleProps={bindTap<HTMLButtonElement>({ kind: 'action', id: 'notification.avCallRing.toggle' }, { onTrigger: () => toggle('avCallRing') })}
          />
        </div>

        <div className="px-4 pt-4 pb-2 text-xs text-gray-400">{s.when_you_receive_via_qr_code}</div>
        <div className="bg-app-surface">
          <div className="flex items-center justify-between px-4 py-4 active:bg-gray-50">
            <span className="text-sm font-medium text-gray-800">{s.voice_alert_on_receiving_money}</span>
            <div className="flex items-center text-sm text-gray-400">
              <span className="mr-2">{s.set_up}</span>
              <IcNavBack size={16} className="text-gray-300 rotate-180" />
            </div>
          </div>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
};


import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { IcCheck } from '../res/icons';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { PreferenceItem } from './PreferenceItem';
import { ListPreference } from './ListPreference';
import { SwitchPreference } from './SwitchPreference';
import { Toast } from '@/os/components/Toast';
import { routeGetPreference, routeSetPreference } from '../../../os/managers/registry';
import { subscribeOsDataRevision } from '../../../os/simState';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
type RingMode = 'normal' | 'silent' | 'dnd';

function getRingMode(): RingMode {
  const dnd = Boolean(routeGetPreference('do_not_disturb'));
  if (dnd) return 'dnd';
  const silent = Boolean(routeGetPreference('silent'));
  return silent ? 'silent' : 'normal';
}

export const SilentModeSettingsPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const mode = useSyncExternalStore(
    subscribeOsDataRevision,
    () => getRingMode(),
  );

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | undefined>(undefined);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1600);
  };

  const setMode = (next: RingMode) => {
    if (next === 'normal') {
      // Order matters: if currently in DND, update base first, then exit DND.
      routeSetPreference('silent', false, { source: 'settings' });
      routeSetPreference('do_not_disturb', false, { source: 'settings' });
      showToast(s.switched_none);
      return;
    }
    if (next === 'silent') {
      routeSetPreference('silent', true, { source: 'settings' });
      routeSetPreference('do_not_disturb', false, { source: 'settings' });
      showToast(s.switched_silent);
      return;
    }
    // dnd
    routeSetPreference('do_not_disturb', true, { source: 'settings' });
    showToast(s.switched_do_not_disturb);
  };

  const options = useMemo(() => {
    const mk = (value: RingMode, title: string, summary: string) => ({ value, title, summary });
    return [
      mk('normal', s.none, s.all_volumes_at_normal_level),
      mk('silent', s.silent, s.mute_incoming_calls_and_notification_ringtones),
      mk('dnd', s.do_not_disturb_3, s.mute_ringtones_and_vibrations_for_calls_and),
    ];
  }, [s]);

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={s.silent_dnd} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <PreferenceCategory title={s.silent_mode}>
          {options.map((opt, idx) => {
            const selected = opt.value === mode;
            return (
              <PreferenceItem
                key={opt.value}
                title={opt.title}
                summary={opt.summary}
                showChevron={false}
                showDivider={idx < options.length - 1}
                onClick={() => setMode(opt.value)}
              >
                {selected ? <IcCheck size={18} className="text-app-primary" /> : null}
              </PreferenceItem>
            );
          })}
        </PreferenceCategory>

        <PreferenceCategory title={s.exceptions_simulated}>
          <ListPreference
            title={s.allow_call_alerts}
            settingKey="key_vip_list"
            defaultValue="0"
            options={[
              { label: s.everyone, value: '0' },
              { label: s.all_contacts, value: '1' },
              { label: s.starred_contacts, value: '2' },
              { label: s.none, value: '3' },
            ]}
            showDivider={true}
          />
          <SwitchPreference
            title={s.repeat_callers}
            summary={s.allow_alerts_for_repeat_calls_within_15_minutes}
            settingKey="key_repeat"
            defaultChecked={false}
            showDivider={false}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.more_simulated}>
          <SwitchPreference
            title={s.block_media_sound}
            settingKey="key_mute_music"
            defaultChecked={false}
            showDivider={true}
          />
          <SwitchPreference
            title={s.block_xiaoai_voice}
            settingKey="key_mute_voiceassist"
            defaultChecked={false}
            showDivider={true}
          />
          <SwitchPreference
            title={s.block_floating_notifications}
            summary={s.when_enabled_top_banner_notifications_will_be}
            settingKey="key_popup_window"
            defaultChecked={false}
            showDivider={true}
          />
          <SwitchPreference
            title={s.allow_voip_ringing}
            settingKey="key_network_alarm"
            defaultChecked={false}
            showDivider={false}
          />
        </PreferenceCategory>
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default SilentModeSettingsPage;


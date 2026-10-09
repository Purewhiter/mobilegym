import React from 'react';
import { SettingLayout, SettingItemArrow, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsOtherPage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const wifiPkg = useBilibiliStore((st) => st.settings.other.wifiPkg) ?? true;
  const clipboard = useBilibiliStore((st) => st.settings.other.clipboard) ?? true;
  const screenshotShare = useBilibiliStore((st) => st.settings.other.screenshotShare) ?? true;
  const watermark = useBilibiliStore((st) => st.settings.other.watermark) ?? 'off';
  const imageQuality = useBilibiliStore((st) => st.settings.other.imageQuality) ?? 'clear';

  return (
    <SettingLayout title={s.sot_title}>
      <SettingItemArrow
        label={s.sw_title}
        subtitle={watermark === 'off' ? s.sw_off : watermark === 'center' ? s.sw_center : s.sw_br}
        onClick={() => go('settings.other.watermark.open' as any)}
      />
      <SettingItemArrow
        label={s.si_title}
        subtitle={imageQuality === 'clear' ? s.si_clear_sub : imageQuality === 'normal' ? s.si_normal_sub : s.si_auto_sub}
        onClick={() => go('settings.other.imageQuality.open' as any)}
      />
      <SettingItemSwitch label={s.sot_wifi_pkg} subtitle={s.sot_wifi_pkg_sub} checked={wifiPkg} onChange={(v) => setSetting('other.wifiPkg', v)} />
      <SettingItemSwitch label={s.sot_clipboard} subtitle={s.sot_clipboard_sub} checked={clipboard} onChange={(v) => setSetting('other.clipboard', v)} />
      <SettingItemSwitch label={s.sot_screenshot} subtitle={s.sot_screenshot_sub} checked={screenshotShare} onChange={(v) => setSetting('other.screenshotShare', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};

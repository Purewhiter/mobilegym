import React from 'react';
import { SettingsHeader } from './SettingsHeader';
import { PreferenceCategory } from './PreferenceCategory';
import { ListPreference } from './ListPreference';
import { SeekBarPreference } from './SeekBarPreference';
import { SwitchPreference } from './SwitchPreference';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

export const LauncherSettingsPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  return (
    <div className="h-full bg-app-bg flex flex-col">
      <SettingsHeader title={s.home_screen} />
      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        <PreferenceCategory title={s.layout}>
          <ListPreference
            title={s.home_screen_layout}
            summary={s.adjust_home_screen_grid_takes_effect_immediately}
            settingKey="home_screen_layout"
            defaultValue="4x6"
            options={[
              { label: '4×6', value: '4x6' },
              { label: '5×6', value: '5x6' },
              { label: '4×7', value: '4x7' },
              { label: '5×7', value: '5x7' },
            ]}
            showDivider={true}
          />
          <SeekBarPreference
            title={s.icon_size}
            summary={s.n_80_120_takes_effect_immediately}
            settingKey="icon_size"
            defaultValue={100}
            min={80}
            max={120}
            showDivider={true}
          />
          <SwitchPreference
            title={s.icons_at_top}
            summary={s.simulation_only_saves_toggle_state_does_not}
            settingKey="align_to_top"
            defaultChecked={false}
            showDivider={false}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.actions_simulated}>
          <SwitchPreference
            title={s.left_screen}
            summary={s.simulation_only_saves_toggle_state}
            settingKey="minus_screen"
            defaultChecked={false}
            showDivider={true}
          />
          <SwitchPreference
            title={s.icon_open_animation}
            summary={s.simulation_only_saves_toggle_state}
            settingKey="icon_animation"
            defaultChecked={true}
            showDivider={false}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.other}>
          <ListPreference
            title={s.system_navigation}
            settingKey="system_navigation_mode"
            defaultValue="gesture"
            options={[
              { label: s.full_screen_gestures, value: 'gesture' },
              { label: s.classic_navigation_keys, value: 'buttons' },
            ]}
            showDivider={true}
          />
          <ListPreference
            title={s.recent_tasks_style}
            settingKey="recent_tasks_layout"
            defaultValue="vertical"
            options={[
              { label: s.vertical_layout, value: 'vertical' },
              { label: s.horizontal_layout, value: 'horizontal' },
            ]}
            showDivider={false}
          />
        </PreferenceCategory>
      </div>
    </div>
  );
};

export default LauncherSettingsPage;


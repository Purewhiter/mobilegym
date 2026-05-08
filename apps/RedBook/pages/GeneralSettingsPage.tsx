import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward;
import { useScrollPosition } from '../hooks/useScrollPosition';
import { useRedBookStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    actionProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, actionProps }) => {
    const { onClick: actionOnClick, ...restAction } = actionProps ?? {};
    return (
    <div
        className={`w-[44px] h-[24px] rounded-full relative transition-colors cursor-pointer ${checked ? 'bg-app-primary' : 'bg-[#e5e5e5]'}`}
        {...restAction}
        onClick={(e) => {
            if (actionOnClick) return actionOnClick(e);
            e.stopPropagation();
            onChange(!checked);
        }}
    >
        <div className={`w-[20px] h-[20px] bg-app-surface rounded-full absolute top-[2px] transition-all shadow-sm ${checked ? 'left-[22px]' : 'left-[2px]'}`} />
    </div>
    );
};

export const GeneralSettingsPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const scrollRef = useScrollPosition('general_settings');
  const { settings, updateSettings } = useRedBookStore(useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings })));
  const { general } = settings;

  const updateGeneral = (key: keyof typeof general, value: boolean) => {
    updateSettings('general', { [key]: value });
  };

  const ListItem = ({
      label,
      onClick,
      isLast = false,
      hasArrow = false,
      hasSwitch = false,
      checked = false,
      onSwitchChange,
      switchActionProps,
      subtitle
  }: {
      label: string,
      onClick?: () => void,
      isLast?: boolean,
      hasArrow?: boolean,
      hasSwitch?: boolean,
      checked?: boolean,
      onSwitchChange?: (val: boolean) => void,
      switchActionProps?: React.HTMLAttributes<HTMLDivElement>,
      subtitle?: string
  }) => (
      <div
        className={`flex items-center justify-between px-4 py-[18px] active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
        onClick={onClick}
      >
          <div className="flex flex-col gap-1 pr-4">
              <span className="text-[16px] text-app-text">{label}</span>
              {subtitle && <span className="text-[11px] text-app-text-muted leading-tight">{subtitle}</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
              {hasSwitch && onSwitchChange && <Switch checked={checked} onChange={onSwitchChange} actionProps={switchActionProps} />}
              {hasArrow && <ChevronRight size={18} className="text-[#ccc]" />}
          </div>
      </div>
  );

  const SectionTitle = ({ title }: { title: string }) => (
      <div className="px-4 pt-2 pb-3 text-[12px] text-app-text-muted mt-2">{title}</div>
  );

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.general_settings}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pt-2 pb-20"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          <SectionTitle title={s.display} />
          <div className="bg-app-surface rounded-xl mb-2 overflow-hidden">
               <ListItem label={s.font_size} hasArrow onClick={() => {}} />
               <ListItem
                  label={s.use_system_default_font}
                  hasSwitch
                  checked={general.useSystemFont}
                  onSwitchChange={(val) => updateGeneral('useSystemFont', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.useSystemFont.toggle' }, { params: { to: !general.useSystemFont }, stopPropagation: true, onTrigger: () => updateGeneral('useSystemFont', !general.useSystemFont) })}
               />
               <ListItem label={s.dark_mode} hasArrow isLast onClick={() => {}} />
          </div>

          <SectionTitle title={s.features} />
          <div className="bg-app-surface rounded-xl mb-2 overflow-hidden">
               <ListItem
                  label={s.play_note_audio_by_default}
                  hasSwitch
                  checked={general.playAudio}
                  onSwitchChange={(val) => updateGeneral('playAudio', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.playAudio.toggle' }, { params: { to: !general.playAudio }, stopPropagation: true, onTrigger: () => updateGeneral('playAudio', !general.playAudio) })}
               />
               <ListItem
                  label={s.auto_refresh}
                  subtitle={s.content_won_t_auto_refresh_unless_restarted}
                  hasSwitch
                  checked={general.autoRefresh}
                  onSwitchChange={(val) => updateGeneral('autoRefresh', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.autoRefresh.toggle' }, { params: { to: !general.autoRefresh }, stopPropagation: true, onTrigger: () => updateGeneral('autoRefresh', !general.autoRefresh) })}
               />
               <ListItem
                  label={s.mute_video_and_live_by_default}
                  hasSwitch
                  checked={general.muteVideo}
                  onSwitchChange={(val) => updateGeneral('muteVideo', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.muteVideo.toggle' }, { params: { to: !general.muteVideo }, stopPropagation: true, onTrigger: () => updateGeneral('muteVideo', !general.muteVideo) })}
               />
               <ListItem
                  label={s.download_over_mobile_data}
                  hasSwitch
                  checked={general.mobileDownload}
                  onSwitchChange={(val) => updateGeneral('mobileDownload', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.mobileDownload.toggle' }, { params: { to: !general.mobileDownload }, stopPropagation: true, onTrigger: () => updateGeneral('mobileDownload', !general.mobileDownload) })}
               />
               <ListItem
                  label={s.enable_video_hdr}
                  hasSwitch
                  checked={general.videoHDR}
                  onSwitchChange={(val) => updateGeneral('videoHDR', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.videoHDR.toggle' }, { params: { to: !general.videoHDR }, stopPropagation: true, onTrigger: () => updateGeneral('videoHDR', !general.videoHDR) })}
               />
               <ListItem
                  label={s.enable_image_hdr}
                  hasSwitch
                  checked={general.imageHDR}
                  onSwitchChange={(val) => updateGeneral('imageHDR', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.imageHDR.toggle' }, { params: { to: !general.imageHDR }, stopPropagation: true, onTrigger: () => updateGeneral('imageHDR', !general.imageHDR) })}
               />
               <ListItem
                  label={s.use_mobile_network_to_improve_browsing}
                  hasSwitch
                  checked={general.mobileNetwork}
                  onSwitchChange={(val) => updateGeneral('mobileNetwork', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.mobileNetwork.toggle' }, { params: { to: !general.mobileNetwork }, stopPropagation: true, onTrigger: () => updateGeneral('mobileNetwork', !general.mobileNetwork) })}
               />
               <ListItem
                  label={s.history}
                  subtitle={s.history_will_be_cleared_when_turned_off}
                  hasSwitch
                  checked={general.history}
                  onSwitchChange={(val) => updateGeneral('history', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.history.toggle' }, { params: { to: !general.history }, stopPropagation: true, onTrigger: () => updateGeneral('history', !general.history) })}
               />
               <ListItem
                  label={s.video_interaction_buttons_at_bottom}
                  subtitle={s.buttons_move_to_the_right_side_when_turned_off}
                  hasSwitch
                  checked={general.videoInteraction}
                  onSwitchChange={(val) => updateGeneral('videoInteraction', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.videoInteraction.toggle' }, { params: { to: !general.videoInteraction }, stopPropagation: true, onTrigger: () => updateGeneral('videoInteraction', !general.videoInteraction) })}
                  isLast
               />
          </div>

          <SectionTitle title={s.other} />
          <div className="bg-app-surface rounded-xl mb-8 overflow-hidden">
               <ListItem
                  label={s.pre_upload_video_when_posting}
                  subtitle={s.reduces_wait_time_for_video_publishing}
                  hasSwitch
                  checked={general.preUpload}
                  onSwitchChange={(val) => updateGeneral('preUpload', val)}
                  switchActionProps={bindTap({ kind: 'action', id: 'settings.general.preUpload.toggle' }, { params: { to: !general.preUpload }, stopPropagation: true, onTrigger: () => updateGeneral('preUpload', !general.preUpload) })}
                  isLast
               />
          </div>
      </div>
    </div>
  );
};
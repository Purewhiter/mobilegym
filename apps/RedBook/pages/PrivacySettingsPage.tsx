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

const ListItem = ({
    label,
    isLast = false,
    hasArrow = false,
    hasSwitch = false,
    checked = false,
    onSwitchChange,
    switchActionProps,
    subtitle,
    rightText,
    ...props
}: {
    label: string,
    isLast?: boolean,
    hasArrow?: boolean,
    hasSwitch?: boolean,
    checked?: boolean,
    onSwitchChange?: (val: boolean) => void,
    switchActionProps?: React.HTMLAttributes<HTMLDivElement>,
    subtitle?: string,
    rightText?: string
    [key: string]: any
}) => (
    <div
      className={`flex items-start justify-between px-4 py-6 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
      {...props}
    >
        <div className="flex flex-col gap-3 pr-4">
            <span className="text-[16px] text-app-text leading-none mt-[2px]">{label}</span>
            {subtitle && <span className="text-[13px] text-app-text-muted leading-tight">{subtitle}</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            {rightText && <span className="text-[14px] text-app-text-muted">{rightText}</span>}
            {hasSwitch && onSwitchChange && <Switch checked={checked} onChange={onSwitchChange} actionProps={switchActionProps} />}
            {hasArrow && <ChevronRight size={18} className="text-[#ccc]" />}
        </div>
    </div>
);

const SectionTitle = ({ title }: { title: string }) => (
    <div className="px-4 pt-2 pb-3 text-[12px] text-app-text-muted mt-2">{title}</div>
);

const PrivacySettingsPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindTap, bindBack } = useRedBookGestures();
  const scrollRef = useScrollPosition('privacy_settings');
  const { settings, updateSettings } = useRedBookStore(useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings })));
  const { privacy } = settings;

  const updatePrivacy = (key: keyof typeof privacy, value: boolean) => {
    updateSettings('privacy', { [key]: value });
  };

  const privacyLabel = (val: string) => ({
    friends: s.friends,
    following: s.people_i_follow,
    public: s.public_2,
    private: s.private_2,
  } as Record<string, string>)[val] ?? val;

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.privacy_settings}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pt-2 pb-20"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >

        {/* Section 1: Interaction */}
        <SectionTitle title={s.interaction} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.quick_protection}
            subtitle={s.block_dms_comments_shares_from_non_followers_for}
            hasSwitch
            checked={privacy.oneClickProtect}
            onSwitchChange={(val) => updatePrivacy('oneClickProtect', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.oneClickProtect.toggle' }, { params: { to: !privacy.oneClickProtect }, stopPropagation: true, onTrigger: () => updatePrivacy('oneClickProtect', !privacy.oneClickProtect) })}
          />
          <ListItem
            label={s.online_status}
            rightText={privacyLabel(privacy.onlineStatus)}
            hasArrow
            {...bindTap('settings.privacy.onlineStatus.open')}
          />
          <ListItem
            label={s.show_chat_badge}
            hasSwitch
            checked={privacy.showChatStatus}
            onSwitchChange={(val) => updatePrivacy('showChatStatus', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.showChatStatus.toggle' }, { params: { to: !privacy.showChatStatus }, stopPropagation: true, onTrigger: () => updatePrivacy('showChatStatus', !privacy.showChatStatus) })}
          />
          <ListItem
            label={s.only_followers_can_comment}
            hasSwitch
            checked={privacy.onlyFollowComment}
            onSwitchChange={(val) => updatePrivacy('onlyFollowComment', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.onlyFollowComment.toggle' }, { params: { to: !privacy.onlyFollowComment }, stopPropagation: true, onTrigger: () => updatePrivacy('onlyFollowComment', !privacy.onlyFollowComment) })}
          />
          <ListItem
            label={s.only_followers_can_send_danmaku}
            hasSwitch
            checked={privacy.onlyFollowDanmaku}
            onSwitchChange={(val) => updatePrivacy('onlyFollowDanmaku', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.onlyFollowDanmaku.toggle' }, { params: { to: !privacy.onlyFollowDanmaku }, stopPropagation: true, onTrigger: () => updatePrivacy('onlyFollowDanmaku', !privacy.onlyFollowDanmaku) })}
          />
          <ListItem
            label={s.only_followers_can_at_me}
            hasSwitch
            checked={privacy.onlyFollowAt}
            onSwitchChange={(val) => updatePrivacy('onlyFollowAt', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.onlyFollowAt.toggle' }, { params: { to: !privacy.onlyFollowAt }, stopPropagation: true, onTrigger: () => updatePrivacy('onlyFollowAt', !privacy.onlyFollowAt) })}
          />
          <ListItem
            label={s.allow_downloading_all_notes}
            subtitle={s.including_images_videos_and_text_copy}
            hasSwitch
            checked={privacy.allowDownload}
            onSwitchChange={(val) => updatePrivacy('allowDownload', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.allowDownload.toggle' }, { params: { to: !privacy.allowDownload }, stopPropagation: true, onTrigger: () => updatePrivacy('allowDownload', !privacy.allowDownload) })}
          />
          <ListItem
            label={s.who_can_dm_me}
            rightText={privacyLabel(privacy.messagePermission)}
            hasArrow
            {...bindTap('settings.privacy.messagePermission.open')}
          />
          <ListItem
            label={s.my_collects}
            rightText={privacyLabel(privacy.collectVisibility)}
            hasArrow
            {...bindTap('settings.privacy.collect.open')}
          />
          <ListItem
            label={s.my_reviews}
            rightText={privacyLabel(privacy.commentVisibility)}
            hasArrow
            isLast
            {...bindTap('settings.privacy.comment.open')}
          />
        </div>

        {/* Section 2: Relationship */}
        <SectionTitle title={s.connections} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.ways_to_find_me}
            hasArrow
            {...bindTap('settings.privacy.findMe.open')}
          />
          <ListItem
            label={s.following_and_followers}
            hasArrow
            {...bindTap('settings.privacy.followList.open')}
          />
          <ListItem
            label={s.recommend_people_i_may_know}
            hasSwitch
            checked={privacy.recommendPeople}
            onSwitchChange={(val) => updatePrivacy('recommendPeople', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.recommendPeople.toggle' }, { params: { to: !privacy.recommendPeople }, stopPropagation: true, onTrigger: () => updatePrivacy('recommendPeople', !privacy.recommendPeople) })}
          />
          <ListItem
            label={s.blocked_users}
            hasArrow
            isLast
            onClick={() => {}}
          />
        </div>

        {/* Section 3: Permission */}
        <SectionTitle title={s.permissions} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.system_permissions}
            subtitle={s.all_system_permissions_used_in_app}
            hasArrow
            isLast
            {...bindTap('settings.privacy.systemPermission.open')}
          />
        </div>

        {/* Section 4: More */}
        <SectionTitle title={s.homepage_more} />
        <div className="bg-app-surface rounded-xl mb-12 overflow-hidden">
          <ListItem
            label={s.personalization}
            hasArrow
            {...bindTap('settings.privacy.personalization.open')}
          />
          <ListItem
            label={s.third_party_data}
            hasArrow
            isLast
            onClick={() => {}}
          />
        </div>

      </div>
    </div>
  );
};

export default PrivacySettingsPage;
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

const NotificationSettingsPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindTap, bindBack } = useRedBookGestures();
  const scrollRef = useScrollPosition('notification_settings');
  const { settings, updateSettings } = useRedBookStore(useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings })));
  const { notification } = settings;

  const updateNotification = (key: keyof typeof notification, value: boolean) => {
    updateSettings('notification', { [key]: value });
  };

  const notifLabel = (val: string) => ({
    followingUnread: s.following_unread_reminder,
    receive: s.receive,
    off: s.notificationsettingspage_off,
  } as Record<string, string>)[val] ?? val;

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
        className={`flex items-center justify-between px-4 py-5 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
        {...props}
      >
          <div className="flex flex-col gap-1 pr-4">
              <span className="text-[16px] text-app-text">{label}</span>
              {subtitle && <span className="text-[11px] text-app-text-muted leading-tight">{subtitle}</span>}
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

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.notification_settings}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pt-2 pb-20"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >

        {/* Section 1: Receive Message Notifications */}
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden mt-6">
          <ListItem
            label={s.receive_notifications}
            hasSwitch
            checked={notification.receiveMsg}
            onSwitchChange={(val) => updateNotification('receiveMsg', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.receiveMsg.toggle' }, { params: { to: !notification.receiveMsg }, stopPropagation: true, onTrigger: () => updateNotification('receiveMsg', !notification.receiveMsg) })}
            isLast
          />
        </div>

        {/* Section 2: Interaction Notifications */}
        <SectionTitle title={s.interaction_notifications} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.likes_and_saves}
            hasSwitch
            checked={notification.likeCollect}
            onSwitchChange={(val) => updateNotification('likeCollect', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.likeCollect.toggle' }, { params: { to: !notification.likeCollect }, stopPropagation: true, onTrigger: () => updateNotification('likeCollect', !notification.likeCollect) })}
          />
          <ListItem
            label={s.new_followers}
            hasSwitch
            checked={notification.newFollow}
            onSwitchChange={(val) => updateNotification('newFollow', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.newFollow.toggle' }, { params: { to: !notification.newFollow }, stopPropagation: true, onTrigger: () => updateNotification('newFollow', !notification.newFollow) })}
          />
          <ListItem
            label={s.comments}
            hasSwitch
            checked={notification.comment}
            onSwitchChange={(val) => updateNotification('comment', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.comment.toggle' }, { params: { to: !notification.comment }, stopPropagation: true, onTrigger: () => updateNotification('comment', !notification.comment) })}
          />
          <ListItem
            label="@"
            hasSwitch
            checked={notification.atMe}
            onSwitchChange={(val) => updateNotification('atMe', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.atMe.toggle' }, { params: { to: !notification.atMe }, stopPropagation: true, onTrigger: () => updateNotification('atMe', !notification.atMe) })}
            isLast
          />
        </div>

        {/* Section 3: Direct Message Notifications */}
        <SectionTitle title={s.dm_notifications} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.message_2}
            rightText={(notification.privateChat || notification.groupChat || notification.strangers) ? s.receive : s.notificationsettingspage_off}
            hasArrow
            isLast
            {...bindTap('settings.notification.private.open')}
          />
        </div>

        {/* Section 4: Community Content Notifications */}
        <SectionTitle title={s.community_notifications} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.author_updates}
            rightText={notifLabel(notification.authorUpdates)}
            hasArrow
            {...bindTap('settings.notification.follow.open')}
          />
          <ListItem
            label={s.live_reminder}
            rightText={notifLabel(notification.liveReminder)}
            hasArrow
            {...bindTap('settings.notification.live.open')}
          />
          <ListItem
            label={s.content_recommendations}
            rightText={notifLabel(notification.contentRecommend)}
            hasArrow
            {...bindTap('settings.notification.content.open')}
          />
          <ListItem
            label={s.user_recommendations}
            rightText={notifLabel(notification.userRecommend)}
            hasArrow
            {...bindTap('settings.notification.user.open')}
          />
          <ListItem
            label={s.other_notifications}
            rightText={notifLabel(notification.otherNotif)}
            hasArrow
            isLast
            {...bindTap('settings.notification.other.open')}
          />
        </div>

        {/* Section 5: Store Notifications */}
        <SectionTitle title={s.shopping_notifications} />
        <div className="bg-app-surface rounded-xl mb-10 overflow-hidden">
          <ListItem
            label={s.shopping_and_after_sale}
            subtitle={s.you_may_miss_delivery_and_price_drop_alerts}
            hasSwitch
            checked={notification.storeNotif}
            onSwitchChange={(val) => updateNotification('storeNotif', val)}
            switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.storeNotif.toggle' }, { params: { to: !notification.storeNotif }, stopPropagation: true, onTrigger: () => updateNotification('storeNotif', !notification.storeNotif) })}
            isLast
          />
        </div>

        {/* Section 6: In-App Notification Banner */}
        <SectionTitle title={s.in_app_banner} />
        <div className="bg-app-surface rounded-xl mb-12 overflow-hidden">
          <ListItem
            label={s.in_app_banner}
            rightText={notifLabel(notification.inAppBanner)}
            hasArrow
            isLast
            {...bindTap('settings.notification.banner.open')}
          />
        </div>

      </div>
    </div>
  );
};

export default NotificationSettingsPage;
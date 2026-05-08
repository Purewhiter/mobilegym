import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack } from '../../res/icons';
const ChevronLeft = IcNavBack;
import { useRedBookStore } from '../../state';
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
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
    checked,
    onSwitchChange,
    switchActionProps,
    isLast = false
}: { 
    label: string, 
    checked: boolean,
    onSwitchChange: (val: boolean) => void,
    switchActionProps?: React.HTMLAttributes<HTMLDivElement>,
    isLast?: boolean
}) => (
    <div 
      className={`flex items-center justify-between px-4 py-5 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
    >
        <span className="text-[16px] text-app-text">{label}</span>
        <Switch checked={checked} onChange={onSwitchChange} actionProps={switchActionProps} />
    </div>
);

const PrivateMessageSettingsPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const notifSettings = useRedBookStore(s => s.settings.notification);
  const updateSettings = useRedBookStore(s => s.updateSettings);
  const privateChat = notifSettings.privateChat ?? true;
  const groupChat = notifSettings.groupChat ?? true;
  const strangers = notifSettings.strangers ?? true;

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.message_2}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 pt-2"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="bg-app-surface rounded-xl mt-2 overflow-hidden">
          <ListItem
              label={s.private_chat}
              checked={privateChat}
              onSwitchChange={(v) => updateSettings('notification', { privateChat: v })}
              switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.private.privateChat.toggle' }, { params: { to: !privateChat }, stopPropagation: true, onTrigger: () => updateSettings('notification', { privateChat: !privateChat }) })}
          />
          <ListItem
              label={s.group_chats}
              checked={groupChat}
              onSwitchChange={(v) => updateSettings('notification', { groupChat: v })}
              switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.private.groupChat.toggle' }, { params: { to: !groupChat }, stopPropagation: true, onTrigger: () => updateSettings('notification', { groupChat: !groupChat }) })}
          />
          <ListItem
              label={s.strangers}
              checked={strangers}
              onSwitchChange={(v) => updateSettings('notification', { strangers: v })}
              switchActionProps={bindTap({ kind: 'action', id: 'settings.notification.private.strangers.toggle' }, { params: { to: !strangers }, stopPropagation: true, onTrigger: () => updateSettings('notification', { strangers: !strangers }) })}
              isLast
          />
        </div>
      </div>
    </div>
  );
};

export default PrivateMessageSettingsPage;
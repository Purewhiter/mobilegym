import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack, IcNavForward, IcUser, IcSettings, IcBell, IcLanguages, IcLock, IcDelete, IcSliders, IcLocation, IcGrid, IcUmbrella, IcLab, IcHeadphone, IcInfo } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, UserCircle = IcUser, Settings = IcSettings, Bell = IcBell, Languages = IcLanguages, Lock = IcLock, Trash2 = IcDelete, Sliders = IcSliders, MapPin = IcLocation, LayoutGrid = IcGrid, Umbrella = IcUmbrella, FlaskConical = IcLab, Headphones = IcHeadphone, Info = IcInfo;
import { useRedBookStore } from '../state';
import { useScrollPosition } from '../hooks/useScrollPosition';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
export const SettingsPage: React.FC = () => {
  const scrollRef = useScrollPosition('settings_main');
  const { logout, clearHistory, settings } = useRedBookStore();
  const { bindTap, bindBack } = useRedBookGestures();
  const s = useRedBookStrings();

  const ListItem = ({
      label,
      isLast = false,
      hasArrow = true,
      Icon,
      rightText,
      className,
      ...props
  }: {
      label: string,
      isLast?: boolean,
      hasArrow?: boolean,
      Icon?: React.ElementType,
      rightText?: string
      className?: string,
      [key: string]: any
  }) => (
      <div
        className={`flex items-center justify-between px-4 py-5 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-100' : ''} ${className || ''}`}
        {...props}
      >
          <div className="flex items-center gap-3">
              {Icon && <Icon size={22} className="text-app-text" strokeWidth={1.8} />}
              <span className="text-[16px] text-app-text">{label}</span>
          </div>
          <div className="flex items-center gap-2">
              {rightText && <span className="text-[14px] text-app-text-muted">{rightText}</span>}
              {hasArrow && <ChevronRight size={18} className="text-[#ccc]" />}
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.settings}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pt-6"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {/* Group 1 */}
          <div className="bg-app-surface rounded-xl mb-6 overflow-hidden">
               <ListItem
                 label={s.account_and_security}
                 Icon={UserCircle}
                 {...bindTap('settings.account.open')}
               />
               <ListItem
                 label={s.general_settings}
                 Icon={Settings}
                 {...bindTap('settings.general.open')}
               />
               <ListItem
                 label={s.notification_settings}
                 Icon={Bell}
                 {...bindTap('settings.notification.open')}
               />
               <ListItem
                 label={s.language_and_translation}
                 Icon={Languages}
                 {...bindTap('settings.language.open')}
               />
               <ListItem
                 label={s.privacy_settings}
                 Icon={Lock}
                 {...bindTap('settings.privacy.open')}
                 isLast
               />
          </div>

          {/* Group 2 */}
          <div className="bg-app-surface rounded-xl mb-6 overflow-hidden">
              <ListItem
                label={s.storage}
                Icon={Trash2}
                rightText="2.34 GB"
                {...bindTap('settings.storage.open')}
              />
              <ListItem
                label={s.content_preferences}
                Icon={Sliders}
              />
              <ListItem
                label={s.shipping_address}
                Icon={MapPin}
              />
              <ListItem
                label={s.add_widgets}
                Icon={LayoutGrid}
              />
              <ListItem
                label={s.teen_mode}
                Icon={Umbrella}
                rightText={settings.general.teenMode ? s.settingspage_on : s.settingspage_off}
                isLast
              />
          </div>

          {/* Group 3 */}
          <div className="bg-app-surface rounded-xl mb-6 overflow-hidden">
              <ListItem
                label={s.new_features}
                Icon={FlaskConical}
                isLast
              />
          </div>

          {/* Group 4 */}
          <div className="bg-app-surface rounded-xl mb-6 overflow-hidden">
              <ListItem
                label={s.help_and_support}
                Icon={Headphones}
              />
              <ListItem
                label={s.about_rednote}
                Icon={Info}
                isLast
              />
          </div>

          {/* Group 5 (Logout) */}
          <div className="bg-app-surface rounded-xl mb-6 overflow-hidden flex flex-col items-center">
              <div className="w-full py-5 text-center text-[15px] text-app-text active:bg-gray-50 cursor-pointer border-b border-gray-100">
                  {s.switch_account}
              </div>
              <div
                  className="w-full py-5 text-center text-[15px] text-app-text active:bg-gray-50 cursor-pointer"
                  {...bindTap('settings.logout', { beforeTrigger: () => logout() })}
              >
                  {s.log_out}
              </div>
          </div>

          {/* Footer Links */}
          <div className="pb-10 text-center px-4">
              <div className="text-[11px] text-[#5b92e1] flex flex-wrap justify-center gap-x-2 gap-y-1 mb-1">
                  <span>{s.personal_info_collected_list}</span>
                  <span>{s.third_party_info_sharing_list}</span>
              </div>
              <div className="text-[11px] text-[#5b92e1] flex flex-wrap justify-center gap-x-2 gap-y-1">
                  <span>{s.rednote_user_agreement}</span>
                  <span>{s.rednote_privacy_policy}</span>
              </div>
          </div>
      </div>
    </div>
  );
};

import React from 'react';
import {
  IcUser,
  IcBadgeCheck,
  IcPlay,
  IcContacts,
  IcBookmark,
  IcList,
  IcSmile,
  IcLab,
  IcDownload,
  IcSettings,
  IcHelp,
  IcClose,
} from '../res/icons';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';

type XDrawerProps = {
  isOpen: boolean;
};

export function XDrawer({ isOpen }: XDrawerProps) {
  const user = useXStore(selectUser);
  const { bindTap, bindBack } = useXGestures();
  const s = useXStrings();

  if (!isOpen) return null;

  const DrawerItem = ({
    icon: Icon,
    label,
    right,
    ...props
  }: {
    icon: React.ComponentType<any>;
    label: string;
    right?: React.ReactNode;
    [key: string]: any;
  }) => (
    <div className="flex items-center justify-between py-3 px-4 active:bg-black/5 cursor-pointer select-none" {...props}>
      <div className="flex items-center gap-3">
        <Icon size={20} className="text-app-text" />
        <span className="text-[16px] text-app-text font-medium">{label}</span>
      </div>
      {right ? <div className="text-gray-400">{right}</div> : null}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] flex">
      <div className="absolute inset-0 bg-black/40" {...bindBack()} />

      <div className="relative h-full w-[78%] max-w-[340px] bg-white shadow-2xl">
        <div className="h-full overflow-y-auto no-scrollbar pt-10 pb-10">
          <div className="px-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 cursor-pointer active:opacity-80" {...bindTap('profile.open')}>
                <div className="w-12 h-12 rounded-full bg-pink-600 overflow-hidden flex items-center justify-center text-white font-bold text-lg">
                  {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : user.name[0]}
                </div>
              </div>
              <div className="w-9 h-9 rounded-full border border-black/10 flex items-center justify-center text-app-text/70 active:bg-black/5 cursor-pointer" {...bindBack()}>
                <IcClose size={18} />
              </div>
            </div>

            <div className="mt-3 cursor-pointer active:opacity-80" {...bindTap('profile.open')}>
              <div className="text-[18px] font-bold text-app-text leading-tight">{user.name}</div>
              <div className="text-[14px] text-gray-500">{`@${user.id}`}</div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-[14px]">
              <div className="text-app-text">
                <span className="font-bold">{user.following}</span>
                <span className="text-gray-600 ml-1">{s.drawer_following_label}</span>
              </div>
              <div className="text-app-text">
                <span className="font-bold">{user.followers}</span>
                <span className="text-gray-600 ml-1">{s.drawer_followers_label}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-black/10" />

          <div className="mt-2">
            <DrawerItem icon={IcUser} label={s.drawer_menu_profile} {...bindTap('profile.open')} />
            <DrawerItem icon={IcBadgeCheck} label={s.drawer_menu_premium} />
            <DrawerItem icon={IcPlay} label={s.drawer_menu_videos} />
            <DrawerItem icon={IcContacts} label={s.drawer_menu_communities} />
            <DrawerItem icon={IcBookmark} label={s.drawer_menu_bookmarks} />
            <DrawerItem icon={IcList} label={s.drawer_menu_lists} />
            <DrawerItem icon={IcSmile} label={s.drawer_menu_spaces} />
            <DrawerItem icon={IcLab} label={s.drawer_menu_creator_studio} />
          </div>

          <div className="mt-4 border-t border-black/10" />

          <div className="mt-2">
            <DrawerItem icon={IcDownload} label={s.drawer_menu_download_grok} />
            <DrawerItem icon={IcSettings} label={s.drawer_menu_settings} {...bindTap('settings.open')} />
            <DrawerItem icon={IcHelp} label={s.drawer_menu_help} />
          </div>
        </div>
      </div>
    </div>
  );
}


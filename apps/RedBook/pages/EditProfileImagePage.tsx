import React, { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { IcClose, IcImage } from '../res/icons';
import { useRedBookStore } from '../state';
import { useRedBookStrings } from '../hooks/useRedBookStrings';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import * as MediaService from '../../../os/MediaService';
import { routes } from '../routes';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=100';

/**
 * Avatar or profile cover full screen, as the real app shows it, with a button at
 * the bottom that picks a new one from the device's photos (?sheet=album).
 */
export const EditProfileImagePage: React.FC = () => {
  const s = useRedBookStrings();
  const { type = 'cover' } = useParams();
  const isAvatar = type === 'avatar';
  const [searchParams] = useSearchParams();
  const albumOpen = searchParams.get('sheet') === 'album';
  const { user, updateUser } = useRedBookStore(useShallow(st => ({ user: st.user, updateUser: st.updateUser })));
  const { bindBack, bindNav, bindTap, back } = useRedBookGestures();
  const photos = useMemo(() => (albumOpen ? MediaService.getMediaItems({ type: 'image' }) : []), [albumOpen]);

  const image = isAvatar ? user.avatar : user.userCover || DEFAULT_COVER;
  return (
    <div className="h-full flex flex-col bg-black pt-10" data-status-bar-foreground="light" data-navigation-bar-foreground="light">
      <div className="h-14 px-4 flex items-center">
        <div className="active:opacity-60" {...bindBack()}>
          <IcClose size={26} className="text-white" />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <img
          src={image}
          className={isAvatar ? 'w-64 h-64 rounded-full object-cover' : 'w-full aspect-[3/2] object-cover'}
          alt=""
        />
      </div>

      <div className="px-6 pb-10">
        <div
          className="h-14 px-5 rounded-2xl bg-[#222] flex items-center justify-between active:opacity-80"
          {...bindNav(routes.editProfileImage, { params: { type }, search: { sheet: 'album' } })}
        >
          <span className="text-[17px] text-white">{isAvatar ? s.change_avatar : s.change_cover}</span>
          <IcImage size={24} className="text-white/80" />
        </div>
      </div>

      {albumOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" {...bindBack()} />
          <div className="relative max-h-[70%] rounded-t-2xl bg-app-surface flex flex-col">
            <div className="h-12 shrink-0 flex items-center justify-center text-[16px] font-medium text-app-text">
              {s.choose_from_album}
            </div>
            <div className="grid grid-cols-4 gap-0.5 overflow-y-auto" data-scroll-container="album" data-scroll-direction="vertical">
              {photos.map(photo => (
                <div
                  key={photo.id}
                  className="aspect-square active:opacity-70"
                  {...bindTap({ kind: 'action', id: 'redbook.editProfile.image.pick' }, {
                    onTrigger: () => {
                      updateUser({ [isAvatar ? 'avatar' : 'userCover']: photo.uri });
                      back();
                    },
                  })}
                >
                  <img src={photo.thumbnailUri || photo.uri} className="w-full h-full object-cover" alt="" />
                </div>
              ))}
            </div>
            <div className="h-12 shrink-0 flex items-center justify-center text-[16px] text-app-text border-t border-gray-100" {...bindBack()}>
              {s.cancel}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditProfileImagePage;

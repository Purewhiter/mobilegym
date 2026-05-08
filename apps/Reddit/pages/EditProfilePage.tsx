import React from 'react';
import { useAppStrings } from '@/os/useAppStrings';
import { IcArrowBack, IcAdd, IcSend } from '../res/icons';
import { useRedditStore } from '../state';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import * as MediaService from '../../../os/MediaService';

const MAX_NAME = 90;
const MAX_BIO = 200;

export const EditProfilePage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const user = useRedditStore((st) => st.user);
  const storeSaveProfile = useRedditStore((st) => st.saveProfile);
  const { bindTap, bindBack, back } = useRedditGestures();

  const [displayName, setDisplayName] = React.useState(user.username);
  const [bio, setBio] = React.useState(user.bio ?? '');
  const [bannerImage, setBannerImage] = React.useState(user.bannerImage ?? '');
  const [avatarImage, setAvatarImage] = React.useState(user.avatar ?? '');
  const [pickingBanner, setPickingBanner] = React.useState(false);
  const [pickingAvatar, setPickingAvatar] = React.useState(false);

  const nameLen = displayName.length;
  const bioLen = bio.length;

  const canSave =
    displayName.trim().length > 0 &&
    nameLen <= MAX_NAME &&
    bioLen <= MAX_BIO &&
    (displayName !== user.username || bio !== (user.bio ?? '') || bannerImage !== (user.bannerImage ?? '') || avatarImage !== (user.avatar ?? ''));

  const handlePickBanner = React.useCallback(async () => {
    if (pickingBanner) return;
    setPickingBanner(true);
    try {
      const result = await MediaService.pickMedia({ type: 'image', multiple: false, maxSelect: 1 });
      if (!result.cancelled && result.selected.length > 0) {
        setBannerImage(result.selected[0].uri);
      }
    } finally {
      setPickingBanner(false);
    }
  }, [pickingBanner]);

  const handlePickAvatar = React.useCallback(async () => {
    if (pickingAvatar) return;
    setPickingAvatar(true);
    try {
      const result = await MediaService.pickMedia({ type: 'image', multiple: false, maxSelect: 1 });
      if (!result.cancelled && result.selected.length > 0) {
        setAvatarImage(result.selected[0].uri);
      }
    } finally {
      setPickingAvatar(false);
    }
  }, [pickingAvatar]);

  const handleSave = React.useCallback(() => {
    if (!canSave) return;
    storeSaveProfile({
      username: displayName.trim(),
      bio: bio.trim(),
      bannerImage,
      avatarImage,
    });
    back();
  }, [canSave, displayName, bio, bannerImage, avatarImage, storeSaveProfile, back]);

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 bg-app-surface border-b border-app-border">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100"
            {...bindBack()}
          >
            <IcArrowBack className="w-6 h-6 text-app-text" strokeWidth={2} />
          </button>
          <span className="text-[18px] font-bold text-app-text">{s.edit_profile_title}</span>
        </div>
        <button
          type="button"
          disabled={!canSave}
          {...bindTap(
            { kind: 'action', id: 'editProfile.save.submit' },
            { onTrigger: handleSave },
          )}
          className={`px-4 py-2 rounded-full text-[14px] font-bold ${
            canSave
              ? 'bg-[#0045AC] text-white active:opacity-90'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {s.edit_profile_save}
        </button>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Banner image (click to select from gallery) */}
        <div
          className="w-full h-[200px] bg-gray-100 relative overflow-hidden cursor-pointer"
          onClick={handlePickBanner}
        >
          {bannerImage ? (
            <img src={bannerImage} alt="" className="w-full h-full object-cover" draggable={false} />
          ) : (
            <>
              <img
                src="/reddit/others/profile_banner_default.png"
                alt=""
                className="w-full h-full object-cover opacity-60"
                draggable={false}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <div className="text-gray-300 text-[80px] font-black opacity-20 rotate-[-5deg]">
                  reddit
                </div>
              </div>
            </>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-5 py-2 rounded-full bg-[#0045AC] text-white text-[14px] font-bold shadow-md">
              {s.edit_profile_add_image}
            </div>
          </div>
        </div>

        {/* Avatar (centered, overlapping banner) — click to pick from gallery */}
        <div className="flex justify-center -mt-[44px] mb-3 relative z-10">
          <div className="relative cursor-pointer" onClick={handlePickAvatar}>
            <div className="w-(--app-profile-avatar-size) h-(--app-profile-avatar-size) rounded-full bg-app-surface p-(--app-profile-avatar-ring)">
              <div className="w-full h-full rounded-full bg-[#2EE6A5] overflow-hidden">
                {avatarImage && (
                  <img
                    src={avatarImage}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#0045AC] flex items-center justify-center border-2 border-white">
              <IcAdd className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Form fields */}
        <div className="px-5 pt-8 pb-6 space-y-6">
          {/* Display name */}
          <div>
            <div className="bg-gray-100 rounded-2xl px-4 pt-3 pb-3">
              <label className="block text-[14px] text-app-text-muted mb-1">{s.edit_profile_display_name_label}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_NAME) setDisplayName(e.target.value);
                }}
                className="w-full bg-transparent outline-none text-[16px] text-app-text placeholder-gray-400"
                placeholder={s.edit_profile_display_name_placeholder}
              />
            </div>
            <div className="flex items-start justify-between mt-2 px-1">
              <p className="text-[13px] text-app-text-muted leading-snug max-w-[85%]">
                {s.edit_profile_display_name_helper}
              </p>
              <span className={`text-[13px] font-medium ${nameLen > MAX_NAME ? 'text-red-500' : 'text-gray-400'}`}>
                {MAX_NAME - nameLen}
              </span>
            </div>
          </div>

          {/* Bio / About */}
          <div>
            <div className="bg-gray-100 rounded-2xl px-4 pt-3 pb-3 relative min-h-[160px]">
              <label className="block text-[14px] text-app-text-muted mb-1">{s.edit_profile_about_label}</label>
              <textarea
                value={bio}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_BIO) setBio(e.target.value);
                }}
                rows={4}
                className="w-full bg-transparent outline-none text-[16px] text-app-text placeholder-gray-400 resize-none leading-relaxed"
                placeholder={s.edit_profile_about_placeholder}
              />
              {/* Send-like icon bottom-right (decorative) */}
              <div className="absolute bottom-3 right-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <IcSend className="w-5 h-5 text-gray-400 -rotate-[12deg]" strokeWidth={2} />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-1 px-1">
              <span className={`text-[13px] font-medium ${bioLen > MAX_BIO ? 'text-red-500' : 'text-gray-400'}`}>
                {MAX_BIO - bioLen}
              </span>
            </div>
          </div>

          {/* Social links section */}
          <div>
            <h3 className="text-[18px] font-black text-app-text">{s.edit_profile_social_links_title}</h3>
            <p className="mt-1 text-[14px] text-app-text-muted leading-snug">
              {s.edit_profile_social_links_desc}
            </p>
            <button
              type="button"
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-300 active:bg-gray-50"
            >
              <IcAdd className="w-5 h-5 text-gray-700" strokeWidth={2} />
              <span className="text-[14px] font-semibold text-gray-700">{s.edit_profile_add_social_link}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

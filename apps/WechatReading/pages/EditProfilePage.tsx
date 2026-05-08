
import React from 'react';
import { IcNavBackArrow, IcNavForward, IcUser } from '../res/icons';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { dimens } from '../res/dimens';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { localizeWechatReadingGender } from '../utils/localization';
const EditProfilePage: React.FC = () => {
    const user = useWechatReadingStore(s => s.user);
    const updateUserProfile = useWechatReadingStore(s => s.updateUserProfile);
    const { bindBack, bindTap } = useWechatReadingGestures();
    const s = useWechatReadingStrings();

    const handleUpdate = (field: string, value: string) => {
        updateUserProfile({ [field]: value });
    };

    return (
        <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100) font-sans">
            {/* Header with pt-10 for status bar */}
            <div className="flex items-center px-4 pt-10 h-24 bg-app-surface relative shrink-0">
                <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-2 active:opacity-60 absolute left-4 z-10 top-[60px]">
                    <IcNavBackArrow size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
                </button>
                <div className="flex-1 text-center font-medium text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800) pt-5">{s.edit_profile_title}</div>
            </div>

            <div className="px-4 mt-3">
                <div className="bg-app-surface rounded-2xl overflow-hidden pl-5">
                    {/* Avatar */}
                    <div className="flex items-center justify-between py-4 pr-4 border-b border-(--app-c-tw-border-slate-50) min-h-(--app-item-height-80) active:bg-(--app-c-tw-bg-slate-100) cursor-pointer">
                        <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800) font-medium whitespace-nowrap">{s.edit_profile_avatar}</span>
                        <div className="w-16 h-16 rounded-full bg-(--app-c-tw-bg-slate-100) flex items-center justify-center overflow-hidden">
                            {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                            ) : (
                                <IcUser size={dimens.icSizeAvatarSm} className="text-(--app-c-tw-text-slate-300)" />
                            )}
                        </div>
                    </div>

                    {/* Nickname - Inline Input */}
                    <div className="flex items-center justify-between py-5 pr-4 border-b border-(--app-c-tw-border-slate-50)">
                        <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800) font-medium whitespace-nowrap">{s.edit_profile_nickname}</span>
                        <input
                            type="text"
                            value={user.name || ''}
                            onChange={(e) => handleUpdate('name', e.target.value)}
                            placeholder={s.edit_profile_nickname_placeholder}
                            data-action="profile.edit.name.input"
                            data-action-type="input"
                            data-action-params={JSON.stringify({ value: user.name || '' })}
                            className="flex-1 text-right text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-500) bg-transparent outline-none ml-4 placeholder:text-(--app-c-tw-text-slate-300)"
                        />
                    </div>

                    {/* Gender */}
                    <div
                        {...bindTap<HTMLDivElement>('profile.gender.open')}
                        className="flex flex-col py-4 pr-4 border-b border-(--app-c-tw-border-slate-50) active:bg-(--app-c-tw-bg-slate-100) gap-1 cursor-pointer"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800) font-medium whitespace-nowrap">{s.edit_profile_gender}</span>
                            <div className="flex items-center gap-1">
                                <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-500)">{localizeWechatReadingGender(user.gender, s)}</span>
                                <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-tw-text-slate-300)" />
                            </div>
                        </div>
                        <span className="text-(--app-title-text-size-11) text-(--app-c-tw-text-slate-400)">{s.edit_profile_gender_hint}</span>
                    </div>

                    {/* Introduction - Inline Input */}
                    <div className="flex items-center justify-between py-5 pr-4 border-b border-(--app-c-tw-border-slate-50)">
                        <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800) font-medium whitespace-nowrap min-w-(--app-title-width-80)">{s.edit_profile_introduction}</span>
                        <input
                            type="text"
                            value={user.introduction || ''}
                            onChange={(e) => handleUpdate('introduction', e.target.value)}
                            placeholder={s.edit_profile_introduction_placeholder}
                            data-action="profile.edit.introduction.input"
                            data-action-type="input"
                            data-action-params={JSON.stringify({ value: user.introduction || '' })}
                            className="flex-1 text-right text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-500) bg-transparent outline-none ml-4 placeholder:text-(--app-c-tw-text-slate-300)"
                        />
                    </div>

                    {/* Signature - Inline Input */}
                    <div className="flex items-center justify-between py-5 pr-4">
                        <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800) font-medium whitespace-nowrap min-w-(--app-title-width-80)">{s.edit_profile_signature}</span>
                        <input
                            type="text"
                            value={user.signature || ''}
                            onChange={(e) => handleUpdate('signature', e.target.value)}
                            placeholder={s.edit_profile_signature_placeholder}
                            data-action="profile.edit.signature.input"
                            data-action-type="input"
                            data-action-params={JSON.stringify({ value: user.signature || '' })}
                            className="flex-1 text-right text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-500) bg-transparent outline-none ml-4 placeholder:text-(--app-c-tw-text-slate-300)"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditProfilePage;

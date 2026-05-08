
import React from 'react';
import { IcNavBackArrow } from '../res/icons';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { dimens } from '../res/dimens';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
const GenderSelectionPage: React.FC = () => {
    const user = useWechatReadingStore(s => s.user);
    const updateUserProfile = useWechatReadingStore(s => s.updateUserProfile);
    const { bindBack, bindTap, back } = useWechatReadingGestures();
    const s = useWechatReadingStrings();
    const [selectedGender, setSelectedGender] = React.useState(user.gender);

    return (
        <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100) font-sans">
            {/* Header with pt-10 for status bar */}
            <div className="flex items-center justify-between px-4 pt-10 h-24 bg-app-surface border-b border-(--app-c-tw-border-slate-100)">
                <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-2 active:opacity-60">
                    <IcNavBackArrow size={dimens.icSizeToolbar} className="text-(--app-c-tw-text-slate-800)" />
                </button>
                <div className="font-medium text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.gender_title}</div>
                <button
                    {...bindTap<HTMLButtonElement>(
                        { kind: 'action', id: 'profile.gender.submit' },
                        {
                            onTrigger: () => {
                                updateUserProfile({ gender: selectedGender });
                                back();
                            },
                        },
                    )}
                    className="text-(--app-settings-item-text-size) font-medium text-(--app-c-tw-text-blue-500) active:opacity-60"
                >
                    {s.gender_done}
                </button>
            </div>

            <div className="mt-4 bg-app-surface">
                <div
                    className="flex items-center h-14 px-5 active:bg-(--app-c-tw-bg-slate-100) border-b border-(--app-c-tw-border-slate-50) cursor-pointer"
                    {...bindTap<HTMLDivElement>(
                        { kind: 'action', id: 'profile.gender.select.male' },
                        { onTrigger: () => setSelectedGender('男') },
                    )}
                >
                    <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800)">{s.gender_male}</span>
                    {selectedGender === '男' && <div className="ml-auto w-2 h-2 rounded-full bg-(--app-c-tw-bg-blue-500)"></div>}
                </div>
                <div
                    className="flex items-center h-14 px-5 active:bg-(--app-c-tw-bg-slate-100) cursor-pointer"
                    {...bindTap<HTMLDivElement>(
                        { kind: 'action', id: 'profile.gender.select.female' },
                        { onTrigger: () => setSelectedGender('女') },
                    )}
                >
                    <span className="text-(--app-title-text-size-16) text-(--app-c-tw-text-slate-800)">{s.gender_female}</span>
                    {selectedGender === '女' && <div className="ml-auto w-2 h-2 rounded-full bg-(--app-c-tw-bg-blue-500)"></div>}
                </div>
            </div>
        </div>
    );
};

export default GenderSelectionPage;

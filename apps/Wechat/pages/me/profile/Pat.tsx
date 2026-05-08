import React, { useState } from 'react';
import { useWechatStrings } from '../../../hooks/useWechatStrings';
import { useWechatStore } from '../../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../../hooks/useWechatGestures';

export const PatPage = () => {
    const t = useWechatStrings();
    const { user, updateUser } = useWechatStore(useShallow(s => ({
        user: s.user,
        updateUser: s.updateUser,
    })));
    const { back, bindTap } = useWechatGestures();
    const [pat, setPat] = useState(user.pat || '');

    const handleSave = () => {
        updateUser({ pat });
        back();
    };

    const hasChanged = pat !== (user.pat || '');

    return (
        <div className="min-h-full bg-app-surface flex flex-col relative">
             <div className="text-center text-(--app-item-text-size-22) font-bold text-app-text mt-16 mb-12">设置拍一拍</div>
             
             <div className="border-t border-(--app-c-tw-border-gray-100)">
                <div className="flex items-center px-8 py-5 border-b border-(--app-c-tw-border-gray-100)">
                    <span className="text-(--app-settings-item-text-size) text-app-text mr-2 font-normal">朋友拍了拍我</span>
                    <input 
                        type="text" 
                        value={pat}
                        onChange={(e) => setPat(e.target.value)}
                        className="flex-1 text-(--app-settings-item-text-size) text-app-text outline-none bg-transparent caret-app-primary"
                        autoFocus
                    />
                </div>
             </div>

             <div className="px-8 mt-5 text-(--app-c-settings-item-chevron) text-(--app-search-filter-text-size)">
                朋友拍你的时侯将出现
             </div>
            
             <div className="mt-auto mb-20 flex justify-center w-full">
                <button 
                    {...bindTap<HTMLButtonElement>(
                        { kind: 'action', id: 'profile.pat.submit' },
                        { onTrigger: handleSave },
                    )}
                    disabled={!hasChanged}
                    className={`w-(--app-item-width-184) py-2.5 rounded-[8px] font-bold text-(--app-settings-item-text-size)
                        ${hasChanged
                            ? 'bg-app-primary text-white active:bg-app-primary-dark'
                            : 'bg-(--app-c-me-avatar-bg) text-(--app-c-settings-item-chevron)'
                        }
                    `}
                    style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                >
                    {t.common_done}
                </button>
             </div>
        </div>
    );
};

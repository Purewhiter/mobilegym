
import React from 'react';
import { IcNavBack, IcCheck } from '../../res/icons';
import { dimens } from '../../res/dimens';
import { useWechatReadingStore } from '../../state';
import { useWechatReadingGestures } from '../../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../../hooks/useWechatReadingStrings';

const PageTurnStylePage: React.FC = () => {
    const { bindBack, bindTap } = useWechatReadingGestures();
    const settings = useWechatReadingStore(s => s.settings);
    const updateSettings = useWechatReadingStore(s => s.updateSettings);
    const s = useWechatReadingStrings();

    return (
        <div className="flex flex-col h-full bg-(--app-c-tw-bg-slate-100)">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-3 bg-app-surface sticky top-0 z-10">
                <div className="w-10 flex justify-start" {...bindBack()}>
                    <IcNavBack size={dimens.settings_header_back_size} className="text-(--app-c-tw-text-slate-800)" />
                </div>
                <div className="flex-1 text-center font-bold text-(--app-modal-action-text-size) text-(--app-c-tw-text-slate-800)">{s.page_turn_title}</div>
                <div className="w-10" />
            </div>

            <div className="p-4">
                <div className="bg-app-surface rounded-xl overflow-hidden">
                    <div
                        className="flex justify-between items-center px-5 py-4 border-b border-(--app-c-tw-border-gray-50) active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        {...bindTap<HTMLDivElement>(
                            { kind: 'action', id: 'settings.pageTurnStyle.select.simulation' },
                            { onTrigger: () => updateSettings({ pageTurnStyle: '仿真翻页' }) },
                        )}
                    >
                        <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{s.page_turn_simulation}</span>
                        {settings.pageTurnStyle === '仿真翻页' && <IcCheck size={dimens.icSizeAction} className="text-(--app-c-tw-text-blue-500)" />}
                    </div>
                    <div
                        className="flex justify-between items-center px-5 py-4 border-b border-(--app-c-tw-border-gray-50) active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        {...bindTap<HTMLDivElement>(
                            { kind: 'action', id: 'settings.pageTurnStyle.select.swipe' },
                            { onTrigger: () => updateSettings({ pageTurnStyle: '左右滑动' }) },
                        )}
                    >
                        <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{s.page_turn_swipe}</span>
                        {settings.pageTurnStyle === '左右滑动' && <IcCheck size={dimens.icSizeAction} className="text-(--app-c-tw-text-blue-500)" />}
                    </div>
                    <div
                        className="flex justify-between items-center px-5 py-4 border-b border-(--app-c-tw-border-gray-50) active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        {...bindTap<HTMLDivElement>(
                            { kind: 'action', id: 'settings.pageTurnStyle.select.scroll' },
                            { onTrigger: () => updateSettings({ pageTurnStyle: '上下滚动' }) },
                        )}
                    >
                        <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{s.page_turn_scroll}</span>
                        {settings.pageTurnStyle === '上下滚动' && <IcCheck size={dimens.icSizeAction} className="text-(--app-c-tw-text-blue-500)" />}
                    </div>
                    <div
                        className="flex justify-between items-center px-5 py-4 last:border-0 active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
                        {...bindTap<HTMLDivElement>(
                            { kind: 'action', id: 'settings.pageTurnStyle.select.cover' },
                            { onTrigger: () => updateSettings({ pageTurnStyle: '覆盖翻页' }) },
                        )}
                    >
                        <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-slate-800)">{s.page_turn_cover}</span>
                        {settings.pageTurnStyle === '覆盖翻页' && <IcCheck size={dimens.icSizeAction} className="text-(--app-c-tw-text-blue-500)" />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PageTurnStylePage;


import React, { useEffect, useRef, useCallback, useState } from 'react';
import { dimens } from '../../res/dimens';
import { IcLocation, IcNavForward, IcAt, IcUserCircle, IcAdd, IcClose } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { WechatSmartImage } from '../../components/WechatSmartImage';
import { useWechatStrings } from '../../hooks/useWechatStrings';

const POST_MOMENT_TRY_EXIT_EVENT = 'wechat:postMoment:tryExit';

export const PostMomentPage: React.FC = () => {
    const t = useWechatStrings();
    const { bindTap, back } = useWechatGestures();
    const { momentDraft, updateMomentDraft, clearMomentDraft, postMoment, setRightAction } = useWechatStore(useShallow(s => ({
        momentDraft: s.momentDraft,
        updateMomentDraft: s.updateMomentDraft,
        clearMomentDraft: s.clearMomentDraft,
        postMoment: s.postMoment,
        setRightAction: s.setRightAction,
    })));
    const isSubmitting = useRef(false);
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const showLeaveConfirmRef = useRef(false);
    useEffect(() => {
        showLeaveConfirmRef.current = showLeaveConfirm;
    }, [showLeaveConfirm]);
    
    // 使用 ref 解决闭包陷阱，确保 setRightAction 内部能拿到最新的 momentDraft
    const draftRef = useRef(momentDraft);
    useEffect(() => {
        draftRef.current = momentDraft;
    }, [momentDraft]);

    // back 在 useWechatGestures 内部可能每次 render 都是新引用；
    // 用 ref 固定它，避免 useEffect 依赖变化引发无限 setState 循环。
    const backRef = useRef(back);
    useEffect(() => {
        backRef.current = back;
    }, [back]);

    useEffect(() => {
        setRightAction({
            id: 'moments.post.submit',
            onTrigger: () => {
            if (isSubmitting.current) return;
            
            const currentDraft = draftRef.current;
            // 如果内容和图片都为空，则不进行发表操作
            if (!currentDraft.content.trim() && currentDraft.selectedImages.length === 0) return;
            
            isSubmitting.current = true;
            postMoment(currentDraft.content, currentDraft.selectedImages, currentDraft.location || undefined);
            clearMomentDraft();
            
            // 按照微信逻辑：发表完成后直接“弹出”当前发表层级，返回到进入发表流程之前的页面（朋友圈首页）
            // 由于我们在 Camera -> Edit -> Post 过程中使用了 replace，
            // 这里的 back() 会准确跳过整个流程，回到最开始发起发表的页面。
            backRef.current();
            },
        });
        return () => {
            setRightAction(null);
            isSubmitting.current = false;
        };
    }, [postMoment, clearMomentDraft, setRightAction]);

    const tryExit = useCallback(() => {
        // 若确认弹窗已打开，再次触发 back（例如系统侧滑返回）则视为“取消退出”，关闭弹窗
        if (showLeaveConfirmRef.current) {
            setShowLeaveConfirm(false);
            return;
        }

        const currentDraft = draftRef.current;
        const hasContent =
            Boolean(currentDraft.content?.trim()) ||
            (currentDraft.selectedImages?.length ?? 0) > 0 ||
            Boolean(currentDraft.location);

        if (hasContent) {
            setShowLeaveConfirm(true);
            return;
        }

        backRef.current();
    }, []);

    useEffect(() => {
        const handler = () => tryExit();
        window.addEventListener(POST_MOMENT_TRY_EXIT_EVENT, handler);
        return () => window.removeEventListener(POST_MOMENT_TRY_EXIT_EVENT, handler);
    }, [tryExit]);

    const confirmKeep = () => {
        setShowLeaveConfirm(false);
        backRef.current();
    };

    const confirmDiscard = () => {
        setShowLeaveConfirm(false);
        clearMomentDraft();
        backRef.current();
    };

    const removeImage = (index: number) => {
        const newImages = [...momentDraft.selectedImages];
        newImages.splice(index, 1);
        updateMomentDraft({ selectedImages: newImages });
    };

    return (
        <div className="bg-app-surface min-h-full flex flex-col">
            {/* 文字输入区域 */}
            <div className="px-4 pt-4 pb-6">
                <textarea 
                    className="w-full h-(--app-card-height-120) text-(--app-settings-item-text-size) text-(--app-c-common-text-primary) resize-none outline-none placeholder-(--app-c-tw-placeholder-gray-400) leading-relaxed mb-4"
                    placeholder={t.post_moment_placeholder}
                    value={momentDraft.content}
                    onChange={(e) => updateMomentDraft({ content: e.target.value })}
                    autoFocus
                />

                {/* 图片网格 */}
                <div className="grid grid-cols-3 gap-2">
                    {momentDraft.selectedImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square bg-(--app-c-tw-bg-gray-50) rounded-[2px] overflow-hidden">
                            <WechatSmartImage src={img} className="w-full h-full object-cover" alt="" />
                            <button 
                                onClick={() => removeImage(idx)}
                                className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"
                            >
                                <IcClose size={dimens.icSizeTiny} className="text-white" />
                            </button>
                        </div>
                    ))}
                    
                    {momentDraft.selectedImages.length < 9 && (
                        <div 
                            {...bindTap<HTMLDivElement>('postMoment.mediaPicker.open', { params: { albumId: 'all' } })}
                            className="aspect-square bg-(--app-c-chat-input-bar-bg) rounded-[2px] flex items-center justify-center active:bg-(--app-c-tw-bg-gray-200) cursor-pointer"
                        >
                            <IcAdd size={dimens.icSizeAddLarge} className="text-(--app-c-tw-text-gray-300)" strokeWidth={1.5} />
                        </div>
                    )}
                </div>
            </div>

            {/* 选项列表 - 位于中间位置 */}
            <div className="border-t border-app-border mx-4 mt-4">
                <div 
                    {...bindTap<HTMLDivElement>('selectLocation.open', { params: { target: 'moment' } })}
                    className="flex items-center py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer border-b border-(--app-c-tw-border-gray-100)"
                >
                    <IcLocation size={dimens.icSizeCheck} className={momentDraft.location ? "text-app-primary" : "text-(--app-c-common-text-secondary)"} strokeWidth={1.5} />
                    <span className={`ml-4 min-w-0 flex-1 text-(--app-settings-item-text-size) break-words [overflow-wrap:anywhere] ${momentDraft.location ? 'text-app-primary' : 'text-(--app-c-common-text-secondary)'}`}>
                        {momentDraft.location || t.post_moment_location_placeholder}
                    </span>
                    <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-common-text-disabled)" strokeWidth={dimens.icStrokeWidth} />
                </div>
                
                <div className="flex items-center py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer border-b border-(--app-c-tw-border-gray-100)">
                    <IcAt size={dimens.icSizeCheck} className="text-(--app-c-common-text-secondary)" strokeWidth={1.5} />
                    <span className="ml-4 min-w-0 flex-1 text-(--app-settings-item-text-size) text-(--app-c-common-text-secondary) break-words [overflow-wrap:anywhere]">{t.post_moment_remind_who}</span>
                    <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-common-text-disabled)" strokeWidth={dimens.icStrokeWidth} />
                </div>

                <div className="flex items-center py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer">
                    <IcUserCircle size={dimens.icSizeCheck} className="text-(--app-c-common-text-secondary)" strokeWidth={1.5} />
                    <span className="ml-4 min-w-0 flex-1 text-(--app-settings-item-text-size) text-(--app-c-common-text-secondary) break-words [overflow-wrap:anywhere]">{t.post_moment_who_can_see}</span>
                    <div className="flex items-center">
                        <span className="text-(--app-c-chat-list-item-time) text-(--app-settings-item-text-size)">{t.post_moment_public}</span>
                        <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-common-text-disabled) ml-1" strokeWidth={dimens.icStrokeWidth} />
                    </div>
                </div>
            </div>

            {showLeaveConfirm && (
                <div
                    className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t.post_moment_keep_edit}
                >
                    <div className="w-(--app-card-width-320) bg-app-surface rounded-[12px] overflow-hidden shadow-xl">
                        <div className="px-6 py-6 text-center text-(--app-title-text-size-18) text-app-text break-words [overflow-wrap:anywhere]">
                            {t.post_moment_keep_edit}
                        </div>
                        <div className="h-px bg-(--app-c-tw-bg-gray-100)" />
                        <div className="grid grid-cols-2">
                            <button
                                onClick={confirmDiscard}
                                className="py-4 text-(--app-settings-item-text-size) text-app-text font-semibold active:bg-(--app-c-tw-bg-gray-50) border-r border-(--app-c-tw-border-gray-100)"
                            >
                                {t.post_moment_dont_keep}
                            </button>
                            <button
                                onClick={confirmKeep}
                                className="py-4 text-(--app-settings-item-text-size) text-(--app-c-address-link-text) font-semibold active:bg-(--app-c-tw-bg-gray-50)"
                            >
                                {t.post_moment_keep}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

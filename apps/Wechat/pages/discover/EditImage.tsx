
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcRotateCcw, IcRotateCw, IcType, IcSmile, IcCrop, IcGrid, IcEdit } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
export const EditImage: React.FC = () => {
  const t = useWechatStrings();
    const { bindTap, bindBack, go } = useWechatGestures();
    const { momentDraft, updateMomentDraft } = useWechatStore(useShallow(s => ({
        momentDraft: s.momentDraft,
        updateMomentDraft: s.updateMomentDraft,
    })));
    const image = momentDraft.tempCapturedImage;

    const handleDone = () => {
        if (image) {
            updateMomentDraft({ selectedImages: [image], tempCapturedImage: undefined });
            // 使用 replace 替换编辑页，这样发表页点击返回会直接回到朋友圈
            go('editImage.postMoment.open');
        }
    };

    return (
        <div className="absolute inset-0 bg-black z-[120] flex flex-col" data-status-bar-foreground="light">
            <div className="absolute top-6 left-6 right-6 flex justify-between items-center text-white z-10">
                <button {...bindBack<HTMLButtonElement>()} className="text-(--app-settings-item-text-size)">{t.common_cancel}</button>
                <div className="flex gap-6">
                    <IcRotateCcw size={dimens.icSizeToolbar} className="opacity-60" />
                    <IcRotateCw size={dimens.icSizeToolbar} className="opacity-60" />
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                {image && <img src={image} className="w-full object-contain" alt="" />}
            </div>

            <div className="h-(--app-card-height-120) bg-black px-6 flex flex-col justify-center gap-6">
                <div className="flex justify-between items-center px-2">
                    <IcEdit size={dimens.icSizeToolbar} className="text-white" />
                    <IcSmile size={dimens.icSizeToolbar} className="text-white" />
                    <IcType size={dimens.icSizeToolbar} className="text-white" />
                    <IcCrop size={dimens.icSizeToolbar} className="text-white" />
                    <IcGrid size={dimens.icSizeToolbar} className="text-white" />
                    <button 
                        {...bindTap<HTMLButtonElement>('editImage.postMoment.open', { onTrigger: handleDone })}
                        className="bg-app-primary text-white px-4 py-1.5 rounded-[4px] text-(--app-search-filter-text-size) font-medium active:opacity-80"
                    >
                        {t.common_done}
                    </button>
                </div>
                <div className="h-4"></div>
            </div>
        </div>
    );
};

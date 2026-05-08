import React, { useCallback, useEffect, useRef, useState } from 'react';
import { dimens } from '../../res/dimens';
import { IcLocation, IcNavForward, IcAt, IcUserCircle } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStrings } from '../../hooks/useWechatStrings';

const POST_TEXT_MOMENT_TRY_EXIT_EVENT = 'wechat:postTextMoment:tryExit';

export const PostTextMomentPage: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap, back } = useWechatGestures();
  const {
    textMomentDraft,
    updateTextMomentDraft,
    clearTextMomentDraft,
    postMoment,
    setRightAction,
  } = useWechatStore(useShallow(s => ({
    textMomentDraft: s.textMomentDraft,
    updateTextMomentDraft: s.updateTextMomentDraft,
    clearTextMomentDraft: s.clearTextMomentDraft,
    postMoment: s.postMoment,
    setRightAction: s.setRightAction,
  })));

  const isSubmitting = useRef(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const showLeaveConfirmRef = useRef(false);
  useEffect(() => {
    showLeaveConfirmRef.current = showLeaveConfirm;
  }, [showLeaveConfirm]);

  const draftRef = useRef(textMomentDraft);
  useEffect(() => {
    draftRef.current = textMomentDraft;
  }, [textMomentDraft]);

  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  }, [back]);

  useEffect(() => {
    setRightAction({
      id: 'moments.postText.submit',
      onTrigger: () => {
        if (isSubmitting.current) return;
        const currentDraft = draftRef.current;
        if (!currentDraft.content.trim()) return;

        isSubmitting.current = true;
        postMoment(currentDraft.content, undefined, currentDraft.location || undefined);
        clearTextMomentDraft();
        backRef.current();
      },
    });

    return () => {
      setRightAction(null);
      isSubmitting.current = false;
    };
  }, [postMoment, clearTextMomentDraft, setRightAction]);

  const tryExit = useCallback(() => {
    if (showLeaveConfirmRef.current) {
      setShowLeaveConfirm(false);
      return;
    }
    const currentDraft = draftRef.current;
    const hasContent = Boolean(currentDraft.content?.trim()) || Boolean(currentDraft.location);
    if (hasContent) {
      setShowLeaveConfirm(true);
      return;
    }
    backRef.current();
  }, []);

  useEffect(() => {
    const handler = () => tryExit();
    window.addEventListener(POST_TEXT_MOMENT_TRY_EXIT_EVENT, handler);
    return () => window.removeEventListener(POST_TEXT_MOMENT_TRY_EXIT_EVENT, handler);
  }, [tryExit]);

  const confirmKeep = () => {
    setShowLeaveConfirm(false);
    backRef.current();
  };

  const confirmDiscard = () => {
    setShowLeaveConfirm(false);
    clearTextMomentDraft();
    backRef.current();
  };

  return (
    <div className="bg-app-surface min-h-full flex flex-col">
      {/* 文字输入区域 */}
      <div className="px-4 pt-4 pb-16">
        <textarea
          className="w-full h-(--app-item-height-180) text-(--app-settings-item-text-size) text-(--app-c-common-text-primary) resize-none outline-none placeholder-(--app-c-tw-placeholder-gray-400) leading-relaxed"
          placeholder={t.post_moment_placeholder}
          value={textMomentDraft.content}
          onChange={(e) => updateTextMomentDraft({ content: e.target.value })}
          autoFocus
        />
      </div>

      {/* 选项列表 - 位于中间位置 */}
      <div className="border-t border-app-border mx-4">
        <div
          {...bindTap<HTMLDivElement>('selectLocation.open', { params: { target: 'text' } })}
          className="flex items-center py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer border-b border-(--app-c-tw-border-gray-100)"
        >
          <IcLocation size={dimens.icSizeCheck} className={textMomentDraft.location ? 'text-app-primary' : 'text-(--app-c-common-text-secondary)'} strokeWidth={1.5} />
          <span
            className={`ml-4 min-w-0 text-(--app-settings-item-text-size) flex-1 break-words [overflow-wrap:anywhere] ${
              textMomentDraft.location ? 'text-app-primary' : 'text-(--app-c-common-text-secondary)'
            }`}
          >
            {textMomentDraft.location || t.post_moment_location_placeholder}
          </span>
          <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-common-text-disabled)" strokeWidth={dimens.icStrokeWidth} />
        </div>

        <div className="flex items-center py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer border-b border-(--app-c-tw-border-gray-100)">
          <IcAt size={dimens.icSizeCheck} className="text-(--app-c-common-text-secondary)" strokeWidth={1.5} />
          <span className="ml-4 min-w-0 text-(--app-settings-item-text-size) flex-1 text-(--app-c-common-text-secondary) break-words [overflow-wrap:anywhere]">{t.post_moment_remind_who}</span>
          <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-common-text-disabled)" strokeWidth={dimens.icStrokeWidth} />
        </div>

        <div className="flex items-center py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer">
          <IcUserCircle size={dimens.icSizeCheck} className="text-(--app-c-common-text-secondary)" strokeWidth={1.5} />
          <span className="ml-4 min-w-0 text-(--app-settings-item-text-size) flex-1 text-(--app-c-common-text-secondary) break-words [overflow-wrap:anywhere]">{t.post_moment_who_can_see}</span>
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
            <div className="px-6 py-6 text-center text-(--app-title-text-size-18) text-app-text break-words [overflow-wrap:anywhere]">{t.post_moment_keep_edit}</div>
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

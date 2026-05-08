import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React, { useEffect, useRef, useState } from 'react';
import { IcClose, IcNavBack } from '../../res/icons';
const X = IcClose, ChevronLeft = IcNavBack;
import { useRedBookStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
export const PublishTextEntryPage: React.FC = () => {
  const s = useRedBookStrings();
  const { publishDraft, updatePublishDraft } = useRedBookStore(useShallow(s => ({ publishDraft: s.publishDraft, updatePublishDraft: s.updatePublishDraft })));
  const { bindTap, bindBack, go, back } = useRedBookGestures();
  const [text, setText] = useState(publishDraft.text || '');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear draft when entering this page (mount)
  useEffect(() => {
    setText('');
    updatePublishDraft({ text: '', title: '' });
    setIsEditing(false);
  }, []);

  useEffect(() => {
    updatePublishDraft({ text });
  }, [text, updatePublishDraft]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleClose = () => {
    if (isEditing) {
      setIsEditing(false);
      return;
    }
    back();
  };

  const handleNext = () => {
    if (!text.trim()) return;
    updatePublishDraft({ text });
    go('publish.text.template.open');
  };

  return (
    <div className="h-full w-full bg-[#f4f7fb] flex flex-col">
      <div className="pt-10 px-4 pb-3 flex items-center justify-between">
        <button
          className="w-8 h-8 flex items-center justify-start"
          {...bindBack({ onTrigger: handleClose })}
        >
          {isEditing ? <ChevronLeft size={24} className="text-[#111]" /> : <X size={22} className="text-[#111]" />}
        </button>
        {isEditing ? (
          <div className="text-[17px] font-medium text-[#111]">{s.write_a_post}</div>
        ) : (
          <div className="text-[17px] font-medium text-transparent">{s.placeholder}</div>
        )}
        {isEditing ? (
          <button
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium ${
              text.trim() ? 'bg-app-primary text-white' : 'bg-[#f0f0f0] text-[#bbb]'
            }`}
            {...(text.trim() ? bindTap('publish.text.template.open', { onTrigger: handleNext }) : {})}
          >
            {s.next}
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      <div
        className="flex-1 px-4"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {!isEditing && (
          <div
            className="bg-app-surface rounded-[18px] h-[320px] shadow-[0_6px_20px_rgba(0,0,0,0.05)] flex flex-col p-8"
            onClick={() => setIsEditing(true)}
          >
            <div className="text-[24px] font-bold text-app-text mb-3">{s.write_a_post}</div>
            <div className="text-[18px] text-[#d0d0d0]">{s.say_something_or_ask_a_question}</div>
          </div>
        )}

        {isEditing && (
          <div className="bg-app-surface rounded-[18px] h-[360px] shadow-[0_6px_20px_rgba(0,0,0,0.05)] flex flex-col p-6">
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none text-[18px] text-[#222] outline-none placeholder-[#d0d0d0]"
              placeholder={s.say_something_or_ask_a_question}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        {!isEditing && (
          <div className="mt-6 bg-app-surface rounded-[16px] flex items-center justify-between px-6 py-4 shadow-[0_6px_20px_rgba(0,0,0,0.04)]">
            <div>
              <div className="text-[18px] font-medium text-app-text">{s.write_long_post}</div>
              <div className="text-[12px] text-[#aaa] mt-1">{s.supports_10k_and_words_full_screen_reading}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
              <span className="text-white text-xl">→</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublishTextEntryPage;

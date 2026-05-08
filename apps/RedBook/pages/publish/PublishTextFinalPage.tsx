import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { IcNavBack, IcHash, IcAt, IcChart } from '../../res/icons';
const ChevronLeft = IcNavBack, Hash = IcHash, AtSign = IcAt, BarChart2 = IcChart;
import { useRedBookStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
export const PublishTextFinalPage: React.FC = () => {
  const s = useRedBookStrings();
  const { publishDraft, updatePublishDraft, addNote } = useRedBookStore(useShallow(s => ({ publishDraft: s.publishDraft, updatePublishDraft: s.updatePublishDraft, addNote: s.addNote })));
  const { bindTap, bindBack, back } = useRedBookGestures();
  const [title, setTitle] = useState(publishDraft.title || '');
  const [content, setContent] = useState(publishDraft.text || '');

  const handlePublish = () => {
    updatePublishDraft({ text: content, title });
    addNote({
      title: title.trim(),
      content: content.trim(),
      images: publishDraft.images,
    });
    back(3);
  };

  const handleSaveDraft = () => {
    updatePublishDraft({ text: content, title });
    back();
  };

  return (
    <div className="h-full flex flex-col bg-app-surface">
      <div className="pt-10 px-4 pb-3 flex items-center justify-between">
        <button className="w-8 h-8 flex items-center justify-start" {...bindBack()}>
          <ChevronLeft size={24} className="text-[#111]" />
        </button>
        <div className="text-[17px] font-medium text-[#111]">{s.publish_note}</div>
        <div className="w-12" />
      </div>

      <div
        className="flex-1 overflow-y-auto px-4"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="flex items-start gap-4">
          {publishDraft.images[0] ? (
            <img
              src={publishDraft.images[0]}
              alt=""
              className="w-[72px] h-[72px] rounded-[10px] shadow-sm object-cover bg-gray-100"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-[10px] shadow-sm bg-gray-100" />
          )}
          <div className="w-[72px] h-[72px] rounded-[10px] border border-dashed border-gray-200 flex items-center justify-center text-[#ccc] text-[24px]">+</div>
        </div>

        <div className="mt-6 text-[16px] text-[#ccc]">
          <input
            className="w-full text-[18px] text-app-text placeholder-[#cfcfcf] outline-none"
            placeholder={s.add_title}
            value={title}
            onChange={(e) => {
              const next = e.target.value;
              setTitle(next);
              updatePublishDraft({ title: next });
            }}
          />
        </div>

        <textarea
          className="mt-4 w-full min-h-[120px] text-[15px] text-app-text outline-none resize-none"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="mt-4 flex items-center gap-3">
          <button className="px-4 py-2 rounded-full bg-[#f6f6f6] text-[13px] text-[#666] flex items-center gap-2">
            <Hash size={14} /> {s.topic}
          </button>
          <button className="px-4 py-2 rounded-full bg-[#f6f6f6] text-[13px] text-[#666] flex items-center gap-2">
            <AtSign size={14} /> {s.users}
          </button>
          <button className="px-4 py-2 rounded-full bg-[#f6f6f6] text-[13px] text-[#666] flex items-center gap-2">
            <BarChart2 size={14} /> {s.poll}
          </button>
        </div>

        <div className="mt-6 space-y-4 text-[15px] text-[#555]">
          <div className="flex items-center justify-between">
            <span>{s.tag_location}</span>
            <span className="text-app-text-muted">{'>'}</span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-app-text-muted">
            <span className="px-2 py-1 bg-[#f6f6f6] rounded-full">{s.ucas}</span>
            <span className="px-2 py-1 bg-[#f6f6f6] rounded-full">{s.cas_physics}</span>
            <span className="px-2 py-1 bg-[#f6f6f6] rounded-full">{s.brbr_syrian_food}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{s.visible_to_all}</span>
            <span className="text-app-text-muted">{'>'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{s.add_component}</span>
            <span className="text-app-text-muted">{s.can_add_files} {'>'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{s.advanced_options}</span>
            <span className="text-app-text-muted">{'>'}</span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 pt-4 flex items-center gap-4">
        <button
          className="flex-1 h-[44px] border border-app-primary text-app-primary rounded-full text-[15px]"
          {...bindBack({ onTrigger: handleSaveDraft })}
        >
          {s.save_draft}
        </button>
        <button
          className="flex-[2] h-[44px] bg-app-primary text-white rounded-full text-[16px] font-medium"
          {...bindTap({ kind: 'action', id: 'publish.text.submit' }, { onTrigger: handlePublish })}
        >
          {s.publish_note}
        </button>
      </div>
    </div>
  );
};

export default PublishTextFinalPage;

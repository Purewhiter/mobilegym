import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack } from '../../res/icons';
const ChevronLeft = IcNavBack;
import { useRedBookStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
import { type StringKey } from '../../res/strings';
import { TemplatePreview, type TemplateId } from '../../components/TemplatePreview';
import { rasterizeTemplateCard } from '../../utils/rasterizeTemplate';

const templates: { id: TemplateId, label: StringKey }[] = [
  { id: 'basic', label: 'basic' },
  { id: 'fresh', label: 'fresh' },
  { id: 'memo', label: 'memo' },
  { id: 'border', label: 'border' },
  { id: 'scribble', label: 'doodle' }
];

export const PublishTextTemplatePage: React.FC = () => {
  const s = useRedBookStrings();
  const { publishDraft, updatePublishDraft } = useRedBookStore(useShallow(s => ({ publishDraft: s.publishDraft, updatePublishDraft: s.updatePublishDraft })));
  const { bindTap, bindBack, go } = useRedBookGestures();

  const handleSelect = (id: string) => {
    updatePublishDraft({ templateId: id });
  };

  const handleNext = () => {
    const cardImage = rasterizeTemplateCard(publishDraft.templateId, (publishDraft.text || '').trim());
    updatePublishDraft({ images: cardImage ? [cardImage] : [] });
    go('publish.text.final.open');
  };

  const activeId = publishDraft.templateId || 'basic';

  return (
    <div className="h-full w-full bg-[#f4f7fb] flex flex-col">
      <div className="pt-10 px-4 pb-3 flex items-center justify-between">
        <button className="w-8 h-8 flex items-center justify-start" {...bindBack()}>
          <ChevronLeft size={24} className="text-[#111]" />
        </button>
        <div className="text-[17px] font-medium text-[#111]">{s.preview}</div>
        <div className="w-12" />
      </div>

      <div
        className="flex-1 px-4"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <TemplatePreview
          templateId={activeId}
          text={publishDraft.text}
          fallbackText={s.write_a_post}
          variant="large"
          className="rounded-[22px] h-[360px] shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
        />

        <div className="mt-6">
          <div className="text-[14px] text-app-text-muted mb-4">{s.choose_a_card_you_like}</div>
          <div className="flex items-center gap-4 overflow-x-auto">
            {templates.map((item) => {
              const selected = activeId === item.id;
              return (
                <button key={item.id} onClick={() => handleSelect(item.id)}>
                  <div className={`w-[64px] flex flex-col items-center gap-2 ${selected ? 'text-app-primary' : 'text-[#666]'}`}>
                    <TemplatePreview
                      templateId={item.id}
                      text={publishDraft.text}
                      fallbackText={s.write_a_post}
                      variant="thumb"
                      className={`w-[64px] h-[64px] rounded-[10px] ${selected ? 'ring-2 ring-app-primary' : ''}`}
                    />
                    <div className="text-[12px]">{s[item.label]}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 pb-10">
        <button
          className="w-full bg-app-primary text-white text-[16px] font-medium rounded-full py-3"
          {...bindTap('publish.text.final.open', { onTrigger: handleNext })}
        >
          {s.next}
        </button>
      </div>
    </div>
  );
};

export default PublishTextTemplatePage;

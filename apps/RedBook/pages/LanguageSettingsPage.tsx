import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack, IcCheck } from '../res/icons';
const ChevronLeft = IcNavBack, Check = IcCheck;
import { useRedBookStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
const ListItem = ({
    label,
    isSelected,
    isLast = false,
    ...props
}: {
    label: string,
    isSelected: boolean,
    isLast?: boolean
    [key: string]: any
}) => (
    <div
      className={`flex items-center justify-between px-4 py-[18px] active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
      {...props}
    >
        <span className="text-[16px] text-app-text">{label}</span>
        {isSelected && <Check size={20} className="text-app-primary" />}
    </div>
);

const LanguageSettingsPage: React.FC = () => {
  const { bindBack, bindTap } = useRedBookGestures();
  const { settings, updateSettings } = useRedBookStore(useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings })));
  const s = useRedBookStrings();
  const selectedLanguage = settings.language;
  const [draftLanguage, setDraftLanguage] = React.useState(selectedLanguage);

  React.useEffect(() => {
    // Keep draft in sync when external state changes (e.g., after saving).
    setDraftLanguage(selectedLanguage);
  }, [selectedLanguage]);

  const isDirty = draftLanguage !== selectedLanguage;

  const languages = [
    { id: 'zh-CN', label: s.simplified_chinese },
    { id: 'zh-TW', label: s.traditional_chinese },
    { id: 'en-US', label: s.english },
  ];

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center justify-between bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 p-1 -ml-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="text-[17px] font-medium text-app-text">{s.language_and_translation}</div>
        <button
          type="button"
          disabled={!isDirty}
          onClick={() => {
            if (!isDirty) return;
            updateSettings('language', draftLanguage);
          }}
          className={`px-3 py-1 rounded-full text-[13px] transition-colors ${
            isDirty ? 'bg-[#FF2D55] text-white active:opacity-80' : 'bg-[#f0f0f0] text-app-text-muted'
          }`}
        >
          {s.languagesettingspage_save}
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-3 pt-2"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {/* Section Title */}
          <div className="px-4 pt-2 pb-3 text-[12px] text-app-text-muted mt-2">{s.select_language}</div>
          
          {/* Language List */}
          <div className="bg-app-surface rounded-xl overflow-hidden">
               {languages.map((lang, index) => (
                   <div key={lang.id}>
                       <ListItem
                         label={lang.label}
                         isSelected={draftLanguage === lang.id}
                         {...(lang.id === 'zh-CN'
                          ? bindTap({ kind: 'action', id: 'settings.language.select.zhCN' }, { onTrigger: () => { setDraftLanguage('zh-CN'); } })
                           : lang.id === 'zh-TW'
                            ? bindTap({ kind: 'action', id: 'settings.language.select.zhTW' }, { onTrigger: () => { setDraftLanguage('zh-TW'); } })
                            : bindTap({ kind: 'action', id: 'settings.language.select.enUS' }, { onTrigger: () => { setDraftLanguage('en-US'); } }))}
                         isLast={index === languages.length - 1}
                       />
                   </div>
               ))}
          </div>
      </div>
    </div>
  );
};

export default LanguageSettingsPage;

import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React, { useState } from 'react';
import { IcNavBack } from '../../res/icons';
const ChevronLeft = IcNavBack;
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    actionProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, actionProps }) => (
    <div 
        className={`w-[44px] h-[24px] rounded-full relative transition-colors cursor-pointer ${checked ? 'bg-app-primary' : 'bg-[#e5e5e5]'}`}
        {...(actionProps ?? {})}
        onClick={(e) => {
            const anyProps: any = actionProps ?? {};
            if (anyProps.onClick) return anyProps.onClick(e);
            e.stopPropagation();
            onChange(!checked);
        }}
    >
        <div className={`w-[20px] h-[20px] bg-app-surface rounded-full absolute top-[2px] transition-all shadow-sm ${checked ? 'left-[22px]' : 'left-[2px]'}`} />
    </div>
);

const PersonalizationPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const [recommendation, setRecommendation] = useState(true);
  const [ads, setAds] = useState(true);

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.personalization}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="bg-app-surface mt-3 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
              <span className="text-[16px] text-app-text">{s.enable_personalized_recommendations}</span>
              <Switch
                checked={recommendation}
                onChange={setRecommendation}
                actionProps={bindTap({ kind: 'action', id: 'settings.privacy.personalization.recommendation.toggle' }, { params: { to: !recommendation }, stopPropagation: true, onTrigger: () => setRecommendation(!recommendation) })}
              />
          </div>
          <div className="text-[13px] text-app-text-muted leading-relaxed">
              {s.disabling_may_show_less_relevant_content}<span className="text-[#5b92e1]">{s.learn_more}</span>
          </div>
        </div>
  
        <div className="bg-app-surface mt-3 p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
              <span className="text-[16px] text-app-text">{s.enable_personalized_ads}</span>
              <Switch
                checked={ads}
                onChange={setAds}
                actionProps={bindTap({ kind: 'action', id: 'settings.privacy.personalization.ads.toggle' }, { params: { to: !ads }, stopPropagation: true, onTrigger: () => setAds(!ads) })}
              />
          </div>
          <div className="text-[13px] text-app-text-muted leading-relaxed">
              {s.ad_count_stays_the_same_but_relevance_decreases}<span className="text-[#5b92e1]">{s.learn_more}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalizationPage;
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

const ListItem = ({ 
    label, 
    isLast = false, 
    hasSwitch = false,
    checked = false,
    onSwitchChange,
    switchActionProps,
}: { 
    label: string, 
    isLast?: boolean, 
    hasSwitch?: boolean,
    checked?: boolean,
    onSwitchChange?: (val: boolean) => void,
    switchActionProps?: React.HTMLAttributes<HTMLDivElement>,
}) => (
    <div
      className={`flex items-center justify-between px-4 py-4 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
    >
        <span className="text-[16px] text-app-text">{label}</span>
        {hasSwitch && onSwitchChange && <Switch checked={checked} onChange={onSwitchChange} actionProps={switchActionProps} />}
    </div>
);

const FindMeWayPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack, bindTap } = useRedBookGestures();
  const [recommendToOthers, setRecommendToOthers] = useState(false);
  const [showInRelations, setShowInRelations] = useState(true);
  const [hideNotesNearby, setHideNotesNearby] = useState(true);
  const [hideNotesVisualSearch, setHideNotesVisualSearch] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.ways_to_find_me}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="bg-app-surface mt-3 rounded-xl overflow-hidden mx-3">
          <ListItem
              label={s.recommend_me_to_people_i_may_know} 
              hasSwitch 
              checked={recommendToOthers} 
              onSwitchChange={setRecommendToOthers} 
              switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.findMe.recommendToOthers.toggle' }, { params: { to: !recommendToOthers }, stopPropagation: true, onTrigger: () => setRecommendToOthers(!recommendToOthers) })}
          />
          <ListItem
              label={s.show_me_in_others_connections} 
              hasSwitch 
              checked={showInRelations} 
              onSwitchChange={setShowInRelations} 
              switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.findMe.showInRelations.toggle' }, { params: { to: !showInRelations }, stopPropagation: true, onTrigger: () => setShowInRelations(!showInRelations) })}
          />
          <ListItem
              label={s.hide_my_notes_from_nearby} 
              hasSwitch 
              checked={hideNotesNearby} 
              onSwitchChange={setHideNotesNearby} 
              switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.findMe.hideNotesNearby.toggle' }, { params: { to: !hideNotesNearby }, stopPropagation: true, onTrigger: () => setHideNotesNearby(!hideNotesNearby) })}
          />
          <ListItem
              label={s.hide_my_notes_from_visual_search} 
              hasSwitch 
              checked={hideNotesVisualSearch} 
              onSwitchChange={setHideNotesVisualSearch} 
              switchActionProps={bindTap({ kind: 'action', id: 'settings.privacy.findMe.hideNotesVisualSearch.toggle' }, { params: { to: !hideNotesVisualSearch }, stopPropagation: true, onTrigger: () => setHideNotesVisualSearch(!hideNotesVisualSearch) })}
              isLast
          />
        </div>
      </div>
    </div>
  );
};

export default FindMeWayPage;
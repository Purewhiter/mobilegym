import { useRedBookStrings } from '../../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack, IcNavForward } from '../../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward;
import { useRedBookGestures } from '../../hooks/useRedBookGestures';
const ListItem = ({
    label,
    actionText,
    isLast = false,
}: {
    label: string,
    actionText: string,
    isLast?: boolean,
}) => (
    <div
      className={`flex items-center justify-between px-4 py-4 active:bg-gray-50 bg-app-surface ${!isLast ? 'border-b border-gray-50' : ''}`}
    >
        <span className="text-[16px] text-app-text">{label}</span>
        <div className="flex items-center gap-1">
            <span className="text-[14px] text-app-text-muted">{actionText}</span>
            <ChevronRight size={18} className="text-[#ccc]" />
        </div>
    </div>
);

const SystemPermissionPage: React.FC = () => {
  const s = useRedBookStrings();
  const { bindBack } = useRedBookGestures();

  return (
    <div className="h-full flex flex-col bg-[#f5f5f5]">
      <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20">
        <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
             <ChevronLeft size={24} className="text-app-text" />
        </div>
        <div className="flex-1 text-center">
             <span className="text-[17px] font-medium text-app-text">{s.system_permissions}</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="px-4 py-3 text-[13px] text-app-text-muted leading-relaxed">
          {s.rednote_requests_these_permissions_for_specific}
        </div>

        <div className="bg-app-surface mx-3 rounded-xl overflow-hidden mb-4">
          <ListItem label={s.contacts} actionText={s.go_to_settings} />
          <ListItem label={s.location_2} actionText={s.go_to_settings} />
          <ListItem label={s.camera} actionText={s.go_to_settings} />
          <ListItem label={s.photos} actionText={s.go_to_settings} />
          <ListItem label={s.microphone} actionText={s.go_to_settings} />
          <ListItem label={s.clipboard} actionText={s.go_to_settings} isLast />
        </div>

        <div className="flex justify-center mt-4">
          <span className="text-[14px] text-[#5b92e1]">{s.system_permission_settings}</span>
        </div>
      </div>
    </div>
  );
};

export default SystemPermissionPage;
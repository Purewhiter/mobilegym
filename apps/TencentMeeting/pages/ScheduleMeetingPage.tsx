import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React, { useState } from 'react';
import { IcNavForward, IcInfo } from '../res/icons';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
export const ScheduleMeetingPage: React.FC = () => {
    const [selectedType, setSelectedType] = useState('regular');
    const { bindBack, bindTap } = useMeetingGestures();
    const s = useTencentMeetingStrings();
    const canProceed = selectedType === 'regular';

    const MeetingTypeCard = ({ id, title, subTitle, tag, canNavigate }: {
        id: string;
        title: string;
        subTitle?: string;
        tag?: string;
        canNavigate?: boolean;
    }) => {
        const isSelected = selectedType === id;

        // 如果是常规会议且被选中，点击直接跳转
        const handleClick = () => {
            setSelectedType(id);
        };

        return (
            <div
                className={`relative p-4 rounded-xl border ${isSelected ? 'bg-[#f0f7ff] border-blue-500' : 'bg-app-surface border-app-border'} mb-3 transition-colors min-h-[72px] ${!subTitle ? 'flex flex-col justify-center' : ''}`}
                onClick={handleClick}
                {...(canNavigate && isSelected ? bindTap('schedule.regular.open') : {})}
            >
                {isSelected && (
                    <div className="absolute -top-[1px] -right-[1px] w-5 h-5 overflow-hidden rounded-tr-xl">
                        <div className="absolute top-0 right-0 w-0 h-0 border-t-[20px] border-l-[20px] border-t-blue-500 border-l-transparent"></div>
                    </div>
                )}

                <div className={`flex items-center gap-2 ${subTitle ? 'mb-1' : ''}`}>
                    <span className={`min-w-0 text-[15px] font-medium leading-snug ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>{title}</span>
                    {tag && <span className="bg-green-100 text-green-600 text-[10px] px-1.5 py-0.5 rounded">{tag}</span>}
                </div>
                {subTitle && <div className="text-[13px] leading-snug text-gray-500">{subTitle}</div>}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-app-surface pt-10">
            {/* Header */}
            <div className="flex items-center px-2 py-2">
                <button className="p-2" {...bindBack()}>
                    <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <h1 className="text-[17px] font-medium text-gray-900">{s.schedule_select_type}</h1>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 px-4 pt-8 overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
                <MeetingTypeCard
                    id="regular"
                    title={s.schedule_type_regular}
                    canNavigate
                />

                <MeetingTypeCard
                    id="special"
                    title={s.schedule_type_special}
                    subTitle={s.schedule_type_special_desc}
                />

                <MeetingTypeCard
                    id="webinar"
                    title={s.schedule_type_webinar}
                    tag={s.schedule_type_webinar_tag}
                    subTitle={s.schedule_type_webinar_desc}
                />

                <div className="flex items-center gap-1 mt-3 px-1">
                    <IcInfo size={14} className="text-gray-500" />
                    <span className="text-gray-500 text-xs">{s.schedule_webinar_learn}</span>
                    <span className="text-blue-600 text-xs ml-1">{s.schedule_view_details}</span>
                </div>
            </div>

            {/* Submit */}
            <div className="px-4 mb-8 pt-4 border-t border-gray-50">
                <button
                    {...(canProceed ? bindTap('schedule.regular.open') : {})}
                    disabled={!canProceed}
                    className={`w-full py-3 rounded-lg font-medium text-white ${canProceed ? 'bg-blue-600 active:bg-blue-700' : 'bg-blue-300'}`}
                >
                    {s.schedule_btn_next}
                </button>
            </div>
        </div>
    );
};

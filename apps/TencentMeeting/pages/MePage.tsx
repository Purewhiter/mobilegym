import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React from 'react';
import { IcScan, IcNavForward, IcInfo, IcMoon, IcHeadset } from '../res/icons';
import { SERVICE_ITEMS } from '../constants';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
export const MePage: React.FC = () => {
    const user = useMeetingStore(s => s.user);
    const { bindTap } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    const MenuItem = ({ label, value, actionProps }: { label: string, value?: React.ReactNode, actionProps?: React.HTMLAttributes<HTMLDivElement> }) => {
        const { className: actionClassName, ...restProps } = actionProps || {};
        return (
            <div className={`flex items-center justify-between gap-3 py-4 active:bg-gray-50 px-4 ${actionClassName || ''}`} {...restProps}>
                <span className="min-w-0 flex-1 text-gray-800 text-[15px] leading-snug break-words">{label}</span>
                <div className="flex min-w-0 shrink-0 items-center gap-1 text-gray-400">
                    {value && (typeof value === 'string' ? <span className="max-w-[140px] truncate text-sm">{value}</span> : <div className="min-w-0">{value}</div>)}
                    <IcNavForward size={16} />
                </div>
            </div>
        );
    };

    const Divider = () => <div className="h-[1px] bg-gray-100 mx-4"></div>;

    const ServiceIcon = ({ icon: Icon, label }: any) => (
        <div className="flex flex-col items-center gap-2 active:opacity-60">
            <Icon size={24} className="text-gray-800" strokeWidth={1.5} />
            <span className="max-w-[72px] text-center text-xs leading-tight text-gray-600 break-words">{label}</span>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-[#f6f7f9]">
            {/* Fixed Header */}
            <div className="bg-[#f6f7f9] pt-10 shrink-0">
                <div className="flex justify-end items-center px-4 py-2 gap-5 text-gray-600">
                    <IcMoon size={22} />
                    <IcHeadset size={22} />
                    <IcScan size={22} />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar pb-6" data-scroll-container="main" data-scroll-direction="vertical">
                {/* Profile Card */}
            <div className="flex items-center gap-4 px-6 pt-2 pb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-medium">
                    {user.name.slice(0, 2)}
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
                        <div className="text-gray-500 flex items-center gap-1 text-sm">
                            {s.me_my_profile} <IcNavForward size={14} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex max-w-full items-center bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-500">
                            <div className="w-3 h-3 rounded-full bg-gray-400 text-white flex items-center justify-center text-[8px] mr-1">i</div>
                            <span className="min-w-0 truncate">{s.me_free_version}</span>
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{s.me_signature_hint}</div>
                </div>
            </div>

            {/* Privileges Card */}
            <div className="mx-4 bg-app-surface rounded-xl p-4 mb-3 shadow-sm">
                <div className="text-sm text-gray-500 mb-3">{s.me_can_host}</div>
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex items-center text-[15px] font-medium text-gray-800">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                        {s.me_meeting_2p_unlimited}
                    </div>
                    <div className="flex items-center text-[15px] font-medium text-gray-800">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
                        {s.me_meeting_3_100p_40min}
                        <IcInfo size={14} className="text-gray-400 ml-1" />
                    </div>
                </div>

                <div className="bg-gray-50 rounded px-2 py-1 mb-4 w-fit flex items-center">
                    <span className="text-xs text-gray-600">{s.me_overtime_cards} <span className="text-blue-600">0</span> {s.me_overtime_cards_unit}</span>
                        <IcNavForward size={12} className="text-gray-400 ml-1" />
                </div>

                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-800">{s.me_upgrade_pro_unlimited}</span>
                    <button className="bg-blue-600 text-white text-[13px] font-medium px-4 py-1.5 rounded-[4px]">{s.me_btn_upgrade_now}</button>
                </div>
            </div>

            {/* Trial Banner */}
            <div className="mx-4 bg-app-surface rounded-xl p-4 mb-4 shadow-sm flex items-center justify-between">
                <div>
                    <div className="text-[15px] font-bold text-[#b59b70] mb-1">{s.me_trial_title}</div>
                    <div className="text-xs text-gray-500">{s.me_trial_subtitle}</div>
                </div>
                <IcNavForward size={16} className="text-gray-400" />
            </div>

            {/* Services Grid */}
            <div className="mx-4 bg-app-surface rounded-xl p-6 grid grid-cols-3 gap-y-6 mb-4 shadow-sm">
                {SERVICE_ITEMS.map(item => (
                    <div key={item.id} {...(item.id === 'room' ? bindTap('me.personal_room.open') : {})}>
                        <ServiceIcon icon={item.icon} label={s[item.labelKey]} />
                    </div>
                ))}
            </div>

            {/* Settings List */}
            <div className="mx-4 bg-app-surface rounded-xl mb-6 shadow-sm">
                <MenuItem label={s.menu_points_center} value={
                    <div className="flex max-w-[140px] items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="min-w-0 truncate text-gray-600 text-[13px]">{s.menu_points_center_desc}</span>
                    </div>
                } />
                <Divider />
                <MenuItem label={s.menu_account_security} actionProps={bindTap('me.account_security.open')} />
                <Divider />
                <MenuItem label={s.menu_settings} actionProps={bindTap('me.settings.open')} />
                <Divider />
                <MenuItem label={s.menu_privacy} />
                <Divider />
                <MenuItem label={s.menu_help} />
                <Divider />
                <MenuItem label={s.menu_about} />
            </div>

                {/* Logout Button */}
                <div className="mx-4 mb-4">
                    <button className="w-full bg-app-surface text-red-500 font-medium py-3 rounded-xl shadow-sm active:bg-gray-50">
                        {s.menu_logout}
                    </button>
                </div>
            </div>
        </div>
    );
};

import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack, IcNavForward, IcInfo, IcBadge } from '../res/icons';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { ActionSpec } from '../../../os/hooks/useTriggerGestures';
export const AccountSecurityPage: React.FC = () => {
    const location = useLocation();
    const user = useMeetingStore(s => s.user);
    const settings = useMeetingStore(s => s.settings);
    const updateSettings = useMeetingStore(s => s.updateSettings);
    const { bindBack, bindTap } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    const searchParams = new URLSearchParams(location.search);
    const showDeleteDialog = searchParams.get('dialog') === 'delete-account';

    const maskPhone = (phone: string) => {
        if (!phone) return '';
        // Handles formats like +86 17312341995 or 17312341995
        const parts = phone.split(' ');
        const number = parts[parts.length - 1];
        if (number.length < 7) return phone;
        const masked = number.slice(0, 3) + '****' + number.slice(7);
        return parts.length > 1 ? `${parts[0]} ${masked}` : masked;
    };

    const Item = ({ label, right, isLink = false, border = true, actionProps }: any) => {
        const { className: actionClassName, ...restProps } = actionProps || {};
        return (
            <div
                {...restProps}
                className={`flex justify-between items-center py-4 px-4 bg-app-surface active:bg-gray-50 ${border ? 'border-b border-gray-100' : ''} ${actionClassName || ''}`}
            >
                <span className="text-[15px] text-gray-900">{label}</span>
                <div className="flex items-center gap-2">
                    {right && <div className="text-gray-600 text-[15px]">{right}</div>}
                    {isLink && <IcNavForward size={16} className="text-gray-400" />}
                </div>
            </div>
        );
    };

    const Toggle = ({ value, actionId, onChange }: { value: boolean; actionId: string; onChange: () => void }) => (
        <div
            className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
            {...(bindTap as any)(
                { kind: 'action', id: actionId } as ActionSpec,
                { onTrigger: onChange, stopPropagation: true }
            )}
        >
            <div className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full transition-transform shadow-sm ${value ? 'left-[22px]' : 'left-0.5'}`}></div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#f6f7f9]">
            {/* Status bar background + Header */}
            <div className="bg-[#f6f7f9] pt-10 shrink-0 sticky top-0 z-10">
                <div className="flex items-center px-2 py-3">
                    <button className="p-2" {...bindBack()}>
                        <IcNavBack size={24} className="text-gray-900" />
                    </button>
                    <div className="flex-1 text-center pr-10">
                        <h1 className="text-[17px] font-medium text-gray-900">{s.account_title}</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10" data-scroll-container="main" data-scroll-direction="vertical">
                {/* My Certification Section */}
                <div className="pl-6 pr-4 pt-2 pb-3 text-gray-500 text-[13px]">{s.account_my_cert}</div>
                <div className="mx-4 bg-app-surface rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-lg font-medium">
                        {user.name.slice(0, 2)}
                    </div>
                    <div>
                        <div className="text-[16px] font-medium text-gray-900">{user.name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <IcBadge size={12} className="text-gray-400" />
                            <span className="text-gray-400 text-[13px]">{s.account_job_identity}</span>
                            <IcInfo size={14} className="text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* Identity Visibility Toggle */}
                <div className="mx-4 bg-app-surface rounded-xl mt-4 overflow-hidden">
                    <div className="p-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[15px] font-medium text-gray-900">{s.account_show_identity}</span>
                                <span className="bg-[#eef5ff] text-app-primary text-[10px] px-1.5 py-0.5 rounded-sm font-medium">{s.account_show_identity_tag}</span>
                            </div>
                            <Toggle value={settings.showIdentity} actionId="accountSecurity.showIdentity.toggle" onChange={() => updateSettings({ showIdentity: !settings.showIdentity })} />
                        </div>
                        <div className="text-gray-400 text-[13px] leading-relaxed mb-4">
                            {s.account_show_identity_desc}
                        </div>

                        {/* Preview UI */}
                        <div className="relative bg-[#f5f7fa] rounded-lg p-4 border border-gray-100 flex items-center justify-center overflow-hidden">
                             <div className="w-full flex items-center gap-3 bg-app-surface rounded-xl p-4 shadow-sm border border-gray-50 relative z-10">
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center overflow-hidden border border-blue-100">
                                     <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Annie" alt="avatar" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[15px] text-gray-900">{s.account_preview_name}</span>
                                        <div className="bg-blue-600 text-white rounded-full p-0.5">
                                            <div className="w-2.5 h-2.5 flex items-center justify-center text-[8px]">✓</div>
                                        </div>
                                    </div>
                                    <div className="text-[12px] text-green-600 font-medium">{s.account_voice_teacher}</div>
                                </div>
                                <div className="absolute top-0 right-0 bg-gray-100 text-gray-400 text-[9px] px-2 py-0.5 rounded-bl-lg font-medium">{s.account_personal_cert_label}</div>
                             </div>

                             {/* Faded Background Element to mimic the screenshot's complex card */}
                             <div className="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
                                <div className="w-full h-full border-2 border-blue-600 rounded-full scale-150"></div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* Not Verified */}
                <div className="mx-4 bg-app-surface rounded-xl mt-4 p-4 flex justify-between items-center active:bg-gray-50">
                    <div className="flex items-center gap-2">
                        <IcBadge size={16} className="text-gray-400" />
                        <span className="text-[15px] text-gray-900">{s.account_not_verified}</span>
                    </div>
                    <div className="flex items-center text-app-primary text-[15px] font-medium">
                        {s.account_go_verify} <IcNavForward size={18} />
                    </div>
                </div>

                {/* Account IcInfo Section */}
                <div className="pl-6 pr-4 pt-6 pb-3 text-gray-500 text-[13px]">{s.account_info}</div>
                <div className="bg-app-surface mx-4 rounded-xl overflow-hidden mb-4">
                    <Item label={s.account_phone} right={maskPhone(user.phone)} isLink={true} />
                    <Item label={s.account_email} right={<span className="text-app-primary">{s.account_email_bind}</span>} isLink={true} border={true} />
                    <div className="flex justify-between items-center py-4 px-4 bg-app-surface active:bg-gray-50">
                        <span className="text-[15px] text-gray-900">{s.account_wechat}</span>
                        <div className="flex items-center gap-1 text-gray-600">
                            <span className="text-[15px]">{user.wechat}</span>
                            <IcNavForward size={16} className="text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* Security Actions */}
                <div className="bg-app-surface mx-4 rounded-xl overflow-hidden mb-4">
                    <Item label={s.account_login_password} isLink={true} />
                    <Item label={s.account_login_devices} border={false} isLink={true} />
                </div>

                {/* Deactivation */}
                <div className="bg-app-surface mx-4 rounded-xl overflow-hidden mb-8">
                    <Item label={s.account_deactivate} border={false} isLink={true} actionProps={bindTap('accountSecurity.dialog.delete.open')} />
                </div>

                {/* Bottom Logo */}
                <div className="flex flex-col items-center justify-center pb-6">
                    <div className="flex items-center gap-1.5 grayscale opacity-40">
                        <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center text-white font-black text-[12px] italic">D</div>
                        <span className="text-[13px] font-bold tracking-tight text-gray-800">{s.account_unified_identity}</span>
                    </div>
                </div>
            </div>

            {/* Delete Account Dialog */}
            {showDeleteDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center px-9 bg-black/40">
                    <div className="bg-app-surface rounded-2xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-6 pb-4">
                            <h3 className="text-center text-[18px] font-bold text-gray-900 mb-4">{s.account_deactivate_title}</h3>
                            <p className="text-[15px] text-gray-600 leading-relaxed text-center">
                                {s.account_deactivate_desc}
                            </p>
                        </div>
                        <div className="flex border-t border-gray-100">
                            <button
                                {...bindBack()}
                                className="flex-1 py-3.5 text-[17px] font-medium text-gray-400 border-r border-gray-100 active:bg-gray-50"
                            >
                                {s.btn_cancel}
                            </button>
                            <button
                                className="flex-1 py-3.5 text-[17px] font-medium text-app-primary"
                            >
                                {s.account_next_step}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

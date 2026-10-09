import React, { useState } from 'react';
import {
    IcNavBack, IcNavForward, IcCalculator,
    IcCamera, IcUser, IcQrCode
} from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, Calculator = IcCalculator, Camera = IcCamera, User = IcUser, QrCode = IcQrCode;
import { useBilibiliStore } from '../state';
import type { BilibiliUser } from '../data';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
import * as TimeService from '../../../os/TimeService';
const ListItem = ({ label, value, isAvatar = false, noBorder = false, noArrow = false, isQr = false, onClick }: any) => (
    <div
        onClick={onClick}
        className={`flex justify-between items-center py-3.5 pr-4 bg-app-surface active:bg-gray-50 ${!noBorder ? 'border-b border-gray-100' : ''}`}
    >
        <span className="text-[15px] text-app-text">{label}</span>
        <div className="flex items-center gap-2">
            {isAvatar ? (
                <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden relative border border-gray-100">
                    <img src={value} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
            ) : isQr ? (
                <QrCode size={20} className="text-gray-400" />
            ) : (
                <span className="text-[14px] text-gray-400 max-w-[200px] truncate text-right">{value}</span>
            )}
            {!noArrow && <ChevronRight size={16} className="text-gray-300 ml-1" />}
        </div>
    </div>
);

// --- Gender Modal ---
const GenderModal = ({ onClose, onSelect, current }: { onClose: () => void, onSelect: (val: any) => void, current?: string }) => {
    const s = useBilibiliStrings();
    // options 是 user.sex 的存储值（数据契约保持中文）；显示时经 GENDER_LABELS 映射
    const options = ['男', '女', '保密'];
    const GENDER_LABELS: Record<string, string> = { '男': s.gender_male, '女': s.gender_female, '保密': s.gender_secret };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="bg-app-surface rounded-t-xl z-10 overflow-hidden animate-slide-up pb-safe">
                {options.map((opt) => (
                    <div
                        key={opt}
                        onClick={() => onSelect(opt)}
                        className={`py-4 text-center text-[16px] border-b border-gray-100 active:bg-gray-50 ${current === opt ? 'text-app-primary' : 'text-app-text'}`}
                    >
                        {GENDER_LABELS[opt] ?? opt}
                    </div>
                ))}
                <div className="h-2 bg-app-bg" />
                <div
                    onClick={onClose}
                    className="py-4 text-center text-[16px] text-app-text bg-app-surface active:bg-gray-50"
                >
                    {s.common_cancel}
                </div>
            </div>
        </div>
    );
};

// --- Birthday Picker ---
const BirthdayPicker = ({ onClose, onSelect, initialDate }: { onClose: () => void, onSelect: (val: string) => void, initialDate?: string }) => {
    const s = useBilibiliStrings();
    // Simplified calendar logic
    const [year, setYear] = useState(1980);
    const [month, setMonth] = useState(1);
    const [day, setDay] = useState(1);

    // Parse initial date on mount
    React.useEffect(() => {
        if (initialDate) {
            let y, m, d;
            // Handle both formats: 'YYYY年MM月DD日' and 'YYYY-MM-DD'
            if (initialDate.includes('年')) {
                try {
                    y = parseInt(initialDate.split('年')[0]);
                    m = parseInt(initialDate.split('年')[1].split('月')[0]);
                    d = parseInt(initialDate.split('月')[1].split('日')[0]);
                } catch (e) { }
            } else if (initialDate.includes('-')) {
                try {
                    const parts = initialDate.split('-');
                    y = parseInt(parts[0]);
                    m = parseInt(parts[1]);
                    d = parseInt(parts[2]);
                } catch (e) { }
            }

            if (y && m && d && !isNaN(y) && !isNaN(m) && !isNaN(d)) {
                setYear(y);
                setMonth(m);
                setDay(d);
            }
        }
    }, [initialDate]);

    // Days in month helper
    const getDaysInMonth = (y: number, m: number) => TimeService.fromLocalParts(y, m, 0).getDate();
    const daysInMonth = getDaysInMonth(year, month);

    // Generate padding days for start of month (simplification: assume starts on Sunday for visual grid, 
    // real implementation would calculate day of week)
    // We'll calculate the day of week for the 1st of the month
    const firstDayOfWeek = TimeService.fromLocalParts(year, month - 1, 1).getDay();

    const handleDayClick = (d: number) => {
        setDay(d);
    };

    const handleConfirm = () => {
        const mStr = month.toString().padStart(2, '0');
        const dStr = day.toString().padStart(2, '0');
        onSelect(`${year}-${mStr}-${dStr}`);
        onClose();
    };

    // For weekday display on top
    const currentDate = TimeService.fromLocalParts(year, month - 1, day);
    const weekMap = [s.week_sun, s.week_mon, s.week_tue, s.week_wed, s.week_thu, s.week_fri, s.week_sat];
    const weekDayStr = s.week_prefix.replace('{w}', weekMap[currentDate.getDay()]!);

    // View Mode: 'date' or 'year'
    const [viewMode, setViewMode] = useState<'date' | 'year'>('date');

    const handleYearClick = (y: number) => {
        setYear(y);
        setViewMode('date');
    };

    // Generate year range (e.g., 1900 - Current Year)
    const currentYear = TimeService.getDate().getFullYear();
    const years = Array.from({ length: 150 }, (_, i) => currentYear - i); // 2025 down to 1876

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Transparent overlay allowing clicks to close */}
            <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

            <div className="bg-app-surface pointer-events-auto w-[85%] max-w-sm rounded-[10px] overflow-hidden shadow-2xl flex flex-col relative z-10 h-[450px]">
                {/* Header */}
                <div className="bg-app-primary p-5 text-white shrink-0">
                    <div
                        className={`flex items-center gap-1 text-[16px] cursor-pointer transition-opacity ${viewMode === 'year' ? 'opacity-100 font-medium' : 'opacity-70'}`}
                        onClick={() => setViewMode('year')}
                    >
                        {s.date_year.replace('{y}', String(year))}
                    </div>
                    <div
                        className={`text-[32px] font-medium leading-tight mt-1 cursor-pointer transition-opacity ${viewMode === 'date' ? 'opacity-100' : 'opacity-70'}`}
                        onClick={() => setViewMode('date')}
                    >
                        {s.date_mdw.replace('{m}', String(month)).replace('{d}', String(day)).replace('{w}', weekDayStr)}
                    </div>
                </div>

                {/* Body Container */}
                <div className="flex-1 overflow-hidden relative">
                    {viewMode === 'date' ? (
                        <div className="p-4 h-full overflow-y-auto">
                            {/* Month Navigator */}
                            <div className="flex justify-between items-center mb-4 px-2">
                                <ChevronLeft size={20} className="text-gray-500 cursor-pointer" onClick={() => setMonth(m => m === 1 ? 12 : m - 1)} />
                                <span className="text-[15px] font-medium">{s.date_ym.replace('{y}', String(year)).replace('{m}', String(month))}</span>
                                <ChevronRight size={20} className="text-gray-500 cursor-pointer" onClick={() => setMonth(m => m === 12 ? 1 : m + 1)} />
                            </div>

                            {/* Week Header */}
                            <div className="grid grid-cols-7 mb-2">
                                {[s.week_sun, s.week_mon, s.week_tue, s.week_wed, s.week_thu, s.week_fri, s.week_sat].map(d => (
                                    <div key={d} className="h-8 flex items-center justify-center text-[12px] text-gray-400">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-7 gap-y-1">
                                {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const d = i + 1;
                                    const isSelected = d === day;
                                    return (
                                        <div
                                            key={d}
                                            onClick={() => handleDayClick(d)}
                                            className="h-9 flex items-center justify-center relative cursor-pointer"
                                        >
                                            {isSelected && (
                                                <div className="absolute w-8 h-8 rounded-full bg-app-primary" />
                                            )}
                                            <span className={`relative z-10 text-[13px] ${isSelected ? 'text-white' : 'text-app-text'}`}>
                                                {d}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto p-4 scrollbar-hide">
                            <div className="grid grid-cols-3 gap-4">
                                {years.map((y) => (
                                    <div
                                        key={y}
                                        onClick={() => handleYearClick(y)}
                                        className={`py-3 text-center rounded-lg text-[16px] ${y === year ? 'bg-app-primary text-white font-medium shadow-md' : 'text-app-text hover:bg-gray-50'}`}
                                    >
                                        {y}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end p-4 pt-2 shrink-0 bg-app-surface border-t border-gray-50">
                    <button onClick={onClose} className="px-6 py-2 text-app-primary text-[14px] font-medium mr-2">{s.common_cancel}</button>
                    <button onClick={handleConfirm} className="px-6 py-2 text-app-primary text-[14px] font-medium">{s.common_confirm}</button>
                </div>
            </div>
        </div>
    );
};




export const ProfileEditPage: React.FC = () => {
    const { bindBack, bindTap } = useBilibiliGestures();
    const s = useBilibiliStrings();
    const GENDER_LABELS: Record<string, string> = { '男': s.gender_male, '女': s.gender_female, '保密': s.gender_secret };
    const user = useBilibiliStore(st => st.user);
    const updateUser = useBilibiliStore(st => st.updateUser);
    const [showGenderModal, setShowGenderModal] = useState(false);
    const [showBirthdayModal, setShowBirthdayModal] = useState(false);

    return (
        <div className="flex flex-col h-full bg-app-bg overflow-y-auto relative" data-scroll-container="main" data-scroll-direction="vertical">
            {/* Header */}
            <div className="flex items-center px-4 pt-10 pb-2 bg-app-surface sticky top-0 z-10">
                <button {...bindBack()} className="p-1 -ml-2 relative z-20">
                    <ChevronLeft size={24} className="text-app-text" />
                </button>
                <h1 className="flex-1 text-center font-medium text-[16px] text-app-text -ml-6">{s.pe_title}</h1>
            </div>

            {/* Section 1 */}
            <div className="mt-2 bg-app-surface pl-4">
                <ListItem label={s.pe_avatar} value={user.avatar} isAvatar />
                <ListItem
                    label={s.pe_nickname}
                    value={user.name || "xiaoming-ai"}
                    {...bindTap('profileEditName.open')}
                />
                <ListItem
                    label={s.pe_gender}
                    value={GENDER_LABELS[user.sex || '保密'] ?? (user.sex || '保密')}
                    onClick={() => setShowGenderModal(true)}
                />
                <ListItem
                    label={s.pe_birthday}
                    value={user.birthday || s.pe_birthday_hint}
                    onClick={() => setShowBirthdayModal(true)}
                />
                <ListItem
                    label={s.pe_sign}
                    value={user.sign || s.pe_sign_hint}
                    {...bindTap('profileEditSign.open')}
                />
                <ListItem
                    label={s.pe_school}
                    value={user.school || s.pe_school_hint}
                    noBorder
                />
            </div>

            {/* Section 2 */}
            <div className="mt-2 bg-app-surface pl-4">
                <ListItem label={s.pe_pendant} value="" noBorder />
            </div>

            {/* Section 3 */}
            <div className="mt-2 bg-app-surface pl-4">
                <ListItem label="UID" value={user.uid || "3690981958355889"} noArrow />
                <ListItem label={s.pe_qr} value="QR" isQr noBorder />
            </div>

            {/* Section 4 */}
            <div className="mt-2 bg-app-surface pl-4">
                <ListItem label={s.pe_auth} value="" noBorder />
            </div>

            {/* Modals */}
            {showGenderModal && (
                <GenderModal
                    onClose={() => setShowGenderModal(false)}
                    current={user.sex}
                    onSelect={(val) => {
                        updateUser({ sex: val });
                        setShowGenderModal(false);
                    }}
                />
            )}

            {showBirthdayModal && (
                <BirthdayPicker
                    onClose={() => setShowBirthdayModal(false)}
                    initialDate={user.birthday}
                    onSelect={(val) => {
                        updateUser({ birthday: val });
                    }}
                />
            )}
        </div>
    );
};

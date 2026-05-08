import React, { useState, useMemo } from 'react';
import { IcNavBack, IcNavForward, IcSearch, IcClose } from '../res/icons';
const ChevronLeft = IcNavBack, ChevronRight = IcNavForward, Search = IcSearch, X = IcClose;
import { UNIVERSITIES } from '../data/schoolData';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
export const SchoolInfoPage: React.FC = () => {
    const { bindBack, back } = useBilibiliGestures();
    const user = useBilibiliStore(s => s.user);
    const updateUser = useBilibiliStore(s => s.updateUser);

    // State
    const [schoolName, setSchoolName] = useState(user.school || '');
    const [enrollmentYear, setEnrollmentYear] = useState(user.enrollmentYear || '');

    // UI State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Filter Universities
    const filteredUniversities = useMemo(() => {
        if (!searchTerm) return [];
        return UNIVERSITIES.filter(u =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const handleSave = () => {
        if (!schoolName) return; // Validation

        // Save to context
        updateUser({
            ...user,
            school: schoolName,
            enrollmentYear: enrollmentYear
        });

        // Show success modal
        setShowSuccessModal(true);
    };

    const handleDelete = () => {
        setSchoolName('');
        setEnrollmentYear('');
        updateUser({
            ...user,
            school: undefined,
            enrollmentYear: undefined
        });
    };

    // ----- Render Functions -----

    const renderSearchOverlay = () => {
        if (!isSearchOpen) return null;

        return (
            <div className="fixed inset-0 bg-app-surface z-50 flex flex-col font-sans">
                {/* Search Header */}
                <div className="flex items-center gap-3 px-4 pb-2 pt-12 border-b border-gray-100">
                    <div className="flex-1 h-9 bg-app-bg rounded-full flex items-center px-3 gap-2">
                        <Search size={16} className="text-app-text-muted" />
                        <input
                            autoFocus
                            className="flex-1 bg-transparent border-none outline-none text-[14px] text-app-text placeholder-[#9499A0]"
                            placeholder="搜索学校"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')}>
                                <X size={16} className="text-app-text-muted bg-[#C0C4CC] rounded-full p-0.5 text-white" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setIsSearchOpen(false)}
                        className="text-[15px] text-app-text"
                    >
                        取消
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredUniversities.map(uni => (
                        <div
                            key={uni.id}
                            onClick={() => {
                                setSchoolName(uni.name);
                                setIsSearchOpen(false);
                            }}
                            className="flex items-center justify-between px-4 py-4 border-b border-gray-50 active:bg-gray-50 bg-app-surface"
                        >
                            <span className="text-[15px] text-app-text">{uni.name}</span>
                            <span className="text-[12px] text-app-text-muted">{uni.city}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearPicker = () => {
        if (!isYearPickerOpen) return null;

        const currentYear = 2026;
        const years = Array.from({ length: 50 }, (_, i) => currentYear - i);

        return (
            <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
                <div
                    className="absolute inset-0"
                    onClick={() => setIsYearPickerOpen(false)}
                />
                <div className="bg-app-surface rounded-t-xl overflow-hidden w-full relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-app-surface">
                        <button
                            className="text-app-text-muted text-[15px]"
                            onClick={() => setIsYearPickerOpen(false)}
                        >
                            取消
                        </button>
                        <span className="text-[16px] font-medium text-app-text">入学年份</span>
                        <button
                            className="text-app-primary text-[15px]"
                            onClick={() => setIsYearPickerOpen(false)}
                        >
                            确定
                        </button>
                    </div>

                    {/* Wheel (Simplified as Scroll List) */}
                    <div className="h-64 overflow-y-auto relative scroll-smooth bg-app-surface">
                        {/* Selection Highlight Bar */}
                        <div className="absolute top-1/2 left-0 right-0 h-10 -translate-y-1/2 bg-gray-50 -z-10 pointer-events-none" />

                        <div className="py-24 flex flex-col items-center gap-4">
                            {years.map(year => (
                                <div
                                    key={year}
                                    onClick={() => setEnrollmentYear(year.toString())}
                                    className={`text-[16px] transition-colors ${enrollmentYear === year.toString()
                                        ? 'text-app-text font-medium scale-110'
                                        : 'text-app-text-muted'
                                        }`}
                                >
                                    {year}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSuccessModal = () => {
        if (!showSuccessModal) return null;

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-8 font-sans">
                <div className="bg-app-surface rounded-lg w-full max-w-sm p-6 flex flex-col items-center animate-in fade-in zoom-in duration-200">
                    <button
                        className="absolute top-4 right-4 text-gray-400"
                        onClick={() => {
                            setShowSuccessModal(false);
                            back();
                        }}
                    >
                        <X size={20} />
                    </button>

                    <h3 className="text-[16px] font-medium text-center leading-normal mb-8 text-app-text px-2">
                        恭喜你成功加入{schoolName}校园
                    </h3>

                    <button
                        className="w-full py-2.5 text-app-primary text-[14px] font-medium mb-4 active:opacity-70"
                    >
                        去邀请更多校友 &gt;
                    </button>

                    <button
                        className="w-full py-2.5 text-app-text text-[14px] font-medium active:bg-gray-50 rounded"
                        onClick={() => {
                            setShowSuccessModal(false);
                            back();
                        }}
                    >
                        返回
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-app-bg font-sans">
            {/* Header */}
            <div className="bg-app-surface flex items-center justify-between px-4 pt-12 pb-3 border-b border-gray-100">
                <button {...bindBack()} className="p-1 -ml-2">
                    <ChevronLeft size={24} className="text-[#61666D]" />
                </button>
                <h1 className="text-[17px] font-medium text-app-text">学校信息</h1>
                <button
                    onClick={handleSave}
                    className={`text-[15px] font-medium ${schoolName ? 'text-app-text' : 'text-app-text-muted'}`}
                    disabled={!schoolName}
                >
                    保存
                </button>
            </div>

            {/* Form */}
            <div className="mt-2 bg-app-surface">
                <div
                    onClick={() => setIsSearchOpen(true)}
                    className="flex justify-between items-center px-4 py-4 border-b border-gray-50 active:bg-gray-50 transition-colors"
                >
                    <div className="text-[15px] text-app-text">
                        学校<span className="text-app-primary ml-0.5">*</span>
                    </div>
                    <div className="flex items-center gap-1 text-app-text-muted">
                        <span className="text-[15px]">{schoolName || '选择学校'}</span>
                        <ChevronRight size={16} className="text-[#C0C4CC]" />
                    </div>
                </div>

                <div
                    onClick={() => setIsYearPickerOpen(true)}
                    className="flex justify-between items-center px-4 py-4 active:bg-gray-50 transition-colors"
                >
                    <div className="text-[15px] text-app-text">入学年份</div>
                    <div className="flex items-center gap-1 text-app-text-muted">
                        <span className="text-[15px]">{enrollmentYear || '选填'}</span>
                        <ChevronRight size={16} className="text-[#C0C4CC]" />
                    </div>
                </div>
            </div>

            <div className="px-4 mt-2 text-[12px] text-app-text-muted">
                每30天内仅可修改一次
            </div>

            {/* Delete Button (Only if school is set) */}
            {schoolName && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleDelete}
                        className="text-app-primary text-[14px]"
                    >
                        删除学校信息
                    </button>
                </div>
            )}

            {/* Overlays */}
            {renderSearchOverlay()}
            {renderYearPicker()}
            {renderSuccessModal()}
        </div>
    );
};

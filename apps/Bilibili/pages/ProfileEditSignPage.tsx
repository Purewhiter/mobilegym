import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
const ChevronLeft = IcNavBack;
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
export const ProfileEditSignPage: React.FC = () => {
    const { bindBack, back } = useBilibiliGestures();
    const user = useBilibiliStore(s => s.user);
    const updateUser = useBilibiliStore(s => s.updateUser);
    const [sign, setSign] = useState(user.sign || '');
    const MAX_LENGTH = 70;

    const handleSave = () => {
        updateUser({ sign: sign.trim() });
        back();
    };

    return (
        <div className="flex flex-col h-full bg-app-bg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-10 pb-2 bg-app-surface sticky top-0 z-10">
                <button {...bindBack()} className="p-1 -ml-2 relative z-20">
                    <ChevronLeft size={24} className="text-app-text" />
                </button>
                <h1 className="text-[16px] font-medium text-app-text">修改个性签名</h1>
                <button
                    onClick={handleSave}
                    className={`text-[14px] font-medium ${sign.trim() === user.sign ? 'text-gray-400' : 'text-app-primary'}`}
                    disabled={sign.trim() === user.sign}
                >
                    保存
                </button>
            </div>

            <div className="flex-1 p-4 bg-app-bg">
                <div className="bg-transparent relative h-full">
                    <textarea
                        value={sign}
                        onChange={(e) => {
                            if (e.target.value.length <= MAX_LENGTH) {
                                setSign(e.target.value);
                            }
                        }}
                        className="w-full h-40 bg-transparent text-[15px] focus:outline-none resize-none placeholder-gray-400"
                        placeholder="请输入新个性签名"
                        autoFocus
                    />
                    <div className="absolute right-0 top-32 text-[12px] text-gray-400">
                        {MAX_LENGTH - sign.length}
                    </div>

                    <div className="w-full h-[1px] bg-app-primary mt-2"></div>
                </div>
            </div>
        </div>
    );
};

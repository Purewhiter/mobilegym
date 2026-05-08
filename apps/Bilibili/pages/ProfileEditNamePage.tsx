import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
const ChevronLeft = IcNavBack;
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
export const ProfileEditNamePage: React.FC = () => {
    const { bindBack, back } = useBilibiliGestures();
    const user = useBilibiliStore(s => s.user);
    const updateUser = useBilibiliStore(s => s.updateUser);
    const [name, setName] = useState(user.name);

    const handleSave = () => {
        if (name.trim()) {
            updateUser({ name: name.trim() });
            back();
        }
    };

    return (
        <div className="flex flex-col h-full bg-app-bg">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-10 pb-2 bg-app-surface sticky top-0 z-10">
                <button {...bindBack()} className="p-1 -ml-2 relative z-20">
                    <ChevronLeft size={24} className="text-app-text" />
                </button>
                <h1 className="text-[16px] font-medium text-app-text">修改昵称</h1>
                <button
                    onClick={handleSave}
                    className={`text-[14px] font-medium ${name.trim() === user.name || !name.trim() ? 'text-gray-400' : 'text-app-primary'}`}
                    disabled={name.trim() === user.name || !name.trim()}
                >
                    保存
                </button>
            </div>

            <div className="p-4">
                <div className="relative">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-app-primary py-2 text-[15px] focus:outline-none placeholder-gray-400"
                        placeholder="请输入新昵称"
                        autoFocus
                    />
                    {name && (
                        <button
                            onClick={() => setName('')}
                            className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-300 p-2"
                        >
                            x
                        </button>
                    )}
                </div>

                <div className="flex justify-between mt-3 text-[12px] text-gray-400">
                    <span>修改昵称需要消耗6枚硬币</span>
                    <span>如何获取硬币？</span>
                </div>
            </div>
        </div>
    );
};

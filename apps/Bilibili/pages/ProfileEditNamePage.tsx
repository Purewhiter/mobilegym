import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
const ChevronLeft = IcNavBack;
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../hooks/useBilibiliStrings';
export const ProfileEditNamePage: React.FC = () => {
    const { bindBack, back } = useBilibiliGestures();
    const s = useBilibiliStrings();
    const user = useBilibiliStore(st => st.user);
    const updateUser = useBilibiliStore(st => st.updateUser);
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
                <h1 className="text-[16px] font-medium text-app-text">{s.pe_name_title}</h1>
                <button
                    onClick={handleSave}
                    className={`text-[14px] font-medium ${name.trim() === user.name || !name.trim() ? 'text-gray-400' : 'text-app-primary'}`}
                    disabled={name.trim() === user.name || !name.trim()}
                >
                    {s.common_save}
                </button>
            </div>

            <div className="p-4">
                <div className="relative">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-transparent border-b-2 border-app-primary py-2 text-[15px] focus:outline-none placeholder-gray-400"
                        placeholder={s.pe_name_placeholder}
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
                    <span>{s.pe_name_cost}</span>
                    <span>{s.coin_how}</span>
                </div>
            </div>
        </div>
    );
};

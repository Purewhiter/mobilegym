import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React, { useState } from 'react';
import { useMeetingGestures } from '../hooks/useMeetingGestures';

export const ShareScreenPage: React.FC = () => {
    const [code, setCode] = useState('');
    const { bindBack } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#eef4ff] to-white pt-10">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3">
                <button className="text-gray-900 text-[16px]" {...bindBack()}>{s.btn_cancel}</button>
            </div>

            <div className="flex-1 flex flex-col items-center pt-16 px-6">
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">{s.share_title}</h1>
                <p className="text-gray-500 text-sm mb-12">{s.share_subtitle}</p>

                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full h-12 bg-app-surface rounded-lg border-none outline-none px-4 text-center text-lg shadow-sm mb-8"
                    placeholder=""
                />

                <button className="w-full py-3 rounded-lg font-medium text-white bg-blue-600 active:bg-blue-700 shadow-sm shadow-blue-200">
                    {s.share_btn_start}
                </button>
            </div>

            <div className="mb-10 text-center">
                <span className="text-blue-600 text-sm">{s.share_help}</span>
            </div>

            {/* Bottom spacer or safe area hint */}
            <div className="h-1 w-32 bg-gray-300 rounded-full mx-auto mb-2 opacity-0"></div>
        </div>
    );
};

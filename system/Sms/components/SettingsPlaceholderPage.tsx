import React from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';

export const SettingsPlaceholderPage: React.FC = () => {
    const { bindBack } = useSmsGestures();
    const location = useLocation();
    const s = useAppStrings(strings, stringsEn);

    return (
        <div className="h-full flex flex-col overflow-y-auto no-scrollbar" style={{ backgroundColor: 'var(--app-c-page-background)' }}>
            <div className="h-12 flex-shrink-0" />
            <div className="flex items-center px-4 h-12 flex-shrink-0">
                <button
                    className="w-10 h-10 -ml-2 flex items-center justify-center"
                    {...bindBack()}
                >
                    <IcNavBack size={24} className="text-app-text" />
                </button>
            </div>
            <div className="px-6 pt-2 pb-4 flex-shrink-0">
                <h1 className="text-[28px] font-bold text-app-text leading-tight">{s.settings_title}</h1>
            </div>
            <div className="mx-4 bg-app-surface rounded-2xl px-5 py-4 text-gray-600 text-[14px] leading-relaxed">
                <div className="text-app-text text-[16px] font-medium mb-1">{s.placeholder_not_implemented}</div>
                <div>{location.pathname}</div>
            </div>
            <div className="h-8 flex-shrink-0" />
        </div>
    );
};

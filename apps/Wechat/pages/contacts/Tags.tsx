
import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const TagsPage = () => {
    const t = useWechatStrings();

    return (
        <div className="min-h-full bg-app-bg flex flex-col items-center justify-center px-10">
            <div className="text-center -mt-20">
                <p className="text-(--app-c-common-text-hint) text-(--app-search-filter-text-size) mb-4 leading-relaxed break-words [overflow-wrap:anywhere]">
                    {t.tags_hint}
                </p>
                <div className="flex items-center justify-center text-(--app-c-address-link-text) text-(--app-settings-item-text-size) font-medium active:opacity-60 cursor-pointer">
                    <span className="text-(--app-me-username-size) mr-1 mt-[-2px]">+</span>
                    <span>{t.tags_create}</span>
                </div>
            </div>
        </div>
    );
};

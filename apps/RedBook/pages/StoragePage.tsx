import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { IcNavBack } from '../res/icons';
const ChevronLeft = IcNavBack;
import { useScrollPosition } from '../hooks/useScrollPosition';
import { useRedBookStore } from '../state';
import { useRedBookGestures } from '../hooks/useRedBookGestures';

function formatStorageSize(bytes: number): string {
    if (bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const StoragePage: React.FC = () => {
    const s = useRedBookStrings();
    const { bindBack, bindTap } = useRedBookGestures();
    const scrollRef = useScrollPosition('storage_settings');
    const { storage, clearCache } = useRedBookStore();

    const cacheSizeBytes = storage?.cacheSizeBytes ?? 0;
    const cacheSizeLabel = formatStorageSize(cacheSizeBytes);

    const ListItem = ({
        label,
        subLabel,
        size,
        buttonText,
        onClick,
        isLast = false
    }: {
        label: string,
        subLabel: string,
        size: string,
        buttonText: string,
        onClick?: () => void,
        isLast?: boolean
    }) => (
        <div className={`flex items-center justify-between py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}>
            <div className="flex flex-col gap-1 flex-1 pr-4">
                <span className="text-[16px] text-app-text font-medium">{label}</span>
                <span className="text-[20px] font-bold text-app-text mt-1 mb-1">{size}</span>
                <span className="text-[12px] text-app-text-muted leading-tight">{subLabel}</span>
            </div>
            <button
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium border ${buttonText === s.clean ? 'bg-app-primary text-white border-app-primary' : 'bg-white text-app-text-muted border-gray-300'}`}
                onClick={onClick}
                {...(buttonText === s.clean ? bindTap({ kind: 'action', id: 'settings.storage.clear' }, { onTrigger: () => clearCache() }) : {})}
            >
                {buttonText}
            </button>
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-app-surface">
            {/* Header */}
            <div className="pt-10 px-4 pb-3 flex items-center bg-app-surface sticky top-0 z-20 border-b border-gray-100">
                <div className="active:opacity-60 absolute left-4 p-1" {...bindBack()}>
                    <ChevronLeft size={24} className="text-app-text" />
                </div>
                <div className="flex-1 text-center">
                    <span className="text-[17px] font-medium text-app-text">{s.storage}</span>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 pt-4 pb-20"
                data-scroll-container="main"
                data-scroll-direction="vertical"
            >
                {/* Usage Bar */}
                <div className="mb-8">
                    <div className="h-2 w-full bg-[#f5f5f5] rounded-full overflow-hidden flex mb-3">
                        <div className="h-full bg-app-primary w-[1%]" />
                        <div className="h-full bg-[#ffb400] w-[20%]" />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-app-text-muted mb-6">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-app-primary" />
                            <span>{s.rednote_used_space}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#ffb400]" />
                            <span>{s.phone_used_space}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#f5f5f5]" />
                            <span>{s.phone_free_space}</span>
                        </div>
                    </div>

                    <div className="mb-1">
                        <span className="text-[13px] text-app-text-muted block mb-1">{s.rednote_used_space}</span>
                        <span className="text-[32px] font-bold text-app-text">2.54 GB</span>
                    </div>
                    <span className="text-[12px] text-app-text-muted">{s.takes_up_1_percent_of_phone_storage}</span>
                </div>

                {/* List Items */}
                <div>
                    <ListItem
                        label={s.cache}
                        size={cacheSizeLabel}
                        subLabel={s.cache_description}
                        buttonText={s.clean}
                    />
                    <ListItem
                        label={s.my_downloads}
                        size="0 B"
                        subLabel={s.downloads_description}
                        buttonText={s.manage}
                    />
                    <ListItem
                        label={s.drafts}
                        size="0 B"
                        subLabel={s.drafts_description}
                        buttonText={s.manage}
                    />
                    <ListItem
                        label={s.chat_files}
                        size="0 B"
                        subLabel={s.chat_files_description}
                        buttonText={s.manage}
                        isLast
                    />
                </div>
            </div>
        </div>
    );
};

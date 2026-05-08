
import React, { useState } from 'react';
import { dimens } from '../../../res/dimens';
import { IcLocation, IcNavForward, IcCheck } from '../../../res/icons';
import { useWechatStore } from '../../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../../hooks/useWechatGestures';
export const RegionPage = () => {
    const { user, updateUser } = useWechatStore(useShallow(s => ({
        user: s.user,
        updateUser: s.updateUser,
    })));
    const { back, bindTap } = useWechatGestures();
    const [selected, setSelected] = useState(user.region);

    // This is the mocked system GPS location
    const deviceLocation = user.currentLocation || "中国大陆 北京";
    
    const regions = [
        { label: '中国香港', actionId: 'profile.region.select.hongKong' },
        { label: '中国澳门', actionId: 'profile.region.select.macao' },
        { label: '中国台湾', actionId: 'profile.region.select.taiwan' },
        { label: '阿尔巴尼亚', actionId: 'profile.region.select.albania' },
        { label: '阿尔及利亚', actionId: 'profile.region.select.algeria' },
        { label: '阿富汗', actionId: 'profile.region.select.afghanistan' },
        { label: '阿根廷', actionId: 'profile.region.select.argentina' },
        { label: '阿联酋', actionId: 'profile.region.select.uae' },
        { label: '阿鲁巴', actionId: 'profile.region.select.aruba' },
        { label: '阿曼', actionId: 'profile.region.select.oman' },
    ] as const;

    const handleSelect = (region: string) => {
        // Update user profile region setting
        updateUser({ region });
        // Update local state for immediate visual feedback before navigation
        setSelected(region);
        // Automatically return to previous page
        back();
    };

    // 规范：避免动态拼接/变量传入 actionId，确保静态工具可完全发现入口。
    const regionActionPropsOf = (actionId: string, label: string) => {
        switch (actionId) {
            case 'profile.region.select.hongKong':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.hongKong' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.macao':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.macao' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.taiwan':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.taiwan' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.albania':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.albania' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.algeria':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.algeria' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.afghanistan':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.afghanistan' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.argentina':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.argentina' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.uae':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.uae' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.aruba':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.aruba' }, { onTrigger: () => handleSelect(label) });
            case 'profile.region.select.oman':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.oman' }, { onTrigger: () => handleSelect(label) });
            default:
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'profile.region.select.mainland' }, { onTrigger: () => handleSelect(label) });
        }
    };

    return (
        <div className="min-h-full bg-app-bg">
            {/* Current Position (System GPS Location) */}
            <div className="px-4 py-2 text-(--app-c-tw-text-gray-500) text-xs mt-2">当前位置</div>
            <div 
                className="bg-app-surface px-4 py-3 flex items-center mb-2 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
                {...bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'profile.region.select.currentLocation' },
                    { onTrigger: () => handleSelect(deviceLocation) },
                )}
            >
                <IcLocation size={dimens.icSizeAction} className="text-app-primary mr-2" />
                <span className="text-app-text text-(--app-chat-bubble-text-size) font-medium">{deviceLocation}</span>
            </div>
            
            {/* All Regions List */}
            <div className="px-4 py-2 text-(--app-c-tw-text-gray-500) text-xs">全部地区</div>
            <div className="bg-app-surface">
                <div 
                    className="flex justify-between items-center px-4 py-3 border-b border-(--app-c-tw-border-gray-100) active:bg-(--app-c-tw-bg-gray-50) cursor-pointer" 
                    {...bindTap<HTMLDivElement>(
                        { kind: 'action', id: 'profile.region.select.mainland' },
                        { onTrigger: () => handleSelect('中国大陆') },
                    )}
                >
                    <span className="text-(--app-chat-bubble-text-size)">中国大陆</span>
                    <div className="flex items-center text-(--app-c-tw-text-gray-400) text-sm">
                        {selected.includes('中国大陆') && <span className="mr-2 text-app-primary">已选</span>}
                        <IcNavForward size={dimens.icSizeChevronSm} />
                    </div>
                </div>
                {regions.map((item) => (
                     <div 
                        key={item.actionId} 
                        {...regionActionPropsOf(item.actionId, item.label)}
                        className="flex justify-between items-center px-4 py-3 border-b border-(--app-c-tw-border-gray-100) active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
                    >
                        <span className="text-(--app-chat-bubble-text-size)">{item.label}</span>
                        {selected === item.label && <IcCheck size={dimens.icSizeChevronSm} className="text-app-primary" />}
                    </div>
                ))}
            </div>
        </div>
    );
};

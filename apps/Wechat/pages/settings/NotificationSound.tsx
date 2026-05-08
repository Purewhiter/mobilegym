import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dimens } from '../../res/dimens';
import { IcCheck } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStrings } from '../../hooks/useWechatStrings';
type SoundId = 'followSystem' | 'blocks' | 'cute' | 'ethereal' | 'playful' | 'crisp' | 'lively' | 'elegant';

export const NotificationSoundPage: React.FC = () => {
    const t = useWechatStrings();
    const { user, settings, updateSettings, setRightAction } = useWechatStore(useShallow(s => ({
        user: s.user,
        settings: s.settings,
        updateSettings: s.updateSettings,
        setRightAction: s.setRightAction,
    })));
    const { back, bindTap } = useWechatGestures();
    const { notifications } = settings;
    
    const soundOptions: { id: SoundId; labelKey: keyof typeof t }[] = useMemo(() => [
        { id: 'followSystem', labelKey: 'sound_follow_system' },
        { id: 'blocks', labelKey: 'sound_blocks' },
        { id: 'cute', labelKey: 'sound_cute' },
        { id: 'ethereal', labelKey: 'sound_ethereal' },
        { id: 'playful', labelKey: 'sound_playful' },
        { id: 'crisp', labelKey: 'sound_crisp' },
        { id: 'lively', labelKey: 'sound_lively' },
        { id: 'elegant', labelKey: 'sound_elegant' },
    ], []);
    
    const { idToLabel, labelToId } = useMemo(() => {
        const idToLabel: Record<SoundId, string> = {} as Record<SoundId, string>;
        const labelToId: Record<string, SoundId> = {};
        for (const opt of soundOptions) {
            const label = String(t[opt.labelKey]);
            idToLabel[opt.id] = label;
            labelToId[label] = opt.id;
        }
        return { idToLabel, labelToId };
    }, [soundOptions, t]);

    // Initial sound from settings:
    // - New storage: Chinese label (e.g. '灵动')
    // - Backward compat: internal id (e.g. 'lively')
    const initialSelectedId: SoundId = useMemo(() => {
        const raw = notifications.notificationSound;
        if (!raw) return 'followSystem';
        if (soundOptions.some(o => o.id === (raw as SoundId))) return raw as SoundId;
        return labelToId[raw] ?? 'followSystem';
    }, [notifications.notificationSound, soundOptions, labelToId]);

    const [selected, setSelected] = useState<SoundId>(initialSelectedId);
    
    // Ref to track selection for the callback
    const selectedRef = useRef(selected);
    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    useEffect(() => {
        // Only provide a "Done" callback if the sound has changed
        if (selected !== initialSelectedId) {
            setRightAction({
                id: 'settings.notifications.sound.submit',
                onTrigger: () => {
                    updateSettings({
                        ...settings,
                        notifications: {
                            ...notifications,
                            notificationSound: idToLabel[selectedRef.current],
                        },
                    });
                    back();
                },
            });
        } else {
            // Remove the callback if user switches back to the original sound
            setRightAction(null);
        }
        
        return () => setRightAction(null);
    }, [selected, initialSelectedId, updateSettings, setRightAction, notifications, settings, back, idToLabel]);

    // 规范：避免动态拼接/变量传入 actionId，确保静态工具可完全发现入口。
    const soundActionPropsOf = (soundId: SoundId) => {
        switch (soundId) {
            case 'followSystem':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.followSystem' }, { onTrigger: () => setSelected('followSystem') });
            case 'blocks':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.jimu' }, { onTrigger: () => setSelected('blocks') });
            case 'cute':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.keai' }, { onTrigger: () => setSelected('cute') });
            case 'ethereal':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.kongling' }, { onTrigger: () => setSelected('ethereal') });
            case 'playful':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.qiaopi' }, { onTrigger: () => setSelected('playful') });
            case 'crisp':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.qingcui' }, { onTrigger: () => setSelected('crisp') });
            case 'lively':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.lingdong' }, { onTrigger: () => setSelected('lively') });
            case 'elegant':
            default:
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.notifications.sound.select.youya' }, { onTrigger: () => setSelected('elegant') });
        }
    };

    return (
        <div className="bg-app-bg min-h-full">
            <div className="h-0.5 bg-app-bg"></div>
            <div className="bg-app-surface">
                {soundOptions.map((option, idx) => (
                    <div 
                        key={option.id}
                        {...soundActionPropsOf(option.id)}
                        className="bg-app-surface pl-5 active:bg-(--app-c-tw-bg-gray-100) cursor-pointer"
                    >
                        <div className={`flex justify-between items-center py-4 pr-5 ${idx !== soundOptions.length - 1 ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`}>
                            <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal">{t[option.labelKey]}</span>
                            {selected === option.id && <IcCheck size={dimens.icSizeCheck} className="text-app-primary" strokeWidth={2.5} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
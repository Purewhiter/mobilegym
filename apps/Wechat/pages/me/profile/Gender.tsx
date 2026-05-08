import React, { useState, useEffect, useRef } from 'react';
import { dimens } from '../../../res/dimens';
import { useWechatStrings } from '../../../hooks/useWechatStrings';
import { IcCheck } from '../../../res/icons';
import { useWechatStore } from '../../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../../hooks/useWechatGestures';

export const SetGenderPage = () => {
    const t = useWechatStrings();
    const { user, updateUser, setRightAction } = useWechatStore(useShallow(s => ({
        user: s.user,
        updateUser: s.updateUser,
        setRightAction: s.setRightAction,
    })));
    const { back, bindTap } = useWechatGestures();
    const [gender, setGender] = useState<'男' | '女' | ''>(user.gender);
    const genderRef = useRef(gender);

    useEffect(() => {
        genderRef.current = gender;
    }, [gender]);

    useEffect(() => {
        setRightAction({
            id: 'profile.gender.submit',
            onTrigger: () => {
            updateUser({ gender: genderRef.current });
            back();
            },
        });
        return () => setRightAction(null);
    }, [updateUser, setRightAction, back]);

    return (
        <div className="min-h-full bg-app-bg">
            <div className="bg-app-surface mt-0">
                <div 
                    {...bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'profile.gender.select.male' },
                      { onTrigger: () => setGender('男') },
                    )}
                    className="flex justify-between items-center px-4 py-4 border-b border-(--app-c-tw-border-gray-100) active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
                >
                    <span className="text-(--app-chat-bubble-text-size) text-app-text">{t.common_male}</span>
                    {gender === t.common_male && <IcCheck size={dimens.icSizeAction} className="text-app-primary" />}
                </div>
                <div 
                    {...bindTap<HTMLDivElement>(
                      { kind: 'action', id: 'profile.gender.select.female' },
                      { onTrigger: () => setGender('女') },
                    )}
                    className="flex justify-between items-center px-4 py-4 active:bg-(--app-c-tw-bg-gray-50) cursor-pointer"
                >
                    <span className="text-(--app-chat-bubble-text-size) text-app-text">{t.common_female}</span>
                    {gender === t.common_female && <IcCheck size={dimens.icSizeAction} className="text-app-primary" />}
                </div>
            </div>
        </div>
    );
};
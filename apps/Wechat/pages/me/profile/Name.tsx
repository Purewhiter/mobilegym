import React, { useState, useEffect, useRef } from 'react';
import { useWechatStore } from '../../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../../hooks/useWechatGestures';

export const ChangeNamePage = () => {
    const { user, updateUser, setRightAction } = useWechatStore(useShallow(s => ({
        user: s.user,
        updateUser: s.updateUser,
        setRightAction: s.setRightAction,
    })));
    const { back } = useWechatGestures();
    const [name, setName] = useState(user.name);
    
    // Critical Fix: Use ref to hold current value.
    const nameRef = useRef(name);

    useEffect(() => {
        nameRef.current = name;
    }, [name]);

    useEffect(() => {
        // Register the Save action only once
        setRightAction({
            id: 'profile.name.submit',
            onTrigger: () => {
            updateUser({ name: nameRef.current });
            back();
            },
        });
        // Cleanup on unmount
        return () => setRightAction(null);
    }, [updateUser, setRightAction, back]);

    return (
        <div className="min-h-full bg-app-bg p-4">
            <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-b border-app-primary py-2 text-lg focus:outline-none" 
                autoFocus
            />
            <p className="text-(--app-c-common-text-hint) text-sm mt-2">好名字可以让你的朋友更容易记住你。</p>
        </div>
    );
};
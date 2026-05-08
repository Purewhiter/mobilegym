import React, { useState, useEffect, useRef } from 'react';
import { useWechatStore } from '../../../state';
import { useShallow } from 'zustand/react/shallow';
import { useWechatGestures } from '../../../hooks/useWechatGestures';

export const SignaturePage = () => {
    const { user, updateUser, setRightAction } = useWechatStore(useShallow(s => ({
        user: s.user,
        updateUser: s.updateUser,
        setRightAction: s.setRightAction,
    })));
    const { back } = useWechatGestures();
    const [signature, setSignature] = useState(user.signature);
    const signatureRef = useRef(signature);

    useEffect(() => {
        signatureRef.current = signature;
    }, [signature]);

    useEffect(() => {
        setRightAction({
            id: 'profile.signature.submit',
            onTrigger: () => {
            updateUser({ signature: signatureRef.current });
            back();
            },
        });
        return () => setRightAction(null);
    }, [updateUser, setRightAction, back]);

    return (
        <div className="min-h-full bg-app-bg p-4">
            <input 
                type="text" 
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="填写个性签名"
                className="w-full bg-transparent border-b border-app-primary py-2 text-lg focus:outline-none" 
                autoFocus
            />
            <div className="text-right text-(--app-c-settings-item-chevron) text-sm mt-2">{30 - signature.length}</div>
        </div>
    );
};

import React from 'react';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const BlacklistPage: React.FC = () => {
    const contacts = useWechatStore(s => s.contacts);
    const { bindTap } = useWechatGestures();

    const blacklistedContacts = contacts.filter(c => c.isBlacklisted);

    if (blacklistedContacts.length === 0) {
        return (
            <div className="bg-app-surface min-h-full flex flex-col items-center justify-center -mt-20">
                <div className="text-(--app-c-tw-text-gray-400) text-(--app-chat-bubble-text-size)"></div>
            </div>
        );
    }

    return (
        <div className="bg-app-surface min-h-full">
            {blacklistedContacts.map((contact) => (
                <div 
                    key={contact.wxid} 
                    {...bindTap<HTMLDivElement>('userProfile.open', { params: { id: contact.wxid } })}
                    className="flex items-center px-4 py-3 active:bg-(--app-c-tw-bg-gray-100) border-b border-(--app-c-tw-border-gray-100)"
                >
                    <img 
                        src={contact.avatar} 
                        className="w-(--app-settings-blacklist-width-40) h-(--app-card-height-40) rounded-[4px] object-cover bg-(--app-c-tw-bg-gray-50) mr-3" 
                        alt="" 
                    />
                    <span className="text-(--app-settings-item-text-size) text-app-text">{contact.name}</span>
                </div>
            ))}
        </div>
    );
};

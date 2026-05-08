import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React from 'react';
import { IcSearch, IcUserAdd } from '../res/icons';
import { EmptyContactsIllustration } from '../components/EmptyContactsIllustration';
import { useMeetingStore } from '../state';
export const ContactsPage: React.FC = () => {
    const contacts = useMeetingStore(s => s.contacts);
    const s = useTencentMeetingStrings();

    return (
        <div className="flex flex-col h-full bg-app-surface pt-10" data-scroll-container="main" data-scroll-direction="vertical">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3">
                <div className="w-6"></div> {/* Spacer for centering if needed, simplified here */}
                <h1 className="text-lg font-medium text-gray-900">{s.contacts_title}</h1>
                <IcUserAdd size={24} className="text-gray-600" />
            </div>

            {/* IcSearch */}
            <div className="px-4 py-2">
                <div className="bg-gray-100 h-9 rounded-lg flex min-w-0 items-center px-3 gap-2 text-gray-400">
                    <IcSearch size={16} className="shrink-0" />
                    <span className="min-w-0 truncate text-sm">{s.contacts_search}</span>
                </div>
            </div>

            {/* Content */}
            {contacts && contacts.length > 0 ? (
                <div className="flex-1 overflow-y-auto pb-20">
                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">{s.contacts_my_friends} ({contacts.length})</div>
                    {contacts.map((user) => (
                        <div key={user.id} className="flex items-center px-4 py-3 border-b border-gray-100 active:bg-gray-50">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm mr-3">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    user.name.slice(-2)
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="text-base font-medium text-gray-900">{user.name}</div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center pb-20">
                    {/* Illustration */}
                    <div className="mb-6">
                        <EmptyContactsIllustration className="w-48 h-40" />
                    </div>
                    <p className="text-gray-500 text-sm px-10 text-center leading-relaxed">
                        {s.contacts_empty_hint}
                    </p>
                    <button className="mt-6 px-8 py-2 border border-gray-300 rounded text-gray-600 text-sm font-medium active:bg-gray-50">
                        {s.contacts_invite}
                    </button>
                </div>
            )}
        </div>
    );
};

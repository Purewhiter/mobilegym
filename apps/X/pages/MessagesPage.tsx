import React from 'react';
import { useLocation } from 'react-router-dom';
import { IcAdd, IcSettings } from '../res/icons';
import { useXStore, selectUser } from '../state';
import { useXConversations } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';

export const MessagesPage: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const conversations = useXConversations();
  const user = useXStore(selectUser);
  const location = useLocation();
  const { bindTap } = useXGestures(isActive);
  const s = useXStrings();

  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get('tab');
  const activeTab: 'all' | 'unread' | 'groups' | 'requests' =
    tab === 'all' || tab === 'unread' || tab === 'groups' || tab === 'requests' ? tab : 'all';

  const filteredConversations = conversations.filter(conversation => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return conversation.unreadCount > 0;
    if (activeTab === 'groups') return conversation.isGroup;
    if (activeTab === 'requests') return false;
    return true;
  });

  const renderContent = () => {
    if (activeTab === 'requests') {
      return (
        <div className="flex flex-col h-full bg-app-bg px-4 pt-8">
          <h2 className="text-3xl font-bold mb-2">{s.messages_requests_empty_title}</h2>
          <p className="text-gray-500">{s.messages_requests_empty_desc}</p>
        </div>
      );
    }

    if (activeTab === 'groups') {
      return (
        <div className="flex flex-col h-full bg-app-bg px-4 pt-8">
          <h2 className="text-3xl font-bold mb-2">{s.messages_groups_empty_title}</h2>
          <p className="text-gray-500">{s.messages_groups_empty_desc}</p>
        </div>
      );
    }

    if (activeTab === 'unread' && filteredConversations.length === 0) {
      return (
        <div className="flex flex-col h-full bg-app-bg px-4 pt-8">
          <h2 className="text-3xl font-bold mb-2">{s.messages_unread_empty_title}</h2>
          <p className="text-gray-500">{s.messages_unread_empty_desc}</p>
        </div>
      );
    }

    if (filteredConversations.length === 0) {
      return (
        <div className="flex flex-col items-start justify-start p-8 mt-10">
          <div className="text-2xl font-bold mb-2">{s.messages_all_empty_title}</div>
          <div className="text-gray-500">{s.messages_all_empty_desc}</div>
        </div>
      );
    }

    return (
      <div className="flex-col">
        {filteredConversations.map((conversation: any) => (
          <div
            key={conversation.id}
            className="flex px-4 py-3 border-b border-app-border active:bg-gray-50 cursor-pointer"
            {...bindTap('messages.conversation.open', { params: { id: conversation.id } })}
          >
            <div className="w-12 h-12 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0">
              {conversation.participant.avatar && <img src={conversation.participant.avatar} alt={conversation.participant.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <div className="flex items-center gap-1 overflow-hidden">
                  <span className="font-bold truncate">{conversation.participant.name}</span>
                  {conversation.participant.verified && <span className="text-blue-400 shrink-0">✓</span>}
                  <span className="text-gray-500 text-sm truncate">{`@${conversation.participant.id}`}</span>
                </div>
                <span className="text-gray-500 text-sm shrink-0 ml-2">{conversation.lastMessage.time}</span>
              </div>
              <div className={`text-sm truncate pr-2 ${conversation.unreadCount > 0 ? 'font-bold text-app-text' : 'text-gray-400'}`}>
                {conversation.lastMessage.isMe ? s.messages_last_message_me_prefix : ''}
                {conversation.lastMessage.content}
              </div>
            </div>
            {conversation.unreadCount > 0 && <div className="w-2 h-2 bg-blue-500 rounded-full self-center ml-2" />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col pt-10 bg-app-bg min-h-full text-app-text">
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden cursor-pointer" {...bindTap('messages.drawer.open')}>
          {user.avatar && isActive ? (
            <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
              {user.name[0]}
            </div>
          )}
        </div>
        <div className="font-bold text-lg">{activeTab === 'groups' ? s.messages_title_connecting : s.messages_title_chat}</div>
        <IcSettings className="w-6 h-6" />
      </div>

      <div className="px-4 py-2">
        <div className="bg-app-surface rounded-full px-4 py-2 text-gray-500 text-center flex items-center justify-center gap-2">
          <span>⌕</span>
          <span>{s.messages_search_placeholder}</span>
        </div>
      </div>

      <div className="flex gap-4 px-4 py-2 border-b border-app-border overflow-x-auto no-scrollbar">
        <div {...bindTap('messages.tab.toAll')} className={`px-4 py-1 rounded-full whitespace-nowrap font-bold cursor-pointer transition-colors ${activeTab === 'all' ? 'bg-app-text text-app-bg' : 'border border-app-border text-app-text'}`}>
          {s.messages_tab_all}
        </div>
        <div {...bindTap('messages.tab.toUnread')} className={`px-4 py-1 rounded-full whitespace-nowrap font-bold cursor-pointer transition-colors ${activeTab === 'unread' ? 'bg-app-text text-app-bg' : 'border border-app-border text-app-text'}`}>
          {s.messages_tab_unread}
        </div>
        <div {...bindTap('messages.tab.toGroups')} className={`px-4 py-1 rounded-full whitespace-nowrap font-bold cursor-pointer transition-colors ${activeTab === 'groups' ? 'bg-app-text text-app-bg' : 'border border-app-border text-app-text'}`}>
          {s.messages_tab_groups}
        </div>
        <div {...bindTap('messages.tab.toRequests')} className={`px-4 py-1 rounded-full whitespace-nowrap font-bold cursor-pointer transition-colors ${activeTab === 'requests' ? 'bg-app-text text-app-bg' : 'border border-app-border text-app-text'}`}>
          {s.messages_tab_requests}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">{renderContent()}</div>

      <div className="fixed bottom-20 right-4 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg cursor-pointer z-50">
        <IcAdd className="w-8 h-8" />
      </div>
    </div>
  );
};

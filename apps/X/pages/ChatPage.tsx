import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLocale } from '@/os/locale';
import { useKeyboard } from '../../../os/keyboard';
import * as TimeService from '../../../os/TimeService';
import { IcImage, IcInfo, IcNavBack, IcSendArrow } from '../res/icons';
import { dimens } from '../res/dimens';
import { useXStore, selectUser } from '../state';
import { useXConversations } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';

export const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const conversations = useXConversations();
  const sendMessage = useXStore(s => s.sendMessage);
  const user = useXStore(selectUser);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevKeyboardHeightRef = useRef(0);
  const { bindBack, bindTap } = useXGestures();
  const { height: keyboardHeight } = useKeyboard();
  const s = useXStrings();
  const locale = useLocale();

  const conversation = conversations.find(item => item.id === id);
  const joinedTimestamp = TimeService.parseToTimestamp('2010-12-28 00:00:00');
  const joinedDate = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: locale === 'en' ? 'long' : 'numeric',
    day: 'numeric',
  }).format(TimeService.fromTimestamp(joinedTimestamp));

  const scrollToBottom = (instant = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  };

  useLayoutEffect(() => {
    scrollToBottom(true);
  }, [conversation?.messages]);

  useEffect(() => {
    if (keyboardHeight > 0 && prevKeyboardHeightRef.current === 0) {
      const timer = setTimeout(() => scrollToBottom(true), 50);
      prevKeyboardHeightRef.current = keyboardHeight;
      return () => clearTimeout(timer);
    }
    prevKeyboardHeightRef.current = keyboardHeight;
  }, [keyboardHeight]);

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-app-bg text-app-text">
        <p>{s.chat_not_found}</p>
        <button {...bindBack()} className="mt-4 text-blue-500">{s.chat_back}</button>
      </div>
    );
  }

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(conversation.id, inputValue);
    setInputValue('');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text pt-10">
      <div className="flex items-center px-4 py-2 border-b border-app-border shrink-0">
        <button {...bindBack()} className="mr-4" aria-label={s.chat_back}>
          <IcNavBack size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-3">
          {conversation.participant.avatar ? (
            <img src={conversation.participant.avatar} alt={conversation.participant.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-pink-600 font-bold text-white">
              {conversation.participant.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm flex items-center gap-1">
            {conversation.participant.name}
            {conversation.participant.verified && <span className="text-blue-400">✓</span>}
          </div>
          <div className="text-gray-500 text-xs">{`@${conversation.participant.id}`}</div>
        </div>
        <IcInfo size={20} className="text-app-text" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex flex-col items-center py-8 border-b border-app-border mb-4">
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden mb-3">
            {conversation.participant.avatar ? (
              <img src={conversation.participant.avatar} alt={conversation.participant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-pink-600 font-bold text-2xl text-white">
                {conversation.participant.name[0]}
              </div>
            )}
          </div>
          <div className="font-bold text-lg flex items-center gap-1">
            {conversation.participant.name}
            {conversation.participant.verified && <span className="text-blue-400">✓</span>}
          </div>
          <div className="text-gray-500 text-sm mb-4">{`@${conversation.participant.id}`}</div>
          <div className="text-gray-500 text-sm mb-4">
            {s.chat_joined_prefix}{joinedDate}
          </div>
        </div>

        {conversation.messages.map((message: any) => {
          const isMe = message.isMe;
          return (
            <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-2 self-end">
                  {conversation.participant.avatar ? (
                    <img src={conversation.participant.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-pink-600 text-xs text-white">
                      {conversation.participant.name[0]}
                    </div>
                  )}
                </div>
              )}
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm ${isMe ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-gray-100 text-app-text rounded-bl-sm'}`}>
                {message.content}
                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                  {message.time}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-app-border flex items-center gap-3 shrink-0" data-keep-keyboard="true">
        <div className="text-blue-400">
          <IcImage size={dimens.compose_toolbar_icon_size} />
        </div>
        <div className="flex-1 bg-app-surface rounded-2xl px-4 py-2 flex items-center">
          <input
            type="text"
            className="bg-transparent border-none outline-none text-app-text w-full placeholder-gray-500"
            placeholder={s.chat_input_placeholder}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            data-action="chat.message.input"
            data-action-type="input"
            data-action-params={JSON.stringify({ value: inputValue })}
          />
          {inputValue && (
            <button
              {...bindTap(
                { kind: 'action', id: 'chat.message.send' },
                {
                  params: { conversationId: conversation.id, content: inputValue },
                  onTrigger: handleSend,
                },
              )}
              onPointerDown={(event) => event.preventDefault()}
              className="text-blue-500 ml-2"
              aria-label={s.chat_send_aria_label}
            >
              <IcSendArrow size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


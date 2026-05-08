import React, { useState } from 'react';
import { IcClock, IcCompose, IcImage, IcMic, IcAttach } from '../res/icons';
import { useXGestures } from '../hooks/useXGestures';
import { useXStore, selectUser } from '../state';
import { XImage } from '../components/XMedia';
import { useXStrings } from '../hooks/useXStrings';
import * as AIService from '../../../os/AIService';
import * as TimeService from '../../../os/TimeService';

let localSeq = 0;
function nextMessageId(prefix: 'ai' | 'err' | 'u'): string {
    localSeq += 1;
    return `${prefix}_${TimeService.now()}_${localSeq}`;
}

export const GrokPage: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
    const user = useXStore(selectUser);
    const { bindTap } = useXGestures(isActive);
    const s = useXStrings();
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const trimmed = inputValue.trim();

    const triggerAIResponse = async (history: Array<{ id: string; role: 'user' | 'assistant'; content: string }>) => {
        setIsLoading(true);
        try {
            const systemDefaults = AIService.getSystemDefaults();
            const useRealAI = systemDefaults.enabled && systemDefaults.baseUrl;
            const provider: AIService.AIProvider = useRealAI ? 'openai' : 'mock';

            const aiMessages = AIService.buildMessagesFromHistory(
                history.map(m => ({ content: m.content, isUser: m.role === 'user' })),
                "You are Grok, a rebellious and witty AI assistant inspired by the Hitchhiker's Guide to the Galaxy. You have a bit of an attitude and you're not afraid to be sarcastic. You answer questions informatively but with a unique personality.",
                10
            );

            const response = await AIService.chat(aiMessages, {
                model: systemDefaults.model,
                temperature: 0.7,
                provider,
            });

            if (response.success && response.content) {
                setMessages(prev => [...prev, {
                    id: nextMessageId('ai'),
                    role: 'assistant',
                    content: response.content || ''
                }]);
            }
        } catch (error) {
            console.error('Grok AI error:', error);
            setMessages(prev => [...prev, {
                id: nextMessageId('err'),
                role: 'assistant',
                content: s.grok_error_connection
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const send = bindTap(
      { kind: 'action', id: 'grok.message.send' },
      {
        params: { content: trimmed },
        onTrigger: () => {
          if (!trimmed || isLoading) return;
          const userMessage = { id: nextMessageId('u'), role: 'user' as const, content: trimmed };
          const newMessages = [...messages, userMessage];
          setMessages(newMessages);
          setInputValue('');
          window.requestAnimationFrame(() => {
            (document.activeElement as HTMLElement | null)?.blur?.();
          });
          triggerAIResponse(newMessages);
        },
      },
    );

    return (
        <div className="flex flex-col h-full bg-app-bg text-app-text relative pt-10">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 py-3">
                <div
                    className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden cursor-pointer"
                    {...bindTap('grok.drawer.open')}
                >
                    {user.avatar && isActive ? (
                        <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
                            {user.name[0]}
                        </div>
                    )}
                </div>
                
                <div
                    className="flex items-center gap-1 text-sm font-medium cursor-pointer"
                    {...bindTap({ kind: 'action', id: 'grok.mode.open' })}
                >
                    <span>🚀 {s.grok_mode_auto}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6"/>
                    </svg>
                </div>

                <div className="flex items-center gap-4">
                    <IcClock className="w-6 h-6 text-app-text cursor-pointer" {...bindTap({ kind: 'action', id: 'grok.history.open' })} />
                    <IcCompose className="w-6 h-6 text-app-text cursor-pointer" {...bindTap({ kind: 'action', id: 'grok.chat.new' })} />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center relative px-4">
                {/* News Card */}
                <div className="absolute top-4 left-4 right-4 bg-gray-50 border border-app-border rounded-2xl p-4 flex gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-white rounded-xl shrink-0 overflow-hidden relative">
                         {/* Abstract Owl/Galaxy Image Placeholder */}
                         <div className="absolute inset-0 flex items-center justify-center text-xs text-center text-gray-400">Grok 4.1</div>
                    </div>
                    <div>
                        <h3 className="font-bold text-sm mb-1">{s.grok_announce_title}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            {s.grok_announce_desc}
                        </p>
                    </div>
                </div>

                {/* Center Logo */}
                {messages.length === 0 ? (
                    <div className="text-gray-300 mb-20">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 2h16l-8 8-8-8zM4 22h16l-8-8-8 8z" opacity="0.1"/> 
                            <path d="M2 2L22 22M22 2L2 22" stroke="currentColor" strokeWidth="1" />
                        </svg>
                    </div>
                ) : (
                    <div className="absolute top-28 left-0 right-0 bottom-32 px-4 overflow-y-auto no-scrollbar w-full">
                        <div className="flex flex-col gap-3">
                            {messages.map(m => (
                                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-gray-100 text-app-text rounded-bl-sm'}`}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] px-4 py-3 rounded-2xl text-sm bg-gray-100 text-app-text rounded-bl-sm">
                                        <div className="flex gap-1 items-center">
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="absolute bottom-24 left-4 right-4 flex gap-3 overflow-x-auto no-scrollbar">
                    <button
                        className="flex-1 min-w-[100px] bg-gray-50 border border-app-border rounded-xl p-3 flex flex-col gap-2 items-start hover:bg-gray-100 transition-colors"
                        {...bindTap({ kind: 'action', id: 'grok.quick.createImage' })}
                    >
                        <IcImage className="w-5 h-5" />
                        <span className="text-xs font-medium">{s.grok_quick_create_image}</span>
                    </button>
                    <button
                        className="flex-1 min-w-[100px] bg-gray-50 border border-app-border rounded-xl p-3 flex flex-col gap-2 items-start hover:bg-gray-100 transition-colors"
                        {...bindTap({ kind: 'action', id: 'grok.quick.editImage' })}
                    >
                        <IcCompose className="w-5 h-5" />
                        <span className="text-xs font-medium">{s.grok_quick_edit_image}</span>
                    </button>
                    <button
                        className="flex-1 min-w-[100px] bg-gray-50 border border-app-border rounded-xl p-3 flex flex-col gap-2 items-start hover:bg-gray-100 transition-colors"
                        {...bindTap({ kind: 'action', id: 'grok.quick.voiceMode' })}
                    >
                        <div className="flex justify-between w-full">
                            <IcMic className="w-5 h-5" />
                            <span className="text-xs text-gray-500">↗</span>
                        </div>
                        <span className="text-xs font-medium">{s.grok_quick_voice_mode}</span>
                    </button>
                </div>
            </div>

            {/* Bottom Input Area */}
            <div className="px-4 pb-4">
                <div className="bg-gray-100 rounded-[32px] p-2 flex items-end gap-2">
                    <button
                        className="p-2 text-gray-500 hover:text-app-text rounded-full hover:bg-gray-100"
                        aria-label="Upload file"
                        {...bindTap({ kind: 'action', id: 'grok.file.attach' })}
                    >
                        <IcAttach className="w-5 h-5" />
                    </button>
                    
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={s.grok_input_placeholder}
                        className="flex-1 bg-transparent text-app-text placeholder-gray-400 resize-none py-2 max-h-32 focus:outline-none text-base"
                        rows={1}
                        style={{ minHeight: '40px' }}
                        data-action={isActive ? "grok.prompt.input" : undefined}
                        data-action-type={isActive ? "input" : undefined}
                        data-action-params={isActive ? JSON.stringify({ value: inputValue }) : undefined}
                    />

                    <button
                        {...send}
                        disabled={isLoading}
                        className={`h-10 px-4 rounded-full flex items-center gap-2 font-medium transition-colors ${
                            trimmed && !isLoading ? 'bg-app-text text-app-bg cursor-pointer' : 'bg-gray-100 text-gray-400 border border-app-border cursor-default'
                        }`}
                    >
                        {trimmed && !isLoading ? (
                            <span className="text-sm">{s.grok_submit_button}</span>
                        ) : isLoading ? (
                            <span className="text-sm opacity-60">{s.grok_generating}</span>
                        ) : (
                            <>
                                <div className="w-4 h-4 flex items-center justify-center relative">
                                    <div className="w-0.5 h-2 bg-white rounded-full mx-0.5 animate-pulse" />
                                    <div className="w-0.5 h-3 bg-white rounded-full mx-0.5 animate-pulse" style={{ animationDelay: '75ms' }} />
                                    <div className="w-0.5 h-2 bg-white rounded-full mx-0.5 animate-pulse" style={{ animationDelay: '150ms' }} />
                                </div>
                                <span className="text-sm">{s.grok_send_button}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

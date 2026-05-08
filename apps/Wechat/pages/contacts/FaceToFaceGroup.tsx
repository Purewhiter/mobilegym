
import React, { useState, useEffect } from 'react';
import { dimens } from '../../res/dimens';
import { IcNavBack, IcDelete } from '../../res/icons';
import { useSearchParams } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { BackspaceIcon } from '../../res/icons';
import { useLocale } from '@/os/locale';

export const FaceToFaceGroupInput: React.FC = () => {
    const { bindBack, bindTap, go } = useWechatGestures();
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [pin, setPin] = useState<string[]>([]);
    const navTimerRef = React.useRef<number | null>(null);
    const text = isEnglish
      ? {
          title: 'Face-to-Face Group',
          description: 'Enter the same four digits as nearby friends to join the same group chat',
        }
      : {
          title: '面对面建群',
          description: '和身边的朋友输入同样的四个数字，进入同一个群聊',
        };

    const handleKeyClick = (key: string) => {
        if (pin.length < 4) {
            setPin(prev => [...prev, key]);
        }
    };

    const handleDelete = () => {
        if (navTimerRef.current) {
            window.clearTimeout(navTimerRef.current);
            navTimerRef.current = null;
        }
        setPin(prev => prev.slice(0, -1));
    };

    useEffect(() => {
        return () => {
            if (navTimerRef.current) {
                window.clearTimeout(navTimerRef.current);
                navTimerRef.current = null;
            }
        };
    }, []);

    return (
        <div className="absolute inset-0 bg-(--app-c-overlay-dark-panel) flex flex-col z-[150] text-white">
            <div className="h-(--app-chat-list-item-avatar-size) flex items-center px-4 mt-8">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2 active:opacity-60">
                    <IcNavBack size={dimens.icSizeNav} className="text-white" />
                </button>
                <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
                    <span className="text-(--app-settings-item-text-size) font-medium">{text.title}</span>
                </div>
            </div>

            <div className="flex flex-col items-center pt-12 px-10">
                <p className="text-(--app-c-settings-item-extra-text) text-(--app-search-filter-text-size) text-center leading-relaxed mb-12">
                    {text.description}
                </p>

                <div className="flex gap-6 mb-20">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="w-4 h-4 rounded-full bg-(--app-c-overlay-dark-item) flex items-center justify-center">
                            {pin[i] && <div className="w-full h-full rounded-full bg-app-primary shadow-[0_0_8px_rgba(7,193,96,0.5)]"></div>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto grid grid-cols-3 w-full bg-(--app-c-overlay-dark-panel-alt)/50 pb-8 pt-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'].map((key, idx) => {
                    if (key === '') return <div key={idx}></div>;
                    if (key === 'delete') {
                        return (
                            <button 
                                key={idx} 
                                {...bindTap<HTMLButtonElement>(
                                  { kind: 'action', id: 'faceToFace.pin.delete.submit' },
                                  { onTrigger: handleDelete },
                                )}
                                className="h-16 flex items-center justify-center active:bg-white/10"
                            >
                                <div className="bg-(--app-c-overlay-dark-item) p-2 rounded-lg">
                                    <BackspaceIcon stroke="#7f7f7f" />
                                </div>
                            </button>
                        );
                    }
                    const isLastDigit = pin.length === 3;
                    const finalPin = isLastDigit ? [...pin, key].join('') : null;
                    return (
                        <button 
                            key={idx} 
                            {...(isLastDigit && finalPin
                              ? bindTap<HTMLButtonElement>('faceToFace.join.open', {
                                  params: { pin: finalPin },
                                  onTrigger: () => {
                                      handleKeyClick(key);
                                      if (navTimerRef.current) {
                                          window.clearTimeout(navTimerRef.current);
                                          navTimerRef.current = null;
                                      }
                                      // Short delay to show the last digit before navigating
                                      navTimerRef.current = window.setTimeout(() => {
                                          navTimerRef.current = null;
                                          go('faceToFace.join.open', { pin: finalPin });
                                      }, 300);
                                  },
                              })
                              : bindTap<HTMLButtonElement>(
                                  { kind: 'action', id: 'faceToFace.pin.input' },
                                  { params: { value: key }, onTrigger: () => handleKeyClick(key) },
                                ))}
                            className="h-16 text-(--app-title-text-size-28) font-medium text-(--app-c-settings-item-extra-text) flex items-center justify-center active:bg-white/10"
                        >
                            {key}
                        </button>
                    );
                })}
            </div>
            <div className="h-4 bg-(--app-c-overlay-dark-panel-alt)/50"></div>
        </div>
    );
};

export const FaceToFaceGroupJoin: React.FC = () => {
    const { bindBack } = useWechatGestures();
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [searchParams] = useSearchParams();
    const user = useWechatStore(s => s.user);
    // Get the actual PIN entered from the navigation state
    const pin = searchParams.get('pin') || "2345";
    const text = isEnglish
      ? {
          title: 'Face-to-Face Group',
          subtitle: 'These friends will also join the group chat',
          enterGroup: 'Enter Group',
        }
      : {
          title: '面对面建群',
          subtitle: '这些朋友也将进入群聊',
          enterGroup: '进入该群',
        };

    return (
        <div className="absolute inset-0 bg-(--app-c-overlay-dark-panel) flex flex-col z-[150] text-white">
            <div className="h-(--app-chat-list-item-avatar-size) flex items-center px-4 mt-8">
                <button {...bindBack<HTMLButtonElement>()} className="p-2 -ml-2 active:opacity-60">
                    <IcNavBack size={dimens.icSizeNav} className="text-white" />
                </button>
                <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
                    <span className="text-(--app-settings-item-text-size) font-medium">{text.title}</span>
                </div>
            </div>

            <div className="flex flex-col items-center pt-8">
                <div className="flex gap-4 mb-6">
                    {pin.split('').map((char: string, i: number) => (
                        <span key={i} className="text-(--app-title-text-size-48) font-medium text-app-primary drop-shadow-[0_0_12px_rgba(7,193,96,0.6)]">{char}</span>
                    ))}
                </div>
                <p className="text-(--app-c-settings-item-extra-text) text-(--app-search-filter-text-size) mb-12">{text.subtitle}</p>

                <div className="grid grid-cols-4 gap-6 px-10 w-full">
                    <div className="flex flex-col items-center gap-2">
                        <img src={user.avatar} className="w-14 h-14 rounded-[4px] object-cover" alt="" />
                        <span className="text-(--app-chat-time-label-text-size) text-(--app-c-settings-item-extra-text) truncate w-full text-center">{user.name}</span>
                    </div>
                    <div className="w-14 h-14 rounded-[4px] bg-(--app-c-overlay-dark-item)"></div>
                    <div className="w-14 h-14 rounded-[4px] bg-(--app-c-overlay-dark-item)"></div>
                </div>
            </div>

            <div className="mt-auto px-6 mb-16">
                <button 
                    className="w-full bg-app-primary text-white py-3.5 rounded-lg text-(--app-settings-item-text-size) font-medium active:opacity-80" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
                >
                    {text.enterGroup}
                </button>
            </div>
            <div className="h-6"></div>
        </div>
    );
};

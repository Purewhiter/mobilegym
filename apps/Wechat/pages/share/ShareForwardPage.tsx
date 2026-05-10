import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { IcNavBack, IcSearch, IcSmile, IcNavForward } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { WechatSmartImage } from '../../components/WechatSmartImage';
import { useActivityContext } from '../../../../os/ActivityContext';
import { BackDispatcher } from '../../../../os/BackDispatcher';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useAppNavigate } from '../../navigation';
import * as TimeService from '../../../../os/TimeService';
import type { ChatSession, ContactItem } from '../../types';

type ShareTarget = {
  wxid: string;
  name: string;
  avatar: string;
};

type View = 'main' | 'create';

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

function lastMessageTime(chat: ChatSession): number {
  if (!chat.messages?.length) return 0;
  return chat.messages[chat.messages.length - 1].timestamp;
}

function letterOf(contact: ContactItem): string {
  const trimmed = contact.category?.trim();
  if (trimmed) return trimmed;
  const ch = contact.name.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(ch) ? ch : '#';
}

// Render a name with the matched substring highlighted in WeChat green.
const HighlightedName: React.FC<{ name: string; query: string; className?: string }> = ({ name, query, className }) => {
  if (!query) return <span className={className}>{name}</span>;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span className={className}>{name}</span>;
  return (
    <span className={className}>
      {name.slice(0, idx)}
      <span className="text-(--app-primary)">{name.slice(idx, idx + query.length)}</span>
      {name.slice(idx + query.length)}
    </span>
  );
};

// ----- Main share view: 选择聊天 -----
const MainShareView: React.FC<{
  recentForwards: ShareTarget[];
  recentChats: (ShareTarget & { preview: string; time: string })[];
  contactMatches: ContactItem[];
  onClose: () => void;
  onPickTarget: (target: ShareTarget) => void;
  onOpenCreateChat: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}> = ({ recentForwards, recentChats, contactMatches, onClose, onPickTarget, onOpenCreateChat, searchQuery, onSearchChange }) => {
  const t = useWechatStrings();
  const isSearching = searchQuery.trim().length > 0;
  return (
    <div className="h-full w-full flex flex-col bg-app-bg">
      {/* Top bar */}
      <div className="pt-10 h-[88px] flex items-center justify-between px-4 bg-app-surface border-b border-(--app-c-tw-border-gray-100) shrink-0 relative">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60"
          aria-label={t.share_cancel}
          data-action="share.forward.close"
          data-action-type="close"
        >
          <IcNavBack size={26} className="text-app-text" />
        </button>
        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
          <span className="text-[17px] font-medium text-app-text">{t.share_title}</span>
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Search */}
        <div className="p-2 bg-app-bg">
          <div className="bg-app-surface rounded-[4px] h-9 flex items-center px-2.5 gap-1.5">
            <IcSearch size={16} className="text-(--app-c-tw-text-gray-400)" />
            <input
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={t.common_search}
              className="flex-1 bg-transparent outline-none text-[15px] text-app-text placeholder:text-(--app-c-tw-text-gray-400)"
              data-action="share.forward.search.input"
              data-action-type="modify"
            />
          </div>
        </div>

        {/* When NOT searching: show 最近转发 + 最近聊天 sections.
            When searching: collapse to a single 联系人 section with all matches. */}
        {!isSearching ? (
          <>
            {recentForwards.length > 0 && (
              <div className="bg-app-surface">
                <div className="px-4 pt-3 pb-2 text-[14px] text-(--app-c-tw-text-gray-500)">
                  {t.share_recent_forwards}
                </div>
                <div className="px-4 pb-3 flex gap-4 overflow-x-auto no-scrollbar">
                  {recentForwards.map(target => (
                    <button
                      key={`recent-fwd-${target.wxid}`}
                      type="button"
                      onClick={() => onPickTarget(target)}
                      className="flex flex-col items-center gap-1 shrink-0 active:opacity-60"
                      data-action="share.forward.recentForward.select"
                      data-action-type="open"
                    >
                      <img
                        src={target.avatar}
                        alt={target.name}
                        className="w-12 h-12 rounded-[6px] object-cover bg-(--app-c-tw-bg-gray-100)"
                        loading="lazy"
                      />
                      <span className="text-[12px] text-app-text max-w-[56px] truncate">{target.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-app-surface mt-2 flex items-center justify-between px-4 py-2">
              <span className="text-[14px] text-(--app-c-tw-text-gray-500)">{t.share_recent_chats}</span>
              <button
                type="button"
                onClick={onOpenCreateChat}
                className="text-[14px] text-(--app-c-wechat-link) active:opacity-60"
                data-action="share.forward.createChat"
                data-action-type="open"
              >
                {t.share_create_chat_link}
              </button>
            </div>

            <div className="bg-app-surface">
              {recentChats.map(chat => (
                <button
                  key={`recent-chat-${chat.wxid}`}
                  type="button"
                  onClick={() => onPickTarget(chat)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-(--app-c-chat-list-item-bg-active) border-b border-(--app-c-tw-border-gray-100)"
                  data-action="share.forward.target.select"
                  data-action-type="open"
                >
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-10 h-10 rounded-[6px] object-cover bg-(--app-c-tw-bg-gray-100)"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[15px] text-app-text truncate">{chat.name}</div>
                    <div className="text-[13px] text-(--app-c-tw-text-gray-400) truncate">{chat.preview}</div>
                  </div>
                  <span className="text-[12px] text-(--app-c-tw-text-gray-400) shrink-0">{chat.time}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="bg-app-bg px-4 py-2 text-[14px] text-(--app-c-tw-text-gray-500)">
              {t.search_section_contacts}
            </div>
            <div className="bg-app-surface">
              {contactMatches.length === 0 ? (
                <div className="px-4 py-8 text-center text-[14px] text-(--app-c-tw-text-gray-400)">
                  {t.share_no_target}
                </div>
              ) : (
                contactMatches.map(contact => (
                  <button
                    key={`contact-${contact.wxid}`}
                    type="button"
                    onClick={() => onPickTarget({ wxid: contact.wxid, name: contact.name, avatar: contact.avatar })}
                    className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-(--app-c-chat-list-item-bg-active) border-b border-(--app-c-tw-border-gray-100)"
                    data-action="share.forward.target.select"
                    data-action-type="open"
                  >
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-10 h-10 rounded-[6px] object-cover bg-(--app-c-tw-bg-gray-100)"
                      loading="lazy"
                    />
                    <HighlightedName
                      name={contact.name}
                      query={searchQuery.trim()}
                      className="text-[15px] text-app-text truncate"
                    />
                  </button>
                ))
              )}
            </div>
          </>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
};

// ----- Create chat view: 创建聊天（多选联系人 — 完成按钮始终禁用，因当前不支持创建群聊） -----
const CreateChatView: React.FC<{
  contacts: ContactItem[];
  selectedIds: Set<string>;
  onToggle: (wxid: string) => void;
  onBack: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}> = ({ contacts, selectedIds, onToggle, onBack, searchQuery, onSearchChange }) => {
  const t = useWechatStrings();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter(c => c.name.toLowerCase().includes(q));
  }, [contacts, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, ContactItem[]>();
    for (const contact of filtered) {
      const letter = letterOf(contact);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(contact);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  return (
    <div className="h-full w-full flex flex-col bg-app-bg">
      {/* Top bar — done button is always disabled (group creation not supported) */}
      <div className="pt-10 h-[88px] flex items-center justify-between px-4 bg-app-bg shrink-0 relative">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60"
          aria-label={t.share_cancel}
          data-action="share.create.back"
          data-action-type="close"
        >
          <IcNavBack size={26} className="text-app-text" />
        </button>
        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
          <span className="text-[17px] font-medium text-app-text">{t.share_create_chat_title}</span>
        </div>
        <button
          type="button"
          disabled
          className="px-3 py-1.5 rounded-[4px] text-[15px] font-medium bg-(--app-c-tw-bg-gray-200) text-(--app-c-tw-text-gray-400)"
        >
          {t.share_done}{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </button>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto relative"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Search */}
        <div className="p-2 bg-app-bg">
          <div className="bg-app-surface rounded-[4px] h-9 flex items-center px-2.5 gap-1.5">
            <IcSearch size={16} className="text-(--app-c-tw-text-gray-400)" />
            <input
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={t.common_search}
              className="flex-1 bg-transparent outline-none text-[15px] text-app-text placeholder:text-(--app-c-tw-text-gray-400)"
              data-action="share.create.search.input"
              data-action-type="modify"
            />
          </div>
        </div>

        {/* Static group action rows (like StartGroup) */}
        <div className="bg-app-surface">
          <div className="px-4 py-3.5 text-[16px] text-(--app-c-settings-item-text)">
            {t.share_create_pick_existing_group}
          </div>
          <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">
            {t.share_create_new_group}
          </div>
          <div className="px-4 py-3.5 text-[16px] text-(--app-c-settings-item-text)">
            {t.share_create_pick_from_group}
          </div>
        </div>

        {/* Contacts grouped by letter */}
        <div className="bg-app-surface">
          {grouped.map(([letter, list]) => (
            <div key={letter} id={`section-${letter}`}>
              <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">{letter}</div>
              {list.map(contact => {
                const checked = selectedIds.has(contact.wxid);
                return (
                  <button
                    key={contact.wxid}
                    type="button"
                    onClick={() => onToggle(contact.wxid)}
                    className="w-full flex items-center px-4 py-2.5 active:bg-(--app-c-contacts-item-bg-active) border-b border-(--app-c-tw-border-gray-100)"
                    data-action="share.create.contact.toggle"
                    data-action-type="modify"
                  >
                    <div className={`w-[22px] h-[22px] rounded-full border mr-4 flex items-center justify-center shrink-0 ${
                      checked
                        ? 'border-(--app-primary) bg-(--app-primary)'
                        : 'border-(--app-c-tw-border-gray-300)'
                    }`}>
                      {checked && (
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-[14px] h-[14px] text-white" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-10 h-10 rounded-[4px] object-cover bg-(--app-c-tw-bg-gray-100)"
                      loading="lazy"
                    />
                    <span className="ml-3 text-[15px] text-app-text">{contact.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="h-6" />

        {/* Right alphabet index (decorative) */}
        <div className="absolute right-0 top-32 bottom-6 flex flex-col justify-between items-center text-[10px] font-medium text-(--app-c-tw-text-gray-500) w-6 z-10 pt-20 pointer-events-none">
          {ALPHABET.map(l => <span key={l}>{l}</span>)}
          <span>#</span>
        </div>
      </div>
    </div>
  );
};

// ----- Bottom slide-up confirm sheet -----
const ConfirmSheet: React.FC<{
  targets: ShareTarget[];
  imagePath: string;
  imageCount: number;
  caption: string;
  onCaptionChange: (s: string) => void;
  onCancel: () => void;
  onSend: () => void;
  sending: boolean;
}> = ({ targets, imagePath, imageCount, caption, onCaptionChange, onCancel, onSend, sending }) => {
  const t = useWechatStrings();
  const primary = targets[0];
  const extra = targets.length - 1;

  return (
    <div className="absolute inset-0 z-[300] flex flex-col">
      <div className="flex-1 bg-black/35" onClick={onCancel} />
      <div className="bg-app-surface rounded-t-[14px] animate-slide-up shadow-2xl">
        <div className="px-5 pt-4 pb-3 text-[15px] text-app-text">{t.share_send_image_to}</div>

        {/* Selected target row */}
        <div className="px-5 pb-3 flex items-center gap-3 border-b border-(--app-c-tw-border-gray-100)">
          <img
            src={primary.avatar}
            alt={primary.name}
            className="w-10 h-10 rounded-[6px] object-cover bg-(--app-c-tw-bg-gray-100)"
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] text-app-text truncate">
              {primary.name}
              {extra > 0 && (
                <span className="ml-1 text-(--app-c-tw-text-gray-500)">等{targets.length}人</span>
              )}
            </div>
          </div>
          <IcNavForward size={18} className="text-(--app-c-tw-text-gray-300) shrink-0" />
        </div>

        {/* Image preview */}
        <div className="py-4 flex items-center justify-center">
          <div className="relative w-[120px] h-[160px] bg-(--app-c-tw-bg-gray-100) rounded-[6px] overflow-hidden">
            <WechatSmartImage src={imagePath} className="w-full h-full object-cover" alt="preview" />
            {imageCount > 1 && (
              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[11px]">
                +{imageCount - 1}
              </div>
            )}
          </div>
        </div>

        {/* Caption input */}
        <div className="px-4 pb-3">
          <div className="flex items-center bg-app-surface border border-(--app-c-tw-border-gray-100) rounded-[10px] h-12 px-3 gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <input
              value={caption}
              onChange={e => onCaptionChange(e.target.value)}
              placeholder={t.share_caption_placeholder}
              disabled={sending}
              className="flex-1 bg-transparent outline-none text-[15px] text-app-text placeholder:text-(--app-c-tw-text-gray-400)"
              data-action="share.confirm.caption.input"
              data-action-type="modify"
            />
            <IcSmile size={22} className="text-(--app-c-tw-text-gray-500)" />
          </div>
        </div>

        {/* Buttons */}
        <div className="px-4 pt-1 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="flex-1 h-11 rounded-[8px] bg-(--app-c-tw-bg-gray-100) text-[16px] text-app-text active:opacity-80 disabled:opacity-50"
            data-action="share.confirm.cancel"
            data-action-type="close"
          >
            {t.share_cancel}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="flex-1 h-11 rounded-[8px] bg-(--app-primary) text-[16px] font-medium text-white active:bg-(--app-primary-dark) disabled:opacity-50"
            data-action="share.confirm.send"
            data-action-type="modify"
          >
            {t.share_send_button}
          </button>
        </div>
      </div>
    </div>
  );
};

// ----- Top-level page -----
export const ShareForwardPage: React.FC = () => {
  const { activityId } = useActivityContext();
  const { go, back } = useAppNavigate();
  const sendImages = useWechatStore(s => s.sendImages);
  const sendMessage = useWechatStore(s => s.sendMessage);

  const { chats, contacts, currentUserWxid } = useWechatStore(useShallow(s => ({
    chats: s.chats,
    contacts: s.contacts,
    currentUserWxid: s.user.wxid,
  })));

  const intentImages = useMemo<string[]>(() => {
    const os = window.__OS__;
    const payload = os?.getIntentPayload?.(activityId) ?? os?.getIntentPayload?.('wechat');
    const data = (payload as { data?: Record<string, any> } | null)?.data;
    if (!data) return [];
    const stream = data.stream;
    if (Array.isArray(stream)) return stream.filter((s): s is string => typeof s === 'string' && s.length > 0);
    if (typeof stream === 'string' && stream.length > 0) return [stream];
    return [];
  }, [activityId]);

  const [view, setView] = useState<View>('main');
  const [searchMain, setSearchMain] = useState('');
  const [searchCreate, setSearchCreate] = useState('');
  const [createSelectedIds, setCreateSelectedIds] = useState<Set<string>>(new Set());
  const [confirmTargets, setConfirmTargets] = useState<ShareTarget[] | null>(null);
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);

  // 取消分享：回到 wechat 主页（singleTask 启动后历史是 ['/', '/share/forward']，
  // 退一步即落到 '/'）。本入口完全运行在微信 Task 内，不再借栈到调用方。
  const cancelAndClose = useCallback(() => {
    back();
  }, [back]);

  const closeConfirm = useCallback(() => {
    setConfirmTargets(null);
    setCaption('');
  }, []);

  // BackDispatcher（priority 150）覆盖 App 默认 back（priority 100）：
  // - sending 中：吞掉 back，避免发送途中误退
  // - confirm 浮层打开：先关浮层
  // - create 视图：先回到 main 视图
  // - 否则：cancelAndClose() 回到 wechat 主页（singleTask 启动后历史为 ['/', '/share/forward']）
  useEffect(() => {
    return BackDispatcher.register('wechat.share.forward', () => {
      const latestState = window.__OS__?.getState?.();
      const activeTask = latestState?.activeTaskId
        ? latestState.tasks.find(task => task.taskId === latestState.activeTaskId)
        : null;
      const topActivityId = activeTask?.stack[activeTask.stack.length - 1]?.activityId;
      if (topActivityId !== activityId) return false;
      if (sending) return true;
      if (confirmTargets) { closeConfirm(); return true; }
      if (view === 'create') { setView('main'); setCreateSelectedIds(new Set()); return true; }
      cancelAndClose();
      return true;
    }, 150);
  }, [activityId, view, confirmTargets, sending, cancelAndClose, closeConfirm]);

  const visibleContacts = useMemo(
    () => contacts.filter(c => !c.isBlacklisted && c.wxid !== currentUserWxid),
    [contacts, currentUserWxid],
  );

  const recentForwards = useMemo<ShareTarget[]>(() => {
    return chats
      .filter(c => c.id !== currentUserWxid)
      .slice()
      .sort((a, b) => lastMessageTime(b) - lastMessageTime(a))
      .slice(0, 6)
      .map(c => ({ wxid: c.id, name: c.user.name, avatar: c.user.avatar }));
  }, [chats, currentUserWxid]);

  const recentChats = useMemo(() => {
    const q = searchMain.trim().toLowerCase();
    const sorted = chats
      .filter(c => c.id !== currentUserWxid)
      .slice()
      .sort((a, b) => lastMessageTime(b) - lastMessageTime(a));
    const filtered = q ? sorted.filter(c => c.user.name.toLowerCase().includes(q)) : sorted;
    return filtered.map(chat => {
      const lastTs = lastMessageTime(chat);
      const last = chat.messages?.[chat.messages.length - 1];
      const preview = last
        ? (last.type === 'image' ? '[图片]' : (last.content || ''))
        : '';
      let time = '';
      if (lastTs) {
        const d = TimeService.fromTimestamp(lastTs);
        time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
      return {
        wxid: chat.id,
        name: chat.user.name,
        avatar: chat.user.avatar,
        preview,
        time,
      };
    });
  }, [chats, currentUserWxid, searchMain]);

  const handlePickTarget = useCallback((target: ShareTarget) => {
    if (intentImages.length === 0) return;
    setConfirmTargets([target]);
    setCaption('');
  }, [intentImages.length]);

  const contactMatches = useMemo(() => {
    const q = searchMain.trim().toLowerCase();
    if (!q) return [];
    return visibleContacts.filter(c => c.name.toLowerCase().includes(q));
  }, [visibleContacts, searchMain]);

  const handleSend = useCallback(() => {
    if (!confirmTargets || confirmTargets.length === 0 || sending || intentImages.length === 0) return;
    setSending(true);
    const trimmedCaption = caption.trim();
    for (const target of confirmTargets) {
      sendImages(target.wxid, intentImages);
      if (trimmedCaption) sendMessage(target.wxid, trimmedCaption);
    }
    // 真机微信：发送后跳到目标会话页面，wechat 主页留作返回栈底。
    // 这里 replace 当前 '/share/forward' 为 '/chat/:id'，使历史变为 ['/', '/chat/:id']。
    const target = confirmTargets[0];
    requestAnimationFrame(() => {
      go('share.forward.send.toChat', { id: target.wxid });
    });
  }, [confirmTargets, sending, intentImages, caption, sendImages, sendMessage, go]);

  const toggleCreateContact = (wxid: string) => {
    setCreateSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(wxid)) next.delete(wxid); else next.add(wxid);
      return next;
    });
  };

  return (
    <div
      className="relative bg-app-surface h-full w-full flex flex-col overflow-hidden"
      data-status-bar-foreground="dark"
    >
      {view === 'main' ? (
        <MainShareView
          recentForwards={recentForwards}
          recentChats={recentChats}
          contactMatches={contactMatches}
          onClose={cancelAndClose}
          onPickTarget={handlePickTarget}
          onOpenCreateChat={() => setView('create')}
          searchQuery={searchMain}
          onSearchChange={setSearchMain}
        />
      ) : (
        <CreateChatView
          contacts={visibleContacts}
          selectedIds={createSelectedIds}
          onToggle={toggleCreateContact}
          onBack={() => { setView('main'); setCreateSelectedIds(new Set()); }}
          searchQuery={searchCreate}
          onSearchChange={setSearchCreate}
        />
      )}

      {confirmTargets && intentImages.length > 0 && (
        <ConfirmSheet
          targets={confirmTargets}
          imagePath={intentImages[0]}
          imageCount={intentImages.length}
          caption={caption}
          onCaptionChange={setCaption}
          onCancel={closeConfirm}
          onSend={handleSend}
          sending={sending}
        />
      )}
    </div>
  );
};

export default ShareForwardPage;

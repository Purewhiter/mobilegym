import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IcNavBack,
  IcCheck,
  IcCheckBox,
  IcDrawingBoard,
  IcImage,
  IcMic,
  IcMoreVert,
  IcPenTool,
  IcEdit,
  IcRedo,
  IcShare,
  IcTextType,
  IcUndo,
} from '../res/icons';
import { useKeyboard } from '../../../os/keyboard/useKeyboard';
import { KeyboardService } from '../../../os/keyboard/KeyboardService';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { NOTES_CONFIG } from '../data';
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore } from '../state';
import { Toast } from '@/os/components/Toast';
import { ActionSheet } from '../components/ActionSheet';
import { DateTimeDialog } from '../components/DateTimeDialog';
import { IcFolderIndicator, IcNoteLock } from '../res/icons';
import { colors } from '../res/colors';
import { dimens } from '../res/dimens';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { getFolderDisplayName } from '../utils';

// 智能字数统计：中文按字符，英文按单词
function countWords(text: string): number {
  if (!text.trim()) return 0;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const englishText = text.replace(/[\u4e00-\u9fa5]/g, ' ').trim();
  const englishWords = englishText ? englishText.split(/\s+/).filter(w => w.length > 0) : [];
  return chineseChars.length + englishWords.length;
}

function formatHeaderTime(timestamp: number, s: typeof strings) {
  const d = TimeService.fromTimestamp(timestamp);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = d.getHours(); // 真机展示不补零
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${mm}${s.date_suffix_month}${dd}${s.date_suffix_day} ${hh}:${mi}`;
}

export const NoteEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { back, bindBack, go, navigateTo } = useNotesGestures();
  const {
    notes,
    folders,
    settings,
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    deleteNoteForever,
    hideNote,
    unhideNote,
  } = useNotesStore(
    useShallow(s => ({
      notes: s.notes,
      folders: s.folders,
      settings: s.settings,
      addNote: s.addNote,
      updateNote: s.updateNote,
      deleteNote: s.deleteNote,
      restoreNote: s.restoreNote,
      deleteNoteForever: s.deleteNoteForever,
      hideNote: s.hideNote,
      unhideNote: s.unhideNote,
    }))
  );
  const s = useAppStrings(strings, stringsEn);
  const { visible: keyboardVisible } = useKeyboard();
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isNew = id === 'new';
  const existing = useMemo(
    () => (isNew || !id ? undefined : notes.find(n => n.id === id)),
    [id, isNew, notes],
  );

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [folderId, setFolderId] = useState<string>('unfiled');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const isFirstLoadRef = useRef(true);
  const initTimestampRef = useRef(0);
  const loadedContentRef = useRef({ title: '', content: '', folderId: 'unfiled' });

  const isLocked = !!existing?.locked;
  const isTrashed = !!existing?.trashedAt;
  const isPrivate = !!existing?.isPrivate;

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ message: '', visible: false }), 1600);
  };

  // Init from route
  useEffect(() => {
    if (isNew || !id) {
      setTitle('');
      setContent('');
      setFolderId('unfiled');
      isFirstLoadRef.current = true;
      return;
    }

    if (!existing) return;
    setTitle(existing.title ?? '');
    setContent(existing.content ?? '');
    setFolderId(existing.folderId ?? 'unfiled');
    loadedContentRef.current = { title: existing.title ?? '', content: existing.content ?? '', folderId: existing.folderId ?? 'unfiled' };
    isFirstLoadRef.current = true;
    initTimestampRef.current = TimeService.realNow();
  }, [existing, id, isNew]);

  // 新建笔记页：进入后默认聚焦内容区并弹出键盘
  useEffect(() => {
    if (!isNew) return;
    const t = setTimeout(() => {
      contentTextareaRef.current?.focus();
      KeyboardService.show();
    }, 100);
    return () => clearTimeout(t);
  }, [isNew]);

  // 收起键盘时失去焦点
  const prevKeyboardVisible = useRef(keyboardVisible);
  useEffect(() => {
    if (prevKeyboardVisible.current && !keyboardVisible) {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    prevKeyboardVisible.current = keyboardVisible;
  }, [keyboardVisible]);

  // Auto-save
  useEffect(() => {
    if (!id) return;
    if (!isNew && isTrashed) return;
    // 跳过初始化阶段的所有 setState 触发（title/content/folderId 分别触发）
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }
    if (TimeService.realNow() - initTimestampRef.current < 200) return;

    // 只有内容实际变化时才保存（避免打开笔记就更新 updatedAt）
    if (!isNew && existing) {
      const loaded = loadedContentRef.current;
      if (title === loaded.title && content === loaded.content && folderId === loaded.folderId) {
        return;
      }
    }

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      const t = title.trim();
      const c = content.trim();

      if (isNew) {
        if (!t && !c) return;
        const created = addNote({ title, content, folderId });
        navigateTo(`/note/${created.id}`, { replace: true });
        return;
      }

      if (!existing) return;
      updateNote(existing.id, { title, content, folderId });
    }, NOTES_CONFIG.autoSaveDelayMs);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [addNote, content, existing, folderId, id, isNew, isTrashed, navigateTo, title, updateNote]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const currentTime = existing?.updatedAt ?? TimeService.now();
  const wordCount = countWords(content);

  const topPad = statusBarHeight;
  const toolbarHeight = 56 + bottomGestureHeight;
  const editorPad = dimens.note_editor_padding;

  const currentFolderName = useMemo(() => {
    const found = folders.find(f => f.id === folderId);
    return found ? getFolderDisplayName(found, s) : s.folder_unfiled;
  }, [folderId, folders, s]);

  const saveNow = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (!isNew && isTrashed) return;
    const t = title.trim();
    const c = content.trim();

    if (isNew) {
      if (!t && !c) return;
      addNote({ title, content, folderId });
      return;
    }

    if (!existing) return;
    // 只有内容实际变化时才保存
    const loaded = loadedContentRef.current;
    if (title === loaded.title && content === loaded.content && folderId === loaded.folderId) return;
    updateNote(existing.id, { title, content, folderId });
  };

  const handleDone = () => {
    saveNow();
    back();
  };

  if (!isNew && id && !existing) {
    return (
      <div className="h-full w-full bg-app-surface flex flex-col">
        <div className="shrink-0 bg-app-surface" style={{ paddingTop: topPad }}>
          <div className="h-12 px-3 flex items-center">
            <button
              {...bindBack()}
              className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            >
              <IcNavBack size={24} className="text-black" />
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-[#9aa0aa]">
          {s.editor_note_not_found}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-app-surface relative flex flex-col overflow-hidden" data-keep-keyboard>
      {/* Top bar (back / undo / redo / done) */}
      <div className="shrink-0 bg-app-surface" style={{ paddingTop: topPad }}>
        <div className="h-12 px-4 flex items-center">
          <button
            onClick={handleDone}
            className="w-10 h-10 -ml-2 flex items-center justify-center active:opacity-70"
            aria-label={s.action_back}
          >
            <IcNavBack size={24} className="text-black" />
          </button>

          <div className="flex-1" />

          {keyboardVisible ? (
            <>
              <button
                onClick={() => showToast(s.toast_undo_dev)}
                className="w-10 h-10 flex items-center justify-center active:opacity-70"
                aria-label={s.action_undo}
              >
                <IcUndo size={22} className="text-[#c8c8c8]" />
              </button>
              <button
                onClick={() => showToast(s.toast_redo_dev)}
                className="w-10 h-10 flex items-center justify-center active:opacity-70"
                aria-label={s.action_redo}
              >
                <IcRedo size={22} className="text-[#c8c8c8]" />
              </button>
              <button
                onClick={handleDone}
                className="w-10 h-10 -mr-1 flex items-center justify-center active:opacity-70"
                aria-label={s.action_done}
              >
                <IcCheck size={26} className="text-black" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => showToast(s.toast_share_dev)}
                className="w-10 h-10 flex items-center justify-center active:opacity-70"
                aria-label={s.action_share}
              >
                <IcShare size={22} className="text-black" />
              </button>
              <button
                onClick={() => showToast(s.toast_drawing_board_dev)}
                className="w-10 h-10 flex items-center justify-center active:opacity-70"
                aria-label={s.action_drawing_board}
              >
                <IcDrawingBoard size={22} className="text-black" />
              </button>
              <button
                onClick={() => existing && setMenuOpen(true)}
                className="w-10 h-10 -mr-1 flex items-center justify-center active:opacity-70"
                aria-label={s.action_more}
              >
                <IcMoreVert size={22} className="text-black" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: toolbarHeight + 18 }}>
        <div className="pt-2" style={{ paddingLeft: editorPad, paddingRight: editorPad }}>
          {existing && isTrashed ? (
            <div className="mb-3 rounded-[14px] px-4 py-3" style={{ backgroundColor: '#fff4d6' }}>
              <div className="text-[13px] text-black">{s.editor_trash_banner}</div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="h-9 px-4 rounded-[14px] bg-app-surface text-[14px] active:opacity-80"
                  onClick={() => {
                    restoreNote(existing.id);
                    showToast(s.toast_restored);
                  }}
                >
                  {s.action_restore}
                </button>
                <button
                  className="h-9 px-4 rounded-[14px] bg-app-surface text-[14px] text-[#ff3b30] active:opacity-80"
                  onClick={() => {
                    const ok = window.confirm(s.confirm_permanent_delete);
                    if (!ok) return;
                    deleteNoteForever(existing.id);
                    go('trash.open', {}, { mode: 'replace' });
                  }}
                >
                  {s.action_permanent_delete}
                </button>
              </div>
            </div>
          ) : null}

          {/* Folder indicator (from note_edit_folder_layout.xml) */}
          <div className="mt-1 mb-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 h-[36px] rounded-[12px] active:opacity-80"
              style={{
                backgroundColor: colors.page_bg,
                border: `0.5px solid ${colors.hairline_border}`,
              }}
              onClick={() => {
                if (existing && isTrashed) return;
                setFolderPickerOpen(true);
              }}
              aria-label={s.folders}
            >
              <span className="ml-4 mr-1">
                <IcFolderIndicator size={15} />
              </span>
              <span
                className="text-[12px] max-w-[200px] truncate"
                style={{ color: colors.text_secondary_strong }}
              >
                {currentFolderName}
              </span>
              <span className="mr-4" />
            </button>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={s.editor_title_placeholder}
            className="w-full font-semibold text-black placeholder:text-[#cccccc] outline-none"
            style={{
              fontSize: dimens.note_editor_title_size,
              lineHeight: '30px',
            }}
            disabled={!!existing && isTrashed}
          />

          <div className="mt-2 text-[12px] flex items-center gap-2" style={{ color: colors.text_secondary }}>
            <span>{formatHeaderTime(currentTime, s)}</span>
            {settings.showWordCount ? (
              <>
                <span className="opacity-70">|</span>
                <span>{wordCount}{s.editor_word_count_suffix}</span>
              </>
            ) : null}
            {existing && typeof existing.alarmAt === 'number' ? (
              <>
                <span className="opacity-70">|</span>
                <span>{s.alarm_label_prefix}{formatHeaderTime(existing.alarmAt, s)}</span>
              </>
            ) : null}
            {existing && isPrivate ? (
              <>
                <span className="opacity-70">|</span>
                <span>{s.label_private}</span>
              </>
            ) : null}
            {isLocked ? (
              <span className="ml-1 inline-flex items-center" aria-label={s.label_encrypted}>
                <IcNoteLock size={14} color={colors.text_secondary} />
              </span>
            ) : null}
          </div>

          <div className="mt-2 relative">
            {content.trim().length === 0 ? (
              <div
                className="absolute inset-0 flex items-baseline gap-2 pointer-events-none"
                style={{ zIndex: 1, paddingTop: 12, fontSize: 16, lineHeight: '26px', fontFamily: 'inherit' }}
              >
                <span className="text-[#d7d7d7] text-[16px] leading-[26px]">{s.editor_start_writing}</span>
                <button
                  type="button"
                  onClick={() => showToast(s.toast_mind_note_dev)}
                  className="pointer-events-auto inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#fff2d7] text-[#f6c444] text-[14px] font-medium active:opacity-80"
                >
                  {s.editor_create_mind_note}
                </button>
              </div>
            ) : null}
            <textarea
              ref={contentTextareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[520px] outline-none resize-none border-0 bg-transparent"
              style={{
                color: 'rgba(0,0,0,0.87)',
                paddingTop: 12,
                paddingLeft: 0,
                fontSize: 16,
                lineHeight: '26px',
                fontFamily: 'inherit',
              }}
              disabled={!!existing && isTrashed}
            />
          </div>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="absolute left-0 right-0 bottom-0 z-30 bg-app-surface border-t border-black/5">
        <div className="flex items-center justify-around" style={{ height: toolbarHeight, paddingBottom: bottomGestureHeight }}>
          <button
            onClick={() => showToast(s.toast_handwrite_dev)}
            className="w-11 h-11 flex items-center justify-center active:opacity-60"
            aria-label={s.toolbar_handwrite}
          >
            <IcEdit size={22} className="text-[#c8c8c8]" />
          </button>
          <button
            onClick={() => showToast(s.toast_recording_dev)}
            className="w-11 h-11 flex items-center justify-center active:opacity-60"
            aria-label={s.toolbar_recording}
          >
            <IcMic size={22} className="text-[#c8c8c8]" />
          </button>
          <button
            onClick={() => showToast(s.toast_image_dev)}
            className="w-11 h-11 flex items-center justify-center active:opacity-60"
            aria-label={s.toolbar_image}
          >
            <IcImage size={22} className="text-[#c8c8c8]" />
          </button>
          <button
            onClick={() => showToast(s.toast_doodle_dev)}
            className="w-11 h-11 flex items-center justify-center active:opacity-60"
            aria-label={s.toolbar_doodle}
          >
            <IcPenTool size={22} className="text-[#c8c8c8]" />
          </button>
          <button
            onClick={() => showToast(s.toast_checklist_dev)}
            className="w-11 h-11 flex items-center justify-center active:opacity-60"
            aria-label={s.toolbar_checklist}
          >
            <IcCheckBox size={22} className="text-[#c8c8c8]" />
          </button>
          <button
            onClick={() => showToast(s.toast_text_style_dev)}
            className="w-11 h-11 flex items-center justify-center active:opacity-60"
            aria-label={s.toolbar_text_style}
          >
            <IcTextType size={22} className="text-[#c8c8c8]" />
          </button>
        </div>
      </div>

      <Toast message={toast.message} visible={toast.visible} />

      {/* Folder picker (best-effort from common_folder_list_dialog_fragment.xml) */}
      {folderPickerOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={() => setFolderPickerOpen(false)}
            aria-label={s.action_close}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] overflow-hidden"
            style={{ paddingBottom: bottomGestureHeight + 12 }}
          >
            <div className="px-5 py-4 text-[14px] font-medium text-black">{s.select_folder_title}</div>
            <div className="px-3 pb-4">
              {folders
                .filter(f => f.id !== 'all')
                .map((f) => {
                  const active = f.id === folderId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFolderId(f.id);
                        setFolderPickerOpen(false);
                        showToast(s.toast_moved_to_editor_prefix + getFolderDisplayName(f, s) + s.toast_moved_to_suffix);
                      }}
                      className="w-full flex items-center justify-between px-3 h-12 rounded-[14px] active:bg-black/5"
                    >
                      <div className="text-[15px] text-black">{getFolderDisplayName(f, s)}</div>
                      {active ? <IcCheck size={20} className="text-black" /> : <div className="w-5 h-5" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      ) : null}

      <ActionSheet
        visible={menuOpen && !isNew && !!existing}
        title={s.action_more}
        cancelLabel={s.action_cancel}
        onClose={() => setMenuOpen(false)}
        items={
          !existing
            ? []
            : isTrashed
              ? [
                  {
                    key: 'restore',
                    label: s.action_restore,
                    onClick: () => {
                      restoreNote(existing.id);
                      setMenuOpen(false);
                      showToast(s.toast_restored);
                    },
                  },
                  {
                    key: 'delete_forever',
                    label: s.action_permanent_delete,
                    danger: true,
                    onClick: () => {
                      const ok = window.confirm(s.confirm_permanent_delete);
                      if (!ok) return;
                      deleteNoteForever(existing.id);
                      setMenuOpen(false);
                      go('trash.open', {}, { mode: 'replace' });
                    },
                  },
                ]
              : [
                  {
                    key: 'alarm',
                    label: s.action_set_reminder,
                    onClick: () => {
                      setMenuOpen(false);
                      setReminderOpen(true);
                    },
                  },
                  {
                    key: 'hide',
                    label: isPrivate ? s.action_unset_private : s.action_set_private,
                    onClick: () => {
                      if (isPrivate) unhideNote(existing.id);
                      else hideNote(existing.id);
                      setMenuOpen(false);
                      showToast(isPrivate ? s.toast_unset_private : s.toast_set_private);
                      if (!isPrivate) go('private.open', {}, { mode: 'replace' });
                    },
                  },
                  {
                    key: 'send_to_desktop',
                    label: s.action_send_to_desktop,
                    onClick: () => {
                      setMenuOpen(false);
                      showToast(s.toast_send_desktop_dev);
                    },
                  },
                  {
                    key: 'move_to',
                    label: s.action_move_to,
                    onClick: () => {
                      setMenuOpen(false);
                      setFolderPickerOpen(true);
                    },
                  },
                  {
                    key: 'delete',
                    label: s.action_delete,
                    danger: true,
                    onClick: () => {
                      deleteNote(existing.id);
                      setMenuOpen(false);
                      showToast(s.toast_moved_to_trash);
                      back();
                    },
                  },
                ]
        }
      />

      {reminderOpen && existing && !isTrashed ? (
        <DateTimeDialog
          title={s.action_set_reminder}
          initialTimestamp={existing.alarmAt}
          onCancel={() => setReminderOpen(false)}
          onConfirm={(ts) => {
            updateNote(existing.id, { alarmAt: ts });
            setReminderOpen(false);
            showToast(s.toast_reminder_set);
          }}
          onClear={
            typeof existing.alarmAt === 'number'
              ? () => {
                  updateNote(existing.id, { alarmAt: undefined });
                  setReminderOpen(false);
                  showToast(s.toast_reminder_cleared);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
};

export default NoteEditorPage;

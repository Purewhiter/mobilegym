import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IcSettings, IcDelete, IcCheck, IcSearch } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import { BottomTabBar } from '../components/BottomTabBar';
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore } from '../state';
import { IcFab } from '../res/icons';
import { colors } from '../res/colors';
import { dimens } from '../res/dimens';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { normalizeTodoText, partitionVisibleTodos } from './todoListModel';

const ACTION_WIDTH = 88;

const DRAG_THRESHOLD_PX = 8;

const SwipeTodoItem: React.FC<{
  id: string;
  text: string;
  completed: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ id, text, completed, open, setOpen, onToggle, onDelete }) => {
  const s = useAppStrings(strings, stringsEn);
  const startXRef = useRef<number | null>(null);
  const baseOffsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const draggingRef = useRef(false);
  const capturedRef = useRef(false);

  useEffect(() => {
    // Snap when external open state changes
    setOffset(open ? -ACTION_WIDTH : 0);
  }, [open]);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="relative mb-3" style={{ touchAction: 'pan-y' }}>
      {/* Actions (underneath) */}
      <div className="absolute inset-0 rounded-[16px] overflow-hidden">
        <div className="h-full w-full flex items-stretch justify-end">
          <button
            className="h-full w-[88px] bg-[#ff3b30] text-white flex items-center justify-center active:opacity-90"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            aria-label={s.action_delete}
          >
            <IcDelete size={18} />
          </button>
        </div>
      </div>

      {/* Content (swipeable) */}
      <div
        className="relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: draggingRef.current ? 'none' : 'transform 160ms ease',
        }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          capturedRef.current = false;
          startXRef.current = e.clientX;
          baseOffsetRef.current = open ? -ACTION_WIDTH : 0;
        }}
        onPointerMove={(e) => {
          if (startXRef.current == null) return;
          const dx = e.clientX - startXRef.current;
          if (!capturedRef.current && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
            capturedRef.current = true;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          }
          if (capturedRef.current) {
            const next = clamp(baseOffsetRef.current + dx, -ACTION_WIDTH, 0);
            setOffset(next);
          }
        }}
        onPointerUp={() => {
          if (capturedRef.current) {
            setOpen(offset < -ACTION_WIDTH / 2);
          }
          draggingRef.current = false;
          capturedRef.current = false;
          startXRef.current = null;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          capturedRef.current = false;
          startXRef.current = null;
          setOpen(open);
        }}
      >
        <div
          key={id}
          onClick={() => {
            if (open) setOpen(false);
          }}
          className={[
            'w-full text-left rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]',
            completed ? 'bg-gray-100' : 'bg-app-surface',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (open) {
                  setOpen(false);
                  return;
                }
                onToggle();
              }}
              aria-label={completed ? s.action_uncheck_todo : s.action_check_todo}
              aria-pressed={completed}
              className={[
                'w-6 h-6 rounded-md border flex items-center justify-center shrink-0 active:scale-95 transition-transform',
                completed ? 'border-gray-400 bg-gray-400' : 'border-[#d9d9d9] bg-app-surface',
              ].join(' ')}
            >
              {completed ? (
                <IcCheck size={14} strokeWidth={2.5} className="text-white" aria-hidden />
              ) : null}
            </button>
            <div
              className={[
                'flex-1 text-[16px] min-w-0',
                completed ? 'text-gray-500 line-through' : 'text-black',
              ].join(' ')}
            >
              {text}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditingTodoItem: React.FC<{
  value: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onBlur: () => void;
  onCancel: () => void;
  onCommit: () => void;
}> = ({ value, placeholder, inputRef, onChange, onBlur, onCancel, onCommit }) => (
  <div className="mb-3 bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-md border border-[#d9d9d9] bg-app-surface shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 text-[16px] text-black placeholder:text-[#c8c8c8] outline-none"
      />
    </div>
  </div>
);

export const TodoListPage: React.FC = () => {
  const { go } = useNotesGestures();
  const { todos, addTodo, toggleTodo, deleteTodo, updateTodoText } = useNotesStore(
    useShallow(s => ({
      todos: s.todos,
      addTodo: s.addTodo,
      toggleTodo: s.toggleTodo,
      deleteTodo: s.deleteTodo,
      updateTodoText: s.updateTodoText,
    }))
  );
  const s = useAppStrings(strings, stringsEn);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const [query, setQuery] = useState('');

  const topPad = statusBarHeight + 18;
  const tabBarHeight = 64 + bottomGestureHeight;
  const fabBottom = tabBarHeight + dimens.fab_margin;

  useEffect(() => {
    if (!isAdding) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isAdding, editingId]);

  const { incomplete, completed } = useMemo(() => {
    return partitionVisibleTodos(todos, query, editingId);
  }, [todos, query, editingId]);

  const handleDraftChange = (text: string) => {
    setDraft(text);
    const normalized = normalizeTodoText(text);
    if (editingId == null) {
      if (normalized) {
        const created = addTodo(normalized);
        setEditingId(created.id);
      }
    } else {
      updateTodoText(editingId, normalized);
    }
  };

  const commitDraft = () => {
    const normalized = normalizeTodoText(draft);
    if (editingId != null) {
      if (!normalized) {
        deleteTodo(editingId);
      } else {
        updateTodoText(editingId, normalized);
      }
    }
    setEditingId(null);
    setDraft('');
    setIsAdding(false);
  };

  const cancelDraft = () => {
    if (editingId != null) {
      deleteTodo(editingId);
    }
    setEditingId(null);
    setDraft('');
    setIsAdding(false);
  };

  return (
    <div
      className="h-full w-full relative flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.page_bg }}
    >
      {/* Header */}
      <div className="shrink-0" style={{ paddingTop: topPad, backgroundColor: colors.page_bg }}>
        <div className="px-5">
          <div className="flex justify-end items-center gap-3">
            <button
              className="w-10 h-10 flex items-center justify-center active:opacity-70"
              onClick={() => {
                go('settings.open');
              }}
              aria-label={s.settings}
            >
              <IcSettings size={22} className="text-black" />
            </button>
          </div>
          <div className="mt-3 text-[36px] leading-none font-medium text-black tracking-tight">{s.todo}</div>
          <div className="mt-4 relative">
            <IcSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bdbdbd]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.todo_search_placeholder}
              className="w-full h-10 bg-[#ededed] rounded-[14px] pl-11 pr-4 text-[15px] text-black placeholder:text-[#bdbdbd] outline-none"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: tabBarHeight + 28 }}>
        <div className="pt-2">
          {isAdding && editingId == null ? (
            <EditingTodoItem
              value={draft}
              placeholder={s.todo_input_placeholder}
              inputRef={inputRef}
              onChange={handleDraftChange}
              onBlur={commitDraft}
              onCancel={cancelDraft}
              onCommit={commitDraft}
            />
          ) : null}

          {incomplete.map((t) => (
            t.id === editingId ? (
              <EditingTodoItem
                key={t.id}
                value={draft}
                placeholder={s.todo_input_placeholder}
                inputRef={inputRef}
                onChange={handleDraftChange}
                onBlur={commitDraft}
                onCancel={cancelDraft}
                onCommit={commitDraft}
              />
            ) : (
              <SwipeTodoItem
                key={t.id}
                id={t.id}
                text={t.text}
                completed={false}
                open={openId === t.id}
                setOpen={(open) => setOpenId(open ? t.id : null)}
                onToggle={() => toggleTodo(t.id)}
                onDelete={() => deleteTodo(t.id)}
              />
            )
          ))}

          {completed.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setCompletedCollapsed(c => !c)}
                className="w-full text-left py-3 flex items-center justify-between text-[14px] text-gray-500 active:opacity-70"
                aria-expanded={!completedCollapsed}
              >
                <span>{s.todo_completed_section} {completed.length}</span>
                <span
                  className={[
                    'inline-block transition-transform',
                    completedCollapsed ? '' : 'rotate-180',
                  ].join(' ')}
                  aria-hidden
                >
                  ▼
                </span>
              </button>
              {!completedCollapsed
                ? completed.map((t) => (
                    <SwipeTodoItem
                      key={t.id}
                      id={t.id}
                      text={t.text}
                      completed
                      open={openId === t.id}
                      setOpen={(open) => setOpenId(open ? t.id : null)}
                      onToggle={() => toggleTodo(t.id)}
                      onDelete={() => deleteTodo(t.id)}
                    />
                  ))
                : null}
            </>
          ) : null}

          {/* Empty state spacing */}
          {incomplete.length === 0 && completed.length === 0 && !(isAdding && editingId == null) ? (
            <div className="h-[60vh] flex items-center justify-center text-[#c8c8c8] text-[14px]">
              {s.empty_todo}
            </div>
          ) : null}
        </div>
      </div>

      {/* Floating action button */}
      <button
        onClick={() => {
          if (isAdding) return;
          setIsAdding(true);
          setDraft('');
          setEditingId(null);
          setOpenId(null);
        }}
        className="absolute rounded-full text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
        style={{
          bottom: fabBottom,
          right: dimens.fab_margin,
          width: dimens.fab_size,
          height: dimens.fab_size,
          backgroundColor: colors.theme_main,
        }}
        aria-label={s.action_new_todo}
      >
        <IcFab size={30} />
      </button>

      <BottomTabBar active="todo" />
    </div>
  );
};

export default TodoListPage;

import { useRedNoteStrings } from '../hooks/useRedNoteStrings';
import React from 'react';
import { useRedNoteStore } from '../state';
import { useNotesByIds, useUserById } from '../data/view';
import { useShallow } from 'zustand/react/shallow';
import { IcNavBack, IcDelete } from '../res/icons';
const ChevronLeft = IcNavBack, Trash2 = IcDelete;
import { useRedNoteGestures } from '../hooks/useRedNoteGestures';
import { Note } from '../types';

const HistoryCard: React.FC<{ note: Note }> = ({ note }) => {
  const s = useRedNoteStrings();
  const { bindTap } = useRedNoteGestures();
  const author = useUserById(note.authorId).data;
  return (
    <div
      className="bg-app-surface rounded-lg overflow-hidden shadow-sm border border-gray-100"
      {...bindTap('note.open', { params: { id: note.id } })}
    >
      <div className="aspect-[3/4] relative">
        <img src={note.images[0]} className="w-full h-full object-cover" />
      </div>
      <div className="p-2">
        <div className="text-sm font-medium line-clamp-2 mb-2">{note.title}</div>
        <div className="flex items-center gap-2">
          <img src={author?.avatar || ''} className="w-4 h-4 rounded-full" />
          <span className="text-xs text-gray-500 truncate">{author?.name || s.unknown}</span>
        </div>
      </div>
    </div>
  );
};

export const HistoryPage: React.FC = () => {
  const s = useRedNoteStrings();
  const { history, clearHistory } = useRedNoteStore(useShallow(s => ({ history: s.history, clearHistory: s.clearHistory })));
  const { bindBack } = useRedNoteGestures();
  const { data: notes } = useNotesByIds(history);

  return (
    <div className="h-full flex flex-col bg-app-surface">
      <div className="pt-10 px-4 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-app-surface z-10">
        <div className="flex items-center gap-2">
            <div className="active:opacity-60" {...bindBack()}>
              <ChevronLeft size={24} />
            </div>
            <span className="font-medium text-lg">{s.history}</span>
        </div>
        <Trash2 size={20} className="text-gray-500" onClick={clearHistory} />
      </div>
      <div
        className="flex-1 overflow-y-auto p-2"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="grid grid-cols-2 gap-2">
            {notes.map(note => <HistoryCard key={note.id} note={note} />)}
        </div>
        {notes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                {s.no_browsing_history}
            </div>
        )}
      </div>
    </div>
  );
};

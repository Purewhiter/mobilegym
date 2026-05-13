import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React from 'react';
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { useShallow } from 'zustand/react/shallow';
import { IcNavBack, IcDelete } from '../res/icons';
const ChevronLeft = IcNavBack, Trash2 = IcDelete;
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { Note } from '../types';
export const HistoryPage: React.FC = () => {
  const s = useRedBookStrings();
  const { history, clearHistory } = useRedBookStore(useShallow(s => ({ history: s.history, clearHistory: s.clearHistory })));
  const view = useRedBookView();
  const { bindTap, bindBack } = useRedBookGestures();
  const notes = React.useMemo(
    () => history.map(id => view.notesById[id]).filter((n): n is Note => Boolean(n)),
    [history, view.notesById],
  );
  const getAuthor = (note: Note) => view.usersById[note.authorId];

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
            {notes.map((note) => (
                <div
                    key={note.id}
                    className="bg-app-surface rounded-lg overflow-hidden shadow-sm border border-gray-100"
                    {...bindTap('note.open', { params: { id: note.id } })}
                >
                    <div className="aspect-[3/4] relative">
                        <img src={note.images[0]} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2">
                        <div className="text-sm font-medium line-clamp-2 mb-2">{note.title}</div>
                        <div className="flex items-center gap-2">
                            <img src={getAuthor(note)?.avatar || ''} className="w-4 h-4 rounded-full" />
                            <span className="text-xs text-gray-500 truncate">{getAuthor(note)?.name || s.unknown}</span>
                        </div>
                    </div>
                </div>
            ))}
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

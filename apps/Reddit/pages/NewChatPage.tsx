import React from 'react';
import { IcSearch, IcNavBack } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';

export const NewChatPage: React.FC = () => {
  const { bindBack } = useRedditGestures();
  const [query, setQuery] = React.useState('');
  const canCreate = query.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 border-b border-gray-100">
        <button
          type="button"
          aria-label="Back"
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center active:bg-gray-100"
          {...bindBack()}
        >
          <IcNavBack className="w-6 h-6 text-gray-800" strokeWidth={2} />
        </button>

        <div className="text-[18px] font-bold text-app-text">New chat</div>

        <button
          type="button"
          onClick={() => {}}
          className={`px-4 py-2 rounded-full text-sm font-bold ${
            canCreate ? 'bg-[#0045AC] text-white' : 'bg-gray-200 text-gray-400'
          }`}
        >
          Create
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pt-4">
        <div className="text-[14px] text-gray-600">
          Search for people by username to chat with them.
        </div>

        <div className="mt-3 h-12 rounded-xl bg-gray-100 flex items-center px-3">
          <IcSearch className="w-5 h-5 text-gray-400" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search usernames"
            className="ml-2 flex-1 bg-transparent outline-none text-[16px] text-app-text placeholder-gray-400"
          />
        </div>

        <div className="mt-4 text-[14px] text-app-text-muted">
          Type at least 3 characters to search for username.
        </div>
      </div>
    </div>
  );
};


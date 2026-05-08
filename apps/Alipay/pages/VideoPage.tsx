import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';

export const VideoPage: React.FC = () => {
  const s = useAlipayStrings();
  return (
    <div className="bg-app-bg h-full w-full pt-10 px-4">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      <div className="pt-4 text-center text-gray-500">
        <div className="text-lg font-medium text-gray-800">{s.video}</div>
        <div className="mt-2 text-sm">{s.this_page_is_under_construction}</div>
      </div>
    </div>
  );
};


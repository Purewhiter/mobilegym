import React from 'react';
import TabBar from '../components/TabBar';
import { useEbayStrings } from '../hooks/useEbayStrings';

const InboxPage: React.FC = () => {
  const s = useEbayStrings();
  return (
    <div className="h-full bg-app-surface flex flex-col relative">
       <div className="px-4 py-2 flex items-center justify-between pt-10">
          <h1 className="text-2xl font-bold text-black">{s.inbox_title}</h1>
       </div>
       <div className="flex-1 flex items-center justify-center text-app-text-muted">
           {s.inbox_empty}
       </div>
       <div className="h-20" />
       <TabBar />
    </div>
  );
};

export default InboxPage;

import React from 'react';
import { IcRepost, IcCompose, IcBarChart } from '../res/icons';
import { useXStrings } from '../hooks/useXStrings';

interface XRetweetSheetProps {
  postId: string | null;
  onClose: () => void;
  onRetweet: (postId: string) => void;
  onQuote: (postId: string) => void;
  onViewActivity: (postId: string) => void;
}

export const XRetweetSheet: React.FC<XRetweetSheetProps> = ({
  postId,
  onClose,
  onRetweet,
  onQuote,
  onViewActivity,
}) => {
  const s = useXStrings();

  if (!postId) return null;

  const items = [
    { id: 'retweet', label: s.retweet_sheet_retweet, Icon: IcRepost },
    { id: 'quote', label: s.retweet_sheet_quote, Icon: IcCompose },
    { id: 'analytics', label: s.retweet_sheet_view_activity, Icon: IcBarChart },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white text-black w-full max-w-sm rounded-t-2xl overflow-hidden">
        <div className="p-2 pt-4">
          {items.map(item => (
            <button
              key={item.id}
              className="w-full flex items-center p-4 hover:bg-gray-50 rounded-xl transition-colors text-left"
              onClick={() => {
                if (item.id === 'retweet') {
                  onRetweet(postId);
                } else if (item.id === 'quote') {
                  onQuote(postId);
                } else {
                  onViewActivity(postId);
                }
                onClose();
              }}
            >
              <div className="mr-4 text-gray-600">
                <item.Icon size={24} />
              </div>
              <div className="font-bold text-lg">{item.label}</div>
            </button>
          ))}
        </div>
        <div className="p-2 pt-0">
          <button className="w-full py-3.5 font-bold rounded-full bg-gray-100 active:bg-gray-200 transition-colors" onClick={onClose}>
            {s.common_cancel}
          </button>
        </div>
      </div>
    </div>
  );
};


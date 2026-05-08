import React, { useEffect, useState } from 'react';
import { IcBookmark } from '../res/icons';
import { useXStrings } from '../hooks/useXStrings';

interface BookmarkToastProps {
  visible: boolean;
  onClose: () => void;
}

export const BookmarkToast: React.FC<BookmarkToastProps> = ({ visible, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const s = useXStrings();

  useEffect(() => {
    if (!visible) return;

    setIsAnimating(true);
    const timer = setTimeout(() => {
      setIsAnimating(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose, visible]);

  if (!visible && !isAnimating) return null;

  return (
    <div
      className={`fixed top-4 left-4 right-4 z-[200] flex flex-col items-center transform ${isAnimating ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`}
      style={{ transition: 'all var(--app-duration-medium)' }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-4">
        <div className="flex items-center mb-3">
          <IcBookmark className="text-blue-500 fill-current w-6 h-6 mr-3" />
          <span className="font-bold text-app-text text-base">{s.bookmark_toast_added}</span>
        </div>
        <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2.5 rounded-full transition-colors text-sm">
          {s.bookmark_toast_add_to_folder}
        </button>
      </div>
    </div>
  );
};


import React from 'react';

export const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-lg text-[13px] shadow-lg">
      {message}
    </div>
  );
};

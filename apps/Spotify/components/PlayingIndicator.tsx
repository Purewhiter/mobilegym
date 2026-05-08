import React from 'react';

export const PlayingIndicator: React.FC = () => {
  return (
    <div className="flex items-end gap-[2px] h-3 mb-[2px]">
      <style>{`
        @keyframes bounce-1 {
          0%, 100% { height: 2px; }
          50% { height: 12px; }
        }
        @keyframes bounce-2 {
          0%, 100% { height: 12px; }
          50% { height: 4px; }
        }
        @keyframes bounce-3 {
          0%, 100% { height: 6px; }
          50% { height: 12px; }
        }
        .bar-1 { animation: bounce-1 0.8s infinite ease-in-out; }
        .bar-2 { animation: bounce-2 0.85s infinite ease-in-out; }
        .bar-3 { animation: bounce-3 0.9s infinite ease-in-out; }
      `}</style>
      <div className="w-[3px] bg-app-accent bar-1"></div>
      <div className="w-[3px] bg-app-accent bar-2"></div>
      <div className="w-[3px] bg-app-accent bar-3"></div>
    </div>
  );
};

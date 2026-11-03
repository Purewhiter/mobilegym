import React from 'react';

/** `bind` is the tap binding that flips the value (an action from bindTap). */
export const Switch: React.FC<{ value: boolean; bind: React.HTMLAttributes<HTMLElement> }> = ({ value, bind }) => (
  <button
    {...bind}
    className={`w-11 h-6 rounded-full p-0.5 transition-colors ${value ? 'bg-app-primary' : 'bg-gray-200'}`}
  >
    <div className={`w-5 h-5 rounded-full bg-app-surface shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

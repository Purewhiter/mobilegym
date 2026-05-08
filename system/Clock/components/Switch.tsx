import React from 'react';

export const Switch: React.FC<{ value: boolean; onChange: (value: boolean) => void }> = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className={`w-11 h-6 rounded-full p-0.5 transition-colors ${value ? 'bg-app-primary' : 'bg-gray-200'}`}
  >
    <div className={`w-5 h-5 rounded-full bg-app-surface shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

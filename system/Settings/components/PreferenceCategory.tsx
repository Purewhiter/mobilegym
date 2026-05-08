import React from 'react';

interface PreferenceCategoryProps {
  title?: string;
  children: React.ReactNode;
}

/** A group of preference items rendered as a white card */
export const PreferenceCategory: React.FC<PreferenceCategoryProps> = ({ title, children }) => {
  return (
    <div className="mb-3">
      {title && (
        <div className="px-4 pt-4 pb-1.5 text-[13px] text-app-text-muted font-normal">
          {title}
        </div>
      )}
      <div className="bg-app-surface rounded-2xl overflow-hidden mx-4">
        {children}
      </div>
    </div>
  );
};

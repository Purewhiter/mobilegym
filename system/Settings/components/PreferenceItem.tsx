import React from 'react';
import { IcNavForward } from '../res/icons';
import { SettingsIcon } from './SettingsIcon';
interface PreferenceItemProps {
  title: string;
  summary?: string;
  icon?: string;
  /** Show chevron on the right */
  showChevron?: boolean;
  /** Right-side value text */
  value?: string;
  /** Is this a divider (not the last item) */
  showDivider?: boolean;
  onClick?: () => void;
  itemProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

/** A single preference list item */
export const PreferenceItem: React.FC<PreferenceItemProps> = ({
  title,
  summary,
  icon,
  showChevron = true,
  value,
  showDivider = true,
  onClick,
  itemProps,
  children,
}) => {
  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-(--app-preference-item-min-height)"
        onClick={onClick}
        {...itemProps}
      >
        {icon && (
          <div className="mr-3 flex-shrink-0">
            <SettingsIcon name={icon} size={28} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-app-text leading-tight">{title}</div>
          {summary && (
            <div className="text-[12px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
              {summary}
            </div>
          )}
        </div>
        <div className="flex items-center ml-2 flex-shrink-0">
          {value && (
            <span className="text-[13px] text-gray-400 mr-1">{value}</span>
          )}
          {children}
          {showChevron && !children && (
            <IcNavForward size={16} className="text-gray-300" />
          )}
        </div>
      </div>
      {showDivider && (
        <div className={`h-px bg-gray-100 ${icon ? 'ml-[60px]' : 'ml-4'} mr-4`} />
      )}
    </div>
  );
};

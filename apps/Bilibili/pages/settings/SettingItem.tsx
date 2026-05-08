import React from 'react';
import { IcNavForward } from '../../res/icons';

type SettingItemVariant = 'arrow' | 'switch' | 'value';

/** 带右箭头的设置项（点击进入子页） */
export const SettingItemArrow: React.FC<{
  label: string;
  subtitle?: string;
  triggerId?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}> = ({ label, subtitle, triggerId, onClick, children }) => (
  <div
    className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
    onClick={onClick}
    {...(triggerId ? { 'data-trigger': triggerId, 'data-trigger-type': 'tap' as const } : {})}
  >
    <div className="flex-1 min-w-0">
      <div className="text-[15px] text-gray-900">{label}</div>
      {subtitle != null && subtitle !== '' && (
        <div className="text-[12px] text-gray-400 mt-0.5">{subtitle}</div>
      )}
    </div>
    {children ?? <IcNavForward size={16} className="text-gray-300 flex-shrink-0 ml-2" />}
  </div>
);

/** 带开关的设置项 */
export const SettingItemSwitch: React.FC<{
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  triggerId?: string;
}> = ({ label, subtitle, checked, onChange, triggerId }) => (
  <div
    className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 border-b border-gray-100 last:border-b-0"
    {...(triggerId ? { 'data-trigger': triggerId, 'data-action-type': 'toggle' as const } : {})}
  >
    <div className="flex-1 min-w-0">
      <div className="text-[15px] text-gray-900">{label}</div>
      {subtitle != null && subtitle !== '' && (
        <div className="text-[12px] text-gray-400 mt-0.5">{subtitle}</div>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-2 ${
        checked ? 'bg-[#FB7299]' : 'bg-gray-300'
      }`}
      onClick={() => onChange(!checked)}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  </div>
);

/** 带当前值 + 右箭头的设置项（点击进子页或弹窗） */
export const SettingItemValue: React.FC<{
  label: string;
  subtitle?: string;
  value: string;
  triggerId?: string;
  onClick?: () => void;
}> = ({ label, subtitle, value, triggerId, onClick }) => (
  <div
    className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
    onClick={onClick}
    {...(triggerId ? { 'data-trigger': triggerId, 'data-trigger-type': 'tap' as const } : {})}
  >
    <div className="flex-1 min-w-0">
      <div className="text-[15px] text-gray-900">{label}</div>
      {subtitle != null && subtitle !== '' && (
        <div className="text-[12px] text-gray-400 mt-0.5">{subtitle}</div>
      )}
    </div>
    <span className="text-[14px] text-gray-500 mr-1 truncate max-w-[40%]">{value}</span>
    <IcNavForward size={16} className="text-gray-300 flex-shrink-0" />
  </div>
);

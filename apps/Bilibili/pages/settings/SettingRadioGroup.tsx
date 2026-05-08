import React from 'react';

export type RadioOption = { id: string; label: string; subtitle?: string };

/** 单选列表（每行左侧文案，右侧单选圆点，选中为粉色） */
export const SettingRadioGroup: React.FC<{
  options: RadioOption[];
  value: string;
  onChange: (id: string) => void;
  triggerIdPrefix?: string;
}> = ({ options, value, onChange, triggerIdPrefix }) => (
  <div className="border-t border-gray-100">
    {options.map((opt) => {
      const isSelected = value === opt.id;
      return (
        <div
          key={opt.id}
          className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 cursor-pointer border-b border-gray-100"
          onClick={() => onChange(opt.id)}
          {...(triggerIdPrefix
            ? { 'data-trigger': `${triggerIdPrefix}.${opt.id}`, 'data-trigger-type': 'tap' as const }
            : {})}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[15px] text-gray-900">{opt.label}</div>
            {opt.subtitle != null && opt.subtitle !== '' && (
              <div className="text-[12px] text-gray-400 mt-0.5">{opt.subtitle}</div>
            )}
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
              isSelected ? 'border-[#FB7299] bg-[#FB7299]' : 'border-gray-300'
            }`}
          >
            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </div>
      );
    })}
  </div>
);

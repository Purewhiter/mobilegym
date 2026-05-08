import React from 'react';

export type SheetOption = { id: string; label: string };

/** 底部弹窗：标题 + 选项列表，选中项红色/粉色高亮。由父组件通过 URL/searchParams 控制 open，以便返回键能关闭（pop 历史）。 */
export const SettingBottomSheet: React.FC<{
  title: string;
  options: SheetOption[];
  value: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  open: boolean;
}> = ({ title, options, value, onSelect, onClose, open }) => {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl pt-2 pb-8 max-h-[70vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" />
        <h2 className="text-[17px] font-medium text-gray-900 text-center px-4 pb-3">{title}</h2>
        <div className="border-t border-gray-100">
          {options.map((opt) => {
            const isSelected = value === opt.id;
            return (
              <div
                key={opt.id}
                className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 cursor-pointer border-b border-gray-100"
                onClick={() => {
                  onSelect(opt.id);
                  onClose();
                }}
              >
                <span className={`text-[15px] ${isSelected ? 'text-[#FB7299]' : 'text-gray-900'}`}>
                  {opt.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

import React from 'react';
import { IcDelete, IcExpand } from '../res/icons';
import { useAlipayGestures } from '../hooks/useAlipayGestures';

interface AmountKeyboardProps {
  onInput: (key: string) => void;
  onDelete: () => void;
  confirmLabel: string;
  confirmEnabled?: boolean;
  onConfirm: () => void;
  actionPrefix?: string;
  open: boolean;
  onToggle: (open: boolean) => void;
}

/**
 * 支付宝风格金额输入键盘 — 模拟真实支付宝 App 内部自绘键盘。
 * 4×4 网格：左 3 列数字区 + 右 1 列（删除 + 确认按钮）。
 * 带 data-hide-on-keyboard，系统键盘弹出时自动隐藏。
 * onMouseDown preventDefault 阻止点击按钮时抢夺金额输入框的焦点。
 */
export const AmountKeyboard: React.FC<AmountKeyboardProps> = ({
  onInput,
  onDelete,
  confirmLabel,
  confirmEnabled = true,
  onConfirm,
  actionPrefix = 'amountKeyboard',
  open,
  onToggle,
}) => {
  const { bindTap } = useAlipayGestures();

  const preventFocusSteal = (e: React.MouseEvent) => { e.preventDefault(); };

  const numBtn = (digit: string, extraClassName = '') => (
    <button
      key={digit}
      onMouseDown={preventFocusSteal}
      {...bindTap<HTMLButtonElement>(
        { kind: 'action', id: `${actionPrefix}.keypad.press` },
        { params: { digit }, onTrigger: () => onInput(digit) },
      )}
      className={`bg-white text-[30px] font-normal text-black active:bg-[#F7F7F7] border-r border-b border-[#E8E8E8] ${extraClassName}`}
    >
      {digit}
    </button>
  );

  if (!open) return null;

  return (
    <div
      className="bg-white flex-shrink-0"
      data-hide-on-keyboard
    >
      <button
        onMouseDown={preventFocusSteal}
        {...bindTap<HTMLButtonElement>(
          { kind: 'action', id: `${actionPrefix}.keypad.toggle` },
          { onTrigger: () => onToggle(false) },
        )}
        className="h-9 w-full border-y border-[#E8E8E8] bg-white flex items-center justify-center active:bg-[#F7F7F7]"
      >
        <IcExpand size={16} className="text-[#9CA3AF]" />
      </button>

      <div className="grid grid-cols-4 grid-rows-[repeat(4,64px)] border-l border-t border-[#E8E8E8]">
        {numBtn('1')}
        {numBtn('2')}
        {numBtn('3')}

        <button
          onMouseDown={preventFocusSteal}
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: `${actionPrefix}.keypad.delete` },
            { onTrigger: onDelete },
          )}
          className="bg-white border-r border-b border-[#E8E8E8] flex items-center justify-center active:bg-[#F7F7F7]"
        >
          <IcDelete size={22} className="text-[#444444]" />
        </button>

        {numBtn('4')}
        {numBtn('5')}
        {numBtn('6')}

        <button
          onMouseDown={preventFocusSteal}
          {...(confirmEnabled
            ? bindTap<HTMLButtonElement>(
                { kind: 'action', id: `${actionPrefix}.confirm` },
                { onTrigger: onConfirm },
              )
            : {})}
          className={`row-span-3 border-r border-b border-[#E8E8E8] text-[28px] font-normal transition-colors ${
            confirmEnabled
              ? 'bg-[#1677FF] text-white active:bg-[#0E6AE6]'
              : 'bg-[#D3E9FF] text-white/80'
          }`}
        >
          {confirmLabel}
        </button>

        {numBtn('7')}
        {numBtn('8')}
        {numBtn('9')}

        {numBtn('0', 'col-span-2')}
        {numBtn('.')}
      </div>
    </div>
  );
};

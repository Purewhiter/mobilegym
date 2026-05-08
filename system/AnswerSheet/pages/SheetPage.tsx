import React, { useCallback, useEffect, useRef } from 'react';
import { useAnswerSheetStore } from '../state';
import type { Field } from '../types';
import { strings as S } from '../res/strings';

/** 输入框聚焦时自动滚动到可见区域（等待键盘动画完成） */
const scrollIntoViewOnFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  const el = e.currentTarget;
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
};

// ── 选择型字段 ──
const ChoiceField: React.FC<{
  field: Field;
  index: number;
  value: string | undefined;
  onSelect: (fieldIndex: number, value: string) => void;
}> = ({ field, index, value, onSelect }) => (
  <div className="space-y-2">
    {field.options?.map((option) => (
      <button
        key={option}
        onClick={() => onSelect(index, option)}
        className={`w-full py-3.5 px-4 rounded-xl text-base font-medium text-left transition-all
          ${value === option
            ? 'bg-blue-500 text-white shadow-sm'
            : 'bg-white text-slate-700 border border-slate-200 active:bg-slate-50'
          }`}
      >
        {option}
      </button>
    ))}
  </div>
);

// ── 数字/文本输入字段 ──
const InputField: React.FC<{
  field: Field;
  index: number;
  value: string | undefined;
  onChange: (fieldIndex: number, value: string) => void;
}> = ({ field, index, value, onChange }) => (
  <input
    type="text"
    inputMode={field.type === 'number' ? 'decimal' : 'text'}
    value={value ?? ''}
    onChange={(e) => onChange(index, e.target.value)}
    onFocus={scrollIntoViewOnFocus}
    placeholder={field.hint || (field.type === 'number' ? S.placeholder_number : S.placeholder_text)}
    className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white
      text-base text-slate-900 placeholder:text-slate-400
      focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
  />
);

// ── 可重复字段 ──
const RepeatableField: React.FC<{
  field: Field;
  index: number;
  values: string[];
  onAdd: (fieldIndex: number) => void;
  onRemove: (fieldIndex: number, itemIndex: number) => void;
  onUpdate: (fieldIndex: number, itemIndex: number, value: string) => void;
}> = ({ field, index, values, onAdd, onRemove, onUpdate }) => {
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const prevLenRef = useRef(values.length);

  useEffect(() => {
    if (values.length > prevLenRef.current) {
      // 新增了项目 → 等布局完成后滚动「添加」按钮可见（新行在其上方）
      requestAnimationFrame(() => {
        addBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    prevLenRef.current = values.length;
  }, [values.length]);

  return (
  <div className="space-y-2">
    {values.map((val, itemIdx) => (
      <div key={itemIdx} className="flex items-center gap-2">
        {field.type === 'choice' && field.options ? (
          <select
            value={val}
            onChange={(e) => onUpdate(index, itemIdx, e.target.value)}
            onFocus={scrollIntoViewOnFocus}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white
              text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">{S.placeholder_select}</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            inputMode={field.type === 'number' ? 'decimal' : 'text'}
            value={val}
            onChange={(e) => onUpdate(index, itemIdx, e.target.value)}
            onFocus={scrollIntoViewOnFocus}
            placeholder={field.hint || S.placeholder_text}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white
              text-base text-slate-900 placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
        <button
          onClick={() => onRemove(index, itemIdx)}
          className="w-10 h-10 flex items-center justify-center rounded-full
            text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors text-lg"
        >
          ✕
        </button>
      </div>
    ))}
    <button ref={addBtnRef}
      onClick={() => onAdd(index)}
      className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-300
        text-slate-500 text-sm font-medium hover:border-blue-400 hover:text-blue-500
        transition-colors active:bg-slate-50"
    >
      {S.add_item}
    </button>
  </div>
  );
};

// ── 主页面 ──
const SheetPage: React.FC = () => {
  const { question, hint, fields, answers, submitted } = useAnswerSheetStore();
  const { setAnswer, addRepeatableItem, removeRepeatableItem,
    updateRepeatableItem, submit, unsubmit } = useAnswerSheetStore();

  const handleChoiceSelect = useCallback((fieldIndex: number, value: string) => {
    setAnswer(fieldIndex, value);
  }, [setAnswer]);

  const handleInputChange = useCallback((fieldIndex: number, value: string) => {
    setAnswer(fieldIndex, value);
  }, [setAnswer]);

  const handleSubmit = useCallback(() => {
    if (submitted) {
      unsubmit();
    } else {
      submit();
    }
  }, [submitted, submit, unsubmit]);

  if (!fields || fields.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-app-bg pt-10 px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-lg text-slate-500">{S.empty_title}</p>
          <p className="text-sm text-slate-400 mt-1">{S.empty_hint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-app-bg pt-10 flex flex-col">
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-900 leading-snug">
          {question || S.default_question}
        </h1>
        {hint && <p className="text-sm text-slate-400 mt-1">{hint}</p>}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4"
        data-scroll-container="sheet-form" data-scroll-direction="vertical">
        <div className="space-y-5">
          {fields.map((field, idx) => {
            const answer = answers[String(idx)];
            return (
              <div key={idx} className="space-y-2">
                <label className="block text-sm font-medium text-slate-600">
                  {field.label}
                </label>
                {field.repeatable ? (
                  <RepeatableField field={field} index={idx}
                    values={Array.isArray(answer) ? answer : []}
                    onAdd={addRepeatableItem} onRemove={removeRepeatableItem}
                    onUpdate={updateRepeatableItem} />
                ) : field.type === 'choice' ? (
                  <ChoiceField field={field} index={idx}
                    value={typeof answer === 'string' ? answer : undefined}
                    onSelect={handleChoiceSelect} />
                ) : (
                  <InputField field={field} index={idx}
                    value={typeof answer === 'string' ? answer : undefined}
                    onChange={handleInputChange} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0 border-t border-slate-100" data-hide-on-keyboard>
        {submitted && (
          <div className="text-center text-green-600 text-sm font-medium mb-3
            flex items-center justify-center gap-1.5">
            <span className="text-lg">✓</span> {S.submitted_label}
          </div>
        )}
        <button onClick={handleSubmit}
          className={`w-full py-3.5 rounded-xl text-base font-semibold transition-all
            active:scale-[0.98] ${submitted
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'}`}>
          {submitted ? S.btn_modify : S.btn_submit}
        </button>
      </div>
    </div>
  );
};

export default SheetPage;

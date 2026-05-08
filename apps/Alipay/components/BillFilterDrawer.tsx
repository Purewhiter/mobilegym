import React from 'react';
import { useLocale } from '@/apps/Alipay/locale';
import { BILL_CATEGORIES, BILL_QUICK_FILTERS } from '../constants';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { IcClose } from '../res/icons';
import type { AlipayBillCategoryId, AlipayBillQuickFilterId } from '../types';
import type { BillFilterValues } from '../utils/bills';
import { localizeBillCategoryName, localizeBillQuickFilterLabel } from '../utils/localizeCatalog';
import { IconRenderer } from './IconRenderer';

type BillFilterDrawerProps = {
  open: boolean;
  initialValues: BillFilterValues;
  onClose: () => void;
  onApply: (values: BillFilterValues) => void;
};

const sanitizeAmountInput = (value: string) => value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

export const BillFilterDrawer: React.FC<BillFilterDrawerProps> = ({
  open,
  initialValues,
  onClose,
  onApply,
}) => {
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const [draft, setDraft] = React.useState<BillFilterValues>(initialValues);

  React.useEffect(() => {
    if (!open) return;
    setDraft(initialValues);
  }, [initialValues, open]);

  if (!open) return null;

  const toggleQuickFilter = (id: AlipayBillQuickFilterId) => {
    setDraft(current => ({
      ...current,
      quickFilter: current.quickFilter === id ? null : id,
    }));
  };

  const toggleCategory = (id: AlipayBillCategoryId) => {
    setDraft(current => ({
      ...current,
      category: current.category === id ? null : id,
    }));
  };

  const resetDraft = () => {
    setDraft({
      quickFilter: null,
      category: null,
      minAmount: '',
      maxAmount: '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35" onClick={onClose}>
      <div className="w-full rounded-t-3xl bg-app-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-gray-900">{s.filter}</div>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400">
            <IcClose size={20} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto no-scrollbar pr-1">
          <div>
            <div className="mb-3 text-[15px] font-semibold text-gray-900">{isEnglish ? 'Quick Filters' : '快捷筛选'}</div>
            <div className="grid grid-cols-3 gap-3">
              {BILL_QUICK_FILTERS.map(item => {
                const selected = draft.quickFilter === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleQuickFilter(item.id)}
                    className={`rounded-xl px-3 py-3 text-sm ${
                      selected
                        ? 'border border-app-primary bg-app-primary/10 font-medium text-app-primary'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {localizeBillQuickFilterLabel(item.id, item.label, isEnglish)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-[15px] font-semibold text-gray-900">{s.amount}</div>
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-white px-3 py-3">
                <span className="mr-2 text-sm text-gray-400">¥</span>
                <input
                  value={draft.minAmount}
                  onChange={event => setDraft(current => ({
                    ...current,
                    minAmount: sanitizeAmountInput(event.target.value),
                  }))}
                  inputMode="decimal"
                  placeholder={s.minimum_amount}
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
              <span className="text-gray-300">-</span>
              <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-white px-3 py-3">
                <span className="mr-2 text-sm text-gray-400">¥</span>
                <input
                  value={draft.maxAmount}
                  onChange={event => setDraft(current => ({
                    ...current,
                    maxAmount: sanitizeAmountInput(event.target.value),
                  }))}
                  inputMode="decimal"
                  placeholder={s.maximum_amount}
                  className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-[15px] font-semibold text-gray-900">{s.category}</div>
            <div className="grid grid-cols-5 gap-x-2 gap-y-4 pb-2">
              {BILL_CATEGORIES.map(item => {
                const selected = draft.category === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleCategory(item.id)}
                    className="flex flex-col items-center justify-start"
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                        selected
                          ? 'border-app-primary bg-app-primary/10 text-app-primary'
                          : 'border-transparent bg-gray-100 text-gray-700'
                      }`}
                    >
                      <IconRenderer name={item.icon} size={20} strokeWidth={1.8} />
                    </div>
                    <span className={`mt-2 text-center text-xs leading-4 ${selected ? 'font-medium text-app-primary' : 'text-gray-700'}`}>
                      {localizeBillCategoryName(item.id, item.name, isEnglish)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={resetDraft}
            className="flex-1 rounded-full border border-gray-200 bg-white py-3 text-base text-gray-600"
          >
            {s.reset}
          </button>
          <button
            onClick={() => onApply(draft)}
            className="flex-1 rounded-full bg-[#2B7CFF] py-3 text-base font-medium text-white"
          >
            {s.confirm_2}
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useLocale } from '@/apps/Alipay/locale';
import * as TimeService from '../../../os/TimeService';
import { BILL_CATEGORIES } from '../constants';
import { IconRenderer } from '../components/IconRenderer';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { IcExpand, IcMore, IcNavBack } from '../res/icons';
import { useAlipayStore } from '../state';
import type { AlipayBillCategoryId, AlipayTransferRecord } from '../types';
import { getBillDisplayTitle, getBillPaymentMethod, inferBillCategory } from '../utils/bills';
import { isBankPaymentMethodLabel, localizeBillCategoryName, splitBankPaymentMethod } from '../utils/localizeCatalog';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CATEGORY_MAP = new Map(BILL_CATEGORIES.map(item => [item.id, item]));
const DONUT_COLORS = ['#1677FF', '#36CFC9', '#FAAD14', '#FF7A45', '#9254DE', '#F759AB', '#52C41A', '#FF4D4F'];

const pad2 = (value: number) => String(value).padStart(2, '0');

type CategoryStat = { id: AlipayBillCategoryId; amount: number; count: number; icon: string; fallbackName: string };
type PaymentStat = { rawName: string; amount: number; count: number };
type PeriodStat = {
  key: string;
  year: number;
  month: number;
  expense: number;
  income: number;
  expenseCount: number;
  incomeCount: number;
  categoryMap: Map<AlipayBillCategoryId, CategoryStat>;
  expenseRecords: AlipayTransferRecord[];
  incomeRecords: AlipayTransferRecord[];
  paymentMethodMap: Map<string, PaymentStat>;
};

const emptyPeriodStat = (year: number, month: number, key: string): PeriodStat => ({
  key,
  year,
  month,
  expense: 0,
  income: 0,
  expenseCount: 0,
  incomeCount: 0,
  categoryMap: new Map(),
  expenseRecords: [],
  incomeRecords: [],
  paymentMethodMap: new Map(),
});

const monthName = (month: number, isEnglish: boolean) => (isEnglish ? (MONTHS_EN[month - 1] ?? String(month)) : `${month}月`);
const pickerMonth = (month: number, isEnglish: boolean) => (isEnglish ? (MONTHS_EN[month - 1] ?? String(month)) : month);
const periodLabel = (year: number, month: number, yearly: boolean, isEnglish: boolean) => (
  yearly ? (isEnglish ? `${year}` : `${year}年`) : (isEnglish ? `${monthName(month, true)} ${year}` : `${year}年${month}月`)
);

const buildStats = (records: AlipayTransferRecord[]) => {
  const map = new Map<string, PeriodStat>();
  for (const record of records) {
    if ((record.timestamp || 0) > TimeService.now()) continue;
    const date = TimeService.fromTimestamp(record.timestamp || 0);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${pad2(month)}`;
    if (!map.has(key)) map.set(key, emptyPeriodStat(year, month, key));
    const stat = map.get(key)!;
    const value = Number(record.delta) || 0;
    const categoryId = inferBillCategory(record);
    const categoryInfo = CATEGORY_MAP.get(categoryId);
    if (value < 0) {
      stat.expense += Math.abs(value);
      stat.expenseCount += 1;
      stat.expenseRecords.push(record);
      const existingCategory = stat.categoryMap.get(categoryId) || {
        id: categoryId,
        amount: 0,
        count: 0,
        icon: categoryInfo?.icon || 'IcGrid',
        fallbackName: categoryInfo?.name || '其他',
      };
      existingCategory.amount += Math.abs(value);
      existingCategory.count += 1;
      stat.categoryMap.set(categoryId, existingCategory);
      const rawMethod = getBillPaymentMethod(record, false) || '余额';
      const existingMethod = stat.paymentMethodMap.get(rawMethod) || { rawName: rawMethod, amount: 0, count: 0 };
      existingMethod.amount += Math.abs(value);
      existingMethod.count += 1;
      stat.paymentMethodMap.set(rawMethod, existingMethod);
    } else if (value > 0) {
      stat.income += value;
      stat.incomeCount += 1;
      stat.incomeRecords.push(record);
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
};

const DonutChart: React.FC<{ items: { pct: number; color: string; label: string }[] }> = ({ items }) => {
  const size = 220;
  const center = size / 2;
  const radius = 56;
  const stroke = 24;
  let sum = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[220px]">
      {items.length === 0 && <circle cx={center} cy={center} r={radius} fill="none" stroke="#eef2ff" strokeWidth={stroke} />}
      {items.map(item => {
        const start = sum * 360 - 90;
        sum += item.pct;
        const end = sum * 360 - 90;
        const largeArc = item.pct > 0.5 ? 1 : 0;
        const x1 = center + radius * Math.cos((start * Math.PI) / 180);
        const y1 = center + radius * Math.sin((start * Math.PI) / 180);
        const x2 = center + radius * Math.cos((end * Math.PI) / 180);
        const y2 = center + radius * Math.sin((end * Math.PI) / 180);
        return (
          <path
            key={`${item.label}-${item.color}`}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={item.color}
            strokeWidth={stroke}
          />
        );
      })}
    </svg>
  );
};

const BarChart: React.FC<{ bars: { label: string; value: number; highlight?: boolean; note?: string }[] }> = ({ bars }) => {
  const max = Math.max(...bars.map(item => item.value), 1);
  return (
    <div className="flex items-end gap-3 px-2" style={{ minHeight: 150 }}>
      {bars.map(bar => (
        <div key={bar.label} className="flex flex-1 flex-col items-center">
          <div className={`mb-1 text-[10px] ${bar.highlight ? 'font-medium text-[#E55B44]' : 'text-gray-400'}`}>
            ¥{bar.value.toFixed(0)}
          </div>
          <div className="w-full max-w-[28px] rounded-t bg-[#DDE9FF]" style={{ height: Math.max(4, (bar.value / max) * 96), backgroundColor: bar.highlight ? '#1677FF' : '#DDE9FF' }} />
          <div className={`mt-1 text-[10px] ${bar.highlight ? 'font-bold text-[#1677FF]' : 'text-gray-400'}`}>{bar.label}</div>
          <div className="h-3 text-[9px] text-gray-300">{bar.note || ''}</div>
        </div>
      ))}
    </div>
  );
};

export const BillAnalysisPage: React.FC = () => {
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const { bindBack } = useAlipayGestures();
  const transferRecords = useAlipayStore(state => state.transferRecords);
  const now = TimeService.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [tab, setTab] = React.useState<'monthly' | 'yearly'>('monthly');
  const [direction, setDirection] = React.useState<'expense' | 'income'>('expense');
  const [expandCategories, setExpandCategories] = React.useState(false);
  const [expandRanking, setExpandRanking] = React.useState(false);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);
  const yearRef = React.useRef<HTMLDivElement>(null);
  const monthRef = React.useRef<HTMLDivElement>(null);
  const yearOptions = React.useMemo(() => [2024, 2025, 2026], []);
  const monthOptions = React.useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);

  React.useEffect(() => {
    if (!isPickerOpen) return;
    requestAnimationFrame(() => {
      yearRef.current?.scrollTo({ top: Math.max(0, yearOptions.indexOf(selectedYear)) * 36 });
      monthRef.current?.scrollTo({ top: Math.max(0, monthOptions.indexOf(selectedMonth)) * 36 });
    });
  }, [isPickerOpen, monthOptions, selectedMonth, selectedYear, yearOptions]);

  const allStats = React.useMemo(() => buildStats(transferRecords), [transferRecords]);
  const yearly = tab === 'yearly';
  const monthKey = `${selectedYear}-${pad2(selectedMonth)}`;
  const monthlyStat = allStats.find(item => item.key === monthKey) || emptyPeriodStat(selectedYear, selectedMonth, monthKey);
  const yearlyStat = React.useMemo(() => {
    const base = emptyPeriodStat(selectedYear, 1, `${selectedYear}`);
    for (const stat of allStats.filter(item => item.year === selectedYear)) {
      base.expense += stat.expense;
      base.income += stat.income;
      base.expenseCount += stat.expenseCount;
      base.incomeCount += stat.incomeCount;
      base.expenseRecords.push(...stat.expenseRecords);
      base.incomeRecords.push(...stat.incomeRecords);
      for (const [id, category] of stat.categoryMap) {
        const current = base.categoryMap.get(id) || { ...category, amount: 0, count: 0 };
        current.amount += category.amount;
        current.count += category.count;
        base.categoryMap.set(id, current);
      }
      for (const [key, method] of stat.paymentMethodMap) {
        const current = base.paymentMethodMap.get(key) || { ...method, amount: 0, count: 0 };
        current.amount += method.amount;
        current.count += method.count;
        base.paymentMethodMap.set(key, current);
      }
    }
    return base;
  }, [allStats, selectedYear]);

  const active = yearly ? yearlyStat : monthlyStat;
  const totalAmount = direction === 'expense' ? active.expense : active.income;
  const totalCount = direction === 'expense' ? active.expenseCount : active.incomeCount;
  const categoryStats = React.useMemo(() => (
    direction === 'income'
      ? []
      : Array.from(active.categoryMap.values()).sort((a, b) => b.amount - a.amount)
  ), [active.categoryMap, direction]);
  const rankingRecords = React.useMemo(() => {
    const source = direction === 'expense'
      ? [...active.expenseRecords].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      : [...active.incomeRecords].sort((a, b) => b.delta - a.delta);
    return source;
  }, [active.expenseRecords, active.incomeRecords, direction]);
  const top3Pct = totalAmount > 0
    ? ((rankingRecords.slice(0, 3).reduce((sum, item) => sum + Math.abs(item.delta), 0) / totalAmount) * 100).toFixed(1)
    : '0';
  const paymentStats = React.useMemo(() => (
    Array.from(active.paymentMethodMap.values()).filter(item => isBankPaymentMethodLabel(item.rawName)).sort((a, b) => b.amount - a.amount)
  ), [active.paymentMethodMap]);
  const summaryText = yearly
    ? (direction === 'expense' ? s.bill_analysis_yearly_expense : s.bill_analysis_yearly_income)
    : (direction === 'expense' ? s.bill_analysis_monthly_expense : s.bill_analysis_monthly_income);
  const rankingTitle = direction === 'expense' ? s.bill_analysis_expense_ranking : s.bill_analysis_income_ranking;
  const rankingHintTemplate = direction === 'expense'
    ? (yearly ? s.bill_analysis_expense_ranking_hint_yearly : s.bill_analysis_expense_ranking_hint_monthly)
    : (yearly ? s.bill_analysis_income_ranking_hint_yearly : s.bill_analysis_income_ranking_hint_monthly);
  const compareTitle = direction === 'expense' ? s.bill_analysis_expense_compare : s.bill_analysis_income_compare;

  const recentBars = React.useMemo(() => {
    if (yearly) {
      return Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const key = `${selectedYear}-${pad2(month)}`;
        const stat = allStats.find(item => item.key === key);
        return {
          label: monthName(month, isEnglish),
          value: direction === 'expense' ? (stat?.expense || 0) : (stat?.income || 0),
          highlight: month === selectedMonth,
        };
      });
    }
    return Array.from({ length: 6 }, (_, index) => {
      let year = currentYear;
      let month = currentMonth - (5 - index);
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      const stat = allStats.find(item => item.key === `${year}-${pad2(month)}`);
      return {
        label: monthName(month, isEnglish),
        value: direction === 'expense' ? (stat?.expense || 0) : (stat?.income || 0),
        highlight: year === selectedYear && month === selectedMonth,
        note: month === 1 || month === 12 ? String(year) : undefined,
      };
    });
  }, [allStats, currentMonth, currentYear, direction, isEnglish, selectedMonth, selectedYear, yearly]);

  const openPicker = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setIsPickerOpen(true);
  };

  const visibleCategories = expandCategories ? categoryStats : categoryStats.slice(0, 3);
  const visibleRanking = expandRanking ? rankingRecords : rankingRecords.slice(0, 3);

  return (
    <div className="flex h-full flex-col bg-gray-50 pt-10" data-status-bar-foreground="dark">
      {isPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white p-4">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex gap-6">
                <button className="-mb-3.5 border-b-2 border-app-primary pb-3 font-medium text-app-primary">
                  {yearly ? s.bill_analysis_select_year : s.select_month}
                </button>
                <button className="text-gray-500">{s.custom_time}</button>
              </div>
              <button onClick={() => setIsPickerOpen(false)} className="text-xl font-light text-gray-400">×</button>
            </div>
            <div className="relative mb-6 flex h-44 justify-center">
              <div className="pointer-events-none absolute left-6 right-6 top-1/2 -translate-y-1/2 border-y border-app-primary/30" style={{ height: 36 }} />
              <div className={`flex w-full justify-center ${yearly ? '' : 'gap-24'} text-center text-lg`}>
                <div ref={yearRef} className="w-24 overflow-y-auto no-scrollbar" style={{ scrollBehavior: 'smooth', paddingTop: 70, paddingBottom: 70, scrollSnapType: 'y mandatory' }}>
                  {yearOptions.map((year, index) => (
                    <div
                      key={year}
                      className={selectedYear === year ? 'font-medium text-black' : 'text-gray-300'}
                      style={{ height: 36, lineHeight: '36px', scrollSnapAlign: 'center' }}
                      onClick={() => { yearRef.current?.scrollTo({ top: index * 36, behavior: 'smooth' }); setSelectedYear(year); }}
                    >
                      {year}
                    </div>
                  ))}
                </div>
                {!yearly && (
                  <div ref={monthRef} className="w-24 overflow-y-auto no-scrollbar" style={{ scrollBehavior: 'smooth', paddingTop: 70, paddingBottom: 70, scrollSnapType: 'y mandatory' }}>
                    {monthOptions.map((month, index) => (
                      <div
                        key={month}
                        className={selectedMonth === month ? 'font-medium text-black' : 'text-gray-300'}
                        style={{ height: 36, lineHeight: '36px', scrollSnapAlign: 'center' }}
                        onClick={() => { monthRef.current?.scrollTo({ top: index * 36, behavior: 'smooth' }); setSelectedMonth(month); }}
                      >
                        {pickerMonth(month, isEnglish)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button className="mb-2 w-full rounded-lg bg-app-primary py-3 text-lg font-medium text-white" onClick={() => setIsPickerOpen(false)}>
              {s.confirm_2}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between bg-white px-4 pb-3 pt-2">
        <button {...bindBack<HTMLButtonElement>()} className="p-1">
          <IcNavBack size={22} className="text-gray-800" />
        </button>
        <span className="text-base font-medium text-gray-900">{s.income_and_expense_analysis}</span>
        <button className="p-1">
          <IcMore size={22} className="text-gray-800" />
        </button>
      </div>

      <div className="flex justify-center gap-8 border-b border-gray-100 bg-white">
        {(['monthly', 'yearly'] as const).map(item => (
          <button
            key={item}
            onClick={() => { setTab(item); setExpandCategories(false); setExpandRanking(false); }}
            className={`pb-2.5 text-sm font-medium ${tab === item ? 'border-b-2 border-app-primary text-app-primary' : 'text-gray-500'}`}
          >
            {item === 'monthly' ? s.bill_analysis_monthly : s.bill_analysis_yearly}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <div className="flex items-center justify-between bg-white px-4 py-3">
          <button className="flex items-center text-sm font-medium text-gray-800" onClick={openPicker}>
            {periodLabel(selectedYear, selectedMonth, yearly, isEnglish)}
            <IcExpand size={14} className="ml-1 text-gray-400" />
          </button>
          <div className="flex items-center rounded-full border border-gray-200">
            <button onClick={() => setDirection('expense')} className={`rounded-full px-4 py-1 text-sm ${direction === 'expense' ? 'bg-app-primary text-white' : 'text-gray-500'}`}>{s.expenses}</button>
            <button onClick={() => setDirection('income')} className={`rounded-full px-4 py-1 text-sm ${direction === 'income' ? 'bg-app-primary text-white' : 'text-gray-500'}`}>{s.income}</button>
          </div>
        </div>

        <div className="mx-3 mt-2 rounded-2xl bg-white px-4 pb-4 pt-4">
          <div className="text-xs text-gray-500">{summaryText}</div>
          <div className="mt-1 text-3xl font-bold text-app-primary">¥{totalAmount.toFixed(2)}</div>
          <div className="mt-1 text-xs text-gray-400">{s.bill_analysis_total.replace('{count}', String(totalCount))}</div>
          <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium">{s.bill_analysis_green_tag}</span>
            {s.bill_analysis_green_hint}
          </div>
        </div>

        {direction === 'expense' && categoryStats.length > 0 && (
          <div className="mx-3 mt-3 rounded-2xl bg-white px-4 py-4">
            <div className="text-base font-medium text-gray-900">{s.bill_analysis_expense_categories}</div>
            {!yearly && categoryStats[0] && (
              <div className="mt-2 text-sm text-gray-500">
                {s.bill_analysis_top_category
                  .replace('{name}', localizeBillCategoryName(categoryStats[0].id, categoryStats[0].fallbackName, isEnglish))
                  .replace('{avg}', categoryStats[0].count > 0 ? (categoryStats[0].amount / categoryStats[0].count).toFixed(2) : '0.00')}
              </div>
            )}
            <div className="my-4">
              <DonutChart items={categoryStats.map((category, index) => ({
                pct: totalAmount > 0 ? category.amount / totalAmount : 0,
                color: DONUT_COLORS[index % DONUT_COLORS.length],
                label: localizeBillCategoryName(category.id, category.fallbackName, isEnglish),
              }))} />
            </div>
            <div className="space-y-4">
              {visibleCategories.map((category, index) => {
                const pct = totalAmount > 0 ? ((category.amount / totalAmount) * 100).toFixed(1) : '0';
                return (
                  <div key={category.id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                      <IconRenderer name={category.icon} size={18} className="text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-800">
                          {localizeBillCategoryName(category.id, category.fallbackName, isEnglish)}
                          <span className="ml-1 text-gray-400">{pct}% ({s.bill_analysis_txns.replace('{count}', String(category.count))})</span>
                        </span>
                        <span className="text-sm font-medium text-gray-900">¥{category.amount.toFixed(2)}</span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-gray-100">
                        <div className="h-full rounded-full" style={{ width: `${totalAmount > 0 ? (category.amount / totalAmount) * 100 : 0}%`, backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {categoryStats.length > 3 && (
              <button className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-gray-500" onClick={() => setExpandCategories(!expandCategories)}>
                {expandCategories ? s.bill_analysis_collapse : s.bill_analysis_expand_all}
                <IcExpand size={14} className={`text-gray-400 transition-transform ${expandCategories ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}

        {rankingRecords.length > 0 && (
          <div className="mx-3 mt-3 rounded-2xl bg-white px-4 py-4">
            <div className="text-base font-medium text-gray-900">{rankingTitle}</div>
            {rankingRecords.length >= 3 && <div className="mt-2 text-sm text-gray-500">{rankingHintTemplate.replace('{pct}', top3Pct)}</div>}
            <div className="mt-4 space-y-4">
              {visibleRanking.map((record, index) => {
                const date = TimeService.fromTimestamp(record.timestamp);
                return (
                  <div key={record.id} className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${index < 3 ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'}`}>{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-gray-800">{getBillDisplayTitle(record, isEnglish)}</div>
                      <div className="text-xs text-gray-400">{`${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-900">¥{Math.abs(record.delta).toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            {rankingRecords.length > 3 && (
              <button className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-gray-500" onClick={() => setExpandRanking(!expandRanking)}>
                {expandRanking ? s.bill_analysis_collapse : s.bill_analysis_expand}
                <IcExpand size={14} className={`text-gray-400 transition-transform ${expandRanking ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}

        <div className="mx-3 mt-3 rounded-2xl bg-white px-4 py-4">
          <div className="text-base font-medium text-gray-900">{compareTitle}</div>
          {!yearly && (
            <>
              <div className="mt-2 text-sm text-gray-500">{s.bill_analysis_budget_hint} <span className="text-app-primary">{s.bill_analysis_set_budget}</span></div>
              <div className="mt-3 flex items-center gap-2">
                <button className="rounded-full bg-app-primary px-3 py-1 text-xs text-white">{s.bill_analysis_month}</button>
                <button className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">{s.bill_analysis_day}</button>
                <div className="flex-1" />
                <span className="text-xs text-gray-400">{s.bill_analysis_no_budget}</span>
              </div>
            </>
          )}
          <div className="mt-4">
            <BarChart bars={recentBars} />
          </div>
        </div>

        {direction === 'expense' && paymentStats.length > 0 && (
          <div className="mx-3 mb-6 mt-3 rounded-2xl bg-white px-4 py-4">
            <div className="text-base font-medium text-gray-900">{s.bill_analysis_bank_cards}</div>
            <div className="mt-4 space-y-4">
              {paymentStats.map(item => {
                const display = splitBankPaymentMethod(item.rawName, isEnglish);
                return (
                  <div key={item.rawName} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {display.bankName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm text-gray-800">{display.bankName}{display.last4 ? ` (${display.last4})` : ''}</span>
                      <span className="ml-1 text-xs text-gray-400">({s.bill_analysis_txns.replace('{count}', String(item.count))})</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">¥{item.amount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
};

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocale } from '@/apps/Alipay/locale';
import * as TimeService from '../../../os/TimeService';
import { BillFilterDrawer } from '../components/BillFilterDrawer';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { IcExpand, IcMore, IcNavBack, IcNavForward, IcSearch } from '../res/icons';
import { useAlipayStore } from '../state';
import type { AlipayBillCategoryId, AlipayBillQuickFilterId, AlipayTransferRecord } from '../types';
import {
  getBillDescription,
  getBillDisplayTitle,
  getBillRefundStatusLabel,
  getBillTabs,
  isDrawerFilter,
  recordMatchesBillFilters,
  type BillFilterValues,
} from '../utils/bills';

const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateTimeShort = (timestamp: number) => {
  const date = TimeService.fromTimestamp(timestamp);
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const buildMonthKey = (timestamp: number) => {
  const date = TimeService.fromTimestamp(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};

const summarizeRecords = (records: AlipayTransferRecord[]) => ({
  out: records
    .filter(record => record.delta < 0)
    .reduce((sum, record) => sum + Math.abs(Number(record.delta) || 0), 0),
  income: records
    .filter(record => record.delta > 0)
    .reduce((sum, record) => sum + (Number(record.delta) || 0), 0),
});

const formatMonthLabel = (year: number, month: number, currentYear: number, monthSuffix: string, isEnglish: boolean) => {
  if (isEnglish) {
    const label = MONTH_LABELS_EN[month - 1] ?? String(month);
    return year === currentYear ? label : `${label} ${year}`;
  }
  return year === currentYear ? `${month}${monthSuffix}` : `${year}-${pad2(month)}`;
};

const RecordRow: React.FC<{ record: AlipayTransferRecord; isEnglish: boolean }> = ({ record, isEnglish }) => {
  const s = useAlipayStrings();
  const { bindTap } = useAlipayGestures();

  return (
    <button
      key={record.id}
      {...bindTap<HTMLButtonElement>('bill.detail.open', { params: { id: record.id } })}
      className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-4 text-left last:border-b-0"
    >
      <div className="flex min-w-0 items-center">
        <div className="mr-3 flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
          {record.counterpartyAvatar ? (
            <img src={record.counterpartyAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <DefaultAvatar iconSize={22} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-gray-900">{getBillDisplayTitle(record, isEnglish)}</div>
          <div className="mt-1 text-xs text-gray-400">{getBillDescription(record, isEnglish) || s.other}</div>
          <div className="mt-1 text-xs text-gray-400">{formatDateTimeShort(record.timestamp)}</div>
        </div>
      </div>
      <div className="pl-3 text-right">
        <div className={`text-sm font-semibold ${record.delta > 0 ? 'text-[#E55B44]' : 'text-gray-900'}`}>
          {record.delta > 0 ? `+${record.delta.toFixed(2)}` : record.delta.toFixed(2)}
        </div>
        {record.kind === 'refund' && (
          <div className="mt-1 text-xs text-[#E55B44]">{getBillRefundStatusLabel(isEnglish)}</div>
        )}
      </div>
    </button>
  );
};

export const BillsPage: React.FC = () => {
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const [searchParams] = useSearchParams();
  const transferRecords = useAlipayStore(state => state.transferRecords);
  const { bindTap, bindBack, go } = useAlipayGestures();
  const [isMonthPickerOpen, setIsMonthPickerOpen] = React.useState(false);
  const now = TimeService.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);
  const [singleMonthMode, setSingleMonthMode] = React.useState(false);
  const yearOptions = React.useMemo(() => [2024, 2025, 2026], []);
  const monthOptions = React.useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const yearRef = React.useRef<HTMLDivElement>(null);
  const monthRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isCardHidden, setIsCardHidden] = React.useState(false);
  const [activeMonthKey, setActiveMonthKey] = React.useState<string | null>(null);
  const rafRef = React.useRef(0);

  const billTabs = React.useMemo(() => getBillTabs(isEnglish), [isEnglish]);

  const bindBillTab = (filterId: AlipayBillQuickFilterId | null) => {
    switch (filterId) {
      case null:
        return bindTap<HTMLButtonElement>('bill.tab.all');
      case 'expense':
        return bindTap<HTMLButtonElement>('bill.tab.expense');
      case 'transfer':
        return bindTap<HTMLButtonElement>('bill.tab.transfer');
      case 'refund':
        return bindTap<HTMLButtonElement>('bill.tab.refund');
      case 'order':
        return bindTap<HTMLButtonElement>('bill.tab.order');
      case 'offline':
        return bindTap<HTMLButtonElement>('bill.tab.offline');
      case 'topUp':
        return bindTap<HTMLButtonElement>('bill.tab.topUp');
      case 'shopping':
        return bindTap<HTMLButtonElement>('bill.tab.shopping');
      case 'merchantCollection':
        return bindTap<HTMLButtonElement>('bill.tab.merchantCollection');
      default:
        return {};
    }
  };

  const isFilterOpen = searchParams.get('modal') === 'filter';
  const appliedFilters = React.useMemo<BillFilterValues>(() => ({
    quickFilter: (searchParams.get('quickFilters') as AlipayBillQuickFilterId) || null,
    category: (searchParams.get('categories') as AlipayBillCategoryId) || null,
    minAmount: searchParams.get('minAmount') ?? '',
    maxAmount: searchParams.get('maxAmount') ?? '',
  }), [searchParams]);
  const activeQuickFilter = appliedFilters.quickFilter;
  const hasDrawerFilters =
    appliedFilters.category !== null ||
    Boolean(appliedFilters.minAmount) ||
    Boolean(appliedFilters.maxAmount) ||
    (activeQuickFilter !== null && isDrawerFilter(activeQuickFilter));

  const fullSorted = React.useMemo(
    () => [...transferRecords].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0)),
    [transferRecords],
  );

  const filteredRecords = React.useMemo(() => {
    const nowTs = TimeService.now();
    return fullSorted.filter(record => {
      if ((record.timestamp || 0) > nowTs) return false;
      return recordMatchesBillFilters(record, {
        minAmount: appliedFilters.minAmount,
        maxAmount: appliedFilters.maxAmount,
        quickFilter: appliedFilters.quickFilter,
        category: appliedFilters.category,
      });
    });
  }, [appliedFilters, fullSorted]);

  const groups = React.useMemo(() => {
    const map = new Map<string, AlipayTransferRecord[]>();
    for (const record of filteredRecords) {
      const key = buildMonthKey(record.timestamp);
      const list = map.get(key) || [];
      list.push(record);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((left, right) => (left[0] < right[0] ? 1 : -1));
  }, [filteredRecords]);

  const displayYear = singleMonthMode ? selectedYear : currentYear;
  const displayMonth = singleMonthMode ? selectedMonth : currentMonth;
  const primaryMonthKey = `${displayYear}-${pad2(displayMonth)}`;
  const primaryMonthList = groups.find(([monthKey]) => monthKey === primaryMonthKey)?.[1] || [];
  const primarySummary = summarizeRecords(primaryMonthList);
  const monthLabel = formatMonthLabel(displayYear, displayMonth, currentYear, s.month_suffix, isEnglish);

  const groupSummaries = React.useMemo(() => {
    const map = new Map<string, { label: string; out: number; income: number }>();
    for (const [monthKey, records] of groups) {
      const [year, month] = monthKey.split('-').map(Number);
      map.set(monthKey, {
        label: formatMonthLabel(year, month, currentYear, s.month_suffix, isEnglish),
        ...summarizeRecords(records),
      });
    }
    return map;
  }, [currentYear, groups, isEnglish, s.month_suffix]);

  const pickerJustOpened = React.useRef(false);
  React.useEffect(() => {
    if (!isMonthPickerOpen) {
      pickerJustOpened.current = false;
      return;
    }
    pickerJustOpened.current = true;
    requestAnimationFrame(() => {
      yearRef.current?.scrollTo({ top: Math.max(0, yearOptions.indexOf(selectedYear)) * 36, behavior: 'instant' });
      monthRef.current?.scrollTo({ top: Math.max(0, monthOptions.indexOf(selectedMonth)) * 36, behavior: 'instant' });
      setTimeout(() => { pickerJustOpened.current = false; }, 350);
    });
  }, [isMonthPickerOpen, monthOptions, selectedMonth, selectedYear, yearOptions]);

  const hasPrimaryCard = primaryMonthList.length > 0;

  React.useEffect(() => {
    if (!hasPrimaryCard) {
      setIsCardHidden(false);
      return;
    }
    const card = cardRef.current;
    const scroll = scrollRef.current;
    if (!card || !scroll) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsCardHidden(!entry.isIntersecting),
      { root: scroll, threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [hasPrimaryCard, primaryMonthKey]);

  React.useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const container = scrollRef.current;
        if (!container) return;
        const top = container.getBoundingClientRect().top;
        let active: string | null = null;
        for (const element of container.querySelectorAll<HTMLElement>('[data-month-key]')) {
          if (element.getBoundingClientRect().top <= top + 60) {
            active = element.getAttribute('data-month-key');
          }
        }
        if (active) setActiveMonthKey(active);
      });
    };
    scroll.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      scroll.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [groups, primaryMonthKey]);

  const stickyData = React.useMemo(() => {
    if (singleMonthMode) return { label: monthLabel, ...primarySummary };
    if (activeMonthKey && groupSummaries.has(activeMonthKey)) return groupSummaries.get(activeMonthKey)!;
    return { label: monthLabel, ...primarySummary };
  }, [activeMonthKey, groupSummaries, monthLabel, primarySummary, singleMonthMode]);

  const applyFilters = (values: BillFilterValues) => {
    const params: Record<string, string> = {};
    if (values.minAmount) params.minAmount = values.minAmount;
    if (values.maxAmount) params.maxAmount = values.maxAmount;
    if (values.quickFilter) params.quickFilters = values.quickFilter;
    if (values.category) params.categories = values.category;
    go('bill.filter.apply', params);
  };

  const closeFilter = () => {
    go('bill.filter.close');
  };

  const openMonthPickerFor = (year: number, month: number) => {
    pickerJustOpened.current = true;
    setSelectedYear(year);
    setSelectedMonth(month);
    setIsMonthPickerOpen(true);
  };

  const openMonthPicker = () => {
    openMonthPickerFor(currentYear, currentMonth);
  };

  const renderMonthCard = (monthKey: string, records: AlipayTransferRecord[], label: string, isPrimary: boolean) => {
    const summary = summarizeRecords(records);
    const [year, month] = monthKey.split('-').map(Number);
    return (
      <div key={monthKey} data-month-key={monthKey} className="mx-2.5 mt-3 overflow-hidden rounded-2xl bg-app-surface shadow-sm">
        <div ref={isPrimary ? cardRef : undefined} className="flex items-center justify-between p-4">
          <div>
            <button
              className="flex items-center text-xl font-bold text-gray-900"
              onClick={() => openMonthPickerFor(year, month)}
            >
              {label}
              <IcExpand size={18} className="ml-1 text-gray-400" />
            </button>
            <div className="mt-2 flex items-center gap-5 text-sm text-gray-600">
              <div>
                <div className="text-xs text-gray-400">{s.expenses}</div>
                <div className="font-medium">¥ {summary.out.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">{s.income}</div>
                <div className="font-medium">¥ {summary.income.toFixed(2)}</div>
              </div>
            </div>
            {isPrimary ? (
              <div className="mt-2 text-sm text-gray-500">
                {hasDrawerFilters ? s.bills_filters_applied : s.set_spending_budget}
              </div>
            ) : null}
          </div>
          <button
            className="rounded-full bg-app-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
            {...bindTap<HTMLButtonElement>('bill.analysis.open')}
          >
            {s.income_and_expense_analysis}
          </button>
        </div>

        {records.map(record => <RecordRow key={record.id} record={record} isEnglish={isEnglish} />)}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-app-bg pt-10">
      {isMonthPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-app-surface p-4">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex gap-6">
                <button className="-mb-3.5 border-b-2 border-app-primary pb-3 font-medium text-app-primary">
                  {s.select_month}
                </button>
                <button className="text-gray-500">{s.custom_time}</button>
              </div>
              <button onClick={() => setIsMonthPickerOpen(false)} className="text-xl font-light text-gray-400">×</button>
            </div>

            <div className="relative mb-6 flex h-[176px] justify-center">
              <div
                className="pointer-events-none absolute left-6 right-6 top-1/2 -translate-y-1/2 border-y border-app-primary/30"
                style={{ height: 36 }}
              />
              <div className="flex w-full justify-center gap-24 text-center text-lg">
                <div
                  ref={yearRef}
                  className="w-24 overflow-y-auto no-scrollbar"
                  style={{ paddingTop: 70, paddingBottom: 70, scrollSnapType: 'y mandatory' }}
                  onScroll={event => {
                    if (pickerJustOpened.current) return;
                    const index = Math.max(0, Math.min(yearOptions.length - 1, Math.round(event.currentTarget.scrollTop / 36)));
                    setSelectedYear(yearOptions[index]);
                  }}
                >
                  {yearOptions.map((year, index) => (
                    <div
                      key={year}
                      className={selectedYear === year ? 'font-medium text-black' : 'text-gray-300'}
                      style={{ height: 36, lineHeight: '36px', scrollSnapAlign: 'center' }}
                      onClick={() => {
                        pickerJustOpened.current = true;
                        yearRef.current?.scrollTo({ top: index * 36, behavior: 'smooth' });
                        setSelectedYear(year);
                        setTimeout(() => { pickerJustOpened.current = false; }, 350);
                      }}
                    >
                      {year}
                    </div>
                  ))}
                </div>

                <div
                  ref={monthRef}
                  className="w-24 overflow-y-auto no-scrollbar"
                  style={{ paddingTop: 70, paddingBottom: 70, scrollSnapType: 'y mandatory' }}
                  onScroll={event => {
                    if (pickerJustOpened.current) return;
                    const index = Math.max(0, Math.min(monthOptions.length - 1, Math.round(event.currentTarget.scrollTop / 36)));
                    setSelectedMonth(monthOptions[index]);
                  }}
                >
                  {monthOptions.map((month, index) => (
                    <div
                      key={month}
                      className={selectedMonth === month ? 'font-medium text-black' : 'text-gray-300'}
                      style={{ height: 36, lineHeight: '36px', scrollSnapAlign: 'center' }}
                      onClick={() => {
                        pickerJustOpened.current = true;
                        monthRef.current?.scrollTo({ top: index * 36, behavior: 'smooth' });
                        setSelectedMonth(month);
                        setTimeout(() => { pickerJustOpened.current = false; }, 350);
                      }}
                    >
                      {isEnglish ? MONTH_LABELS_EN[month - 1] : month}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              className="mb-2 w-full rounded-lg bg-app-primary py-3 text-lg font-medium text-white"
              onClick={() => {
                setSingleMonthMode(true);
                setIsMonthPickerOpen(false);
              }}
            >
              {s.confirm_2}
            </button>
          </div>
        </div>
      )}

      <BillFilterDrawer
        open={isFilterOpen}
        initialValues={appliedFilters}
        onClose={closeFilter}
        onApply={applyFilters}
      />

      <div className="pointer-events-none fixed left-0 right-0 top-0 z-10 h-10 bg-app-surface" />

      <div className="sticky top-0 z-20 border-b border-gray-100 bg-app-surface px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button {...bindBack<HTMLButtonElement>()} className="-ml-1 p-1">
            <IcNavBack size={22} className="text-gray-800" />
          </button>

          <button
            {...bindTap<HTMLButtonElement>('bill.search.open')}
            className="flex flex-1 items-center rounded-full bg-gray-100 px-3 py-2"
          >
            <IcSearch size={16} className="mr-2 text-gray-400" />
            <span className="text-sm text-gray-400">{s.search_transactions}</span>
          </button>
          <button className="p-1">
            <IcMore size={22} className="text-gray-800" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto no-scrollbar pr-2">
            {billTabs.map(item => {
              const isActive = item.filterId === null
                ? activeQuickFilter === null
                : activeQuickFilter === item.filterId;
              const tabId = item.filterId === null ? 'all' : item.filterId;
              return (
                <button
                  key={tabId}
                  {...bindBillTab(item.filterId)}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
                    isActive ? 'bg-app-primary/10 font-medium text-app-primary' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            {...bindTap<HTMLButtonElement>('bill.filter.open')}
            className={`flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              hasDrawerFilters ? 'bg-app-primary/10 text-app-primary' : 'text-gray-700'
            }`}
          >
            {s.filter}
            <IcExpand size={16} className={hasDrawerFilters ? 'text-app-primary' : 'text-gray-500'} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {isCardHidden && (
          <div className="absolute left-0 right-0 top-0 z-10 border-b border-gray-100 bg-app-surface px-4 pb-2 pt-2">
            <button
              className="mb-1 flex items-center gap-0.5 text-xs text-gray-700"
              onClick={() => {
                if (activeMonthKey) {
                  const [y, m] = activeMonthKey.split('-').map(Number);
                  openMonthPickerFor(y, m);
                } else {
                  openMonthPicker();
                }
              }}
            >
              {stickyData.label}
              <IcExpand size={12} className="text-gray-400" />
            </button>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <span>{s.expenses} ¥{stickyData.out.toFixed(2)}</span>
                <span>{s.income} ¥{stickyData.income.toFixed(2)}</span>
              </div>
              <button
                className="flex items-center gap-0.5 text-sm text-gray-700"
                {...bindTap<HTMLButtonElement>('bill.analysis.open')}
              >
                {s.income_and_expense_analysis}
                <IcNavForward size={14} className="text-gray-400" />
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="h-full overflow-auto no-scrollbar pb-24">
          {primaryMonthList.length > 0 && renderMonthCard(primaryMonthKey, primaryMonthList, monthLabel, true)}
          {(singleMonthMode ? [] : groups.filter(([monthKey]) => monthKey !== primaryMonthKey)).map(([monthKey, records]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const label = formatMonthLabel(year, month, currentYear, s.month_suffix, isEnglish);
            return renderMonthCard(monthKey, records, label, false);
          })}
          {filteredRecords.length === 0 && (
            <div className="flex flex-col items-center px-4 pt-24">
              <div className="mb-6 text-5xl text-gray-300">[]</div>
              <div className="text-base font-medium text-gray-700">{s.bills_no_records}</div>
              <div className="mt-1 text-sm text-gray-400">{s.bills_try_another}</div>
              <button
                className="mt-5 rounded-full border border-app-primary px-5 py-2 text-sm text-app-primary"
                onClick={openMonthPicker}
              >
                {s.bills_view_earlier_bills}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

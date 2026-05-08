import React from 'react';
import { useLocale } from '@/apps/Alipay/locale';
import * as TimeService from '../../../os/TimeService';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { IcClose, IcExpand, IcNavBack, IcSearch } from '../res/icons';
import { useAlipayStore } from '../state';
import type { AlipayTransferRecord } from '../types';
import {
  getBillDescription,
  getBillDisplayTitle,
  getBillRefundStatusLabel,
  recordMatchesBillFilters,
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

const formatMonthLabel = (monthKey: string, currentYear: number, monthSuffix: string, isEnglish: boolean) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (isEnglish) {
    const label = MONTH_LABELS_EN[month - 1] ?? String(month);
    return year === currentYear ? label : `${label} ${year}`;
  }
  return year === currentYear ? `${month}${monthSuffix}` : `${year}-${pad2(month)}`;
};

const SearchRecordRow: React.FC<{ record: AlipayTransferRecord; isEnglish: boolean }> = ({ record, isEnglish }) => {
  const s = useAlipayStrings();
  const { bindTap } = useAlipayGestures();

  return (
    <button
      {...bindTap<HTMLButtonElement>('bill.search.detail.open', { params: { id: record.id } })}
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

export const BillSearchPage: React.FC = () => {
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const { back } = useAlipayGestures();
  const transferRecords = useAlipayStore(state => state.transferRecords);
  const billSearchHistory = useAlipayStore(state => state.billSearchHistory);
  const addBillSearchHistory = useAlipayStore(state => state.addBillSearchHistory);
  const clearBillSearchHistory = useAlipayStore(state => state.clearBillSearchHistory);

  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const now = TimeService.getDate();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const keyword = query.trim();

  const [isMonthPickerOpen, setIsMonthPickerOpen] = React.useState(false);
  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);
  const [singleMonthMode, setSingleMonthMode] = React.useState(false);
  const yearOptions = React.useMemo(() => [2024, 2025, 2026], []);
  const monthOptions = React.useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const yearRef = React.useRef<HTMLDivElement>(null);
  const monthRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const pickerJustOpened = React.useRef(false);
  React.useEffect(() => {
    if (!isMonthPickerOpen) {
      pickerJustOpened.current = false;
      return;
    }
    pickerJustOpened.current = true;
    requestAnimationFrame(() => {
      yearRef.current?.scrollTo({ top: Math.max(0, yearOptions.indexOf(selectedYear)) * 36 });
      monthRef.current?.scrollTo({ top: Math.max(0, monthOptions.indexOf(selectedMonth)) * 36 });
      setTimeout(() => { pickerJustOpened.current = false; }, 100);
    });
  }, [isMonthPickerOpen, monthOptions, selectedMonth, selectedYear, yearOptions]);

  const sortedRecords = React.useMemo(
    () => [...transferRecords].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0)),
    [transferRecords],
  );

  const results = React.useMemo(() => {
    if (!keyword) return [];
    const nowTs = TimeService.now();
    return sortedRecords.filter(record => {
      if ((record.timestamp || 0) > nowTs) return false;
      return recordMatchesBillFilters(record, { query: keyword });
    });
  }, [keyword, sortedRecords]);

  const groups = React.useMemo(() => {
    const map = new Map<string, AlipayTransferRecord[]>();
    for (const record of results) {
      const key = buildMonthKey(record.timestamp);
      const list = map.get(key) || [];
      list.push(record);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((left, right) => (left[0] < right[0] ? 1 : -1));
  }, [results]);

  const displayGroups = React.useMemo(() => {
    if (!singleMonthMode) return groups;
    const target = `${selectedYear}-${pad2(selectedMonth)}`;
    return groups.filter(([key]) => key === target);
  }, [groups, selectedMonth, selectedYear, singleMonthMode]);

  const saveHistory = () => {
    if (keyword) addBillSearchHistory(keyword);
  };

  const handleHistoryClick = (value: string) => {
    setQuery(value);
    addBillSearchHistory(value);
  };

  const handleClear = () => {
    setQuery('');
    setSingleMonthMode(false);
    inputRef.current?.focus();
  };

  const openMonthPicker = () => {
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setIsMonthPickerOpen(true);
  };

  return (
    <div className="flex h-full flex-col bg-app-surface" data-status-bar-foreground="dark">
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-10 h-10 bg-app-surface" />

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

            <div className="relative mb-6 flex h-44 justify-center">
              <div
                className="pointer-events-none absolute left-6 right-6 top-1/2 -translate-y-1/2 border-y border-app-primary/30"
                style={{ height: 36 }}
              />
              <div className="flex w-full justify-center gap-24 text-center text-lg">
                <div
                  ref={yearRef}
                  className="w-24 overflow-y-auto no-scrollbar"
                  style={{ scrollBehavior: 'smooth', paddingTop: 70, paddingBottom: 70, scrollSnapType: 'y mandatory' }}
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
                        yearRef.current?.scrollTo({ top: index * 36, behavior: 'smooth' });
                        setSelectedYear(year);
                      }}
                    >
                      {year}
                    </div>
                  ))}
                </div>

                <div
                  ref={monthRef}
                  className="w-24 overflow-y-auto no-scrollbar"
                  style={{ scrollBehavior: 'smooth', paddingTop: 70, paddingBottom: 70, scrollSnapType: 'y mandatory' }}
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
                        monthRef.current?.scrollTo({ top: index * 36, behavior: 'smooth' });
                        setSelectedMonth(month);
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

      <div className="flex items-center gap-2 border-b border-gray-100 bg-app-surface px-4 pb-3 pt-12">
        <button
          onClick={() => {
            if (query) {
              handleClear();
            } else {
              back();
            }
          }}
          className="-ml-1 flex-shrink-0 p-1"
        >
          <IcNavBack size={22} className="text-gray-800" />
        </button>
        <div className="flex flex-1 items-center rounded-full bg-gray-100 px-3 py-2" data-keep-keyboard="true">
          <IcSearch size={16} className="mr-2 flex-shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') saveHistory();
            }}
            placeholder={s.search_transactions}
            className="w-full border-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          {query && (
            <button onClick={handleClear} className="ml-1 flex-shrink-0 p-0.5">
              <IcClose size={14} className="text-gray-400" />
            </button>
          )}
        </div>
        <button onClick={saveHistory} className="flex-shrink-0 text-sm font-medium text-app-primary">
          {s.search}
        </button>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {!keyword ? (
          billSearchHistory.length > 0 && (
            <div className="px-4 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{s.bill_search_search_history}</span>
                <button onClick={clearBillSearchHistory} className="text-xs text-gray-400">{s.bill_search_clear}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {billSearchHistory.map(value => (
                  <button
                    key={value}
                    onClick={() => handleHistoryClick(value)}
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-700"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : displayGroups.length === 0 ? (
          <div className="flex flex-col items-center px-4 pt-24">
            <div className="mb-6 text-5xl text-gray-300">[]</div>
            <div className="text-base font-medium text-gray-700">{s.bill_search_no_records}</div>
            <div className="mt-1 text-sm text-gray-400">{s.bill_search_try_another}</div>
            <button
              className="mt-5 rounded-full border border-app-primary px-5 py-2 text-sm text-app-primary"
              onClick={openMonthPicker}
            >
              {s.bill_search_view_earlier_bills}
            </button>
          </div>
        ) : (
          <div className="pb-24">
            {displayGroups.map(([monthKey, records]) => {
              const label = formatMonthLabel(monthKey, currentYear, s.month_suffix, isEnglish);
              const summary = summarizeRecords(records);
              return (
                <div key={monthKey} className="mt-3">
                  <div className="flex items-center justify-between px-4 py-2">
                    <button
                      className="flex items-center text-sm font-medium text-gray-500"
                      onClick={openMonthPicker}
                    >
                      {label}
                      <IcExpand size={14} className="ml-0.5 text-gray-400" />
                    </button>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{s.expenses} ¥{summary.out.toFixed(2)}</span>
                      <span>{s.income} ¥{summary.income.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mx-3 overflow-hidden rounded-2xl bg-white">
                    {records.map(record => <SearchRecordRow key={record.id} record={record} isEnglish={isEnglish} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

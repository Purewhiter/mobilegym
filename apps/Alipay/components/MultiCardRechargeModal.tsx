import React from 'react';
import { IcClose, IcBuilding } from '../res/icons';
import { MinusCircle } from 'lucide-react';
import { AmountKeyboard } from './AmountKeyboard';
import type { AlipayBankCard } from '../types';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

function clampMoney2(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.round(v * 100) / 100);
}

function splitEven(total: number, n: number): number[] {
    const t = clampMoney2(total);
    const k = Math.max(0, Math.floor(n));
    if (k <= 0) return [];
    const base = clampMoney2(t / k);
    const arr = Array.from({ length: k }, () => base);
    const sum = clampMoney2(arr.reduce((s, x) => s + x, 0));
    const drift = clampMoney2(t - sum);
    if (arr.length > 0) arr[0] = clampMoney2(arr[0] + drift);
    return arr;
}

export type MultiRechargeRow = { cardId: string; amount: string };

export const MultiCardRechargeModal: React.FC<{
    visible: boolean;
    totalAmount: string;
    boundCards: AlipayBankCard[];
    onClose: () => void;
    onAddMoreCards: () => void;
    onSubmit: (rows: MultiRechargeRow[]) => void;
}> = ({ visible, totalAmount, boundCards, onClose, onAddMoreCards, onSubmit }) => {
    const s = useAlipayStrings();
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [rows, setRows] = React.useState<MultiRechargeRow[]>([]);
    const [activeCardId, setActiveCardId] = React.useState<string | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const inputRefs = React.useRef<Map<string, HTMLInputElement>>(new Map());

    React.useEffect(() => {
        if (!visible) {
            setActiveCardId(null);
            return;
        }
        const cards = (boundCards || []).filter(c => c && c.bound);
        const total = Number(totalAmount);
        const parts = splitEven(Number.isFinite(total) ? total : 0, cards.length);
        setRows(cards.map((c, idx) => {
            const v = parts[idx] ?? 0;
            return { cardId: c.id, amount: v > 0 ? v.toFixed(2) : '' };
        }));
    }, [visible, boundCards, totalAmount]);

    React.useEffect(() => {
        if (!activeCardId) return;
        const el = inputRefs.current.get(activeCardId);
        if (el) el.focus({ preventScroll: true });
        const timer = setTimeout(() => {
            const container = scrollRef.current;
            const input = el;
            if (!container || !input) return;
            const cRect = container.getBoundingClientRect();
            const iRect = input.getBoundingClientRect();
            const offsetInContainer = iRect.top - cRect.top + container.scrollTop;
            const targetScroll = offsetInContainer - 12;
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }, 80);
        return () => clearTimeout(timer);
    }, [activeCardId]);

    const cardsById = React.useMemo(() => {
        const m = new Map<string, AlipayBankCard>();
        for (const c of boundCards || []) m.set(c.id, c);
        return m;
    }, [boundCards]);

    const parsed = rows.map(r => clampMoney2(Number(r.amount)));
    const total = clampMoney2(parsed.reduce((s, x) => s + x, 0));
    const canSubmit = rows.length >= 1 && total > 0;
    const handleKeyInput = (key: string) => {
        if (!activeCardId) return;
        setRows(prev => prev.map(r => {
            if (r.cardId !== activeCardId) return r;
            const cur = r.amount;
            if (key === '.') {
                if (cur.includes('.')) return r;
                return { ...r, amount: cur === '' ? '0.' : cur + '.' };
            }
            if (cur === '0') return { ...r, amount: key };
            const next = cur + key;
            if (/^\d+\.\d{3,}$/.test(next)) return r;
            return { ...r, amount: next };
        }));
    };

    const handleKeyDelete = () => {
        if (!activeCardId) return;
        setRows(prev => prev.map(r =>
            r.cardId === activeCardId ? { ...r, amount: r.amount.slice(0, -1) } : r
        ));
    };

    if (!visible) return null;

    const kbOpen = activeCardId !== null;

    return (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-end justify-center" onClick={onClose}>
            <div
                className="w-full max-w-[480px] bg-app-bg rounded-t-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: '85vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 pt-4 pb-3 flex items-center justify-between bg-white flex-shrink-0">
                    <div className="w-6" />
                    <div className="text-base font-medium text-gray-900">{s.multi_card_recharge_title}</div>
                    <button className="p-1 -mr-1 active:opacity-70" onClick={onClose}>
                        <IcClose size={22} className="text-gray-500" />
                    </button>
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
                    <div className="px-4 py-3 bg-white border-t border-gray-100 flex justify-center">
                        <button
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F5F7FA] text-xs text-gray-700 active:bg-[#EEF2F6]"
                            onClick={onAddMoreCards}
                        >
                            <span className="text-gray-500">＋</span>
                            <span>{s.multi_card_recharge_choose_more}</span>
                        </button>
                    </div>

                    <div className="bg-white px-4 pb-4 space-y-4">
                        {rows.length === 0 ? (
                            <div className="py-6 text-sm text-gray-500 text-center">{s.multi_card_recharge_no_cards}</div>
                        ) : null}
                        {rows.map((r) => {
                            const card = cardsById.get(r.cardId) || null;
                            const isActive = activeCardId === r.cardId;
                            return (
                                <div key={r.cardId}>
                                    <div className="flex items-center justify-between py-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-[#F6F7FB] flex items-center justify-center flex-shrink-0">
                                                <IcBuilding size={18} className="text-app-primary" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-900 truncate">
                                                {card ? `${localizeBankName(card.bankName, isEnglish)}${isEnglish ? ` (${card.last4})` : `（${card.last4}）`}` : r.cardId}
                                            </span>
                                        </div>
                                        <button
                                            className="p-1 flex-shrink-0 active:opacity-60"
                                            onClick={() => setRows(prev => prev.filter(x => x.cardId !== r.cardId))}
                                        >
                                            <MinusCircle size={20} className="text-gray-400" />
                                        </button>
                                    </div>
                                    <input
                                        ref={(el) => { if (el) inputRefs.current.set(r.cardId, el); else inputRefs.current.delete(r.cardId); }}
                                        className={`w-full bg-[#F6F7FB] rounded-lg px-4 py-3 outline-none text-sm text-gray-900 placeholder:text-gray-400 caret-[#1677FF] border-2 transition-colors ${isActive ? 'border-app-primary' : 'border-transparent'}`}
                                        value={r.amount}
                                        inputMode="none"
                                        type="text"
                                        onClick={() => setActiveCardId(r.cardId)}
                                        onChange={e => {
                                            const v = e.target.value;
                                            if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
                                                setActiveCardId(r.cardId);
                                                setRows(prev => prev.map(x => x.cardId === r.cardId ? { ...x, amount: v } : x));
                                            }
                                        }}
                                        placeholder={s.multi_card_recharge_input_placeholder}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-white px-6 py-5 border-t border-gray-100">
                        <div className="text-center text-sm text-gray-600 mb-2">{s.multi_card_recharge_total}</div>
                        <div className="text-center text-3xl font-bold text-gray-900 mb-4">¥{total.toFixed(2)}</div>
                        <button
                            className="w-full h-12 rounded-full bg-app-primary text-white font-medium text-base disabled:opacity-50 active:scale-[0.99] transition-transform"
                            disabled={!canSubmit}
                            onClick={() => onSubmit(rows)}
                        >
                            {s.multi_card_recharge_next}
                        </button>
                    </div>
                </div>

                <AmountKeyboard
                    onInput={handleKeyInput}
                    onDelete={handleKeyDelete}
                    confirmLabel={s.multi_card_recharge_confirm}
                    confirmEnabled={canSubmit}
                    onConfirm={() => setActiveCardId(null)}
                    actionPrefix="multiRecharge"
                    open={kbOpen}
                    onToggle={(open) => { if (!open) setActiveCardId(null); }}
                />

                <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="bg-white" />
            </div>
        </div>
    );
};

import React from 'react';
import { IcNavBack } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useLocale } from '../../../os/locale';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';

const TransactionsPage: React.FC = () => {
    const { bindBack } = useWechatReadingGestures();
    const locale = useLocale();
    const s = useWechatReadingStrings();

    const transactions = [
        {
            id: '1',
            type: s.transactions_type_gift_coins,
            date: '12/4 18:45',
            amount: locale === 'en' ? '+40.00 gift coins' : '+40.00 赠币',
            expiry: locale === 'en' ? 'Expires 2026/1/3 18:45' : '2026/1/3 18:45过期',
            iconColor: 'bg-(--app-c-transactions-page-bg-e1f1)',
            iconSymbolColor: 'text-app-primary'
        }
    ];

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-10 pb-4 border-b border-(--app-c-tw-border-gray-50)">
                <button {...bindBack<HTMLButtonElement>()} className="p-1 active:opacity-60">
                    <IcNavBack size={dimens.book_detail_nav_back_icon_size} className="text-(--app-c-tw-text-slate-700)" />
                </button>
                <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-800) absolute left-1/2 -translate-x-1/2">{s.transactions_title}</span>
                <button className="text-(--app-title-text-size-16) font-bold text-(--app-c-tw-text-slate-400) active:opacity-60">{s.transactions_gift_record}</button>
            </div>

            {/* List */}
            <div data-scroll-container="main" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar">
                {transactions.map(item => (
                    <div key={item.id} className="flex px-5 py-5 gap-4 active:bg-(--app-c-tw-bg-gray-50)" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                        {/* Custom Icon */}
                        <div className={`w-12 h-16 ${item.iconColor} rounded flex items-center justify-center`}>
                            <div className="w-6 h-6 border-2 border-app-primary rounded-sm relative flex flex-col pt-1">
                                <div className="w-full h-(--app-divider-height-2) bg-app-primary opacity-30"></div>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-center justify-between">
                                <span className="text-(--app-title-text-size-18) font-bold text-(--app-c-tw-text-slate-800)">{item.type}</span>
                                <span className="text-(--app-title-text-size-16) font-black text-app-primary">{item.amount}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                                <span className="text-(--app-settings-item-value-size) font-medium text-(--app-c-tw-text-slate-300)">{item.date}</span>
                                <span className="text-(--app-bookshelf-footer-text-size) font-medium text-(--app-c-tw-text-slate-300)">{item.expiry}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TransactionsPage;

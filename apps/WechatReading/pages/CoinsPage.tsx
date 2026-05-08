import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { dimens } from '../res/dimens';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';

const CoinsPage: React.FC = () => {
    const user = useWechatReadingStore(s => s.user);
    const { bindBack, bindTap } = useWechatReadingGestures();
    const s = useWechatReadingStrings();

    return (
        <div className="flex flex-col h-full bg-app-bg font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-10 pb-4 bg-app-bg">
                <button {...bindBack<HTMLButtonElement>()} className="p-1 active:opacity-60">
                    <IcNavBack size={dimens.book_detail_nav_back_icon_size} className="text-(--app-c-tw-text-slate-700)" />
                </button>
                <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-800) absolute left-1/2 -translate-x-1/2">{s.coins_title}</span>
                <div className="w-10"></div>
            </div>

            <div className="px-5 pt-4 flex flex-col gap-4">
                {/* Balance Card */}
                <div className="bg-app-surface rounded-2xl p-8 flex flex-col items-center shadow-sm">
                    <div className="text-(--app-title-text-size-48) font-black text-(--app-c-tw-text-slate-900) mb-6 font-mono tracking-tight">
                        {user.coinBalance.toFixed(2)}
                    </div>

                    <button className="w-full h-14 bg-(--app-c-tw-bg-gray-100) rounded-2xl text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-400) active:bg-(--app-c-tw-bg-gray-200) mb-5" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                        {s.coins_recharge}
                    </button>

                    <span className="text-(--app-settings-item-value-size) text-(--app-c-tw-text-slate-300) font-medium tracking-wide">
                        {s.coins_no_expire}
                    </span>
                </div>

                {/* List Card */}
                <div className="bg-app-surface rounded-2xl overflow-hidden shadow-sm">
                    <div
                        className="flex items-center justify-between px-6 py-5 active:bg-(--app-c-tw-bg-gray-50) border-b border-(--app-c-tw-border-gray-50) cursor-pointer"
                        {...bindTap<HTMLDivElement>('wallet.transactions.open')}
                    >
                        <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.coins_transactions}</span>
                        <IcNavForward size={dimens.icSizeAction} className="text-(--app-c-tw-text-slate-300)" />
                    </div>
                    <div className="flex items-center justify-between px-6 py-5 active:bg-(--app-c-tw-bg-gray-50) border-b border-(--app-c-tw-border-gray-50)">
                        <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.coins_purchase_books}</span>
                        <IcNavForward size={dimens.icSizeAction} className="text-(--app-c-tw-text-slate-300)" />
                    </div>
                    <div className="flex items-center justify-between px-6 py-5 active:bg-(--app-c-tw-bg-gray-50)">
                        <span className="text-(--app-modal-action-text-size) font-bold text-(--app-c-tw-text-slate-800)">{s.coins_auto_purchase}</span>
                        <IcNavForward size={dimens.icSizeAction} className="text-(--app-c-tw-text-slate-300)" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoinsPage;

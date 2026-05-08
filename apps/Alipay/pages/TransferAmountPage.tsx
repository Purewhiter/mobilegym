import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocale } from '@/apps/Alipay/locale';
import { AmountKeyboard } from '../components/AmountKeyboard';
import { PaymentPasswordModal } from '../components/PaymentPasswordModal';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { IcNavBack, IcSecureCheck } from '../res/icons';
import { useAlipayStore } from '../state';
import { maskPhone } from '../utils/maskPhone';
import { DefaultAvatar } from '../components/DefaultAvatar';

const HINT_KEYS = {
  insufficientBalance: 'insufficient_balance',
  transferSuccess: 'transfer_success',
} as const;

export const TransferAmountPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contactId');
  const {
    recordTransfer,
    transferDraft,
    setTransferDraft,
    setTransferReceipt,
    contacts,
    balance,
    bankCards,
    lastPaymentHint,
    setLastPaymentHint,
  } = useAlipayStore();
  const paymentPassword = useAlipayStore(state => state.userInfo.paymentPassword);
  const { bindTap, bindBack, back, go } = useAlipayGestures();
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [isAmountInputActive, setIsAmountInputActive] = useState(false);
  const isPasswordModalVisible = searchParams.get('modal') === 'password';
  const contactFromUrl = contactId ? contacts.find((contact: any) => String(contact.id) === String(contactId)) : null;
  const displayContact = transferDraft?.contact || contactFromUrl || { name: s.manual_input, account: '' };

  const hintText: Record<string, string> = {
    [HINT_KEYS.insufficientBalance]: isEnglish ? 'Insufficient balance' : '余额不足',
    [HINT_KEYS.transferSuccess]: isEnglish ? 'Transfer successful' : '转账成功',
  };

  const toTransferDisplayName = (name: string) => {
    const base = String(name || '').trim() || s.unknown;
    if (base.includes('(') && base.includes(')')) return `转账-${base}`;
    return `转账-${base}(王若彤)`;
  };

  const handlePaymentSuccess = (methodId: string) => {
    const transferAmount = parseFloat(amount);
    if (Number.isFinite(transferAmount) && transferAmount > 0) {
      const selectedCard = methodId === 'balance'
        ? null
        : (bankCards || []).find(card => card.id === methodId && card.bound) || null;
      const available = methodId === 'balance'
        ? Number(balance?.total || 0)
        : Number(selectedCard?.available || 0);
      const counterpartyName = toTransferDisplayName(displayContact?.name);
      const dc = displayContact as { name?: string; account?: string; phone?: string };
      const typed = String(transferDraft?.inputValue || '').trim();
      const targetAccount =
        typed ||
        String(dc?.account || '').trim() ||
        String(dc?.phone || '').trim() ||
        String(dc?.name || '').trim();
      const transferFields = {
        counterpartyName,
        counterpartyAvatar: displayContact?.avatar,
        note: note ? String(note) : undefined,
        methodId,
        kind: 'transfer' as const,
        detailTimeLabel: '创建时间' as const,
        transferNote: note ? String(note) : '转账',
        targetAccount,
        ...(dc?.phone ? { phoneNumber: String(dc.phone).trim() } : {}),
      };

      if (available < transferAmount) {
        recordTransfer({ ...transferFields, delta: 0 });
        setLastPaymentHint(HINT_KEYS.insufficientBalance);
        setIsAmountInputActive(false);
        amountInputRef.current?.blur();
        back();
        return;
      }

      recordTransfer({ ...transferFields, delta: -transferAmount });
    }

    let paymentMethodLabel = '账户余额';
    if (methodId === 'yuebao') {
      paymentMethodLabel = '余额宝';
    } else if (methodId !== 'balance') {
      const card = (bankCards || []).find(item => item.id === methodId && item.bound);
      if (card) paymentMethodLabel = `${card.bankName}(${card.last4})`;
    }

    setTransferReceipt({ amount, contact: displayContact, paymentMethod: paymentMethodLabel });
    setLastPaymentHint(HINT_KEYS.transferSuccess);
    go('transfer.success.open');
  };

  useEffect(() => {
    if (isAmountInputActive) {
      amountInputRef.current?.focus({ preventScroll: true });
      return;
    }
    amountInputRef.current?.blur();
  }, [isAmountInputActive]);

  useEffect(() => {
    if (isPasswordModalVisible) return;
    setIsAmountInputActive(false);
    amountInputRef.current?.blur();
  }, [isPasswordModalVisible]);

  useEffect(() => {
    if (!contactId) return;
    const contact = contactFromUrl;
    if (!contact) return;
    const currentId = transferDraft?.contact?.id;
    if (String(currentId) === String(contact.id)) return;
    setTransferDraft({ contact, inputValue: contact.name });
  }, [contactFromUrl, contactId, setTransferDraft, transferDraft?.contact?.id]);

  const handleAmountKey = (key: string) => {
    setAmount(previous => {
      if (key === '.') {
        if (previous.includes('.')) return previous;
        return previous === '' ? '0.' : previous + '.';
      }
      if (previous === '0') return key;
      const next = previous + key;
      if (/^\d+\.\d{3,}$/.test(next)) return previous;
      return next;
    });
  };

  const handleAmountDelete = () => {
    setAmount(previous => previous.slice(0, -1));
  };

  const handleConfirmTransfer = () => {
    if (!amount || Number(amount) <= 0) return;
    setIsAmountInputActive(false);
    amountInputRef.current?.blur();
    go('transferAmount.password.open');
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-app-bg pt-10">
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-10 h-10 bg-app-bg" />

      <PaymentPasswordModal
        visible={isPasswordModalVisible}
        amount={amount}
        payeeName={displayContact.name}
        expectedPassword={paymentPassword}
        onSuccess={handlePaymentSuccess}
        bankCards={bankCards}
        balance={balance}
      />

      <div className="sticky top-0 z-20 flex items-center justify-between bg-app-bg px-4 pb-2 pt-4">
        <button {...bindBack<HTMLButtonElement>()} className="p-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.transfer}</span>
        <div className="flex items-center space-x-3">
          <button className="text-sm text-gray-600">{s.transfer_history}</button>
        </div>
      </div>

      <div className="flex items-center px-4 py-4">
        <div className="mr-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded bg-gray-200">
          {displayContact.avatar ? (
            <img src={displayContact.avatar} alt={displayContact.name} className="h-full w-full object-cover" />
          ) : (
            <DefaultAvatar iconSize={24} />
          )}
        </div>
        <div>
          <div className="flex items-center">
            <span className="mr-2 text-lg font-medium text-gray-900">{displayContact.name}</span>
            <IcSecureCheck size={16} className="text-[#CD7F32]" fill="#CD7F32" />
          </div>
          <div className="text-sm text-gray-500">{maskPhone(displayContact.account)}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="mb-4 flex w-full flex-col rounded-xl bg-app-surface p-6 shadow-sm">
          <div className="mb-6 text-sm text-gray-800">{s.transfer_amount}</div>

          <div className="mb-6 flex min-w-0 items-center border-b border-gray-100 pb-4" onClick={() => setIsAmountInputActive(true)}>
            <span className="mr-4 text-[clamp(24px,7vw,32px)] font-bold text-gray-900">¥</span>
            <input
              ref={amountInputRef}
              inputMode="none"
              type="text"
              value={amount}
              onChange={event => {
                const value = event.target.value;
                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) setAmount(value);
              }}
              placeholder={s.enter_amount}
              className="min-w-0 flex-1 bg-transparent text-[clamp(28px,8vw,40px)] font-bold text-gray-900 caret-[#1677FF] outline-none placeholder:text-gray-300"
            />
          </div>

          <div className="mb-2 text-sm text-gray-800">{s.transfer_note}</div>
          <input
            type="text"
            value={note}
            onChange={event => setNote(event.target.value)}
            onFocus={() => setIsAmountInputActive(false)}
            placeholder={s.add_note_50_chars_max}
            className="mb-4 w-full bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-300"
            maxLength={50}
          />

          <div className="mb-2 flex flex-wrap gap-2">
            {[
              { id: 'borrow', label: s.lend },
              { id: 'thanks', label: s.thanks },
              { id: 'living', label: s.living_expenses },
              { id: 'rent', label: s.rent },
              { id: 'buy', label: s.buy_for },
              { id: 'repay', label: s.repayment },
            ].map(item => (
              <button
                key={item.id}
                className="rounded-full border border-app-border bg-app-surface px-4 py-1.5 text-sm text-gray-600 active:bg-gray-50"
                {...bindTap<HTMLButtonElement>({ kind: 'action', id: `transferAmount.note.select.${item.id}` }, { onTrigger: () => setNote(item.label) })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {!isAmountInputActive && (
          <>
            <button
              className={`w-full rounded-full py-3 text-lg font-medium text-white shadow-sm ${amount ? 'bg-app-primary' : 'cursor-not-allowed bg-app-primary/50'}`}
              style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
              disabled={!amount}
              {...(amount ? bindTap<HTMLButtonElement>('transferAmount.password.open') : {})}
            >
              {s.transfer}
            </button>
            {lastPaymentHint && lastPaymentHint !== HINT_KEYS.transferSuccess ? (
              <div className="mt-2 text-center text-xs text-red-500">{hintText[lastPaymentHint] || lastPaymentHint}</div>
            ) : null}

            <div className="flex items-center justify-center space-x-4 py-8 text-xs text-app-primary">
              <button>{s.transfer_protection}</button>
              <span className="text-gray-300">|</span>
              <button>{s.scheduled_transfer}</button>
              <span className="text-gray-300">|</span>
              <button>{s.customer_service}</button>
            </div>
          </>
        )}
      </div>

      <AmountKeyboard
        onInput={handleAmountKey}
        onDelete={handleAmountDelete}
        confirmLabel={s.transfer}
        confirmEnabled={!!amount && Number(amount) > 0}
        onConfirm={handleConfirmTransfer}
        actionPrefix="transferAmount"
        open={isAmountInputActive}
        onToggle={setIsAmountInputActive}
      />
    </div>
  );
};

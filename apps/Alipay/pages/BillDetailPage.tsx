import React from 'react';
import { useParams } from 'react-router-dom';
import { useLocale } from '@/apps/Alipay/locale';
import * as TimeService from '../../../os/TimeService';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { IconRenderer } from '../components/IconRenderer';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { IcCamera, IcGift, IcNavBack, IcNavForward } from '../res/icons';
import { useAlipayStore } from '../state';
import {
  getBillCategoryName,
  getBillDetailTimeLabel,
  getBillDisplayTitle,
  getBillPaymentMethod,
  getRedPacketDirectionLabel,
  isRedPacketRecord,
} from '../utils/bills';
import type { AlipayTransferRecord } from '../types';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { localizeStoredAlipayText } from '../utils/localizeCatalog';

const pad2 = (value: number) => String(value).padStart(2, '0');

const formatDateTime = (timestamp: number) => {
  const date = TimeService.fromTimestamp(timestamp);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

const formatAmount = (delta: number) => {
  const amount = Math.abs(delta).toFixed(2);
  return delta >= 0 ? `+${amount}` : `-${amount}`;
};

const buildDetailRows = (
  record: AlipayTransferRecord,
  s: ReturnType<typeof useAlipayStrings>,
  isEnglish: boolean,
) => {
  const rows: Array<{ label: string; value: React.ReactNode; multiline?: boolean; withArrow?: boolean }> = [];

  rows.push({
    label: getBillDetailTimeLabel(record, isEnglish),
    value: formatDateTime(record.timestamp),
  });

  const isRedPacket = isRedPacketRecord(record);
  const paymentMethod = getBillPaymentMethod(record, isEnglish);
  if (paymentMethod) {
    if (!(isRedPacket && record.delta >= 0)) {
      rows.push({ label: s.payment_method, value: paymentMethod, withArrow: true });
    }
  }
  if (isRedPacket) {
    rows.push({
      label: s.red_packet_description,
      value: getRedPacketDirectionLabel(record, isEnglish),
      multiline: true,
    });
  } else if (record.transferNote) {
    rows.push({ label: s.bill_transfer_note, value: localizeStoredAlipayText(record.transferNote, isEnglish), multiline: true });
  }
  if (record.targetAccount) {
    rows.push({ label: s.target_account, value: localizeStoredAlipayText(record.targetAccount, isEnglish), multiline: true });
  }
  if (record.rechargeDescription) {
    rows.push({ label: s.recharge_description, value: localizeStoredAlipayText(record.rechargeDescription, isEnglish), multiline: true });
  }
  if (record.productDescription) {
    rows.push({ label: s.product_description, value: localizeStoredAlipayText(record.productDescription, isEnglish), multiline: true });
  }
  if (record.phoneNumber) {
    rows.push({ label: s.recharge_number, value: record.phoneNumber });
  }
  if (record.transactionTarget) {
    rows.push({ label: s.transaction_target, value: localizeStoredAlipayText(record.transactionTarget, isEnglish), multiline: true });
  }
  if (typeof record.rewardPoints === 'number') {
    rows.push({
      label: s.payment_reward,
      value: (
        <div className="inline-flex items-center rounded-full bg-[#FFF5E7] px-3 py-1 text-[#D48806]">
          {isEnglish ? `Claim ${record.rewardPoints} points` : `立即领取${record.rewardPoints}积分`}
        </div>
      ),
    });
  }
  if (record.acquiringInstitution) {
    rows.push({ label: s.acquiring_institution, value: localizeStoredAlipayText(record.acquiringInstitution, isEnglish), multiline: true });
  }
  if (record.clearingInstitution) {
    rows.push({ label: s.clearing_institution, value: localizeStoredAlipayText(record.clearingInstitution, isEnglish), multiline: true });
  }
  if (record.payeeFullName) {
    rows.push({ label: s.payee_full_name, value: localizeStoredAlipayText(record.payeeFullName, isEnglish), multiline: true });
  }
  if (record.serviceDetail) {
    rows.push({ label: s.service_detail, value: localizeStoredAlipayText(record.serviceDetail, isEnglish), multiline: true });
  }
  if (record.transactionDetail) {
    rows.push({ label: s.transaction_detail, value: localizeStoredAlipayText(record.transactionDetail, isEnglish), multiline: true });
  }
  if (record.orderId) {
    rows.push({ label: s.order_number, value: record.orderId, multiline: true });
  }
  if (record.merchantOrderId) {
    rows.push({ label: s.merchant_order_number, value: record.merchantOrderId, multiline: true });
  }

  return rows;
};

const SummaryCard: React.FC<{ record: AlipayTransferRecord; isEnglish: boolean }> = ({ record, isEnglish }) => {
  const s = useAlipayStrings();
  const categoryName = getBillCategoryName(record.category, isEnglish);
  const detailRows = buildDetailRows(record, s, isEnglish);

  return (
    <div className="rounded-[24px] bg-white px-5 py-6 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#FFF1C2]">
          {record.counterpartyAvatar ? (
            <img src={record.counterpartyAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <DefaultAvatar iconSize={30} />
          )}
        </div>
        <div className="text-[15px] text-gray-800">{getBillDisplayTitle(record, isEnglish, 'detail')}</div>
        <div className="mt-2 text-[24px] font-semibold text-gray-900">{formatAmount(record.delta)}</div>
        <div className="mt-1 text-sm text-gray-500">{s.transaction_successful}</div>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        {detailRows.map(row => (
          <DetailRow
            key={row.label}
            label={row.label}
            value={row.value}
            multiline={row.multiline}
            withArrow={row.withArrow}
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-[#F8F5EB] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3D5] text-[#B27B19]">
              <IcGift size={18} />
            </div>
            <div className="text-[13px] text-[#9A7A38]">
              {isEnglish ? 'This purchase unlocked the "Meal Time" sticker.' : '你因这笔消费解锁了“吃顿饭”贴纸'}
            </div>
          </div>
          <IcNavForward size={16} className="text-[#B29257]" />
        </div>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-2">
        <DetailRow label={s.bill_category} value={categoryName} withArrow />
        <DetailRow label={s.label_2} value={s.please_select} withArrow />
        <DetailRow
          label={s.recommended_for_you}
          value={<div className="inline-flex rounded-full bg-[#F2F4FA] px-3 py-1 text-xs text-gray-500">{isEnglish ? 'Dining+' : '下饭神器+'}</div>}
        />
      </div>
    </div>
  );
};

const DetailRow: React.FC<{
  label: string;
  value: React.ReactNode;
  withArrow?: boolean;
  multiline?: boolean;
}> = ({ label, value, withArrow = false, multiline = false }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-[72px] pt-0.5 text-gray-400">{label}</div>
    <div className={`flex flex-1 items-start justify-end gap-1 text-right text-gray-800 ${multiline ? 'break-all' : ''}`}>
      <div>{value}</div>
      {withArrow ? <IcNavForward size={16} className="mt-0.5 text-gray-300" /> : null}
    </div>
  </div>
);

export const BillDetailPage: React.FC = () => {
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const { id } = useParams<{ id: string }>();
  const record = useAlipayStore(state => state.transferRecords.find(item => item.id === id));
  const updateTransferRecord = useAlipayStore(state => state.updateTransferRecord);
  const { bindBack } = useAlipayGestures();
  const [noteValue, setNoteValue] = React.useState(record?.note ?? '');

  React.useEffect(() => {
    setNoteValue(record?.note ?? '');
  }, [record?.note]);

  if (!record) {
    return (
      <div className="flex h-full w-full flex-col bg-app-bg pt-10">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-100 bg-app-surface px-4 py-4">
          <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
            <IcNavBack size={22} className="text-gray-800" />
          </button>
          <div className="text-[17px] font-medium text-gray-900">{s.bill_details}</div>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">{s.no_bill_found}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#F5F5F7] pt-10" data-status-bar-foreground="dark">
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-app-surface px-4 py-4">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={22} className="text-gray-800" />
        </button>
        <div className="text-[17px] font-medium text-gray-900">{s.bill_details}</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-3 pb-6">
        <div className="space-y-3">
          <SummaryCard record={record} isEnglish={isEnglish} />

          <div className="rounded-[24px] bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between py-2">
              <div className="text-sm text-gray-700">{s.include_in_income_and_expense}</div>
              <button
                onClick={() => updateTransferRecord(record.id, { includeInBudget: !(record.includeInBudget ?? true) })}
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  record.includeInBudget ?? true ? 'bg-[#2B7CFF]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                    record.includeInBudget ?? true ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="mt-2 border-t border-gray-100 pt-4">
              <div className="mb-2 text-sm text-gray-700">{s.remark}</div>
              <div className="flex items-end gap-3 rounded-2xl bg-[#F7F8FC] px-4 py-3">
                <textarea
                  value={noteValue}
                  onChange={event => setNoteValue(event.target.value)}
                  onBlur={() => updateTransferRecord(record.id, { note: noteValue.trim() })}
                  placeholder={s.tap_to_add_note}
                  rows={2}
                  className="min-h-[48px] flex-1 resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                />
                <IcCamera size={18} className="mb-1 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-white px-4 py-2 shadow-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-2">
              {[
                s.contact_merchant,
                s.view_interaction_history,
                s.aa_request,
                s.transaction_certificate,
                s.request_receipt,
                s.installment,
                s.question_about_order,
              ].map(label => (
                <div key={label} className="flex items-center gap-3 rounded-2xl px-2 py-3 text-sm text-gray-700">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F7FA] text-gray-500">
                    <IconRenderer name="IcFile" size={16} />
                  </div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

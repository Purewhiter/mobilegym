import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { IcNavBack, IcNavForward, IcScan } from '../res/icons';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { now as timeNow } from '../../../os/TimeService';
import type { Passenger } from '../types';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
import { useLocale } from '../../../os/locale';

const ID_TYPES = ['中国居民身份证', '港澳居民来往内地通行证', '台湾居民来往大陆通行证', '护照'];
const TICKET_TYPES = ['成人', '儿童', '学生', '残疾军人'];

type RailwayStrings = ReturnType<typeof useRailwayStrings>;

export const AddPassengerPage: React.FC = () => {
  const { bindBack, back, go } = useRailwayGestures();
  const updatePassengers = useRailwayStore(s => s.updatePassengers);
  const passengers = useRailwayStore(s => s.passengers);
  const location = useLocation();
  const s = useRailwayStrings();
  const isEnglish = useLocale() === 'en';

  const dialog = new URLSearchParams(location.search).get('dialog');
  const showIdTypePicker = dialog === 'idType';
  const showTicketTypePicker = dialog === 'ticketType';
  const showAlert = dialog === 'alert';

  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [name, setName] = useState('');
  const [idNo, setIdNo] = useState('');
  const [ticketType, setTicketType] = useState(TICKET_TYPES[0]);
  const [phone, setPhone] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ idNo?: boolean; phone?: boolean }>({});

  const openAlert = (msg: string) => {
    setAlertMsg(msg);
    go('addPassenger.showAlert' as any);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      openAlert(s.add_passenger_empty_name);
      return;
    }
    if (!idNo.trim()) {
      setFieldErrors({ idNo: true });
      openAlert(s.add_passenger_empty_id);
      return;
    }
    if (idType === '中国居民身份证' && idNo.trim().length !== 18) {
      setFieldErrors({ idNo: true });
      openAlert(s.add_passenger_invalid_id);
      return;
    }
    if (!phone.trim()) {
      setFieldErrors({ phone: true });
      openAlert(s.add_passenger_empty_mobile);
      return;
    }
    if (phone.trim().length !== 11) {
      setFieldErrors({ phone: true });
      openAlert(s.add_passenger_invalid_mobile);
      return;
    }
    setFieldErrors({});
    const duplicate = passengers.some(
      p => p.name === name.trim() && p.idNo === idNo.trim(),
    );
    if (duplicate) {
      openAlert(s.add_passenger_duplicate);
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const newPassenger: Passenger = {
      id: `p${String(timeNow()).slice(-8)}`,
      name: name.trim(),
      idType: idType === ID_TYPES[0] ? '身份证' : idType,
      idNo: idNo.trim(),
      phone: phone.trim() || undefined,
      isDefault: false,
      ticketType,
    };
    updatePassengers([...passengers, newPassenger]);
    setShowConfirm(false);
    back();
  };

  return (
    <div className="min-h-full bg-[#F5F5F5] flex flex-col" data-status-bar-foreground="light">
      <div className="bg-[#4FA4F7] pt-10 pb-3 px-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <button className="p-1" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="text-[17px] text-white font-medium">{s.add_passenger_title}</span>
          <div className="w-[32px]" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        <div className="mx-4 mt-3 bg-white rounded-lg p-4 relative">
          <span className="absolute top-2 right-2 text-[11px] text-[#FF8C00] bg-[#FFF3E6] px-2 py-0.5 rounded">
            {s.add_passenger_recommended}
          </span>
          <div className="flex items-center gap-2 mb-2">
            <IcScan size={20} className="text-[#4FA4F7]" />
            <span className="text-[15px] text-[#4FA4F7] font-medium">
              {s.add_passenger_scan_title}
            </span>
          </div>
          <p className="text-[12px] text-[#999] leading-[18px]">
            {s.add_passenger_scan_desc}
            <span className="text-[#4FA4F7]">{s.add_passenger_view_example}</span>
          </p>
        </div>

        <div className="mx-4 mt-3 rounded-lg overflow-hidden">
          <FormRow label={s.add_passenger_id_type} onClick={() => go('addPassenger.openIdTypePicker' as any)}>
            <span className="text-[14px] text-[#333]">{localizeRailwayText(idType, isEnglish)}</span>
          </FormRow>
          <FormRow label={s.add_passenger_name}>
            <input
              className="flex-1 text-[14px] text-[#333] outline-none bg-transparent placeholder-[#C0C0C0]"
              placeholder={s.add_passenger_name_placeholder}
              value={name}
              onChange={e => { setName(e.target.value); setFieldErrors({}); }}
              data-keep-keyboard="true"
            />
          </FormRow>
          <FormRow label={s.add_passenger_id_number} error={fieldErrors.idNo}>
            <input
              className="flex-1 text-[14px] text-[#333] outline-none bg-transparent placeholder-[#C0C0C0]"
              placeholder={s.add_passenger_id_number_placeholder}
              value={idNo}
              onChange={e => { setIdNo(e.target.value); setFieldErrors({}); }}
              data-keep-keyboard="true"
            />
          </FormRow>
          <FormRow label={s.add_passenger_ticket_type} onClick={() => go('addPassenger.openTicketTypePicker' as any)} border={false}>
            <span className="text-[14px] text-[#333]">{localizeRailwayText(ticketType, isEnglish)}</span>
          </FormRow>
        </div>

        <div className="mt-3 mx-4">
          <div className="text-[13px] text-[#666] mb-2 font-medium">{s.add_passenger_contact_info}</div>
          <div className="rounded-lg overflow-hidden">
            <FormRow label={s.add_passenger_mobile} border={false} error={fieldErrors.phone}>
              <span className="text-[14px] text-[#333] mr-1 flex-shrink-0">+86</span>
              <span className="text-[#E0E0E0] mr-2 flex-shrink-0">|</span>
              <input
                className="w-[130px] text-[14px] text-[#333] outline-none bg-transparent placeholder-[#C0C0C0]"
                placeholder={s.add_passenger_mobile_placeholder}
                value={phone}
                onChange={e => { setPhone(e.target.value); setFieldErrors({}); }}
                data-keep-keyboard="true"
              />
              <User size={18} className="text-[#C0C0C0] flex-shrink-0 ml-1" />
            </FormRow>
            <p className="text-[11px] text-[#4FA4F7] mt-2 leading-[16px]">
              {s.add_passenger_mobile_notice}
            </p>
          </div>
        </div>

        <div className="mx-4 mt-4">
          <button
            onClick={handleSubmit}
            className="w-full h-[44px] rounded-full bg-[#4FA4F7] text-white text-[16px] font-medium active:bg-[#3B8DE5]"
          >
            {s.add_passenger_submit}
          </button>
        </div>

        <Tips s={s} />
      </div>

      {showIdTypePicker && (
        <BottomPicker
          s={s}
          title={s.add_passenger_id_type}
          items={ID_TYPES}
          selected={idType}
          formatItem={item => localizeRailwayText(item, isEnglish)}
          onSelect={v => { setIdType(v); back(); }}
          onClose={() => back()}
        />
      )}

      {showTicketTypePicker && (
        <BottomPicker
          s={s}
          title={s.add_passenger_ticket_type}
          items={TICKET_TYPES}
          selected={ticketType}
          formatItem={item => localizeRailwayText(item, isEnglish)}
          onSelect={v => { setTicketType(v); back(); }}
          onClose={() => back()}
        />
      )}

      {showConfirm && (
        <ConfirmDialog
          s={s}
          isEnglish={isEnglish}
          idType={idType}
          name={name.trim()}
          idNo={idNo.trim()}
          phone={phone.trim()}
          ticketType={ticketType}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
        />
      )}

      {showAlert && alertMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl w-[300px] overflow-hidden">
            <div className="text-center text-[16px] text-[#333] font-bold pt-5 pb-2">
              {s.common_notice}
            </div>
            <div className="text-center text-[14px] text-[#666] px-6 pb-5 leading-[22px]">
              {alertMsg}
            </div>
            <button
              className="w-full py-3.5 text-[15px] text-white font-medium bg-[#4FA4F7] active:bg-[#3B8DE5] border-t border-[#F0F2F5] rounded-b-xl"
              onClick={() => back()}
            >
              {s.action_confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FormRow: React.FC<{
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  border?: boolean;
  error?: boolean;
}> = ({ label, children, onClick, border = true, error }) => (
  <div
    className={`flex items-center px-4 py-3.5 bg-white ${border ? 'border-b border-[#F0F2F5]' : ''} ${onClick ? 'active:bg-gray-50' : ''}`}
    onClick={onClick}
  >
    <span className={`text-[14px] w-[96px] flex-shrink-0 whitespace-normal leading-tight ${error ? 'text-[#E53935]' : 'text-[#333]'}`}>{label}</span>
    <div className="flex-1 min-w-0 flex items-center">{children}</div>
    {onClick && <IcNavForward size={16} className="text-[#C0C0C0] flex-shrink-0 ml-1" />}
  </div>
);

const Tips: React.FC<{ s: RailwayStrings }> = ({ s }) => (
  <div className="mx-4 mt-4">
    <div className="text-[13px] text-[#666] font-medium mb-1.5">{s.add_passenger_tips_title}</div>
    <ol className="text-[11px] text-[#999] leading-[18px] list-none pl-0 space-y-1">
      <li>{s.add_passenger_tips_1}</li>
      <li>{s.add_passenger_tips_2}</li>
      <li>{s.add_passenger_tips_3}</li>
      <li>{s.add_passenger_tips_4}</li>
    </ol>
  </div>
);

const BottomPicker: React.FC<{
  s: RailwayStrings;
  title: string;
  items: string[];
  selected: string;
  formatItem: (item: string) => string;
  onSelect: (v: string) => void;
  onClose: () => void;
}> = ({ s, title, items, selected, formatItem, onSelect, onClose }) => (
  <div className="fixed inset-0 z-50 flex flex-col justify-end">
    <div className="absolute inset-0 bg-black/40" onClick={onClose} />
    <div className="relative bg-white rounded-t-xl pb-6 animate-slide-up">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F2F5]">
        <button className="text-[14px] text-[#999]" onClick={onClose}>{s.action_cancel}</button>
        <span className="text-[15px] text-[#333] font-medium">{title}</span>
        <div className="w-[32px]" />
      </div>
      {items.map(item => (
        <div
          key={item}
          className={`px-4 py-3.5 text-[15px] border-b border-[#F8F8F8] last:border-b-0 active:bg-gray-50 ${item === selected ? 'text-[#4FA4F7] font-medium' : 'text-[#333]'}`}
          onClick={() => onSelect(item)}
        >
          {item === selected ? `${formatItem(item)} ✓` : formatItem(item)}
        </div>
      ))}
    </div>
  </div>
);

const ConfirmDialog: React.FC<{
  s: RailwayStrings;
  isEnglish: boolean;
  idType: string;
  name: string;
  idNo: string;
  phone: string;
  ticketType: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ s, isEnglish, idType, name, idNo, phone, ticketType, onCancel, onConfirm }) => {
  const rows = [
    { label: `${s.add_passenger_id_type}：`, value: localizeRailwayText(idType, isEnglish) },
    { label: `${s.add_passenger_name}：`, value: name },
    { label: `${s.add_passenger_id_number}：`, value: idNo },
    { label: `${s.add_passenger_mobile}：`, value: phone || s.add_passenger_not_provided },
    { label: `${s.add_passenger_ticket_type}：`, value: localizeRailwayText(ticketType, isEnglish) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-xl w-[300px] overflow-hidden">
        <div className="text-center text-[16px] text-[#333] font-medium pt-5 pb-3">
          {s.add_passenger_confirm_title}
        </div>
        <div className="px-5 pb-4">
          {rows.map(r => (
            <div key={r.label} className="flex py-2">
              <span className="text-[13px] text-[#999] w-[88px] flex-shrink-0 whitespace-pre-line leading-tight">{r.label}</span>
              <span className="text-[14px] text-[#333] font-medium break-all min-w-0 flex-1">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="flex border-t border-[#F0F2F5]">
          <button
            className="flex-1 py-3.5 text-[15px] text-[#666] border-r border-[#F0F2F5] active:bg-gray-50"
            onClick={onCancel}
          >
            {s.action_cancel}
          </button>
          <button
            className="flex-1 py-3.5 text-[15px] text-white font-medium bg-[#4FA4F7] active:bg-[#3B8DE5] rounded-br-xl"
            onClick={onConfirm}
          >
            {s.action_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

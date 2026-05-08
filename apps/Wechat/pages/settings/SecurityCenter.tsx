
import React, { useState } from 'react';
import { IcClose, IcMore, IcKeyRound, IcShieldOff, IcLock, IcLockOpen, IcAlertTriangle, IcXCircle } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { useWechatStrings } from '../../hooks/useWechatStrings';

const SECURITY_ITEMS_CONFIG = [
  {
    icon: IcKeyRound,
    titleKey: 'security_recover_password' as const,
    descKey: 'security_recover_password_desc' as const,
    route: undefined as string | undefined,
  },
  {
    icon: IcShieldOff,
    titleKey: 'security_unblock_account' as const,
    descKey: 'security_unblock_account_desc' as const,
    route: undefined,
  },
  {
    icon: IcLock,
    titleKey: 'security_freeze_account' as const,
    descKey: 'security_freeze_account_desc' as const,
    route: undefined,
  },
  {
    icon: IcLockOpen,
    titleKey: 'security_unfreeze_account' as const,
    descKey: 'security_unfreeze_account_desc' as const,
    route: undefined,
  },
  {
    icon: IcAlertTriangle,
    titleKey: 'security_report_rights' as const,
    descKey: 'security_report_rights_desc' as const,
    route: undefined,
  },
  {
    icon: IcXCircle,
    titleKey: 'account_delete_title' as const,
    descKey: 'security_delete_account_desc' as const,
    route: '/settings/security-center/delete-account',
  },
];

export const SecurityCenterPage: React.FC = () => {
  const { bindBack, bindTap } = useWechatGestures();
  const t = useWechatStrings();

  return (
    <div className="bg-[#f5f5f5] min-h-full pb-10 pt-10">
      <div className="flex items-center px-4 h-12 bg-[#f5f5f5]">
        <button {...bindBack<HTMLButtonElement>()} className="w-8 h-8 flex items-center justify-center">
          <IcClose size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 text-center font-medium text-[17px]">{t.security_wechat_center}</div>
        <button className="w-8 h-8 flex items-center justify-center">
          <IcMore size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {SECURITY_ITEMS_CONFIG.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.titleKey}
              className="bg-white rounded-lg px-5 py-5 flex items-start gap-4 active:bg-gray-50 cursor-pointer"
              {...(item.route ? bindTap<HTMLDivElement>('account.delete.open') : {})}
            >
              <div className="flex-shrink-0 mt-0.5">
                <Icon size={24} className="text-[#07c160]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-black leading-tight">{t[item.titleKey]}</div>
                <div className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">{t[item.descKey]}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <span className="text-[14px] text-[#576b95]">{t.security_help_center}</span>
      </div>
    </div>
  );
};

const DELETION_CONDITION_KEYS = [
  { num: 1, titleKey: 'account_delete_condition_1_title' as const, descKey: 'account_delete_condition_1_desc' as const },
  { num: 2, titleKey: 'account_delete_condition_2_title' as const, descKey: 'account_delete_condition_2_desc' as const },
  { num: 3, titleKey: 'account_delete_condition_3_title' as const, descKey: 'account_delete_condition_3_desc' as const },
  { num: 4, titleKey: 'account_delete_condition_4_title' as const, descKey: 'account_delete_condition_4_desc' as const },
  { num: 5, titleKey: 'account_delete_condition_5_title' as const, descKey: 'account_delete_condition_5_desc' as const },
  { num: 6, titleKey: 'account_delete_condition_6_title' as const, descKey: 'account_delete_condition_6_desc' as const },
];

export const AccountDeletionPage: React.FC = () => {
  const { bindBack, bindTap } = useWechatGestures();
  const [agreed, setAgreed] = useState(false);
  const t = useWechatStrings();

  return (
    <div className="bg-white min-h-full pb-10 pt-10">
      <div className="flex items-center px-4 h-12 bg-white">
        <button {...bindBack<HTMLButtonElement>()} className="w-8 h-8 flex items-center justify-center">
          <IcClose size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 text-center font-medium text-[17px]">{t.account_delete_title}</div>
        <button className="w-8 h-8 flex items-center justify-center">
          <IcMore size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex justify-center mt-6">
        <div className="w-14 h-14 rounded-full border-2 border-[#07c160] flex items-center justify-center">
          <IcXCircle size={32} className="text-[#07c160]" />
        </div>
      </div>

      <div className="text-center mt-4 text-[18px] font-bold">{t.account_delete_apply_title}</div>

      <div className="px-6 mt-6 text-[14px] text-gray-600 leading-relaxed">{t.account_delete_verify_intro}</div>

      <div className="px-6 mt-5 space-y-5">
        {DELETION_CONDITION_KEYS.map(item => (
          <div key={item.num} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full border border-[#07c160] flex items-center justify-center mt-0.5">
              <span className="text-[12px] text-[#07c160] font-medium">{item.num}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-black">{t[item.titleKey]}</div>
              <div className="text-[13px] text-gray-500 mt-1 leading-relaxed">{t[item.descKey]}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center mt-8 px-6 gap-2">
        <button
          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
            agreed ? 'bg-[#07c160] border-[#07c160]' : 'border-gray-400'
          }`}
          onClick={() => setAgreed(!agreed)}
        >
          {agreed && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <span className="text-[13px] text-gray-600">
          {t.account_delete_agree_read}
          <span className="text-[#576b95]">{t.account_delete_agree_important}</span>
        </span>
      </div>

      <div className="px-10 mt-6">
        <button
          className={`w-full py-3 rounded-lg text-[16px] font-medium ${
            agreed ? 'bg-[#07c160] text-white active:bg-[#06ad56]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          disabled={!agreed}
          {...bindTap<HTMLButtonElement>('account.delete.apply')}
        >
          {t.account_delete_request_submit}
        </button>
      </div>
    </div>
  );
};

const DATA_WARNING_KEYS = [
  'account_delete_data_warning_1',
  'account_delete_data_warning_2',
  'account_delete_data_warning_3',
  'account_delete_data_warning_4',
] as const;

export const DataWarningPage: React.FC = () => {
  const { bindBack, bindTap } = useWechatGestures();
  const t = useWechatStrings();

  return (
    <div className="bg-white min-h-full flex flex-col pt-10">
      <div className="flex items-center px-4 h-12 bg-white">
        <button {...bindBack<HTMLButtonElement>()} className="w-8 h-8 flex items-center justify-center">
          <IcClose size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 text-center font-medium text-[17px]">{t.account_delete_title}</div>
        <button className="w-8 h-8 flex items-center justify-center">
          <IcMore size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex justify-center mt-8">
        <div className="w-16 h-16 relative">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M32 4L8 16v16c0 17.7 10.2 34.2 24 40 13.8-5.8 24-22.3 24-40V16L32 4z" fill="#F5A623" />
            <text x="32" y="42" textAnchor="middle" fontSize="28" fontWeight="bold" fill="white">
              !
            </text>
          </svg>
        </div>
      </div>

      <div className="text-center mt-4 px-8 text-[15px] text-gray-700 leading-relaxed">{t.account_delete_warning_intro}</div>

      <div className="mt-6 bg-[#f7f7f7]">
        {DATA_WARNING_KEYS.map((key, i) => (
          <div key={key} className="px-6 py-5 border-b border-gray-200 last:border-b-0">
            <span className="text-[15px] text-black">
              {i + 1}. {t[key]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1" />

      <div className="px-10 pb-10">
        <button
          className="w-full py-3 rounded-lg text-[16px] font-medium bg-[#07c160] text-white active:bg-[#06ad56]"
          {...bindTap<HTMLButtonElement>('account.delete.next')}
        >
          {t.common_next}
        </button>
      </div>
    </div>
  );
};

export const ImportantReminderPage: React.FC = () => {
  const { bindBack, bindTap } = useWechatGestures();
  const cancelAccount = useWechatStore(s => s.cancelAccount);
  const t = useWechatStrings();

  return (
    <div className="bg-white min-h-full flex flex-col pt-10">
      <div className="flex items-center px-4 h-12 bg-white">
        <button {...bindBack<HTMLButtonElement>()} className="w-8 h-8 flex items-center justify-center">
          <IcClose size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 text-center font-medium text-[17px]">{t.account_delete_title}</div>
        <button className="w-8 h-8 flex items-center justify-center">
          <IcMore size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <div className="text-center mt-6 text-[18px] font-bold">{t.account_delete_important_title}</div>

        <div className="mt-5 text-[15px] text-black leading-[1.8]">{t.account_delete_important_intro}</div>

        <div className="mt-5 text-[15px] text-black leading-[1.8]">{t.account_delete_important_note}</div>

        <div className="mt-5 space-y-5">
          <div className="text-[15px] text-black leading-[1.8]">{t.account_delete_important_p1}</div>
          <div className="text-[15px] text-black leading-[1.8]">{t.account_delete_important_p2}</div>
          <div className="text-[15px] text-black leading-[1.8]">{t.account_delete_important_p3}</div>
          <div className="text-[15px] text-black leading-[1.8]">{t.account_delete_important_p4}</div>
        </div>
      </div>

      <div className="px-10 pb-10 pt-3 bg-white">
        <button
          className="w-full py-3 rounded-lg text-[16px] font-medium bg-[#fa5151] text-white active:bg-[#e04848]"
          {...bindTap<HTMLButtonElement>('account.delete.confirm', { beforeTrigger: () => cancelAccount() })}
        >
          {t.account_delete_confirm_agree}
        </button>
      </div>
    </div>
  );
};

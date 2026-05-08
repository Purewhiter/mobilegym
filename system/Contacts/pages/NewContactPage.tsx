import React, { useRef, useState } from 'react';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { IcSymbolClose, IcSymbolExpandMore, IcSymbolOk } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { createContact } from '../state';

export const NewContactPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindBack, back } = useContactsGestures();
  const s = useAppStrings(strings, stringsEn);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1400);
  };

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const save = () => {
    if (!name.trim()) {
      showToast(s.new_contact_name_required);
      return;
    }

    createContact({
      displayName: name.trim(),
      company: company.trim() || undefined,
      title: title.trim() || undefined,
      phones: mobile.trim()
        ? [{ id: 'p1', label: '手机', number: mobile.trim(), isPrimary: true }]
        : [],
      emails: email.trim()
        ? [{ id: 'e1', label: '工作', email: email.trim(), isPrimary: true }]
        : [],
      starred: false,
    });

    back(1);
  };

  return (
    <div className="h-full w-full bg-app-bg">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-30 bg-app-bg">
        <div className="h-10" />
        <div className="px-4 h-12 flex items-center justify-between">
          <button
            type="button"
            aria-label={isEnglish ? 'Back' : '返回'}
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon name={IcSymbolClose} size={22} className="text-app-text" />
          </button>

          <div className="flex items-center gap-1 text-[18px] font-semibold text-app-text">
            {s.new_contact_title}
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-app-text-muted" />
          </div>

          <button
            type="button"
            aria-label={isEnglish ? 'Save contact' : '保存联系人'}
            onClick={save}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon name={IcSymbolOk} size={22} className="text-app-text" />
          </button>
        </div>
      </div>

      <div
        className="h-[calc(100%-88px)] overflow-y-auto no-scrollbar pb-10"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div className="px-6 pt-4 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-black/10 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white/80" />
          </div>
          <button
            type="button"
            className="mt-3 px-5 py-2 rounded-full bg-app-surface text-[14px] font-semibold text-gray-700 active:bg-black/5"
            onClick={() => showToast(isEnglish ? `${s.scanBusinessCard} (not implemented)` : `${s.scanBusinessCard}（未实现）`)}
          >
            {s.scanBusinessCard}
          </button>
        </div>

        <div className="mx-4 mt-4 bg-app-surface rounded-3xl overflow-hidden">
          <div className="px-5 py-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.new_contact_placeholder_name}
              className="w-full text-[18px] font-semibold text-app-text outline-none placeholder:text-gray-300"
              autoFocus
            />
          </div>
        </div>

        <div className="mx-4 mt-3 bg-app-surface rounded-3xl overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5">
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={s.new_contact_placeholder_company}
              className="w-full text-[16px] text-app-text outline-none placeholder:text-gray-300"
            />
          </div>
          <div className="px-5 py-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={s.new_contact_placeholder_job_title}
              className="w-full text-[16px] text-app-text outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

        <div className="mx-4 mt-3 bg-app-surface rounded-3xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2 border-b border-black/5">
            <div className="text-[18px] font-semibold text-app-text">{s.new_contact_label_mobile}</div>
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-gray-400" />
          </div>
          <div className="px-5 py-4">
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder={s.new_contact_placeholder_phone}
              className="w-full text-[16px] text-app-text outline-none placeholder:text-gray-300"
              inputMode="tel"
            />
          </div>
        </div>

        <div className="mx-4 mt-3 bg-app-surface rounded-3xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2 border-b border-black/5">
            <div className="text-[18px] font-semibold text-app-text">{s.new_contact_label_work}</div>
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-gray-400" />
          </div>
          <div className="px-5 py-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={s.new_contact_placeholder_email}
              className="w-full text-[16px] text-app-text outline-none placeholder:text-gray-300"
              inputMode="email"
            />
          </div>
        </div>

        <div className="mx-4 mt-3 bg-app-surface rounded-3xl overflow-hidden">
          <button
            type="button"
            className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5"
            onClick={() => showToast(isEnglish ? 'Group name is not implemented yet' : '群组名称（未实现）')}
          >
            <div className="text-[18px] font-semibold text-app-text">{s.new_contact_label_group}</div>
            <span className="text-gray-300 rotate-[-90deg]">
              <SymbolIcon name={IcSymbolExpandMore} size={18} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { PHONE_SETTINGS_PAGES } from '../data/phoneSettingsPages.generated';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useSimProfiles } from '../hooks/useSimProfiles';
import { IcNavBack, IcNavForward } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import type { SimProfile } from '../phoneTypes';
import type { PhoneSettingsItem } from '../settings/types';
import { useBooleanPreference, useStringPreference } from '../state';
import { getPhoneSettingsPageTitle, localizePhoneSettingsPage, localizePhoneSettingsText } from '../utils/localizedText';

const PAGE_KEY_TO_SETTINGS_PAGE: Record<string, Record<string, string>> = {
  preference_settings: {
    pref_key_import_export: 'preference_import_and_export',
    pref_key_contact_filter: 'preference_account_list_filter',
    pref_key_contacts_more: 'preference_more',
    pref_key_contacts_display: 'preference_display_options',
    pref_key_privacy_setting: 'preference_privacy_settings',
  },
  preference_privacy_settings: {
    pref_key_contacts_privacy_settings: 'preference_privacy_contacts',
    pref_key_yellowpage_privacy_settings: 'preference_privacy_permission',
  },
  miui_call_feature_setting: {
    pref_key_call_network_setting: 'miui_network_setting',
    pref_key_call_record_setting: 'call_record_setting',
    button_call_forwarding: 'miui_callforward_options',
    button_voicemail_callforward: 'miui_voicemail_callforward_options',
    button_call_waiting: 'call_waiting',
    button_answer_state_setting: 'answer_state_setting',
    pref_key_telocation: 'location_setting',
    button_auto_answer_screen: 'auto_answer_setting',
    call_fold_setting: 'call_fold_setting',
    call_advanced_setting: 'call_advanced_setting',
    pref_key_privacy_policy: 'privacy_setting',
    button_phone_account: 'miui_phone_account_settings',
  },
  privacy_setting: {
    pref_key_permission_description: 'permission_setting',
  },
  call_advanced_setting: {
    pref_key_dial_pad_touch_tone: 'preference_dial_pad_touch_tone_v11',
    pref_key_auto_ip: 'auto_ip_setting',
    button_respond_via_sms_key: 'miui_respond_via_sms_settings',
    button_fdn: 'miui_fdn_setting',
    button_voicemail: 'voicemail_setting',
    button_phone_account: 'miui_phone_account_settings',
  },
};

function resolveTargetPage(currentPageId: string | undefined, itemKey: string): string | undefined {
  if (!currentPageId || !itemKey) return undefined;
  return PAGE_KEY_TO_SETTINGS_PAGE[currentPageId]?.[itemKey];
}

function resolveDynamicListOptions(
  item: PhoneSettingsItem,
  sims: SimProfile[],
): Array<{ label: string; value: string }> {
  if (item.key === 'button_preferred_phone_account') {
    return sims.map((sim) => ({
      label: `${sim.label} (${sim.numberMasked})`,
      value: String(sim.slot),
    }));
  }
  return item.options || [];
}

const SwitchRow: React.FC<{
  title: string;
  summary?: string;
  settingKey: string;
  defaultChecked?: boolean;
  showDivider?: boolean;
}> = ({ title, summary, settingKey, defaultChecked = false, showDivider = true }) => {
  const [checked, setChecked] = useBooleanPreference(settingKey, defaultChecked);

  return (
    <div>
      <button
        type="button"
        className="w-full px-4 py-4 flex items-center justify-between active:bg-black/5 text-left"
        onClick={() => setChecked(!checked)}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-[15px] text-app-text">{title}</div>
          {summary ? <div className="text-[12px] text-gray-400 mt-1 line-clamp-2">{summary}</div> : null}
        </div>
        <div
          className={[
            'w-[44px] h-[26px] rounded-full p-[2px] flex items-center transition-colors',
            checked ? 'bg-[#3482FF] justify-end' : 'bg-gray-300 justify-start',
          ].join(' ')}
        >
          <div className="w-[22px] h-[22px] rounded-full bg-app-surface shadow-sm" />
        </div>
      </button>
      {showDivider ? <div className="h-px bg-black/5 ml-4" /> : null}
    </div>
  );
};

const PreferenceRow: React.FC<{
  title: string;
  summary?: string;
  showDivider?: boolean;
  onClick?: () => void;
  valueText?: string;
}> = ({ title, summary, showDivider = true, onClick, valueText }) => (
  <div>
    <button
      type="button"
      className="w-full px-4 py-4 flex items-center justify-between active:bg-black/5 text-left"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-[15px] text-app-text">{title}</div>
        {summary ? <div className="text-[12px] text-gray-400 mt-1 line-clamp-2">{summary}</div> : null}
      </div>
      <div className="flex items-center gap-1">
        {valueText ? <span className="text-[13px] text-gray-400">{valueText}</span> : null}
        <IcNavForward className="w-5 h-5 text-gray-300" />
      </div>
    </button>
    {showDivider ? <div className="h-px bg-black/5 ml-4" /> : null}
  </div>
);

const ListSheet: React.FC<{
  open: boolean;
  title: string;
  summary?: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onClose: () => void;
  onPick: (value: string) => void;
}> = ({ open, title, summary, options, value, onClose, onPick }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const s = useAppStrings(strings, stringsEn);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => sheetRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-3 pb-3">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full max-w-[420px] bg-app-surface rounded-[28px] overflow-hidden shadow-2xl outline-none"
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="text-[17px] font-semibold text-app-text">{title}</div>
          {summary ? <div className="mt-1 text-[12px] text-gray-400 leading-snug line-clamp-2">{summary}</div> : null}
        </div>
        <div className="max-h-[55vh] overflow-y-auto no-scrollbar">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className="w-full px-6 py-4 text-left text-[16px] active:bg-gray-50 flex items-center justify-between"
                onClick={() => onPick(option.value)}
              >
                <span className={selected ? 'text-[#3482FF] font-medium' : 'text-app-text'}>{option.label}</span>
                {selected ? <span className="text-[#3482FF] text-[14px] font-medium">{s.settings_selected}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="px-6 pb-6 pt-2">
          <button
            type="button"
            className="w-full py-3 rounded-2xl bg-gray-50 text-[16px] font-medium text-app-text active:bg-gray-100"
            onClick={onClose}
          >
            {s.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};

const ListRow: React.FC<{
  item: PhoneSettingsItem;
  settingKey: string;
  sims: SimProfile[];
  showDivider?: boolean;
  onMissingOptions: () => void;
}> = ({ item, settingKey, sims, showDivider = true, onMissingOptions }) => {
  const options = resolveDynamicListOptions(item, sims);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useStringPreference(settingKey, item.defaultValue ?? (options[0]?.value ?? ''));

  const selectedLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label || '';
  }, [options, value]);

  return (
    <>
      <PreferenceRow
        title={item.title}
        summary={item.summary}
        valueText={selectedLabel || undefined}
        showDivider={showDivider}
        onClick={() => {
          if (!options.length) {
            onMissingOptions();
            return;
          }
          setOpen(true);
        }}
      />

      <ListSheet
        open={open}
        title={item.title}
        summary={item.summary}
        options={options}
        value={value}
        onClose={() => setOpen(false)}
        onPick={(nextValue) => {
          setValue(nextValue);
          setOpen(false);
        }}
      />
    </>
  );
};

const Inner: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { pageId } = useParams<{ pageId: string }>();
  const { bindBack, go } = useContactsGestures();
  const sims = useSimProfiles();
  const s = useAppStrings(strings, stringsEn);
  const rawPage = pageId ? PHONE_SETTINGS_PAGES[pageId] : undefined;
  const page = useMemo(() => localizePhoneSettingsPage(rawPage, locale), [locale, rawPage]);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1600);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const title = page?.title || (pageId ? getPhoneSettingsPageTitle(pageId, locale) : s.settings_calls_title);

  const renderItem = (item: PhoneSettingsItem, index: number, total: number) => {
    const isLast = index === total - 1;
    const key = item.key || `${pageId}__${item.type}__${index}`;

    if (item.type === 'switch' || item.type === 'checkbox') {
      return (
        <SwitchRow
          key={key}
          title={item.title}
          summary={item.summary}
          settingKey={key}
          defaultChecked={item.defaultValue === 'true'}
          showDivider={!isLast}
        />
      );
    }

    if (item.type === 'footer') {
      return (
        <div key={key} className="px-4 py-3 text-[12px] text-gray-400">
          {item.summary || item.title}
        </div>
      );
    }

    if (item.type === 'list') {
      return (
        <ListRow
          key={key}
          item={item}
          settingKey={key}
          sims={sims}
          showDivider={!isLast}
          onMissingOptions={() => showToast(isEnglish ? 'This setting does not provide selectable options' : '该设置项未提供可选项，可能由系统动态生成')}
        />
      );
    }

    const targetPage = resolveTargetPage(pageId, item.key);
    if (targetPage && PHONE_SETTINGS_PAGES[targetPage]) {
      return (
        <PreferenceRow
          key={key}
          title={item.title}
          summary={item.summary}
          showDivider={!isLast}
          onClick={() => go('settings.page.open', { pageId: targetPage })}
        />
      );
    }

    const defaultValue =
      item.defaultValue && item.defaultValue !== 'true' && item.defaultValue !== 'false'
        ? localizePhoneSettingsText(item.defaultValue, locale)
        : undefined;

    return (
      <PreferenceRow
        key={key}
        title={item.title}
        summary={item.summary}
        valueText={defaultValue}
        showDivider={!isLast}
        onClick={() => showToast(isEnglish ? 'This setting opens a system page on a real device' : '此设置项在真机上会打开系统页面，当前模拟暂不支持')}
      />
    );
  };

  if (!pageId) {
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <div className="h-10" />
        <div className="px-6 py-10 text-[13px] text-gray-400">{isEnglish ? 'No page specified' : '未指定页面'}</div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="h-full bg-app-bg flex flex-col">
        <Toast visible={toast.visible} message={toast.message} />
        <div className="sticky top-0 z-20 bg-app-bg">
          <div className="h-10" />
          <div className="flex items-center h-12 px-3">
            <button
              type="button"
              aria-label={isEnglish ? 'Back' : '返回'}
              {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
              className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
            >
              <IcNavBack size={24} className="text-app-text" />
            </button>
            <div className="flex-1 text-center text-[16px] font-semibold text-app-text">{title}</div>
            <div className="w-10" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="text-center text-gray-400">
            <div className="text-[14px] font-medium text-app-text-muted mb-1">{title}</div>
            <div className="text-[12px] text-gray-400">
              {isEnglish ? 'This page has not been exported from XML yet' : '该页面尚未从 XML 导出'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-20 bg-app-bg">
        <div className="h-10" />
        <div className="flex items-center h-12 px-3">
          <button
            type="button"
            aria-label={isEnglish ? 'Back' : '返回'}
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
          >
            <IcNavBack size={24} className="text-app-text" />
          </button>
          <div className="flex-1 text-center text-[16px] font-semibold text-app-text">{title}</div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8" data-scroll-container="main" data-scroll-direction="vertical">
        {page.categories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="px-4 mt-3">
            {category.title ? <div className="px-2 pb-2 text-[12px] text-gray-400">{category.title}</div> : null}
            <div className="bg-app-surface rounded-2xl overflow-hidden">
              {category.items.map((item, itemIndex) => renderItem(item, itemIndex, category.items.length))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PhonePreferenceScreenPage: React.FC = () => {
  return <Inner />;
};

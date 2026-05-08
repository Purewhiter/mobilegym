import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcNavForward, IcSecureCheck, IcFastPay, IcClose } from '../res/icons';
import { SimplePaymentPasswordModal } from '../components/SimplePaymentPasswordModal';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
const Toggle: React.FC<{ checked: boolean; tapProps: any }> = ({ checked, tapProps }) => {
  return (
    <button
      {...tapProps}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${checked ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
    >
      <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
    </button>
  );
};

const PhoneMock: React.FC<{ label: string; payLabel: string }> = ({ label, payLabel }) => {
  return (
    <div className="flex justify-center">
      <div className="w-[260px] h-[340px] bg-app-surface rounded-[36px] shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-14 bg-app-surface"></div>
        <div className="absolute top-20 left-10 right-10 h-44 bg-gray-50 rounded-2xl border border-gray-100"></div>
        <div className="absolute top-40 left-1/2 -translate-x-1/2 text-app-primary text-5xl font-bold">{payLabel}</div>
        <div className="absolute top-[220px] left-1/2 -translate-x-1/2 text-gray-600 text-sm">{label}</div>
      </div>
    </div>
  );
};

export const FastPaySettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack, back } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const enabled = settings.payment.fastPay.enabled;
  const noPwdEnabled = settings.payment.fastPay.noPwdEnabled;
  const easterEggEnabled = settings.payment.fastPay.easterEggEnabled;

  const [searchParams] = useSearchParams();
  const modal = searchParams.get('modal');
  const isAgreementOpen = modal === 'agreement';
  const isPasswordOpen = modal === 'password';
  const isNoPwdDisableConfirmOpen = modal === 'noPwdDisableConfirm';
  const isDisableFastPayConfirmOpen = modal === 'disableFastPayConfirm';

  const [faqOpen, setFaqOpen] = React.useState<string | null>(null);

  return (
    <div className="h-full w-full flex flex-col pt-10 bg-gradient-to-b from-[#DDEBFF] to-app-bg">
      <div className="fixed top-0 left-0 right-0 h-10 bg-[#DDEBFF] z-10 pointer-events-none"></div>
      <SimplePaymentPasswordModal
        visible={isPasswordOpen}
        expectedPassword={'000000'}
        onSuccess={() => {
          setSettings((prev) => ({
            ...prev,
            payment: { ...prev.payment, fastPay: { ...prev.payment.fastPay, noPwdEnabled: true } },
          }));
          back(1);
        }}
      />

      {isAgreementOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-black/40 z-0"
          ></div>
          <div
            className="relative z-10 w-full max-w-[430px] bg-app-surface rounded-t-2xl px-5 pt-5 pb-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium text-gray-900">{s.enable_small_amount_payment}</div>
              <button className="text-gray-300" {...bindBack<HTMLButtonElement>({ stopPropagation: true })}>
                <IcClose size={22} />
              </button>
            </div>
            <div className="text-sm text-gray-500 mt-3">
              {s.agree}
              <button className="text-app-primary mx-1">{s.payment_authorization_agreement}</button>
            </div>
            <button
              className="mt-4 w-full bg-app-primary text-white text-base font-medium py-3.5 rounded-full shadow-sm"
              {...bindTap<HTMLButtonElement>('fastPay.noPwd.password.open', { stopPropagation: true })}
            >
              {s.agree_and_enable}
            </button>
          </div>
        </div>
      )}

      {isNoPwdDisableConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-6">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-black/40 z-0"
          ></div>
          <div className="relative z-10 w-full max-w-[380px] bg-app-surface rounded-2xl p-6">
            <div className="text-center text-base font-medium text-gray-900">{s.reminder}</div>
            <div className="text-center text-sm text-gray-500 mt-3">{s.disable_quick_pay_no_password_mode}</div>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 border border-app-primary text-app-primary bg-app-surface py-3 rounded-full font-medium"
                {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
              >
                {s.reconsider}
              </button>
              <button
                className="flex-1 bg-app-primary text-white py-3 rounded-full font-medium"
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'fastPay.noPwd.disable.submit' },
                  {
                    onTrigger: () => {
                      setSettings((prev) => ({ ...prev, payment: { ...prev.payment, fastPay: { ...prev.payment.fastPay, noPwdEnabled: false } } }));
                      back(1);
                    },
                  },
                )}
              >
                {s.confirm_disable}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDisableFastPayConfirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-6">
          <div
            {...bindBack<HTMLDivElement>({ stopPropagation: true })}
            className="absolute inset-0 bg-black/40 z-0"
          ></div>
          <div className="relative z-10 w-full max-w-[380px] bg-app-surface rounded-2xl p-6">
            <div className="text-center text-base font-medium text-gray-900">{s.disable_quick_pay}</div>
            <div className="mt-5 flex gap-3">
              <button
                className="flex-1 border border-app-primary text-app-primary bg-app-surface py-3 rounded-full font-medium"
                {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
              >
                {s.cancel}
              </button>
              <button
                className="flex-1 bg-app-primary text-white py-3 rounded-full font-medium"
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'fastPay.disable.submit' },
                  {
                    onTrigger: () => {
                      setSettings((prev) => ({ ...prev, payment: { ...prev.payment, fastPay: { ...prev.payment.fastPay, enabled: false, noPwdEnabled: false } } }));
                      back(1);
                    },
                  },
                )}
              >
                {s.confirm_disable}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 px-4 pt-4 pb-2 flex items-center justify-between">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <div className="w-6" />
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 pb-28">
        <div className="relative">
          <div className="absolute right-0 top-0 w-32 h-32 rounded-3xl bg-app-primary/20 blur-xl"></div>
          <div className="absolute right-4 top-1 w-20 h-20 bg-gradient-to-br from-[#7CB7FF] to-app-primary rounded-[24px] rotate-12 opacity-80"></div>

          <div className="pt-2">
            <div className="text-2xl font-semibold text-gray-900">{enabled ? s.hi_you_have_enabled : s.turn_on}</div>
            <div className="text-4xl font-bold text-gray-900 mt-1">{s.quick_pay}</div>
            {enabled && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                <IcSecureCheck size={16} className="text-app-primary" />
                {s.account_secured}
              </div>
            )}
          </div>
        </div>

        {!enabled ? (
          <div className="mt-5 bg-app-surface rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4">
              <div className="flex items-center justify-center text-gray-400 text-sm">
                <span className="w-12 h-[1px] bg-gray-200 mr-3"></span>
                {s.what_is_quick_pay}
                <span className="w-12 h-[1px] bg-gray-200 ml-3"></span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div>
                  <div className="w-10 h-10 rounded-full bg-[#E8F2FF] mx-auto flex items-center justify-center">
                    <IcFastPay size={18} className="text-app-primary" />
                  </div>
                  <div className="text-sm text-gray-800 mt-2">{s.faster_startup}</div>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-[#E8F2FF] mx-auto flex items-center justify-center">
                    <IcSecureCheck size={18} className="text-app-primary" />
                  </div>
                  <div className="text-sm text-gray-800 mt-2">{s.clean_interface}</div>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-[#E8F2FF] mx-auto flex items-center justify-center">
                    <div className="w-5 h-5 rounded bg-app-primary text-white text-xs flex items-center justify-center">{s.fastpaysettingspage_pw}</div>
                  </div>
                  <div className="text-sm text-gray-800 mt-2">{s.small_amount_no_password}</div>
                </div>
              </div>
              <div className="text-sm text-gray-500 leading-relaxed mt-4 pb-4">
                {s.quick_pay_enables_faster_checkout_with_a_clean}
              </div>
            </div>

            <div className="bg-[#F7FAFF] px-4 py-5">
              <PhoneMock label={s.quick_pay_active} payLabel={s.transferpage_pay} />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 bg-app-surface rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-center text-gray-400 text-sm">
                  <span className="w-12 h-[1px] bg-gray-200 mr-3"></span>
                  {s.settings_3}
                  <span className="w-12 h-[1px] bg-gray-200 ml-3"></span>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                <div
                  className="px-4 py-4 flex items-start justify-between active:bg-gray-50"
                  {...(noPwdEnabled ? bindTap<HTMLDivElement>('fastPay.noPwd.disableConfirm.open') : bindTap<HTMLDivElement>('fastPay.noPwd.agreement.open'))}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{s.no_password_payment}</div>
                      <span className="text-[10px] text-app-primary bg-[#E8F2FF] px-2 py-0.5 rounded-full">{s.faster_payment}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{s.pay_without_password_for_amounts_under_200}</div>
                  </div>
                  <Toggle
                    checked={noPwdEnabled}
                    tapProps={
                      noPwdEnabled
                        ? bindTap<HTMLButtonElement>('fastPay.noPwd.disableConfirm.open', { stopPropagation: true })
                        : bindTap<HTMLButtonElement>('fastPay.noPwd.agreement.open', { stopPropagation: true })
                    }
                  />
                </div>

                {noPwdEnabled && (
                  <div className="bg-[#F7FAFF] mx-4 mb-3 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6ECFF]">
                      <span className="text-sm text-gray-700">{s.per_transaction_limit}</span>
                      <div className="flex items-center text-sm text-gray-400">
                        ¥200 <IcNavForward size={16} className="text-gray-300 ml-1" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-700">{s.daily_limit}</span>
                      <div className="flex items-center text-sm text-gray-400">
                        {s.unlimited} <IcNavForward size={16} className="text-gray-300 ml-1" />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="px-4 py-4 flex items-center justify-between active:bg-gray-50"
                  {...bindTap<HTMLDivElement>('fastPay.payOrder.open')}
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-sm font-medium text-gray-900">{s.preferred_payment}</div>
                    <div className="text-xs text-gray-400 mt-1">{s.charges_per_payment_order}</div>
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <span className="mr-2">{s.set_up}</span>
                    <IcNavForward size={16} className="text-gray-300" />
                  </div>
                </div>

                <div
                  className="px-4 py-4 flex items-center justify-between active:bg-gray-50"
                  {...bindTap<HTMLDivElement>(
                    { kind: 'action', id: 'fastPay.easterEgg.toggle' },
                    { onTrigger: () => setSettings((prev) => ({ ...prev, payment: { ...prev.payment, fastPay: { ...prev.payment.fastPay, easterEggEnabled: !prev.payment.fastPay.easterEggEnabled } } })) },
                  )}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-gray-900">{s.payment_easter_egg}</div>
                      <span className="text-[10px] text-white bg-red-500 px-2 py-0.5 rounded-full">{s.limited_time_2}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{s.see_lucky_quotes_and_special_effects_when_paying}</div>
                  </div>
                  <div className="flex items-center text-xs text-gray-400">
                    <span className="mr-2">{easterEggEnabled ? s.generalsettingspage_on : s.generalsettingspage_off}</span>
                    <IcNavForward size={16} className="text-gray-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 bg-app-surface rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-center text-gray-400 text-sm">
                  <span className="w-12 h-[1px] bg-gray-200 mr-3"></span>
                  {s.how_to_use_quick_pay}
                  <span className="w-12 h-[1px] bg-gray-200 ml-3"></span>
                </div>
              </div>
              <div className="bg-[#F7FAFF] px-4 py-5">
                <PhoneMock label={s.quick_pay_active} payLabel={s.transferpage_pay} />
              </div>
            </div>

            <div className="mt-5 bg-app-surface rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-4 flex items-center justify-center text-gray-400 text-sm">
                <span className="w-12 h-[1px] bg-gray-200 mr-3"></span>
                {s.fastpaysettingspage_faq}
                <span className="w-12 h-[1px] bg-gray-200 ml-3"></span>
              </div>
              <div className="divide-y divide-gray-100">
                <button
                  className="w-full px-4 py-4 text-left active:bg-gray-50"
                  onClick={() => setFaqOpen((v) => (v === 'q1' ? null : 'q1'))}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-900">{s.n_1_what_if_quick_pay_uses_the_wrong_payment_method}</div>
 <IcNavForward size={16} className={`text-gray-300 ${faqOpen === 'q1' ? 'rotate-90' : ''}`}
 style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
                  </div>
                  {faqOpen === 'q1' && (
                    <div className="text-xs text-gray-500 mt-3 leading-relaxed">
                      {s.n_1_set_preferred_payment_on_this_page_2_you_can}
                    </div>
                  )}
                </button>
                <button
                  className="w-full px-4 py-4 text-left active:bg-gray-50"
                  onClick={() => setFaqOpen((v) => (v === 'q2' ? null : 'q2'))}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-900">{s.n_2_why_cant_i_use_quick_pay_in_some_scenarios}</div>
 <IcNavForward size={16} className={`text-gray-300 ${faqOpen === 'q2' ? 'rotate-90' : ''}`}
 style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
                  </div>
                  {faqOpen === 'q2' && (
                    <div className="text-xs text-gray-500 mt-3 leading-relaxed">
                      {s.different_merchants_scenarios_may_vary_if}
                    </div>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe pt-3 bg-gradient-to-t from-app-bg via-app-bg to-transparent">
        {!enabled ? (
          <button
            className="w-full bg-app-primary text-white text-base font-medium py-3.5 rounded-full shadow-sm"
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'fastPay.enabled.toggle' },
              { onTrigger: () => setSettings((prev) => ({ ...prev, payment: { ...prev.payment, fastPay: { ...prev.payment.fastPay, enabled: true } } })) },
            )}
          >
            {s.enable}
          </button>
        ) : (
          <button
            className="w-full border border-app-primary text-app-primary bg-app-surface text-base font-medium py-3.5 rounded-full shadow-sm"
            {...bindTap<HTMLButtonElement>('fastPay.disableConfirm.open')}
          >
            {s.disable_quick_pay_2}
          </button>
        )}
      </div>
    </div>
  );
};

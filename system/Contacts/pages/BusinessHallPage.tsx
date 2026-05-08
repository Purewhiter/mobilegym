import React from 'react';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { CONTACTS_CONFIG } from '../data';
import { useSimProfiles } from '../hooks/useSimProfiles';
import type { SimProfile } from '../phoneTypes';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcNavForward } from '../res/icons';
import { readPhoneSettingsPreference } from '../state';

const Card: React.FC<{
  className: string;
  children: React.ReactNode;
}> = ({ className, children }) => (
  <div className={['rounded-3xl overflow-hidden', className].join(' ')}>{children}</div>
);

function resolvePreferredSimSlot(sims: SimProfile[]): number {
  const raw = readPhoneSettingsPreference<string | number>('button_preferred_phone_account');
  const candidate = Number(raw);
  if (Number.isInteger(candidate) && sims.some((sim) => sim.slot === candidate)) {
    return candidate;
  }
  return sims[0]?.slot ?? 1;
}

export const BusinessHallPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useAppStrings(strings, stringsEn);
  const sims = useSimProfiles();
  const businessHall = CONTACTS_CONFIG.businessHall;
  const preferredSimSlot = resolvePreferredSimSlot(sims);

  const orderedSims = React.useMemo(() => {
    const index = sims.findIndex((sim) => sim.slot === preferredSimSlot);
    if (index <= 0) return sims;
    return [sims[index], ...sims.filter((_, simIndex) => simIndex !== index)];
  }, [preferredSimSlot, sims]);

  const preferredSim = orderedSims.find((sim) => sim.slot === preferredSimSlot) || orderedSims[0];
  const greeting = preferredSim ? `${s.bh_greeting_prefix}${preferredSim.label}${s.bh_greeting_suffix}` : businessHall.greeting;

  const rechargeItems = [
    {
      amount: 30,
      disabled: true,
      note: isEnglish ? 'This amount is temporarily unavailable' : '该面额暂时下架',
    },
    {
      amount: 50,
      note: isEnglish ? 'Price CNY 50.00' : '售价 50.00 元',
    },
    {
      amount: 100,
      note: isEnglish ? 'Price CNY 100.00' : '售价 100.00 元',
    },
    { amount: 200, note: '' },
    { amount: 300, note: '' },
    { amount: 500, note: '' },
  ];

  return (
    <div className="h-full w-full bg-app-bg relative">
      <div className="sticky top-0 z-20 bg-app-bg">
        <div className="h-10" />
        <div className="px-6 pt-2 pb-3">
          <div className="text-[36px] font-semibold text-app-text">{s.businessHallLabel}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[118px]" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="px-6">
          <div className="bg-white/80 rounded-2xl p-2 flex gap-2">
            {orderedSims.map((sim) => (
              <div
                key={sim.slot}
                className={[
                  'flex-1 bg-app-surface rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm',
                  sim.slot === preferredSimSlot ? 'ring-2 ring-app-primary/30' : '',
                ].join(' ')}
              >
                <div className="w-5 h-5 rounded-md bg-black/5 flex items-center justify-center text-[12px] font-semibold text-gray-600">
                  {sim.slot}
                </div>
                <div className="text-[14px] font-semibold text-gray-800 truncate">{sim.numberMasked}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pt-4 text-[14px] text-gray-400">{greeting}</div>

        <div className="px-6 mt-3 grid grid-cols-2 gap-3">
          <Card className="bg-[#4A90FF] text-white">
            <div className="p-4">
              <div className="text-[14px] opacity-90">{s.bh_data_remaining}</div>
              <div className="mt-2 text-[36px] font-semibold leading-none">
                {businessHall.dataRemainingMb.toFixed(1)}
                <span className="text-[14px] font-semibold ml-1">MB</span>
              </div>
              <div className="mt-2 text-[12px] opacity-80">{businessHall.dataUpdatedText}</div>
              <div className="mt-4 text-[14px] font-semibold flex items-center gap-1 opacity-95">
                {s.bh_data_usage_analysis} <IcNavForward className="w-4 h-4" />
              </div>
            </div>
          </Card>

          <div className="grid grid-rows-2 gap-3">
            <Card className="bg-app-surface">
              <div className="p-4">
                <div className="text-[14px] text-gray-400">{s.bh_balance}</div>
                <div className="mt-1 text-[28px] font-semibold text-app-text">
                  {businessHall.balanceYuan.toFixed(2)}
                  <span className="text-[13px] font-semibold text-gray-400 ml-1">{s.bh_yuan_unit}</span>
                </div>
              </div>
            </Card>
            <Card className="bg-app-surface">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-[14px] text-gray-400">{s.bh_voice_used}</div>
                  <div className="mt-1 text-[28px] font-semibold text-app-text">
                    {businessHall.voiceUsedMinutes}
                    <span className="text-[13px] font-semibold text-gray-400 ml-1">{s.bh_minutes_unit}</span>
                  </div>
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[20px]"
                  style={{
                    backgroundColor: 'rgba(29, 205, 58, 0.15)',
                    color: 'var(--app-c-call-button-background)',
                  }}
                >
                  *
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="px-6 mt-4">
          <div className="h-[62px] rounded-2xl bg-gradient-to-r from-[#8B0000] to-[#C62828] text-white flex items-center justify-between px-4">
            <div>
              <div className="text-[18px] font-semibold">{isEnglish ? '150 GB data plan' : '150G大流量卡'}</div>
              <div className="text-[12px] opacity-90 mt-1">
                {isEnglish ? 'Get up to CNY 150 in bonuses, from CNY 24 per month' : '赠费最高可达150元，低至24元/月'}
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-white/15 text-[12px] font-semibold">
              {isEnglish ? 'Pick a lucky number' : '自选靓号'}
            </div>
          </div>
        </div>

        <div className="px-6 mt-5">
          <div className="flex items-center justify-between">
            <div className="text-[20px] font-semibold text-app-text">{s.bh_recharge_title}</div>
            <button type="button" className="text-[14px] text-gray-400 active:opacity-70">
              {s.bh_other_number_recharge} <IcNavForward className="inline w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {rechargeItems.map((item) => (
              <button
                key={item.amount}
                type="button"
                className={[
                  'h-[64px] rounded-2xl bg-app-surface flex flex-col items-center justify-center active:bg-black/5',
                  item.disabled ? 'opacity-50' : '',
                ].join(' ')}
                disabled={item.disabled}
              >
                <div className="text-[22px] font-semibold text-app-text">
                  {item.amount}
                  {s.bh_yuan_unit}
                </div>
                <div className="text-[12px] text-gray-400 mt-1">{item.note}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

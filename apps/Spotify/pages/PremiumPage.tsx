import React from 'react';
import { useLocale } from '@/os/locale';
import { PREMIUM_PLANS } from '../data';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { IcCheck, SpotifyLogoIcon } from '../res/icons';
import { localizePremiumPlan } from '../utils/localizePremiumPlan';

export const PremiumPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();
  const { bindTap } = useSpotifyGestures();
  const plans = PREMIUM_PLANS.map((plan) => localizePremiumPlan(plan, isEnglish));

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className="h-full bg-app-surface text-white pt-10 pb-24 overflow-y-auto no-scrollbar"
    >
      <div className="px-4 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-white rounded-full p-1">
            <SpotifyLogoIcon size={16} fill="black" />
          </div>
          <span className="font-bold text-sm">Premium</span>
        </div>

        <h1 className="text-3xl font-extrabold mb-4 leading-tight">{s.premium_hero_title}</h1>

        <button
          {...bindTap('premium.payment.open', { params: { planId: plans[0].id } })}
          className="w-full bg-white text-black font-bold rounded-full py-3.5 text-base mb-4 active:scale-95 transition-transform"
        >
          {s.premium_trial_button}
        </button>

        <p className="text-[11px] text-gray-400 leading-relaxed mb-8">
          {s.premium_trial_desc}
        </p>

        <div className="bg-[#242424] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">{s.premium_why_title}</h2>
          <ul className="space-y-4">
            {[
              s.premium_feature_no_ads,
              s.premium_feature_download,
              s.premium_feature_any_order,
              s.premium_feature_lossless,
              s.premium_feature_listen_together,
              s.premium_feature_manage_queue,
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <IcCheck size={20} className="text-app-primary" strokeWidth={3} />
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <h2 className="text-xl font-bold mb-4">{s.premium_available_plans}</h2>
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="bg-[#242424] rounded-lg p-4 relative overflow-hidden flex flex-col">
              {plan.tag && (
                <div className={`absolute top-0 left-0 px-3 py-1 text-xs font-bold rounded-br-lg ${plan.tagColor}`}>
                  {plan.tag}
                </div>
              )}

              <div className="mt-8 mb-2 flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.2-1.32 9.6-0.66 13.38 1.68.42.299.6.839.36 1.141zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 14.82 1.14.54.3.719.96.42 1.5-1.001.2-1.1.2-1.2.2z" />
                  </svg>
                  <span className="font-bold text-sm">Premium</span>
                </div>
                <h3 className={`text-2xl font-bold ${plan.titleColor}`}>{plan.name}</h3>
              </div>

              <div className="mb-4 border-b border-gray-700 pb-4">
                <div className="font-bold text-base">{plan.pricePrimary}</div>
                {plan.priceSecondary && (
                  <div className="text-gray-400 text-sm font-medium">{plan.priceSecondary}</div>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1 text-sm text-gray-200">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-white block">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                {...bindTap('premium.payment.open', { params: { planId: plan.id } })}
                className={`w-full py-3.5 rounded-full font-bold text-sm hover:scale-105 transition-transform ${plan.buttonBg} ${plan.buttonTextColor}`}
              >
                {plan.buttonText}
              </button>

              <div className="mt-3 text-[10px] text-gray-400 leading-tight">
                <p>{s.premium_plan_terms}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

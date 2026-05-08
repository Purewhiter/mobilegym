import React, { useMemo, useState } from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { PREMIUM_PLANS } from '../data';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { IcNavBackArrow, SpotifyLogoIcon } from '../res/icons';
import { localizePremiumPlan } from '../utils/localizePremiumPlan';

export const PaymentPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const s = useSpotifyStrings();
  const { bindBack, bindTap } = useSpotifyGestures();
  const [searchParams] = useSearchParams();
  const [paymentMethod, setPaymentMethod] = useState<'spotify' | 'google'>('spotify');
  const planId = searchParams.get('planId') ?? 'individual';
  const selectedPlan = useMemo(() => {
    const found = PREMIUM_PLANS.find((plan) => plan.id === planId) ?? PREMIUM_PLANS[0];
    return localizePremiumPlan(found, isEnglish);
  }, [isEnglish, planId]);

  const priceValue = selectedPlan.pricePrimary.includes('HK$0')
    ? 'HK$0.00'
    : selectedPlan.pricePrimary.replace('/mo', '');

  return (
    <div className="h-full bg-app-surface text-white flex flex-col font-sans">
      <div className="flex items-center p-4 bg-app-surface">
        <button {...bindBack()} className="mr-4">
          <IcNavBackArrow size={24} />
        </button>
        <div className="font-bold text-lg">{s.payment_checkout}</div>
      </div>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="flex-1 overflow-y-auto px-4 pb-10"
      >
        <div className="flex justify-end mb-4">
          <button className="text-gray-400 text-sm font-bold underline" {...bindBack()}>
            {s.payment_change_plan}
          </button>
        </div>

        <div className="bg-[#242424] rounded-lg p-4 flex items-center gap-4 mb-8">
          <div
            className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: selectedPlan.colorHex }}
          >
            <SpotifyLogoIcon size={24} fill="black" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div className="font-bold text-lg">{`Premium ${selectedPlan.name}`}</div>
              <div className="text-right">
                <div className="font-bold text-lg">{priceValue}</div>
                <div className="text-xs text-gray-400">{s.payment_per_month}</div>
              </div>
            </div>
            <div className="text-sm text-gray-300 mt-1">{selectedPlan.features[0] ?? 'Premium'}</div>
          </div>
        </div>

        <div className="text-gray-400 text-sm mb-8 space-y-1">
          <div>• {s.payment_billing_note_1}</div>
          <div>
            • {s.payment_billing_note_2} <span className="underline">{s.payment_terms_link}</span>
          </div>
        </div>

        <div className="h-[1px] bg-gray-700 w-full mb-8" />

        <h2 className="text-2xl font-bold mb-4">{s.payment_select_method}</h2>
        <div className="text-sm text-gray-400 mb-6">{s.payment_method_desc}</div>

        <div className="flex gap-4 mb-8">
          <button
            {...bindTap(
              { kind: 'action', id: 'payment.method.select.spotify' },
              { onTrigger: () => setPaymentMethod('spotify') },
            )}
            className={`flex-1 py-4 rounded border-2 flex items-center justify-center gap-2 font-bold transition-colors ${paymentMethod === 'spotify' ? 'border-app-primary bg-app-primary/10' : 'border-gray-600 hover:border-white'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={paymentMethod === 'spotify' ? '#1ED760' : 'white'} xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.2-1.32 9.6-0.66 13.38 1.68.42.299.6.839.36 1.141zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 14.82 1.14.54.3.719.96.42 1.5-1.001.2-1.1.2-1.2.2z" />
            </svg>
            Spotify
          </button>
          <button
            {...bindTap(
              { kind: 'action', id: 'payment.method.select.google' },
              { onTrigger: () => setPaymentMethod('google') },
            )}
            className={`flex-1 py-4 rounded border-2 flex items-center justify-center gap-2 font-bold transition-colors ${paymentMethod === 'google' ? 'border-app-primary bg-app-primary/10' : 'border-gray-600 hover:border-white'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 2v20l17-10L4 2z" fill={paymentMethod === 'google' ? '#1ED760' : 'white'} />
            </svg>
            Google Play
          </button>
        </div>

        {paymentMethod === 'spotify' && (
          <div className="bg-[#242424] p-4 rounded-lg mb-8">
            <div className="text-gray-400 text-sm mb-3">{s.payment_spotify_desc}</div>
            <div className="flex gap-2">
              <div className="bg-white text-black px-2 py-1 rounded font-bold text-xs italic">VISA</div>
              <div className="bg-white text-black px-2 py-1 rounded font-bold text-xs">Mastercard</div>
              <div className="bg-blue-600 text-white px-2 py-1 rounded font-bold text-xs">AMEX</div>
              <div className="bg-white text-black px-2 py-1 rounded font-bold text-xs border border-blue-500 text-blue-500">JCB</div>
              <div className="bg-gray-700 text-white px-2 py-1 rounded text-xs">+ 2</div>
            </div>
          </div>
        )}

        <button className="w-full bg-app-primary text-black font-bold py-3 rounded-full text-lg hover:scale-105 transition-transform">
          {s.payment_continue_spotify}
        </button>

        <div className="flex items-center justify-center gap-4 mt-8 text-sm font-bold text-gray-400">
          <span>{s.payment_region}</span>
          <span className="w-[1px] h-4 bg-gray-600" />
          <span>{s.payment_change_region}</span>
        </div>
      </div>
    </div>
  );
};

import type { PremiumPlan } from '../types';

const PREMIUM_PLAN_EN: Record<PremiumPlan['id'], Partial<PremiumPlan>> = {
  individual: {
    tag: '1 month for HK$0',
    pricePrimary: '1 month for HK$0',
    priceSecondary: 'Then HK$78/mo',
    features: ['1 Premium account', 'Cancel anytime'],
    buttonText: 'Try 1 month for HK$0',
  },
  student: {
    tag: '1 month for HK$0',
    pricePrimary: '1 month for HK$0',
    priceSecondary: 'Then HK$38/mo',
    features: ['1 verified Premium account', 'Discount for eligible students', 'Cancel anytime'],
    buttonText: 'Try 1 month for HK$0',
  },
  duo: {
    pricePrimary: 'HK$98/mo',
    features: ['2 Premium accounts', 'Cancel anytime'],
    buttonText: 'Get Premium Duo',
  },
  family: {
    pricePrimary: 'HK$128/mo',
    features: ['Up to 6 Premium accounts', 'Parental controls for the plan manager', 'Cancel anytime'],
    buttonText: 'Get Premium Family',
  },
};

export function localizePremiumPlan(plan: PremiumPlan, isEnglish: boolean): PremiumPlan {
  if (!isEnglish) return plan;
  return {
    ...plan,
    ...PREMIUM_PLAN_EN[plan.id],
  };
}

// Single source of truth for in-app purchase products.
//
// These product IDs MUST match exactly what's registered in App Store Connect,
// Google Play Console, RevenueCat, AND the backend catalog (lib/iap/catalog.ts
// on the server). The actual credit/plan GRANT happens server-side via the
// RevenueCat webhook — nothing here grants anything. Prices shown here are
// fallbacks; RevenueCat provides the localized price string at runtime.

export type PlanTier = 'free' | 'creator' | 'pro' | 'studio';

export interface SubPlan {
  productId: string;
  tier: Exclude<PlanTier, 'free'>;
  name: string;
  priceLabel: string; // fallback only
  monthlyCredits: number;
  blurb: string;
}

export interface CreditPack {
  productId: string;
  credits: number;
  priceLabel: string; // fallback only
  popular?: boolean;
}

// Auto-renewable subscriptions (one RevenueCat offering, three packages).
export const SUB_PLANS: SubPlan[] = [
  { productId: 'formula.sub.creator.monthly', tier: 'creator', name: 'Creator', priceLabel: '$9.99',  monthlyCredits: 20,  blurb: 'For creators posting every week.' },
  { productId: 'formula.sub.pro.monthly',     tier: 'pro',     name: 'Pro',     priceLabel: '$14.99', monthlyCredits: 35,  blurb: 'For creators posting daily.' },
  { productId: 'formula.sub.studio.monthly',  tier: 'studio',  name: 'Studio',  priceLabel: '$39.99', monthlyCredits: 100, blurb: 'For teams and power users.' },
];

// Consumable credit packs (buyable repeatedly).
export const CREDIT_PACKS: CreditPack[] = [
  { productId: 'formula.credits.5',  credits: 5,  priceLabel: '$2.99'  },
  { productId: 'formula.credits.10', credits: 10, priceLabel: '$4.99'  },
  { productId: 'formula.credits.25', credits: 25, priceLabel: '$10.99', popular: true },
  { productId: 'formula.credits.60', credits: 60, priceLabel: '$23.99' },
];

export const ALL_PRODUCT_IDS: string[] = [
  ...SUB_PLANS.map((p) => p.productId),
  ...CREDIT_PACKS.map((p) => p.productId),
];

export function planLabel(tier?: string | null): string {
  switch (tier) {
    case 'creator': return 'Creator';
    case 'pro':     return 'Pro';
    case 'studio':  return 'Studio';
    default:        return 'Free';
  }
}

// Client-side credit costs (the backend is the real enforcer — these just let
// us block early and prompt to buy). Keep in sync with docs/pricing.md.
export const CREDIT_COSTS = {
  script: 1,
  productAnalysis: 1,
  brainRefresh: 2,
} as const;

export const FREE_MONTHLY_CREDITS = 3;

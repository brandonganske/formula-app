// Single source of truth for in-app purchase products.
//
// These product IDs MUST match exactly what's registered in App Store Connect,
// Google Play Console, RevenueCat, AND the backend catalog (lib/iap/catalog.ts
// on the server). The actual credit/plan GRANT happens server-side via the
// RevenueCat webhook — nothing here grants anything. Prices shown here are
// fallbacks; RevenueCat provides the localized price string at runtime.

// 'unlimited' is the only plan. creator/pro/studio never shipped (deleted in ASC).
export type PlanTier = 'free' | 'creator' | 'pro' | 'studio' | 'unlimited';

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

// One subscription: Unlimited. (monthlyCredits 0 = the plan is the entitlement.)
export const SUB_PLANS: SubPlan[] = [
  { productId: 'formula.sub.unlimited.monthly', tier: 'unlimited', name: 'Unlimited', priceLabel: '$14.99', monthlyCredits: 0, blurb: 'Every script, every tool, no counting.' },
];
export const UNLIMITED_PLAN = SUB_PLANS[0];

// Consumable script packs (buyable repeatedly).
export const CREDIT_PACKS: CreditPack[] = [
  { productId: 'formula.credits.5',  credits: 5,  priceLabel: '$2.99'  },
  { productId: 'formula.credits.10', credits: 10, priceLabel: '$4.99'  },
  { productId: 'formula.credits.25', credits: 25, priceLabel: '$10.99', popular: true },
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
    case 'unlimited': return 'Unlimited';
    default:        return 'Free';
  }
}

// Client-side credit costs (the backend is the real enforcer — these just let
// us block early and prompt to buy). Keep in sync with docs/pricing.md.
// The unit is a "script": 1 script = 1 AI run. Product analysis is free.
export const CREDIT_COSTS = {
  script: 1,
  productAnalysis: 0,
  brainRefresh: 2,
} as const;

/** "1 script" / "2 scripts" / "Free" — the only way the unit should be written. */
export const scriptsLabel = (n: number) => (n === 0 ? 'Free' : `${n} script${n === 1 ? '' : 's'}`);
/** On a button: what a run costs. */
export const usesLabel = (n: number) => (n === 0 ? 'Free' : `Uses ${scriptsLabel(n)}`);

export const FREE_MONTHLY_CREDITS = 5;

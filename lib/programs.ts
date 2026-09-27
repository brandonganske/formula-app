import { api, extractData } from './api';

// Brand programs, deals and payouts for the signed-in creator. Served by
// Influenceish HQ through IQ (GET/POST /creators/me/programs).

export type ProgramsHome = {
  linked: boolean;
  message?: string; // shown when not linked yet ("Connect your TikTok…")
  creator: { handle: string; name: string | null; avatar: string | null } | null;
  formula?: { verified: boolean; payoutSetupUrl: string | null; payoutsBlockedReason: string | null };
  // Open programs and deal offers anyone can join (join-link access).
  open?: { kind: 'program' | 'offer'; id: string; slug: string; name: string; description: string | null; brand: string; logo: string | null; approval: 'auto' | 'manual'; summary: string; platforms: ('tiktok' | 'meta')[] }[];
  programs: {
    enrollmentId: string; status: 'invited' | 'pending' | 'active'; agreedAt: string | null;
    program: { name: string; brand: string; logo: string | null; basis: 'sales_pct' | 'spend_pct'; rate: number; attribution: string; holdingDays: number; cadence: string; monthlyCap: number | null; terms: string | null; programStatus: string };
    earnings: { earned: number; eligible: number; pending: number; sales: number; spend: number; orders: number } | null;
    earningsAllTime?: { earned: number; eligible: number; pending: number; sales: number; spend: number; orders: number } | null;
    // The creator's own Shopify discount code for this brand (null when the program has codes off).
    discountCode?: { code: string; percent: number } | null;
  }[];
  offers: { memberId: string; status: 'invited' | 'pending'; name: string; description: string | null; terms: string | null; brand: string; logo: string | null; summary: string; platforms: ('tiktok' | 'meta')[]; durationDays: number | null }[];
  deals: { id: string; brand: string; type: 'package' | 'per_video' | 'retainer'; status: string; totalAmount: number | null; perVideoRate: number | null; videoTarget: number | null; delivered: number; earned: number; paid: number; owed: number; dueDate: string | null }[];
  payouts: { amount: number; method: string; status: 'paid' | 'pending'; destination: string | null; at: string; label: string }[];
  challenges: { id: string; title: string; description: string | null; type: 'gmv' | 'videos' | 'orders'; goal: number; reward: string; endsOn: string; brand: string | null; joined: boolean; progress: number; completed: boolean; rewardClaimed: boolean }[];
  submitBrands: { id: string; name: string }[];
  submissions: { id: string; brand: string; status: 'submitted' | 'launched' | 'declined'; permalink: string | null; at: string; platform?: 'tiktok' | 'instagram'; hasCode?: boolean }[];
  profile?: { legalName: string | null; email: string | null; country: string; method: 'stripe' | 'paypal' | null; paypalEmail: string | null; stripeConnected: boolean; stripeReady: boolean };
  stripeAvailable?: boolean;
  // Log in with PayPal (HQ). Optional for older hub versions.
  paypal?: { connected: boolean; email: string | null; verified: boolean | null; name: string | null };
  paypalAvailable?: boolean;
};

export async function getProgramsHome(): Promise<ProgramsHome> {
  return extractData<ProgramsHome>(await api.get('/creators/me/programs'));
}

type Action =
  | { action: 'agree'; enrollmentId: string }
  | { action: 'accept_offer'; memberId: string }
  | { action: 'submit_post'; storeId: string; permalink?: string; adCode?: string; instagram?: string; note?: string }
  | { action: 'profile'; legalName: string; email: string; country: string; method: 'stripe' | 'paypal'; paypalEmail?: string }
  | { action: 'join_challenge'; challengeId: string }
  | { action: 'join'; slug: string }
  | { action: 'stripe-link'; returnUrl: string; refreshUrl: string }
  | { action: 'paypal-connect'; returnUrl: string }
  | { action: 'paypal-disconnect' }
  | { action: 'stripe-status' };

export async function programsAction(body: Action): Promise<{ ok: boolean; ready?: boolean; url?: string; status?: 'approved' | 'pending'; already?: boolean }> {
  return extractData(await api.post('/creators/me/programs', body));
}

// Shared onboarding option lists — used by both the onboarding flow and the
// Profile tab's inline editors so the two never drift apart.

export interface OptionDef { label: string; value: string; sub?: string }

// Clean a TikTok handle from whatever the user pastes — a bare handle, an
// @handle, or a full profile URL (https://www.tiktok.com/@username?lang=en).
export function normalizeTikTokHandle(input: string | null | undefined): string {
  let s = (input ?? '').trim();
  const url = s.match(/tiktok\.com\/@?([A-Za-z0-9._]+)/i);
  if (url) return url[1];
  s = s.replace(/^@+/, '').trim();   // strip leading @(s)
  s = s.split(/[\s/?#]/)[0];          // drop anything after a space/slash/query
  return s;
}

// True when the user pasted something that looks like a URL/link rather than a
// bare handle — used to warn them up front (we still clean it on submit).
export function looksLikeLink(input: string | null | undefined): boolean {
  const s = (input ?? '').trim();
  if (!s) return false;
  return /https?:\/\/|www\.|tiktok\.com|\.com|\.[a-z]{2,}\//i.test(s);
}

export const NICHE_OPTIONS: OptionDef[] = [
  { label: 'Beauty', value: 'beauty' },
  { label: 'Fitness', value: 'fitness' },
  { label: 'Health & Wellness', value: 'health_wellness' },
  { label: 'Fashion', value: 'fashion' },
  { label: 'Food', value: 'food' },
  { label: 'Tech', value: 'tech' },
  { label: 'Business', value: 'business' },
  { label: 'Lifestyle', value: 'lifestyle' },
  { label: 'Gaming', value: 'gaming' },
  { label: 'Education', value: 'education' },
  { label: 'Other', value: 'other' },
];

export const POST_FREQUENCY_OPTIONS: OptionDef[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'A few times a week', value: 'few_times_week' },
  { label: 'Weekly', value: 'weekly' },
];

export const CREATION_GOAL_OPTIONS: OptionDef[] = [
  { label: 'Grow my audience', value: 'grow_audience' },
  { label: 'Sell products', value: 'sell_products' },
  { label: 'Land brand deals', value: 'brand_deals' },
  { label: 'All of the above', value: 'all' },
];

// Resolve a stored value (e.g. "health_wellness") to its display label,
// falling back to a prettified version of the raw value.
export function labelFor(options: OptionDef[], value: string | null | undefined): string {
  if (!value) return '';
  const match = options.find((o) => o.value === value);
  if (match) return match.label;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

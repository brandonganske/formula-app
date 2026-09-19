import type { CreatorProfile } from '@/types/api';

// Store-screenshot mode: run the real app on a real account, but swap every
// identifying field for a neutral stand-in so App Store images carry no
// personal data. Enable with EXPO_PUBLIC_SCREENSHOT_MODE=1 when starting Metro.
export const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOT_MODE === '1';

export function maskProfile<T extends Partial<CreatorProfile> | null>(p: T): T {
  if (!SCREENSHOT_MODE || !p) return p;
  return {
    ...p,
    handle: 'maya.creates',
    display_name: 'Maya',
    avatar_url: null,
    email: 'maya@example.com',
    whatsapp: null,
    region: (p as any).region ?? 'United States',
  } as T;
}

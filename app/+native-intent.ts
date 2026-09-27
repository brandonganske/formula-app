// Expo Router calls this for every URL the OS hands the app. Links from the
// share extension look like `formula://dataUrl=…`; they are not routes, so
// send them to the tabs and let the ShareIntent handler in _layout push
// /share once the intent is read. OAuth return links (Instagram link, Stripe
// payouts) are signals read via Linking, not pages: land on Settings, where
// the listeners finish the job. Everything else passes through untouched.
import { resolveDeepLink } from '@/lib/deep-links';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (/dataUrl=|ShareKey=|share-intent/i.test(path)) return '/(tabs)';
  // Notification scheme links (formula://brain, formula://scripts/<id>, …) opened by the OS.
  if (/^\/?(brain|scripts?\/|credits|settings|payouts|notifications)/i.test(path)) return resolveDeepLink(`formula://${path.replace(/^\//, '')}`);
  if (/instagram-connect|payouts-return|tiktok-callback/i.test(path)) return '/(tabs)/profile';
  return path;
}

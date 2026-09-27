import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { haptic } from '@/lib/haptics';

// TikTok LINKING for accounts that signed up with email or Apple. Verified
// (TikTok-linked) creators match the Influenceish creator index, get brand
// offers under their real handle, and can set up payouts. Shared by Settings,
// the sign-up flow and the Deals nudge.

const REDIRECT = 'formula://tiktok-connect';
const LOGIN = `https://iq.influenceish.com/api/v1/tiktok/login?mode=connect&app_redirect=${encodeURIComponent(REDIRECT)}`;

export function useTikTokLink(opts: { onLinked?: () => void } = {}) {
  const { refreshMe } = useAuth();
  const [linking, setLinking] = useState(false);

  const link = useCallback(async () => {
    haptic.tap();
    try {
      const result = await WebBrowser.openAuthSessionAsync(LOGIN, REDIRECT);
      if (result.type !== 'success' || !result.url) return;
      const match = result.url.match(/[?&]ticket=([^&#]+)/);
      const ticket = match ? decodeURIComponent(match[1]) : null;
      if (!ticket) { Alert.alert('Connection failed', 'TikTok didn’t return a valid ticket. Please try again.'); return; }
      setLinking(true);
      await api.post('/creators/tiktok/connect', { ticket });
      await refreshMe();
      haptic.success();
      opts.onLinked?.();
    } catch (err: any) {
      const body = err?.response?.data ?? {};
      const msg = (typeof body?.error === 'string' ? body.error : body?.error?.message) || body?.message || err?.message;
      Alert.alert(
        err?.response?.status === 409 ? 'Already connected' : 'Connection failed',
        typeof msg === 'string' ? msg : 'Could not connect TikTok. Please try again.',
      );
    } finally {
      setLinking(false);
    }
  }, [refreshMe, opts]);

  return { linking, link };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { haptic } from '@/lib/haptics';
import { D } from '@/constants/ds';

// Instagram account LINKING (never a sign-in). Shared by Settings and the
// sign-up flow so both behave the same.
//
// Instagram has no app-to-app login (unlike TikTok): its consent screen is
// web-only, so it opens in the in-app browser. Instagram redirects to
// formula://instagram-connect?ig_ticket=…, iOS hands that to the URL listener
// here, which closes the browser and claims the ticket for this profile.

const IG_REDIRECT = 'formula://instagram-connect';
const IG_LOGIN = `https://iq.influenceish.com/api/v1/instagram/login?app_redirect=${encodeURIComponent(IG_REDIRECT)}`;

export function useInstagramLink(opts: { onLinked?: (username: string | null) => void } = {}) {
  const { refreshMe, profile } = useAuth();

  // A link that went through by user id only (profile read refused at the
  // time) gets its username/followers filled in here, once per mount.
  const triedRefresh = useRef(false);
  useEffect(() => {
    if (triedRefresh.current || !profile?.instagram_user_id || profile.instagram_username) return;
    triedRefresh.current = true;
    api.post('/creators/instagram/refresh').then((r) => { if (r?.data?.data?.refreshed) refreshMe(); }).catch(() => {});
  }, [profile?.instagram_user_id, profile?.instagram_username, refreshMe]);
  const [linking, setLinking] = useState(false);
  const handled = useRef<string | null>(null);
  const onLinked = useRef(opts.onLinked);
  onLinked.current = opts.onLinked;

  const finish = useCallback(async (url: string) => {
    if (handled.current === url) return;
    handled.current = url;
    try {
      const err = url.match(/[?&]ig_error=([^&#]+)/);
      if (err) { Alert.alert('Instagram not linked', decodeURIComponent(err[1].replace(/\+/g, ' '))); return; }
      const match = url.match(/[?&]ig_ticket=([^&#]+)/);
      const ticket = match ? decodeURIComponent(match[1]) : null;
      if (!ticket) { Alert.alert('Instagram not linked', 'Instagram didn’t return a valid response. Please try again.'); return; }
      setLinking(true);
      const res = await api.post('/creators/instagram/connect', { ticket });
      await refreshMe();
      haptic.success();
      const username: string | null = res?.data?.data?.username ?? res?.data?.username ?? null;
      onLinked.current?.(username);
    } catch (err: any) {
      const body = err?.response?.data ?? {};
      const msg = (typeof body?.error === 'string' ? body.error : body?.error?.message) || body?.message || err?.message;
      Alert.alert(
        err?.response?.status === 409 ? 'Already linked' : 'Instagram not linked',
        typeof msg === 'string' ? msg : 'Could not link Instagram. Please try again.',
      );
    } finally {
      setLinking(false);
    }
  }, [refreshMe]);

  useEffect(() => {
    const onUrl = (url: string | null) => {
      if (!url || !url.includes('instagram-connect')) return;
      try { WebBrowser.dismissBrowser(); } catch { /* not open */ }
      finish(url);
    };
    Linking.getInitialURL().then(onUrl);
    const sub = Linking.addEventListener('url', ({ url }) => onUrl(url));
    return () => sub.remove();
  }, [finish]);

  const link = useCallback(async () => {
    haptic.tap();
    handled.current = null;
    try {
      await WebBrowser.openBrowserAsync(IG_LOGIN, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        dismissButtonStyle: 'cancel',
        controlsColor: D.coral,
        toolbarColor: '#FFFFFF',
      });
    } catch (err: any) {
      Alert.alert('Instagram not linked', err?.message ?? 'Could not open Instagram. Please try again.');
    }
  }, []);

  const unlink = useCallback(async () => {
    await api.delete('/creators/instagram');
    await refreshMe();
  }, [refreshMe]);

  return { linking, link, unlink };
}

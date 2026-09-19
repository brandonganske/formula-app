import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { handleReturnURL } from '@/modules/tiktok-login';

const RETURN_BASE = 'https://iq.influenceish.com/tiktok/native';

/**
 * Landing for the TikTok native-login Universal Link
 * (https://iq.influenceish.com/tiktok/native?code=…).
 *
 * After app-to-app auth, TikTok returns here. We reconstruct the callback URL
 * from the query params and hand it to the SDK via handleReturnURL — this is
 * the reliable path that drives the SDK to resolve the pending authenticate()
 * promise back on the sign-in screen (which then runs the token exchange and
 * signs the user in). We do NOT parse the code ourselves: the PKCE verifier
 * lives inside the SDK request, so only the SDK-resolved promise can complete
 * login. When it succeeds the root layout swaps to the tabs and this screen is
 * torn down; if nothing happens within a few seconds, fall back to sign-in.
 */
export default function TikTokNativeReturn() {
  const params = useLocalSearchParams();

  useEffect(() => {
    try {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string') qs.append(k, v);
        else if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
      }
      const full = qs.toString() ? `${RETURN_BASE}?${qs.toString()}` : RETURN_BASE;
      const consumed = handleReturnURL(full);
    } catch (e: any) {
    }
    // Return to the sign-in screen WITHOUT remounting it — go back so its state
    // (a link-required sheet, or the loading/error it set while we were on top)
    // survives. A successful login flips auth state and the root layout swaps to
    // the tabs regardless. Fall back to replace only if there's no back stack.
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#111" />
      <Text style={styles.text}>Finishing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F3EF', gap: 16 },
  text: { fontSize: 16, color: '#111', fontWeight: '600' },
});

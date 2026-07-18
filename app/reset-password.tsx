import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import Svg, { Rect } from 'react-native-svg';
import { Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react-native';
import FadeInView from '@/components/FadeInView';
import { api } from '@/lib/api';
import { D, T, R } from '@/constants/ds';

// ─── F mark SVG ──────────────────────────────────────────────────────────────

function FMark({ size = 80 }: { size?: number }) {
  return (
    <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 100 100">
      <Rect x="22" y="16" width="16" height="68" rx="8" fill="#FFFFFF" />
      <Rect x="22" y="16" width="56" height="16" rx="8" fill="#B6FF8A" />
      <Rect x="22" y="44" width="42" height="15" rx="7.5" fill="#FFFFFF" />
    </Svg>
  );
}

// ─── Parse tokens out of the recovery link ──────────────────────────────────
// The recovery link carries them in the URL hash (#access_token=…) or query (?…).

function parseAuthParams(url: string): { access_token?: string; refresh_token?: string; type?: string } {
  const out: Record<string, string> = {};
  const grab = (segment: string) => {
    segment.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && v) out[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  };
  const hashIdx = url.indexOf('#');
  if (hashIdx >= 0) grab(url.slice(hashIdx + 1));
  const queryIdx = url.indexOf('?');
  if (queryIdx >= 0) grab(url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined));
  return out;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Capture the recovery access token from the link that opened the app. The
  // token is forwarded to the backend on submit — no client session needed.
  // Supabase delivers failures (expired/used link) as #error_code=… instead of
  // a token, and email scanners frequently consume the one-time link before the
  // user taps it — so surface those as "link expired" rather than spinning.
  useEffect(() => {
    let active = true;
    const establish = (url: string | null) => {
      if (!url || !active) return;
      const params = parseAuthParams(url);
      if (params.access_token) {
        setAccessToken(params.access_token);
        setSessionReady(true);
      } else if ((params as any).error || (params as any).error_code) {
        setLinkError('This reset link is invalid or has expired. Request a new one.');
      }
    };

    Linking.getInitialURL().then(establish);
    const sub = Linking.addEventListener('url', ({ url }) => establish(url));

    // No token within 8s (opened without a usable link) — treat as expired.
    const timeout = setTimeout(() => {
      if (active) {
        setSessionReady((ready) => {
          if (!ready) setLinkError('This reset link is invalid or has expired. Request a new one.');
          return ready;
        });
      }
    }, 8000);

    return () => { active = false; sub.remove(); clearTimeout(timeout); };
  }, []);

  const handleSubmit = async () => {
    if (!accessToken) { setLinkError('This reset link is invalid or has expired. Request a new one.'); return; }
    if (!password.trim()) { setError('Please enter a new password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(null);
    try {
      await api.post('/auth/reset-password', { access_token: accessToken, password });
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.root}>
      <LinearGradient
        colors={['#FF4D65', '#FF3755', '#E8204A']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FadeInView delay={0} duration={600} style={S.hero}>
          <View style={S.markOuter}>
            <View style={S.markInner}><FMark size={80} /></View>
          </View>
          <View style={S.wordmarkRow}>
            <Text style={S.wordmark}>formula</Text>
            <Text style={S.wordmarkDot}>.</Text>
          </View>
        </FadeInView>

        <FadeInView delay={120} duration={500} direction="up" style={S.card}>
          {done ? (
            <FadeInView direction="none" style={S.centered}>
              <View style={S.iconCircle}><CheckCircle size={32} color={D.coral} strokeWidth={1.8} /></View>
              <Text style={S.title}>Password updated</Text>
              <Text style={S.sub}>You can now sign in with your new password.</Text>
              <TouchableOpacity style={S.btn} onPress={() => router.replace('/')} activeOpacity={0.88}>
                <Text style={S.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </FadeInView>
          ) : linkError ? (
            <FadeInView direction="none" style={S.centered}>
              <View style={S.iconCircle}><AlertCircle size={32} color={D.error} strokeWidth={1.8} /></View>
              <Text style={S.title}>Link expired</Text>
              <Text style={S.sub}>{linkError || 'This reset link is invalid or has expired. Request a new one.'}</Text>
              <TouchableOpacity style={S.btn} onPress={() => router.replace('/')} activeOpacity={0.88}>
                <Text style={S.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </FadeInView>
          ) : !sessionReady ? (
            <View style={S.centered}>
              <ActivityIndicator color={D.coral} size="large" />
              <Text style={[S.sub, { marginTop: 16 }]}>Verifying your reset link…</Text>
            </View>
          ) : (
            <>
              <Text style={S.title}>Set a new password</Text>
              <Text style={[S.sub, { marginBottom: 24 }]}>Choose a strong password you don't use anywhere else.</Text>

              <View style={S.fields}>
                <View style={fi.wrap}>
                  <Text style={fi.label}>New Password</Text>
                  <View style={fi.row}>
                    <View style={fi.icon}><Lock size={16} color={D.textMuted} strokeWidth={2} /></View>
                    <TextInput
                      style={fi.input}
                      placeholder="••••••••"
                      placeholderTextColor={D.textDisabled}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={fi.wrap}>
                  <Text style={fi.label}>Confirm Password</Text>
                  <View style={fi.row}>
                    <View style={fi.icon}><Lock size={16} color={D.textMuted} strokeWidth={2} /></View>
                    <TextInput
                      style={fi.input}
                      placeholder="••••••••"
                      placeholderTextColor={D.textDisabled}
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="go"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </View>
              </View>

              {error && (
                <FadeInView direction="none" duration={200} style={S.errorBox}>
                  <Text style={S.errorText}>{error}</Text>
                </FadeInView>
              )}

              <TouchableOpacity style={[S.btn, loading && S.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.88}>
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <><Text style={S.btnText}>Update Password</Text><View style={S.btnArrow}><ArrowRight size={15} color="#FFF" strokeWidth={2.5} /></View></>}
              </TouchableOpacity>
            </>
          )}
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const fi = StyleSheet.create({
  wrap: { gap: 8 },
  label: { ...T.medium, fontSize: 11, color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: R.md, borderWidth: 1.5, borderColor: D.border,
    backgroundColor: D.surface,
  },
  icon: { paddingLeft: 16, paddingRight: 4 },
  input: { flex: 1, ...T.regular, fontSize: 15, color: D.textPrimary, paddingVertical: 14, paddingHorizontal: 10 },
});

const S = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: Platform.OS === 'web' ? 60 : 80 },
  hero: { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 40 },
  markOuter: {
    width: 96, height: 96, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  markInner: {
    width: 74, height: 74, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-end' },
  wordmark: { ...T.bold, fontSize: 36, color: '#FFFFFF', letterSpacing: -1.2 },
  wordmarkDot: { ...T.bold, fontSize: 36, color: '#B6FF8A', letterSpacing: -1.2 },

  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingTop: 32, paddingBottom: 48,
    flex: 1, minHeight: 420,
  },
  centered: { alignItems: 'center', paddingVertical: 24 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: D.coral + '14',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sub: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 21, textAlign: 'center' },
  fields: { gap: 16, marginBottom: 20 },
  errorBox: {
    backgroundColor: D.errorSubtle, borderRadius: R.md, padding: 14,
    borderWidth: 1, borderColor: D.errorBorder, marginBottom: 16,
  },
  errorText: { ...T.regular, fontSize: 13, color: D.error },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 17, gap: 10, marginTop: 8,
    alignSelf: 'stretch',
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { ...T.bold, fontSize: 16, color: '#FFF', letterSpacing: -0.2 },
  btnArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
});

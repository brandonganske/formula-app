import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Modal, AccessibilityInfo,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Rect } from 'react-native-svg';
import { Mail, Lock, ArrowRight, CheckCircle, X } from 'lucide-react-native';
import FadeInView from '@/components/FadeInView';
import TikTokMark from '@/components/TikTokMark';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { D, T, R, Shadow, Gradient, Ease } from '@/constants/ds';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// App-wide reduced-motion flag (same pattern as FadeInView) — read synchronously
// at mount so the entrance orchestration can skip motion without a flash.
let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; }).catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

// ─── F mark SVG ──────────────────────────────────────────────────────────────

function FMark({ size = 44 }: { size?: number }) {
  return (
    <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 100 100">
      <Rect x="22" y="16" width="16" height="68" rx="8" fill="#FFFFFF" />
      <Rect x="22" y="16" width="56" height="16" rx="8" fill="#B6FF8A" />
      <Rect x="22" y="44" width="42" height="15" rx="7.5" fill="#FFFFFF" />
    </Svg>
  );
}

// ─── TikTok OAuth ────────────────────────────────────────────────────────────

const TIKTOK_REDIRECT = 'formula://tiktok-callback';
const TIKTOK_AUTH_URL =
  `https://iq.influenceish.com/api/v1/tiktok/login?app_redirect=${encodeURIComponent(TIKTOK_REDIRECT)}`;

function parseCallbackParams(url: string): {
  code?: string; error?: string; link_required?: string; handle?: string; ticket?: string;
} {
  const out: Record<string, string> = {};
  const queryIdx = url.indexOf('?');
  if (queryIdx < 0) return out;
  const hashIdx = url.indexOf('#');
  const query = url.slice(queryIdx + 1, hashIdx > queryIdx ? hashIdx : undefined);
  query.split('&').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq <= 0) return;
    try {
      out[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    } catch { /* malformed segment — skip */ }
  });
  return out;
}

// ─── Input ────────────────────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, icon, hint,
}: {
  label: string; placeholder: string; value: string;
  onChangeText: (v: string) => void; secureTextEntry?: boolean;
  keyboardType?: any; autoCapitalize?: any; icon: React.ReactNode; hint?: string | null;
}) {
  const focused = useRef(new Animated.Value(0)).current;
  const anim = {
    borderColor: focused.interpolate({
      inputRange: [0, 1],
      outputRange: [D.border, D.coral],
    }),
    backgroundColor: focused.interpolate({
      inputRange: [0, 1],
      outputRange: [D.surface, '#FFFFFF'],
    }),
  };

  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <Animated.View style={[fi.row, anim]}>
        <View style={fi.icon}>{icon}</View>
        <TextInput
          style={fi.input}
          placeholder={placeholder}
          placeholderTextColor={D.textDisabled}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
          onFocus={() => { Animated.timing(focused, { toValue: 1, duration: 160, useNativeDriver: false }).start(); }}
          onBlur={() => { Animated.timing(focused, { toValue: 0, duration: 160, useNativeDriver: false }).start(); }}
        />
      </Animated.View>
      {hint ? <Text style={fi.hint}>{hint}</Text> : null}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { gap: 8 },
  label: { ...T.medium, fontSize: 11, color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { ...T.regular, fontSize: 12, color: D.coral, marginTop: -2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: R.md, borderWidth: 1.5,
    backgroundColor: D.surface,
  },
  icon: { paddingLeft: 16, paddingRight: 4 },
  input: {
    flex: 1, ...T.regular, fontSize: 15,
    color: D.textPrimary, paddingVertical: 14, paddingHorizontal: 10,
  },
});

// ─── Tagline — per-word entrance ─────────────────────────────────────────────

const TAGLINE_LINES: { text: string; lime?: boolean }[][] = [
  [{ text: 'Scripts' }, { text: 'that' }, { text: 'sound' }],
  [{ text: 'like' }, { text: 'you.', lime: true }],
];

function TaglineWord({
  word, lime, delay,
}: { word: string; lime?: boolean; delay: number }) {
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const rise = useRef(new Animated.Value(reduceMotion ? 0 : 14)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 420, delay, easing: Ease.out, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: rise }] }}>
      <Text style={[S.taglineWord, lime && { color: D.lime }]}>{word}</Text>
    </Animated.View>
  );
}

// ─── Typing hook line ────────────────────────────────────────────────────────

const HOOK_LINES = [
  'ingesting video 47/330…',
  'hook detected → curiosity_gap',
  'pacing → 6.1 cuts / 30s',
  '✓ sounds like you',
];

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, monospace',
}) as string;

function TypingHook({ startDelay }: { startDelay: number }) {
  const [text, setText] = useState(reduceMotion ? HOOK_LINES[0] : '');
  const caret = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) return; // static first line, no caret blink

    // Blinking caret
    const blink = Animated.loop(Animated.sequence([
      Animated.timing(caret, { toValue: 0, duration: 90, delay: 420, useNativeDriver: true }),
      Animated.timing(caret, { toValue: 1, duration: 90, delay: 420, useNativeDriver: true }),
    ]));
    blink.start();

    // Typewriter cycle: type (~40ms/char) → hold 1.6s → erase → next line.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = (fn: () => void, ms: number) => { timer = setTimeout(() => { if (!cancelled) fn(); }, ms); };

    const typeLine = (lineIdx: number, charIdx: number) => {
      const line = HOOK_LINES[lineIdx % HOOK_LINES.length];
      setText(line.slice(0, charIdx));
      if (charIdx < line.length) {
        schedule(() => typeLine(lineIdx, charIdx + 1), 40);
      } else {
        schedule(() => eraseLine(lineIdx, line.length), 1600);
      }
    };
    const eraseLine = (lineIdx: number, charIdx: number) => {
      const line = HOOK_LINES[lineIdx % HOOK_LINES.length];
      setText(line.slice(0, charIdx));
      if (charIdx > 0) {
        schedule(() => eraseLine(lineIdx, charIdx - 1), 18);
      } else {
        schedule(() => typeLine(lineIdx + 1, 0), 260);
      }
    };
    schedule(() => typeLine(0, 1), startDelay);

    return () => { cancelled = true; clearTimeout(timer); blink.stop(); };
  }, []);

  return (
    <View style={S.hookRow}>
      <Text style={S.hookText}>{text}</Text>
      {!reduceMotion && <Animated.View style={[S.hookCaret, { opacity: caret }]} />}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  // Non-null → the TikTok callback said this TikTok matches an existing email
  // account; show the one-time link sheet instead of the normal screen.
  const [linkInfo, setLinkInfo] = useState<{ handle: string; ticket: string } | null>(null);
  const { isAuthenticated, profile, login, loginWithTikTok, loginWithTikTokLink, loginWithApple } = useAuth();
  const tiktokExchanged = useRef(false);
  const insets = useSafeAreaInsets();

  // ── Entrance orchestration: mark → tagline words → typing → button stack ──
  const markScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.9)).current;
  const markOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const stackOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const stackRise = useRef(new Animated.Value(reduceMotion ? 0 : 20)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(markOpacity, { toValue: 1, duration: 420, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(markScale, { toValue: 1, duration: 420, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(stackOpacity, { toValue: 1, duration: 460, delay: 640, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(stackRise, { toValue: 0, duration: 460, delay: 640, easing: Ease.out, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  // Shared by the in-app auth session result and the cold-start deep link.
  const exchangeTikTokCallback = async (url: string) => {
    const params = parseCallbackParams(url);
    if (params.error) {
      setError(params.error);
      return;
    }
    if (params.link_required === '1' && params.ticket) {
      setError(null);
      setLinkInfo({ handle: params.handle ?? '', ticket: params.ticket });
      return;
    }
    if (!params.code) return;
    setTiktokLoading(true);
    setError(null);
    const result = await loginWithTikTok(params.code);
    setTiktokLoading(false);
    if (result.error) setError(result.error);
  };

  const handleTikTok = async () => {
    setError(null);
    try {
      const result = await WebBrowser.openAuthSessionAsync(TIKTOK_AUTH_URL, TIKTOK_REDIRECT);
      if (result.type === 'success' && result.url) {
        tiktokExchanged.current = true;
        await exchangeTikTokCallback(result.url);
      }
      // 'cancel' / 'dismiss' — user backed out, no error shown.
    } catch (err: any) {
      setError(err?.message ?? 'Could not open TikTok sign-in. Please try again.');
    }
  };

  // Cold-start fallback: the auth session can end with the OS opening the app
  // directly via formula://tiktok-callback?code=… instead of resolving the
  // session. Catch that link here (only while signed out) and run the same
  // exchange.
  useEffect(() => {
    if (isAuthenticated) return;
    const handleUrl = (url: string | null) => {
      if (!url || !url.includes('tiktok-callback') || tiktokExchanged.current) return;
      tiktokExchanged.current = true;
      exchangeTikTokCallback(url);
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [isAuthenticated]);

  const handleApple = async () => {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setError('Apple sign-in failed. Please try again.');
        return;
      }
      // Apple only supplies the name on the very first authorization.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      setAppleLoading(true);
      const result = await loginWithApple(credential.identityToken, name || undefined);
      setAppleLoading(false);
      if (result.error) setError(result.error);
    } catch (err: any) {
      setAppleLoading(false);
      if (err?.code === 'ERR_REQUEST_CANCELED') return; // user backed out — silent
      setError(err?.message ?? 'Apple sign-in failed. Please try again.');
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkInfo) return;
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError(null);
    const result = await loginWithTikTokLink(linkInfo.ticket, email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  const exitLinkView = () => {
    setLinkInfo(null);
    setError(null);
    setPassword('');
    tiktokExchanged.current = false;
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) { setError('Please enter your email address.'); return; }
    setForgotLoading(true); setError(null);
    try {
      // Backend sends the recovery email against the IQ project (where creator
      // auth lives). Response is intentionally generic, so always show "sent".
      await api.post('/auth/forgot-password', { email: forgotEmail.trim().toLowerCase() });
      setForgotSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Could not send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const goToForgot = () => {
    setForgotEmail(email);
    setForgotSent(false);
    setError(null);
    setMode('forgot');
  };

  const openEmailSheet = () => {
    setMode('login');
    setError(null);
    setEmailOpen(true);
  };

  const closeEmailSheet = () => {
    setEmailOpen(false);
    setMode('login');
    setError(null);
    setForgotSent(false);
  };

  if (isAuthenticated) {
    // Profile loads async right after login/register — wait for it before
    // routing, otherwise a null profile sends new users to the tabs and skips
    // onboarding entirely.
    if (profile == null) {
      return (
        <View style={[S.root, { alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={D.coral} />
        </View>
      );
    }
    const needsOnboarding = !profile.onboarding_completed_at;
    return <Redirect href={needsOnboarding ? '/onboarding' : '/(tabs)'} />;
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    setError(null);
    const result = await login(email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  const sheetOpen = emailOpen || linkInfo != null;

  return (
    <View style={S.root}>
      <LinearGradient
        colors={Gradient.auth}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Hero ─────────────────────────────────────────── */}
      <View style={[S.hero, { paddingTop: Math.max(insets.top, 24) }]}>
        <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }], alignItems: 'center' }}>
          {/* Logo mark — bare glyph, no containers: clean and minimal */}
          <View style={S.markPlain}>
            <FMark size={96} />
          </View>

          {/* Wordmark */}
          <View style={S.wordmarkRow}>
            <Text style={S.wordmark}>formula</Text>
            <Text style={S.wordmarkDot}>.</Text>
          </View>
        </Animated.View>

        {/* Tagline — per-word entrance */}
        <View style={S.tagline}>
          {TAGLINE_LINES.map((line, li) => (
            <View key={li} style={S.taglineLine}>
              {line.map((w, wi) => {
                const wordIndex = li === 0 ? wi : TAGLINE_LINES[0].length + wi;
                return (
                  <TaglineWord
                    key={wi}
                    word={w.text}
                    lime={w.lime}
                    delay={250 + wordIndex * 70}
                  />
                );
              })}
            </View>
          ))}
        </View>

        {/* Typing hook line */}
        <TypingHook startDelay={860} />

      {/* ── Action stack — part of the centered composition ── */}
      <Animated.View
        style={[
          S.stack,
          { opacity: stackOpacity, transform: [{ translateY: stackRise }] },
        ]}
      >
        {/* Social-flow errors (email/link errors render inside their sheets) */}
        {error && !sheetOpen && (
          <FadeInView direction="none" duration={200} style={S.gradientErrorBox}>
            <Text style={S.gradientErrorText}>{error}</Text>
          </FadeInView>
        )}

        {/* Hero: Continue with TikTok */}
        <AnimatedPressable
          style={[S.tiktokBtn, tiktokLoading && S.btnDisabled]}
          onPress={handleTikTok}
          disabled={tiktokLoading}
          haptic="light"
        >
          {tiktokLoading
            ? <ActivityIndicator color="#FFF" size="small" />
            : (
              <>
                <TikTokMark size={19} />
                <Text style={S.tiktokBtnText}>Continue with TikTok</Text>
              </>
            )
          }
        </AnimatedPressable>

        {/* Sign in with Apple (iOS only) — quiet but clearly present (4.8) */}
        {Platform.OS === 'ios' && appleAvailable && (
          appleLoading ? (
            <View style={S.appleLoadingBtn}>
              <ActivityIndicator color="#000" size="small" />
            </View>
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={R.full}
              style={S.appleBtn}
              onPress={handleApple}
            />
          )
        )}

        <Text style={S.stackCaption}>One tap — your creator brain builds itself.</Text>

        {/* Email sign-in footnote */}
        <TouchableOpacity style={S.footnote} onPress={openEmailSheet} activeOpacity={0.7}>
          <Text style={S.footnoteText}>
            Have an existing account? <Text style={S.footnoteLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
      </View>

      {/* ── Email sign-in / forgot-password sheet ────────── */}
      <Modal
        visible={emailOpen}
        animationType="slide"
        transparent
        onRequestClose={closeEmailSheet}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.sheetRoot}>
          <TouchableOpacity style={S.sheetScrim} activeOpacity={1} onPress={closeEmailSheet} />
          <View style={[S.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={S.sheetHeader}>
                <Text style={S.sheetTitle}>
                  {mode === 'forgot' ? 'Reset your password' : 'Sign in with email'}
                </Text>
                <TouchableOpacity style={S.sheetClose} onPress={closeEmailSheet} activeOpacity={0.7} hitSlop={8}>
                  <X size={18} color={D.textMuted} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>

              {mode === 'forgot' ? (
                <>
                  <TouchableOpacity style={S.backRow} onPress={() => { setMode('login'); setError(null); }} activeOpacity={0.7}>
                    <Text style={S.backText}>← Back to Sign In</Text>
                  </TouchableOpacity>

                  {forgotSent ? (
                    <FadeInView direction="none" style={S.sentWrap}>
                      <View style={S.sentIcon}>
                        <CheckCircle size={32} color={D.coral} strokeWidth={1.8} />
                      </View>
                      <Text style={S.sentTitle}>Check your email</Text>
                      <Text style={S.sentSub}>
                        We sent a password reset link to{'\n'}
                        <Text style={S.sentEmail}>{forgotEmail}</Text>
                      </Text>
                      <TouchableOpacity style={S.sentBack} onPress={() => { setMode('login'); setForgotSent(false); }} activeOpacity={0.8}>
                        <Text style={S.sentBackText}>Back to Sign In</Text>
                      </TouchableOpacity>
                    </FadeInView>
                  ) : (
                    <>
                      <Text style={S.forgotSub}>Enter your account email and we'll send you a reset link.</Text>
                      <View style={S.fields}>
                        <Field
                          label="Email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChangeText={setForgotEmail}
                          keyboardType="email-address"
                          icon={<Mail size={16} color={D.textMuted} strokeWidth={2} />}
                        />
                      </View>
                      {error && (
                        <FadeInView direction="none" duration={200} style={S.errorBox}>
                          <Text style={S.errorText}>{error}</Text>
                        </FadeInView>
                      )}
                      <TouchableOpacity
                        style={[S.btn, forgotLoading && S.btnDisabled]}
                        onPress={handleForgot}
                        disabled={forgotLoading}
                        activeOpacity={0.88}
                      >
                        {forgotLoading
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <><Text style={S.btnText}>Send Reset Link</Text><View style={S.btnArrow}><ArrowRight size={15} color="#FFF" strokeWidth={2.5} /></View></>
                        }
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* Fields */}
                  <View style={S.fields}>
                    <Field
                      label="Email"
                      placeholder="you@example.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      icon={<Mail size={16} color={D.textMuted} strokeWidth={2} />}
                    />
                    <Field
                      label="Password"
                      placeholder="••••••••"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      icon={<Lock size={16} color={D.textMuted} strokeWidth={2} />}
                    />
                  </View>

                  {/* Forgot password link */}
                  <TouchableOpacity style={S.forgotLink} onPress={goToForgot} activeOpacity={0.7}>
                    <Text style={S.forgotLinkText}>Forgot password?</Text>
                  </TouchableOpacity>

                  {/* Error */}
                  {error && (
                    <FadeInView direction="none" duration={200} style={S.errorBox}>
                      <Text style={S.errorText}>{error}</Text>
                    </FadeInView>
                  )}

                  {/* Submit */}
                  <AnimatedPressable
                    style={[S.btn, loading && S.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    haptic="light"
                  >
                    {loading
                      ? <ActivityIndicator color="#FFF" size="small" />
                      : (
                        <>
                          <Text style={S.btnText}>Sign In</Text>
                          <View style={S.btnArrow}>
                            <ArrowRight size={15} color="#FFF" strokeWidth={2.5} />
                          </View>
                        </>
                      )
                    }
                  </AnimatedPressable>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── TikTok → email link sheet ("Welcome back @handle") ── */}
      <Modal
        visible={linkInfo != null}
        animationType="slide"
        transparent
        onRequestClose={exitLinkView}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.sheetRoot}>
          <TouchableOpacity style={S.sheetScrim} activeOpacity={1} onPress={exitLinkView} />
          <View style={[S.sheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={S.sheetHeader}>
                <Text style={S.linkTitle}>Welcome back, @{linkInfo?.handle}</Text>
                <TouchableOpacity style={S.sheetClose} onPress={exitLinkView} activeOpacity={0.7} hitSlop={8}>
                  <X size={18} color={D.textMuted} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
              <Text style={S.linkCopy}>
                This TikTok matches an existing Formula account. Enter your email and password once to link them — after this, TikTok sign-in is instant.
              </Text>

              <View style={S.fields}>
                <Field
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  icon={<Mail size={16} color={D.textMuted} strokeWidth={2} />}
                />
                <Field
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  icon={<Lock size={16} color={D.textMuted} strokeWidth={2} />}
                />
              </View>

              {error && (
                <FadeInView direction="none" duration={200} style={S.errorBox}>
                  <Text style={S.errorText}>{error}</Text>
                </FadeInView>
              )}

              <AnimatedPressable
                style={[S.btn, loading && S.btnDisabled]}
                onPress={handleLinkSubmit}
                disabled={loading}
                haptic="light"
              >
                {loading
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : (
                    <>
                      <Text style={S.btnText}>Link accounts</Text>
                      <View style={S.btnArrow}>
                        <ArrowRight size={15} color="#FFF" strokeWidth={2.5} />
                      </View>
                    </>
                  )
                }
              </AnimatedPressable>

              <TouchableOpacity style={S.linkAlt} onPress={exitLinkView} activeOpacity={0.7}>
                <Text style={S.linkAltText}>Use a different account</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  markPlain: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },

  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 18 },
  wordmark: { ...T.bold, fontSize: 36, color: '#FFFFFF', letterSpacing: -1.2 },
  wordmarkDot: { ...T.bold, fontSize: 36, color: '#B6FF8A', letterSpacing: -1.2 },

  tagline: { alignItems: 'center', marginBottom: 20 },
  taglineLine: { flexDirection: 'row', justifyContent: 'center' },
  taglineWord: {
    ...T.bold,
    fontSize: 30,
    lineHeight: 38,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginHorizontal: 4,
  },

  hookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
  },
  hookText: {
    fontFamily: MONO,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  hookCaret: {
    width: 8, height: 15,
    marginLeft: 3,
    borderRadius: 1.5,
    backgroundColor: D.lime,
  },

  // ── Bottom action stack ───────────────────────────────────────────────────
  stack: {
    marginTop: 44,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },

  gradientErrorBox: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: R.md,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginBottom: 14,
  },
  gradientErrorText: { ...T.medium, fontSize: 13, color: '#FFFFFF', textAlign: 'center' },

  tiktokBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: R.full,
    height: 56,
    gap: 10,
    ...Shadow.card,
  },
  tiktokBtnText: { ...T.bold, fontSize: 16, color: '#FFF', letterSpacing: -0.2 },

  appleBtn: { height: 48, marginTop: 10 },
  appleLoadingBtn: {
    height: 48, marginTop: 10,
    borderRadius: R.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },

  stackCaption: {
    ...T.regular, fontSize: 12,
    color: 'rgba(255,255,255,0.7)', textAlign: 'center',
    marginTop: 14,
  },

  footnote: { alignItems: 'center', marginTop: 18, paddingVertical: 4 },
  footnoteText: { ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  footnoteLink: { ...T.medium, textDecorationLine: 'underline', color: '#FFFFFF' },

  // ── Sheets (email sign-in / link accounts) ───────────────────────────────
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,20,38,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 28,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sheetTitle: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, flex: 1 },
  sheetClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: D.surface,
    borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center',
  },

  fields: { gap: 16, marginBottom: 20, marginTop: 12 },

  errorBox: {
    backgroundColor: D.errorSubtle,
    borderRadius: R.md,
    padding: 14,
    borderWidth: 1,
    borderColor: D.errorBorder,
    marginBottom: 16,
  },
  errorText: { ...T.regular, fontSize: 13, color: D.error },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.coral,
    borderRadius: R.full,
    paddingVertical: 17,
    gap: 10,
    marginTop: 4,
    ...Shadow.coral,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: { ...T.bold, fontSize: 16, color: '#FFF', letterSpacing: -0.2 },
  btnArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── TikTok → email link sheet ─────────────────────────────────────────────
  linkTitle: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, flex: 1 },
  linkCopy: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, marginBottom: 8 },
  linkAlt: { alignItems: 'center', marginTop: 18 },
  linkAltText: { ...T.medium, fontSize: 13, color: D.coral },

  // ── Forgot password ───────────────────────────────────────────────────────
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotLinkText: { ...T.medium, fontSize: 13, color: D.coral },

  backRow: { marginBottom: 12 },
  backText: { ...T.medium, fontSize: 14, color: D.coral },

  forgotSub: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, marginBottom: 4 },

  sentWrap: { alignItems: 'center', paddingVertical: 24 },
  sentIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: D.coralSubtle,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  sentTitle: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, marginBottom: 10 },
  sentSub: { ...T.regular, fontSize: 14, color: D.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  sentEmail: { ...T.medium, color: D.textPrimary },
  sentBack: {
    borderWidth: 1.5, borderColor: D.coral,
    borderRadius: R.full, paddingVertical: 14, paddingHorizontal: 32,
  },
  sentBackText: { ...T.bold, fontSize: 15, color: D.coral },
});

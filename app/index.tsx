import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import { AtSign, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react-native';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { D, T, R, Shadow, Gradient } from '@/constants/ds';
import { normalizeTikTokHandle, looksLikeLink } from '@/constants/onboarding';

// ─── F mark SVG ──────────────────────────────────────────────────────────────

function FMark({ size = 44 }: { size?: number }) {
  const scale = size / 100;
  return (
    <Svg width={size * 0.56} height={size * 0.56} viewBox="0 0 100 100">
      <Rect x="22" y="16" width="16" height="68" rx="8" fill="#FFFFFF" />
      <Rect x="22" y="16" width="56" height="16" rx="8" fill="#B6FF8A" />
      <Rect x="22" y="44" width="42" height="15" rx="7.5" fill="#FFFFFF" />
    </Svg>
  );
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const { isAuthenticated, profile, login, register } = useAuth();

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
    if (mode === 'register' && !handle.trim()) { setError('TikTok handle is required.'); return; }
    setLoading(true);
    setError(null);
    const result = mode === 'login'
      ? await login(email.trim().toLowerCase(), password)
      : await register(normalizeTikTokHandle(handle), email.trim().toLowerCase(), password);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.root}>
      <LinearGradient
        colors={Gradient.auth}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={S.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────── */}
        <FadeInView delay={0} duration={600} style={S.hero}>
          {/* Logo mark */}
          <View style={S.markOuter}>
            <View style={S.markInner}>
              <FMark size={80} />
            </View>
          </View>

          {/* Wordmark */}
          <View style={S.wordmarkRow}>
            <Text style={S.wordmark}>formula</Text>
            <Text style={S.wordmarkDot}>.</Text>
          </View>

          <Text style={S.tagline}>
            {mode === 'login'
              ? 'Welcome back, creator.'
              : 'Go viral on purpose.'}
          </Text>
        </FadeInView>

        {/* ── Form card ────────────────────────────────────── */}
        <FadeInView delay={120} duration={500} direction="up" style={S.card}>

          {/* ── Forgot password mode ── */}
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
                  <Text style={S.forgotHeading}>Reset your password</Text>
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
              {/* Mode toggle */}
              <View style={S.toggle}>
                {(['login', 'register'] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[S.toggleTab, mode === m && S.toggleTabActive]}
                    onPress={() => { setMode(m); setError(null); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[S.toggleText, mode === m && S.toggleTextActive]}>
                      {m === 'login' ? 'Sign In' : 'Create Account'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fields */}
              <View style={S.fields}>
                {mode === 'register' && (
                  <Field
                    label="TikTok Handle"
                    placeholder="@yourhandle"
                    value={handle}
                    onChangeText={setHandle}
                    icon={<AtSign size={16} color={D.textMuted} strokeWidth={2} />}
                    hint={looksLikeLink(handle) ? 'Just your handle — no links. e.g. @yourhandle' : null}
                  />
                )}
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

              {/* Forgot password link — login mode only */}
              {mode === 'login' && (
                <TouchableOpacity style={S.forgotLink} onPress={goToForgot} activeOpacity={0.7}>
                  <Text style={S.forgotLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

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
                      <Text style={S.btnText}>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                      </Text>
                      <View style={S.btnArrow}>
                        <ArrowRight size={15} color="#FFF" strokeWidth={2.5} />
                      </View>
                    </>
                  )
                }
              </AnimatedPressable>

              <Text style={S.footer}>By continuing you agree to our Terms of Service</Text>
            </>
          )}
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  scroll: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'web' ? 60 : 80,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  markOuter: {
    width: 96, height: 96,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  markInner: {
    width: 74, height: 74,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  wordmarkRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  wordmark: { ...T.bold, fontSize: 36, color: '#FFFFFF', letterSpacing: -1.2 },
  wordmarkDot: { ...T.bold, fontSize: 36, color: '#B6FF8A', letterSpacing: -1.2 },

  tagline: {
    ...T.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: -0.1,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 48,
    flex: 1,
    minHeight: 460,
    gap: 0,
  },

  toggle: {
    flexDirection: 'row',
    backgroundColor: D.surface,
    borderRadius: R.full,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: D.border,
  },
  toggleTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: R.full },
  toggleTabActive: { backgroundColor: D.coral },
  toggleText: { ...T.medium, fontSize: 14, color: D.textMuted },
  toggleTextActive: { color: '#FFFFFF' },

  fields: { gap: 16, marginBottom: 20 },

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

  footer: {
    ...T.regular, fontSize: 12,
    color: D.textDisabled, textAlign: 'center',
    marginTop: 24,
  },

  // ── Forgot password ───────────────────────────────────────────────────────
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotLinkText: { ...T.medium, fontSize: 13, color: D.coral },

  backRow: { marginBottom: 20 },
  backText: { ...T.medium, fontSize: 14, color: D.coral },

  forgotHeading: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  forgotSub: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, marginBottom: 20 },

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

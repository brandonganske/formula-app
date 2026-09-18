import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { api, extractData } from '@/lib/api';
import { D, T, R, Ease } from '@/constants/ds';
import { ArrowRight, Mic, Sparkles, ShieldCheck, Brain } from 'lucide-react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import type { RunData, AnalyzeResponse } from '@/types/api';

const WHITE = '#FFFFFF';
const HOLD_MS = 2600;
const POLL_MS = 2500;

function isTerminal(status?: string, progress = 0): boolean {
  const s = (status ?? '').toLowerCase();
  return s === 'completed' || s === 'failed' || progress >= 100;
}
function isSuccess(status?: string, progress = 0): boolean {
  return (status ?? '').toLowerCase() === 'completed' || progress >= 100;
}

// ─── Intro: rotating single point ───────────────────────────────────────────

const POINTS = [
  { icon: (c: string) => <Mic size={24} color={c} strokeWidth={2} />, title: 'We learn your voice', body: 'Your hooks, your pacing, the exact way you phrase things.' },
  { icon: (c: string) => <Sparkles size={24} color={c} strokeWidth={2} />, title: 'Scripts that sound like you', body: 'Every idea written in your authentic voice — never generic AI.' },
  { icon: (c: string) => <ShieldCheck size={24} color={c} strokeWidth={2} />, title: 'Your data stays yours', body: 'Only your public content. Never sold or shared. Delete anytime.' },
];

function BrainHero() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Ease.out, useNativeDriver: true }),
    ])).start();
  }, []);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.4] });
  return (
    <View style={S.brainHero}>
      <Animated.View style={[S.brainGlow, { opacity: glow, transform: [{ scale }] }]} />
      <View style={S.brainBadge}><Brain size={42} color={D.coral} strokeWidth={2.2} /></View>
    </View>
  );
}

function RotatingPoints() {
  const [current, setCurrent] = useState(0);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 460, easing: Ease.out, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 320, easing: Ease.out, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setCurrent((c) => (c + 1) % POINTS.length);
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [current]);
  const p = POINTS[current];
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return (
    <View style={S.rotWrap}>
      <Animated.View style={[S.point, { opacity: a, transform: [{ translateY }] }]}>
        <View style={S.pointIcon}>{p.icon(WHITE)}</View>
        <Text style={S.pointTitle}>{p.title}</Text>
        <Text style={S.pointBody}>{p.body}</Text>
      </Animated.View>
      <View style={S.dots}>
        {POINTS.map((_, i) => <View key={i} style={[S.dot, i === current && S.dotActive]} />)}
      </View>
    </View>
  );
}

// ─── Analyzing: spinning ring + pulsing brain ───────────────────────────────

function AnalyzingHero() {
  const rot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rot, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Ease.out, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Ease.out, useNativeDriver: true }),
    ])).start();
  }, []);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <View style={S.analyzeHero}>
      <Animated.View style={[S.ring, { transform: [{ rotate: spin }] }]} />
      <Animated.View style={[S.brainBadge, { transform: [{ scale }] }]}>
        <Brain size={42} color={D.coral} strokeWidth={2.2} />
      </Animated.View>
    </View>
  );
}

const ANALYZE_STEPS = [
  'Watching your videos',
  'Learning your hooks',
  'Studying your pacing',
  'Mapping your voice',
  'Building your profile',
];

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CreateBrainScreen() {
  const router = useRouter();
  const { profile, refreshMe } = useAuth();

  const [phase, setPhase] = useState<'intro' | 'analyzing'>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Progress bar fill.
  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: progress / 100, duration: 500, easing: Ease.out, useNativeDriver: false }).start();
  }, [progress]);

  // Cycle the friendly status line while analyzing.
  useEffect(() => {
    if (phase !== 'analyzing') return;
    const t = setInterval(() => setStepIdx((i) => (i + 1) % ANALYZE_STEPS.length), 2400);
    return () => clearInterval(t);
  }, [phase]);

  const finishToApp = useCallback(async () => {
    stopPolling();
    await refreshMe();
    router.replace('/(tabs)');
  }, [refreshMe, router, stopPolling]);

  const poll = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/creators/runs/${id}`);
      const d = extractData<RunData>(res);
      if (typeof d?.progress === 'number') setProgress(Math.max(0, Math.min(100, d.progress)));
      if (d?.message) setRunMsg(d.message);
      if (isTerminal(d?.status, d?.progress ?? 0)) {
        if (isSuccess(d?.status, d?.progress ?? 0)) {
          await finishToApp();
        } else {
          stopPolling();
          setError(d?.error ?? 'Analysis failed. Please try again.');
          setPhase('intro');
        }
      }
    } catch (err: any) {
      // Transient errors: keep polling. A 404 means the run is gone — surface it.
      if (err?.response?.status === 404) {
        stopPolling();
        setError('That analysis run expired. Please try again.');
        setPhase('intro');
      }
    }
  }, [finishToApp, stopPolling]);

  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/creators/analyze', profile?.handle ? { handle: profile.handle } : {});
      const body: any = res?.data;
      if (body?.success === false || body?.error) {
        const msg = body?.error?.message ?? body?.error ?? body?.message ?? 'Could not start building your profile.';
        setError(typeof msg === 'string' ? msg : 'Could not start building your profile.');
        setLoading(false);
        return;
      }
      const d = extractData<AnalyzeResponse>(res);
      const id = d?.runId ?? (d as any)?.run_id ?? (d as any)?.id;
      setLoading(false);
      if (!id) {
        // No run id but no error — the build may already be underway. Let the home
        // tab attach to it.
        await finishToApp();
        return;
      }
      setPhase('analyzing');
      setProgress(0);
      poll(id);
      pollRef.current = setInterval(() => poll(id), POLL_MS);
    } catch (err: any) {
      // Request may have been accepted without a clean response — hand off to home.
      try {
        await finishToApp();
      } catch {
        setError(err?.message ?? 'Network error — check your connection and try again.');
        setLoading(false);
      }
    }
  };

  // ── Analyzing (full page) ──
  if (phase === 'analyzing') {
    const width = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    return (
      <View style={S.root}>
        <View style={S.analyzeContent}>
          <AnalyzingHero />
          <Text style={S.analyzeTitle}>{ANALYZE_STEPS[stepIdx]}…</Text>
          <Text style={S.analyzeSub}>{runMsg ?? 'Reading your content and learning your style.'}</Text>

          <View style={S.barTrack}>
            <Animated.View style={[S.barFill, { width }]} />
          </View>
          <Text style={S.pct}>{progress > 0 ? `${Math.round(progress)}%` : 'Starting…'}</Text>
        </View>

        <View style={S.leaveCard}>
          <Text style={S.leaveTitle}>You can leave while we analyze you.</Text>
          <Text style={S.leaveBody}>
            Close the app and go about your day — we'll keep working and have your profile ready when you're back.
          </Text>
        </View>
      </View>
    );
  }

  // ── Intro (full page) ──
  return (
    <View style={S.root}>
      <View style={S.content}>
        <BrainHero />
        <Text style={S.title}>Let us learn about you.</Text>
        <Text style={S.subtitle}>We build your creator profile so everything we write sounds like you.</Text>

        <RotatingPoints />

        {error ? (
          <View style={S.errorBox}><Text style={S.errorText}>{error}</Text></View>
        ) : null}
      </View>

      <View style={S.footer}>
        <AnimatedPressable
          style={[S.cta, loading && S.ctaDisabled]}
          onPress={create}
          disabled={loading}
          haptic="medium"
        >
          {loading ? (
            <ActivityIndicator color={D.coral} size="small" />
          ) : (
            <>
              <Text style={S.ctaText}>{error ? 'Try again' : 'Build my profile'}</Text>
              <View style={S.ctaArrow}><ArrowRight size={15} color={D.coral} strokeWidth={2.5} /></View>
            </>
          )}
        </AnimatedPressable>
        <Text style={S.foot}>The first build is on us — it takes about a minute.</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.coral },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
    paddingTop: Platform.OS === 'web' ? 24 : 64,
  },

  brainHero: { alignItems: 'center', justifyContent: 'center', height: 120, marginBottom: 30 },
  brainGlow: { position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: WHITE },
  brainBadge: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },

  title: { ...T.bold, fontSize: 31, color: WHITE, letterSpacing: -0.9, lineHeight: 38, textAlign: 'center' },
  subtitle: { ...T.regular, fontSize: 15.5, color: 'rgba(255,255,255,0.9)', marginTop: 12, lineHeight: 23, textAlign: 'center' },

  rotWrap: { alignItems: 'center', marginTop: 40, minHeight: 168 },
  point: { alignItems: 'center', paddingHorizontal: 8 },
  pointIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 16,
  },
  pointTitle: { ...T.bold, fontSize: 19, color: WHITE, letterSpacing: -0.3, textAlign: 'center' },
  pointBody: { ...T.regular, fontSize: 14.5, color: 'rgba(255,255,255,0.85)', lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 280 },
  dots: { flexDirection: 'row', gap: 7, marginTop: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 20, backgroundColor: WHITE },

  // Analyzing
  analyzeContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34 },
  analyzeHero: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 34 },
  ring: {
    position: 'absolute', width: 132, height: 132, borderRadius: 66,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.28)', borderTopColor: WHITE,
  },
  analyzeTitle: { ...T.bold, fontSize: 24, color: WHITE, letterSpacing: -0.5, textAlign: 'center' },
  analyzeSub: { ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 300 },
  barTrack: {
    width: '100%', maxWidth: 300, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 30, overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: WHITE },
  pct: { ...T.bold, fontSize: 13, color: WHITE, marginTop: 12, letterSpacing: 0.3 },

  leaveCard: {
    marginHorizontal: 24, marginBottom: Platform.OS === 'web' ? 24 : 44,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.lg, padding: 18,
  },
  leaveTitle: { ...T.bold, fontSize: 15.5, color: WHITE, letterSpacing: -0.2, textAlign: 'center' },
  leaveBody: { ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19, textAlign: 'center', marginTop: 6 },

  errorBox: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: R.md, padding: 13, marginTop: 20 },
  errorText: { ...T.medium, fontSize: 13, color: WHITE, textAlign: 'center' },

  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'web' ? 24 : 40, paddingTop: 10 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: WHITE, borderRadius: R.full, paddingVertical: 17, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { ...T.bold, fontSize: 16.5, color: D.coral, letterSpacing: -0.2 },
  ctaArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,55,85,0.12)', alignItems: 'center', justifyContent: 'center' },
  foot: { ...T.regular, fontSize: 12, color: 'rgba(255,255,255,0.72)', textAlign: 'center', marginTop: 14, lineHeight: 17 },
});

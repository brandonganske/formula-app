import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { api, extractData } from '@/lib/api';
import { D, T, R, Shadow } from '@/constants/ds';
import { X, Link, TrendingUp, Zap, ShoppingBag, Sparkles, ChevronDown, Film } from 'lucide-react-native';
import type { WhyOriginalWorks } from '@/types/api';

interface Breakdown {
  video_url: string; title: string | null; view_count: number | null; niche: string | null; detected_product: string | null;
  hook_text: string; hook_type: string; structure: string; key_claims: string[];
  video_format: { format: string; summary: string; production_notes: string[] } | null;
  transcript: { full_text: string; segments: { text: string; startSec: number; endSec: number; speaker: string | null }[] };
  why: WhyOriginalWorks;
}

const humanize = (s: string | null | undefined) => { const t = (s ?? '').replace(/[_-]+/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
const fmtNum = (n: number | null | undefined) => (n == null ? null : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K` : String(n));
const STEPS = ['Fetching the video…', 'Watching it end to end…', 'Reading the hook and structure…', 'Working out why it lands…'];

export default function BreakdownScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { url: urlParam } = useLocalSearchParams<{ url?: string }>();
  const [url, setUrl] = useState(urlParam ?? '');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [res, setRes] = useState<Breakdown | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => { if (!busy) return; setStep(0); const t = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 9000); return () => clearInterval(t); }, [busy]);
  useEffect(() => { if (urlParam && !res && !busy) run(urlParam); }, [urlParam]);

  const run = async (u: string) => {
    if (!u.trim()) return;
    Keyboard.dismiss(); setBusy(true); setRes(null);
    try { setRes(extractData<Breakdown>(await api.post('/creators/tools/breakdown', { video_url: u.trim() }, { timeout: 300_000 })) as Breakdown); }
    catch (e: any) { Alert.alert('Couldn’t break that one down', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={S.hdrIcon}><TrendingUp size={18} color="#FFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}><Text style={S.title}>Video breakdown</Text><Text style={S.sub}>Why it works — then make it yours.</Text></View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!res && !busy && (
          <FadeInView style={S.card}>
            <Text style={S.label}>PASTE A VIDEO</Text>
            <View style={S.urlRow}>
              <Link size={17} color={url ? D.coral : D.textDisabled} strokeWidth={2} />
              <TextInput style={S.urlInput} value={url} onChangeText={setUrl} placeholder="https://www.tiktok.com/@creator/video/…" placeholderTextColor={D.textDisabled} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={() => run(url)} />
            </View>
            <AnimatedPressable style={[S.cta, !url.trim() && { opacity: 0.45 }]} haptic="medium" onPress={() => run(url)} disabled={!url.trim()}>
              <Sparkles size={16} color="#FFF" strokeWidth={2.4} /><Text style={S.ctaText}>Break it down</Text>
            </AnimatedPressable>
            <Text style={S.hint}>Any TikTok, Reel or Short. We watch it, explain the hook, structure and format, then hand you the formula to write with.</Text>
          </FadeInView>
        )}

        {busy && (
          <FadeInView style={[S.card, { alignItems: 'center', paddingVertical: 36 }]}>
            <ActivityIndicator color={D.coral} size="large" />
            <Text style={S.busyTitle}>{STEPS[step]}</Text>
            <Text style={S.busySub}>Usually under a minute.</Text>
          </FadeInView>
        )}

        {res && (
          <FadeInView>
            {/* Why it works — the headline */}
            <View style={S.why}>
              <View style={S.whyHdr}>
                <View style={S.whyIcon}><TrendingUp size={16} color={D.lime} strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={S.whyTitle}>Why this works</Text>
                  {(res.title || res.view_count != null) && <Text style={S.whySub} numberOfLines={1}>{[res.title, fmtNum(res.view_count) ? `${fmtNum(res.view_count)} views` : null].filter(Boolean).join(' · ')}</Text>}
                </View>
              </View>
              <Text style={S.whySummary}>{res.why.summary}</Text>
              {res.why.reasons.map((r, i) => (
                <View key={i} style={S.reason}><View style={S.reasonNum}><Text style={S.reasonNumText}>{i + 1}</Text></View><Text style={S.reasonText}>{r}</Text></View>
              ))}
              <View style={S.formula}><Zap size={11} color={D.lime} strokeWidth={2.4} /><Text style={S.formulaText}>{res.why.formula}</Text></View>
            </View>

            {/* The anatomy */}
            <View style={S.card}>
              <Text style={S.label}>THE ANATOMY</Text>
              <View style={S.row}><Text style={S.rowKey}>Hook</Text><Text style={S.rowVal}>“{res.hook_text}”</Text></View>
              <View style={S.row}><Text style={S.rowKey}>Hook type</Text><Text style={S.rowVal}>{humanize(res.hook_type)}</Text></View>
              <View style={S.row}><Text style={S.rowKey}>Structure</Text><Text style={S.rowVal}>{humanize(res.structure)}</Text></View>
              {res.video_format && <View style={S.row}><Text style={S.rowKey}>Format</Text><Text style={S.rowVal}>{res.video_format.summary}</Text></View>}
              {res.detected_product && <View style={S.row}><Text style={S.rowKey}>Product</Text><Text style={S.rowVal}>{res.detected_product}</Text></View>}
              {res.key_claims.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={S.rowKey}>Key beats</Text>
                  {res.key_claims.map((k, i) => <Text key={i} style={S.beat}>• {k}</Text>)}
                </View>
              )}
              {!!res.transcript?.full_text && (
                <>
                  <TouchableOpacity style={S.tBtn} onPress={() => setShowTranscript((v) => !v)} activeOpacity={0.8}>
                    <Text style={S.tBtnText}>{showTranscript ? 'Hide transcript' : 'Show transcript'}</Text>
                    <ChevronDown size={14} color={D.textMuted} strokeWidth={2.2} style={showTranscript ? { transform: [{ rotate: '180deg' }] } : undefined} />
                  </TouchableOpacity>
                  {showTranscript && <Text style={S.transcript}>{res.transcript.full_text}</Text>}
                </>
              )}
            </View>

            {/* Make it yours */}
            <View style={S.card}>
              <Text style={S.label}>MAKE IT YOURS</Text>
              <AnimatedPressable style={S.choice} haptic="light" onPress={() => router.push({ pathname: '/(tabs)/rewrite', params: { prefillUrl: res.video_url } })}>
                <View style={[S.choiceIcon, { backgroundColor: D.coral }]}><ShoppingBag size={17} color="#FFF" strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}><Text style={S.choiceTitle}>Write it for a product</Text><Text style={S.choiceSub}>Same formula, your TikTok Shop product</Text></View>
              </AnimatedPressable>
              <AnimatedPressable style={S.choice} haptic="light" onPress={() => router.push({ pathname: '/(tabs)/viraltopic', params: { prefillUrl: res.video_url } })}>
                <View style={[S.choiceIcon, { backgroundColor: D.ink }]}><Sparkles size={17} color="#FFF" strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}><Text style={S.choiceTitle}>Write it on my topic</Text><Text style={S.choiceSub}>Keep what works, make it about your thing</Text></View>
              </AnimatedPressable>
            </View>
            <AnimatedPressable style={S.ghost} haptic="light" onPress={() => { setRes(null); setUrl(''); }}><Text style={S.ghostText}>Break down another</Text></AnimatedPressable>
          </FadeInView>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.ink, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 18, marginBottom: 12 },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 10 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 16, height: 54 },
  urlInput: { ...T.medium, flex: 1, fontSize: 15, color: D.textPrimary },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 15, marginTop: 16, ...Shadow.coral },
  ctaText: { ...T.bold, fontSize: 15.5, color: '#FFF' },
  hint: { ...T.regular, fontSize: 12.5, color: D.textDisabled, textAlign: 'center', marginTop: 12, lineHeight: 17 },
  busyTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, marginTop: 14, letterSpacing: -0.3 },
  busySub: { ...T.regular, fontSize: 13.5, color: D.textMuted, marginTop: 4 },
  why: { backgroundColor: D.inkCard, borderRadius: 22, padding: 20, marginBottom: 12 },
  whyHdr: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  whyIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(182,255,138,0.14)', alignItems: 'center', justifyContent: 'center' },
  whyTitle: { ...T.bold, fontSize: 17, color: '#FFF', letterSpacing: -0.3 },
  whySub: { ...T.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  whySummary: { ...T.regular, fontSize: 15, color: 'rgba(255,255,255,0.86)', lineHeight: 23, marginBottom: 14 },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  reasonNum: { width: 22, height: 22, borderRadius: 7, backgroundColor: 'rgba(182,255,138,0.14)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  reasonNumText: { ...T.bold, fontSize: 11, color: D.lime },
  reasonText: { ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 20, flex: 1 },
  formula: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(182,255,138,0.10)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(182,255,138,0.2)', padding: 12, marginTop: 6 },
  formulaText: { ...T.bold, fontSize: 13.5, color: D.lime, lineHeight: 19, flex: 1 },
  row: { marginTop: 8 },
  rowKey: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  rowVal: { ...T.medium, fontSize: 15, color: D.textPrimary, lineHeight: 21, marginTop: 2 },
  beat: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, marginTop: 4 },
  tBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  tBtnText: { ...T.bold, fontSize: 13, color: D.textMuted },
  transcript: { ...T.regular, fontSize: 13.5, color: D.textSecondary, lineHeight: 20, marginTop: 8, backgroundColor: D.surface, borderRadius: 14, padding: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.surface, borderRadius: 16, borderWidth: 1, borderColor: D.border, padding: 12, marginTop: 8 },
  choiceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  choiceSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 1 },
  ghost: { alignItems: 'center', paddingVertical: 14 },
  ghostText: { ...T.bold, fontSize: 14, color: D.textMuted },
});

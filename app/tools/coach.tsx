import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { api, extractData } from '@/lib/api';
import { TOOL_COST, isInsufficientCredits, creditLabel } from '@/lib/credits';
import { haptic } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import NoCreditsModal from '@/components/NoCreditsModal';
import { D, T, R } from '@/constants/ds';
import { X, Mic, Film, Gauge, Volume2, Eye, MessageCircle, RefreshCw } from 'lucide-react-native';
import type { Take } from '@/types/api';

interface CoachResult {
  transcript: string;
  measured: { wpm: number; filler_count: number; filler_examples: string[]; longest_pause_sec: number; hook_sec: number; energy_start: number; energy_cta: number; eye_contact: number; product_visible_sec: number | null };
  scores: { pace: number; clarity: number; energy: number; presence: number; overall: number };
  notes: { timestamp_sec: number | null; note: string; fix: string }[];
  redo_line: { quote: string; why: string } | null;
  headline: string;
  vs_baseline: { wpm_delta_pct: number | null; energy_delta: number | null };
  baseline: { wpm: number | null; energy: number | null; fillers: string[] };
}

const fmtT = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const col = (n: number) => (n >= 80 ? D.limeDeep : n >= 60 ? '#F5A623' : D.coral);

function Score({ label, n, Icon }: { label: string; n: number; Icon: any }) {
  return (
    <View style={S.score}>
      <View style={[S.scoreRing, { borderColor: col(n) }]}><Text style={[S.scoreNum, { color: col(n) }]}>{Math.round(n)}</Text></View>
      <View style={S.scoreLabelRow}><Icon size={11} color={D.textMuted} strokeWidth={2.2} /><Text style={S.scoreLabel}>{label}</Text></View>
    </View>
  );
}

export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { takeId } = useLocalSearchParams<{ takeId?: string }>();
  const [picked, setPicked] = useState<string | null>(takeId ?? null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CoachResult | null>(null);

  const { data: takes } = useQuery<Take[]>({
    queryKey: ['takes'],
    queryFn: async () => extractData<{ takes: Take[] }>(await api.get('/creators/takes'))?.takes ?? [],
    staleTime: 60_000,
  });

  const { credits, refreshMe } = useAuth();
  const [showNoCredits, setShowNoCredits] = useState(false);
  const run = async (id: string) => {
    if (TOOL_COST.coach > 0 && credits < TOOL_COST.coach) { haptic.warning(); setShowNoCredits(true); setPicked(null); return; }
    setBusy(true); setRes(null);
    try { setRes(extractData<CoachResult>(await api.post('/creators/tools/coach', { take_id: id }, { timeout: 300_000 })) as CoachResult); haptic.success(); void refreshMe(); }
    catch (e: any) { haptic.error(); setPicked(null); if (isInsufficientCredits(e)) setShowNoCredits(true); else Alert.alert('Couldn’t coach that take', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (picked && !res && !busy) run(picked); }, [picked]);

  const take = takes?.find((t) => t.id === picked) ?? null;
  const m = res?.measured;
  const wpmLine = res?.vs_baseline.wpm_delta_pct == null ? `${m?.wpm} wpm` : res.vs_baseline.wpm_delta_pct === 0 ? `${m?.wpm} wpm · right at your usual` : `${m?.wpm} wpm · ${Math.abs(res.vs_baseline.wpm_delta_pct)}% ${res.vs_baseline.wpm_delta_pct > 0 ? 'faster' : 'slower'} than your usual ${res.baseline.wpm}`;

  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={S.hdrIcon}><Mic size={18} color="#FFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}><Text style={S.title}>Rehearsal coach</Text><Text style={S.sub}>Delivery, graded against your own baseline.</Text></View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        {!picked && (
          <FadeInView style={S.card}>
            <Text style={S.label}>PICK A TAKE</Text>
            {(takes ?? []).length === 0 && <Text style={S.empty}>No takes yet. Film one in the teleprompter and it'll show up here.</Text>}
            <View style={S.grid}>
              {(takes ?? []).map((t) => (
                <View key={t.id} style={S.col}>
                  <AnimatedPressable style={S.thumbWrap} haptic="light" onPress={() => setPicked(t.id)}>
                    {t.thumb_url ? <Image source={{ uri: t.thumb_url }} style={S.thumb} resizeMode="cover" /> : <View style={[S.thumb, S.thumbPh]}><Film size={18} color={D.textDisabled} strokeWidth={1.8} /></View>}
                  </AnimatedPressable>
                  <Text style={S.takeTitle} numberOfLines={1}>{t.script?.title ?? t.title ?? 'Take'}</Text>
                </View>
              ))}
            </View>
          </FadeInView>
        )}

        {picked && busy && (
          <FadeInView style={[S.card, { alignItems: 'center', paddingVertical: 36 }]}>
            <ActivityIndicator color={D.coral} size="large" />
            <Text style={S.busyTitle}>Watching your take…</Text>
            <Text style={S.busySub}>Measuring pace, fillers, energy and eye contact against how you usually talk. About a minute.</Text>
          </FadeInView>
        )}

        {res && m && (
          <FadeInView>
            <View style={[S.card, S.heroCard]}>
              <Text style={S.heroScore}>{Math.round(res.scores.overall)}</Text>
              <Text style={S.heroHeadline}>{res.headline}</Text>
              {take && <Text style={S.heroTake}>{take.script?.title ?? take.title ?? 'Take'}{take.product_name ? ` · ${take.product_name}` : ''}</Text>}
            </View>
            <View style={[S.card, S.scores]}>
              <Score label="Pace" n={res.scores.pace} Icon={Gauge} />
              <Score label="Clarity" n={res.scores.clarity} Icon={MessageCircle} />
              <Score label="Energy" n={res.scores.energy} Icon={Volume2} />
              <Score label="Presence" n={res.scores.presence} Icon={Eye} />
            </View>
            <View style={S.card}>
              <Text style={S.label}>VS. YOUR USUAL</Text>
              <Text style={S.row}><Text style={S.rowKey}>Pace  </Text>{wpmLine}</Text>
              <Text style={S.row}><Text style={S.rowKey}>Fillers  </Text>{m.filler_count}{m.filler_examples.length ? ` (${m.filler_examples.slice(0, 3).join(', ')})` : ''}{res.baseline.fillers.length ? ' — some of these are just you' : ''}</Text>
              <Text style={S.row}><Text style={S.rowKey}>Hook  </Text>landed at {m.hook_sec.toFixed(1)}s</Text>
              <Text style={S.row}><Text style={S.rowKey}>Energy  </Text>{Math.round(m.energy_start)} at the open → {Math.round(m.energy_cta)} on the ask{res.vs_baseline.energy_delta != null ? ` (usual ${res.baseline.energy})` : ''}</Text>
              <Text style={S.row}><Text style={S.rowKey}>Eye contact  </Text>{Math.round(m.eye_contact)}/100 · longest pause {m.longest_pause_sec.toFixed(1)}s</Text>
              {m.product_visible_sec != null && <Text style={S.row}><Text style={S.rowKey}>Product  </Text>on screen by {m.product_visible_sec.toFixed(1)}s</Text>}
            </View>
            <View style={S.card}>
              <Text style={S.label}>NOTES</Text>
              {res.notes.map((n, i) => (
                <View key={i} style={[S.note, i > 0 && S.noteDivider]}>
                  <Text style={S.noteText}>{n.timestamp_sec != null ? <Text style={S.noteTime}>{fmtT(n.timestamp_sec)}  </Text> : null}{n.note}</Text>
                  <Text style={S.noteFix}>→ {n.fix}</Text>
                </View>
              ))}
            </View>
            {res.redo_line && (
              <View style={[S.card, S.redo]}>
                <Text style={S.redoLabel}>WORTH ONE MORE TAKE</Text>
                <Text style={S.redoQuote}>“{res.redo_line.quote}”</Text>
                <Text style={S.redoWhy}>{res.redo_line.why}</Text>
                <AnimatedPressable style={S.redoBtn} haptic="medium" onPress={() => router.push({ pathname: '/teleprompter', params: { text: res.redo_line!.quote } })}>
                  <RefreshCw size={14} color="#FFF" strokeWidth={2.4} /><Text style={S.redoBtnText}>Re-record this line</Text>
                </AnimatedPressable>
              </View>
            )}
            <AnimatedPressable style={S.ghost} haptic="light" onPress={() => { setRes(null); setPicked(null); }}><Text style={S.ghostText}>Coach another take</Text></AnimatedPressable>
          </FadeInView>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
      <NoCreditsModal visible={showNoCredits} onClose={() => setShowNoCredits(false)} />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#6C5CE7', alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 18, marginBottom: 12 },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 10 },
  empty: { ...T.regular, fontSize: 14, color: D.textMuted, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  col: { width: '31%' },
  thumbWrap: { width: '100%', aspectRatio: 9 / 16, borderRadius: 14, overflow: 'hidden', backgroundColor: D.surface },
  thumb: { width: '100%', height: '100%' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  takeTitle: { ...T.bold, fontSize: 12, color: D.textPrimary, marginTop: 6 },
  busyTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, marginTop: 14, letterSpacing: -0.3 },
  busySub: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', lineHeight: 19, marginTop: 6, paddingHorizontal: 12 },
  heroCard: { backgroundColor: D.inkCard, borderColor: D.inkCard, alignItems: 'center', paddingVertical: 24 },
  heroScore: { ...T.bold, fontSize: 64, color: '#FFF', letterSpacing: -2.5, lineHeight: 68 },
  heroHeadline: { ...T.bold, fontSize: 16, color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 22, marginTop: 6 },
  heroTake: { ...T.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 8 },
  scores: { flexDirection: 'row', justifyContent: 'space-around' },
  score: { alignItems: 'center', gap: 6 },
  scoreRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { ...T.bold, fontSize: 18, letterSpacing: -0.5 },
  scoreLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreLabel: { ...T.medium, fontSize: 11.5, color: D.textMuted },
  row: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 21, marginTop: 4 },
  rowKey: { ...T.bold, color: D.textPrimary },
  note: { paddingVertical: 10 },
  noteDivider: { borderTopWidth: 1, borderTopColor: D.divider },
  noteText: { ...T.medium, fontSize: 14.5, color: D.textPrimary, lineHeight: 21 },
  noteTime: { ...T.bold, color: D.coral, fontVariant: ['tabular-nums'] },
  noteFix: { ...T.regular, fontSize: 13.5, color: D.limeDeep, lineHeight: 19, marginTop: 4 },
  redo: { borderColor: D.coral + '55', backgroundColor: D.coralFaint },
  redoLabel: { ...T.bold, fontSize: 11, color: D.coral, letterSpacing: 0.6, marginBottom: 8 },
  redoQuote: { ...T.bold, fontSize: 16, color: D.textPrimary, lineHeight: 22, fontStyle: 'italic' },
  redoWhy: { ...T.regular, fontSize: 13.5, color: D.textSecondary, lineHeight: 19, marginTop: 6 },
  redoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 13, marginTop: 14 },
  redoBtnText: { ...T.bold, fontSize: 14.5, color: '#FFF' },
  ghost: { alignItems: 'center', paddingVertical: 14 },
  ghostText: { ...T.bold, fontSize: 14, color: D.textMuted },
});

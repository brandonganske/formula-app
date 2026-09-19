import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import ProductPickField from '@/components/ProductPickField';
import { GradePill } from '@/components/ShopSafeReport';
import { api, extractData } from '@/lib/api';
import { D, T, R, Shadow } from '@/constants/ds';
import { X, MessageSquareWarning, Copy, Film, Sparkles } from 'lucide-react-native';
import type { ShopSafeFinding } from '@/types/api';

interface Objection { objection: string; why_they_say_it: string; answer: string; on_screen: string }
interface Result { objections: Objection[]; shop_safe: { grade: 'A' | 'B' | 'C' | 'D' | 'F'; score: number; findings: ShopSafeFinding[]; summary: string } | null }

export default function ObjectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  const run = async () => {
    if (!product.trim()) return;
    Keyboard.dismiss(); setBusy(true);
    try { setRes(extractData<Result>(await api.post('/creators/tools/objections', { product: product.trim() }, { timeout: 90_000 })) as Result); }
    catch (e: any) { Alert.alert('Couldn’t generate', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  };

  const film = (o: Objection) => router.push({ pathname: '/teleprompter', params: { text: `${o.answer}\n\n[on screen: ${o.on_screen}]` } });

  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={S.hdrIcon}><MessageSquareWarning size={18} color="#FFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}><Text style={S.title}>Objection killer</Text><Text style={S.sub}>What they'll say — and your 10-second answer.</Text></View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!res && (
          <FadeInView style={S.card}>
            <Text style={S.label}>WHICH PRODUCT?</Text>
            <ProductPickField value={product} onChange={setProduct} />
            <AnimatedPressable style={[S.cta, !product.trim() && { opacity: 0.45 }]} haptic="medium" onPress={run} disabled={busy || !product.trim()}>
              {busy ? <ActivityIndicator size="small" color="#FFF" /> : <><Sparkles size={16} color="#FFF" strokeWidth={2.4} /><Text style={S.ctaText}>Find the objections</Text></>}
            </AnimatedPressable>
            <Text style={S.hint}>Five things people type under videos like yours, each with a filmable follow-up in your voice — pre-checked by Shop Safe.</Text>
          </FadeInView>
        )}
        {res && (
          <FadeInView>
            {res.shop_safe && (
              <View style={[S.card, S.safeRow]}>
                <GradePill grade={res.shop_safe.grade} score={res.shop_safe.score} size="lg" />
                <Text style={S.safeText} numberOfLines={2}>{res.shop_safe.findings.length === 0 ? 'All five answers are Shop Safe.' : `${res.shop_safe.findings.length} line${res.shop_safe.findings.length === 1 ? '' : 's'} to soften — see the fixes below.`}</Text>
              </View>
            )}
            {res.objections.map((o, i) => {
              const flagged = res.shop_safe?.findings.filter((f) => o.answer.includes(f.quote) || f.quote.includes(o.on_screen)) ?? [];
              return (
                <View key={i} style={S.card}>
                  <Text style={S.objection}>“{o.objection}”</Text>
                  <Text style={S.why}>{o.why_they_say_it}</Text>
                  <View style={S.answer}>
                    <Text style={S.answerLabel}>YOUR ANSWER · ~10s</Text>
                    <Text style={S.answerText}>{o.answer}</Text>
                    <Text style={S.onScreen}>On screen: {o.on_screen}</Text>
                  </View>
                  {flagged.map((f, k) => (
                    <View key={k} style={S.fix}><Text style={S.fixLabel}>Shop Safe · {f.severity}</Text><Text style={S.fixText}>Say instead: {f.fix}</Text></View>
                  ))}
                  <View style={S.actions}>
                    <AnimatedPressable style={[S.btn, S.btnInk]} haptic="light" onPress={() => film(o)}><Film size={14} color="#FFF" strokeWidth={2.2} /><Text style={S.btnTextOn}>Film it</Text></AnimatedPressable>
                    <AnimatedPressable style={S.btn} haptic="light" onPress={() => Clipboard.setStringAsync(o.answer)}><Copy size={14} color={D.textPrimary} strokeWidth={2.2} /><Text style={S.btnText}>Copy</Text></AnimatedPressable>
                  </View>
                </View>
              );
            })}
            <AnimatedPressable style={[S.cta, S.ctaGhost]} haptic="light" onPress={() => setRes(null)}><Text style={[S.ctaText, { color: D.textPrimary }]}>Another product</Text></AnimatedPressable>
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
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 18, marginBottom: 12 },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 8 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 15, marginTop: 20, ...Shadow.coral },
  ctaGhost: { backgroundColor: D.card, borderWidth: 1, borderColor: D.border, shadowOpacity: 0, elevation: 0, marginTop: 4 },
  ctaText: { ...T.bold, fontSize: 15.5, color: '#FFF' },
  hint: { ...T.regular, fontSize: 12, color: D.textDisabled, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  safeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  safeText: { ...T.medium, fontSize: 13.5, color: D.textSecondary, flex: 1, lineHeight: 19 },
  objection: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3, lineHeight: 23 },
  why: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 4, lineHeight: 18 },
  answer: { backgroundColor: D.surface, borderRadius: 16, padding: 14, marginTop: 12 },
  answerLabel: { ...T.bold, fontSize: 10.5, color: D.textMuted, letterSpacing: 0.6, marginBottom: 6 },
  answerText: { ...T.medium, fontSize: 15, color: D.textPrimary, lineHeight: 22 },
  onScreen: { ...T.bold, fontSize: 12, color: D.coral, marginTop: 8 },
  fix: { backgroundColor: D.limeSubtle, borderRadius: 14, padding: 12, marginTop: 8 },
  fixLabel: { ...T.bold, fontSize: 10.5, color: D.limeDeep, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  fixText: { ...T.bold, fontSize: 13.5, color: D.ink, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: R.full, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border },
  btnInk: { backgroundColor: D.ink, borderColor: D.ink },
  btnText: { ...T.bold, fontSize: 13.5, color: D.textPrimary },
  btnTextOn: { ...T.bold, fontSize: 13.5, color: '#FFF' },
});

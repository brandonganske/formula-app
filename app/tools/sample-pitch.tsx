import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import ProductPickField from '@/components/ProductPickField';
import { api, extractData } from '@/lib/api';
import { D, T, R, Shadow } from '@/constants/ds';
import { X, Mail, Copy, Check, Sparkles } from 'lucide-react-native';

interface Pitch { dm: string; email: string; talking_points: string[]; angle: string; used_stats: { followers: number | null; videos: number | null; gmv_30d: number | null } }

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <View style={S.block}>
      <View style={S.blockHdr}>
        <Text style={S.blockLabel}>{label}</Text>
        <TouchableOpacity style={S.copy} onPress={() => { Clipboard.setStringAsync(text); setOk(true); setTimeout(() => setOk(false), 1500); }} hitSlop={8}>
          {ok ? <Check size={13} color={D.limeDeep} strokeWidth={2.6} /> : <Copy size={13} color={D.textMuted} strokeWidth={2.2} />}
          <Text style={[S.copyText, ok && { color: D.limeDeep }]}>{ok ? 'Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={S.blockText} selectable>{text}</Text>
    </View>
  );
}

export default function SamplePitchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState('');
  const [brand, setBrand] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [pitch, setPitch] = useState<Pitch | null>(null);

  const run = async () => {
    if (!product.trim()) return;
    Keyboard.dismiss(); setBusy(true);
    try {
      const r = extractData<Pitch>(await api.post('/creators/tools/sample-pitch', { product: product.trim(), brand: brand.trim() || undefined, notes: notes.trim() || undefined }, { timeout: 60_000 }));
      setPitch(r as Pitch);
    } catch (e: any) { Alert.alert('Couldn’t write it', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'); }
    finally { setBusy(false); }
  };

  const stats = pitch?.used_stats;
  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={S.hdrIcon}><Mail size={18} color="#FFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}><Text style={S.title}>Sample pitch</Text><Text style={S.sub}>The message that gets you the free product.</Text></View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!pitch && (
          <FadeInView style={S.card}>
            <Text style={S.label}>WHICH PRODUCT?</Text>
            <ProductPickField value={product} onChange={setProduct} />
            <Text style={[S.label, { marginTop: 16 }]}>BRAND OR SELLER (OPTIONAL)</Text>
            <View style={S.box}><TextInput style={S.input} value={brand} onChangeText={setBrand} placeholder="e.g. Root Labs" placeholderTextColor={D.textDisabled} /></View>
            <Text style={[S.label, { marginTop: 16 }]}>ANYTHING TO MENTION? (OPTIONAL)</Text>
            <View style={[S.box, { height: 84, paddingVertical: 12 }]}><TextInput style={[S.input, { textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="I've used it for a month… I'm going live Friday…" placeholderTextColor={D.textDisabled} multiline /></View>
            <AnimatedPressable style={[S.cta, !product.trim() && { opacity: 0.45 }]} haptic="medium" onPress={run} disabled={busy || !product.trim()}>
              {busy ? <ActivityIndicator size="small" color="#FFF" /> : <><Sparkles size={16} color="#FFF" strokeWidth={2.4} /><Text style={S.ctaText}>Write my pitch</Text></>}
            </AnimatedPressable>
            <Text style={S.hint}>Built from your real numbers — followers, videos, and sales when they're on record.</Text>
          </FadeInView>
        )}
        {pitch && (
          <FadeInView>
            <View style={S.card}>
              <Text style={S.label}>YOUR ANGLE</Text>
              <Text style={S.angle}>{pitch.angle}</Text>
              {stats && (stats.followers != null || stats.gmv_30d != null) && (
                <Text style={S.stats}>Using: {[stats.followers != null ? `${stats.followers.toLocaleString()} followers` : null, stats.videos != null ? `${stats.videos} videos` : null, stats.gmv_30d != null ? `$${Math.round(stats.gmv_30d).toLocaleString()} 30-day sales` : null].filter(Boolean).join(' · ')}</Text>
              )}
            </View>
            <CopyBlock label="DM / TIKTOK MESSAGE" text={pitch.dm} />
            <CopyBlock label="EMAIL" text={pitch.email} />
            <View style={S.block}>
              <Text style={S.blockLabel}>TALKING POINTS</Text>
              {pitch.talking_points.map((t, i) => <Text key={i} style={S.point}>• {t}</Text>)}
            </View>
            <AnimatedPressable style={[S.cta, S.ctaGhost]} haptic="light" onPress={() => setPitch(null)}>
              <Text style={[S.ctaText, { color: D.textPrimary }]}>Write another</Text>
            </AnimatedPressable>
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
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 20, marginBottom: 12 },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 8 },
  box: { backgroundColor: D.surface, borderRadius: 16, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 16, height: 52, justifyContent: 'center' },
  input: { ...T.medium, fontSize: 15, color: D.textPrimary },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 15, marginTop: 20, ...Shadow.coral },
  ctaGhost: { backgroundColor: D.card, borderWidth: 1, borderColor: D.border, shadowOpacity: 0, elevation: 0, marginTop: 4 },
  ctaText: { ...T.bold, fontSize: 15.5, color: '#FFF' },
  hint: { ...T.regular, fontSize: 12, color: D.textDisabled, textAlign: 'center', marginTop: 10, lineHeight: 17 },
  angle: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3, lineHeight: 23 },
  stats: { ...T.medium, fontSize: 12, color: D.limeDeep, marginTop: 8 },
  block: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 18, marginBottom: 12 },
  blockHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  blockLabel: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6 },
  blockText: { ...T.regular, fontSize: 15, color: D.textPrimary, lineHeight: 22 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1, borderColor: D.border, paddingHorizontal: 10, paddingVertical: 5 },
  copyText: { ...T.bold, fontSize: 12, color: D.textMuted },
  point: { ...T.regular, fontSize: 14.5, color: D.textSecondary, lineHeight: 21, marginTop: 6 },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { D, T, R } from '@/constants/ds';
import { X, Link, ShoppingBag, TrendingUp, Sparkles, ShieldCheck } from 'lucide-react-native';

// Landing screen for links shared INTO Formula from TikTok's share sheet.
// One question: what do you want to do with this video?
export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url?: string }>();
  const link = (url ?? '').trim();
  const short = link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44) + (link.length > 52 ? '…' : '');

  const go = (path: string, params: Record<string, string>) => router.replace({ pathname: path as any, params });

  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={{ flex: 1 }}><Text style={S.title}>Shared to Formula</Text><Text style={S.sub}>What do you want to do with it?</Text></View>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <FadeInView style={S.wrap}>
        <View style={S.linkRow}><Link size={14} color={D.coral} strokeWidth={2.2} /><Text style={S.linkText} numberOfLines={1}>{short || 'No link received'}</Text></View>

        <AnimatedPressable style={S.opt} haptic="light" onPress={() => go('/(tabs)/rewrite', { prefillUrl: link })}>
          <View style={[S.icon, { backgroundColor: D.coral }]}><ShoppingBag size={19} color="#FFF" strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}><Text style={S.optTitle}>Rewrite it for a product</Text><Text style={S.optSub}>Same structure, your TikTok Shop product, your voice</Text></View>
        </AnimatedPressable>
        <AnimatedPressable style={S.opt} haptic="light" onPress={() => go('/tools/breakdown', { url: link })}>
          <View style={[S.icon, { backgroundColor: '#3A86FF' }]}><TrendingUp size={19} color="#FFF" strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}><Text style={S.optTitle}>Break it down</Text><Text style={S.optSub}>Why it works — hook, structure, formula</Text></View>
        </AnimatedPressable>
        <AnimatedPressable style={S.opt} haptic="light" onPress={() => go('/(tabs)/viraltopic', { prefillUrl: link })}>
          <View style={[S.icon, { backgroundColor: D.ink }]}><Sparkles size={19} color="#FFF" strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}><Text style={S.optTitle}>Recreate it on my topic</Text><Text style={S.optSub}>Keep what works, make it about your thing</Text></View>
        </AnimatedPressable>
        <AnimatedPressable style={S.opt} haptic="light" onPress={() => go('/shop-safe', { mode: 'video', url: link })}>
          <View style={[S.icon, { backgroundColor: D.limeDeep }]}><ShieldCheck size={19} color="#FFF" strokeWidth={2.2} /></View>
          <View style={{ flex: 1 }}><Text style={S.optTitle}>Shop Safe check</Text><Text style={S.optSub}>Would this get flagged? Timestamped report</Text></View>
        </AnimatedPressable>
      </FadeInView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  title: { ...T.bold, fontSize: 24, color: D.textPrimary, letterSpacing: -0.6 },
  sub: { ...T.regular, fontSize: 14, color: D.textMuted, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  wrap: { paddingHorizontal: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: D.coralFaint, borderRadius: R.full, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  linkText: { ...T.medium, fontSize: 13, color: D.textPrimary, flex: 1 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 16, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optTitle: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.3 },
  optSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 2, lineHeight: 18 },
});

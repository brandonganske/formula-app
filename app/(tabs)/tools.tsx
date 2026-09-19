import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { D, T, R, Shadow } from '@/constants/ds';
import { ShieldCheck, Film, FileText, ArrowRight, Sparkles, Clapperboard } from 'lucide-react-native';

// Tools — utilities that sit beside the script engine. Shop Safe is the first;
// the list grows as tools ship. The creator profile lives behind the avatar.
export default function ToolsScreen() {
  const router = useRouter();
  return (
    <TabFadeView>
      <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <FadeInView style={S.head}>
          <Text style={S.title}>Tools</Text>
          <Text style={S.sub}>Everything else you need before you post.</Text>
        </FadeInView>

        {/* Shop Safe — hero tool */}
        <FadeInView delay={60} style={S.hero}>
          <View style={S.heroTop}>
            <View style={S.heroIcon}><ShieldCheck size={20} color="#FFF" strokeWidth={2.4} /></View>
            <View style={{ flex: 1 }}>
              <Text style={S.heroTitle}>Shop Safe</Text>
              <Text style={S.heroSub}>TikTok Shop policy check</Text>
            </View>
            <View style={S.newPill}><Text style={S.newPillText}>NEW</Text></View>
          </View>
          <Text style={S.heroBody}>
            Catch the lines that get videos flagged or buried — health claims, guarantees, fake urgency, before/afters — and get what to say instead, in your voice.
          </Text>
          <View style={S.actions}>
            <AnimatedPressable style={S.action} haptic="light" onPress={() => router.push({ pathname: '/shop-safe', params: { mode: 'video' } })}>
              <View style={S.actionIcon}><Film size={16} color={D.ink} strokeWidth={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={S.actionTitle}>Check a video</Text>
                <Text style={S.actionSub}>Upload a cut before posting</Text>
              </View>
              <ArrowRight size={16} color={D.textMuted} strokeWidth={2.2} />
            </AnimatedPressable>
            <AnimatedPressable style={S.action} haptic="light" onPress={() => router.push({ pathname: '/shop-safe', params: { mode: 'script' } })}>
              <View style={S.actionIcon}><FileText size={16} color={D.ink} strokeWidth={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={S.actionTitle}>Check a script</Text>
                <Text style={S.actionSub}>Paste anything before you film</Text>
              </View>
              <ArrowRight size={16} color={D.textMuted} strokeWidth={2.2} />
            </AnimatedPressable>
          </View>
          <Text style={S.heroNote}>Every script you save is checked automatically — look for the grade on Saved.</Text>
        </FadeInView>

        {/* Teleprompter */}
        <FadeInView delay={90} style={[S.hero, { marginTop: 14 }]}>
          <View style={S.heroTop}>
            <View style={[S.heroIcon, { backgroundColor: D.ink }]}><Clapperboard size={20} color="#FFF" strokeWidth={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={S.heroTitle}>Teleprompter</Text>
              <Text style={S.heroSub}>Scrolls at your talking speed</Text>
            </View>
          </View>
          <Text style={S.heroBody}>
            Any saved script, full screen, scrolling at the pace you actually talk. Tap to pause, nudge the speed, mirror it for a camera rig.
          </Text>
          <AnimatedPressable style={[S.action, { marginTop: 14 }]} haptic="light" onPress={() => router.push('/teleprompter')}>
            <View style={S.actionIcon}><Film size={16} color={D.ink} strokeWidth={2.2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={S.actionTitle}>Film a script</Text>
              <Text style={S.actionSub}>Pick from Saved</Text>
            </View>
            <ArrowRight size={16} color={D.textMuted} strokeWidth={2.2} />
          </AnimatedPressable>
        </FadeInView>

        <FadeInView delay={130} style={S.soon}>
          <Sparkles size={14} color={D.textMuted} strokeWidth={2.2} />
          <Text style={S.soonText}>More tools on the way — shot list, hook lab, picked-for-you products.</Text>
        </FadeInView>
        <View style={{ height: 40 }} />
      </ScrollView>
    </TabFadeView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingHorizontal: 16 },
  head: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 16 },
  title: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8, lineHeight: 34 },
  sub: { ...T.regular, fontSize: 14, color: D.textMuted, marginTop: 4 },
  hero: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 20, ...Shadow.soft },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: D.limeDeep, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { ...T.bold, fontSize: 19, color: D.textPrimary, letterSpacing: -0.4 },
  heroSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  newPill: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  newPillText: { ...T.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.6 },
  heroBody: { ...T.regular, fontSize: 14.5, color: D.textSecondary, lineHeight: 21, marginTop: 14 },
  actions: { gap: 8, marginTop: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.surface, borderRadius: 16, borderWidth: 1, borderColor: D.border, padding: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: D.inkHairline, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  actionSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 1 },
  heroNote: { ...T.regular, fontSize: 12.5, color: D.textMuted, lineHeight: 18, marginTop: 14 },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 6 },
  soonText: { ...T.regular, fontSize: 12.5, color: D.textMuted, flex: 1, lineHeight: 18 },
});

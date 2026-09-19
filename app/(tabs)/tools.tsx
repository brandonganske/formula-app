import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { D, T, R } from '@/constants/ds';
import { ShieldCheck, Clapperboard, Mail, MessageSquareWarning, Mic } from 'lucide-react-native';

// Tools — a simple grid of same-size tiles. Each opens its own screen where
// the explanation and actions live, so this page never becomes a long scroll.
type Tool = { key: string; title: string; sub: string; Icon: any; bg: string; route?: string; soon?: boolean; isNew?: boolean };

const TOOLS: Tool[] = [
  { key: 'shopsafe', title: 'Shop Safe', sub: 'Policy check', Icon: ShieldCheck, bg: D.limeDeep, route: '/shop-safe', isNew: true },
  { key: 'prompter', title: 'Teleprompter', sub: 'Film at your pace', Icon: Clapperboard, bg: D.ink, route: '/teleprompter', isNew: true },
  { key: 'coach', title: 'Rehearsal coach', sub: 'Grade your delivery', Icon: Mic, bg: '#6C5CE7', route: '/tools/coach', isNew: true },
  { key: 'objections', title: 'Objection killer', sub: '5 comments, 5 answers', Icon: MessageSquareWarning, bg: '#F5A623', route: '/tools/objections', isNew: true },
  { key: 'pitch', title: 'Sample pitch', sub: 'Get the free product', Icon: Mail, bg: D.coral, route: '/tools/sample-pitch', isNew: true },
];

export default function ToolsScreen() {
  const router = useRouter();
  return (
    <TabFadeView>
      <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <FadeInView style={S.head}>
          <Text style={S.title}>Tools</Text>
          <Text style={S.sub}>Everything else you need before you post.</Text>
        </FadeInView>

        <View style={S.grid}>
          {TOOLS.map((t, i) => (
            <FadeInView key={t.key} delay={40 + i * 40} style={S.cell}>
              <AnimatedPressable
                style={[S.tile, t.soon && S.tileSoon]}
                haptic="light"
                disabled={t.soon}
                onPress={() => t.route && router.push(t.route as any)}
              >
                <View style={S.tileTop}>
                  <View style={[S.icon, { backgroundColor: t.soon ? D.inkHairline : t.bg }]}>
                    <t.Icon size={20} color={t.soon ? D.textDisabled : '#FFF'} strokeWidth={2.2} />
                  </View>
                  {t.isNew && <View style={S.pill}><Text style={S.pillText}>NEW</Text></View>}
                  {t.soon && <View style={[S.pill, S.pillSoon]}><Text style={[S.pillText, S.pillSoonText]}>SOON</Text></View>}
                </View>
                <Text style={[S.tileTitle, t.soon && { color: D.textMuted }]}>{t.title}</Text>
                <Text style={S.tileSub}>{t.sub}</Text>
              </AnimatedPressable>
            </FadeInView>
          ))}
        </View>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48.5%' },
  tile: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 16, minHeight: 132 },
  tileSoon: { backgroundColor: D.surface },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pill: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 7, paddingVertical: 3 },
  pillText: { ...T.bold, fontSize: 9.5, color: '#FFF', letterSpacing: 0.6 },
  pillSoon: { backgroundColor: D.inkHairline },
  pillSoonText: { color: D.textMuted },
  tileTitle: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.3 },
  tileSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 2 },
});

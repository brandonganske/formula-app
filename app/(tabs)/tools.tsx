import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { D, T, R } from '@/constants/ds';
import { ShieldCheck, Clapperboard, Mail, MessageSquareWarning, Mic, TrendingUp, Info, X, ArrowRight } from 'lucide-react-native';

// Tools — a grid of same-size tiles. Tap a tile to open the tool; tap ⓘ for
// what it does and when to use it.
interface Tool { key: string; title: string; sub: string; Icon: any; bg: string; route: string; about: string; how: string[]; bestFor: string }

const TOOLS: Tool[] = [
  {
    key: 'shopsafe', title: 'Shop Safe', sub: 'Policy check', Icon: ShieldCheck, bg: D.limeDeep, route: '/shop-safe',
    about: 'Catches the lines that get TikTok Shop videos flagged, buried, or rejected — before you post. Health claims, guarantees, fake urgency, before/afters, off-platform links, and 30 more rules pulled from TikTok\'s own policies.',
    how: ['Paste a script or upload a cut of the video.', 'Every risky line is quoted with the rule it trips and a rewrite in your voice.', 'Videos get timestamps; scripts get a grade A–F. Every script you save is checked automatically.'],
    bestFor: 'Right before you film, and again before you post.',
  },
  {
    key: 'prompter', title: 'Teleprompter', sub: 'Film at your pace', Icon: Clapperboard, bg: D.ink, route: '/teleprompter',
    about: 'A full-screen prompter over your camera that scrolls at the speed you actually talk — pulled from your profile — so you never read too fast or too slow.',
    how: ['Pick a saved script or paste one.', 'Framing outline keeps you in the same spot every take; the read line sits near the lens so your eyes stay on camera.', 'Record in-app, review the take, save it to Photos and Formula, then edit in TikTok and post.'],
    bestFor: 'Every talking-head video.',
  },
  {
    key: 'breakdown', title: 'Video breakdown', sub: 'Why it works', Icon: TrendingUp, bg: '#3A86FF', route: '/tools/breakdown',
    about: 'Paste any TikTok, Reel or Short and get a plain-language read on why it works: the hook, the structure, the format, the beats — and the reusable formula.',
    how: ['We watch the video end to end and transcribe it.', 'You get the hook line, hook type, structure and three specific reasons it lands.', 'One tap turns the formula into a script for your product or your topic.'],
    bestFor: 'Studying a competitor or a viral video before you copy the structure.',
  },
  {
    key: 'coach', title: 'Rehearsal coach', sub: 'Grade your delivery', Icon: Mic, bg: '#6C5CE7', route: '/tools/coach',
    about: 'Grades how you delivered a take — pace, clarity, energy, presence — against your own usual style, not a generic standard. It knows your normal speed, your natural fillers and your energy, so it only flags what\'s actually off.',
    how: ['Pick a take you filmed in the teleprompter.', 'Get scores, timestamped notes with a fix each, and the one line most worth re-recording.', 'Re-record that line straight from the report.'],
    bestFor: 'Before you commit to a take, or when a video felt off and you\'re not sure why.',
  },
  {
    key: 'objections', title: 'Objection killer', sub: '5 comments, 5 answers', Icon: MessageSquareWarning, bg: '#F5A623', route: '/tools/objections',
    about: 'The five things people will type under your video about a product — "is it legit", "too expensive", "does it actually work" — and a 10-second on-camera answer for each, in your voice and Shop Safe-checked.',
    how: ['Pick a product from your shelf or search TikTok Shop.', 'Each objection comes with the real worry behind it and a filmable answer plus on-screen text.', 'Tap Film it to record the reply as a follow-up video.'],
    bestFor: 'Reply videos and the comment section under a product post.',
  },
  {
    key: 'pitch', title: 'Sample pitch', sub: 'Get the free product', Icon: Mail, bg: D.coral, route: '/tools/sample-pitch',
    about: 'The message you send a brand or seller to get a free sample — written from you to them, built on your real numbers, and designed to stand out from the hundred identical requests they get.',
    how: ['Pick a product from your shelf or trending on TikTok Shop.', 'We rate the fit and say why you\'re a match — niche, audience, real stats.', 'You get a DM, an email version, and talking points to reuse in the conversation.'],
    bestFor: 'Any product you want to promote but haven\'t got in hand yet.',
  },
];

export default function ToolsScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<Tool | null>(null);
  return (
    <TabFadeView>
      <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <FadeInView style={S.head}>
          <Text style={S.title}>Tools</Text>
          <Text style={S.sub}>Everything you need before you post.</Text>
        </FadeInView>

        <View style={S.grid}>
          {TOOLS.map((t, i) => (
            <FadeInView key={t.key} delay={40 + i * 35} style={S.cell}>
              <AnimatedPressable style={S.tile} haptic="light" onPress={() => router.push(t.route as any)}>
                <View style={S.tileTop}>
                  <View style={[S.icon, { backgroundColor: t.bg }]}><t.Icon size={20} color="#FFF" strokeWidth={2.2} /></View>
                  <TouchableOpacity style={S.info} onPress={() => setInfo(t)} hitSlop={10} activeOpacity={0.7}>
                    <Info size={15} color={D.textMuted} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
                <Text style={S.tileTitle}>{t.title}</Text>
                <Text style={S.tileSub}>{t.sub}</Text>
              </AnimatedPressable>
            </FadeInView>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* About this tool */}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <Pressable style={S.backdrop} onPress={() => setInfo(null)}>
          <Pressable style={S.sheet} onPress={() => {}}>
            {info && (
              <>
                <View style={S.sheetHdr}>
                  <View style={[S.icon, { backgroundColor: info.bg }]}><info.Icon size={20} color="#FFF" strokeWidth={2.2} /></View>
                  <View style={{ flex: 1 }}><Text style={S.sheetTitle}>{info.title}</Text><Text style={S.sheetSub}>{info.sub}</Text></View>
                  <TouchableOpacity onPress={() => setInfo(null)} hitSlop={12}><X size={20} color={D.textMuted} strokeWidth={2} /></TouchableOpacity>
                </View>
                <Text style={S.about}>{info.about}</Text>
                <Text style={S.label}>HOW IT WORKS</Text>
                {info.how.map((h, i) => (
                  <View key={i} style={S.step}><View style={S.stepNum}><Text style={S.stepNumText}>{i + 1}</Text></View><Text style={S.stepText}>{h}</Text></View>
                ))}
                <Text style={[S.label, { marginTop: 14 }]}>BEST FOR</Text>
                <Text style={S.best}>{info.bestFor}</Text>
                <AnimatedPressable style={S.open} haptic="medium" onPress={() => { const r = info.route; setInfo(null); router.push(r as any); }}>
                  <Text style={S.openText}>Open {info.title}</Text><ArrowRight size={16} color="#FFF" strokeWidth={2.5} />
                </AnimatedPressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  tile: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 16, height: 138 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  info: { width: 28, height: 28, borderRadius: 14, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.3 },
  tileSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 2 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, borderWidth: 1, borderColor: D.cardBorder },
  sheetHdr: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sheetTitle: { ...T.bold, fontSize: 19, color: D.textPrimary, letterSpacing: -0.4 },
  sheetSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  about: { ...T.regular, fontSize: 15, color: D.textPrimary, lineHeight: 22, marginBottom: 16 },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { ...T.bold, fontSize: 11, color: D.coral },
  stepText: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 20, flex: 1 },
  best: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 20 },
  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 14, marginTop: 20 },
  openText: { ...T.bold, fontSize: 15, color: '#FFF' },
});

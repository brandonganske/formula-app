import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Platform, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import { useRouter } from 'expo-router';
import { D, T, R, Shadow } from '@/constants/ds';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { Link, ArrowRight, ShoppingBag, Instagram, ChevronRight, TrendingUp } from 'lucide-react-native';

// ─── SVG icons ────────────────────────────────────────────────────────────────

function ScriptIQBrainIcon({ color = D.coral }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 32 32" fill="none">
      <Path d="M15 7.2c-1.3-1.6-4-1.7-5.2-.1-2 .1-3.3 2-2.6 3.7-1.6.8-1.8 3.1-.2 4.2-.5 1.8 1 3.6 2.9 3.4.5 1.5 2.3 2.3 3.7 1.5M15 7.2c1.1-1.4 3.3-1.6 4.7-.5"
        stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={10.6} y={11.4} width={7.4} height={2.4} rx={1.2} fill={D.limeDeep} />
      <Rect x={10.6} y={15.2} width={4.8} height={2.4} rx={1.2} fill={color} />
      <Rect x={20} y={14} width={2.6} height={7.2} rx={1.3} fill={D.limeDeep} />
    </Svg>
  );
}

function BoltIcon({ color = '#FFF' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </Svg>
  );
}


// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={slS.label}>{text}</Text>;
}
const slS = StyleSheet.create({
  label: {
    ...T.bold, fontSize: 11, letterSpacing: 0.13 * 11,
    textTransform: 'uppercase', color: D.textMuted, marginTop: 26, marginBottom: 13,
  },
});

// ─── Live badge ───────────────────────────────────────────────────────────────

function LiveBadge({ text }: { text: string }) {
  return (
    <View style={lbS.wrap}>
      <View style={lbS.dot} />
      <Text style={lbS.text}>{text}</Text>
    </View>
  );
}
const lbS = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full,
    backgroundColor: 'rgba(182,255,138,0.13)',
    borderWidth: 1, borderColor: 'rgba(182,255,138,0.28)',
    alignSelf: 'flex-start', marginTop: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.lime },
  text: { ...T.bold, fontSize: 10, color: D.lime, letterSpacing: 0.04 * 10 },
});

// ─── Generator card ───────────────────────────────────────────────────────────

function GenCard({
  icon, iconBg, iconBorder,
  title, pill, pillColor,
  sub, onPress, soon,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  title: string;
  pill: string;
  pillColor: string;
  sub: string;
  onPress?: () => void;
  soon?: boolean;
}) {
  return (
    <TouchableOpacity
      style={gcS.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.82 : 1}
    >
      <View style={[gcS.iconBox, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        {icon}
      </View>
      <View style={gcS.body}>
        <Text style={gcS.title}>{title}</Text>
        <View style={gcS.pillRow}>
          <View style={[gcS.pill, { backgroundColor: pillColor + '14' }]}>
            <Text style={[gcS.pillText, { color: pillColor }]}>{pill}</Text>
          </View>
          {soon && (
            <View style={gcS.soonPill}>
              <Text style={gcS.soonText}>SOON</Text>
            </View>
          )}
        </View>
        <Text style={gcS.sub}>{sub}</Text>
      </View>
      <View style={gcS.chevron}>
        {soon
          ? null
          : <ChevronRight size={16} color={D.textMuted} strokeWidth={2} />
        }
      </View>
    </TouchableOpacity>
  );
}
const gcS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: D.card, borderRadius: 22,
    borderWidth: 1, borderColor: D.cardBorder,
    padding: 16, marginBottom: 12, ...Shadow.soft,
  },
  iconBox: {
    width: 50, height: 50, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, borderWidth: 1,
  },
  body: { flex: 1, gap: 4 },
  title: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.2 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.full },
  pillText: { ...T.bold, fontSize: 10, letterSpacing: 0.02 * 10 },
  soonPill: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.full,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
  },
  soonText: { ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 0.1 * 9 },
  sub: { ...T.regular, fontSize: 12, color: D.textMuted, lineHeight: 17 },
  chevron: { flexShrink: 0 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScriptIQScreen() {
  const router = useRouter();
  const [shopUrl, setShopUrl] = useState('');
  const [viralUrl, setViralUrl] = useState('');

  const handleShopGo = () => {
    Keyboard.dismiss();
    router.push({ pathname: '/(tabs)/rewrite', params: shopUrl.trim() ? { prefillUrl: shopUrl.trim() } : {} });
  };

  const handleViralGo = () => {
    Keyboard.dismiss();
    router.push({ pathname: '/(tabs)/viraltopic', params: viralUrl.trim() ? { prefillUrl: viralUrl.trim() } : {} });
  };

  return (
    <TabFadeView>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={S.root}>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Hero text */}
        <FadeInView delay={40}>
          <Text style={S.heroTitle}>Scripts that{'\n'}sound like <Text style={S.heroItalic}>you.</Text></Text>
        </FadeInView>

        {/* Card 1 — Viral Script Recreator (TikTok Shop) */}
        <FadeInView delay={100} style={S.heroCard}>
          <View style={S.heroCardGlow} pointerEvents="none" />
          <View style={S.heroCardTop}>
            <View style={S.boltSq}>
              <BoltIcon />
            </View>
            <View style={S.heroCardMeta}>
              <Text style={S.heroCardTitle}>Shoppable Script Rewrite</Text>
              <LiveBadge text="TIKTOK SHOP" />
            </View>
          </View>
          <View style={S.urlRow}>
            <Link size={18} color="rgba(255,255,255,0.40)" strokeWidth={1.8} />
            <TextInput
              style={S.urlInput}
              value={shopUrl}
              onChangeText={(t) => { setShopUrl(t); if (t.startsWith('http')) Keyboard.dismiss(); }}
              placeholder="Paste a shoppable TikTok Shop video…"
              placeholderTextColor="rgba(255,255,255,0.38)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleShopGo}
            />
            <TouchableOpacity style={S.goBtn} onPress={handleShopGo} activeOpacity={0.85}>
              <ArrowRight size={18} color={D.ink} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        <View style={S.cardGap} />

        {/* Card 2 — Viral Recreator (Brand Deals / Organic) */}
        <FadeInView delay={155} style={S.viralCard}>
          <View style={S.viralCardGlow} pointerEvents="none" />
          <View style={S.heroCardTop}>
            <View style={S.cyanSq}>
              <TrendingUp size={20} color="#FFF" strokeWidth={2} />
            </View>
            <View style={S.heroCardMeta}>
              <Text style={S.heroCardTitle}>Non Shoppable Rewrite</Text>
              <View style={S.cyanBadge}>
                <Text style={S.cyanBadgeText}>BRAND DEALS · ORGANIC</Text>
              </View>
            </View>
          </View>
          <View style={S.urlRow}>
            <Link size={18} color="rgba(255,255,255,0.40)" strokeWidth={1.8} />
            <TextInput
              style={S.urlInput}
              value={viralUrl}
              onChangeText={(t) => { setViralUrl(t); if (t.startsWith('http')) Keyboard.dismiss(); }}
              placeholder="Paste any viral video — no product needed…"
              placeholderTextColor="rgba(255,255,255,0.38)"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleViralGo}
            />
            <TouchableOpacity style={S.goBtnCyan} onPress={handleViralGo} activeOpacity={0.85}>
              <ArrowRight size={18} color="#FFF" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </FadeInView>

        {/* ── Generate from scratch ──────────────────────────────────── */}
        <SectionLabel text="Or generate from scratch" />

        <FadeInView delay={160}>
          <GenCard
            icon={<ShoppingBag size={22} color={D.coral} strokeWidth={1.8} />}
            iconBg={D.coralSubtle}
            iconBorder={D.coral + '28'}
            title="Shop Script Generator"
            pill="TIKTOK SHOP · CHOOSE PRODUCT"
            pillColor={D.coral}
            sub="Choose a product and get a shoppable script built to convert."
            onPress={() => router.push('/(tabs)/productscript')}
          />
        </FadeInView>

        <FadeInView delay={200}>
          <GenCard
            icon={<Instagram size={22} color={D.limeDeep} strokeWidth={1.8} />}
            iconBg="rgba(47,161,12,0.10)"
            iconBorder="rgba(47,161,12,0.20)"
            title="Social Script Generator"
            pill="INSTAGRAM + TIKTOK"
            pillColor={D.limeDeep}
            sub="Generate organic Reels & TikToks from any idea — no product needed."
            onPress={() => router.push('/(tabs)/organicscript')}
          />
        </FadeInView>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
    </TouchableWithoutFeedback>
    </TabFadeView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  // Hero text
  iqPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 15, paddingVertical: 7, borderRadius: R.full,
    backgroundColor: D.coralSubtle, borderWidth: 1, borderColor: D.coral + '36',
    marginBottom: 16,
  },
  iqPillText: { ...T.bold, fontSize: 12, color: D.coral, letterSpacing: 0.02 * 12 },

  heroTitle: {
    ...T.bold, fontSize: 34, color: D.ink,
    letterSpacing: -1.2, lineHeight: 39, marginBottom: 14,
  },
  heroItalic: {
    fontStyle: 'italic', color: D.ink,
  },
  heroSub: {
    ...T.regular, fontSize: 15, color: D.inkSoft, lineHeight: 23,
  },

  rewriteExplain: {
    ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 20,
    marginBottom: 14,
  },

  howRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, gap: 0,
  },
  howStep: { flex: 1, alignItems: 'center', gap: 8 },
  howIcon: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center',
  },
  howLabel: {
    ...T.regular, fontSize: 11, color: D.textMuted,
    textAlign: 'center', lineHeight: 15,
  },
  howDivider: {
    width: 20, height: 1,
    backgroundColor: D.border, marginBottom: 20, flexShrink: 0,
  },

  // Hero card (dark, viral recreator)
  heroCard: {
    backgroundColor: D.inkCard, borderRadius: 24, padding: 18,
    overflow: 'hidden',
    shadowColor: '#1A1426',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24, shadowRadius: 36, elevation: 12,
  },
  heroCardGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    top: -100, right: -70,
    backgroundColor: 'rgba(255,94,58,0.22)',
  },
  heroCardTop: {
    flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 14,
  },
  boltSq: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    shadowColor: D.coral, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.36, shadowRadius: 18, elevation: 6,
  },
  heroCardMeta: { flex: 1 },
  heroCardTitle: { ...T.bold, fontSize: 18, color: '#FFF', letterSpacing: -0.4, lineHeight: 22 },

  // Card gap
  cardGap: { height: 12 },

  // Viral Recreator card (cyan)
  viralCard: {
    backgroundColor: D.inkCard, borderRadius: 24, padding: 18,
    overflow: 'hidden',
    shadowColor: '#1A1426',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.20, shadowRadius: 32, elevation: 10,
  },
  viralCardGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    top: -100, right: -70,
    backgroundColor: 'rgba(6,182,212,0.18)',
  },
  cyanSq: {
    width: 42, height: 42, borderRadius: 13, backgroundColor: D.cyan,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    shadowColor: D.cyan, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32, shadowRadius: 18, elevation: 6,
  },
  cyanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.full,
    backgroundColor: 'rgba(6,182,212,0.13)',
    borderWidth: 1, borderColor: 'rgba(6,182,212,0.28)',
    alignSelf: 'flex-start', marginTop: 5,
  },
  cyanBadgeText: { ...T.bold, fontSize: 10, color: D.cyan, letterSpacing: 0.04 * 10 },

  // URL row
  urlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 15, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  urlInput: {
    flex: 1, height: 40,
    ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.80)',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  goBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: D.lime,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  goBtnCyan: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: D.cyan,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Animated, useWindowDimensions, TouchableOpacity, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedPressable from '@/components/AnimatedPressable';
import { IconSaved, IconProducts, IconTools, ScriptIQIcon } from '@/components/TabIcons';
import { storage } from '@/lib/storage';
import { TOUR_SEEN_KEY } from '@/lib/tour';
import { haptic } from '@/lib/haptics';
import { D, T, R, Ease, Shadow } from '@/constants/ds';
import { User, Clapperboard, Share2, ArrowRight, ArrowLeft, Check } from 'lucide-react-native';

// Tab glyphs at tour size, white on the gradient tile (same paths as the bar).
const TileTools = () => <IconTools color="#FFF" size={44} />;
const TileProducts = () => <IconProducts color="#FFF" size={44} />;
const TileSaved = () => <IconSaved color="#FFF" size={44} />;
const TileScripting = () => <ScriptIQIcon size={46} />;

interface Page {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  Icon: any;
  colors: readonly [string, string];
  route?: string;
  cta?: string;
}

// The seven things a creator needs to know. Every page ends in the screen it
// describes, so the tour doubles as a launcher.
const PAGES: Page[] = [
  {
    key: 'profile', eyebrow: 'START HERE · TAP YOUR AVATAR', title: 'Everything starts with your profile.',
    body: 'Formula watched your videos and learned how you talk, hook, cut and sell. Every script, tool and check in the app is built on that.',
    bullets: ['Your archetype and where you beat the typical creator', 'Your hooks, decoded and explained', 'How you shoot, who you\'re for, what sells'],
    Icon: User, colors: [D.ink, '#3A2E55'], route: '/(tabs)', cta: 'See my profile',
  },
  {
    key: 'scripting', eyebrow: 'THE RED BUTTON · SCRIPTING', title: 'One page. Three scripts. Your voice.',
    body: 'Paste a video link or start from scratch, pick a product or a topic, and get three filmable scripts with the hook explained.',
    bullets: ['Rewrite a viral video for your product', 'Recreate a format on your own topic', 'Every save gets a Shop Safe grade automatically'],
    Icon: TileScripting, colors: ['#FF7A45', D.coral], route: '/(tabs)/scriptiq', cta: 'Open Scripting',
  },
  {
    key: 'products', eyebrow: 'TAB · PRODUCTS', title: 'Find what pays, then write for it.',
    body: 'Top-commission products by category, real TikTok Shop data, and a one-tap "Write a script for this" on every product you open.',
    bullets: ['Search TikTok Shop or browse by category', 'Save products into folders', 'Pitch a brand for a free sample straight from the product'],
    Icon: TileProducts, colors: [D.coral, '#FF5E8A'], route: '/(tabs)/products', cta: 'Browse products',
  },
  {
    key: 'saved', eyebrow: 'TAB · SAVED', title: 'Your library: scripts, products, videos.',
    body: 'One place for everything you keep. Scripts show their Shop Safe grade, their results once posted, and the takes you filmed for them.',
    bullets: ['Folders for scripts and products, drag to file', 'Film any script in one tap', '"Posted it?" links a script to the video it became'],
    Icon: TileSaved, colors: ['#3A86FF', '#5B6CFF'], route: '/(tabs)/scripts', cta: 'Open Saved',
  },
  {
    key: 'tools', eyebrow: 'TAB · TOOLS', title: 'Six tools, all tuned to you.',
    body: 'Shop Safe, Teleprompter, Video breakdown, Rehearsal coach, Objection killer and Sample pitch. Each one reads your profile before it works.',
    bullets: ['Shop Safe catches the lines that get videos flagged', 'Coach grades delivery against your own baseline', 'Tap ⓘ on any tool for how it works'],
    Icon: TileTools, colors: [D.limeDeep, '#4CC22A'], route: '/(tabs)/tools', cta: 'See the tools',
  },
  {
    key: 'film', eyebrow: 'THE LOOP · FILM → POST → RESULTS', title: 'Film it here. Post it there. See what happened.',
    body: 'The teleprompter scrolls at the speed you actually talk. Save the take, edit it in TikTok, post, and Formula matches the video back to the script.',
    bullets: ['Framing guides keep you in the same spot every take', 'Save to Photos and to Formula, linked to the script', 'Views and GMV land on the script card'],
    Icon: Clapperboard, colors: ['#6C5CE7', '#8E7BFF'], route: '/teleprompter', cta: 'Try the teleprompter',
  },
  {
    key: 'share', eyebrow: 'FROM TIKTOK · SHARE SHEET', title: 'See a video you love? Share it to Formula.',
    body: 'On any TikTok: Share → More → Formula Share. Rewrite it for a product, break down why it works, recreate it on your topic, or run Shop Safe on it.',
    bullets: ['First time: tap More, then Edit, and pin Formula Share to Favorites', 'After that it sits at the front of your share sheet', 'Works from TikTok, Reels and Shorts'],
    Icon: Share2, colors: [D.ink, D.coral],
  },
];

function Bullet({ text, delay }: { text: string; delay: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 320, delay, easing: Ease.out, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[S.bullet, { opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      <View style={S.bulletDot}><Check size={11} color={D.coral} strokeWidth={3} /></View>
      <Text style={S.bulletText}>{text}</Text>
    </Animated.View>
  );
}

function PageView({ page, width, active, onTry }: { page: Page; width: number; active: boolean; onTry: () => void }) {
  const pop = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (!active) return;
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: true }).start();
  }, [active]);
  const Icon = page.Icon;
  return (
    <View style={[S.page, { width }]}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <LinearGradient colors={page.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[S.tile, page.key === 'scripting' && S.tileFab]}>
          {page.key === 'scripting'
            ? <LinearGradient colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            : <View style={S.tileGlow} />}
          <Icon size={44} color="#FFF" strokeWidth={2} />
          {page.key === 'scripting' && <Text style={S.tileFabLabel}>Scripting</Text>}
        </LinearGradient>
      </Animated.View>
      <Text style={S.eyebrow}>{page.eyebrow}</Text>
      <Text style={S.title}>{page.title}</Text>
      <Text style={S.body}>{page.body}</Text>
      <View style={S.bullets}>
        {active && page.bullets.map((b, i) => <Bullet key={b} text={b} delay={140 + i * 70} />)}
      </View>
      {page.route && (
        <AnimatedPressable style={S.tryBtn} haptic="light" onPress={onTry}>
          <Text style={S.tryText}>{page.cta ?? 'Try it'}</Text>
          <ArrowRight size={15} color={D.coral} strokeWidth={2.5} />
        </AnimatedPressable>
      )}
    </View>
  );
}

export default function TourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const listRef = useRef<FlatList<Page>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const last = index === PAGES.length - 1;

  const markSeen = () => { void storage.setItem(TOUR_SEEN_KEY, '1'); };

  const finish = () => { markSeen(); haptic.success(); if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); };
  const goTo = (i: number) => { const n = Math.max(0, Math.min(PAGES.length - 1, i)); listRef.current?.scrollToOffset({ offset: n * width, animated: true }); };
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) { setIndex(i); haptic.select(); }
  };
  const tryPage = (p: Page) => {
    if (!p.route) return finish();
    markSeen();
    haptic.press();
    // Leave the tour behind so the tab lands cleanly, then open the screen.
    if (router.canGoBack()) router.back();
    setTimeout(() => router.push(p.route as any), 60);
  };

  return (
    <View style={[S.root, { paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={S.top}>
        <View style={S.dots}>
          {PAGES.map((p, i) => {
            const w = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [7, 22, 7], extrapolate: 'clamp' });
            const o = scrollX.interpolate({ inputRange: [(i - 1) * width, i * width, (i + 1) * width], outputRange: [0.28, 1, 0.28], extrapolate: 'clamp' });
            return <Animated.View key={p.key} style={[S.dot, { width: w, opacity: o }]} />;
          })}
        </View>
        <TouchableOpacity onPress={finish} hitSlop={12} style={S.skip}><Text style={S.skipText}>{last ? 'Done' : 'Skip'}</Text></TouchableOpacity>
      </View>

      <Animated.FlatList
        ref={listRef as any}
        data={PAGES}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => <PageView page={item} width={width} active={i === index} onTry={() => tryPage(item)} />}
      />

      <View style={S.nav}>
        <AnimatedPressable style={[S.navBtn, index === 0 && { opacity: 0 }]} haptic="light" disabled={index === 0} onPress={() => goTo(index - 1)}>
          <ArrowLeft size={18} color={D.textPrimary} strokeWidth={2.2} />
        </AnimatedPressable>
        <Text style={S.count}>{index + 1} of {PAGES.length}</Text>
        <AnimatedPressable style={[S.navBtn, S.navBtnPrimary]} haptic={last ? 'success' : 'light'} onPress={() => (last ? finish() : goTo(index + 1))}>
          {last ? <Check size={18} color="#FFF" strokeWidth={2.6} /> : <ArrowRight size={18} color="#FFF" strokeWidth={2.4} />}
        </AnimatedPressable>
      </View>
      {from === 'first' && <Text style={S.foot}>You can replay this any time from Settings.</Text>}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 44 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { height: 7, borderRadius: 4, backgroundColor: D.coral },
  skip: { paddingVertical: 6, paddingHorizontal: 4 },
  skipText: { ...T.bold, fontSize: 14, color: D.textMuted },

  page: { paddingHorizontal: 24, paddingTop: 18 },
  tile: { width: 96, height: 96, borderRadius: 30, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...Shadow.card },
  tileFab: { backgroundColor: D.coral, ...Shadow.coral },
  tileFabLabel: { ...T.bold, fontSize: 12, color: '#FFF', letterSpacing: 0.2, marginTop: -2 },
  tileGlow: { position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.18)' },
  eyebrow: { ...T.bold, fontSize: 11, color: D.coral, letterSpacing: 1.1, marginTop: 24 },
  title: { ...T.bold, fontSize: 28, color: D.textPrimary, letterSpacing: -0.8, lineHeight: 33, marginTop: 8 },
  body: { ...T.regular, fontSize: 15.5, color: D.textSecondary, lineHeight: 23, marginTop: 12 },
  bullets: { marginTop: 18, gap: 10, minHeight: 96 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  bulletText: { ...T.medium, fontSize: 14.5, color: D.textPrimary, lineHeight: 21, flex: 1 },
  tryBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 11, marginTop: 20 },
  tryText: { ...T.bold, fontSize: 14, color: D.coral },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  navBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  navBtnPrimary: { backgroundColor: D.coral, borderColor: D.coral, ...Shadow.coral },
  count: { ...T.medium, fontSize: 13, color: D.textMuted },
  foot: { ...T.regular, fontSize: 12, color: D.textDisabled, textAlign: 'center', marginTop: 10 },
});

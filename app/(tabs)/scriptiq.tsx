import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Keyboard,
  TouchableWithoutFeedback, LayoutAnimation, Platform, UIManager, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { fromSaved, productParam } from '@/lib/product-handoff';
import type { ProductSearchResult, SavedProductItem } from '@/types/api';
import AnimatedPressable from '@/components/AnimatedPressable';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import { D, T, R, Shadow, Ease } from '@/constants/ds';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Link, ArrowRight, ShoppingBag, Sparkles, Check, X, Film, PenLine, Zap, Mic, Lightbulb, Search } from 'lucide-react-native';
import { Image } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// One front door for every script. Two answers decide the path:
//
//                      selling a product          just content
//   have a video   →   /rewrite (Viral Rewrite)   /viraltopic (Topic Recreator)
//   no video       →   /productscript             /organicscript
//
// The destination screens keep their own generators; this page only collects
// the link + intent (+ topic) and hands it over prefilled.

type Purpose = 'product' | 'content';
type Source = 'link' | 'scratch';

const isTikTokish = (s: string) => /^(https?:\/\/)?([a-z0-9-]+\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)\//i.test(s.trim()) || /^https?:\/\//i.test(s.trim());

function animate() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
}

// ─── Hero glow + "how it works" diagram ───────────────────────────────────────

// Soft coral radial behind the top of the page — this is the FAB's home, so it
// carries the brand colour without going solid red.
function TopGlow() {
  return (
    <Svg style={S.glow} width="100%" height={420} pointerEvents="none">
      <Defs>
        <RadialGradient id="iqGlow" cx="50%" cy="28%" rx="70%" ry="46%" fx="50%" fy="28%">
          <Stop offset="0%" stopColor={D.coral} stopOpacity={0.22} />
          <Stop offset="60%" stopColor={D.coral} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={D.coral} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="420" fill="url(#iqGlow)" />
    </Svg>
  );
}

// ─── Step shell ───────────────────────────────────────────────────────────────

function Step({ n, title, sub, done, children }: { n: number; title: string; sub?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <View style={S.step}>
      <View style={S.stepHead}>
        <View style={[S.stepNum, done && S.stepNumDone]}>
          {done ? <Check size={12} color="#FFF" strokeWidth={3} /> : <Text style={S.stepNumText}>{n}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={S.stepTitle}>{title}</Text>
          {sub ? <Text style={S.stepSub}>{sub}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function Choice({ icon, title, sub, selected, onPress }: { icon: React.ReactNode; title: string; sub: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable style={[S.choice, selected && S.choiceOn]} onPress={onPress} haptic="light">
      <View style={[S.choiceIcon, selected && S.choiceIconOn]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[S.choiceTitle, selected && S.choiceTitleOn]}>{title}</Text>
        <Text style={S.choiceSub}>{sub}</Text>
      </View>
      <View style={[S.radio, selected && S.radioOn]}>{selected && <View style={S.radioDot} />}</View>
    </AnimatedPressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScriptIQScreen() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [purpose, setPurpose] = useState<Purpose | null>(null);
  const [topic, setTopic] = useState('');
  const [picked, setPicked] = useState<ProductSearchResult | null>(null);

  // Saved products from the Products tab — offered inline on the product path
  // so the shelf and the pen are one flow.
  const { data: savedRaw } = useQuery({
    queryKey: ['saved-products-lite'],
    queryFn: async () => {
      const res = await api.get('/creators/saved-products');
      return extractData<{ products?: SavedProductItem[] }>(res)?.products ?? [];
    },
    staleTime: 60_000,
  });
  const saved = (savedRaw ?? []).map(fromSaved);

  // Typing / pasting a link answers step 1 by itself.
  useEffect(() => {
    if (url.trim() && isTikTokish(url) && source !== 'link') { animate(); setSource('link'); }
    if (!url.trim() && source === 'link') { animate(); setSource(null); }
  }, [url]);

  const pickScratch = () => { Keyboard.dismiss(); animate(); setUrl(''); setSource('scratch'); };
  const pickPurpose = (p: Purpose) => { Keyboard.dismiss(); animate(); setPurpose(p); if (p !== 'product') setPicked(null); };

  const step1Done = source != null;
  const step2Done = purpose != null;
  const needsTopic = purpose === 'content';
  const ready = step1Done && step2Done && (!needsTopic || topic.trim().length > 0);

  // Where this combination goes, and how we describe it on the button.
  const dest = (() => {
    if (!step1Done || !step2Done) return null;
    const prod = picked ? { product: productParam(picked) } : {};
    const short = picked ? (picked.title.length > 22 ? picked.title.slice(0, 22).trim() + '…' : picked.title) : null;
    if (source === 'link' && purpose === 'product') return { path: '/(tabs)/rewrite' as const, label: short ? `Rewrite for ${short}` : 'Rewrite this video for a product', params: { prefillUrl: url.trim(), ...prod } };
    if (source === 'link' && purpose === 'content') return { path: '/(tabs)/viraltopic' as const, label: 'Recreate this video on my topic', params: { prefillUrl: url.trim(), topic: topic.trim() } };
    if (source === 'scratch' && purpose === 'product') return { path: '/(tabs)/productscript' as const, label: short ? `Write for ${short}` : 'Pick a product & write', params: prod };
    return { path: '/(tabs)/organicscript' as const, label: 'Write my script', params: { topic: topic.trim() } };
  })();

  const go = () => {
    if (!dest || !ready) return;
    Keyboard.dismiss();
    router.push({ pathname: dest.path, params: dest.params });
  };

  // CTA slides in once everything's answered.
  const cta = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(cta, { toValue: ready ? 1 : 0, duration: 260, easing: Ease.out, useNativeDriver: true }).start();
  }, [ready]);

  return (
    <TabFadeView>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={S.root}>
      <TopGlow />
      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <FadeInView delay={40}>
          <Text style={S.heroTitle}>Scripts that{'\n'}sound like <Text style={S.heroItalic}>you.</Text></Text>
          <Text style={S.heroSub}>Two questions. Three scripts. Written the way you talk.</Text>
          <View style={S.chips}>
            <View style={S.chip}><Zap size={13} color={D.coral} strokeWidth={2.5} /><Text style={S.chipText}>3 scripts</Text></View>
            <View style={S.chip}><Mic size={13} color={D.coral} strokeWidth={2.5} /><Text style={S.chipText}>Your voice</Text></View>
            <View style={S.chip}><Lightbulb size={13} color={D.coral} strokeWidth={2.5} /><Text style={S.chipText}>Why it works</Text></View>
          </View>
        </FadeInView>

        {/* ── 1. Source ─────────────────────────────────────────────── */}
        <FadeInView delay={90}>
          <Step n={1} title="Got a video to work from?" sub="Paste a TikTok, Reel or Short — or start fresh." done={step1Done}>
            <View style={[S.urlRow, source === 'link' && S.urlRowOn, source === 'scratch' && S.urlRowOff]}>
              <Link size={18} color={source === 'link' ? D.coral : D.textDisabled} strokeWidth={2} />
              <TextInput
                style={S.urlInput}
                value={url}
                onChangeText={(t) => { setUrl(t); if (isTikTokish(t)) Keyboard.dismiss(); }}
                placeholder="Paste a video link…"
                placeholderTextColor={D.textDisabled}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                editable={source !== 'scratch'}
              />
              {url.length > 0 && (
                <AnimatedPressable onPress={() => setUrl('')} haptic="light" hitSlop={8}>
                  <X size={16} color={D.textMuted} strokeWidth={2.2} />
                </AnimatedPressable>
              )}
            </View>
            <View style={S.orRow}><View style={S.orLine} /><Text style={S.orText}>or</Text><View style={S.orLine} /></View>
            <Choice
              icon={<PenLine size={18} color={source === 'scratch' ? '#FFF' : D.textMuted} strokeWidth={2} />}
              title="Start from scratch"
              sub="No video — build it from an idea or a product."
              selected={source === 'scratch'}
              onPress={source === 'scratch' ? () => { animate(); setSource(null); } : pickScratch}
            />
          </Step>
        </FadeInView>

        {/* ── 2. Purpose ────────────────────────────────────────────── */}
        {step1Done && (
          <Step n={2} title="What's it for?" done={step2Done}>
            <Choice
              icon={<ShoppingBag size={18} color={purpose === 'product' ? '#FFF' : D.textMuted} strokeWidth={2} />}
              title="Selling a product"
              sub={source === 'link' ? 'Rewrite this video around a TikTok Shop product.' : 'Pick a TikTok Shop product and write to convert.'}
              selected={purpose === 'product'}
              onPress={() => pickPurpose('product')}
            />
            <Choice
              icon={<Sparkles size={18} color={purpose === 'content' ? '#FFF' : D.textMuted} strokeWidth={2} />}
              title="Just content"
              sub={source === 'link' ? 'Keep what made it work, make it about your thing.' : 'Organic TikToks & Reels, brand deals — no product needed.'}
              selected={purpose === 'content'}
              onPress={() => pickPurpose('content')}
            />
          </Step>
        )}

        {/* ── 3. Product (product path) — saved shelf first ─────────── */}
        {step1Done && purpose === 'product' && (
          <Step n={3} title="Which product?" sub={saved.length > 0 ? 'From your saved products, or search on the next screen.' : 'You\'ll pick one on the next screen.'} done={!!picked}>
            {saved.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }} style={{ marginHorizontal: -4 }}>
                {saved.slice(0, 12).map((p) => {
                  const on = picked?.external_id === p.external_id;
                  return (
                    <AnimatedPressable key={p.external_id} style={[S.prod, on && S.prodOn]} haptic="light" onPress={() => { animate(); setPicked(on ? null : p); }}>
                      {p.cover_url ? <Image source={{ uri: p.cover_url }} style={S.prodImg} /> : <View style={[S.prodImg, S.prodImgPh]}><ShoppingBag size={16} color={D.textDisabled} strokeWidth={1.8} /></View>}
                      <Text style={[S.prodTitle, on && S.prodTitleOn]} numberOfLines={2}>{p.title}</Text>
                      {on && <View style={S.prodCheck}><Check size={11} color="#FFF" strokeWidth={3} /></View>}
                    </AnimatedPressable>
                  );
                })}
              </ScrollView>
            )}
            <View style={[S.searchHint, saved.length > 0 && { marginTop: 12 }]}>
              <Search size={14} color={D.textMuted} strokeWidth={2.2} />
              <Text style={S.searchHintText}>{picked ? 'Or leave it unselected to search instead.' : 'No pick needed — you can search TikTok Shop next.'}</Text>
            </View>
          </Step>
        )}

        {/* ── 3. Topic (content path only) ──────────────────────────── */}
        {step1Done && needsTopic && (
          <Step n={3} title="What's it about?" sub="One line is plenty." done={topic.trim().length > 0}>
            <View style={S.topicBox}>
              <TextInput
                style={S.topicInput}
                value={topic}
                onChangeText={setTopic}
                placeholder="e.g. my morning routine as a night-shift nurse, why I quit coffee…"
                placeholderTextColor={D.textDisabled}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={go}
              />
            </View>
          </Step>
        )}

        {/* ── Go ────────────────────────────────────────────────────── */}
        {dest && (
          <Animated.View style={{ opacity: cta, transform: [{ translateY: cta.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
            <AnimatedPressable style={[S.cta, !ready && S.ctaOff]} onPress={go} haptic="medium" disabled={!ready}>
              <Text style={S.ctaText}>{dest.label}</Text>
              <View style={S.ctaArrow}><ArrowRight size={16} color="#FFF" strokeWidth={2.5} /></View>
            </AnimatedPressable>
            <Text style={S.ctaHint}>
              {source === 'link' ? <><Film size={11} color={D.textMuted} strokeWidth={2} />  We'll watch the video first, then write in your voice.</> : 'Written in your voice, from your profile.'}
            </Text>
          </Animated.View>
        )}

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
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },

  glow: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroTitle: { ...T.bold, fontSize: 34, color: D.textPrimary, letterSpacing: -1.1, lineHeight: 38, marginHorizontal: 4, marginTop: 6 },
  heroItalic: { color: D.coral },
  heroSub: { ...T.regular, fontSize: 15, color: D.textMuted, marginTop: 8, marginHorizontal: 4, lineHeight: 21 },

  chips: { flexDirection: 'row', gap: 8, marginTop: 16, marginHorizontal: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { ...T.bold, fontSize: 12.5, color: D.textPrimary, letterSpacing: -0.1 },

  step: {
    backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border,
    padding: 20, marginTop: 14,
  },
  stepHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: D.inkHairline,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumDone: { backgroundColor: D.limeDeep },
  stepNumText: { ...T.bold, fontSize: 12, color: D.textMuted },
  stepTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.4, lineHeight: 23 },
  stepSub: { ...T.regular, fontSize: 13.5, color: D.textMuted, marginTop: 3, lineHeight: 18 },

  urlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1.5, borderColor: D.border,
    paddingHorizontal: 16, height: 54,
  },
  urlRowOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  urlRowOff: { opacity: 0.45 },
  urlInput: { ...T.medium, flex: 1, fontSize: 15, color: D.textPrimary },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: D.divider },
  orText: { ...T.medium, fontSize: 12, color: D.textDisabled, textTransform: 'uppercase', letterSpacing: 0.6 },

  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.surface, borderRadius: 16, borderWidth: 1.5, borderColor: D.border,
    padding: 14, marginTop: 8,
  },
  choiceOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  choiceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: D.inkHairline, alignItems: 'center', justifyContent: 'center' },
  choiceIconOn: { backgroundColor: D.coral },
  choiceTitle: { ...T.bold, fontSize: 15.5, color: D.textPrimary, letterSpacing: -0.2 },
  choiceTitleOn: { color: D.coral },
  choiceSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 2, lineHeight: 18 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: D.coral },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: D.coral },

  prod: { width: 118, backgroundColor: D.surface, borderRadius: 16, borderWidth: 1.5, borderColor: D.border, padding: 8, paddingBottom: 10 },
  prodOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  prodImg: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: D.inkHairline },
  prodImgPh: { alignItems: 'center', justifyContent: 'center' },
  prodTitle: { ...T.medium, fontSize: 12, color: D.textPrimary, lineHeight: 16, marginTop: 8 },
  prodTitleOn: { ...T.bold, color: D.coral },
  prodCheck: { position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center' },
  searchHint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchHintText: { ...T.regular, fontSize: 13, color: D.textMuted, flex: 1, lineHeight: 18 },

  topicBox: { backgroundColor: D.surface, borderRadius: 16, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 14, paddingVertical: 12, minHeight: 88 },
  topicInput: { ...T.medium, fontSize: 15, color: D.textPrimary, lineHeight: 21, textAlignVertical: 'top' },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 17, marginTop: 22, ...Shadow.coral,
  },
  ctaOff: { opacity: 0.45 },
  ctaText: { ...T.bold, fontSize: 16.5, color: '#FFF', letterSpacing: -0.3 },
  ctaArrow: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ctaHint: { ...T.regular, fontSize: 12.5, color: D.textMuted, textAlign: 'center', marginTop: 12, lineHeight: 17 },
});

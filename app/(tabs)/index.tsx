import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Image, Animated, Alert, LayoutAnimation, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { api, extractData } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { CREDIT_COSTS } from '@/lib/iap/catalog';
import { buildInsights, archetype, playbook, explainHook, distList, type Insight, type InsightKey, type Play } from '@/lib/profile-insights';
import { RunData, AnalyzeResponse, CreatorMeData, CreatorProfile, SpeechTemplate, PacingTemplate, ProductInsights, VideoStyleProfile, ShopDashboard, ResultsResponse } from '@/types/api';
import { D, T, R, Shadow, Ease, Gradient, SectionLabelStyle } from '@/constants/ds';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Skeleton } from '@/components/Skeleton';
import {
  Brain, Mic, Film, Activity,
  CheckCircle, RefreshCw, AlertCircle,
  Clapperboard, ShoppingBag, Copy, Check, Zap, Store, ArrowRight, ChevronDown,
  Clock, Scissors, Heart, Camera, Share2, Lightbulb, TrendingUp, AlertTriangle,
} from 'lucide-react-native';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtGmv(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function fmtSec(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 60) return `${(n / 60).toFixed(1)}m`;
  return `${Math.round(n)}s`;
}
function shotTag(scene: string, idx: number, total: number): string {
  if (idx === 0) return 'Hook';
  if (idx === total - 1) return 'CTA';
  if (scene.includes('demo') || scene.includes('product')) return 'Proof';
  return 'Build';
}

function sanitizePhase(text: string): string {
  return text.replace(/fast\s*moss/gi, 'InfluenceishIQ');
}

// ─── Section SVG icons ────────────────────────────────────────────────────────

function SummaryIcon({ color = '#FFF' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={3}  y={15} width={5} height={6} rx={2.5} fill={color} />
      <Rect x={10} y={10} width={5} height={11} rx={2.5} fill={color} />
      <Rect x={17} y={4}  width={5} height={17} rx={2.5} fill={D.lime} />
    </Svg>
  );
}

function SpeechIcon({ color = '#FFF' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={2}  y={9}   width={3.2} height={6}  rx={1.6} fill={color} />
      <Rect x={7}  y={6}   width={3.2} height={12} rx={1.6} fill={color} />
      <Rect x={12} y={3}   width={3.2} height={18} rx={1.6} fill={D.lime} />
      <Rect x={17} y={7.5} width={3.2} height={9}  rx={1.6} fill={color} />
    </Svg>
  );
}

function PacingIcon({ color = '#FFF' }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x={3}  y={5} width={3} height={14} rx={1.5} fill={color} />
      <Rect x={8}  y={5} width={3} height={14} rx={1.5} fill={D.lime} />
      <Rect x={13} y={5} width={3} height={14} rx={1.5} fill={color} />
      <Rect x={18} y={5} width={3} height={14} rx={1.5} fill={color} />
    </Svg>
  );
}

function VerifiedSeal() {
  return (
    <View style={{
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Check size={11} color="#FFF" strokeWidth={3} />
    </View>
  );
}

// ─── Card Head ────────────────────────────────────────────────────────────────

function CardHead({
  icon, title, sub,
}: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <View style={chS.wrap}>
      <LinearGradient
        colors={Gradient.heroCompact}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={chS.iconBox}
      >
        {icon}
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={chS.title}>{title}</Text>
        <Text style={chS.sub}>{sub}</Text>
      </View>
    </View>
  );
}
const chS = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: D.divider },
  iconBox: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3 },
  sub: { ...T.medium, fontSize: 12, color: D.textMuted, marginTop: 2 },
});

// ─── Gradient meter bar ───────────────────────────────────────────────────────

function GradientMeter({
  label, value, fromColor, toColor, textColor,
}: { label: string; value: number; fromColor: string; toColor: string; textColor: string }) {
  const pct = Math.min(100, value);
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 650, easing: Ease.out, useNativeDriver: false }).start();
  }, [pct]);

  const barWidth = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={gmS.wrap}>
      <View style={gmS.top}>
        <Text style={gmS.label}>{label}</Text>
        <View style={[gmS.badge, { backgroundColor: textColor + '18', borderColor: textColor + '30' }]}>
          <Text style={[gmS.val, { color: textColor }]}>{value}<Text style={gmS.unit}>/100</Text></Text>
        </View>
      </View>
      <View style={gmS.track}>
        <Animated.View style={[gmS.fill, { width: barWidth as any }]}>
          <LinearGradient
            colors={[fromColor, toColor]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}
const gmS = StyleSheet.create({
  wrap: { marginBottom: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { ...T.medium, fontSize: 14, color: D.textPrimary },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.full, borderWidth: 1 },
  val: { ...T.bold, fontSize: 13, letterSpacing: -0.3 },
  unit: { ...T.regular, fontSize: 11, color: D.textMuted },
  track: { height: 8, borderRadius: 999, backgroundColor: D.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});

// ─── Spec row (key | value, divider on top) ───────────────────────────────────

function SpecRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // Heuristic: long values get truncated to 2 lines, so make them tappable.
  const canExpand = value.length > 38;

  return (
    <TouchableOpacity
      style={[srS.row, !first && srS.rowBordered]}
      activeOpacity={canExpand ? 0.6 : 1}
      onPress={() => canExpand && setExpanded((e) => !e)}
    >
      <Text style={srS.key}>{label}</Text>
      <View style={srS.valWrap}>
        <Text style={srS.val} numberOfLines={expanded ? undefined : 2}>{value}</Text>
        {canExpand && (
          <Text style={srS.more}>{expanded ? 'Show less' : 'Show more'}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
const srS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBordered: { borderTopWidth: 1, borderTopColor: D.divider },
  key: { ...T.medium, fontSize: 13, color: D.textMuted, width: 110, flexShrink: 0 },
  valWrap: { flex: 1, gap: 3 },
  val: { ...T.bold, fontSize: 13, color: D.textPrimary, textAlign: 'right', lineHeight: 18 },
  more: { ...T.medium, fontSize: 11, color: D.coral, textAlign: 'right' },
});

// ─── Pacing tile ──────────────────────────────────────────────────────────────

function PacingTile({ icon, bgColor, value, label }: {
  icon: React.ReactNode; bgColor: string; value: string; label: string;
}) {
  return (
    <View style={ptS.tile}>
      <View style={[ptS.iconBox, { backgroundColor: bgColor }]}>{icon}</View>
      <Text style={ptS.value}>{value}</Text>
      <Text style={ptS.label}>{label}</Text>
    </View>
  );
}
const ptS = StyleSheet.create({
  tile: {
    flex: 1, backgroundColor: D.card, borderRadius: 18,
    borderWidth: 1, borderColor: D.cardBorder,
    paddingVertical: 16, paddingHorizontal: 6, alignItems: 'center',
    ...Shadow.soft,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  value: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.6 },
  // Reserve two lines so single- and double-line labels align across all tiles.
  label: { ...T.medium, fontSize: 11, color: D.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 15, minHeight: 30 },
});

// ─── Shot sequence ────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  Hook: D.coral,
  Build: D.cyan,
  Proof: D.limeDeep,
  CTA: D.warning,
};

function ShotSequence({ scenes }: { scenes: string[] }) {
  const tags = scenes.map((s, i) => shotTag(s, i, scenes.length));
  const usedTags = [...new Set(tags)];

  return (
    <View>
      {/* Timeline bar */}
      <View style={shtS.bar}>
        {scenes.map((_, i) => {
          const color = TAG_COLORS[tags[i]] ?? D.coral;
          return (
            <View key={i} style={[shtS.segment, { backgroundColor: color }]}>
              <Text style={shtS.segNum}>{i + 1}</Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={shtS.legend}>
        {usedTags.map((tag) => (
          <View key={tag} style={shtS.legendItem}>
            <View style={[shtS.legendDot, { backgroundColor: TAG_COLORS[tag] ?? D.coral }]} />
            <Text style={shtS.legendLabel}>{tag}</Text>
          </View>
        ))}
      </View>

      {/* Shot cards */}
      <View style={shtS.cards}>
        {scenes.map((scene, i) => {
          const tag = tags[i];
          const color = TAG_COLORS[tag] ?? D.coral;
          return (
            <View key={i} style={[shtS.card, { borderLeftColor: color }]}>
              <View style={[shtS.num, { backgroundColor: color + '20' }]}>
                <Text style={[shtS.numText, { color }]}>{i + 1}</Text>
              </View>
              <Text style={shtS.scene} numberOfLines={1}>
                {scene.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Text>
              <View style={[shtS.tagPill, { backgroundColor: color + '18', borderColor: color + '35' }]}>
                <Text style={[shtS.tagText, { color }]}>{tag}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const shtS = StyleSheet.create({
  bar: { flexDirection: 'row', height: 36, borderRadius: 10, overflow: 'hidden', gap: 2, marginBottom: 10 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segNum: { ...T.bold, fontSize: 13, color: '#FFF' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { ...T.medium, fontSize: 12, color: D.textMuted },

  cards: { gap: 6 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, paddingHorizontal: 12,
    backgroundColor: D.surface, borderRadius: 12,
    borderWidth: 1, borderColor: D.border, borderLeftWidth: 4,
  },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numText: { ...T.bold, fontSize: 12 },
  scene: { flex: 1, ...T.medium, fontSize: 14, color: D.textPrimary },
  tagPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: R.full, borderWidth: 1, flexShrink: 0 },
  tagText: { ...T.bold, fontSize: 11, letterSpacing: 0.4 },
});

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <FadeInView delay={delay} style={S.card}>
      {children}
    </FadeInView>
  );
}

// ─── Explainer text ───────────────────────────────────────────────────────────

function Explainer({ text, spaced }: { text: string; spaced?: boolean }) {
  return (
    <View style={[exS.wrap, spaced && { marginBottom: 16 }]}>
      <Text style={exS.zap}>⚡</Text>
      <Text style={exS.text}>{text}</Text>
    </View>
  );
}
const exS = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: D.surface, borderRadius: 12,
    borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  zap: { fontSize: 12, lineHeight: 19 },
  text: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 19, flex: 1 },
});

// ─── Chip components ──────────────────────────────────────────────────────────

function Chip({ label, color = D.coral }: { label: string; color?: string }) {
  const display = label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <View style={[chipS.wrap, { backgroundColor: color + '14', borderColor: color + '28' }]}>
      <Text style={[chipS.text, { color }]}>{display}</Text>
    </View>
  );
}
const chipS = StyleSheet.create({
  wrap: { borderRadius: R.full, paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1, maxWidth: 200 },
  text: { ...T.bold, fontSize: 13 },
});

function InkChip({ label }: { label: string }) {
  return (
    <View style={inkChipS.wrap}>
      <Text style={inkChipS.text}>{label.replace(/_/g, ' ')}</Text>
    </View>
  );
}
const inkChipS = StyleSheet.create({
  wrap: {
    borderRadius: R.full, paddingHorizontal: 13, paddingVertical: 7,
    backgroundColor: D.ink, borderWidth: 1, borderColor: D.inkLine,
  },
  text: { ...T.bold, fontSize: 13, color: '#FFFFFF' },
});

// ─── Copy block ───────────────────────────────────────────────────────────────

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const Clipboard = require('expo-clipboard');
    void Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={copyS.wrap}>
      <Text style={copyS.text}>{text}</Text>
      <TouchableOpacity style={copyS.btn} onPress={copy} activeOpacity={0.75}>
        {copied
          ? <><Check size={14} color={D.ink} strokeWidth={2.5} /><Text style={copyS.btnText}>Copied</Text></>
          : <><Copy size={14} color={D.ink} strokeWidth={2} /><Text style={copyS.btnText}>Copy prompt</Text></>
        }
      </TouchableOpacity>
    </View>
  );
}
const copyS = StyleSheet.create({
  wrap: { backgroundColor: D.ink, borderRadius: R.xl, padding: 19, marginTop: 11 },
  text: { ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.82)', lineHeight: 23 },
  btn: {
    marginTop: 15, flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', backgroundColor: D.lime,
    paddingHorizontal: 17, paddingVertical: 11, borderRadius: R.full,
  },
  btnText: { ...T.bold, fontSize: 13, color: D.ink },
});

// ─── Hero stat ────────────────────────────────────────────────────────────────

function HeroStat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={heroStatS.box}>
      <Text style={[heroStatS.num, accent && { color: D.lime }]}>{value}</Text>
      <Text style={heroStatS.label}>{label}</Text>
    </View>
  );
}
const heroStatS = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', gap: 3 },
  num: { ...T.bold, fontSize: 21, color: '#FFFFFF', letterSpacing: -0.4 },
  label: { ...T.medium, fontSize: 11, color: 'rgba(255,255,255,0.74)', marginTop: 6 },
});

// ─── Analyze states ───────────────────────────────────────────────────────────

function PulsingRing() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 850, easing: Ease.inOut, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 850, easing: Ease.inOut, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={[runS.ringOuter, { transform: [{ scale }] }]}>
      <View style={runS.ringInner}>
        <ActivityIndicator color={D.coral} size="large" />
      </View>
    </Animated.View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: value, duration: 600, easing: Ease.out, useNativeDriver: false }).start();
  }, [value]);
  const barWidth = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={runS.track}>
      <Animated.View style={[runS.fill, { width: barWidth as any }]} />
    </View>
  );
}
const runS = StyleSheet.create({
  ringOuter: { width: 88, height: 88, borderRadius: 44, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: D.card, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, backgroundColor: D.surface, borderRadius: 3, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: D.coral },
});

// ─── Section renderers ────────────────────────────────────────────────────────

function SpeechSection({ t, delay }: { t: SpeechTemplate; delay: number }) {
  const paceBandColor = t.pace_band === 'rapid' ? D.coral
    : t.pace_band === 'fast' ? D.warning
    : t.pace_band === 'conversational' ? D.limeDeep
    : D.cyan;

  return (
    <SectionCard delay={delay}>
      <CardHead icon={<SpeechIcon color="#FFF" />} title="Speech Template" sub="How you talk to camera" />
      <Explainer spaced text="This is a model of how you actually speak — your rhythm, your tone, the way you open a sentence. Every script is written to match it so when you read it out loud, it already sounds like you." />

      {/* Pace hero */}
      {t.pace_band && (
        <View style={speechS.paceRow}>
          <View style={[speechS.pacePill, { backgroundColor: paceBandColor + '14', borderColor: paceBandColor + '30' }]}>
            <View style={[speechS.paceDot, { backgroundColor: paceBandColor }]} />
            <Text style={[speechS.pacePillText, { color: paceBandColor }]}>{t.pace_band} pace</Text>
          </View>
          {t.avg_wpm != null && (
            <View style={speechS.wpmWrap}>
              <Text style={speechS.wpmNum}>{t.avg_wpm}</Text>
              <Text style={speechS.wpmUnit}>wpm</Text>
            </View>
          )}
        </View>
      )}

      {/* Spec rows */}
      <View>
        {t.tone && <SpecRow label="Tone" value={t.tone} first />}
        {t.opening_style && <SpecRow label="Opening" value={t.opening_style} first={!t.tone} />}
        {t.sentence_structure && <SpecRow label="Structure" value={t.sentence_structure} />}
        <SpecRow label="Sample size" value={`${t.sample_count} videos`} />
      </View>

      {/* Signature phrases */}
      {t.signature_phrases.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Signature phrases</Text>
          <View style={sigS.list}>
            {t.signature_phrases.map((p, i) => (
              <View key={i} style={sigS.chip}>
                <Text style={sigS.text}>“{p}”</Text>
              </View>
            ))}
          </View>
          <Explainer text="These are phrases you naturally say on camera. The AI weaves them into scripts so they sound like you said it yourself — not a template someone else filled in." />
        </View>
      )}

      {/* Filler words */}
      {t.filler_words.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Filler words</Text>
          <View style={S.chips}>
            {t.filler_words.map((w, i) => (
              <View key={i} style={ghostChipS.wrap}>
                <Text style={ghostChipS.text}>{w}</Text>
              </View>
            ))}
          </View>
          <Explainer text="These show up in your real speech. The AI knows about them so it doesn't over-script them — your ad sounds natural, not rehearsed." />
        </View>
      )}

      {/* Voice prompt */}
      {t.voice_prompt && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Voice prompt — drop into any AI</Text>
          <Explainer text="This is your complete voice model compressed into a prompt. Paste it at the top of any ChatGPT or Claude conversation and every piece of content you write will instantly sound like you — not a generic AI." />
          <CopyBlock text={t.voice_prompt} />
        </View>
      )}
    </SectionCard>
  );
}

const speechS = StyleSheet.create({
  paceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: D.border,
  },
  pacePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full, borderWidth: 1,
  },
  paceDot: { width: 7, height: 7, borderRadius: 4 },
  pacePillText: { ...T.bold, fontSize: 13, letterSpacing: -0.2 },
  wpmWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  wpmNum: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8 },
  wpmUnit: { ...T.medium, fontSize: 14, color: D.textMuted },
});

const ghostChipS = StyleSheet.create({
  wrap: {
    borderRadius: R.full, paddingHorizontal: 13, paddingVertical: 7,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
  },
  text: { ...T.medium, fontSize: 13, color: D.textMuted },
});

// Signature phrases — left-aligned quote tags (rounded rect, not full pills)
const sigS = StyleSheet.create({
  list: { alignItems: 'flex-start', gap: 8, alignSelf: 'stretch' },
  chip: {
    maxWidth: '100%',
    backgroundColor: D.coralSubtle,
    borderWidth: 1, borderColor: D.coral + '24',
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9,
  },
  text: { ...T.medium, fontSize: 13.5, color: D.coral, lineHeight: 19 },
});

function PacingSection({ t, delay }: { t: PacingTemplate; delay: number }) {
  const tiles = [
    t.avg_video_length_sec != null && {
      icon: <Film size={14} color="#FFF" strokeWidth={2} />,
      bgColor: D.inkCard, value: fmtSec(t.avg_video_length_sec), label: 'Avg length',
    },
    t.avg_hook_duration_sec != null && {
      icon: <Zap size={14} color="#FFF" strokeWidth={2} />,
      bgColor: D.coral, value: fmtSec(t.avg_hook_duration_sec), label: 'Hook window',
    },
    t.cuts_per_30s != null && {
      icon: <Clapperboard size={14} color="#FFF" strokeWidth={2} />,
      bgColor: D.inkCard, value: String(t.cuts_per_30s), label: 'Cuts / 30s',
    },
    t.avg_scene_count != null && {
      icon: <Activity size={14} color="#FFF" strokeWidth={2} />,
      bgColor: D.limeDeep, value: String(t.avg_scene_count), label: 'Scenes',
    },
  ].filter(Boolean) as { icon: React.ReactNode; bgColor: string; value: string; label: string }[];

  return (
    <SectionCard delay={delay}>
      <CardHead icon={<PacingIcon color="#FFF" />} title="Pacing Template" sub="How your edits move" />
      <Explainer spaced text="The AI uses your real edit rhythm when writing scripts — so the line breaks, scene transitions, and CTA timing land exactly where your natural cuts do. Scripts feel effortless to film because they're built around how you already shoot." />

      {/* Tiles */}
      {tiles.length > 0 && (
        <View style={S.tileRow}>
          {tiles.map((tile, i) => <PacingTile key={i} {...tile} />)}
        </View>
      )}

      {/* Spec rows */}
      <View style={{ marginTop: 8 }}>
        {t.avg_scene_duration_sec != null && (
          <SpecRow label="Scene duration" value={fmtSec(t.avg_scene_duration_sec)} first />
        )}
        {t.typical_cta_position && (
          <SpecRow label="CTA position" value={t.typical_cta_position} first={t.avg_scene_duration_sec == null} />
        )}
        <SpecRow label="Sample size" value={`${t.sample_count} videos`} />
      </View>

      {/* Shot sequence */}
      {t.scene_type_sequence.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Your Average Shot Sequence</Text>
          <Explainer text="This is the order your shots typically follow across your videos. Scripts are structured to match this flow — hook first, build in the middle, CTA where you always put it." />
          <ShotSequence scenes={t.scene_type_sequence} />
        </View>
      )}
    </SectionCard>
  );
}

function ProductInsightsSection({ p, delay }: { p: ProductInsights; delay: number }) {
  return (
    <SectionCard delay={delay}>
      <CardHead icon={<ShoppingBag size={18} color="#FFF" strokeWidth={2} />} title="Product Insights" sub="Your selling patterns" />
      <Explainer spaced text="The AI cross-references your content style with what actually converts for creators like you — so it recommends products that fit your voice, not just what's trending." />

      {p.summary && <Text style={S.summaryText}>{p.summary}</Text>}

      {p.recommended_categories.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Recommended categories</Text>
          <View style={S.chips}>
            {p.recommended_categories.map((c, i) => <Chip key={i} label={c} color={D.limeDeep} />)}
          </View>
          <Explainer text="These categories match your content style and audience. When you generate scripts in these niches, the AI knows exactly what angles to lean into." />
        </View>
      )}

      {p.best_categories.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Best categories by GMV</Text>
          {p.best_categories.map((cat, i) => (
            <View key={i} style={insightS.catRow}>
              <View style={insightS.catRank}><Text style={insightS.catRankText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={insightS.catName}>{cat.category}</Text>
                <Text style={insightS.catSub}>{cat.product_count} products</Text>
              </View>
              <Text style={insightS.catGmv}>{fmtGmv(cat.total_gmv)}</Text>
            </View>
          ))}
        </View>
      )}

      {p.top_products.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Top products</Text>
          {p.top_products.map((prod, i) => (
            <View key={i} style={insightS.prodRow}>
              <View style={[insightS.prodRank, i === 0 && insightS.prodRankTop]}>
                <Text style={[insightS.prodRankText, i === 0 && { color: D.coral }]}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={insightS.prodName}>{prod.name}</Text>
                {prod.category && <Text style={insightS.prodCat}>{prod.category}</Text>}
              </View>
              <Text style={insightS.prodGmv}>{fmtGmv(prod.gmv)}</Text>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
}
const insightS = StyleSheet.create({
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.border },
  catRank: { width: 26, height: 26, borderRadius: 13, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: D.border },
  catRankText: { ...T.bold, fontSize: 12, color: D.textMuted },
  catName: { ...T.medium, fontSize: 14, color: D.textPrimary },
  catSub: { ...T.regular, fontSize: 11, color: D.textMuted, marginTop: 2 },
  catGmv: { ...T.bold, fontSize: 15, color: D.limeDeep, letterSpacing: -0.3 },
  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.border },
  prodRank: { width: 26, height: 26, borderRadius: 13, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: D.border },
  prodRankTop: { backgroundColor: D.coralSubtle, borderColor: D.coral + '30' },
  prodRankText: { ...T.bold, fontSize: 12, color: D.textMuted },
  prodName: { ...T.medium, fontSize: 14, color: D.textPrimary },
  prodCat: { ...T.regular, fontSize: 11, color: D.textMuted, marginTop: 2 },
  prodGmv: { ...T.bold, fontSize: 14, color: D.limeDeep, letterSpacing: -0.3 },
});

// ─── Video Style Section ──────────────────────────────────────────────────────

function pct(n: number | null | undefined) {
  return n != null ? `${Math.round(n)}%` : '—';
}
function fmt(s: string | null | undefined) {
  if (!s) return '—';
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function DistBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pctVal = total > 0 ? Math.round((value / total) * 100) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pctVal, duration: 650, easing: Ease.out, useNativeDriver: false }).start();
  }, [pctVal]);
  const barWidth = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={vsS.distRow}>
      <View style={vsS.distLeft}>
        <Text style={vsS.distLabel} numberOfLines={1}>{fmt(label)}</Text>
        <View style={vsS.distTrack}>
          <Animated.View style={[vsS.distFill, { width: barWidth as any }]}>
            <LinearGradient
              colors={[color + 'CC', color]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
      <Text style={[vsS.distPct, { color }]}>{pctVal}%</Text>
    </View>
  );
}

// Normalize a distribution into [label, value][], recovering real names when
// the backend returns an indexed array (keys come through as "0","1","2"…).
// Numeric labels fall back to the dominant name for the top entry, then "Variant N".
function resolveDist(
  obj: Record<string, unknown> | null | undefined,
  dominant: string | null | undefined,
): [string, number][] {
  if (!obj) return [];
  const rows: [string, number][] = Object.entries(obj).map(([k, v]) => {
    if (typeof v === 'number') return [k, v];
    const o = v as any;
    const num = o?.percentage ?? o?.count ?? o?.value ?? o?.pct ?? 0;
    const name = o?.format ?? o?.style ?? o?.shot_style ?? o?.name ?? o?.label ?? o?.type ?? k;
    return [String(name), num as number];
  });
  const sorted = rows.sort((a, b) => b[1] - a[1]);
  return sorted.map(([label, num], i): [string, number] => {
    if (!/^\d+$/.test(label)) return [label, num];
    if (i === 0 && dominant) return [dominant, num];
    return [`Variant ${i + 1}`, num];
  });
}

function VideoStyleSection({ s, delay }: { s: VideoStyleProfile; delay: number }) {
  const presencePairs = [
    { label: 'On camera', val: pct(s.on_camera_pct) },
    { label: 'Voiceover', val: pct(s.voiceover_pct) },
    { label: 'Faceless', val: pct(s.faceless_pct) },
  ].filter((p) => p.val !== '—');

  const fmtDist = resolveDist(s.format_distribution, s.dominant_format);
  const fmtTotal = fmtDist.reduce((a, [, v]) => a + v, 0);
  const shotDist = resolveDist(s.shot_style_distribution, s.dominant_shot_style);
  const shotTotal = shotDist.reduce((a, [, v]) => a + v, 0);

  return (
    <SectionCard delay={delay}>
      <CardHead
        icon={<Clapperboard size={18} color="#FFF" strokeWidth={1.8} />}
        title="Video Style"
        sub="How your videos are made"
      />
      <Explainer spaced text="This tells the AI how to visually frame your scripts — whether you're a talking-head creator, a voiceover person, or a demo-first shooter. It adjusts the pacing, scene breaks, and language accordingly." />

      {s.style_summary && (
        <Text style={[S.summaryText, { marginBottom: 18 }]}>{s.style_summary}</Text>
      )}

      {/* Presence breakdown */}
      {presencePairs.length > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Presence</Text>
          <View style={vsS.presenceRow}>
            {presencePairs.map((p) => (
              <View key={p.label} style={vsS.presenceTile}>
                <Text style={vsS.presenceVal}>{p.val}</Text>
                <Text style={vsS.presenceLabel}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Key spec rows */}
      <View style={{ marginTop: presencePairs.length > 0 ? 16 : 0 }}>
        {s.dominant_format && <SpecRow label="Format" value={fmt(s.dominant_format)} first />}
        {s.dominant_content_tone && <SpecRow label="Tone" value={fmt(s.dominant_content_tone)} first={!s.dominant_format} />}
        {s.dominant_energy && <SpecRow label="Energy" value={fmt(s.dominant_energy)} />}
        {s.dominant_shot_style && <SpecRow label="Shot style" value={fmt(s.dominant_shot_style)} />}
        {s.avg_speaker_count != null && <SpecRow label="Speakers" value={String(s.avg_speaker_count)} />}
        {s.typical_target_audience && <SpecRow label="Audience" value={s.typical_target_audience} />}
        {s.avg_viral_potential != null && <SpecRow label="Viral potential" value={`${Math.round(s.avg_viral_potential > 1 ? s.avg_viral_potential : s.avg_viral_potential * 100)}%`} />}
        {s.avg_creative_score != null && <SpecRow label="Creative score" value={`${Math.round(s.avg_creative_score > 1 ? s.avg_creative_score : s.avg_creative_score * 100)}%`} />}
      </View>

      {/* Format distribution */}
      {fmtDist.length > 0 && (() => {
        const sorted = [...fmtDist].sort(([, a], [, b]) => b - a);
        const top = sorted[0];
        const topPct = fmtTotal > 0 ? Math.round((top[1] / fmtTotal) * 100) : 0;
        return (
          <View style={S.chipSection}>
            <View>
              <Text style={S.chipLabel}>Format Breakdown</Text>
              <Text style={vsS.distSub}>How your content is split across video types</Text>
            </View>
            {sorted.map(([k, v]) => (
              <DistBar key={k} label={k} value={v} total={fmtTotal} color={D.coral} />
            ))}
            <View style={vsS.insightBox}>
              <Text style={vsS.insightText}>
                <Text style={vsS.insightBold}>{fmt(top[0])}</Text> is your dominant format at {topPct}% — the AI defaults to this structure when generating your scripts.
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Shot style distribution */}
      {shotDist.length > 0 && (() => {
        const sorted = [...shotDist].sort(([, a], [, b]) => b - a);
        const top = sorted[0];
        const topPct = shotTotal > 0 ? Math.round((top[1] / shotTotal) * 100) : 0;
        return (
          <View style={S.chipSection}>
            <View>
              <Text style={S.chipLabel}>Shot Style Breakdown</Text>
              <Text style={vsS.distSub}>How you frame and compose your shots</Text>
            </View>
            {sorted.map(([k, v]) => (
              <DistBar key={k} label={k} value={v} total={shotTotal} color={D.cyan} />
            ))}
            <View style={[vsS.insightBox, vsS.insightBoxCyan]}>
              <Text style={vsS.insightText}>
                <Text style={[vsS.insightBold, { color: D.cyan }]}>{fmt(top[0])}</Text> shots make up {topPct}% of your videos — this shapes how the AI thinks about your visual pacing and energy.
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Speaker roles */}
      {(s.typical_speaker_roles?.length ?? 0) > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Speaker roles</Text>
          <View style={S.chips}>
            {s.typical_speaker_roles!.map((r, i) => <Chip key={i} label={fmt(r)} color={D.limeDeep} />)}
          </View>
        </View>
      )}

      {/* Production notes */}
      {(s.production_notes?.length ?? 0) > 0 && (
        <View style={S.chipSection}>
          <Text style={S.chipLabel}>Production notes</Text>
          <View style={S.chips}>
            {s.production_notes!.map((n, i) => (
              <View key={i} style={ghostChipS.wrap}>
                <Text style={ghostChipS.text}>{n}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </SectionCard>
  );
}

const vsS = StyleSheet.create({
  presenceRow: { flexDirection: 'row', gap: 8 },
  presenceTile: {
    flex: 1, backgroundColor: D.card, borderRadius: 16,
    borderWidth: 1, borderColor: D.cardBorder,
    paddingVertical: 14, alignItems: 'center',
    ...Shadow.soft,
  },
  presenceVal: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  presenceLabel: { ...T.medium, fontSize: 11, color: D.textMuted, marginTop: 5 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  distLeft: { flex: 1, gap: 7 },
  distLabel: { ...T.medium, fontSize: 13, color: D.textPrimary },
  distTrack: { height: 8, backgroundColor: D.border, borderRadius: 4, overflow: 'hidden' },
  distFill: { height: '100%', borderRadius: 4 },
  distPct: { ...T.bold, fontSize: 14, width: 38, textAlign: 'right', letterSpacing: -0.3 },

  distSub: { ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 18, marginTop: 3 },
  insightBox: {
    marginTop: 4, padding: 14, borderRadius: 14,
    backgroundColor: D.coralSubtle,
    borderLeftWidth: 3, borderLeftColor: D.coral,
    borderWidth: 1, borderColor: D.coral + '25',
  },
  insightBoxCyan: {
    backgroundColor: D.cyanSubtle,
    borderLeftColor: D.cyan,
    borderColor: D.cyan + '25',
  },
  insightText: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 20 },
  insightBold: { ...T.bold, color: D.coral },
});

// ─── Polling constants ────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Fetching creator profile',
  'Scanning recent videos',
  'Detecting patterns & hooks',
  'Building your profile',
];
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const SUCCESS_STATUSES = new Set(['completed', 'complete', 'done', 'success']);
const FAIL_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled']);

function isTerminal(status: string | undefined, progress: number): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return SUCCESS_STATUSES.has(s) || FAIL_STATUSES.has(s) || progress >= 100;
}
function isSuccess(status: string | undefined, progress: number): boolean {
  if (!status) return progress >= 100;
  return SUCCESS_STATUSES.has(status.toLowerCase()) || progress >= 100;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

// ─── Plain-English brain (no jargon) ─────────────────────────────────────────

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Turn backend slugs (talking_head, question_hook, 45+, product-focused) into
// clean readable text: separators → spaces, first letter capitalized.
const humanize = (s: string | null | undefined): string => {
  const t = (s ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

function soundHeadline(speech: SpeechTemplate | null, energy: number | null): string | undefined {
  const bits: string[] = [];
  const pace = speech?.pace_band;
  if (pace === 'rapid' || pace === 'fast') bits.push('fast and punchy');
  else if (pace === 'conversational') bits.push('relaxed and conversational');
  else if (pace === 'slow') bits.push('calm and deliberate');
  else if (energy != null) bits.push(energy >= 60 ? 'high-energy' : 'easygoing');
  if (speech?.tone) bits.push(speech.tone.toLowerCase());
  if (!bits.length) return undefined;
  return cap(bits.join(', ')) + '.';
}

function filmHeadline(p: PacingTemplate | null): string | undefined {
  const bits: string[] = [];
  if (p?.avg_video_length_sec != null) bits.push(`~${fmtSec(p.avg_video_length_sec)} videos`);
  if (p?.cuts_per_30s != null) {
    bits.push(p.cuts_per_30s >= 8 ? 'lots of quick cuts' : p.cuts_per_30s >= 4 ? 'a steady mix of cuts' : 'longer, steady shots');
  }
  return bits.length ? cap(bits.join(' · ')) : undefined;
}

// One teaching row: a metric + what it says about them.
function DetailRow({ label, value, meaning }: { label: string; value?: string; meaning: string }) {
  return (
    <View style={brainS.dRow}>
      <Text style={brainS.dLabel}>{label}</Text>
      {value ? <Text style={brainS.dValue}>{value}</Text> : null}
      <Text style={brainS.dMeaning}>{meaning}</Text>
    </View>
  );
}

function wpmMeaning(t: SpeechTemplate): string {
  const w = t.avg_wpm ?? 0;
  if (t.pace_band === 'rapid' || w >= 180) return "That's fast — it keeps your energy high and people watching.";
  if (t.pace_band === 'fast' || w >= 160) return 'A little quicker than average — punchy and easy to stay with.';
  if (t.pace_band === 'slow' || (w > 0 && w < 120)) return 'Calm and clear — the kind of pace people find easy to follow.';
  return 'A natural, conversational pace that feels easy to watch.';
}

// A natural-language "read" of the creator, composed from their real data.
function creatorRead(profile: CreatorProfile, speech: SpeechTemplate | null, pacing: PacingTemplate | null): string[] {
  const out: string[] = [];

  const pace = speech?.pace_band;
  let voice = 'You have a natural, easy way of talking to camera';
  if (pace === 'rapid' || pace === 'fast') voice = "You're a fast, high-energy talker";
  else if (pace === 'conversational') voice = "You're a relaxed, conversational talker";
  else if (pace === 'slow') voice = "You're a calm, deliberate talker";
  else if (profile.energy_level != null) voice = profile.energy_level >= 60 ? "You're a high-energy talker" : "You're an easygoing talker";
  if (speech?.tone) voice += ` with a ${speech.tone.toLowerCase()} tone`;
  out.push(voice + '.');

  const motion: string[] = [];
  if (pacing?.avg_hook_duration_sec != null) motion.push(`you grab attention in the first ${fmtSec(pacing.avg_hook_duration_sec)}`);
  if (pacing?.cuts_per_30s != null) motion.push(pacing.cuts_per_30s >= 8 ? 'keep things moving with quick cuts' : 'keep a steady, easy-to-follow rhythm');
  if (motion.length) out.push(cap(motion.join(' and ')) + '.');

  const shape: string[] = [];
  if (pacing?.avg_video_length_sec != null) shape.push(`your videos run about ${fmtSec(pacing.avg_video_length_sec)}`);
  if (pacing?.typical_cta_position) {
    const p = pacing.typical_cta_position.toLowerCase();
    shape.push(p.includes('end') ? 'you make your ask right at the end' : `you make your ask in the ${p}`);
  }
  if (shape.length) out.push(cap(shape.join(', and ')) + '.');

  if (speech && speech.signature_phrases.length > 0) {
    const ph = speech.signature_phrases.slice(0, 2).map((p) => `“${p}”`).join(' and ');
    out.push(`You come back to lines like ${ph} — little tells that make your content unmistakably yours.`);
  }

  if (profile.authenticity_score != null && profile.authenticity_score >= 60) {
    out.push("Above all, you come across as genuinely real — and that's exactly what we protect in every script we write for you.");
  }

  return out;
}

// ── Visual modules ───────────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Apple-style activity ring.
function Ring({ value, color, label }: { value: number; color: string; label: string }) {
  const size = 96, stroke = 9, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1000, easing: Ease.out, useNativeDriver: false }).start();
  }, [pct]);
  const offset = anim.interpolate({ inputRange: [0, 100], outputRange: [circ, 0] });
  return (
    <View style={brainS.ring}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={D.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={brainS.ringCenter}><Text style={brainS.ringNum}>{Math.round(pct)}</Text></View>
      <Text style={brainS.ringLabel}>{label}</Text>
    </View>
  );
}

function StatTile({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={brainS.stat}>
      <View style={brainS.statValRow}>
        <Text style={brainS.statVal}>{value}</Text>
        {unit ? <Text style={brainS.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={brainS.statLabel}>{label}</Text>
    </View>
  );
}

function signatureTagline(profile: CreatorProfile, speech: SpeechTemplate | null): string {
  const adjs: string[] = [];
  const pace = speech?.pace_band;
  if (pace === 'rapid' || pace === 'fast') adjs.push('Fast');
  else if (pace === 'conversational') adjs.push('Conversational');
  else if (pace === 'slow') adjs.push('Calm');
  if (profile.energy_level != null && profile.energy_level >= 60) adjs.push('high-energy');
  else if (speech?.tone && speech.tone.length <= 16) adjs.push(humanize(speech.tone).toLowerCase());
  const lead = adjs.slice(0, 2).join(', ');
  return lead ? `${cap(lead)} — and unmistakably you.` : 'Unmistakably you.';
}

function deriveTraits(profile: CreatorProfile, speech: SpeechTemplate | null, pacing: PacingTemplate | null): string[] {
  const t: string[] = [];
  const pace = speech?.pace_band;
  if (pace === 'rapid' || pace === 'fast') t.push('Fast talker');
  else if (pace === 'conversational') t.push('Conversational');
  else if (pace === 'slow') t.push('Calm & clear');
  if (profile.energy_level != null && profile.energy_level >= 60) t.push('High energy');
  if (pacing?.cuts_per_30s != null) t.push(pacing.cuts_per_30s >= 8 ? 'Quick cuts' : 'Steady pace');
  if (pacing?.typical_cta_position?.toLowerCase().includes('end')) t.push('Ask at the end');
  if (profile.authenticity_score != null && profile.authenticity_score >= 60) t.push('Keeps it real');
  (profile.top_performing_formats ?? []).slice(0, 2).forEach((f) => t.push(f));
  return Array.from(new Set(t)).slice(0, 8);
}

// Inline "See more" — reveals detail rows in place, per section.
function SeeMore({ children, label = 'See more' }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen((o) => !o); };
  return (
    <>
      {open ? <View style={brainS.seeMoreBody}>{children}</View> : null}
      <TouchableOpacity style={brainS.seeMoreBtn} onPress={toggle} activeOpacity={0.7}>
        <Text style={brainS.seeMoreText}>{open ? 'See less' : label}</Text>
        <ChevronDown size={15} color={D.coral} strokeWidth={2.5} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>
    </>
  );
}

function soundPaceWord(t: SpeechTemplate): string {
  switch (t.pace_band) {
    case 'rapid': return 'Rapid';
    case 'fast': return 'Fast';
    case 'conversational': return 'Conversational';
    case 'slow': return 'Slow';
    default: return 'Pace';
  }
}

// Deep breakdown, collapsed by default — keeps the page glanceable up top.
function BrainBreakdown({ speech, pacing }: { speech: SpeechTemplate | null; pacing: PacingTemplate | null }) {
  const [open, setOpen] = useState(false);
  const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setOpen((o) => !o); };
  return (
    <View style={brainS.breakdown}>
      <TouchableOpacity style={brainS.breakdownBtn} onPress={toggle} activeOpacity={0.7}>
        <Text style={brainS.breakdownText}>The full breakdown</Text>
        <ChevronDown size={18} color={D.textMuted} strokeWidth={2.2} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </TouchableOpacity>
      {open && (
        <View style={brainS.breakdownBody}>
          {speech?.avg_wpm != null && <DetailRow label="Speaking speed" value={`${speech.avg_wpm} wpm`} meaning={wpmMeaning(speech)} />}
          {speech?.tone && <DetailRow label="Tone" value={cap(speech.tone)} meaning="The mood people feel when they watch you." />}
          {speech?.opening_style && <DetailRow label="How you open" value={cap(speech.opening_style)} meaning="Your go-to way to pull people in." />}
          {speech && speech.filler_words.length > 0 && <DetailRow label="Words you lean on" value={speech.filler_words.slice(0, 4).join(', ')} meaning="The little habits that make you sound human." />}
          {pacing?.avg_hook_duration_sec != null && <DetailRow label="Hook window" value={`first ${fmtSec(pacing.avg_hook_duration_sec)}`} meaning="How fast you grab attention." />}
          {pacing?.cuts_per_30s != null && <DetailRow label="Cut rate" value={`~${pacing.cuts_per_30s} / 30s`} meaning={pacing.cuts_per_30s >= 8 ? 'Quick, high-energy cuts.' : 'A steady, easy rhythm.'} />}
          {pacing?.typical_cta_position && <DetailRow label="Your ask lands" value={cap(pacing.typical_cta_position)} meaning="Where your call-to-action usually goes." />}
          {speech && <Text style={brainS.basedOn}>Learned from {speech.sample_count} of your videos.</Text>}
        </View>
      )}
    </View>
  );
}

function PlainCard({
  icon, tint, title, headline, body, children, details, delay = 0,
}: {
  icon: React.ReactNode; tint: string; title: string;
  headline?: string; body?: string; children?: React.ReactNode; details?: React.ReactNode; delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  return (
    <FadeInView delay={delay} style={brainS.card}>
      <View style={brainS.cardHead}>
        <View style={[brainS.cardIcon, { backgroundColor: tint + '18' }]}>{icon}</View>
        <Text style={brainS.cardTitle}>{title}</Text>
      </View>
      {headline ? <Text style={brainS.cardHeadline}>{headline}</Text> : null}
      {body ? <Text style={brainS.cardBody}>{body}</Text> : null}
      {children}

      {details ? (
        <>
          {open ? <View style={brainS.details}>{details}</View> : null}
          <TouchableOpacity style={brainS.learnBtn} onPress={toggle} activeOpacity={0.7}>
            <Text style={brainS.learnText}>{open ? 'Show less' : 'Learn more about you'}</Text>
            <ChevronDown
              size={16} color={D.coral} strokeWidth={2.5}
              style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        </>
      ) : null}
    </FadeInView>
  );
}

// Brain area uses the platform system font (San Francisco on iOS) for a clean,
// native, Apple feel — set via fontWeight with no fontFamily (system default).
const brainS = StyleSheet.create({
  readyCard: { backgroundColor: D.inkCard, borderRadius: 22, padding: 24, marginTop: 14 },
  readyIcon: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: D.coral,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  readyTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: '#FFF' },
  readyBody: { fontSize: 15, fontWeight: '400', color: 'rgba(255,255,255,0.8)', lineHeight: 23, marginTop: 8 },

  readCard: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 24, marginTop: 14 },
  readLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: D.textMuted, marginBottom: 16 },
  readLine: { fontSize: 18, fontWeight: '400', color: D.textPrimary, lineHeight: 27, letterSpacing: -0.2 },

  // Compact identity strip
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 20, padding: 16, marginTop: 14, marginHorizontal: 16, overflow: 'hidden',
  },
  heroAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  heroAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  heroAvatarLetter: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroName: { fontSize: 18, fontWeight: '700', color: '#FFF', letterSpacing: -0.4, flexShrink: 1 },
  heroMeta: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.9)', marginTop: 3, letterSpacing: -0.1 },

  // Your performance — real sales + top 3 videos
  perfCard: {
    backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border,
    padding: 20, marginTop: 14, marginHorizontal: 16,
  },
  perfHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  perfVidsLabel: { fontSize: 12, fontWeight: '600', color: D.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 18, marginBottom: 12 },
  perfGmv: { fontSize: 24, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.6, marginTop: -6 },
  perfGmvLabel: { fontSize: 12.5, fontWeight: '500', color: D.textMuted, letterSpacing: 0 },
  perfSub: { fontSize: 15, fontWeight: '500', color: D.textMuted, letterSpacing: -0.2, marginTop: -6 },
  perfAll: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingLeft: 6 },
  perfAllText: { fontSize: 13.5, fontWeight: '600', color: D.coral, letterSpacing: -0.1 },
  perfEmpty: { fontSize: 13.5, fontWeight: '400', color: D.textSecondary, lineHeight: 20 },

  vidGrid: { flexDirection: 'row', gap: 10 },
  vidCol: { flex: 1, minWidth: 0 },
  vidThumbWrap: { width: '100%', aspectRatio: 9 / 16, borderRadius: 14, overflow: 'hidden', backgroundColor: D.surface },
  vidThumbImg: { width: '100%', height: '100%' },
  vidThumbPh: { alignItems: 'center', justifyContent: 'center' },
  vidViews: {
    position: 'absolute', left: 6, right: 6, bottom: 6,
    backgroundColor: 'rgba(26,20,38,0.72)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6,
  },
  vidViewsText: { fontSize: 10.5, fontWeight: '600', color: '#FFF', textAlign: 'center', letterSpacing: 0.1 },
  vidUseBtn: {
    marginTop: 8, backgroundColor: D.coral, borderRadius: 999, paddingVertical: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  vidUseText: { fontSize: 12, fontWeight: '700', color: '#FFF', letterSpacing: -0.1 },

  // Signature line
  sigCard: { backgroundColor: D.inkCard, borderRadius: 22, padding: 24, marginTop: 14, marginHorizontal: 16 },
  sigLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', color: D.coral, marginBottom: 12 },
  sigTagline: { fontSize: 26, fontWeight: '700', color: '#FFF', letterSpacing: -0.6, lineHeight: 33 },

  // Rings + stats
  voiceCard: { backgroundColor: D.card, borderRadius: 24, borderWidth: 1, borderColor: D.border, padding: 24, marginTop: 14 },
  rings: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  ring: { alignItems: 'center' },
  ringCenter: { position: 'absolute', width: 96, height: 96, top: 0, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontSize: 28, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.8 },
  ringLabel: { fontSize: 13, fontWeight: '600', color: D.textSecondary, marginTop: 10, letterSpacing: -0.1 },
  statStrip: { flexDirection: 'row', alignItems: 'center' },
  statStripBordered: { marginTop: 22, borderTopWidth: 1, borderTopColor: D.borderSubtle, paddingTop: 20 },
  stat: { flex: 1, alignItems: 'center' },
  statValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statVal: { fontSize: 26, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.7 },
  statUnit: { fontSize: 13, fontWeight: '600', color: D.textMuted },
  statLabel: { fontSize: 12.5, fontWeight: '500', color: D.textMuted, marginTop: 5 },
  statDivider: { width: 1, height: 34, backgroundColor: D.borderSubtle },

  sectionLabel: { fontSize: 12.5, fontWeight: '600', color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 },
  dnaTagline: { fontSize: 22, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.5, lineHeight: 28, marginTop: -4 },
  groupLabel: { fontSize: 12, fontWeight: '600', color: D.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 22, marginBottom: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tag: {
    backgroundColor: D.coralSubtle, borderWidth: 1, borderColor: D.coral + '20',
    borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10,
  },
  tagText: { fontSize: 14.5, fontWeight: '600', color: D.coral, letterSpacing: -0.2 },

  sellRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 12 },
  sellDivider: { borderTopWidth: 1, borderTopColor: D.borderSubtle },
  sellName: { fontSize: 15, fontWeight: '500', color: D.textPrimary, flex: 1, letterSpacing: -0.2 },
  sellGmv: { fontSize: 15, fontWeight: '700', color: D.limeDeep, letterSpacing: -0.2 },

  seeMoreBody: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: D.borderSubtle, gap: 18 },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 16, paddingVertical: 2 },
  seeMoreText: { fontSize: 13.5, fontWeight: '600', color: D.coral, letterSpacing: -0.1 },

  breakdown: { marginTop: 14 },
  breakdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  breakdownText: { fontSize: 14, fontWeight: '600', color: D.textMuted, letterSpacing: -0.1 },
  breakdownBody: {
    backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border,
    padding: 22, marginTop: 4, gap: 20,
  },

  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 20, marginTop: 14, marginHorizontal: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 12.5, fontWeight: '600', color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  cardHeadline: { fontSize: 22, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.5, lineHeight: 28 },
  cardBody: { fontSize: 15, fontWeight: '400', color: D.textSecondary, lineHeight: 22, marginTop: 8 },

  miniLabel: { fontSize: 12, fontWeight: '600', color: D.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 20, marginBottom: 12 },
  phrases: { alignItems: 'flex-start', gap: 8, alignSelf: 'stretch' },
  phrase: {
    maxWidth: '100%', backgroundColor: D.coralSubtle,
    borderWidth: 1, borderColor: D.coral + '22', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  phraseText: { fontSize: 15, fontWeight: '500', color: D.coral, lineHeight: 20 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
  },
  chipText: { fontSize: 14, fontWeight: '500', color: D.textSecondary },
  inkChip: { backgroundColor: D.inkCard, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  inkChipText: { fontSize: 14, fontWeight: '500', color: '#FFF' },

  learnBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingVertical: 4 },
  learnText: { fontSize: 14, fontWeight: '600', color: D.coral, letterSpacing: -0.1 },
  details: { marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: D.borderSubtle, gap: 18 },
  dRow: { gap: 3 },
  dLabel: { fontSize: 12, fontWeight: '600', color: D.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  dValue: { fontSize: 16, fontWeight: '600', color: D.textPrimary, letterSpacing: -0.2, lineHeight: 22 },
  dMeaning: { fontSize: 13, fontWeight: '400', color: D.textSecondary, lineHeight: 19, marginTop: 1 },
  basedOn: { fontSize: 12.5, fontWeight: '400', color: D.textMuted, lineHeight: 18, marginTop: 14 },

  powers: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, marginTop: 14, marginHorizontal: 16 },
  powersLabel: { fontSize: 11, fontWeight: '600', color: D.textMuted, letterSpacing: 1.2, marginBottom: 6 },
  powerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.divider },
  powerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  powerTitle: { fontSize: 15, fontWeight: '600', color: D.textPrimary, letterSpacing: -0.2 },
  powerSub: { fontSize: 12.5, fontWeight: '400', color: D.textMuted, marginTop: 1 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.coral, borderRadius: 999, paddingVertical: 17, gap: 10,
    marginTop: 18, marginHorizontal: 16, ...Shadow.coral,
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: -0.3 },
  ctaArrow: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Profile: teaching modules ───────────────────────────────────────────────
// Everything below turns the brain into things a creator learns from: a named
// archetype, insight cards benchmarked against a typical creator, explained
// hooks, distribution bars and a short playbook. Logic lives in
// lib/profile-insights.ts; these are just the visuals.

const CARD_W = Dimensions.get('window').width - 32;

function CompareBar({ you, typical, youLabel, typicalLabel }: { you: number; typical: number; youLabel: string; typicalLabel: string }) {
  const max = Math.max(you, typical) * 1.12 || 1;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 900, easing: Ease.out, useNativeDriver: false }).start(); }, []);
  const w = (v: number) => anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(4, (v / max) * 100)}%`] });
  return (
    <View style={pS.cmp}>
      <View style={pS.cmpRow}>
        <Text style={pS.cmpName}>You</Text>
        <View style={pS.cmpTrack}><Animated.View style={[pS.cmpFill, { width: w(you), backgroundColor: D.coral }]} /></View>
        <Text style={pS.cmpVal}>{youLabel}</Text>
      </View>
      <View style={pS.cmpRow}>
        <Text style={pS.cmpName}>Typical</Text>
        <View style={pS.cmpTrack}><Animated.View style={[pS.cmpFill, { width: w(typical), backgroundColor: 'rgba(26,20,38,0.22)' }]} /></View>
        <Text style={[pS.cmpVal, { color: D.textMuted }]}>{typicalLabel}</Text>
      </View>
    </View>
  );
}

function InsightIcon({ k }: { k: InsightKey }) {
  const c = D.coral, s = 15, sw = 2.2;
  switch (k) {
    case 'pace': return <Mic size={s} color={c} strokeWidth={sw} />;
    case 'hook': return <Zap size={s} color={c} strokeWidth={sw} />;
    case 'length': return <Clock size={s} color={c} strokeWidth={sw} />;
    case 'cuts': return <Scissors size={s} color={c} strokeWidth={sw} />;
    case 'energy': return <Activity size={s} color={c} strokeWidth={sw} />;
    case 'real': return <Heart size={s} color={c} strokeWidth={sw} />;
    case 'oncamera': return <Camera size={s} color={c} strokeWidth={sw} />;
    default: return <Share2 size={s} color={c} strokeWidth={sw} />;
  }
}

function InsightCard({ it }: { it: Insight }) {
  return (
    <View style={[pS.insCard, { width: CARD_W }]}>
      <View style={pS.insHead}>
        <View style={pS.insIcon}><InsightIcon k={it.key} /></View>
        <Text style={pS.insLabel}>{it.label}</Text>
      </View>
      <View style={pS.insValRow}>
        <Text style={pS.insVal}>{it.value}</Text>
        {it.unit ? <Text style={pS.insUnit}>{it.unit}</Text> : null}
      </View>
      <Text style={pS.insHeadline}>{it.headline}</Text>
      <CompareBar
        you={it.you} typical={it.typical}
        youLabel={it.unit ? (it.unit === '%' || it.unit.startsWith('/') ? `${it.value}${it.unit}` : `${it.value} ${it.unit}`) : it.value}
        typicalLabel={it.typicalLabel}
      />
      <Text style={pS.insBody}>{it.meaning}</Text>
      <View style={pS.insWhy}>
        <Text style={pS.insWhyText}><Text style={pS.insWhyLabel}>Why it matters  </Text>{it.why}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={pS.insTip}>
        <View style={pS.insTipIcon}><Lightbulb size={14} color={D.limeDeep} strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}>
          <Text style={pS.insTipLabel}>Try this</Text>
          <Text style={pS.insTipText}>{it.tip}</Text>
        </View>
      </View>
    </View>
  );
}

function InsightCarousel({ items }: { items: Insight[] }) {
  const [idx, setIdx] = useState(0);
  const step = CARD_W + 12;
  return (
    <FadeInView delay={30} style={pS.carWrap}>
      <View style={pS.carHead}>
        <Text style={pS.carTitle}>What we learned about you</Text>
        <Text style={pS.carCount}>{idx + 1} of {items.length}</Text>
      </View>
      <Text style={pS.carSub}>Swipe — each one compares you to a typical creator.</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onMomentumScrollEnd={(e) => setIdx(Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))))}
      >
        {items.map((it) => <InsightCard key={it.key} it={it} />)}
      </ScrollView>
      <View style={pS.dots}>
        {items.map((it, i) => <View key={it.key} style={[pS.dot, i === idx && pS.dotOn]} />)}
      </View>
    </FadeInView>
  );
}

function PlayRow({ p, last }: { p: Play; last?: boolean }) {
  const meta = p.kind === 'more'
    ? { icon: <TrendingUp size={16} color={D.limeDeep} strokeWidth={2.4} />, bg: D.limeSubtle, tag: 'Do more of' }
    : p.kind === 'watch'
      ? { icon: <AlertTriangle size={16} color={D.coral} strokeWidth={2.4} />, bg: D.coralSubtle, tag: 'Watch out for' }
      : { icon: <Lightbulb size={16} color={D.ink} strokeWidth={2.4} />, bg: D.inkHairline, tag: 'Try next' };
  return (
    <View style={[pS.play, !last && pS.playDivider]}>
      <View style={[pS.playIcon, { backgroundColor: meta.bg }]}>{meta.icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={pS.playTag}>{meta.tag}</Text>
        <Text style={pS.playTitle}>{p.title}</Text>
        <Text style={pS.playBody}>{p.body}</Text>
      </View>
    </View>
  );
}

function DistRow({ label, pct, color = D.coral }: { label: string; pct: number; color?: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: pct, duration: 800, easing: Ease.out, useNativeDriver: false }).start(); }, [pct]);
  return (
    <View style={pS.dist}>
      <View style={pS.distTop}>
        <Text style={pS.distLabel}>{humanize(label)}</Text>
        <Text style={pS.distPct}>{pct}%</Text>
      </View>
      <View style={pS.distTrack}>
        <Animated.View style={[pS.distFill, { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

function HookRow({ slug, last }: { slug: string; last?: boolean }) {
  const h = explainHook(slug);
  return (
    <View style={[pS.hook, !last && pS.playDivider]}>
      <Text style={pS.hookName}>{h.name}</Text>
      <Text style={pS.hookWhat}>{h.what}</Text>
      {h.example ? <Text style={pS.hookEx}>{h.example}</Text> : null}
    </View>
  );
}

function Lead({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={pS.lead}>
      <Text style={pS.leadLabel}>{label}</Text>
      <Text style={pS.leadText}>{children}</Text>
    </View>
  );
}

const pS = StyleSheet.create({
  archName: { fontSize: 30, fontWeight: '800', color: '#FFF', letterSpacing: -0.9, lineHeight: 34, marginTop: 6 },
  archBlurb: { fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 21, marginTop: 8 },

  carWrap: { marginTop: 28, marginBottom: 6 },
  carHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginHorizontal: 16 },
  carTitle: { fontSize: 20, fontWeight: '800', color: D.textPrimary, letterSpacing: -0.5 },
  carCount: { fontSize: 13, fontWeight: '600', color: D.textMuted },
  carSub: { fontSize: 13.5, color: D.textMuted, marginHorizontal: 16, marginTop: 3, marginBottom: 14, lineHeight: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(26,20,38,0.16)' },
  dotOn: { width: 18, backgroundColor: D.coral },

  insCard: {
    backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border,
    padding: 20,
  },
  insHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center' },
  insLabel: { fontSize: 12, fontWeight: '700', color: D.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  insValRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 10 },
  insVal: { fontSize: 46, fontWeight: '800', color: D.textPrimary, letterSpacing: -1.8, lineHeight: 50 },
  insUnit: { fontSize: 15, fontWeight: '600', color: D.textMuted },
  insHeadline: { fontSize: 19, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.4, lineHeight: 25, marginTop: 2 },
  insBody: { fontSize: 15, color: D.textPrimary, lineHeight: 22, marginTop: 16 },
  insWhy: { marginTop: 12 },
  insWhyLabel: { fontWeight: '700', color: D.textMuted },
  insWhyText: { fontSize: 13.5, color: D.textMuted, lineHeight: 19 },
  insTip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: D.limeSubtle, borderRadius: 16, padding: 14, marginTop: 18 },
  insTipIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  insTipLabel: { fontSize: 11, fontWeight: '700', color: D.limeDeep, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  insTipText: { fontSize: 14.5, fontWeight: '600', color: D.ink, lineHeight: 20 },

  cmp: { marginTop: 16, gap: 8 },
  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cmpName: { width: 50, fontSize: 12, fontWeight: '600', color: D.textMuted },
  cmpTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: D.inkHairline, overflow: 'hidden' },
  cmpFill: { height: '100%', borderRadius: 5 },
  cmpVal: { width: 66, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: D.textPrimary, fontVariant: ['tabular-nums'] },

  play: { flexDirection: 'row', gap: 14, paddingVertical: 14 },
  playDivider: { borderBottomWidth: 1, borderBottomColor: D.divider },
  playIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  playTag: { fontSize: 11, fontWeight: '700', color: D.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  playTitle: { fontSize: 16, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.2, marginTop: 3, lineHeight: 21 },
  playBody: { fontSize: 14, color: D.textSecondary, lineHeight: 20, marginTop: 4 },

  dist: { marginTop: 12 },
  distTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  distLabel: { fontSize: 14, fontWeight: '600', color: D.textPrimary },
  distPct: { fontSize: 13, fontWeight: '700', color: D.textMuted, fontVariant: ['tabular-nums'] },
  distTrack: { height: 8, borderRadius: 4, backgroundColor: D.inkHairline, overflow: 'hidden' },
  distFill: { height: '100%', borderRadius: 4 },

  hook: { paddingVertical: 14 },
  hookName: { fontSize: 16, fontWeight: '700', color: D.textPrimary, letterSpacing: -0.2 },
  hookWhat: { fontSize: 14, color: D.textSecondary, lineHeight: 20, marginTop: 4 },
  hookEx: { fontSize: 14, fontStyle: 'italic', color: D.coral, marginTop: 6 },

  lead: { marginTop: 14 },
  leadLabel: { fontSize: 11, fontWeight: '700', color: D.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  leadText: { fontSize: 15, color: D.textPrimary, lineHeight: 22 },

  moves: { marginTop: 14, gap: 10 },
  move: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  moveDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: D.limeSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  moveText: { flex: 1, fontSize: 14, color: D.textSecondary, lineHeight: 20 },

  glance: { marginTop: 4 },
  footnote: { fontSize: 12, color: D.textDisabled, marginHorizontal: 20, marginTop: 8, marginBottom: 6, lineHeight: 17, textAlign: 'center' },
});

export default function BrainScreen() {
  const { meData, profile, refreshMe, credits, canAfford } = useAuth();
  const router = useRouter();

  // Real performance data (shared cache with the Shop tab): top videos from the
  // brain ingest + real API-sourced GMV when the creator has it. Never estimates.
  const resultsQ = useQuery<ResultsResponse>({
    queryKey: ['results'],
    queryFn: async () => {
      const res = await api.get('/creators/me/results');
      return extractData<ResultsResponse>(res) as ResultsResponse;
    },
    staleTime: 5 * 60_000,
  });
  const results = resultsQ.data ?? null;

  const shopQ = useQuery({
    queryKey: ['shop-dashboard'],
    queryFn: async () => extractData<ShopDashboard>(await api.get('/creators/me/shop-dashboard')),
    retry: false,
    staleTime: 60_000,
  });
  const topVideos = (shopQ.data?.top_videos ?? []).slice(0, 3);
  const shopGmv = shopQ.data?.summary && shopQ.data.summary.gmv_30d > 0 ? shopQ.data.summary.gmv_30d : null;
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunData | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAnalyzing = runId !== null && !isTerminal(run?.status, run?.progress ?? 0) && !timedOut;

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), []);

  // Returns true when the run is terminal (done or failed) so callers know
  // whether to start the polling interval.
  const pollRun = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await api.get(`/creators/runs/${id}`);
      const d = extractData<RunData>(res);
      if (__DEV__) console.warn('[Brain] poll:', id, JSON.stringify({ status: d?.status, progress: d?.progress, message: d?.message, error: d?.error }));
      setRun(d);
      if (isTerminal(d.status, d.progress)) {
        stopPolling(); setRunId(null);
        if (isSuccess(d.status, d.progress)) await refreshMe();
        return true;
      }
      return false;
    } catch (err: any) {
      const status = err?.response?.status;
      if (__DEV__) console.warn('[Brain] poll error:', status, JSON.stringify(err?.response?.data));
      if (status === 404) {
        stopPolling(); setRunId(null);
        // Set a failed run so the "Analysis Failed" screen renders instead
        // of silently dropping back to the empty CTA.
        setRun({ id, status: 'failed', progress: 0, error: 'Analysis run not found — it may have expired. Please try again.' });
        return true;
      }
      return false; // transient error — keep polling
    }
  }, [stopPolling, refreshMe]);

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pollRun(id), 2500);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { stopPolling(); setTimedOut(true); }, POLL_TIMEOUT_MS);
  }, [pollRun, stopPolling]);

  useEffect(() => {
    const ingestStatus = profile?.ingest_status;
    const latestRun = meData?.latest_run;
    if (!latestRun?.id || runId) return;
    const active = ['processing', 'running', 'queued', 'in_progress'].includes(ingestStatus ?? '');
    const runActive = ['processing', 'queued'].includes(latestRun.status ?? '');
    if (active || runActive) {
      setRunId(latestRun.id); setRun(latestRun as RunData);
      pollRun(latestRun.id).then((done) => { if (!done) startPolling(latestRun.id); });
    }
  }, [profile?.ingest_status, meData?.latest_run?.id]);

  const handleManualRefresh = async () => {
    setManualRefreshing(true); setTimedOut(false);
    await refreshMe();
    setManualRefreshing(false); setRunId(null); setRun(null);
  };

  const handleAnalyze = async () => {
    // The FIRST brain build is free (core onboarding). Only a re-analysis of an
    // existing brain costs credits — block early when short.
    if (hasBrain && !canAfford(CREDIT_COSTS.brainRefresh)) {
      Alert.alert(
        'Not enough scripts',
        `Refreshing your profile uses ${CREDIT_COSTS.brainRefresh} scripts — you have ${credits}.`,
        [
          { text: 'Get scripts', onPress: () => router.push('/(tabs)/profile') },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    setAnalyzeLoading(true); setAnalyzeError(null); setTimedOut(false);
    try {
      const handle = profile?.handle;
      if (__DEV__) console.warn('[Brain] POST /creators/analyze handle:', handle);
      const res = await api.post('/creators/analyze', handle ? { handle } : {});
      if (__DEV__) console.warn('[Brain] POST response:', JSON.stringify(res.data));
      const d = extractData<AnalyzeResponse>(res);

      // The API might return success:false with an error message inside a 200 response
      if ((res.data as any)?.success === false || (res.data as any)?.error) {
        const errMsg = (res.data as any)?.error?.message ?? (res.data as any)?.error ?? (res.data as any)?.message ?? 'Analysis could not be started';
        setAnalyzeError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        return;
      }

      const id = d.runId ?? (d as any).run_id ?? (d as any).id;
      if (!id) {
        setAnalyzeError('No run ID returned. Make sure your TikTok handle has public videos.');
        return;
      }
      setRunId(id); setRun(null);
      const done = await pollRun(id);
      if (!done) startPolling(id);
    } catch (err: any) {
      if (__DEV__) console.warn('[Brain] analyze error:', err?.response?.status, JSON.stringify(err?.response?.data));
      if (!err?.response) {
        // No HTTP response — usually because the app was backgrounded mid-request
        // (we now tell users they can close the app). The server may still have
        // accepted the analyze and even finished it. Re-check /me before failing:
        // attach to the active run, or if it already completed just let the
        // refreshed state render the brain. Only show the error if we're truly offline.
        try {
          const meRes = await api.get('/creators/me');
          const me = extractData<CreatorMeData>(meRes);
          await refreshMe();
          const lr = me?.latest_run as RunData | undefined;
          const lrActive = ['processing', 'queued', 'running', 'in_progress'].includes((lr?.status ?? '').toLowerCase());
          if (lr?.id && lrActive && !isTerminal(lr.status, lr.progress ?? 0)) {
            setRunId(lr.id); setRun(lr);
            const done = await pollRun(lr.id);
            if (!done) startPolling(lr.id);
          }
          // else: run finished (brain now present) or never started — refreshed
          // state renders the right screen; no scary error.
        } catch {
          setAnalyzeError(err?.message ?? 'Network error — check your connection');
        }
        return;
      }
      const code = err?.response?.data?.code;
      if (code === 'CONFLICT' || err?.response?.status === 409) {
        const latestRun = meData?.latest_run;
        if (latestRun?.id) {
          setRunId(latestRun.id); setRun(latestRun as RunData);
          const done = await pollRun(latestRun.id);
          if (!done) startPolling(latestRun.id);
        } else { await refreshMe(); }
      } else {
        const body = err.response.data;
        const raw = body?.error?.message ?? body?.error ?? body?.message ?? `Error ${err.response.status}`;
        setAnalyzeError(typeof raw === 'string' ? raw : JSON.stringify(raw));
      }
    } finally { setAnalyzeLoading(false); }
  };

  const speech = meData?.speech_template ?? null;
  const pacing = meData?.pacing_template ?? null;
  const insights = meData?.product_insights ?? null;
  const styleProfile = profile?.video_style_profile ?? null;
  const hasBrain = speech != null || pacing != null || insights != null
    || styleProfile != null
    || profile?.energy_level != null || profile?.authenticity_score != null;

  // ── TIMED OUT ─────────────────────────────────────────────────────────────
  if (timedOut) {
    return (
      <View style={S.root}>
        <View style={S.hdr}><Text style={S.hdrTitle}>Profile</Text></View>
        <View style={S.centerWrap}>
          <AlertCircle size={40} color={D.warning} strokeWidth={1.5} />
          <Text style={S.emptyTitle}>Still processing</Text>
          <Text style={S.emptySub}>Analysis is taking longer than expected. Tap below to check.</Text>
          <TouchableOpacity style={[S.analyzeBtn, manualRefreshing && { opacity: 0.55 }]}
            onPress={handleManualRefresh} disabled={manualRefreshing} activeOpacity={0.85}>
            {manualRefreshing
              ? <ActivityIndicator color="#FFF" size="small" />
              : <><RefreshCw size={16} color="#FFF" strokeWidth={2} /><Text style={S.analyzeBtnText}>Check Now</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── ANALYZING ─────────────────────────────────────────────────────────────
  if (isAnalyzing) {
    const progress = run?.progress ?? 0;
    return (
      <View style={S.root}>
        <View style={S.hdr}><Text style={S.hdrTitle}>Analyzing...</Text></View>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          <FadeInView direction="none" style={S.analyzeCard}>
            <View style={S.analyzeCenter}>
              <PulsingRing />
              <Text style={S.analyzeHandle}>@{profile?.handle ?? 'creator'}</Text>
              <Text style={S.analyzePhase}>
                {typeof run?.message === 'string' ? sanitizePhase(run.message)
                  : typeof run?.phase === 'string' ? sanitizePhase(run.phase)
                  : 'Preparing analysis...'}
              </Text>
              <Text style={S.analyzeReassure}>
                This can take up to 5 minutes. You can close the app — we'll send you a notification the moment your brain is ready.
              </Text>
            </View>
            <View style={S.progressSection}>
              <ProgressBar value={progress} />
              <View style={S.progressRow}>
                <Text style={S.progressPct}>{progress}% complete</Text>
                {typeof run?.phase === 'string' && <Text style={S.progressPhase}>{sanitizePhase(run.phase)}</Text>}
              </View>
            </View>
            <TouchableOpacity style={S.checkNowBtn} onPress={handleManualRefresh}
              disabled={manualRefreshing} activeOpacity={0.7}>
              {manualRefreshing
                ? <ActivityIndicator size="small" color={D.coral} />
                : <><RefreshCw size={13} color={D.coral} strokeWidth={2} /><Text style={S.checkNowText}>Check if done</Text></>}
            </TouchableOpacity>
          </FadeInView>
          {STEP_LABELS.map((step, i) => {
            const done = progress > i * 25;
            return (
              <FadeInView key={i} delay={i * 60} style={S.stepRow}>
                <View style={[S.stepDot, done && S.stepDotDone]}>
                  {done ? <CheckCircle size={14} color={D.limeDeep} strokeWidth={2.5} />
                    : <View style={S.stepInner} />}
                </View>
                <Text style={[S.stepText, done && S.stepTextDone]}>{step}</Text>
              </FadeInView>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // ── FAILED ────────────────────────────────────────────────────────────────
  if (run?.status === 'failed') {
    const emptyReason = (run.stats as any)?.empty_reason as string | undefined;
    const isRetryable = emptyReason === 'feed_unavailable';
    const rawMsg = run.message ?? run.error ?? '';
    const failMsg = rawMsg || 'The analysis pipeline encountered an error. Please try again or contact support.';
    return (
      <View style={S.root}>
        <View style={S.hdr}><Text style={S.hdrTitle}>{isRetryable ? 'Feed Unavailable' : 'Analysis Failed'}</Text></View>
        <View style={S.centerWrap}>
          <AlertCircle size={40} color={isRetryable ? D.warning : D.error} strokeWidth={1.5} />
          <Text style={S.emptyTitle}>{isRetryable ? 'Temporarily unavailable' : 'Something went wrong'}</Text>
          <Text style={S.emptySub}>{typeof failMsg === 'string' ? failMsg : JSON.stringify(failMsg)}</Text>
          <TouchableOpacity style={S.analyzeBtn} onPress={() => setRun(null)} activeOpacity={0.85}>
            <RefreshCw size={16} color="#FFF" strokeWidth={2} />
            <Text style={S.analyzeBtnText}>{isRetryable ? 'Try Again' : 'Try Again'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── COMPLETED BUT NO DATA ─────────────────────────────────────────────────
  // Run succeeded but the backend found no accessible videos — don't silently
  // drop back to the empty CTA, show a clear explanation instead.
  if (run?.status === 'completed' && !hasBrain) {
    const backendMsg = run.message ?? null;
    const notFound = backendMsg?.toLowerCase().includes("couldn't find") || backendMsg?.toLowerCase().includes("not found");
    const title = notFound ? 'Handle Not Found' : 'No Videos Found';
    const heading = notFound ? 'Account not found' : "Couldn't find your videos";
    const body = backendMsg
      ?? ('We found your account (@' + (profile?.handle ?? 'unknown') + ') but couldn\'t access any public videos to analyze.\n\nMake sure your TikTok videos are set to public, then try again.');
    return (
      <View style={S.root}>
        <View style={S.hdr}><Text style={S.hdrTitle}>{title}</Text></View>
        <View style={S.centerWrap}>
          <AlertCircle size={40} color={D.warning} strokeWidth={1.5} />
          <Text style={S.emptyTitle}>{heading}</Text>
          <Text style={S.emptySub}>{body}</Text>
          <TouchableOpacity style={S.analyzeBtn} onPress={() => setRun(null)} activeOpacity={0.85}>
            <RefreshCw size={16} color="#FFF" strokeWidth={2} />
            <Text style={S.analyzeBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── BRAIN LOADED ──────────────────────────────────────────────────────────
  if (hasBrain && profile) {
    return (
      <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* Compact identity strip */}
        <FadeInView style={brainS.hero}>
          <LinearGradient
            colors={Gradient.hero}
            start={{ x: 0.13, y: 0 }}
            end={{ x: 0.87, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={brainS.heroAvatar} />
            : (
              <View style={[brainS.heroAvatar, brainS.heroAvatarFallback]}>
                <Text style={brainS.heroAvatarLetter}>{(profile.handle[0] ?? 'C').toUpperCase()}</Text>
              </View>
            )}
          <View style={{ flex: 1 }}>
            <View style={brainS.heroNameRow}>
              <Text style={brainS.heroName} numberOfLines={1}>{profile.display_name ?? `@${profile.handle}`}</Text>
              <VerifiedSeal />
            </View>
            <Text style={brainS.heroMeta} numberOfLines={1}>
              {profile.display_name ? `@${profile.handle} · ` : ''}{fmtNum(profile.follower_count)} followers · {fmtNum(profile.video_count)} videos
            </Text>
          </View>
        </FadeInView>

        {/* Your performance — real sales (if on record) + top 3 videos as screengrabs */}
        <FadeInView delay={20} style={brainS.perfCard}>
          <View style={brainS.perfHead}>
            <View style={{ flex: 1 }}>
              <Text style={brainS.sectionLabel}>Shop performance</Text>
              {shopGmv != null ? (
                <Text style={brainS.perfGmv}>
                  ${fmtNum(shopGmv)}<Text style={brainS.perfGmvLabel}>  sales · 30d</Text>
                </Text>
              ) : (
                <Text style={brainS.perfSub}>No sales on record yet</Text>
              )}
            </View>
            <AnimatedPressable style={brainS.perfAll} haptic="light" onPress={() => router.push('/(tabs)/shop')}>
              <Text style={brainS.perfAllText}>See all</Text>
              <ArrowRight size={14} color={D.coral} strokeWidth={2.5} />
            </AnimatedPressable>
          </View>

          <Text style={brainS.perfVidsLabel}>Your top videos</Text>
          {topVideos.length > 0 ? (
            <View style={brainS.vidGrid}>
              {topVideos.map((v) => {
                const useVideo = () => {
                  if (v.url) router.push({ pathname: '/(tabs)/rewrite', params: { url: v.url } });
                  else router.push('/(tabs)/scriptiq');
                };
                return (
                  <View key={v.id} style={brainS.vidCol}>
                    <AnimatedPressable style={brainS.vidThumbWrap} haptic="light" onPress={useVideo}>
                      {v.thumbnail_url ? (
                        <Image source={{ uri: v.thumbnail_url }} style={brainS.vidThumbImg} resizeMode="cover" />
                      ) : (
                        <View style={[brainS.vidThumbImg, brainS.vidThumbPh]}>
                          <Film size={22} color={D.textDisabled} strokeWidth={1.8} />
                        </View>
                      )}
                      <View style={brainS.vidViews}>
                        <Text style={brainS.vidViewsText}>{fmtNum(v.views)} views</Text>
                      </View>
                    </AnimatedPressable>
                    <AnimatedPressable style={brainS.vidUseBtn} haptic="light" onPress={useVideo}>
                      <Text style={brainS.vidUseText}>Recreate video</Text>
                    </AnimatedPressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={brainS.perfEmpty}>
              {shopQ.isLoading ? 'Loading your top videos…' : 'Your top videos will show here once your profile has finished building.'}
            </Text>
          )}
        </FadeInView>

        {/* Your results — what your scripts did once posted */}
        {results && results.totals.scripts > 0 && (
          <FadeInView delay={20} style={brainS.card}>
            <View style={brainS.perfHead}>
              <View style={{ flex: 1 }}>
                <Text style={brainS.sectionLabel}>Your results</Text>
                <Text style={brainS.perfSub}>
                  {results.totals.posted > 0
                    ? `${results.totals.posted} of ${results.totals.scripts} scripts posted`
                    : `${results.totals.scripts} script${results.totals.scripts === 1 ? '' : 's'} written · none linked yet`}
                </Text>
              </View>
              <AnimatedPressable style={brainS.perfAll} haptic="light" onPress={() => router.push('/(tabs)/scripts')}>
                <Text style={brainS.perfAllText}>Saved</Text>
                <ArrowRight size={14} color={D.coral} strokeWidth={2.5} />
              </AnimatedPressable>
            </View>
            {results.totals.posted > 0 ? (
              <View style={[brainS.statStrip, { marginTop: 2 }]}>
                <StatTile value={fmtNum(results.totals.views)} label="Views" />
                <View style={brainS.statDivider} />
                <StatTile value={fmtNum(results.totals.likes)} label="Likes" />
                {results.totals.gmv != null && (<><View style={brainS.statDivider} /><StatTile value={`$${fmtNum(results.totals.gmv)}`} label="Sales" /></>)}
              </View>
            ) : (
              <Text style={[brainS.basedOn, { marginTop: 6 }]}>
                Posted one? Open it in Saved and tap “Did you post this?” — views, likes and sales will show up here.
              </Text>
            )}
          </FadeInView>
        )}

        {/* Your creator archetype — the one-line identity */}
        {(() => {
          const arch = archetype(profile, speech, pacing, styleProfile);
          return (
            <FadeInView delay={20} style={brainS.sigCard}>
              <Text style={brainS.sigLabel}>Your creator archetype</Text>
              <Text style={pS.archName}>{arch.name}</Text>
              <Text style={pS.archBlurb}>{arch.blurb}</Text>
            </FadeInView>
          );
        })()}

        {/* At a glance — rings + the headline numbers */}
        {(profile.energy_level != null || profile.authenticity_score != null || speech?.avg_wpm != null || pacing?.avg_hook_duration_sec != null) && (
          <FadeInView delay={30} style={brainS.card}>
            <Text style={brainS.sectionLabel}>At a glance</Text>
            {(profile.energy_level != null || profile.authenticity_score != null) && (
              <View style={[brainS.rings, { marginTop: 6 }]}>
                {profile.energy_level != null && <Ring value={profile.energy_level} color={D.coral} label="Energy" />}
                {profile.authenticity_score != null && <Ring value={profile.authenticity_score} color={D.limeDeep} label="Real" />}
              </View>
            )}
            {(() => {
              const tiles: React.ReactNode[] = [];
              if (speech?.avg_wpm != null) tiles.push(<StatTile key="p" value={String(speech.avg_wpm)} unit="wpm" label={soundPaceWord(speech)} />);
              if (pacing?.avg_hook_duration_sec != null) tiles.push(<StatTile key="h" value={fmtSec(pacing.avg_hook_duration_sec)} label="Hook" />);
              if (pacing?.avg_video_length_sec != null) tiles.push(<StatTile key="l" value={fmtSec(pacing.avg_video_length_sec)} label="Length" />);
              if (pacing?.cuts_per_30s != null) tiles.push(<StatTile key="c" value={String(Math.round(pacing.cuts_per_30s))} label="Cuts / 30s" />);
              return tiles.length ? (
                <View style={[brainS.statStrip, brainS.statStripBordered]}>
                  {tiles.map((t, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <View style={brainS.statDivider} />}
                      {t}
                    </React.Fragment>
                  ))}
                </View>
              ) : null;
            })()}
            {speech && <Text style={brainS.basedOn}>Learned by watching {speech.sample_count} of your videos.</Text>}
          </FadeInView>
        )}

        {/* What we learned — benchmarked insight cards */}
        {(() => {
          const items = buildInsights(profile, speech, pacing, styleProfile);
          return items.length > 0 ? <InsightCarousel items={items} /> : null;
        })()}

        {/* Your playbook — do more / watch / try */}
        {(() => {
          const plays = playbook(profile, speech, pacing, styleProfile);
          return plays.length > 0 ? (
            <FadeInView delay={40} style={brainS.card}>
              <Text style={[brainS.sectionLabel, { marginBottom: 2 }]}>Your playbook</Text>
              {plays.map((p, i) => <PlayRow key={i} p={p} last={i === plays.length - 1} />)}
            </FadeInView>
          ) : null;
        })()}

        {/* Your voice, decoded */}
        {speech && (speech.tone || speech.opening_style || speech.sentence_structure || speech.signature_phrases.length > 0) && (
          <FadeInView delay={50} style={brainS.card}>
            <Text style={brainS.sectionLabel}>Your voice, decoded</Text>
            {speech.tone && <Text style={brainS.dnaTagline}>{humanize(speech.tone)}</Text>}
            {speech.opening_style && <Lead label="How you open">{humanize(speech.opening_style)}</Lead>}
            {speech.sentence_structure && <Lead label="How you build a line">{humanize(speech.sentence_structure)}</Lead>}
            {pacing?.typical_cta_position && (
              <Lead label="When you make the ask">
                {pacing.typical_cta_position.toLowerCase().includes('end')
                  ? 'Right at the end — you earn it first, then ask.'
                  : `In the ${humanize(pacing.typical_cta_position).toLowerCase()} — you ask before people drift.`}
              </Lead>
            )}
            {speech.signature_phrases.length > 0 && (
              <>
                <Text style={[brainS.groupLabel, { marginTop: 16 }]}>Lines that are yours</Text>
                <View style={brainS.phrases}>
                  {speech.signature_phrases.slice(0, 5).map((p, i) => (
                    <View key={i} style={brainS.phrase}><Text style={brainS.phraseText}>“{p}”</Text></View>
                  ))}
                </View>
              </>
            )}
            {speech.filler_words.length > 0 && (
              <>
                <Text style={[brainS.groupLabel, { marginTop: 16 }]}>Your human tells</Text>
                <View style={brainS.tags}>
                  {speech.filler_words.slice(0, 5).map((w) => (
                    <View key={w} style={brainS.tag}><Text style={brainS.tagText}>{w}</Text></View>
                  ))}
                </View>
                <Text style={brainS.basedOn}>Most people edit these out. They're why you sound like a person, not an ad — we keep them in your scripts.</Text>
              </>
            )}
          </FadeInView>
        )}

        {/* Your hooks, explained */}
        {(profile.top_hook_types?.length ?? 0) > 0 && (
          <FadeInView delay={60} style={brainS.card}>
            <Text style={brainS.sectionLabel}>How you stop the scroll</Text>
            <Text style={[brainS.basedOn, { marginTop: -6 }]}>The hook styles you reach for most, and what each one does.</Text>
            {profile.top_hook_types!.slice(0, 4).map((h, i, arr) => <HookRow key={h} slug={h} last={i === arr.length - 1} />)}
          </FadeInView>
        )}

        {/* How you shoot — formats, shots, signature moves */}
        {styleProfile && (styleProfile.style_summary || styleProfile.format_distribution || styleProfile.shot_style_distribution || (styleProfile.production_notes?.length ?? 0) > 0) && (
          <FadeInView delay={70} style={brainS.card}>
            <Text style={brainS.sectionLabel}>How you shoot</Text>
            {styleProfile.style_summary && <Text style={brainS.dnaTagline}>{styleProfile.style_summary}</Text>}
            {(() => {
              const fmts = distList(styleProfile.format_distribution, 'format').slice(0, 4);
              const shots = distList(styleProfile.shot_style_distribution, 'style').slice(0, 4);
              return (
                <>
                  {fmts.length > 0 && (
                    <>
                      <Text style={[brainS.groupLabel, { marginTop: 14 }]}>Your formats</Text>
                      {fmts.map((f) => <DistRow key={f.label} label={f.label} pct={f.pct} />)}
                    </>
                  )}
                  {shots.length > 0 && (
                    <>
                      <Text style={[brainS.groupLabel, { marginTop: 18 }]}>What's on screen</Text>
                      {shots.map((s) => <DistRow key={s.label} label={s.label} pct={s.pct} color={D.ink} />)}
                    </>
                  )}
                </>
              );
            })()}
            {(styleProfile.production_notes?.length ?? 0) > 0 && (
              <>
                <Text style={[brainS.groupLabel, { marginTop: 18 }]}>Your signature moves</Text>
                <View style={pS.moves}>
                  {Array.from(new Set(styleProfile.production_notes!.map((n) => n.trim()))).slice(0, 4).map((n) => (
                    <View key={n} style={pS.move}>
                      <View style={pS.moveDot}><Check size={12} color={D.limeDeep} strokeWidth={3} /></View>
                      <Text style={pS.moveText}>{n}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </FadeInView>
        )}

        {/* Who you're for */}
        {(styleProfile?.typical_target_audience || (profile.niche?.length ?? 0) > 0) && (
          <FadeInView delay={80} style={brainS.card}>
            <Text style={brainS.sectionLabel}>Who you're for</Text>
            {styleProfile?.typical_target_audience && <Text style={brainS.dnaTagline}>{styleProfile.typical_target_audience}</Text>}
            {(profile.niche?.length ?? 0) > 0 && (
              <View style={[brainS.tags, { marginTop: 12 }]}>
                {profile.niche!.map((n) => (
                  <View key={n} style={brainS.inkChip}><Text style={brainS.inkChipText}>{humanize(n)}</Text></View>
                ))}
              </View>
            )}
          </FadeInView>
        )}

        {/* What sells for you */}
        {insights && ((insights.top_products?.length ?? 0) > 0 || (insights.recommended_categories?.length ?? 0) > 0) && (
          <FadeInView delay={90} style={brainS.card}>
            <Text style={brainS.sectionLabel}>What sells for you</Text>
            {insights.top_products.slice(0, 3).map((p, i) => (
              <View key={i} style={[brainS.sellRow, i > 0 && brainS.sellDivider]}>
                <Text style={brainS.sellName} numberOfLines={1}>{p.name}</Text>
                <Text style={brainS.sellGmv}>${fmtNum(p.gmv)}</Text>
              </View>
            ))}
            {(insights.recommended_categories?.length ?? 0) > 0 && (
              <>
                <Text style={brainS.groupLabel}>Categories to lean into</Text>
                <View style={brainS.tags}>
                  {insights.recommended_categories.slice(0, 6).map((c) => (
                    <View key={c} style={brainS.chip}><Text style={brainS.chipText}>{humanize(c)}</Text></View>
                  ))}
                </View>
              </>
            )}
          </FadeInView>
        )}

        <Text style={pS.footnote}>“Typical creator” = short-form talking-video norms, not a specific account.</Text>

        {/* What this profile powers — the tools that read it before they work */}
        <FadeInView delay={100} style={brainS.powers}>
          <Text style={brainS.powersLabel}>WHAT THIS POWERS</Text>
          {([
            { k: 'scripting', title: 'Scripting', sub: 'Every script written in your voice, at your pace', Icon: Zap, color: D.coral, route: '/(tabs)/scriptiq' },
            { k: 'prompter', title: 'Teleprompter', sub: `Scrolls at your ${speech?.avg_wpm ? Math.round(speech.avg_wpm) + ' wpm' : 'speaking speed'}`, Icon: Clapperboard, color: D.ink, route: '/teleprompter' },
            { k: 'coach', title: 'Rehearsal coach', sub: 'Grades delivery against your own baseline', Icon: Mic, color: '#6C5CE7', route: '/tools/coach' },
            { k: 'pitch', title: 'Sample pitch', sub: 'Pitches brands with your real numbers', Icon: Share2, color: D.limeDeep, route: '/tools/sample-pitch' },
          ] as const).map((r, i, arr) => (
            <AnimatedPressable key={r.k} style={[brainS.powerRow, i === arr.length - 1 && { borderBottomWidth: 0 }]} haptic="light" onPress={() => router.push(r.route as any)}>
              <View style={[brainS.powerIcon, { backgroundColor: r.color }]}><r.Icon size={15} color="#FFF" strokeWidth={2.2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={brainS.powerTitle}>{r.title}</Text>
                <Text style={brainS.powerSub} numberOfLines={1}>{r.sub}</Text>
              </View>
              <ArrowRight size={15} color={D.textDisabled} strokeWidth={2.2} />
            </AnimatedPressable>
          ))}
        </FadeInView>

        {/* CTA */}
        <FadeInView delay={120}>
          <AnimatedPressable style={brainS.cta} haptic="medium" onPress={() => router.push('/(tabs)/scriptiq')}>
            <Text style={brainS.ctaText}>Write a script in your voice</Text>
            <View style={brainS.ctaArrow}><ArrowRight size={16} color="#FFF" strokeWidth={2.5} /></View>
          </AnimatedPressable>
        </FadeInView>


        {analyzeError && (
          <View style={S.errorBox}>
            <Text style={S.errorText}>{analyzeError}</Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── INITIAL LOAD — skeleton while /creators/me is still in flight ─────────
  if (!meData) {
    return (
      <View style={S.root}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} scrollEnabled={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
            <Skeleton height={170} radius={R.xxl} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton height={90} radius={R.xl} style={{ flex: 1 }} />
              <Skeleton height={90} radius={R.xl} style={{ flex: 1 }} />
              <Skeleton height={90} radius={R.xl} style={{ flex: 1 }} />
            </View>
            <Skeleton height={120} radius={R.xxl} />
            <Skeleton height={120} radius={R.xxl} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── EMPTY CTA ─────────────────────────────────────────────────────────────
  return (
    <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

      {/* Pill label */}
      <View style={S.iqPillWrap}>
        <View style={S.iqPill}>
          <View style={S.iqPillDot} />
          <Text style={S.iqPillText}>SCRIPTIQ · CREATOR BRAIN</Text>
        </View>
      </View>

      {/* Title */}
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={S.heroTitle}>
          Train it to sound{'\n'}like <Text style={S.heroTitleItalic}>you.</Text>
        </Text>
        <Text style={S.heroLede}>
          Formula studies how you actually talk on camera, then writes every script in your voice.
        </Text>
      </View>

      {/* Hero CTA — coral gradient card */}
      <View style={S.heroCta}>
        <LinearGradient
          colors={Gradient.hero}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Orb decorations */}
        <View style={S.ctaOrb1} pointerEvents="none" />
        <View style={S.ctaOrb2} pointerEvents="none" />

        {/* Brain icon */}
        <View style={S.heroCtaIcon}>
          <Brain size={30} color="#FFF" strokeWidth={1.8} />
        </View>

        {/* Text */}
        <View style={{ gap: 8 }}>
          <Text style={S.heroCtaTitle}>Build Your Creator Profile</Text>
          <Text style={S.heroCtaSub}>
            Our engine actually <Text style={{ color: '#FFF', fontWeight: '700' }}>watches your videos</Text>
            {' '}— footage, delivery, timing and all — then learns your voice so every rewrite sounds exactly like you.
          </Text>
        </View>

        {/* Error */}
        {analyzeError && (
          <View style={S.heroCtaError}>
            <Text style={S.heroCtaErrorText}>{analyzeError}</Text>
          </View>
        )}

        {/* Button */}
        <AnimatedPressable
          style={[S.heroCtaBtn, analyzeLoading && { opacity: 0.6 }]}
          onPress={handleAnalyze}
          disabled={analyzeLoading}
          haptic="medium"
        >
          {analyzeLoading
            ? <ActivityIndicator color={D.coral} size="small" />
            : (
              <>
                <Brain size={17} color={D.coral} strokeWidth={2.5} />
                <Text style={S.heroCtaBtnText}>Analyze My Content</Text>
              </>
            )
          }
        </AnimatedPressable>
      </View>

      {/* Differentiator — "Formula Watches Your Video" */}
      <View style={S.ingestCard}>
        <View style={S.ingestAccent} />
        <View style={S.ingestIcon}>
          <Activity size={18} color={D.limeDeep} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={S.ingestTitle}>Formula Watches Your Video</Text>
          <Text style={S.ingestSub}>
            Not captions or metadata. Formula plays your footage frame-by-frame — visuals, pacing, and
            how you speak — so the output is genuinely yours, not a guess.
          </Text>
        </View>
      </View>

      {/* What we analyze */}
      <View>
        <Text style={S.analyzeLabel}>What we analyze</Text>
        <View style={S.featureCard}>
          {[
            { icon: <Film size={16} color={D.coral} strokeWidth={2} />, text: 'Plays your recent videos in full', bg: D.coralSubtle },
            { icon: <Activity size={16} color={D.cyan} strokeWidth={2} />, text: 'Detects hook patterns and pacing rhythms', bg: D.cyanSubtle },
            { icon: <Mic size={16} color={D.warning} strokeWidth={2} />, text: 'Maps your energy level and speaking pace', bg: D.warningSubtle },
            { icon: <Brain size={16} color={D.limeDeep} strokeWidth={2} />, text: 'Builds a personalized model of your voice', bg: D.limeSubtle },
          ].map((item, i, arr) => (
            <View key={i} style={[S.featureRow, i < arr.length - 1 && S.featureRowBorder]}>
              <View style={[S.featureIcon, { backgroundColor: item.bg }]}>{item.icon}</View>
              <Text style={S.featureText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingBottom: 60 },

  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
  },
  hdrTitle: { ...T.bold, fontSize: 26, color: D.textPrimary, letterSpacing: -0.6 },

  reanalyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: D.coral, paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.full,
  },
  reanalyzeBtnText: { ...T.medium, fontSize: 13, color: '#FFFFFF' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  emptyTitle: { ...T.bold, fontSize: 20, color: D.textPrimary, textAlign: 'center', marginTop: 8 },
  emptySub: { ...T.regular, fontSize: 14, color: D.textSecondary, textAlign: 'center', lineHeight: 22 },

  analyzeCard: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: D.card, borderRadius: R.xxl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 28, gap: 20, ...Shadow.card,
  },
  analyzeCenter: { alignItems: 'center', gap: 14 },
  analyzeHandle: { ...T.bold, fontSize: 20, color: D.textPrimary, letterSpacing: -0.3 },
  analyzePhase: { ...T.regular, fontSize: 14, color: D.textSecondary },
  analyzeReassure: { ...T.regular, fontSize: 12.5, color: D.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 10, paddingHorizontal: 8 },
  progressSection: { gap: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPct: { ...T.medium, fontSize: 12, color: D.textMuted },
  progressPhase: { ...T.medium, fontSize: 12, color: D.coral },
  checkNowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: R.full,
    borderWidth: 1, borderColor: D.coral + '30', backgroundColor: D.coralSubtle,
  },
  checkNowText: { ...T.medium, fontSize: 13, color: D.coral },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7, paddingHorizontal: 20 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: D.successSubtle, borderColor: D.successBorder },
  stepInner: { width: 7, height: 7, borderRadius: 4, backgroundColor: D.textDisabled },
  stepText: { ...T.regular, fontSize: 14, color: D.textMuted },
  stepTextDone: { color: D.textPrimary },

  // Hero card — full gradient, avatar inline
  heroCard: {
    marginHorizontal: 16, marginBottom: 12, overflow: 'hidden',
    borderRadius: R.xxl, padding: 20,
    ...Shadow.card,
  },
  heroRadial: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    top: -100, right: -90,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  heroRow: { flexDirection: 'column', alignItems: 'center', gap: 14 },

  heroAvatarRing: {
    width: 90, height: 90, borderRadius: 45,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.75)',
    flexShrink: 0,
  },
  heroAvatarFrame: { flex: 1, borderRadius: 42, overflow: 'hidden' },
  heroAvatarImg: { width: '100%', height: '100%' },
  heroAvatarFallback: {
    width: '100%', height: '100%',
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvatarLetter: { ...T.bold, fontSize: 30, color: '#FFF' },

  heroIdentity: { alignSelf: 'stretch', alignItems: 'center' },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'nowrap' },
  heroName: { ...T.bold, fontSize: 20, color: '#FFF', letterSpacing: -0.5, flexShrink: 1, textAlign: 'center' },
  heroHandleText: { ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 4, textAlign: 'center' },
  heroNicheRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 11,
  },
  heroNichePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)',
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: R.full,
  },
  heroNicheDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.lime },
  heroNicheText: { ...T.bold, fontSize: 12, color: '#FFF', letterSpacing: 0.2 },

  heroBio: { ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 20, marginTop: 16, textAlign: 'center' },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.24)', marginTop: 18 },
  heroStats: { flexDirection: 'row', paddingTop: 16 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.24)', marginVertical: 4 },

  // Your Shop link card
  shopLink: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder,
    paddingVertical: 14, paddingHorizontal: 16,
    ...Shadow.soft,
  },
  shopLinkIcon: {
    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
    backgroundColor: D.coralSubtle,
    borderWidth: 1, borderColor: D.coral + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  shopLinkTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  shopLinkSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 2 },

  // How the brain works card
  howCard: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: D.card, borderRadius: R.xxl,
    borderWidth: 1, borderColor: D.cardBorder,
    padding: 18, overflow: 'hidden',
    ...Shadow.soft,
  },
  howAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: D.coral,
  },
  howTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  howIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: D.coralSubtle,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  howTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  howBody: {
    ...T.regular, fontSize: 13, color: D.textSecondary,
    lineHeight: 20, marginBottom: 14,
  },
  howPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  howPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: R.full,
    backgroundColor: D.coralSubtle,
    borderWidth: 1, borderColor: D.coral + '28',
  },
  howPillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: D.coral },
  howPillText: { ...T.medium, fontSize: 12, color: D.coral },

  // Section card
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: D.card, borderRadius: R.xxl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 20, ...Shadow.soft,
  },

  // Chip sections
  chips: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 7, columnGap: 7 },
  chipSection: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: D.divider, gap: 10 },
  chipLabel: { ...T.bold, ...SectionLabelStyle },

  // Tile row
  tileRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },

  summaryText: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 22, marginBottom: 10 },
  errorBox: { marginHorizontal: 20, marginBottom: 16, backgroundColor: D.errorSubtle, borderRadius: R.lg, padding: 14, borderWidth: 1, borderColor: D.errorBorder },
  errorText: { ...T.regular, fontSize: 13, color: D.error },

  // CTA / empty state — OLD (kept for analyze/failed views)
  analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 15 },
  analyzeBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },

  // ── New empty-state CTA design ────────────────────────────────────────────

  iqPillWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  iqPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: R.full,
    backgroundColor: D.coralSubtle,
    borderWidth: 1, borderColor: D.coral + '33',
  },
  iqPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.coral },
  iqPillText: { ...T.bold, fontSize: 11, color: D.coral, letterSpacing: 0.5 },

  heroTitle: {
    ...T.bold, fontSize: 34, color: D.textPrimary,
    letterSpacing: -0.8, lineHeight: 38, marginTop: 14,
  },
  heroTitleItalic: {
    fontStyle: 'italic',
  },
  heroLede: {
    ...T.regular, fontSize: 15, color: D.textSecondary,
    lineHeight: 22, marginTop: 12, maxWidth: 300,
  },

  heroCta: {
    marginHorizontal: 20, marginTop: 22, marginBottom: 14,
    borderRadius: 28, overflow: 'hidden',
    padding: 24, gap: 18,
    ...Shadow.coral,
  },
  ctaOrb1: {
    position: 'absolute', width: 230, height: 230, borderRadius: 115,
    top: -86, right: -66, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  ctaOrb2: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    bottom: -58, left: -40, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroCtaIcon: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroCtaTitle: { ...T.bold, fontSize: 22, color: '#FFF', letterSpacing: -0.4, lineHeight: 26 },
  heroCtaSub: { ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.86)', lineHeight: 21 },
  heroCtaError: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: R.lg, padding: 12,
  },
  heroCtaErrorText: { ...T.regular, fontSize: 13, color: '#FFF' },
  heroCtaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: R.full, paddingVertical: 15,
    shadowColor: '#780014',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  heroCtaBtnText: { ...T.bold, fontSize: 15, color: D.coral, letterSpacing: -0.2 },

  ingestCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginHorizontal: 20, marginBottom: 6,
    backgroundColor: D.card, borderRadius: 20,
    borderWidth: 1, borderColor: D.border,
    paddingVertical: 16, paddingRight: 16, paddingLeft: 20,
    overflow: 'hidden',
    ...Shadow.soft,
  },
  ingestAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: D.lime,
  },
  ingestIcon: {
    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
    backgroundColor: D.limeSubtle,
    borderWidth: 1, borderColor: 'rgba(47,161,12,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  ingestTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  ingestSub: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 19, marginTop: 2 },

  analyzeLabel: {
    ...T.bold, ...SectionLabelStyle,
    marginHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  featureCard: {
    marginHorizontal: 20,
    backgroundColor: D.card, borderRadius: 22,
    borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 16, paddingVertical: 4,
    ...Shadow.soft,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: D.divider },
  featureIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureText: { ...T.regular, fontSize: 14, color: D.textSecondary, flex: 1 },
});

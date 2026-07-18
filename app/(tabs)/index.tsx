import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Image, Animated, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { api, extractData } from '@/lib/api';
import { CREDIT_COSTS } from '@/lib/iap/catalog';
import { RunData, AnalyzeResponse, CreatorMeData, SpeechTemplate, PacingTemplate, ProductInsights, VideoStyleProfile } from '@/types/api';
import { D, T, R, Shadow, Ease, Gradient, SectionLabelStyle } from '@/constants/ds';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Skeleton } from '@/components/Skeleton';
import {
  Brain, Mic, Film, Activity,
  CheckCircle, RefreshCw, AlertCircle,
  Clapperboard, ShoppingBag, Copy, Check, Zap,
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
  'Building your brain model',
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

export default function BrainScreen() {
  const { meData, profile, refreshMe, credits } = useAuth();
  const router = useRouter();
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
    if (hasBrain && credits < CREDIT_COSTS.brainRefresh) {
      Alert.alert(
        'Not enough credits',
        `Refreshing your brain costs ${CREDIT_COSTS.brainRefresh} credits — you have ${credits}.`,
        [
          { text: 'Get credits', onPress: () => router.push('/(tabs)/profile') },
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
        <View style={S.hdr}><Text style={S.hdrTitle}>My Brain</Text></View>
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

        {/* Hero card */}
        <FadeInView style={[S.heroCard, { marginTop: 14 }]}>
          <LinearGradient
            colors={Gradient.hero}
            start={{ x: 0.13, y: 0 }}
            end={{ x: 0.87, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Radial white highlight top-right */}
          <View style={S.heroRadial} pointerEvents="none" />

          {/* Avatar + Identity row */}
          <View style={S.heroRow}>
            <View style={S.heroAvatarRing}>
              <View style={S.heroAvatarFrame}>
                {profile.avatar_url
                  ? <Image source={{ uri: profile.avatar_url }} style={S.heroAvatarImg} />
                  : (
                    <View style={S.heroAvatarFallback}>
                      <Text style={S.heroAvatarLetter}>{(profile.handle[0] ?? 'C').toUpperCase()}</Text>
                    </View>
                  )
                }
              </View>
            </View>
            <View style={S.heroIdentity}>
              <View style={S.heroNameRow}>
                <Text style={S.heroName} numberOfLines={1}>
                  {profile.display_name ?? `@${profile.handle}`}
                </Text>
                <VerifiedSeal />
              </View>
              {profile.display_name && (
                <Text style={S.heroHandleText}>@{profile.handle}</Text>
              )}
              {(profile.niche?.length ?? 0) > 0 && (
                <View style={S.heroNicheRow}>
                  {profile.niche!.map((n, i) => (
                    <View key={i} style={S.heroNichePill}>
                      <View style={S.heroNicheDot} />
                      <Text style={S.heroNicheText}>{n}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {profile.bio && <Text style={S.heroBio}>{profile.bio}</Text>}
          <View style={S.heroDivider} />
          <View style={S.heroStats}>
            <HeroStat value={fmtNum(profile.follower_count)} label="Followers" />
            <View style={S.heroStatDivider} />
            <HeroStat value={fmtNum(profile.video_count)} label="Videos" />
          </View>
        </FadeInView>

        {/* How the brain works */}
        <FadeInView delay={30} style={S.howCard}>
          <View style={S.howAccent} />
          <View style={S.howTop}>
            <View style={S.howIconWrap}>
              <Brain size={18} color={D.coral} strokeWidth={1.8} />
            </View>
            <Text style={S.howTitle}>How Your Brain Was Built</Text>
          </View>
          <Text style={S.howBody}>
            Formula didn't just read your captions — it actually watched your videos. Frame by frame, it studied your delivery, your pacing, how you open, where you pause, and what hooks land. It looked for patterns across your content and used them to build a model that writes in your voice, not a generic one.
          </Text>
          <View style={S.howPills}>
            {['Watched your footage', 'Mapped your hooks', 'Learned your pacing', 'Built your voice model'].map((t) => (
              <View key={t} style={S.howPill}>
                <View style={S.howPillDot} />
                <Text style={S.howPillText}>{t}</Text>
              </View>
            ))}
          </View>
        </FadeInView>

        {/* Brain Summary */}
        {(profile.energy_level != null || profile.authenticity_score != null
          || (profile.top_hook_types?.length ?? 0) > 0
          || (profile.top_performing_formats?.length ?? 0) > 0) && (
          <SectionCard delay={50}>
            <CardHead icon={<SummaryIcon color="#FFF" />} title="Brain Summary" sub="Your on-camera fingerprint" />

            {profile.energy_level != null && (
              <GradientMeter
                label="Energy"
                value={profile.energy_level}
                fromColor="#FF5E7A"
                toColor={D.coral}
                textColor={D.coral}
              />
            )}
            {profile.authenticity_score != null && (
              <GradientMeter
                label="Authenticity"
                value={profile.authenticity_score}
                fromColor="#7BE06A"
                toColor={D.limeDeep}
                textColor={D.limeDeep}
              />
            )}
            {(profile.energy_level != null || profile.authenticity_score != null) && (
              <Explainer text="The AI uses these scores to calibrate how punchy vs. conversational your scripts feel — high energy gets fast hooks, high authenticity keeps the language raw and real." />
            )}

            {(profile.niche?.length ?? 0) > 0 && (
              <View style={S.chipSection}>
                <Text style={S.chipLabel}>Niche</Text>
                <View style={S.chips}>
                  {profile.niche!.map((n, i) => <Chip key={i} label={n} color={D.coral} />)}
                </View>
                <Explainer text="Your niche filters which product angles, pain points, and audiences the AI leans into when writing. Scripts outside your niche will still work — the AI just defaults to what fits you." />
              </View>
            )}

            {(profile.top_hook_types?.length ?? 0) > 0 && (
              <View style={S.chipSection}>
                <Text style={S.chipLabel}>Top hook types</Text>
                <View style={S.chips}>
                  {profile.top_hook_types!.map((h, i) => <InkChip key={i} label={h} />)}
                </View>
                <Explainer text="These are your proven openers — the ones that actually appear in your content. Every script Formula writes will open with one of these patterns because that's what already works for you." />
              </View>
            )}

            {(profile.top_performing_formats?.length ?? 0) > 0 && (
              <View style={S.chipSection}>
                <Text style={S.chipLabel}>Top formats</Text>
                <View style={S.chips}>
                  {profile.top_performing_formats!.map((f, i) => <Chip key={i} label={f} color={D.coral} />)}
                </View>
                <Explainer text="The AI structures your scripts around these formats first. A talking head creator gets a different script shape than someone who does demo-first or voiceover content." />
              </View>
            )}
          </SectionCard>
        )}

        {speech && <SpeechSection t={speech} delay={90} />}
        {pacing && <PacingSection t={pacing} delay={130} />}
        {insights && <ProductInsightsSection p={insights} delay={170} />}
        {styleProfile && <VideoStyleSection s={styleProfile} delay={210} />}

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
          <Text style={S.heroCtaTitle}>Build Your Creator Brain</Text>
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
            { icon: <Brain size={16} color={D.limeDeep} strokeWidth={2} />, text: 'Builds a personalized rewrite brain model', bg: D.limeSubtle },
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

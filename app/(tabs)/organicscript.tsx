import { useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Animated, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import {
  VideoStyle, ContentTone, OrganicScriptBody, OrganicScriptResult, OrganicScriptOption,
} from '@/types/api';
import { D, T, R, Shadow, Ease, SectionLabelStyle } from '@/constants/ds';
import {
  Sparkles, Copy, Check, ChevronDown, Zap,
  Mic, Camera, MessageSquare, Save, AlertTriangle,
  ArrowLeft, RefreshCw, User, Info,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import NoCreditsModal from '@/components/NoCreditsModal';
import { CREDIT_COSTS, usesLabel } from '@/lib/iap/catalog';
import AnimatedPressable from '@/components/AnimatedPressable';
import AfterSaveRow from '@/components/AfterSaveRow';
import { haptic } from '@/lib/haptics';

// ── Video style / tone config ──────────────────────────────────────────────

const VIDEO_STYLES: { id: VideoStyle; label: string; sub: string }[] = [
  { id: 'talking_head', label: 'Talking Head', sub: 'Face to camera' },
  { id: 'skit',         label: 'Skit',         sub: 'Acted dialogue' },
  { id: 'faceless',     label: 'Faceless',      sub: 'Voiceover + shots' },
];

const CONTENT_TONES: { id: ContentTone; label: string; sub: string }[] = [
  { id: 'educational', label: 'Educational', sub: 'Teach & inform' },
  { id: 'funny',       label: 'Funny',       sub: 'Humor & energy' },
  { id: 'serious',     label: 'Serious',     sub: 'Earnest & direct' },
];

// ── Progress bar ───────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { label: 'Reading your brain voice...', pct: 0.15, duration: 4000 },
  { label: 'Finding the right angle...', pct: 0.35, duration: 7000 },
  { label: 'Writing hook variations...', pct: 0.55, duration: 9000 },
  { label: 'Crafting body & CTA...', pct: 0.75, duration: 8000 },
  { label: 'Polishing all three scripts...', pct: 0.92, duration: 10000 },
];

function GeneratingProgress({ visible }: { visible: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setStepIdx(0);
      progress.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      let idx = 0;
      const advance = () => {
        if (idx >= PROGRESS_STEPS.length) return;
        const step = PROGRESS_STEPS[idx];
        Animated.timing(progress, { toValue: step.pct, duration: step.duration, easing: Ease.linear, useNativeDriver: false }).start();
        setStepIdx(idx);
        idx += 1;
        timerRef.current = setTimeout(advance, step.duration);
      };
      advance();
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      Animated.timing(progress, { toValue: 1, duration: 400, easing: Ease.linear, useNativeDriver: false }).start();
      setTimeout(() => { Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(); }, 500);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible]);

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const currentStep = PROGRESS_STEPS[Math.min(stepIdx, PROGRESS_STEPS.length - 1)];

  return (
    <Animated.View style={[PG.wrap, { opacity }]}>
      <View style={PG.topRow}>
        <View style={PG.dot} />
        <Text style={PG.stepLabel}>{currentStep.label}</Text>
        <Text style={PG.pctLabel}>{Math.round((PROGRESS_STEPS[stepIdx]?.pct ?? 0.92) * 100)}%</Text>
      </View>
      <View style={PG.track}>
        <Animated.View style={[PG.fill, { width: barWidth as any }]} />
      </View>
      <Text style={PG.hint}>Usually takes 30–60 seconds.</Text>
    </Animated.View>
  );
}

const PG = StyleSheet.create({
  wrap: {
    marginHorizontal: 20, marginBottom: 16, padding: 16,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, ...Shadow.soft,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.limeDeep, flexShrink: 0 },
  stepLabel: { flex: 1, ...T.medium, fontSize: 13, color: D.textPrimary },
  pctLabel: { ...T.bold, fontSize: 12, color: D.limeDeep },
  track: { height: 6, borderRadius: 3, backgroundColor: D.surface, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: D.limeDeep },
  hint: { ...T.regular, fontSize: 11, color: D.textMuted, textAlign: 'center' },
});

// ── Segment picker ─────────────────────────────────────────────────────────

function SegmentPicker<T extends string>({
  options, value, onChange,
}: {
  options: { id: T; label: string; sub: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={SP.row}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[SP.btn, active && SP.btnActive]}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.8}
          >
            <Text style={[SP.label, active && SP.labelActive]}>{opt.label}</Text>
            <Text style={[SP.sub, active && SP.subActive]}>{opt.sub}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const SP = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, paddingVertical: 11, paddingHorizontal: 10, borderRadius: R.md,
    backgroundColor: D.surface, borderWidth: 1.5, borderColor: D.border,
    alignItems: 'center',
  },
  btnActive: { backgroundColor: D.greenSubtle, borderColor: D.limeDeep },
  label: { ...T.bold, fontSize: 12, color: D.textMuted, marginBottom: 2 },
  labelActive: { color: D.limeDeep },
  sub: { ...T.regular, fontSize: 10, color: D.textDisabled, textAlign: 'center' },
  subActive: { color: D.limeDeep + 'AA' },
});

// ── Voice strip ────────────────────────────────────────────────────────────

function VoiceStrip({ voiceUsed, genderUsed }: {
  voiceUsed: { tone: string; sentence_style: string; sample_voice: string } | null;
  genderUsed: string;
}) {
  const chips = [
    voiceUsed?.tone     ? { icon: <Mic size={11} color={D.textMuted} strokeWidth={2} />, label: voiceUsed.tone } : null,
    genderUsed && genderUsed !== 'unspecified'
      ? { icon: <User size={11} color={D.textMuted} strokeWidth={2} />, label: genderUsed } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  if (!chips.length) return null;

  return (
    <View style={VM.row}>
      <Text style={VM.label}>YOUR VOICE</Text>
      {chips.map((c, i) => (
        <View key={i} style={VM.chip}>
          {c.icon}
          <Text style={VM.chipText}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const VM = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  label: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: D.surface, borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: D.border,
  },
  chipText: { ...T.medium, fontSize: 11, color: D.textSecondary },
});

// ── Option card ────────────────────────────────────────────────────────────

function OptionCard({
  option, index, videoStyle,
}: {
  option: OrganicScriptOption;
  index: number;
  videoStyle: VideoStyle;
}) {
  const [copied, setCopied]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [expanded, setExpanded]       = useState(true);
  const [showHookAnalysis, setShowHA] = useState(false);
  const queryClient = useQueryClient();

  const handleCopy = () => {
    void Clipboard.setStringAsync(option.full_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      const res = await api.post('/creators/scripts', {
        option,
        title: option.label,
        origin: 'organic_script',
      });
      setSaved(true);
      setSavedId(extractData<{ script?: { id?: string } }>(res)?.script?.id ?? null);
      queryClient.invalidateQueries({ queryKey: ['saved-scripts'] });
    } catch (err: any) {
      haptic.error();
      Alert.alert('Couldn’t save script', err?.response?.data?.error?.message ?? err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isSkit     = videoStyle === 'skit';
  const isFaceless = videoStyle === 'faceless';

  return (
    <FadeInView delay={index * 90} duration={400} direction="down" style={OC.card}>
      {/* Header */}
      <TouchableOpacity style={OC.hdr} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={OC.labelRow}>
          <View style={[OC.numBadge, index === 0 && OC.numBadgePrimary]}>
            <Text style={[OC.numText, index === 0 && OC.numTextPrimary]}>{index + 1}</Text>
          </View>
          <Text style={OC.labelText} numberOfLines={1}>{option.label}</Text>
        </View>
        <View style={OC.hdrRight}>
          {option.estimated_length ? (
            <View style={OC.lengthPill}>
              <Text style={OC.lengthText}>{option.estimated_length}</Text>
            </View>
          ) : null}
          <View style={[OC.chevron, expanded && OC.chevronOpen]}>
            <ChevronDown size={15} color={D.textMuted} strokeWidth={2} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Hook — always visible */}
      {option.hook ? (
        <View style={OC.hookRow}>
          <Text style={OC.hookLabel}>HOOK</Text>
          <Text style={OC.hookText}>"{option.hook}"</Text>
          {option.hook_analysis?.why_it_works ? (
            <TouchableOpacity
              style={OC.hookAnalysisToggle}
              onPress={() => setShowHA((v) => !v)}
              activeOpacity={0.8}
            >
              <Info size={11} color={D.limeDeep} strokeWidth={2} />
              <Text style={OC.hookAnalysisToggleText}>
                {showHookAnalysis ? 'Hide analysis' : 'Why it works'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showHookAnalysis && option.hook_analysis ? (
            <FadeInView duration={200} direction="none">
              {option.hook_analysis.why_it_works ? (
                <Text style={OC.hookAnalysisText}>{option.hook_analysis.why_it_works}</Text>
              ) : null}
              {option.hook_analysis.psychology ? (
                <View style={OC.psychRow}>
                  <Text style={OC.psychLabel}>PSYCHOLOGY</Text>
                  <Text style={OC.psychText}>{option.hook_analysis.psychology}</Text>
                </View>
              ) : null}
            </FadeInView>
          ) : null}
        </View>
      ) : null}

      {/* Expanded body */}
      {expanded ? (
        <FadeInView duration={200} direction="none">
          <View style={OC.divider} />

          {/* Body lines — talking head + faceless */}
          {!isSkit && (option.body?.length ?? 0) > 0 ? (
            <View style={OC.section}>
              {isFaceless ? (
                <View style={OC.sectionHdrRow}>
                  <Mic size={11} color={D.textMuted} strokeWidth={2} />
                  <Text style={OC.sectionHdrText}>VOICEOVER</Text>
                </View>
              ) : null}
              {option.body.map((line, i) => (
                <Text key={i} style={OC.bodyLine}>{line}</Text>
              ))}
            </View>
          ) : null}

          {/* Dialogue — skit */}
          {isSkit && (option.dialogue?.length ?? 0) > 0 ? (
            <View style={OC.section}>
              <View style={OC.sectionHdrRow}>
                <MessageSquare size={11} color={D.textMuted} strokeWidth={2} />
                <Text style={OC.sectionHdrText}>DIALOGUE</Text>
              </View>
              {option.dialogue.map((dl, i) => (
                <View key={i} style={OC.dialogueLine}>
                  <Text style={OC.dialogueSpeaker}>{dl.speaker}</Text>
                  <Text style={OC.dialogueText}>{dl.line}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Shot list — faceless */}
          {isFaceless && (option.shot_list?.length ?? 0) > 0 ? (
            <View style={OC.section}>
              <View style={OC.sectionHdrRow}>
                <Camera size={11} color={D.textMuted} strokeWidth={2} />
                <Text style={OC.sectionHdrText}>SHOT LIST</Text>
              </View>
              {option.shot_list.map((shot, i) => (
                <View key={i} style={OC.shotRow}>
                  <View style={OC.shotNum}>
                    <Text style={OC.shotNumText}>{i + 1}</Text>
                  </View>
                  <Text style={OC.shotText}>{shot}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* CTA */}
          {option.cta ? (
            <View style={OC.ctaRow}>
              <Text style={OC.ctaLabel}>CTA</Text>
              <Text style={OC.ctaText}>{option.cta}</Text>
            </View>
          ) : null}

          {/* Why this works */}
          {option.why_this_works ? (
            <View style={OC.whyRow}>
              <Zap size={12} color={D.limeDeep} strokeWidth={2} />
              <Text style={OC.whyText}>{option.why_this_works}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={OC.actions}>
            <AnimatedPressable style={OC.copyBtn} onPress={handleCopy} haptic="selection">
              {copied
                ? <><Check size={14} color={D.success} strokeWidth={2.5} /><Text style={[OC.actionText, { color: D.success }]}>Copied!</Text></>
                : <><Copy size={14} color={D.textMuted} strokeWidth={2} /><Text style={OC.actionText}>Copy script</Text></>
              }
            </AnimatedPressable>
            <AnimatedPressable
              style={[OC.saveBtn, saved && OC.saveBtnDone]}
              onPress={handleSave}
              disabled={saved || saving}
              haptic="success"
            >
              {saving ? (
                <ActivityIndicator size="small" color={D.limeDeep} />
              ) : saved ? (
                <><Check size={13} color={D.success} strokeWidth={2.5} /><Text style={[OC.saveBtnText, { color: D.success }]}>Saved</Text></>
              ) : (
                <><Save size={13} color={D.limeDeep} strokeWidth={2} /><Text style={OC.saveBtnText}>Save</Text></>
              )}
            </AnimatedPressable>
          </View>
          {saved && savedId ? <AfterSaveRow scriptId={savedId} /> : null}
        </FadeInView>
      ) : null}
    </FadeInView>
  );
}

const OC = StyleSheet.create({
  card: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16,
    marginBottom: 10, ...Shadow.soft,
  },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  numBadge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  numBadgePrimary: { backgroundColor: D.limeDeep, borderColor: D.limeDeep },
  numText: { ...T.bold, fontSize: 12, color: D.textMuted },
  numTextPrimary: { color: '#FFF' },
  labelText: { ...T.bold, fontSize: 14, color: D.textPrimary, flex: 1 },
  hdrRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lengthPill: {
    backgroundColor: D.surface, borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: D.border,
  },
  lengthText: { ...T.regular, fontSize: 10, color: D.textMuted },
  chevron: {},
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  hookRow: {
    marginTop: 12, backgroundColor: D.limeDeep + '0F',
    borderRadius: R.sm, padding: 12, borderLeftWidth: 3, borderLeftColor: D.limeDeep,
  },
  hookLabel: { ...T.bold, fontSize: 10, color: D.limeDeep, letterSpacing: 1.2, marginBottom: 5 },
  hookText: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 21, fontStyle: 'italic' },
  hookAnalysisToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  hookAnalysisToggleText: { ...T.medium, fontSize: 11, color: D.limeDeep },
  hookAnalysis: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: D.successBorder, gap: 8,
  },
  hookAnalysisText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },
  psychRow: { gap: 3 },
  psychLabel: { ...T.bold, fontSize: 10, color: D.limeDeep, letterSpacing: 1.2, opacity: 0.7 },
  psychText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },

  divider: { height: 1, backgroundColor: D.divider, marginVertical: 14 },
  section: { marginBottom: 14, gap: 6 },
  sectionHdrRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  sectionHdrText: { ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 1.2 },
  bodyLine: { ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 23 },
  dialogueLine: {
    flexDirection: 'row', gap: 10, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  dialogueSpeaker: { ...T.bold, fontSize: 12, color: D.limeDeep, width: 68, flexShrink: 0, marginTop: 1 },
  dialogueText: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 22 },
  shotRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  shotNum: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  shotNumText: { ...T.bold, fontSize: 10, color: D.textMuted },
  shotText: { flex: 1, ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 20 },

  ctaRow: { backgroundColor: D.inkCard, borderRadius: R.md, padding: 12, marginBottom: 12 },
  ctaLabel: { ...T.bold, fontSize: 9, color: D.lime, letterSpacing: 1.2, marginBottom: 4 },
  ctaText: { ...T.medium, fontSize: 13, color: '#FFF', lineHeight: 20 },

  whyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: D.limeSubtle, borderRadius: R.sm, padding: 10, marginBottom: 14,
  },
  whyText: { flex: 1, ...T.regular, fontSize: 12, color: D.limeDeep, lineHeight: 18, marginTop: 1 },

  actions: {
    flexDirection: 'row', gap: 10,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: D.divider,
  },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: R.md,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
  },
  actionText: { ...T.medium, fontSize: 13, color: D.textMuted },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: R.md,
    backgroundColor: D.greenSubtle, borderWidth: 1, borderColor: D.successBorder,
    minHeight: 40,
  },
  saveBtnDone: { backgroundColor: D.successSubtle, borderColor: D.successBorder },
  saveBtnText: { ...T.bold, fontSize: 13, color: D.limeDeep },
});

// ── Result header banner ───────────────────────────────────────────────────

function ResultBanner({
  topic, result, onBack, onRegenerate, isPending,
}: {
  topic: string;
  result: OrganicScriptResult;
  onBack: () => void;
  onRegenerate: () => void;
  isPending: boolean;
}) {
  return (
    <View style={RB.root}>
      <View style={RB.topRow}>
        <TouchableOpacity style={RB.backBtn} onPress={onBack} activeOpacity={0.75} hitSlop={8}>
          <ArrowLeft size={16} color={D.textMuted} strokeWidth={2} />
          <Text style={RB.backText}>Edit</Text>
        </TouchableOpacity>
        <AnimatedPressable style={RB.regenBtn} onPress={onRegenerate} disabled={isPending} haptic="selection">
          {isPending
            ? <ActivityIndicator size="small" color={D.limeDeep} />
            : <><RefreshCw size={13} color={D.limeDeep} strokeWidth={2} /><Text style={RB.regenText}>Regenerate</Text></>
          }
        </AnimatedPressable>
      </View>
      <View style={RB.card}>
        <View style={RB.row}>
          <View style={RB.iconBox}>
            <Sparkles size={14} color="rgba(255,255,255,0.60)" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={RB.rowLabel}>Organic content · Top-of-funnel</Text>
            <Text style={RB.rowValue} numberOfLines={2}>{topic}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const RB = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 16, backgroundColor: D.bg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  backText: { ...T.medium, fontSize: 13, color: D.textMuted },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full,
    backgroundColor: D.greenSubtle, borderWidth: 1, borderColor: D.successBorder,
    minWidth: 120, justifyContent: 'center',
  },
  regenText: { ...T.medium, fontSize: 13, color: D.limeDeep },
  card: {
    backgroundColor: D.inkCard, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.inkCardBorder, padding: 16, ...Shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(182,255,138,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowLabel: { ...T.regular, fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: 0.3, marginBottom: 2 },
  rowValue: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});

// ── Main screen ────────────────────────────────────────────────────────────

export default function OrganicScriptScreen() {
  const { credits, canAfford, refreshMe } = useAuth();
  const [showNoCredits, setShowNoCredits] = useState(false);
  const { topic: prefillTopic } = useLocalSearchParams<{ topic?: string }>();
  const [topic, setTopic]               = useState(prefillTopic ?? '');
  const [videoStyle, setVideoStyle]     = useState<VideoStyle | null>(null);
  const [contentTone, setContentTone]   = useState<ContentTone | null>(null);
  const [direction, setDirection]       = useState('');
  const [result, setResult]             = useState<OrganicScriptResult | null>(null);
  const [view, setView]                 = useState<'input' | 'result'>('input');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!videoStyle || !contentTone || !topic.trim()) throw new Error('Fill in all required fields');
      const body: OrganicScriptBody = {
        video_style: videoStyle,
        content_tone: contentTone,
        topic: topic.trim(),
        ...(direction.trim() ? { direction: direction.trim() } : {}),
      };
      const res = await api.post('/creators/organic-script', body, { timeout: 300_000 });
      return extractData<OrganicScriptResult>(res);
    },
    onSuccess: (data) => {
      if (data) { setResult(data); setView('result'); refreshMe(); }
    },
  });

  const canSubmit = topic.trim().length > 0 && videoStyle != null && contentTone != null && !mutation.isPending;

  const handleBack = () => {
    setView('input');
    mutation.reset();
  };

  const reset = (field: string) => {
    if (field !== 'topic') { setResult(null); mutation.reset(); }
  };

  // ── RESULT VIEW ────────────────────────────────────────────────────────
  if (view === 'result' && result) {
    return (
      <View style={S.root}>
        <ResultBanner
          topic={result.topic ?? topic}
          result={result}
          onBack={handleBack}
          onRegenerate={() => { if (!canAfford(CREDIT_COSTS.script)) { setShowNoCredits(true); return; } mutation.mutate(); }}
          isPending={mutation.isPending}
        />
        <ScrollView contentContainerStyle={S.resultScroll} showsVerticalScrollIndicator={false}>
          {result.voiceUsed && (
            <VoiceStrip voiceUsed={result.voiceUsed} genderUsed={result.genderUsed} />
          )}

          <Text style={S.sectionHeading}>YOUR SCRIPTS</Text>
          {result.options.map((opt, i) => (
            <OptionCard key={i} option={opt} index={i} videoStyle={result.videoStyle} />
          ))}

          <View style={{ height: 80 }} />
        </ScrollView>

        {mutation.isPending && (
          <View style={S.regenOverlay}>
            <GeneratingProgress visible={true} />
          </View>
        )}
      </View>
    );
  }

  // ── INPUT VIEW ──────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <ScrollView
        contentContainerStyle={S.inputScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={S.hdr}>
          <View style={{ flex: 1 }}>
            <Text style={S.hdrTitle}>Organic Scripts</Text>
            <Text style={S.hdrSub}>Top-of-funnel content written in your voice.</Text>
          </View>
          <View style={S.hdrIcon}>
            <Sparkles size={18} color={D.limeDeep} strokeWidth={2} />
          </View>
        </View>

        {/* Topic */}
        <FadeInView delay={0} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>TOPIC OR IDEA <Text style={S.reqStar}>*</Text></Text>
          <TextInput
            style={S.topicInput}
            placeholder="e.g. morning routines for busy parents, why I quit coffee, 5 things I wish I knew..."
            placeholderTextColor={D.textDisabled}
            value={topic}
            onChangeText={(t) => { setTopic(t); reset('topic'); }}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </FadeInView>

        {/* Video style */}
        <FadeInView delay={60} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>VIDEO TYPE <Text style={S.reqStar}>*</Text></Text>
          <SegmentPicker
            options={VIDEO_STYLES}
            value={videoStyle}
            onChange={(v) => { setVideoStyle(v); reset('style'); }}
          />
        </FadeInView>

        {/* Content tone */}
        <FadeInView delay={120} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>CONTENT TONE <Text style={S.reqStar}>*</Text></Text>
          <SegmentPicker
            options={CONTENT_TONES}
            value={contentTone}
            onChange={(v) => { setContentTone(v); reset('tone'); }}
          />
        </FadeInView>

        {/* Direction (optional) */}
        <FadeInView delay={180} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>DIRECTION <Text style={S.optLabel}>(OPTIONAL)</Text></Text>
          <TextInput
            style={S.directionInput}
            placeholder="Any specific angle, personal story, or constraint you want the scripts to follow..."
            placeholderTextColor={D.textDisabled}
            value={direction}
            onChangeText={setDirection}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </FadeInView>

        {/* Error */}
        {mutation.isError && (
          <FadeInView duration={200} direction="none" style={S.errorBox}>
            <AlertTriangle size={14} color={D.error} strokeWidth={2} />
            <Text style={S.errorText}>
              {(mutation.error as any)?.response?.data?.error?.message
                ?? (mutation.error as any)?.message
                ?? 'Something went wrong. Try again.'}
            </Text>
          </FadeInView>
        )}

        <GeneratingProgress visible={mutation.isPending} />

        {/* CTA */}
        <AnimatedPressable
          style={[S.ctaBtn, !canSubmit && S.ctaBtnOff]}
          onPress={() => {
            if (!canAfford(CREDIT_COSTS.script)) { setShowNoCredits(true); return; }
            mutation.mutate();
          }}
          disabled={!canSubmit}
          haptic="medium"
        >
          {mutation.isPending ? (
            <View style={S.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={S.ctaBtnText}>Writing scripts...</Text>
            </View>
          ) : (
            <>
              <Sparkles size={17} color="#FFF" strokeWidth={2} />
              <Text style={S.ctaBtnText}>Generate Scripts</Text>
            </>
          )}
        </AnimatedPressable>

        <View style={{ height: 60 }} />
      </ScrollView>
      <NoCreditsModal visible={showNoCredits} onClose={() => setShowNoCredits(false)} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  inputScroll: { paddingBottom: 40 },
  resultScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  hdr: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
  },
  hdrTitle: { ...T.bold, fontSize: 24, color: D.textPrimary, letterSpacing: -0.5 },
  hdrSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 3 },
  hdrIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: D.greenSubtle, alignItems: 'center', justifyContent: 'center',
  },

  card: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, ...Shadow.soft,
  },
  cardLabel: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.2, marginBottom: 12 },
  reqStar: { color: D.coral },
  optLabel: { color: D.textDisabled, ...T.regular },

  topicInput: {
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 12, ...T.regular, fontSize: 14, color: D.textPrimary,
    minHeight: 88, lineHeight: 22,
  },
  directionInput: {
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 12, ...T.regular, fontSize: 14, color: D.textPrimary,
    minHeight: 80, lineHeight: 22,
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 20, marginBottom: 14, padding: 14,
    backgroundColor: D.errorSubtle, borderRadius: R.md,
    borderWidth: 1, borderColor: D.errorBorder,
  },
  errorText: { flex: 1, ...T.regular, fontSize: 13, color: D.error, lineHeight: 20 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: D.limeDeep, borderRadius: R.full,
    marginHorizontal: 20, paddingVertical: 17, marginBottom: 20,
    shadowColor: D.limeDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30, shadowRadius: 20, elevation: 6,
  },
  ctaBtnOff: { opacity: 0.35, shadowOpacity: 0 },
  ctaBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  sectionHeading: { ...T.bold, ...SectionLabelStyle, marginBottom: 12 },

  regenOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 20, backgroundColor: D.bg,
    borderTopWidth: 1, borderTopColor: D.divider,
  },
});

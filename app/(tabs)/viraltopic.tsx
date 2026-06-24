import React, { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Animated, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import {
  ViralTopicBody, ViralTopicResult, ViralTopicOption,
  WhyOriginalWorks,
} from '@/types/api';
import { D, T, R, Shadow, Ease } from '@/constants/ds';
import {
  Sparkles, Copy, Check, ChevronDown, Zap,
  Mic, Camera, MessageSquare, Save, AlertTriangle,
  ArrowLeft, RefreshCw, User, Info, Link2, X,
  TrendingUp, Lightbulb,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import NoCreditsModal from '@/components/NoCreditsModal';

// ── Progress bar ───────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { label: 'Fetching video...', pct: 0.10, duration: 3000 },
  { label: 'Transcribing audio...', pct: 0.28, duration: 8000 },
  { label: 'Analyzing hook & structure...', pct: 0.48, duration: 8000 },
  { label: 'Extracting viral formula...', pct: 0.62, duration: 6000 },
  { label: 'Writing your recreations...', pct: 0.82, duration: 10000 },
  { label: 'Finalizing both versions...', pct: 0.93, duration: 5000 },
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
        <Text style={PG.pctLabel}>{Math.round((PROGRESS_STEPS[stepIdx]?.pct ?? 0.93) * 100)}%</Text>
      </View>
      <View style={PG.track}>
        <Animated.View style={[PG.fill, { width: barWidth as any }]} />
      </View>
      <Text style={PG.hint}>This takes 30–60s — hang tight.</Text>
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.cyan, flexShrink: 0 },
  stepLabel: { flex: 1, ...T.medium, fontSize: 13, color: D.textPrimary },
  pctLabel: { ...T.bold, fontSize: 12, color: D.cyan },
  track: { height: 6, borderRadius: 3, backgroundColor: D.surface, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: D.cyan },
  hint: { ...T.regular, fontSize: 11, color: D.textMuted, textAlign: 'center' },
});

// ── Why Original Works card ────────────────────────────────────────────────

function WhyItWorksCard({ data }: { data: WhyOriginalWorks }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <FadeInView delay={40} duration={400} direction="down" style={WI.card}>
      <TouchableOpacity style={WI.hdr} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={WI.hdrLeft}>
          <View style={WI.iconBox}>
            <TrendingUp size={16} color={D.lime} strokeWidth={2} />
          </View>
          <View>
            <Text style={WI.hdrTitle}>Why The Original Works</Text>
            <Text style={WI.hdrSub}>Viral formula breakdown</Text>
          </View>
        </View>
        <View style={[WI.chevron, expanded && WI.chevronOpen]}>
          <ChevronDown size={14} color="rgba(255,255,255,0.40)" strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <FadeInView duration={200} direction="none">
          <View style={WI.divider} />

          {/* Summary */}
          {data.summary ? (
            <Text style={WI.summary}>{data.summary}</Text>
          ) : null}

          {/* Reasons */}
          {(data.reasons?.length ?? 0) > 0 ? (
            <View style={WI.reasonsWrap}>
              {data.reasons.map((r, i) => (
                <View key={i} style={WI.reasonRow}>
                  <View style={WI.reasonNum}>
                    <Text style={WI.reasonNumText}>{i + 1}</Text>
                  </View>
                  <Text style={WI.reasonText}>{r}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Formula */}
          {data.formula ? (
            <View style={WI.formulaBox}>
              <View style={WI.formulaHdr}>
                <Zap size={11} color={D.lime} strokeWidth={2} />
                <Text style={WI.formulaLabel}>THE FORMULA</Text>
              </View>
              <Text style={WI.formulaText}>{data.formula}</Text>
            </View>
          ) : null}
        </FadeInView>
      ) : null}
    </FadeInView>
  );
}

const WI = StyleSheet.create({
  card: {
    backgroundColor: D.inkCard, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.inkCardBorder, padding: 16, marginBottom: 12, ...Shadow.card,
  },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hdrLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(182,255,138,0.14)', alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  hdrSub: { ...T.regular, fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  chevron: {},
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },

  summary: {
    ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)',
    lineHeight: 23, marginBottom: 16,
  },

  reasonsWrap: { gap: 8, marginBottom: 16 },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reasonNum: {
    width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
    backgroundColor: 'rgba(182,255,138,0.14)', alignItems: 'center', justifyContent: 'center',
  },
  reasonNumText: { ...T.bold, fontSize: 11, color: D.lime },
  reasonText: { flex: 1, ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 20 },

  formulaBox: {
    backgroundColor: 'rgba(182,255,138,0.10)', borderRadius: R.md,
    borderWidth: 1, borderColor: 'rgba(182,255,138,0.20)', padding: 12,
  },
  formulaHdr: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  formulaLabel: { ...T.bold, fontSize: 9, color: D.lime, letterSpacing: 1.2 },
  formulaText: { ...T.medium, fontSize: 13, color: D.lime, lineHeight: 20 },
});

// ── Script option card ─────────────────────────────────────────────────────

function OptionCard({ option, index, videoFormat }: {
  option: ViralTopicOption;
  index: number;
  videoFormat: string;
}) {
  const [expanded, setExpanded]       = useState(true);
  const [copied, setCopied]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saving, setSaving]           = useState(false);
  const [showHookAnalysis, setShowHA] = useState(false);
  const queryClient = useQueryClient();

  const isSkit     = videoFormat === 'skit';
  const isFaceless = videoFormat === 'faceless';

  const handleCopy = () => {
    void Clipboard.setStringAsync(option.full_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      await api.post('/creators/scripts', {
        option,
        title: option.label,
        origin: 'viral_topic',
      });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['saved-scripts'] });
    } catch (err: any) {
      Alert.alert('Couldn’t save script', err?.response?.data?.error?.message ?? err?.message ?? 'Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <FadeInView delay={index * 100} duration={400} direction="down" style={OC.card}>
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
            <TouchableOpacity style={OC.analysisToggle} onPress={() => setShowHA((v) => !v)} activeOpacity={0.8}>
              <Info size={11} color={D.cyan} strokeWidth={2} />
              <Text style={OC.analysisToggleText}>{showHookAnalysis ? 'Hide' : 'Why it works'}</Text>
            </TouchableOpacity>
          ) : null}
          {showHookAnalysis && option.hook_analysis ? (
            <FadeInView duration={200} direction="none" style={OC.hookAnalysis}>
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

      {/* Expanded content */}
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
                  <View style={OC.shotNum}><Text style={OC.shotNumText}>{i + 1}</Text></View>
                  <Text style={OC.shotText}>{shot}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Fallback to full_script if no structured content */}
          {!isSkit && (option.body?.length ?? 0) === 0 && option.full_script ? (
            <Text style={OC.bodyLine}>{option.full_script}</Text>
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
              <Zap size={12} color={D.cyan} strokeWidth={2} />
              <Text style={OC.whyText}>{option.why_this_works}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={OC.actions}>
            <TouchableOpacity style={OC.copyBtn} onPress={handleCopy} activeOpacity={0.75}>
              {copied
                ? <><Check size={14} color={D.success} strokeWidth={2.5} /><Text style={[OC.actionText, { color: D.success }]}>Copied!</Text></>
                : <><Copy size={14} color={D.textMuted} strokeWidth={2} /><Text style={OC.actionText}>Copy script</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[OC.saveBtn, saved && OC.saveBtnDone]}
              onPress={handleSave} disabled={saved || saving} activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={D.cyan} />
              ) : saved ? (
                <><Check size={13} color={D.success} strokeWidth={2.5} /><Text style={[OC.saveBtnText, { color: D.success }]}>Saved</Text></>
              ) : (
                <><Save size={13} color={D.cyan} strokeWidth={2} /><Text style={OC.saveBtnText}>Save</Text></>
              )}
            </TouchableOpacity>
          </View>
        </FadeInView>
      ) : null}
    </FadeInView>
  );
}

const OC = StyleSheet.create({
  card: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, marginBottom: 10, ...Shadow.soft,
  },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  numBadge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  numBadgePrimary: { backgroundColor: D.cyan, borderColor: D.cyan },
  numText: { ...T.bold, fontSize: 12, color: D.textMuted },
  numTextPrimary: { color: '#FFF' },
  labelText: { ...T.bold, fontSize: 14, color: D.textPrimary, flex: 1 },
  hdrRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lengthPill: {
    backgroundColor: D.surface, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: D.border,
  },
  lengthText: { ...T.regular, fontSize: 10, color: D.textMuted },
  chevron: {},
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  hookRow: {
    marginTop: 12, backgroundColor: D.cyanSubtle,
    borderRadius: R.sm, padding: 12, borderLeftWidth: 3, borderLeftColor: D.cyan,
  },
  hookLabel: { ...T.bold, fontSize: 9, color: D.cyan, letterSpacing: 1.2, marginBottom: 5 },
  hookText: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 21, fontStyle: 'italic' },
  analysisToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  analysisToggleText: { ...T.medium, fontSize: 11, color: D.cyan },
  hookAnalysis: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(6,182,212,0.15)', gap: 8,
  },
  hookAnalysisText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },
  psychRow: { gap: 3 },
  psychLabel: { ...T.bold, fontSize: 8, color: D.cyan, letterSpacing: 1.2, opacity: 0.7 },
  psychText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },

  divider: { height: 1, backgroundColor: D.divider, marginVertical: 14 },
  section: { marginBottom: 14, gap: 6 },
  sectionHdrRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  sectionHdrText: { ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 1.2 },
  bodyLine: { ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 23 },
  dialogueLine: {
    flexDirection: 'row', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  dialogueSpeaker: { ...T.bold, fontSize: 12, color: D.cyan, width: 68, flexShrink: 0, marginTop: 1 },
  dialogueText: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 22 },
  shotRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  shotNum: {
    width: 20, height: 20, borderRadius: 6, backgroundColor: D.surface,
    borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  shotNumText: { ...T.bold, fontSize: 10, color: D.textMuted },
  shotText: { flex: 1, ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 20 },

  ctaRow: { backgroundColor: D.inkCard, borderRadius: R.md, padding: 12, marginBottom: 12 },
  ctaLabel: { ...T.bold, fontSize: 9, color: D.lime, letterSpacing: 1.2, marginBottom: 4 },
  ctaText: { ...T.medium, fontSize: 13, color: '#FFF', lineHeight: 20 },
  whyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: D.cyanSubtle, borderRadius: R.sm, padding: 10, marginBottom: 14,
  },
  whyText: { flex: 1, ...T.regular, fontSize: 12, color: D.cyan, lineHeight: 18, marginTop: 1 },

  actions: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: D.divider, marginTop: 14 },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: R.md, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
  },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: R.md,
    backgroundColor: D.cyanSubtle, borderWidth: 1, borderColor: D.cyan + '40', minHeight: 40,
  },
  saveBtnDone: { backgroundColor: D.successSubtle, borderColor: D.successBorder },
  actionText: { ...T.medium, fontSize: 13, color: D.textMuted },
  saveBtnText: { ...T.bold, fontSize: 13, color: D.cyan },
});

// ── Context banner ─────────────────────────────────────────────────────────

function ContextBanner({
  videoUrl, topic, onBack, onRegenerate, isPending,
}: {
  videoUrl: string; topic: string;
  onBack: () => void; onRegenerate: () => void; isPending: boolean;
}) {
  function truncate(url: string, max = 38): string {
    return url.length <= max ? url : url.slice(0, max) + '…';
  }

  return (
    <View style={CB.root}>
      <View style={CB.topRow}>
        <TouchableOpacity style={CB.backBtn} onPress={onBack} activeOpacity={0.75} hitSlop={8}>
          <ArrowLeft size={16} color={D.textMuted} strokeWidth={2} />
          <Text style={CB.backText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={CB.regenBtn} onPress={onRegenerate} disabled={isPending} activeOpacity={0.75}>
          {isPending
            ? <ActivityIndicator size="small" color={D.cyan} />
            : <><RefreshCw size={13} color={D.cyan} strokeWidth={2} /><Text style={CB.regenText}>Regenerate</Text></>
          }
        </TouchableOpacity>
      </View>
      <View style={CB.card}>
        <View style={CB.row}>
          <View style={CB.iconBox}>
            <TrendingUp size={13} color="rgba(255,255,255,0.55)" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={CB.rowLabel}>Source video</Text>
            <Text style={CB.rowValue} numberOfLines={1}>{truncate(videoUrl)}</Text>
          </View>
        </View>
        <View style={CB.divider} />
        <View style={CB.row}>
          <View style={[CB.iconBox, { backgroundColor: 'rgba(6,182,212,0.20)' }]}>
            <Lightbulb size={13} color={D.cyan} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={CB.rowLabel}>Your topic</Text>
            <Text style={CB.rowValue} numberOfLines={2}>{topic}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const CB = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 16, backgroundColor: D.bg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  backText: { ...T.medium, fontSize: 13, color: D.textMuted },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full,
    backgroundColor: D.cyanSubtle, borderWidth: 1, borderColor: D.cyan + '40', minWidth: 120, justifyContent: 'center',
  },
  regenText: { ...T.medium, fontSize: 13, color: D.cyan },
  card: {
    backgroundColor: D.inkCard, borderRadius: R.xl, borderWidth: 1, borderColor: D.inkCardBorder, padding: 16, ...Shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 12 },
  rowLabel: { ...T.regular, fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: 0.3, marginBottom: 2 },
  rowValue: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});

// ── Transcript accordion ───────────────────────────────────────────────────

function TranscriptCard({ transcript }: {
  transcript: { fullText?: string | null; wordCount?: number | null } | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  if (!transcript?.fullText) return null;
  return (
    <View style={TR.card}>
      <TouchableOpacity style={TR.hdr} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={TR.left}>
          <Text style={TR.title}>Original Transcript</Text>
          {transcript.wordCount != null ? (
            <View style={TR.pill}><Text style={TR.pillText}>{transcript.wordCount} words</Text></View>
          ) : null}
        </View>
        <View style={[TR.chevron, open && TR.chevronOpen]}>
          <ChevronDown size={14} color={D.textMuted} strokeWidth={2} />
        </View>
      </TouchableOpacity>
      {open ? (
        <FadeInView duration={250} direction="none">
          <View style={TR.divider} />
          <Text style={TR.text}>{transcript.fullText}</Text>
        </FadeInView>
      ) : null}
    </View>
  );
}

const TR = StyleSheet.create({
  card: {
    backgroundColor: D.card, borderRadius: R.xl, borderWidth: 1, borderColor: D.cardBorder,
    padding: 16, marginBottom: 12, ...Shadow.soft,
  },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...T.medium, fontSize: 13, color: D.textSecondary },
  pill: { backgroundColor: D.surface, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { ...T.regular, fontSize: 11, color: D.textMuted },
  chevron: {},
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  divider: { height: 1, backgroundColor: D.divider, marginVertical: 12 },
  text: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 22 },
});

// ── Voice strip ────────────────────────────────────────────────────────────

function VoiceStrip({ voiceUsed, genderUsed }: {
  voiceUsed: { tone: string; sentence_style: string; sample_voice: string } | null;
  genderUsed: string;
}) {
  const chips = [
    voiceUsed?.tone ? { icon: <Mic size={11} color={D.textMuted} strokeWidth={2} />, label: voiceUsed.tone } : null,
    genderUsed && genderUsed !== 'unspecified' ? { icon: <User size={11} color={D.textMuted} strokeWidth={2} />, label: genderUsed } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];
  if (!chips.length) return null;
  return (
    <View style={VS.row}>
      <Text style={VS.label}>YOUR VOICE</Text>
      {chips.map((c, i) => (
        <View key={i} style={VS.chip}>
          {c.icon}
          <Text style={VS.chipText}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const VS = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 },
  label: { ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 1.2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: D.surface,
    borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: D.border,
  },
  chipText: { ...T.medium, fontSize: 11, color: D.textSecondary },
});

// ── Main screen ────────────────────────────────────────────────────────────

export default function ViralTopicScreen() {
  const { credits, refreshMe } = useAuth();
  const { prefillUrl } = useLocalSearchParams<{ prefillUrl?: string }>();
  const [videoUrl, setVideoUrl]     = useState(prefillUrl ?? '');
  const [topic, setTopic]           = useState('');
  const [direction, setDirection]   = useState('');
  const [result, setResult]         = useState<ViralTopicResult | null>(null);
  const [view, setView]             = useState<'input' | 'result'>('input');
  const [showNoCredits, setShowNoCredits] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!videoUrl.trim() || !topic.trim()) throw new Error('Fill in all required fields');
      const body: ViralTopicBody = {
        viral_video_url: videoUrl.trim(),
        topic: topic.trim(),
        ...(direction.trim() ? { direction: direction.trim() } : {}),
      };
      const res = await api.post('/creators/viral-topic', body, { timeout: 300_000 });
      return extractData<ViralTopicResult>(res);
    },
    onSuccess: (data) => {
      if (data) { setResult(data); setView('result'); refreshMe(); }
    },
  });

  const canSubmit = videoUrl.trim().length > 0 && topic.trim().length > 0 && !mutation.isPending;

  const handleBack = () => { setView('input'); mutation.reset(); };

  const videoFormat = result?.analysis?.videoFormat?.format ?? 'talking_head';

  // ── RESULT VIEW ────────────────────────────────────────────────────────
  if (view === 'result' && result) {
    return (
      <View style={S.root}>
        <ContextBanner
          videoUrl={videoUrl}
          topic={result.topic ?? topic}
          onBack={handleBack}
          onRegenerate={() => { if (credits <= 0) { setShowNoCredits(true); return; } mutation.mutate(); }}
          isPending={mutation.isPending}
        />

        <ScrollView contentContainerStyle={S.resultScroll} showsVerticalScrollIndicator={false}>
          {/* Why the original works */}
          {result.whyOriginalWorks && (
            <WhyItWorksCard data={result.whyOriginalWorks} />
          )}

          {/* Voice */}
          {result.voiceUsed && (
            <VoiceStrip voiceUsed={result.voiceUsed} genderUsed={result.genderUsed} />
          )}

          {/* Script options */}
          <Text style={S.sectionHeading}>YOUR RECREATIONS</Text>
          {result.options.map((opt, i) => (
            <OptionCard key={i} option={opt} index={i} videoFormat={videoFormat} />
          ))}

          {/* Transcript */}
          <TranscriptCard transcript={result.analysis?.transcript} />

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
            <Text style={S.hdrTitle}>Topic Recreator</Text>
            <Text style={S.hdrSub}>Steal a viral format for any topic — brand deals or organic.</Text>
          </View>
          <View style={S.hdrIcon}>
            <TrendingUp size={18} color={D.cyan} strokeWidth={2} />
          </View>
        </View>

        {/* Video URL */}
        <FadeInView delay={0} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>VIRAL VIDEO TO STUDY <Text style={S.reqStar}>*</Text></Text>
          <View style={S.urlRow}>
            <Link2 size={15} color={D.textDisabled} strokeWidth={2} />
            <TextInput
              style={S.urlInput}
              placeholder="https://www.tiktok.com/@creator/video/..."
              placeholderTextColor={D.textDisabled}
              value={videoUrl}
              onChangeText={setVideoUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {videoUrl.length > 0 && (
              <TouchableOpacity onPress={() => setVideoUrl('')} hitSlop={10}>
                <X size={14} color={D.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={S.fieldHint}>TikTok or Instagram Reels URL — any niche, no product needed.</Text>
        </FadeInView>

        {/* Topic */}
        <FadeInView delay={60} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>YOUR TOPIC <Text style={S.reqStar}>*</Text></Text>
          <TextInput
            style={S.topicInput}
            placeholder="e.g. my morning routine as a night-shift nurse, why I quit my 9–5, 3 things nobody tells you about freelancing..."
            placeholderTextColor={D.textDisabled}
            value={topic}
            onChangeText={setTopic}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </FadeInView>

        {/* Direction (optional) */}
        <FadeInView delay={120} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>DIRECTION <Text style={S.optLabel}>(OPTIONAL)</Text></Text>
          <TextInput
            style={S.directionInput}
            placeholder="Any specific angle, personal story, or constraints you want..."
            placeholderTextColor={D.textDisabled}
            value={direction}
            onChangeText={setDirection}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </FadeInView>

        {/* What you get */}
        <FadeInView delay={180} duration={400} direction="down" style={S.featureCard}>
          <View style={S.featureRow}>
            <View style={[S.featureIcon, { backgroundColor: D.cyanSubtle }]}>
              <TrendingUp size={14} color={D.cyan} strokeWidth={2} />
            </View>
            <Text style={S.featureText}>Viral formula breakdown — see exactly why the original works</Text>
          </View>
          <View style={S.featureRow}>
            <View style={[S.featureIcon, { backgroundColor: D.coralSubtle }]}>
              <Lightbulb size={14} color={D.coral} strokeWidth={2} />
            </View>
            <Text style={S.featureText}>2 recreations in your voice — same format, your topic</Text>
          </View>
          <View style={S.featureRow}>
            <View style={[S.featureIcon, { backgroundColor: 'rgba(47,161,12,0.10)' }]}>
              <Sparkles size={14} color={D.limeDeep} strokeWidth={2} />
            </View>
            <Text style={S.featureText}>Engagement CTAs — built for brand deals & organic reach</Text>
          </View>
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
        <TouchableOpacity
          style={[S.ctaBtn, !canSubmit && S.ctaBtnOff]}
          onPress={() => {
            if (credits <= 0) { setShowNoCredits(true); return; }
            mutation.mutate();
          }}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <View style={S.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={S.ctaBtnText}>Analyzing & recreating...</Text>
            </View>
          ) : (
            <>
              <TrendingUp size={17} color="#FFF" strokeWidth={2} />
              <Text style={S.ctaBtnText}>Recreate This Format</Text>
            </>
          )}
        </TouchableOpacity>

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
  hdrSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 3, lineHeight: 19 },
  hdrIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: D.cyanSubtle, alignItems: 'center', justifyContent: 'center' },

  card: {
    marginHorizontal: 20, marginBottom: 14, backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, ...Shadow.soft,
  },
  cardLabel: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.2, marginBottom: 12 },
  reqStar: { color: D.coral },
  optLabel: { color: D.textDisabled, ...T.regular },
  fieldHint: { ...T.regular, fontSize: 11, color: D.textDisabled, marginTop: 8 },

  urlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  urlInput: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary },

  topicInput: {
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 12, ...T.regular, fontSize: 14, color: D.textPrimary, minHeight: 88, lineHeight: 22,
  },
  directionInput: {
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 12, ...T.regular, fontSize: 14, color: D.textPrimary, minHeight: 72, lineHeight: 22,
  },

  featureCard: {
    marginHorizontal: 20, marginBottom: 14, backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, gap: 12, ...Shadow.soft,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureText: { flex: 1, ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 19 },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 20, marginBottom: 14, padding: 14,
    backgroundColor: D.errorSubtle, borderRadius: R.md, borderWidth: 1, borderColor: D.errorBorder,
  },
  errorText: { flex: 1, ...T.regular, fontSize: 13, color: D.error, lineHeight: 20 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: D.cyan, borderRadius: R.full,
    marginHorizontal: 20, paddingVertical: 17, marginBottom: 20,
    shadowColor: D.cyan,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30, shadowRadius: 20, elevation: 6,
  },
  ctaBtnOff: { opacity: 0.35, shadowOpacity: 0 },
  ctaBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  sectionHeading: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.5, marginBottom: 12 },

  regenOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 20, backgroundColor: D.bg, borderTopWidth: 1, borderTopColor: D.divider,
  },
});

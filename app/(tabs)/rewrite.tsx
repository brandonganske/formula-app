import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Platform, Image, Animated, Keyboard,
  KeyboardAvoidingView, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import {
  ViralRewriteBody, ViralRewriteResult, RewriteOption,
  ProductSearchResult, ProductBrain, ProductSearchResponse,
} from '@/types/api';
import { D, T, R, Shadow, Ease } from '@/constants/ds';
import {
  Sparkles, Copy, Check, Search, X, ChevronDown,
  ShoppingBag, Brain, FileText, Play, Film, Zap, Quote, Eye,
  ChevronRight, RefreshCw, ArrowLeft, Link2, Mic, Save, AlertTriangle,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import NoCreditsModal from '@/components/NoCreditsModal';

// ── coerce API values to string ────────────────────────────────────────────
function str(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return String(v.text ?? v.content ?? v.script ?? v.line ?? JSON.stringify(v));
  }
  return String(value);
}

// ── progress bar ───────────────────────────────────────────────────────────
const PROGRESS_STEPS = [
  { label: 'Fetching video...', pct: 0.12, duration: 3000 },
  { label: 'Transcribing audio...', pct: 0.30, duration: 8000 },
  { label: 'Analyzing hook & structure...', pct: 0.50, duration: 8000 },
  { label: 'Building product intelligence...', pct: 0.65, duration: 6000 },
  { label: 'Writing your scripts...', pct: 0.82, duration: 10000 },
  { label: 'Finalizing variations...', pct: 0.93, duration: 6000 },
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
      <Text style={PG.hint}>IQ is watching the full video — this can take a couple of minutes.</Text>
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.coral, flexShrink: 0 },
  stepLabel: { flex: 1, ...T.medium, fontSize: 13, color: D.textPrimary },
  pctLabel: { ...T.bold, fontSize: 12, color: D.coral },
  track: { height: 6, borderRadius: 3, backgroundColor: D.surface, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: D.coral },
  hint: { ...T.regular, fontSize: 11, color: D.textMuted, textAlign: 'center' },
});

// ── helpers ────────────────────────────────────────────────────────────────
function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  // API returns commission as a whole percentage (e.g. 20 = 20%), not a decimal
  return `${n.toFixed(1)}%`;
}
function fmtGMV(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function truncateUrl(url: string, max = 40): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + '…';
}
function detectPlatform(url: string): string {
  if (url.includes('tiktok')) return 'TikTok';
  if (url.includes('instagram')) return 'Instagram';
  if (url.includes('youtube') || url.includes('youtu.be')) return 'YouTube';
  return 'Video';
}

// ── Product Picker ─────────────────────────────────────────────────────────

type ProductChoice =
  | { source: 'video' }
  | { source: 'manual'; name: string }
  | { source: 'brain'; product: ProductSearchResult };

function ProductPickerSheet({ onPick, onClose }: {
  onPick: (choice: ProductChoice) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'options' | 'search' | 'manual'>('options');
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery<ProductSearchResponse>({
    queryKey: ['product-search-picker', searchQuery],
    queryFn: async () => {
      const body: any = { sort: 'trending', page: 1, pagesize: 20 };
      if (searchQuery.trim()) {
        body.query = searchQuery.trim();
        body.keywords = searchQuery.trim().replace(/\s+/g, '');
      }
      const res = await api.post('/creators/product-search', body);
      return extractData<ProductSearchResponse>(res);
    },
    staleTime: 120_000,
    enabled: mode === 'search',
  });

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(text), 550);
  }, []);

  return (
    <FadeInView delay={0} duration={200} direction="up" style={PP.panel}>
      <View style={PP.hdr}>
        <Text style={PP.hdrTitle}>Choose Product</Text>
        <TouchableOpacity onPress={onClose} style={PP.closeBtn} hitSlop={12}>
          <X size={18} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {mode === 'options' && (
        <View style={PP.optionsList}>
          <TouchableOpacity style={PP.option} onPress={() => onPick({ source: 'video' })} activeOpacity={0.8}>
            <View style={[PP.optIcon, { backgroundColor: D.cyanSubtle }]}>
              <Film size={18} color={D.cyan} strokeWidth={2} />
            </View>
            <View style={PP.optBody}>
              <Text style={PP.optTitle}>From video</Text>
              <Text style={PP.optSub}>Use the product detected in the source video</Text>
            </View>
            <ChevronRight size={16} color={D.textDisabled} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={PP.option} onPress={() => setMode('search')} activeOpacity={0.8}>
            <View style={[PP.optIcon, { backgroundColor: D.coralSubtle }]}>
              <Brain size={18} color={D.coral} strokeWidth={2} />
            </View>
            <View style={PP.optBody}>
              <Text style={PP.optTitle}>Search & build brain</Text>
              <Text style={PP.optSub}>Find a product — AI builds intelligence for your scripts</Text>
            </View>
            <ChevronRight size={16} color={D.textDisabled} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity style={PP.option} onPress={() => setMode('manual')} activeOpacity={0.8}>
            <View style={[PP.optIcon, { backgroundColor: D.amberSubtle }]}>
              <FileText size={18} color={D.amber} strokeWidth={2} />
            </View>
            <View style={PP.optBody}>
              <Text style={PP.optTitle}>Enter manually</Text>
              <Text style={PP.optSub}>Type your product name directly</Text>
            </View>
            <ChevronRight size={16} color={D.textDisabled} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      {mode === 'search' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={PP.searchRow}>
            <TouchableOpacity onPress={() => setMode('options')} hitSlop={10}>
              <ChevronRight size={18} color={D.textMuted} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            <View style={PP.searchBox}>
              <Search size={14} color={D.textDisabled} strokeWidth={2} />
              <TextInput
                style={PP.searchInput}
                placeholder="Search products..."
                placeholderTextColor={D.textDisabled}
                value={query}
                onChangeText={handleSearch}
                autoFocus
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setSearchQuery(''); }} hitSlop={8}>
                  <X size={14} color={D.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
            {isLoading && <ActivityIndicator size="small" color={D.coral} />}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!query && <Text style={PP.browseLabel}>Trending products</Text>}
            {(data?.products ?? []).map((p) => (
              <TouchableOpacity key={p.external_id} style={PP.searchItem} onPress={() => onPick({ source: 'brain', product: p })} activeOpacity={0.8}>
                {p.cover_url ? (
                  <Image source={{ uri: p.cover_url }} style={PP.searchThumb} resizeMode="cover" />
                ) : (
                  <View style={[PP.searchThumb, PP.searchThumbFallback]}>
                    <ShoppingBag size={14} color={D.textDisabled} strokeWidth={1.5} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={PP.searchItemTitle} numberOfLines={2}>{p.title}</Text>
                  {p.commission_rate != null && (
                    <Text style={PP.searchItemSub}>{fmtPct(p.commission_rate)} commission · {fmtGMV(p.day7_gmv)} 7d GMV</Text>
                  )}
                </View>
                <View style={PP.useBtn}>
                  <Text style={PP.useBtnText}>Use</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {mode === 'manual' && (
        <View style={PP.manualWrap}>
          <TouchableOpacity onPress={() => setMode('options')} style={PP.backBtn} hitSlop={10}>
            <ChevronRight size={15} color={D.textMuted} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
            <Text style={PP.backText}>Back</Text>
          </TouchableOpacity>
          <TextInput
            style={PP.manualInput}
            placeholder="Product name..."
            placeholderTextColor={D.textDisabled}
            value={manualName}
            onChangeText={setManualName}
            autoFocus
          />
          <TouchableOpacity
            style={[PP.manualBtn, !manualName.trim() && { opacity: 0.4 }]}
            onPress={() => onPick({ source: 'manual', name: manualName.trim() })}
            disabled={!manualName.trim()}
            activeOpacity={0.85}
          >
            <Text style={PP.manualBtnText}>Use this product</Text>
          </TouchableOpacity>
        </View>
      )}
    </FadeInView>
  );
}

const PP = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.border, maxHeight: '75%', ...Shadow.card,
  },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  hdrTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  optionsList: { padding: 16, gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: D.surface, borderRadius: R.lg, borderWidth: 1, borderColor: D.border, padding: 14 },
  optIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  optBody: { flex: 1 },
  optTitle: { ...T.bold, fontSize: 14, color: D.textPrimary },
  optSub: { ...T.regular, fontSize: 12, color: D.textMuted, marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary },
  browseLabel: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.2, marginTop: 4, marginBottom: 8 },
  searchItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.divider },
  searchThumb: { width: 44, height: 44, borderRadius: 10, flexShrink: 0 },
  searchThumbFallback: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  searchItemTitle: { ...T.medium, fontSize: 13, color: D.textPrimary, lineHeight: 18, marginBottom: 3 },
  searchItemSub: { ...T.regular, fontSize: 11, color: D.textMuted },
  useBtn: { backgroundColor: D.coralSubtle, borderRadius: R.full, borderWidth: 1, borderColor: D.coral + '30', paddingHorizontal: 12, paddingVertical: 5 },
  useBtnText: { ...T.bold, fontSize: 12, color: D.coral },
  manualWrap: { padding: 20, gap: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { ...T.medium, fontSize: 13, color: D.textMuted },
  manualInput: { backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border, padding: 14, ...T.regular, fontSize: 15, color: D.textPrimary },
  manualBtn: { backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  manualBtnText: { ...T.bold, fontSize: 15, color: '#FFF' },
});

// ── Script Option Card ─────────────────────────────────────────────────────

function ScriptCard({ option, index }: { option: RewriteOption; index: number }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showHookAnalysis, setShowHookAnalysis] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  // Support both current API (full_script) and legacy history items (script)
  const fullScript = option.full_script ?? option.script ?? '';
  const labelText = option.label ?? option.title ?? `Script ${index + 1}`;
  const ha = option.hook_analysis;

  const handleSave = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      await api.post('/creators/scripts', {
        option,
        title: option.label,
        origin: 'viral_rewrite',
      });
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['saved-scripts'] });
    } catch (err: any) {
      Alert.alert('Couldn’t save script', err?.response?.data?.error?.message ?? err?.message ?? 'Please try again.');
    } finally { setSaving(false); }
  };

  const handleCopy = () => {
    void Clipboard.setStringAsync(str(fullScript));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FadeInView delay={index * 80} duration={400} direction="down" style={SC.card}>
      {/* Header */}
      <TouchableOpacity style={SC.hdr} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={SC.labelRow}>
          <View style={[SC.numBadge, index === 0 && SC.numBadgePrimary]}>
            <Text style={[SC.numText, index === 0 && SC.numTextPrimary]}>{index + 1}</Text>
          </View>
          <Text style={SC.labelText} numberOfLines={1}>{labelText}</Text>
        </View>
        <View style={SC.hdrRight}>
          {option.estimated_length ? (
            <View style={SC.lengthPill}>
              <Text style={SC.lengthText}>{option.estimated_length}</Text>
            </View>
          ) : null}
          <View style={[SC.chevron, expanded && SC.chevronOpen]}>
            <ChevronDown size={15} color={D.textMuted} strokeWidth={2} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Hook — always visible */}
      {option.hook ? (
        <View style={SC.hookRow}>
          <Text style={SC.hookLabel}>HOOK</Text>
          <Text style={SC.hookText}>"{str(option.hook)}"</Text>
          {(ha?.why_its_better || ha?.psychology) ? (
            <TouchableOpacity
              style={SC.hookAnalysisToggle}
              onPress={() => setShowHookAnalysis((v) => !v)}
              activeOpacity={0.8}
            >
              <Zap size={11} color={D.coral} strokeWidth={2} />
              <Text style={SC.hookAnalysisToggleText}>
                {showHookAnalysis ? 'Hide analysis' : 'Why it works'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showHookAnalysis && ha ? (
            <FadeInView duration={200} direction="none" style={SC.hookAnalysis}>
              {ha.why_its_better ? (
                <Text style={SC.hookAnalysisText}>{ha.why_its_better}</Text>
              ) : null}
              {ha.vs_original ? (
                <View style={SC.vsRow}>
                  <Text style={SC.vsLabel}>VS ORIGINAL</Text>
                  <Text style={SC.vsText}>{ha.vs_original}</Text>
                </View>
              ) : null}
              {ha.psychology ? (
                <View style={SC.psychRow}>
                  <Text style={SC.psychLabel}>PSYCHOLOGY</Text>
                  <Text style={SC.psychText}>{ha.psychology}</Text>
                </View>
              ) : null}
            </FadeInView>
          ) : null}
        </View>
      ) : null}

      {/* Expanded body */}
      {expanded && (
        <FadeInView duration={200} direction="none">
          <View style={SC.divider} />

          {/* Body lines */}
          {(option.body?.length ?? 0) > 0 ? (
            <View style={SC.section}>
              {option.body!.map((line, i) => (
                <Text key={i} style={SC.bodyLine}>{line}</Text>
              ))}
            </View>
          ) : null}

          {/* Dialogue (multi-person skit format) */}
          {(option.dialogue?.length ?? 0) > 0 ? (
            <View style={SC.section}>
              <View style={SC.sectionHdrRow}>
                <Mic size={11} color={D.textMuted} strokeWidth={2} />
                <Text style={SC.sectionHdrText}>DIALOGUE</Text>
              </View>
              {option.dialogue!.map((dl, i) => (
                <View key={i} style={SC.dialogueLine}>
                  <Text style={SC.dialogueSpeaker}>{dl.speaker}</Text>
                  <Text style={SC.dialogueText}>{dl.line}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Fallback: show full_script when no structured body or dialogue */}
          {(option.body?.length ?? 0) === 0 && (option.dialogue?.length ?? 0) === 0 && fullScript ? (
            <Text style={SC.scriptText}>{str(fullScript)}</Text>
          ) : null}

          {/* CTA */}
          {option.cta ? (
            <View style={SC.ctaRow}>
              <Text style={SC.ctaLabel}>CTA</Text>
              <Text style={SC.ctaText}>{option.cta}</Text>
            </View>
          ) : null}

          {/* Why this works */}
          {option.why_this_works ? (
            <View style={SC.whyRow}>
              <Zap size={12} color={D.lime} strokeWidth={2} />
              <Text style={SC.whyText}>{option.why_this_works}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={SC.actions}>
            <TouchableOpacity style={SC.copyBtn} onPress={handleCopy} activeOpacity={0.75}>
              {copied
                ? <><Check size={14} color={D.success} strokeWidth={2.5} /><Text style={[SC.actionText, { color: D.success }]}>Copied!</Text></>
                : <><Copy size={14} color={D.textMuted} strokeWidth={2} /><Text style={SC.actionText}>Copy script</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={[SC.saveBtn, saved && SC.saveBtnDone]} onPress={handleSave} activeOpacity={0.75} disabled={saved}>
              {saving
                ? <ActivityIndicator size="small" color={D.coral} />
                : saved
                  ? <><Check size={14} color={D.success} strokeWidth={2.5} /><Text style={[SC.actionText, { color: D.success }]}>Saved!</Text></>
                  : <><Save size={14} color={D.coral} strokeWidth={2} /><Text style={[SC.actionText, { color: D.coral }]}>Save script</Text></>
              }
            </TouchableOpacity>
          </View>
        </FadeInView>
      )}
    </FadeInView>
  );
}

const SC = StyleSheet.create({
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
  numBadgePrimary: { backgroundColor: D.coral, borderColor: D.coral },
  numText: { ...T.bold, fontSize: 12, color: D.textMuted },
  numTextPrimary: { color: '#FFF' },
  labelText: { ...T.bold, fontSize: 14, color: D.textPrimary, flex: 1 },
  hdrRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lengthPill: {
    backgroundColor: D.surface, borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: D.border,
  },
  lengthText: { ...T.regular, fontSize: 10, color: D.textMuted },
  chevron: {},
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  hookRow: {
    marginTop: 12, backgroundColor: D.coralFaint,
    borderRadius: R.sm, padding: 12, borderLeftWidth: 3, borderLeftColor: D.coral,
  },
  hookLabel: { ...T.bold, fontSize: 9, color: D.coral, letterSpacing: 1.2, marginBottom: 5 },
  hookText: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 21, fontStyle: 'italic' },
  hookAnalysisToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  hookAnalysisToggleText: { ...T.medium, fontSize: 11, color: D.coral },
  hookAnalysis: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,55,85,0.15)', gap: 8,
  },
  hookAnalysisText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },
  vsRow: { gap: 3 },
  vsLabel: { ...T.bold, fontSize: 8, color: D.coral, letterSpacing: 1.2, opacity: 0.7 },
  vsText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },
  psychRow: { gap: 3 },
  psychLabel: { ...T.bold, fontSize: 8, color: D.coral, letterSpacing: 1.2, opacity: 0.7 },
  psychText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },

  divider: { height: 1, backgroundColor: D.divider, marginVertical: 14 },
  section: { marginBottom: 14, gap: 6 },
  sectionHdrRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  sectionHdrText: { ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 1.2 },
  bodyLine: { ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 23 },
  scriptText: { ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 24, marginBottom: 14 },
  dialogueLine: {
    flexDirection: 'row', gap: 10, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  dialogueSpeaker: { ...T.bold, fontSize: 12, color: D.coral, width: 68, flexShrink: 0, marginTop: 1 },
  dialogueText: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 22 },

  ctaRow: { backgroundColor: D.inkCard, borderRadius: R.md, padding: 12, marginBottom: 12 },
  ctaLabel: { ...T.bold, fontSize: 9, color: D.lime, letterSpacing: 1.2, marginBottom: 4 },
  ctaText: { ...T.medium, fontSize: 13, color: '#FFF', lineHeight: 20 },
  whyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: D.limeSubtle, borderRadius: R.sm, padding: 10, marginBottom: 14,
  },
  whyText: { flex: 1, ...T.regular, fontSize: 12, color: D.limeDeep, lineHeight: 18, marginTop: 1 },

  actions: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: D.divider, marginTop: 14 },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: R.md,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
  },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: R.md,
    backgroundColor: D.coralSubtle, borderWidth: 1, borderColor: D.coral + '40',
  },
  saveBtnDone: {
    backgroundColor: D.successSubtle, borderColor: D.success + '40',
  },
  actionText: { ...T.medium, fontSize: 13, color: D.textMuted },
});

// ── Context banner (shown on results page) ─────────────────────────────────

function ContextBanner({
  videoUrl,
  productChoice,
  result,
  onBack,
  onRegenerate,
  isPending,
}: {
  videoUrl: string;
  productChoice: ProductChoice;
  result: ViralRewriteResult;
  onBack: () => void;
  onRegenerate: () => void;
  isPending: boolean;
}) {
  const platform = detectPlatform(videoUrl);

  const productName = result.product?.name
    ?? (productChoice.source === 'manual' ? productChoice.name : '')
    ?? (productChoice.source === 'brain' ? productChoice.product.title : '');

  const coverUrl = result.product?.brain?.cover_url
    ?? (productChoice.source === 'brain' ? productChoice.product.cover_url : null);

  return (
    <View style={CB.root}>
      {/* Back + regen row */}
      <View style={CB.topRow}>
        <TouchableOpacity style={CB.backBtn} onPress={onBack} activeOpacity={0.75} hitSlop={8}>
          <ArrowLeft size={16} color={D.textMuted} strokeWidth={2} />
          <Text style={CB.backText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={CB.regenBtn} onPress={onRegenerate} disabled={isPending} activeOpacity={0.75}>
          {isPending
            ? <ActivityIndicator size="small" color={D.coral} />
            : <><RefreshCw size={13} color={D.coral} strokeWidth={2} /><Text style={CB.regenText}>Regenerate</Text></>
          }
        </TouchableOpacity>
      </View>

      {/* Dark context card */}
      <View style={CB.card}>
        {/* Video row */}
        <View style={CB.row}>
          <View style={CB.iconBox}>
            <Play size={14} color='rgba(255,255,255,0.60)' strokeWidth={2} fill="rgba(255,255,255,0.20)" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={CB.rowLabel}>{platform} · Source video</Text>
            <Text style={CB.rowValue} numberOfLines={1}>{truncateUrl(videoUrl)}</Text>
          </View>
        </View>

        <View style={CB.divider} />

        {/* Product row */}
        <View style={CB.row}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={CB.thumb} resizeMode="cover" />
          ) : (
            <View style={[CB.iconBox, { backgroundColor: 'rgba(255,55,85,0.20)' }]}>
              <ShoppingBag size={14} color={D.coral} strokeWidth={2} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={CB.rowLabel}>
              {productChoice.source === 'brain' ? 'Product brain built' : 'Promoting'}
            </Text>
            <Text style={CB.rowValue} numberOfLines={1}>{productName || '—'}</Text>
          </View>
          {productChoice.source === 'brain' && (
            <View style={CB.brainBadge}>
              <Brain size={10} color={D.coral} strokeWidth={2} />
              <Text style={CB.brainBadgeText}>AI brain</Text>
            </View>
          )}
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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.full,
    backgroundColor: D.coralFaint, borderWidth: 1, borderColor: D.coral + '30',
    minWidth: 120, justifyContent: 'center',
  },
  regenText: { ...T.medium, fontSize: 13, color: D.coral },
  card: {
    backgroundColor: D.inkCard, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.inkCardBorder, padding: 16, ...Shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thumb: { width: 36, height: 36, borderRadius: 10, flexShrink: 0 },
  rowLabel: { ...T.regular, fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: 0.3, marginBottom: 2 },
  rowValue: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 12 },
  brainBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: D.coralFaint, borderRadius: R.full, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: D.coral + '30' },
  brainBadgeText: { ...T.bold, fontSize: 10, color: D.coral },
});

// ── product choice helpers ─────────────────────────────────────────────────

function productChoiceLabel(choice: ProductChoice | null): string {
  if (!choice) return 'Choose a product';
  if (choice.source === 'video') return 'From video';
  if (choice.source === 'manual') return choice.name;
  return choice.product.title;
}

function buildRewriteBody(videoUrl: string, choice: ProductChoice): ViralRewriteBody {
  if (choice.source === 'video') {
    return { viral_video_url: videoUrl, product: { source: 'video' } };
  }
  if (choice.source === 'manual') {
    return { viral_video_url: videoUrl, product: { source: 'manual', manual: { name: choice.name } } };
  }
  const raw = choice.product as any;
  return {
    viral_video_url: videoUrl,
    product: {
      source: 'brain',
      brain_external_id: choice.product.external_id,
      brain_region: choice.product.region,
      // Pass the full search result so the backend can build the brain on the fly.
      // Map cover_url → cover to match the exact shape the backend expects.
      search_product: {
        ...raw,
        cover: raw.cover ?? choice.product.cover_url ?? null,
      },
    },
  };
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function RewriteScreen() {
  const { credits, refreshMe } = useAuth();
  const { prefillUrl } = useLocalSearchParams<{ prefillUrl?: string }>();
  const [videoUrl, setVideoUrl] = useState(prefillUrl ?? '');
  const [productChoice, setProductChoice] = useState<ProductChoice | null>(null);
  const [showPicker, setShowPicker] = useState(!!prefillUrl);
  const [result, setResult] = useState<ViralRewriteResult | null>(null);
  const [view, setView] = useState<'input' | 'result'>('input');
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNoCredits, setShowNoCredits] = useState(false);

  const rewriteMutation = useMutation({
    mutationFn: async () => {
      if (!productChoice) throw new Error('Select a product first');
      const body = buildRewriteBody(videoUrl.trim(), productChoice);
      const res = await api.post('/creators/viral-rewrite', body, { timeout: 300_000 });
      return extractData<ViralRewriteResult>(res);
    },
    onSuccess: (data) => {
      if (data) {
        setResult(data);
        setView('result');
        refreshMe();
      }
    },
  });

  const canSubmit = videoUrl.trim().length > 0 && productChoice != null && !rewriteMutation.isPending;
  const hasProduct = productChoice != null;

  const handleBack = () => {
    setView('input');
    rewriteMutation.reset();
  };

  const handleRegenerate = () => {
    if (credits <= 0) { setShowNoCredits(true); return; }
    rewriteMutation.mutate();
  };

  // ── RESULTS VIEW ────────────────────────────────────────────────────────
  if (view === 'result' && result) {
    return (
      <View style={S.root}>
        <ContextBanner
          videoUrl={videoUrl}
          productChoice={productChoice!}
          result={result}
          onBack={handleBack}
          onRegenerate={handleRegenerate}
          isPending={rewriteMutation.isPending}
        />
        <ScrollView
          contentContainerStyle={S.resultScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hook variants */}
          {(result.hookVariants?.length ?? 0) > 0 && (
            <FadeInView delay={40} duration={400} direction="down" style={S.hooksCard}>
              <View style={S.hooksCardHdr}>
                <View style={S.hooksIconWrap}>
                  <Zap size={14} color={D.coral} strokeWidth={2} />
                </View>
                <Text style={S.hooksCardTitle}>Hook Variants</Text>
              </View>
              {result.hookVariants!.map((hook, i) => (
                <View key={i} style={[S.hookItem, i < result.hookVariants!.length - 1 && S.hookItemBorder]}>
                  <View style={[S.hookNum, { backgroundColor: D.coralFaint }]}>
                    <Text style={S.hookNumText}>{i + 1}</Text>
                  </View>
                  <Text style={S.hookItemText}>{str(hook)}</Text>
                </View>
              ))}
            </FadeInView>
          )}

          {/* Steal this line */}
          {result.stealThisLine ? (
            <FadeInView delay={80} duration={400} direction="down" style={S.stealCard}>
              <View style={S.stealHdr}>
                <Quote size={14} color={D.lime} strokeWidth={2} />
                <Text style={S.stealTitle}>Steal This Line</Text>
              </View>
              <Text style={S.stealText}>"{str(result.stealThisLine)}"</Text>
            </FadeInView>
          ) : null}

          {/* Scripts */}
          <Text style={S.sectionHeading}>YOUR SCRIPTS</Text>
          {result.options.map((opt, i) => (
            <ScriptCard key={i} option={opt} index={i} />
          ))}

          {/* Transcript */}
          {result.analysis?.transcript?.fullText ? (
            <View style={S.transcriptCard}>
              <TouchableOpacity style={S.transcriptHdr} onPress={() => setShowTranscript((v) => !v)} activeOpacity={0.8}>
                <View style={S.transcriptLeft}>
                  <FileText size={14} color={D.textMuted} strokeWidth={2} />
                  <Text style={S.transcriptHdrTitle}>Original Transcript</Text>
                  {result.analysis.transcript.wordCount != null && (
                    <View style={S.transcriptMeta}>
                      <Text style={S.transcriptMetaText}>{result.analysis.transcript.wordCount} words</Text>
                    </View>
                  )}
                </View>
                <View style={[S.transcriptChevron, showTranscript && S.transcriptChevronOpen]}>
                  <ChevronDown size={14} color={D.textMuted} strokeWidth={2} />
                </View>
              </TouchableOpacity>
              {showTranscript && (
                <FadeInView duration={250} direction="none">
                  <View style={S.transcriptDivider} />
                  <Text style={S.transcriptText}>{result.analysis.transcript.fullText}</Text>
                </FadeInView>
              )}
            </View>
          ) : null}

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Generating overlay while regenerating */}
        {rewriteMutation.isPending && (
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
            <Text style={S.hdrTitle}>Viral Rewrite</Text>
            <Text style={S.hdrSub}>Drop a viral video. Get scripts in your voice.</Text>
          </View>
          <View style={S.hdrIcon}>
            <Sparkles size={18} color={D.coral} strokeWidth={2} />
          </View>
        </View>

        {/* Video URL */}
        <FadeInView delay={0} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>VIRAL VIDEO URL</Text>
          <View style={S.urlRow}>
            <Link2 size={15} color={D.textDisabled} strokeWidth={2} />
            <TextInput
              style={S.urlInput}
              placeholder="https://www.tiktok.com/@creator/video/..."
              placeholderTextColor={D.textDisabled}
              value={videoUrl}
              onChangeText={(t) => {
                setVideoUrl(t);
                if (t.startsWith('http')) Keyboard.dismiss();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            {videoUrl.length > 0 && (
              <TouchableOpacity onPress={() => setVideoUrl('')} hitSlop={10}>
                <X size={14} color={D.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </FadeInView>

        {/* "What's happening" flag — sets the expectation that IQ watches the
            whole video rather than just scraping captions. */}
        <FadeInView delay={30} duration={400} direction="down" style={S.watchFlag}>
          <View style={S.watchFlagIcon}>
            <Eye size={15} color={D.coral} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.watchFlagTitle}>This can take a couple of minutes</Text>
            <Text style={S.watchFlagText}>
              Influenceish IQ actually watches the whole video — hooks, pacing, delivery — and learns it. It's not just pulling captions, so give it a moment.
            </Text>
          </View>
        </FadeInView>

        {/* Product picker */}
        <FadeInView delay={60} duration={400} direction="down" style={S.card}>
          <Text style={S.cardLabel}>PRODUCT TO PROMOTE</Text>
          <TouchableOpacity style={S.productPicker} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <View style={[S.productPickerIcon, hasProduct && { backgroundColor: D.coralSubtle }]}>
              {productChoice?.source === 'brain' && productChoice.product.cover_url ? (
                <Image source={{ uri: productChoice.product.cover_url }} style={{ width: 30, height: 30, borderRadius: 7 }} resizeMode="cover" />
              ) : productChoice?.source === 'brain' ? (
                <Brain size={15} color={D.coral} strokeWidth={2} />
              ) : productChoice?.source === 'manual' ? (
                <FileText size={15} color={D.amber} strokeWidth={2} />
              ) : productChoice?.source === 'video' ? (
                <Film size={15} color={D.cyan} strokeWidth={2} />
              ) : (
                <ShoppingBag size={15} color={D.textMuted} strokeWidth={2} />
              )}
            </View>
            <Text style={[S.productPickerText, hasProduct && { color: D.textPrimary }]} numberOfLines={1}>
              {productChoiceLabel(productChoice)}
            </Text>
            {hasProduct ? (
              <View style={S.productPickerCheck}>
                <Check size={12} color={D.success} strokeWidth={2.5} />
              </View>
            ) : null}
            <ChevronDown size={15} color={D.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          {productChoice?.source === 'brain' && (
            <FadeInView duration={200} direction="none" style={S.brainNote}>
              <Brain size={12} color={D.coral} strokeWidth={2} />
              <Text style={S.brainNoteText}>AI will build product intelligence and use it in your scripts</Text>
            </FadeInView>
          )}
        </FadeInView>

        {/* Error */}
        {rewriteMutation.isError && (
          <FadeInView duration={200} direction="none" style={S.errorBox}>
            <AlertTriangle size={14} color={D.error} strokeWidth={2} />
            <Text style={S.errorText}>
              {(rewriteMutation.error as any)?.response?.data?.error?.message
                ?? (rewriteMutation.error as any)?.message
                ?? 'Something went wrong. Try again.'}
            </Text>
          </FadeInView>
        )}

        {/* Progress */}
        <GeneratingProgress visible={rewriteMutation.isPending} />

        {/* CTA */}
        <TouchableOpacity
          style={[S.ctaBtn, !canSubmit && S.ctaBtnOff]}
          onPress={() => {
            if (credits <= 0) { setShowNoCredits(true); return; }
            rewriteMutation.mutate();
          }}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {rewriteMutation.isPending ? (
            <View style={S.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={S.ctaBtnText}>Analyzing & rewriting...</Text>
            </View>
          ) : (
            <>
              <Sparkles size={17} color="#FFF" strokeWidth={2} />
              <Text style={S.ctaBtnText}>Generate Scripts</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Product picker overlay */}
      {showPicker && (
        <FadeInView duration={180} direction="none" style={S.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowPicker(false)} activeOpacity={1} />
          <ProductPickerSheet
            onPick={(choice) => {
              setProductChoice(choice);
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        </FadeInView>
      )}
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
  hdrIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center' },

  card: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, ...Shadow.soft,
  },
  cardLabel: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.2, marginBottom: 12 },

  urlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  urlInput: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary },

  productPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  productPickerIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  productPickerText: { flex: 1, ...T.medium, fontSize: 14, color: D.textDisabled },
  productPickerCheck: { width: 22, height: 22, borderRadius: 6, backgroundColor: D.successSubtle, alignItems: 'center', justifyContent: 'center' },

  brainNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: D.coralFaint, borderRadius: R.sm,
  },
  brainNoteText: { ...T.regular, fontSize: 12, color: D.coral, flex: 1 },

  watchFlag: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    marginHorizontal: 20, marginBottom: 14, padding: 14,
    backgroundColor: D.coralFaint, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.coral + '22',
  },
  watchFlagIcon: {
    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
    backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center',
  },
  watchFlagTitle: { ...T.bold, fontSize: 13, color: D.textPrimary, marginBottom: 3 },
  watchFlagText: { ...T.regular, fontSize: 12, color: D.textSecondary, lineHeight: 18 },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 20, marginBottom: 14, padding: 14,
    backgroundColor: D.errorSubtle, borderRadius: R.md,
    borderWidth: 1, borderColor: D.errorBorder,
  },
  errorText: { flex: 1, ...T.regular, fontSize: 13, color: D.error, lineHeight: 20 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: D.coral, borderRadius: R.full,
    marginHorizontal: 20, paddingVertical: 17, marginBottom: 20,
    ...Shadow.coral,
  },
  ctaBtnOff: { opacity: 0.35, shadowOpacity: 0 },
  ctaBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Results
  hooksCard: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16,
    marginBottom: 12, ...Shadow.soft,
  },
  hooksCardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  hooksIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center' },
  hooksCardTitle: { ...T.bold, fontSize: 14, color: D.textPrimary },
  hookItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  hookItemBorder: { borderBottomWidth: 1, borderBottomColor: D.divider },
  hookNum: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  hookNumText: { ...T.bold, fontSize: 11, color: D.coral },
  hookItemText: { flex: 1, ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 20 },

  stealCard: {
    backgroundColor: D.inkCard, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.inkCardBorder, padding: 18, marginBottom: 12,
  },
  stealHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stealTitle: { ...T.bold, fontSize: 13, color: D.lime },
  stealText: { ...T.medium, fontSize: 16, color: '#FFF', lineHeight: 26, fontStyle: 'italic' },

  sectionHeading: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.5, marginBottom: 12 },

  transcriptCard: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, marginBottom: 12, ...Shadow.soft,
  },
  transcriptHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  transcriptLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  transcriptHdrTitle: { ...T.medium, fontSize: 13, color: D.textSecondary },
  transcriptMeta: { backgroundColor: D.surface, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3 },
  transcriptMetaText: { ...T.regular, fontSize: 11, color: D.textMuted },
  transcriptChevron: {},
  transcriptChevronOpen: { transform: [{ rotate: '180deg' }] },
  transcriptDivider: { height: 1, backgroundColor: D.divider, marginVertical: 12 },
  transcriptText: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 22 },

  regenOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 20, backgroundColor: D.bg,
    borderTopWidth: 1, borderTopColor: D.divider,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,20,38,0.55)',
    justifyContent: 'flex-end',
  },
});

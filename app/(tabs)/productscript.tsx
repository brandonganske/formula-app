import { useLocalSearchParams } from 'expo-router';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Platform, Image, Alert, Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { parseProductParam, fromSaved, coverOf } from '@/lib/product-handoff';
import {
  VideoStyle, ContentTone, ProductScriptBody, ProductScriptResult,
  ProductScriptOption, ProductSearchResult, ProductSearchResponse, SavedProductItem } from '@/types/api';
import { D, T, R, Shadow, Ease, SectionLabelStyle } from '@/constants/ds';
import {
  Sparkles, Copy, Check, Search, X, ChevronDown,
  ShoppingBag, Brain, ChevronRight, ChevronLeft, RefreshCw, BookOpen,
  Laugh, Zap, Film, Eye, User, Mic, Camera, Save,
  MessageSquare, AlertTriangle, Info,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import NoCreditsModal from '@/components/NoCreditsModal';
import { CREDIT_COSTS, usesLabel } from '@/lib/iap/catalog';
import { notifyScriptUsed } from '@/lib/scripts-toast';
import AnimatedPressable from '@/components/AnimatedPressable';
import AfterSaveRow from '@/components/AfterSaveRow';
import { haptic } from '@/lib/haptics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
function fmtGMV(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Style / Tone config ──────────────────────────────────────────────────────

const VIDEO_STYLES: { id: VideoStyle; label: string; sub: string }[] = [
  { id: 'talking_head', label: 'Talking Head', sub: 'Face to camera' },
  { id: 'skit', label: 'Skit', sub: 'Acted dialogue' },
  { id: 'faceless', label: 'Faceless', sub: 'Voiceover + shots' },
];

const CONTENT_TONES: { id: ContentTone; label: string; sub: string }[] = [
  { id: 'educational', label: 'Educational', sub: 'Teach & inform' },
  { id: 'funny', label: 'Funny', sub: 'Humor & energy' },
  { id: 'serious', label: 'Serious', sub: 'Earnest & direct' },
];

// ─── Progress bar ─────────────────────────────────────────────────────────────

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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.coral, flexShrink: 0 },
  stepLabel: { flex: 1, ...T.medium, fontSize: 13, color: D.textPrimary },
  pctLabel: { ...T.bold, fontSize: 12, color: D.coral },
  track: { height: 6, borderRadius: 3, backgroundColor: D.coralSubtle, overflow: 'hidden', marginBottom: 10 },
  fill: { height: '100%', borderRadius: 3, backgroundColor: D.coral },
  hint: { ...T.regular, fontSize: 11, color: D.textMuted, textAlign: 'center' },
});

// ─── Product Search Sheet ─────────────────────────────────────────────────────

type ProductPick = { product: ProductSearchResult };

function ProductSearchSheet({
  onPick,
  onClose,
}: {
  onPick: (p: ProductPick) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery<ProductSearchResponse>({
    queryKey: ['product-search-script', searchQuery],
    queryFn: async () => {
      const body: Record<string, unknown> = { sort: 'trending', page: 1, pagesize: 20 };
      if (searchQuery.trim()) body.query = searchQuery.trim();
      const res = await api.post('/creators/product-search', body);
      return extractData<ProductSearchResponse>(res);
    },
    staleTime: 120_000,
  });

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(text), 550);
  }, []);

  // The creator's own shelf comes first — no need to search for a product
  // they already researched on the Products tab.
  const { data: savedRaw } = useQuery({
    queryKey: ['saved-products-lite'],
    queryFn: async () => {
      const res = await api.get('/creators/saved-products');
      return extractData<{ products?: SavedProductItem[] }>(res)?.products ?? [];
    },
    staleTime: 60_000,
  });
  const saved = (savedRaw ?? []).map(fromSaved);

  return (
    <FadeInView direction="up" style={PS.panel}>
      <View style={PS.hdr}>
        <Text style={PS.hdrTitle}>Find a Product</Text>
        <TouchableOpacity onPress={onClose} style={PS.closeBtn} hitSlop={12}>
          <X size={18} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={PS.searchRow}>
        <View style={PS.searchBox}>
          <Search size={14} color={D.textDisabled} strokeWidth={2} />
          <TextInput
            style={PS.searchInput}
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!query && saved.length > 0 && (
          <>
            <Text style={PS.browseLabel}>Your saved products</Text>
            {saved.map((p) => (
              <TouchableOpacity key={'s-' + p.external_id} style={PS.item} onPress={() => onPick({ product: p })} activeOpacity={0.8}>
                {coverOf(p) ? (
                  <Image source={{ uri: coverOf(p)! }} style={PS.thumb} resizeMode="cover" />
                ) : (
                  <View style={[PS.thumb, PS.thumbFallback]}><ShoppingBag size={14} color={D.textDisabled} strokeWidth={1.5} /></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={PS.itemTitle} numberOfLines={2}>{p.title}</Text>
                  {p.commission_rate != null && <Text style={PS.itemSub}>{fmtPct(p.commission_rate)} commission</Text>}
                </View>
                <View style={PS.selectBtn}><Text style={PS.selectBtnText}>Use</Text></View>
              </TouchableOpacity>
            ))}
          </>
        )}
        {!query && (
          <Text style={[PS.browseLabel, saved.length > 0 && { marginTop: 18 }]}>Trending products</Text>
        )}
        {(data?.products ?? []).map((p) => (
          <TouchableOpacity
            key={p.external_id}
            style={PS.item}
            onPress={() => onPick({ product: p })}
            activeOpacity={0.8}
          >
            {coverOf(p) ? (
              <Image source={{ uri: coverOf(p)! }} style={PS.thumb} resizeMode="cover" />
            ) : (
              <View style={[PS.thumb, PS.thumbFallback]}>
                <ShoppingBag size={14} color={D.textDisabled} strokeWidth={1.5} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={PS.itemTitle} numberOfLines={2}>{p.title}</Text>
              {p.commission_rate != null && (
                <Text style={PS.itemSub}>
                  {fmtPct(p.commission_rate)} commission · {fmtGMV(p.day7_gmv)} 7d GMV
                </Text>
              )}
            </View>
            <View style={PS.selectBtn}>
              <Text style={PS.selectBtnText}>Use</Text>
            </View>
          </TouchableOpacity>
        ))}
        {data?.products?.length === 0 && !isLoading && query.trim() && (
          <View style={PS.emptyState}>
            <Search size={20} color={D.textDisabled} strokeWidth={1.5} />
            <Text style={PS.emptyText}>No products found for "{query}"</Text>
          </View>
        )}
      </ScrollView>
    </FadeInView>
  );
}

const PS = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.border, height: '75%',
    ...Shadow.card,
  },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  hdrTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 7,
  },
  searchInput: { flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary },
  browseLabel: {
    ...T.bold, fontSize: 10, color: D.textDisabled,
    letterSpacing: 1.2, marginTop: 4, marginBottom: 8,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  thumb: { width: 44, height: 44, borderRadius: 10, flexShrink: 0 },
  thumbFallback: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { ...T.medium, fontSize: 13, color: D.textPrimary, lineHeight: 18, marginBottom: 3 },
  itemSub: { ...T.regular, fontSize: 11, color: D.textMuted },
  selectBtn: {
    backgroundColor: D.coralSubtle, borderRadius: R.full, borderWidth: 1,
    borderColor: D.coral + '30', paddingHorizontal: 12, paddingVertical: 5,
  },
  selectBtnText: { ...T.bold, fontSize: 12, color: D.coral },
  emptyState: { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyText: { ...T.regular, fontSize: 14, color: D.textMuted },
});

// ─── Option Card ──────────────────────────────────────────────────────────────

function OptionCard({
  option,
  index,
  videoStyle,
  productName,
  productId,
}: {
  option: ProductScriptOption;
  index: number;
  videoStyle: VideoStyle;
  productName: string;
  productId?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showHookAnalysis, setShowHookAnalysis] = useState(false);
  const queryClient = useQueryClient();

  const handleCopy = async () => {
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
        product_name: productName,
        product_id: productId ?? undefined,
        title: option.label,
        origin: 'product_script',
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

  return (
    <FadeInView delay={index * 90} style={OC.card}>
      {/* Header row */}
      <TouchableOpacity style={OC.hdr} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={OC.labelRow}>
          <View style={[OC.numBadge, index === 0 && OC.numBadgePrimary]}>
            <Text style={[OC.numText, index === 0 && OC.numTextPrimary]}>{index + 1}</Text>
          </View>
          <Text style={OC.labelText}>{option.label}</Text>
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
          {option.hook_analysis?.why_it_works && (
            <TouchableOpacity
              style={OC.hookAnalysisToggle}
              onPress={() => setShowHookAnalysis((v) => !v)}
              activeOpacity={0.8}
            >
              <Info size={11} color={D.coral} strokeWidth={2} />
              <Text style={OC.hookAnalysisToggleText}>
                {showHookAnalysis ? 'Hide analysis' : 'Why it works'}
              </Text>
            </TouchableOpacity>
          )}
          {showHookAnalysis && option.hook_analysis && (
            <FadeInView direction="none" duration={200} style={OC.hookAnalysis}>
              {option.hook_analysis.why_it_works && (
                <Text style={OC.hookAnalysisText}>{option.hook_analysis.why_it_works}</Text>
              )}
              {option.hook_analysis.psychology && (
                <View style={OC.psychologyRow}>
                  <Text style={OC.psychologyLabel}>PSYCHOLOGY</Text>
                  <Text style={OC.psychologyText}>{option.hook_analysis.psychology}</Text>
                </View>
              )}
            </FadeInView>
          )}
        </View>
      ) : null}

      {/* Expanded body */}
      {expanded && (
        <FadeInView direction="none" duration={200}>
          <View style={OC.divider} />

          {/* Talking head / faceless voiceover — body lines */}
          {(videoStyle === 'talking_head' || videoStyle === 'faceless') && option.body?.length > 0 && (
            <View style={OC.section}>
              {videoStyle === 'faceless' && (
                <View style={OC.sectionHdrRow}>
                  <Mic size={11} color={D.textMuted} strokeWidth={2} />
                  <Text style={OC.sectionHdrText}>VOICEOVER</Text>
                </View>
              )}
              {option.body.map((line, i) => (
                <Text key={i} style={OC.bodyLine}>{line}</Text>
              ))}
            </View>
          )}

          {/* Skit — dialogue lines */}
          {videoStyle === 'skit' && option.dialogue?.length > 0 && (
            <View style={OC.section}>
              <View style={OC.sectionHdrRow}>
                <MessageSquare size={11} color={D.textMuted} strokeWidth={2} />
                <Text style={OC.sectionHdrText}>DIALOGUE</Text>
              </View>
              {option.dialogue.map((line, i) => (
                <View key={i} style={OC.dialogueLine}>
                  <Text style={OC.dialogueSpeaker}>{line.speaker}</Text>
                  <Text style={OC.dialogueText}>{line.line}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Faceless — shot list */}
          {videoStyle === 'faceless' && option.shot_list?.length > 0 && (
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
          )}

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
              <Zap size={12} color={D.lime} strokeWidth={2} />
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
                <ActivityIndicator size="small" color={D.coral} />
              ) : saved ? (
                <><Check size={13} color={D.success} strokeWidth={2.5} /><Text style={[OC.saveBtnText, { color: D.success }]}>Saved</Text></>
              ) : (
                <><Save size={13} color={D.coral} strokeWidth={2} /><Text style={OC.saveBtnText}>Save</Text></>
              )}
            </AnimatedPressable>
          </View>
          {saved && savedId ? <AfterSaveRow scriptId={savedId} /> : null}
        </FadeInView>
      )}
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

  // Hook
  hookRow: {
    marginTop: 12, backgroundColor: D.coralFaint,
    borderRadius: R.sm, padding: 12, borderLeftWidth: 3, borderLeftColor: D.coral,
  },
  hookLabel: {
    ...T.bold, fontSize: 10, color: D.coral,
    letterSpacing: 1.2, marginBottom: 5,
  },
  hookText: {
    ...T.medium, fontSize: 14, color: D.textPrimary,
    lineHeight: 21, fontStyle: 'italic',
  },
  hookAnalysisToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
  },
  hookAnalysisToggleText: { ...T.medium, fontSize: 11, color: D.coral },
  hookAnalysis: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,55,85,0.15)',
    gap: 8,
  },
  hookAnalysisText: {
    ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18,
  },
  psychologyRow: { gap: 3 },
  psychologyLabel: {
    ...T.bold, fontSize: 10, color: D.coral,
    letterSpacing: 1.2, opacity: 0.7,
  },
  psychologyText: { ...T.regular, fontSize: 12, color: D.inkSoft, lineHeight: 18 },

  // Expanded sections
  divider: { height: 1, backgroundColor: D.divider, marginVertical: 14 },
  section: { marginBottom: 14, gap: 6 },
  sectionHdrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2,
  },
  sectionHdrText: {
    ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 1.2,
  },
  bodyLine: {
    ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 23,
  },
  dialogueLine: {
    flexDirection: 'row', gap: 10, paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  dialogueSpeaker: {
    ...T.bold, fontSize: 12, color: D.coral, width: 68, flexShrink: 0, marginTop: 1,
  },
  dialogueText: {
    flex: 1, ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 22,
  },
  shotRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  shotNum: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  shotNumText: { ...T.bold, fontSize: 10, color: D.textMuted },
  shotText: { flex: 1, ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 20 },

  // CTA + why
  ctaRow: {
    backgroundColor: D.inkCard, borderRadius: R.md, padding: 12, marginBottom: 12,
  },
  ctaLabel: {
    ...T.bold, fontSize: 9, color: D.lime, letterSpacing: 1.2, marginBottom: 4,
  },
  ctaText: { ...T.medium, fontSize: 13, color: '#FFF', lineHeight: 20 },
  whyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: D.limeSubtle, borderRadius: R.sm, padding: 10, marginBottom: 14,
  },
  whyText: {
    flex: 1, ...T.regular, fontSize: 12,
    color: D.limeDeep, lineHeight: 18, marginTop: 1,
  },

  // Actions
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
    backgroundColor: D.coralSubtle, borderWidth: 1, borderColor: D.coral + '30',
    minHeight: 40,
  },
  saveBtnDone: {
    backgroundColor: D.successSubtle, borderColor: D.successBorder,
  },
  saveBtnText: { ...T.bold, fontSize: 13, color: D.coral },
});

// ─── Segment Picker ───────────────────────────────────────────────────────────

function SegmentPicker<T extends string>({
  options,
  value,
  onChange,
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
  btnActive: {
    backgroundColor: D.coralSubtle, borderColor: D.coral,
  },
  label: { ...T.bold, fontSize: 12, color: D.textMuted, marginBottom: 2 },
  labelActive: { color: D.coral },
  sub: { ...T.regular, fontSize: 10, color: D.textDisabled, textAlign: 'center' },
  subActive: { color: D.coral + 'AA' },
});

// ─── Voice Meta Strip ─────────────────────────────────────────────────────────

function VoiceStrip({ voiceUsed, genderUsed }: { voiceUsed: { tone: string; sentence_style: string; sample_voice: string }; genderUsed: string }) {
  const chips = [
    { icon: <Mic size={11} color={D.textMuted} strokeWidth={2} />, label: voiceUsed.tone },
    { icon: <User size={11} color={D.textMuted} strokeWidth={2} />, label: genderUsed },
  ].filter((c) => c.label);

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
  label: { ...T.bold, fontSize: 9, color: D.textDisabled, letterSpacing: 1.2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: D.surface, borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: D.border,
  },
  chipText: { ...T.medium, fontSize: 11, color: D.textSecondary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProductScriptScreen() {
  const { credits, canAfford, refreshMe } = useAuth();
  const { product: productParamRaw } = useLocalSearchParams<{ product?: string }>();
  const [product, setProduct] = useState<ProductSearchResult | null>(() => parseProductParam(productParamRaw));
  const [videoStyle, setVideoStyle] = useState<VideoStyle | null>(null);
  const [contentTone, setContentTone] = useState<ContentTone | null>(null);
  const [direction, setDirection] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [result, setResult] = useState<ProductScriptResult | null>(null);
  const [showNoCredits, setShowNoCredits] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scriptMutation = useMutation({
    mutationFn: async () => {
      if (!product || !videoStyle || !contentTone) throw new Error('Fill in all fields');
      const raw = product as any;
      const body: ProductScriptBody = {
        product: {
          brain_external_id: product.external_id,
          region: product.region,
          search_product: {
            ...raw,
            cover: raw.cover ?? product.cover_url ?? null,
          },
        },
        video_style: videoStyle,
        content_tone: contentTone,
        ...(direction.trim() ? { direction: direction.trim() } : {}),
      };
      const res = await api.post('/creators/product-script', body, { timeout: 300_000 });
      return extractData<ProductScriptResult>(res);
    },
    onSuccess: (data) => {
      if (data) {
        setResult(data);
        refreshMe().then(() => notifyScriptUsed(CREDIT_COSTS.script));
        // Jump to the top so the freshly generated scripts are front-and-center
        // instead of populating below the fold where they get missed.
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
      }
    },
  });

  const canSubmit = product != null && videoStyle != null && contentTone != null && !scriptMutation.isPending;

  const handleReset = () => {
    setResult(null);
    scriptMutation.reset();
  };

  return (
    <View style={S.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={S.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── FORM (hidden once scripts are generated) ─────────────────────── */}
        {!result && (
        <>
        {/* Header */}
        <View style={S.hdr}>
          <View>
            <Text style={S.hdrTitle}>Write Script</Text>
            <Text style={S.hdrSub}>3 original scripts built around your voice.</Text>
          </View>
          <View style={S.hdrIcon}>
            <Sparkles size={18} color={D.coral} strokeWidth={2} />
          </View>
        </View>

        {/* ── Product ─────────────────────────────────────────────────────── */}
        <FadeInView style={S.card}>
          <Text style={S.cardLabel}>PRODUCT TO PROMOTE</Text>
          <TouchableOpacity
            style={S.productPicker}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.8}
          >
            {product?.cover_url ? (
              <Image source={{ uri: product.cover_url }} style={S.productThumb} resizeMode="cover" />
            ) : (
              <View style={[S.productThumb, S.productThumbEmpty]}>
                <ShoppingBag size={14} color={product ? D.coral : D.textDisabled} strokeWidth={1.5} />
              </View>
            )}
            <Text style={[S.productPickerText, product && { color: D.textPrimary }]} numberOfLines={1}>
              {product ? product.title : 'Search for a product...'}
            </Text>
            {product ? (
              <View style={S.productCheck}>
                <Check size={12} color={D.success} strokeWidth={2.5} />
              </View>
            ) : (
              <ChevronRight size={15} color={D.textDisabled} strokeWidth={2} />
            )}
          </TouchableOpacity>
          {product && (
            <TouchableOpacity
              style={S.changeProductBtn}
              onPress={() => { setProduct(null); setResult(null); scriptMutation.reset(); }}
              hitSlop={8}
            >
              <Text style={S.changeProductText}>Change product</Text>
            </TouchableOpacity>
          )}
        </FadeInView>

        {/* ── Video Style ──────────────────────────────────────────────────── */}
        <FadeInView delay={60} style={S.card}>
          <Text style={S.cardLabel}>VIDEO TYPE</Text>
          <SegmentPicker
            options={VIDEO_STYLES}
            value={videoStyle}
            onChange={(v) => { setVideoStyle(v); setResult(null); scriptMutation.reset(); }}
          />
        </FadeInView>

        {/* ── Content Tone ─────────────────────────────────────────────────── */}
        <FadeInView delay={120} style={S.card}>
          <Text style={S.cardLabel}>CONTENT TONE</Text>
          <SegmentPicker
            options={CONTENT_TONES}
            value={contentTone}
            onChange={(v) => { setContentTone(v); setResult(null); scriptMutation.reset(); }}
          />
        </FadeInView>

        {/* ── Direction ────────────────────────────────────────────────────── */}
        <FadeInView delay={180} style={S.card}>
          <Text style={S.cardLabel}>DIRECTION <Text style={S.optionalLabel}>(OPTIONAL)</Text></Text>
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

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {scriptMutation.isError && (
          <FadeInView direction="none" duration={200} style={S.errorBox}>
            <AlertTriangle size={14} color={D.error} strokeWidth={2} />
            <Text style={S.errorText}>
              {(scriptMutation.error as any)?.response?.data?.error?.message
                ?? (scriptMutation.error as any)?.message
                ?? 'Something went wrong. Try again.'}
            </Text>
          </FadeInView>
        )}

        <GeneratingProgress visible={scriptMutation.isPending} />

        {/* ── Generate CTA ─────────────────────────────────────────────────── */}
        <AnimatedPressable
          style={[S.ctaBtn, !canSubmit && S.ctaBtnOff]}
          onPress={() => {
            if (!canAfford(CREDIT_COSTS.script)) { setShowNoCredits(true); return; }
            scriptMutation.mutate();
          }}
          disabled={!canSubmit}
          haptic="medium"
        >
          {scriptMutation.isPending ? (
            <View style={S.loadingRow}>
              <ActivityIndicator color="#FFF" size="small" />
              <Text style={S.ctaBtnText}>Generating scripts… this may take a minute</Text>
            </View>
          ) : (
            <>
              <Sparkles size={17} color="#FFF" strokeWidth={2} />
              <Text style={S.ctaBtnText}>Generate 3 Scripts</Text>
            </>
          )}
        </AnimatedPressable>
        </>
        )}

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {result && (
          <FadeInView delay={80} style={{ width: '100%' }}>

            {/* Results page header with back-to-form */}
            <View style={S.resultHdr}>
              <TouchableOpacity style={S.backBtn} onPress={handleReset} hitSlop={10} activeOpacity={0.7}>
                <ChevronLeft size={18} color={D.textPrimary} strokeWidth={2.2} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={S.resultHdrTitle}>Your 3 Scripts</Text>
                <Text style={S.resultHdrSub}>Built around your voice — tap a card to expand.</Text>
              </View>
            </View>

            {/* Product context */}
            <View style={S.resultProduct}>
              {result.product?.brain?.cover_url ? (
                <Image source={{ uri: result.product.brain.cover_url }} style={S.resultThumb} />
              ) : (
                <View style={[S.resultThumb, { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' }]}>
                  <ShoppingBag size={13} color={D.textDisabled} strokeWidth={1.5} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={S.resultProductName} numberOfLines={1}>{result.product.name}</Text>
                {result.product.category && (
                  <Text style={S.resultProductCat}>{result.product.category}</Text>
                )}
              </View>
              {result.product.usedFallback && (
                <View style={S.fallbackBadge}>
                  <AlertTriangle size={10} color={D.warning} strokeWidth={2} />
                  <Text style={S.fallbackText}>Limited intel</Text>
                </View>
              )}
            </View>

            {/* Voice strip */}
            {result.voiceUsed && (
              <VoiceStrip voiceUsed={result.voiceUsed} genderUsed={result.genderUsed} />
            )}

            {/* Option cards */}
            {result.options.map((opt, i) => (
              <OptionCard
                key={i}
                option={opt}
                index={i}
                videoStyle={result.videoStyle}
                productName={result.product.name}
                productId={result.product.id}
              />
            ))}

            {/* Regenerate */}
            <TouchableOpacity
              style={S.regenBtn}
              onPress={() => {
                if (!canAfford(CREDIT_COSTS.script)) { setShowNoCredits(true); return; }
                handleReset(); setTimeout(() => scriptMutation.mutate(), 50);
              }}
              disabled={scriptMutation.isPending}
              activeOpacity={0.75}
            >
              <RefreshCw size={13} color={D.coral} strokeWidth={2} />
              <Text style={S.regenText}>Regenerate</Text>
            </TouchableOpacity>
          </FadeInView>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Product picker overlay */}
      {showPicker && (
        <FadeInView direction="none" duration={180} style={S.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowPicker(false)} activeOpacity={1} />
          <ProductSearchSheet
            onPick={({ product: p }) => {
              setProduct(p);
              setResult(null);
              scriptMutation.reset();
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

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingBottom: 40 },

  hdr: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
  },
  hdrTitle: { ...T.bold, fontSize: 24, color: D.textPrimary, letterSpacing: -0.5 },
  hdrSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 3 },
  hdrIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center',
  },

  card: {
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16,
    ...Shadow.soft,
  },
  cardLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 12 },
  optionalLabel: { ...T.regular, fontSize: 10, color: D.textDisabled, letterSpacing: 0.5 },

  productPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  productThumb: { width: 32, height: 32, borderRadius: 8, flexShrink: 0 },
  productThumbEmpty: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  productPickerText: { flex: 1, ...T.medium, fontSize: 14, color: D.textDisabled },
  productCheck: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: D.successSubtle, alignItems: 'center', justifyContent: 'center',
  },
  changeProductBtn: { marginTop: 8, alignSelf: 'flex-end' },
  changeProductText: { ...T.medium, fontSize: 12, color: D.coral },

  directionInput: {
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 12, ...T.regular, fontSize: 14, color: D.textPrimary,
    lineHeight: 22, minHeight: 90,
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
    backgroundColor: D.coral, borderRadius: R.full,
    marginHorizontal: 20, paddingVertical: 17, marginBottom: 28,
    ...Shadow.coral,
  },
  ctaBtnOff: { opacity: 0.35 },
  ctaBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  resultProduct: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border,
    padding: 10,
  },
  resultThumb: { width: 36, height: 36, borderRadius: 9 },
  resultProductName: { ...T.bold, fontSize: 13, color: D.textPrimary },
  resultProductCat: { ...T.regular, fontSize: 11, color: D.textMuted, marginTop: 1 },
  fallbackBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: D.warningSubtle, borderRadius: R.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  fallbackText: { ...T.medium, fontSize: 10, color: D.warning },

  sectionHeading: {
    ...T.bold, fontSize: 10, color: D.textDisabled,
    letterSpacing: 1.5, marginHorizontal: 20, marginBottom: 12,
  },
  resultHdr: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: D.card, borderWidth: 1, borderColor: D.cardBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...Shadow.soft,
  },
  resultHdrTitle: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  resultHdrSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 2 },

  regenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 20, paddingVertical: 14,
    borderWidth: 1, borderColor: D.coral + '35', borderRadius: R.full,
    backgroundColor: D.coralFaint,
  },
  regenText: { ...T.medium, fontSize: 14, color: D.coral },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,20,38,0.55)',
    justifyContent: 'flex-end',
  },
});

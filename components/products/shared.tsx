// Shared building blocks for the Products tab and the Saved → Products view:
// the learn panel, product rows, saved cards, folder modals' styles.
import { useRouter } from 'expo-router';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, FlatList, KeyboardAvoidingView,
  Platform, Modal, Pressable, Keyboard, Alert,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { toSearchResult, productParam, coverOf } from '@/lib/product-handoff';
import { useAuth } from '@/context/AuthContext';
import {
  ProductSearchResult, ProductSearchResponse, ProductSearchSort,
  ProductEngineResult, ProductEngineLearn, SavedProductItem, ProductFolder,
} from '@/types/api';
import { D, T, R, Shadow, Gradient, SectionLabelStyle, FOLDER_COLORS } from '@/constants/ds';
import {
  Search, ShoppingBag, X, BookmarkPlus, Bookmark,
  ChevronDown, ChevronRight, Copy, Check, Trash2,
  Zap, AlertCircle, FolderOpen, FolderPlus, Folder, PenLine } from 'lucide-react-native';
import { Skeleton } from '@/components/Skeleton';

// ── helpers ────────────────────────────────────────────────────────────────

export function fmt(n: number | null | undefined, prefix = '$'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

export function copyText(text: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  } catch {}
}

export const SORT_OPTIONS: { key: ProductSearchSort; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'top_gmv', label: 'Top GMV' },
  { key: 'commission', label: 'Commission' },
  { key: 'popular', label: 'Popular' },
];

// ── Inline SVG glyphs ──────────────────────────────────────────────────────

export function ProductGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 32 32" fill="none">
      <Rect x={6}  y={9}    width={14}  height={2.6} rx={1.3} fill="#fff" />
      <Rect x={6}  y={15}   width={10}  height={2.6} rx={1.3} fill="#fff" />
      <Rect x={6}  y={21}   width={6.5} height={2.6} rx={1.3} fill="#fff" />
      <Rect x={18} y={19.5} width={2.6} height={5.5} rx={1.3} fill="#B6FF8A" />
    </Svg>
  );
}

export function GlobeIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={D.coral} strokeWidth={2.2} />
      <Path d="M3 12h18" stroke={D.coral} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke={D.coral} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Normalized panel data ──────────────────────────────────────────────────

export interface PanelSource {
  externalId: string;
  title: string;
  imageUrl?: string | null;
  price?: number | null;
  commissionRate?: number | null;
  day7Gmv?: number | null;
  totalUnitsSold?: number | null;
  productUrl?: string | null;
  brainId?: string | null;
  learn: ProductEngineLearn;
  savedId?: string | null;
}

export function fromEngineResult(r: ProductEngineResult): PanelSource {
  return {
    externalId: r.product.external_id,
    title: r.product.title,
    imageUrl: r.product.cover,
    price: r.product.price,
    commissionRate: r.product.commission_rate,
    day7Gmv: r.product.day7_gmv,
    totalUnitsSold: r.product.total_units_sold,
    productUrl: r.product.product_url,
    brainId: r.brainId,
    learn: r.learn,
  };
}

export function fromSavedItem(s: SavedProductItem): PanelSource {
  return {
    externalId: s.external_id,
    title: s.title,
    imageUrl: s.image_url,
    price: s.price,
    commissionRate: s.commission_rate,
    day7Gmv: null,
    totalUnitsSold: null,
    productUrl: s.product_url,
    brainId: s.product_brain_id,
    learn: s.learn,
    savedId: s.id,
  };
}

// ── Learn panel sub-components ─────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={LP.sectionLabel}>{children.toUpperCase()}</Text>;
}

function TalkingPointRow({ point, why, index }: { point: string; why: string; index: number }) {
  return (
    <FadeInView delay={index * 30} style={LP.tpRow}>
      <View style={LP.tpDot} />
      <View style={LP.tpBody}>
        <Text style={LP.tpPoint}>{point}</Text>
        <Text style={LP.tpWhy}>{why}</Text>
      </View>
    </FadeInView>
  );
}

function FaqRow({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <View style={LP.faqRow}>
      <TouchableOpacity style={LP.faqHeader} onPress={onToggle} activeOpacity={0.72}>
        <Text style={LP.faqQ} numberOfLines={open ? undefined : 2}>{q}</Text>
        {open
          ? <ChevronDown size={15} color={D.textMuted} strokeWidth={2} />
          : <ChevronRight size={15} color={D.textMuted} strokeWidth={2} />
        }
      </TouchableOpacity>
      {open && <Text style={LP.faqA}>{a}</Text>}
    </View>
  );
}

function QuickPitchCard({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={LP.pitchCard}>
      <Text style={LP.pitchText}>{text}</Text>
      <TouchableOpacity style={[LP.copyBtn, copied && LP.copyBtnDone]} onPress={handleCopy} activeOpacity={0.8}>
        {copied
          ? <Check size={13} color={D.success} strokeWidth={2.5} />
          : <Copy size={13} color={D.textMuted} strokeWidth={2} />
        }
        <Text style={[LP.copyBtnText, copied && { color: D.success }]}>
          {copied ? 'Copied' : 'Copy'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Learn panel ────────────────────────────────────────────────────────────

export function LearnPanel({
  source, onClose, onSave, onUnsave, saving, unsaving, saveError,
}: {
  source: PanelSource;
  onClose: () => void;
  onSave: () => void;
  onUnsave: () => void;
  saving: boolean;
  unsaving: boolean;
  saveError?: string | null;
}) {
  const router = useRouter();
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());
  const { learn } = source;
  const isSaved = !!source.savedId;

  const toggleFaq = (i: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <FadeInView direction="up" style={LP.panel}>
      <View style={LP.hdr}>
        <View style={LP.hdrLeft}>
          {source.imageUrl ? (
            <Image source={{ uri: source.imageUrl }} style={LP.cover} resizeMode="cover" />
          ) : (
            <View style={[LP.cover, LP.coverEmpty]}>
              <ShoppingBag size={18} color={D.textDisabled} strokeWidth={1.5} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={LP.hdrTitle} numberOfLines={2}>{source.title}</Text>
          </View>
        </View>
        <TouchableOpacity style={LP.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={18} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={LP.statsRow}>
        <View style={LP.statCell}>
          <Text style={LP.statVal}>{fmt(source.price)}</Text>
          <Text style={LP.statLbl}>Price</Text>
        </View>
        <View style={LP.statDivider} />
        <View style={LP.statCell}>
          <Text style={[LP.statVal, { color: D.success }]}>{fmtPct(source.commissionRate)}</Text>
          <Text style={LP.statLbl}>Commission</Text>
        </View>
        {source.day7Gmv != null && (
          <>
            <View style={LP.statDivider} />
            <View style={LP.statCell}>
              <Text style={[LP.statVal, { color: D.coral }]}>{fmt(source.day7Gmv)}</Text>
              <Text style={LP.statLbl}>7d GMV</Text>
            </View>
          </>
        )}
        {source.totalUnitsSold != null && (
          <>
            <View style={LP.statDivider} />
            <View style={LP.statCell}>
              <Text style={LP.statVal}>{fmt(source.totalUnitsSold, '')}</Text>
              <Text style={LP.statLbl}>Units Sold</Text>
            </View>
          </>
        )}
      </View>

      <ScrollView style={LP.scroll} contentContainerStyle={LP.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={LP.oneLiner}>{learn.one_liner}</Text>
        <Text style={LP.explainer}>{learn.explainer}</Text>

        {learn.talking_points?.length > 0 && (
          <View style={LP.section}>
            <SectionLabel>Talking Points</SectionLabel>
            {learn.talking_points.map((tp, i) => (
              <TalkingPointRow key={i} point={tp.point} why={tp.why_it_lands} index={i} />
            ))}
          </View>
        )}

        {learn.key_things_to_know?.length > 0 && (
          <View style={LP.section}>
            <SectionLabel>Key Things to Know</SectionLabel>
            {learn.key_things_to_know.map((item, i) => (
              <View key={i} style={LP.bulletRow}>
                <View style={LP.bulletDot} />
                <Text style={LP.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {learn.who_its_for ? (
          <View style={LP.section}>
            <SectionLabel>Who It's For</SectionLabel>
            <View style={LP.whoCard}>
              <Text style={LP.whoText}>{learn.who_its_for}</Text>
            </View>
          </View>
        ) : null}

        {learn.faqs?.length > 0 && (
          <View style={LP.section}>
            <SectionLabel>FAQs</SectionLabel>
            <View style={LP.faqList}>
              {learn.faqs.map((faq, i) => (
                <FaqRow key={i} q={faq.q} a={faq.a} open={openFaqs.has(i)} onToggle={() => toggleFaq(i)} />
              ))}
            </View>
          </View>
        )}

        {learn.quick_pitch ? (
          <View style={LP.section}>
            <SectionLabel>Quick Pitch</SectionLabel>
            <QuickPitchCard text={learn.quick_pitch} />
          </View>
        ) : null}

        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={LP.footer}>
        <TouchableOpacity
          style={LP.scriptBtn}
          activeOpacity={0.88}
          onPress={() => {
            const product = toSearchResult({
              external_id: source.externalId, title: source.title, cover_url: source.imageUrl ?? null,
              price: source.price ?? null, commission_rate: source.commissionRate ?? null,
              day7_gmv: source.day7Gmv ?? null, total_units_sold: source.totalUnitsSold ?? null,
              product_url: source.productUrl ?? null,
            });
            onClose();
            router.push({ pathname: '/(tabs)/productscript', params: { product: productParam(product) } });
          }}
        >
          <PenLine size={16} color="#FFF" strokeWidth={2.4} />
          <Text style={LP.scriptBtnText}>Write a script for this</Text>
        </TouchableOpacity>
        {saveError && (
          <View style={LP.saveErrRow}>
            <AlertCircle size={13} color={D.error} strokeWidth={2} />
            <Text style={LP.saveErrTxt} numberOfLines={2}>{saveError}</Text>
          </View>
        )}
        {isSaved ? (
          <View style={LP.savedRow}>
            <View style={LP.savedBadge}>
              <Bookmark size={15} color={D.coral} strokeWidth={2} fill={D.coral} />
              <Text style={LP.savedBadgeText}>Saved to Profile</Text>
            </View>
            <TouchableOpacity style={LP.unsaveBtn} onPress={onUnsave} disabled={unsaving} activeOpacity={0.75}>
              {unsaving
                ? <ActivityIndicator size={12} color={D.error} />
                : <><Trash2 size={13} color={D.error} strokeWidth={2} /><Text style={LP.unsaveTxt}>Remove</Text></>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={LP.saveBtn} onPress={onSave} disabled={saving} activeOpacity={0.88}>
            <LinearGradient
              colors={Gradient.heroCompact}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {saving
              ? <ActivityIndicator color="#FFF" size="small" />
              : <><BookmarkPlus size={17} color="#FFF" strokeWidth={2} /><Text style={LP.saveBtnText}>Save to Profile</Text></>
            }
          </TouchableOpacity>
        )}
      </View>
    </FadeInView>
  );
}

export const LP = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: D.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: D.border,
    maxHeight: '92%',
    ...Shadow.card,
  },
  hdr: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: 20, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  hdrLeft: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cover: { width: 56, height: 56, borderRadius: 12, flexShrink: 0 },
  coverEmpty: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, lineHeight: 20, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: D.surface,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.3 },
  statLbl: { ...T.regular, fontSize: 11, color: D.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: D.divider },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  oneLiner: { ...T.bold, fontSize: 18, color: D.coral, letterSpacing: -0.3, lineHeight: 26, marginBottom: 12 },
  explainer: { ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 22, marginBottom: 24 },
  section: { marginBottom: 22 },
  sectionLabel: {
    ...T.bold, ...SectionLabelStyle, marginBottom: 12,
  },
  tpRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  tpDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.coral, marginTop: 6, flexShrink: 0 },
  tpBody: { flex: 1 },
  tpPoint: { ...T.bold, fontSize: 14, color: D.textPrimary, lineHeight: 20, marginBottom: 3 },
  tpWhy: { ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 19 },
  bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  bulletDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: D.textDisabled, marginTop: 8, flexShrink: 0 },
  bulletText: { flex: 1, ...T.regular, fontSize: 14, color: D.textSecondary, lineHeight: 21 },
  whoCard: { backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border, padding: 14 },
  whoText: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 21 },
  faqList: { backgroundColor: D.card, borderRadius: R.lg, borderWidth: 1, borderColor: D.border, overflow: 'hidden' },
  faqRow: { borderBottomWidth: 1, borderBottomColor: D.divider },
  faqHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13, justifyContent: 'space-between',
  },
  faqQ: { flex: 1, ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 20 },
  faqA: { ...T.regular, fontSize: 13, color: D.textSecondary, lineHeight: 20, paddingHorizontal: 14, paddingBottom: 13 },
  pitchCard: { backgroundColor: D.surface, borderRadius: R.md, borderWidth: 1, borderColor: D.border, padding: 14, gap: 12 },
  pitchText: { ...T.regular, fontSize: 14, color: D.textPrimary, lineHeight: 22, fontStyle: 'italic' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.full,
    backgroundColor: D.card, borderWidth: 1, borderColor: D.border,
  },
  copyBtnDone: { borderColor: D.successBorder, backgroundColor: D.successSubtle },
  copyBtnText: { ...T.bold, fontSize: 12, color: D.textMuted },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: D.divider, gap: 10 },
  scriptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: D.ink, borderRadius: R.full, paddingVertical: 15,
  },
  scriptBtnText: { ...T.bold, fontSize: 16, color: '#FFF', letterSpacing: -0.2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingVertical: 16, borderRadius: R.full, overflow: 'hidden',
  },
  saveBtnText: { ...T.bold, fontSize: 16, color: '#FFF' },
  savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: D.coralSubtle, borderRadius: R.full, borderWidth: 1, borderColor: D.coral + '30',
  },
  savedBadgeText: { ...T.bold, fontSize: 14, color: D.coral },
  unsaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: R.full,
    backgroundColor: D.errorSubtle, borderWidth: 1, borderColor: D.errorBorder,
  },
  unsaveTxt: { ...T.bold, fontSize: 13, color: D.error },
  saveErrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: D.errorSubtle, borderRadius: R.md,
    borderWidth: 1, borderColor: D.errorBorder,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10,
  },
  saveErrTxt: { flex: 1, ...T.regular, fontSize: 12, color: D.error, lineHeight: 17 },
});

// ── Loading panel ──────────────────────────────────────────────────────────

export function LoadingPanel({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <FadeInView direction="up" style={LP.panel}>
      <View style={LP.hdr}>
        <View style={LP.hdrLeft}>
          <View style={[LP.cover, LP.coverEmpty]}>
            <ShoppingBag size={18} color={D.textDisabled} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={LP.hdrTitle} numberOfLines={2}>{title}</Text>
          </View>
        </View>
        <TouchableOpacity style={LP.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={18} color={D.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
        <ActivityIndicator color={D.coral} size="large" />
        <Text style={{ ...T.bold, fontSize: 16, color: D.textPrimary }}>Building product intel...</Text>
        <Text style={{ ...T.regular, fontSize: 13, color: D.textMuted, textAlign: 'center', lineHeight: 20 }}>
          The engine is analyzing this product. First-time products take up to 60 seconds.
        </Text>
      </View>
    </FadeInView>
  );
}

// ── Product search result row ──────────────────────────────────────────────

export function ProductRow({
  product, onLearn, isLoading, isSaved, index, last,
}: {
  product: ProductSearchResult;
  onLearn: (p: ProductSearchResult) => void;
  isLoading: boolean;
  isSaved: boolean;
  index: number;
  last?: boolean;
}) {
  return (
    <FadeInView delay={index * 30} style={{ width: '100%' }}>
      <TouchableOpacity style={[PR.row, last && { borderBottomWidth: 0 }]} onPress={() => onLearn(product)} activeOpacity={0.8}>
        {coverOf(product) ? (
          <Image source={{ uri: coverOf(product)! }} style={PR.thumb} resizeMode="cover" />
        ) : (
          <View style={[PR.thumb, PR.thumbEmpty]}>
            <ShoppingBag size={16} color={D.textDisabled} strokeWidth={1.5} />
          </View>
        )}
        <View style={PR.body}>
          <Text style={PR.title} numberOfLines={2}>{product.title}</Text>
          <View style={PR.tags}>
            {product.commission_rate != null && (
              <View style={[PR.tag, { borderColor: D.successBorder, backgroundColor: D.successSubtle }]}>
                <Text style={[PR.tagTxt, { color: D.success }]}>{fmtPct(product.commission_rate)}</Text>
              </View>
            )}
            {product.day7_gmv != null && (
              <View style={[PR.tag, { borderColor: D.coral + '25', backgroundColor: D.coralFaint }]}>
                <Text style={[PR.tagTxt, { color: D.coral }]}>{fmt(product.day7_gmv)} 7d</Text>
              </View>
            )}
            {isSaved && (
              <View style={[PR.tag, { borderColor: D.coral + '40', backgroundColor: D.coralSubtle }]}>
                <Bookmark size={9} color={D.coral} strokeWidth={2} fill={D.coral} />
                <Text style={[PR.tagTxt, { color: D.coral }]}>Saved</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={PR.learnBtn} onPress={() => onLearn(product)} disabled={isLoading} activeOpacity={0.8} hitSlop={8}>
          {isLoading
            ? <ActivityIndicator size={12} color={D.coral} />
            : <><Zap size={12} color={D.coral} strokeWidth={2} /><Text style={PR.learnTxt}>Learn</Text></>
          }
        </TouchableOpacity>
      </TouchableOpacity>
    </FadeInView>
  );
}

const PR = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  thumb: { width: 60, height: 60, borderRadius: 14, flexShrink: 0, backgroundColor: D.inkHairline },
  thumbEmpty: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 6 },
  title: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 19, letterSpacing: -0.1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: R.full, borderWidth: 1,
  },
  tagTxt: { ...T.medium, fontSize: 11 },
  learnBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.full,
    backgroundColor: D.coralFaint, borderWidth: 1, borderColor: D.coral + '25', flexShrink: 0,
  },
  learnTxt: { ...T.bold, fontSize: 11, color: D.coral },
});

// ── Saved card ─────────────────────────────────────────────────────────────

export function SavedCard({
  item, onPress, onDelete, onMove, isManaging, folderName, folderColor, index,
}: {
  item: SavedProductItem;
  onPress: () => void;
  onDelete: () => void;
  onMove: () => void;
  isManaging: boolean;
  folderName?: string | null;
  folderColor?: string | null;
  index: number;
}) {
  return (
    <FadeInView delay={index * 40} style={{ width: '100%' }}>
      <TouchableOpacity style={SC.card} onPress={onPress} activeOpacity={0.8}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={SC.thumb} resizeMode="cover" />
        ) : (
          <View style={[SC.thumb, SC.thumbEmpty]}>
            <ShoppingBag size={18} color={D.textDisabled} strokeWidth={1.5} />
          </View>
        )}
        <View style={SC.body}>
          <Text style={SC.shop} numberOfLines={1}>{item.shop_name ?? ''}</Text>
          <Text style={SC.title} numberOfLines={2}>{item.title}</Text>
          <View style={SC.pills}>
            {item.price != null && (
              <View style={SC.pill}>
                <Text style={SC.pillTxt}>${item.price}</Text>
              </View>
            )}
            {item.commission_rate != null && (
              <View style={[SC.pill, SC.pillLime]}>
                <Text style={SC.pillLimeTxt}>{Math.round(item.commission_rate)}% comm.</Text>
              </View>
            )}
            {folderName && !isManaging && (
              <View style={[SC.pill, { backgroundColor: (folderColor ?? D.coral) + '18', borderWidth: 1, borderColor: (folderColor ?? D.coral) + '30' }]}>
                <Folder size={9} color={folderColor ?? D.coral} strokeWidth={2} />
                <Text style={[SC.pillTxt, { color: folderColor ?? D.coral, fontSize: 10 }]}>{folderName}</Text>
              </View>
            )}
          </View>
        </View>
        {isManaging ? (
          <View style={SC.manageBtns}>
            <TouchableOpacity
              style={SC.manageBtnFolder}
              onPress={(e) => { e.stopPropagation?.(); onMove(); }}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <FolderOpen size={16} color={D.textMuted} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              style={SC.manageBtnDelete}
              onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={D.error} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ) : (
          <ChevronRight size={18} color={D.textDisabled} strokeWidth={2} />
        )}
      </TouchableOpacity>
    </FadeInView>
  );
}

const SC = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder,
    padding: 13, marginBottom: 12, ...Shadow.soft,
  },
  thumb: { width: 64, height: 64, borderRadius: 16, flexShrink: 0, borderWidth: 1, borderColor: D.border },
  thumbEmpty: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 5, minWidth: 0 },
  shop: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { ...T.bold, fontSize: 14, color: D.textPrimary, lineHeight: 19, letterSpacing: -0.2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  pill: { backgroundColor: D.ink, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pillTxt: { ...T.bold, fontSize: 11, color: '#fff' },
  pillLime: { backgroundColor: D.successSubtle, borderWidth: 1, borderColor: D.successBorder },
  pillLimeTxt: { ...T.bold, fontSize: 11, color: D.limeDeep },
  manageBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  manageBtnFolder: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
  },
  manageBtnDelete: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.errorSubtle, borderWidth: 1, borderColor: D.errorBorder,
  },
});

// ── Folder picker styles ───────────────────────────────────────────────────

export const FP = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  optionActive: { borderBottomColor: D.divider },
  dot: { width: 14, height: 14, borderRadius: 7 },
  optionTxt: { flex: 1, ...T.medium, fontSize: 15, color: D.textPrimary },
});

// ── Folder / modal styles ──────────────────────────────────────────────────

export const FM = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(26,20,38,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 28,
    borderTopWidth: 1, borderColor: D.border,
  },
  title: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.3, marginBottom: 6 },
  subtitle: { ...T.regular, fontSize: 13, color: D.textMuted, marginBottom: 18, lineHeight: 18 },
  input: {
    backgroundColor: D.surface, borderRadius: R.md,
    borderWidth: 1, borderColor: D.border,
    paddingHorizontal: 14, paddingVertical: 13,
    ...T.medium, fontSize: 15, color: D.textPrimary,
    marginBottom: 20,
  },
  colorLabel: { ...T.bold, fontSize: 11, color: D.textDisabled, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 12 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  colorDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: R.full,
    backgroundColor: D.surface, borderWidth: 1, borderColor: D.border,
    alignItems: 'center',
  },
  cancelTxt: { ...T.bold, fontSize: 15, color: D.textMuted },
  createBtn: {
    flex: 2, paddingVertical: 14, borderRadius: R.full,
    backgroundColor: D.coral, alignItems: 'center',
  },
  createTxt: { ...T.bold, fontSize: 15, color: '#fff' },
});

// ── Main styles ────────────────────────────────────────────────────────────

export const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginHorizontal: 4 },
  pageTitle: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8 },
  regionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: R.full, backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border, ...Shadow.soft,
  },
  regionTxt: { ...T.bold, fontSize: 13, color: D.textPrimary },

  heroWrap: { borderRadius: 22, overflow: 'hidden', ...Shadow.coral, marginBottom: 14 },
  heroWrapActive: { shadowOpacity: 0.15 },
  hero: { borderRadius: 22, padding: 20, overflow: 'hidden' },
  circleA: {
    position: 'absolute', right: -50, bottom: -70,
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  circleB: {
    position: 'absolute', right: -90, top: -90,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  eyebrow: { ...T.bold, fontSize: 11.5, color: 'rgba(255,255,255,0.9)', letterSpacing: 1.1, textTransform: 'uppercase' },
  heroHeadline: { ...T.bold, fontSize: 26, color: '#fff', lineHeight: 31, letterSpacing: -0.4, marginBottom: 18, maxWidth: '84%' },
  heroItalic: { fontStyle: 'italic' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: '#fff', borderRadius: 15, padding: 13,
    shadowColor: 'rgba(120,10,30,1)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 6,
  },
  searchBarFocused: { borderRadius: 13 },
  searchInput: { flex: 1, ...T.medium, fontSize: 14.5, color: D.textPrimary, letterSpacing: -0.1, paddingVertical: 0, includeFontPadding: false },
  goBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { marginTop: 12, alignSelf: 'center' },
  cancelTxt: { ...T.bold, fontSize: 14, color: 'rgba(255,255,255,0.9)' },

  sortRow: { gap: 6, paddingBottom: 14 },
  sortPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: R.full,
    backgroundColor: D.card, borderWidth: 1, borderColor: D.border,
  },
  sortPillActive: { backgroundColor: D.coralSubtle, borderColor: D.coral + '35' },
  sortTxt: { ...T.medium, fontSize: 12, color: D.textMuted },
  sortTxtActive: { ...T.bold, color: D.coral },

  resultsPad: { paddingTop: 4 },

  sectionHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionHdrLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionLabel: { ...T.bold, ...SectionLabelStyle },
  countBadge: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeTxt: { ...T.bold, fontSize: 11, color: '#fff' },
  manageBtn: { ...T.bold, fontSize: 13, color: D.coral },

  // Folder strip
  folderStrip: { gap: 8, paddingRight: 4 },
  folderTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: R.full, backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border, ...Shadow.soft,
  },
  folderTabActive: { backgroundColor: D.coralSubtle, borderColor: D.coral + '35' },
  folderDot: { width: 8, height: 8, borderRadius: 4 },
  folderTabTxt: { ...T.medium, fontSize: 13, color: D.textMuted },
  folderTabTxtActive: { ...T.bold, color: D.coral },
  folderTabBadge: {
    backgroundColor: D.coral, borderRadius: R.full,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  folderTabBadgeTxt: { ...T.bold, fontSize: 10, color: '#fff' },
  newFolderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: R.full, backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border, borderStyle: 'dashed',
  },
  newFolderTxt: { ...T.medium, fontSize: 13, color: D.textMuted },

  deleteFolderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.md,
    backgroundColor: D.errorSubtle, borderWidth: 1, borderColor: D.errorBorder,
    marginBottom: 14,
  },
  deleteFolderTxt: { ...T.medium, fontSize: 12, color: D.error },

  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  emptySub: { ...T.regular, fontSize: 14, color: D.textMuted, textAlign: 'center', lineHeight: 21 },
  center: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  loadTxt: { ...T.regular, fontSize: 14, color: D.textMuted, marginTop: 8 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,20,38,0.55)',
    justifyContent: 'flex-end',
  },
});

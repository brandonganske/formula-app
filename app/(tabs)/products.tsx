import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Image, FlatList, KeyboardAvoidingView,
  Platform, Modal, Pressable, Keyboard, Alert,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  ProductSearchResult, ProductSearchResponse, ProductSearchSort,
  ProductEngineResult, ProductEngineLearn, SavedProductItem, ProductFolder,
} from '@/types/api';
import { D, T, R, Shadow, Gradient, SectionLabelStyle, FOLDER_COLORS } from '@/constants/ds';
import {
  Search, ShoppingBag, X, BookmarkPlus, Bookmark,
  ChevronDown, ChevronRight, Copy, Check, Trash2,
  Zap, AlertCircle, FolderOpen, FolderPlus, Folder,
} from 'lucide-react-native';
import NoCreditsModal from '@/components/NoCreditsModal';
import { Skeleton } from '@/components/Skeleton';

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, prefix = '$'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

function copyText(text: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  } catch {}
}

const SORT_OPTIONS: { key: ProductSearchSort; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'top_gmv', label: 'Top GMV' },
  { key: 'commission', label: 'Commission' },
  { key: 'popular', label: 'Popular' },
];

// ── Inline SVG glyphs ──────────────────────────────────────────────────────

function ProductGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 32 32" fill="none">
      <Rect x={6}  y={9}    width={14}  height={2.6} rx={1.3} fill="#fff" />
      <Rect x={6}  y={15}   width={10}  height={2.6} rx={1.3} fill="#fff" />
      <Rect x={6}  y={21}   width={6.5} height={2.6} rx={1.3} fill="#fff" />
      <Rect x={18} y={19.5} width={2.6} height={5.5} rx={1.3} fill="#B6FF8A" />
    </Svg>
  );
}

function GlobeIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={D.coral} strokeWidth={2.2} />
      <Path d="M3 12h18" stroke={D.coral} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke={D.coral} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Normalized panel data ──────────────────────────────────────────────────

interface PanelSource {
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

function fromEngineResult(r: ProductEngineResult): PanelSource {
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

function fromSavedItem(s: SavedProductItem): PanelSource {
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

function LearnPanel({
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

const LP = StyleSheet.create({
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
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: D.divider },
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

function LoadingPanel({ title, onClose }: { title: string; onClose: () => void }) {
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

function ProductRow({
  product, onLearn, isLoading, isSaved, index,
}: {
  product: ProductSearchResult;
  onLearn: (p: ProductSearchResult) => void;
  isLoading: boolean;
  isSaved: boolean;
  index: number;
}) {
  return (
    <FadeInView delay={index * 30} style={{ width: '100%' }}>
      <TouchableOpacity style={PR.row} onPress={() => onLearn(product)} activeOpacity={0.8}>
        {product.cover_url ? (
          <Image source={{ uri: product.cover_url }} style={PR.thumb} resizeMode="cover" />
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
  thumb: { width: 52, height: 52, borderRadius: 10, flexShrink: 0 },
  thumbEmpty: { backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 5 },
  title: { ...T.medium, fontSize: 13, color: D.textPrimary, lineHeight: 18 },
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

function SavedCard({
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

// ── Main screen ────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const queryClient = useQueryClient();
  const { profile, credits, refreshMe } = useAuth();
  const creatorId = profile?.id ?? null;
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<ProductSearchSort>('trending');
  const [searchActive, setSearchActive] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showNoCredits, setShowNoCredits] = useState(false);

  // New folder modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);

  // Move-to-folder picker
  const [movingProduct, setMovingProduct] = useState<SavedProductItem | null>(null);

  // Folder delete confirmation
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const [activeProduct, setActiveProduct] = useState<ProductSearchResult | null>(null);
  const [learnResult, setLearnResult] = useState<ProductEngineResult | null>(null);
  const [learnLoading, setLearnLoading] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);
  const [viewingSaved, setViewingSaved] = useState<SavedProductItem | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────

  const { data: searchData, isLoading: searchLoading, isFetching: searchFetching } = useQuery<ProductSearchResponse>({
    queryKey: ['product-search', searchQuery, sort],
    queryFn: async () => {
      const body: any = { sort, page: 1, pagesize: 30 };
      if (searchQuery.trim()) body.query = searchQuery.trim();
      const res = await api.post('/creators/product-search', body);
      return extractData<ProductSearchResponse>(res);
    },
    staleTime: 120_000,
    enabled: searchActive,
  });

  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['saved-products', creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const res = await api.get('/creators/saved-products');
      return extractData<{ products: SavedProductItem[] }>(res)?.products ?? [];
    },
    enabled: !!creatorId,
    staleTime: 30_000,
  });

  const { data: folders = [] } = useQuery<ProductFolder[]>({
    queryKey: ['product-folders', creatorId],
    queryFn: async () => {
      if (!creatorId) return [];
      const res = await api.get('/creators/product-folders');
      return extractData<{ folders: ProductFolder[] }>(res)?.folders ?? [];
    },
    enabled: !!creatorId,
    staleTime: 60_000,
  });

  const savedMap = React.useMemo(() => {
    const m: Record<string, SavedProductItem> = {};
    (savedData ?? []).forEach((s) => { m[s.external_id] = s; });
    return m;
  }, [savedData]);

  const folderMap = React.useMemo(() => {
    const m: Record<string, ProductFolder> = {};
    folders.forEach((f) => { m[f.id] = f; });
    return m;
  }, [folders]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const engineMutation = useMutation({
    mutationFn: async (product: ProductSearchResult) => {
      const res = await api.post('/creators/product-engine', {
        external_id: product.external_id,
        region: product.region ?? 'US',
        search_product: product,
      });
      return extractData<ProductEngineResult>(res);
    },
    onSuccess: (data) => { setLearnResult(data); setLearnLoading(false); setLearnError(null); refreshMe(); },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Failed to load product intel. Please try again.';
      setLearnError(msg);
      setLearnLoading(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (): Promise<SavedProductItem | null> => {
      if (!learnResult || !creatorId) return null;
      const { product, learn, intel, brainId } = learnResult;
      const res = await api.post('/creators/saved-products', {
        product: {
          external_id: product.external_id,
          title: product.title,
          image_url: product.cover ?? null,
          price: product.price ?? null,
          commission_rate: product.commission_rate ?? null,
          shop_name: product.shop_name ?? null,
          category: product.category ?? null,
          product_url: product.product_url ?? null,
        },
        product_brain_id: brainId ?? null,
        learn,
        intel: intel ?? null,
        folder_id: selectedFolderId,
      });
      return extractData<{ product: SavedProductItem }>(res)?.product ?? null;
    },
    onSuccess: (saved) => {
      if (saved?.id) {
        queryClient.setQueryData<SavedProductItem[]>(['saved-products', creatorId], (prev) => {
          const list = prev ?? [];
          const already = list.some((p) => p.external_id === saved.external_id);
          return already ? list : [saved, ...list];
        });
      }
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['saved-products', creatorId] });
      }, 1000);
    },
    onError: (err: any) => {
      const server = err?.response?.data;
      // Surfaced in the Metro logs so we can see the backend's actual 500 body.
      if (__DEV__) console.error('[saved-products] save failed', err?.response?.status, JSON.stringify(server));
      Alert.alert(
        'Couldn’t save product',
        server?.error?.message ?? server?.error ?? server?.message ?? err?.message ?? 'Something went wrong saving this product.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/creators/saved-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-products', creatorId] });
      setViewingSaved(null);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const res = await api.post('/creators/product-folders', { name, color });
      const folder = extractData<{ folder: ProductFolder }>(res)?.folder;
      if (!folder) throw new Error('Failed to create folder');
      return folder;
    },
    onSuccess: (folder) => {
      queryClient.invalidateQueries({ queryKey: ['product-folders', creatorId] });
      setShowNewFolderModal(false);
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0]);
      setSelectedFolderId(folder.id);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      await api.delete(`/creators/product-folders/${folderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-folders', creatorId] });
      queryClient.invalidateQueries({ queryKey: ['saved-products', creatorId] });
      setSelectedFolderId(null);
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ productId, folderId }: { productId: string; folderId: string | null }) => {
      await api.patch(`/creators/saved-products/${productId}`, { folder_id: folderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-products', creatorId] });
      setMovingProduct(null);
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(text), 500);
  }, []);

  const handleFocusSearch = () => { setSearchActive(true); };

  const handleCancelSearch = () => {
    setSearchActive(false);
    setQuery('');
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleLearn = useCallback((product: ProductSearchResult) => {
    if (credits <= 0) { setShowNoCredits(true); return; }
    // Drop the keyboard so the product panel isn't hidden behind it.
    Keyboard.dismiss();
    inputRef.current?.blur();
    setActiveProduct(product);
    setLearnResult(null);
    setLearnError(null);
    setLearnLoading(true);
    engineMutation.mutate(product);
  }, [engineMutation, credits]);

  const handleClosePanel = () => {
    setActiveProduct(null);
    setLearnResult(null);
    setLearnError(null);
    setLearnLoading(false);
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const searchResults = searchData?.products ?? [];
  const savedItems = savedData ?? [];

  const filteredItems = selectedFolderId
    ? savedItems.filter((item) => item.folder_id === selectedFolderId)
    : savedItems;

  const panelSource: PanelSource | null = learnResult
    ? { ...fromEngineResult(learnResult), savedId: savedMap[learnResult.product.external_id]?.id ?? null }
    : null;

  const viewingSavedSource: PanelSource | null = viewingSaved ? fromSavedItem(viewingSaved) : null;

  const selectedFolder = selectedFolderId ? folderMap[selectedFolderId] : null;

  return (
    <TabFadeView>
    <KeyboardAvoidingView style={S.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={S.scroll}
      >
        {/* Title row */}
        <View style={S.titleRow}>
          <Text style={S.pageTitle}>Products</Text>
          <TouchableOpacity style={S.regionBtn} activeOpacity={0.75}>
            <GlobeIcon />
            <Text style={S.regionTxt}>US</Text>
          </TouchableOpacity>
        </View>

        {/* Hero / search card */}
        <View style={[S.heroWrap, searchActive && S.heroWrapActive]}>
          <LinearGradient
            colors={Gradient.hero}
            start={{ x: 0.13, y: 0 }}
            end={{ x: 0.87, y: 1 }}
            style={S.hero}
          >
            <View style={S.circleA} />
            <View style={S.circleB} />

            {!searchActive && (
              <>
                <View style={S.eyebrowRow}>
                  <ProductGlyph />
                  <Text style={S.eyebrow}>Product Engine</Text>
                </View>
                <Text style={S.heroHeadline}>
                  Know the product{'\n'}
                  <Text style={S.heroItalic}>before you film.</Text>
                </Text>
              </>
            )}

            <View style={[S.searchBar, searchActive && S.searchBarFocused]}>
              {(searchActive && searchFetching) ? (
                <ActivityIndicator size={16} color={D.textMuted} />
              ) : (
                <Search size={18} color={D.textMuted} strokeWidth={2} />
              )}
              <TextInput
                ref={inputRef}
                style={S.searchInput}
                placeholder="Search TikTok Shop products"
                placeholderTextColor={D.textDisabled}
                value={query}
                onChangeText={handleSearchChange}
                onFocus={handleFocusSearch}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={() => { setQuery(''); setSearchQuery(''); }} hitSlop={10}>
                  <X size={16} color={D.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              ) : !searchActive ? (
                <View style={S.goBtn}>
                  <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
                </View>
              ) : null}
            </View>

            {searchActive && (
              <TouchableOpacity onPress={handleCancelSearch} style={S.cancelBtn}>
                <Text style={S.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* Sort pills */}
        {searchActive && (
          <FadeInView direction="none" duration={180} style={{ width: '100%' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.sortRow}>
              {SORT_OPTIONS.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[S.sortPill, sort === key && S.sortPillActive]}
                  hitSlop={8}
                  onPress={() => setSort(key)}
                  activeOpacity={0.75}
                >
                  <Text style={[S.sortTxt, sort === key && S.sortTxtActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </FadeInView>
        )}

        {/* Search results or saved list */}
        {searchActive ? (
          searchLoading && !searchData ? (
            <View style={S.center}>
              <ActivityIndicator color={D.coral} size="large" />
              <Text style={S.loadTxt}>Finding products...</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={S.center}>
              <View style={S.emptyIcon}>
                <Search size={26} color={D.textDisabled} strokeWidth={1.5} />
              </View>
              <Text style={S.emptyTitle}>No products found</Text>
              <Text style={S.emptySub}>Try a different keyword or sort</Text>
            </View>
          ) : (
            <View style={S.resultsPad}>
              {searchResults.map((item, index) => (
                <ProductRow
                  key={item.external_id}
                  product={item}
                  onLearn={handleLearn}
                  isLoading={activeProduct?.external_id === item.external_id && learnLoading}
                  isSaved={!!savedMap[item.external_id]}
                  index={index}
                />
              ))}
              <View style={{ height: 80 }} />
            </View>
          )
        ) : (
          <>
            {/* Section header */}
            <View style={S.sectionHdr}>
              <View style={S.sectionHdrLeft}>
                <Text style={S.sectionLabel}>Saved products</Text>
                {savedItems.length > 0 && (
                  <View style={S.countBadge}>
                    <Text style={S.countBadgeTxt}>{savedItems.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setIsManaging((v) => !v)} hitSlop={10}>
                <Text style={[S.manageBtn, isManaging && { color: D.error }]}>
                  {isManaging ? 'Done' : 'Manage'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Folder strip */}
            {(folders.length > 0 || savedItems.length > 0) && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={S.folderStrip}
                style={{ marginBottom: 16 }}
              >
                {/* All tab */}
                <TouchableOpacity
                  style={[S.folderTab, !selectedFolderId && S.folderTabActive]}
                  hitSlop={8}
                  onPress={() => setSelectedFolderId(null)}
                  activeOpacity={0.75}
                >
                  <Text style={[S.folderTabTxt, !selectedFolderId && S.folderTabTxtActive]}>All</Text>
                  {!selectedFolderId && savedItems.length > 0 && (
                    <View style={S.folderTabBadge}>
                      <Text style={S.folderTabBadgeTxt}>{savedItems.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Named folder tabs */}
                {folders.map((folder) => {
                  const count = savedItems.filter((i) => i.folder_id === folder.id).length;
                  const active = selectedFolderId === folder.id;
                  return (
                    <TouchableOpacity
                      key={folder.id}
                      style={[
                        S.folderTab,
                        active && { backgroundColor: folder.color + '18', borderColor: folder.color + '40' },
                      ]}
                      hitSlop={8}
                      onPress={() => setSelectedFolderId(folder.id)}
                      onLongPress={() => setDeletingFolderId(folder.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[S.folderDot, { backgroundColor: folder.color }]} />
                      <Text style={[S.folderTabTxt, active && { color: folder.color, ...T.bold }]}>{folder.name}</Text>
                      {count > 0 && (
                        <View style={[S.folderTabBadge, { backgroundColor: folder.color }]}>
                          <Text style={S.folderTabBadgeTxt}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* New folder button */}
                <TouchableOpacity
                  style={S.newFolderBtn}
                  onPress={() => setShowNewFolderModal(true)}
                  activeOpacity={0.75}
                >
                  <FolderPlus size={14} color={D.textMuted} strokeWidth={1.8} />
                  <Text style={S.newFolderTxt}>New Folder</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Delete folder action (shown when a folder is selected in manage mode) */}
            {isManaging && selectedFolder && (
              <TouchableOpacity
                style={S.deleteFolderRow}
                onPress={() => setDeletingFolderId(selectedFolder.id)}
                activeOpacity={0.75}
              >
                <Trash2 size={13} color={D.error} strokeWidth={1.8} />
                <Text style={S.deleteFolderTxt}>Delete folder "{selectedFolder.name}"</Text>
              </TouchableOpacity>
            )}

            {/* Product cards */}
            {savedLoading ? (
              <View style={{ paddingTop: 4 }}>
                <Skeleton height={48} radius={R.md} style={{ marginBottom: 14 }} />
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} height={64} radius={R.xl} style={{ marginBottom: 10 }} />
                ))}
              </View>
            ) : filteredItems.length === 0 ? (
              <View style={S.emptyWrap}>
                <View style={S.emptyIcon}>
                  {selectedFolderId ? (
                    <FolderOpen size={24} color={D.textDisabled} strokeWidth={1.5} />
                  ) : (
                    <Bookmark size={24} color={D.textDisabled} strokeWidth={1.5} />
                  )}
                </View>
                <Text style={S.emptyTitle}>
                  {selectedFolderId ? 'No products in this folder' : 'No saved products'}
                </Text>
                <Text style={S.emptySub}>
                  {selectedFolderId
                    ? 'In manage mode, use the folder icon to move products here.'
                    : 'Search for a product, tap Learn, then save it.'}
                </Text>
              </View>
            ) : (
              filteredItems.map((item, i) => (
                <SavedCard
                  key={item.id}
                  item={item}
                  onPress={() => setViewingSaved(item)}
                  onDelete={() => deleteMutation.mutate(item.id)}
                  onMove={() => setMovingProduct(item)}
                  isManaging={isManaging}
                  folderName={item.folder_id ? folderMap[item.folder_id]?.name : null}
                  folderColor={item.folder_id ? folderMap[item.folder_id]?.color : null}
                  index={i}
                />
              ))
            )}
            <View style={{ height: 60 }} />
          </>
        )}
      </ScrollView>

      {/* Learn panel overlay */}
      {activeProduct && (
        <FadeInView direction="none" duration={200} style={S.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={handleClosePanel} activeOpacity={1} />
          {learnLoading && <LoadingPanel title={activeProduct.title} onClose={handleClosePanel} />}
          {learnError && !learnLoading && (
            <FadeInView direction="up" style={[LP.panel, { padding: 24, gap: 14 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...T.bold, fontSize: 16, color: D.textPrimary }}>Could not load</Text>
                <TouchableOpacity style={LP.closeBtn} onPress={handleClosePanel} hitSlop={12}>
                  <X size={18} color={D.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: D.errorSubtle, borderRadius: R.md, borderWidth: 1, borderColor: D.errorBorder, padding: 14 }}>
                <AlertCircle size={16} color={D.error} strokeWidth={1.5} />
                <Text style={{ flex: 1, ...T.regular, fontSize: 13, color: D.error, lineHeight: 20 }}>{learnError}</Text>
              </View>
              <TouchableOpacity
                style={[LP.saveBtn, { borderRadius: R.full, overflow: 'hidden' }]}
                onPress={() => { if (credits <= 0) { setShowNoCredits(true); return; } setLearnError(null); setLearnLoading(true); engineMutation.mutate(activeProduct); }}
                activeOpacity={0.88}
              >
                <LinearGradient colors={Gradient.heroCompact} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <Text style={LP.saveBtnText}>Try Again</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
            </FadeInView>
          )}
          {panelSource && !learnLoading && !learnError && (
            <LearnPanel
              source={panelSource}
              onClose={handleClosePanel}
              onSave={() => saveMutation.mutate()}
              onUnsave={() => {
                const savedItem = savedMap[panelSource.externalId];
                if (savedItem) deleteMutation.mutate(savedItem.id);
              }}
              saving={saveMutation.isPending}
              unsaving={deleteMutation.isPending}
              saveError={saveMutation.isError ? ((saveMutation.error as any)?.message ?? 'Failed to save. Please try again.') : null}
            />
          )}
        </FadeInView>
      )}

      {/* Saved product detail overlay */}
      {viewingSaved && viewingSavedSource && (
        <FadeInView direction="none" duration={200} style={S.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setViewingSaved(null)} activeOpacity={1} />
          <LearnPanel
            source={viewingSavedSource}
            onClose={() => setViewingSaved(null)}
            onSave={() => {}}
            onUnsave={() => { if (viewingSaved.id) deleteMutation.mutate(viewingSaved.id); }}
            saving={false}
            unsaving={deleteMutation.isPending}
          />
        </FadeInView>
      )}

      {/* New Folder Modal */}
      <Modal
        visible={showNewFolderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewFolderModal(false)}
      >
        <Pressable style={FM.backdrop} onPress={() => setShowNewFolderModal(false)}>
          <Pressable style={FM.sheet} onPress={() => {}}>
            <Text style={FM.title}>New Folder</Text>
            <TextInput
              style={FM.input}
              placeholder="Folder name"
              placeholderTextColor={D.textDisabled}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
              maxLength={40}
            />
            <Text style={FM.colorLabel}>Color</Text>
            <View style={FM.colorRow}>
              {FOLDER_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[FM.colorDot, { backgroundColor: color }, newFolderColor === color && FM.colorDotActive]}
                  onPress={() => setNewFolderColor(color)}
                  activeOpacity={0.8}
                >
                  {newFolderColor === color && <Check size={12} color="#fff" strokeWidth={3} />}
                </TouchableOpacity>
              ))}
            </View>
            <View style={FM.actions}>
              <TouchableOpacity style={FM.cancelBtn} onPress={() => setShowNewFolderModal(false)} activeOpacity={0.75}>
                <Text style={FM.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[FM.createBtn, (!newFolderName.trim() || createFolderMutation.isPending) && { opacity: 0.5 }]}
                onPress={() => {
                  if (newFolderName.trim()) {
                    createFolderMutation.mutate({ name: newFolderName.trim(), color: newFolderColor });
                  }
                }}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                activeOpacity={0.85}
              >
                {createFolderMutation.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={FM.createTxt}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Folder Picker Sheet */}
      <Modal
        visible={!!movingProduct}
        transparent
        animationType="slide"
        onRequestClose={() => setMovingProduct(null)}
      >
        <Pressable style={FM.backdrop} onPress={() => setMovingProduct(null)}>
          <Pressable style={[FM.sheet, { paddingBottom: 32 }]} onPress={() => {}}>
            <Text style={FM.title}>Move to Folder</Text>
            <Text style={FM.subtitle} numberOfLines={2}>{movingProduct?.title}</Text>

            {/* No folder option */}
            <TouchableOpacity
              style={[FP.option, !movingProduct?.folder_id && FP.optionActive]}
              onPress={() => moveToFolderMutation.mutate({ productId: movingProduct!.id, folderId: null })}
              activeOpacity={0.75}
            >
              <View style={[FP.dot, { backgroundColor: D.textDisabled }]} />
              <Text style={FP.optionTxt}>No folder</Text>
              {!movingProduct?.folder_id && <Check size={15} color={D.coral} strokeWidth={2.5} />}
            </TouchableOpacity>

            {folders.map((folder) => {
              const active = movingProduct?.folder_id === folder.id;
              return (
                <TouchableOpacity
                  key={folder.id}
                  style={[FP.option, active && FP.optionActive]}
                  onPress={() => moveToFolderMutation.mutate({ productId: movingProduct!.id, folderId: folder.id })}
                  activeOpacity={0.75}
                >
                  <View style={[FP.dot, { backgroundColor: folder.color }]} />
                  <Text style={FP.optionTxt}>{folder.name}</Text>
                  {active && <Check size={15} color={D.coral} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}

            {folders.length === 0 && (
              <Text style={{ ...T.regular, fontSize: 13, color: D.textMuted, textAlign: 'center', paddingVertical: 12 }}>
                No folders yet. Create one first.
              </Text>
            )}

            <TouchableOpacity
              style={[S.newFolderBtn, { alignSelf: 'center', marginTop: 12, paddingHorizontal: 18, paddingVertical: 10 }]}
              onPress={() => { setMovingProduct(null); setShowNewFolderModal(true); }}
              activeOpacity={0.75}
            >
              <FolderPlus size={14} color={D.textMuted} strokeWidth={1.8} />
              <Text style={S.newFolderTxt}>New Folder</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Delete folder confirm */}
      <Modal
        visible={!!deletingFolderId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingFolderId(null)}
      >
        <Pressable style={FM.backdrop} onPress={() => setDeletingFolderId(null)}>
          <Pressable style={[FM.sheet, { paddingBottom: 28 }]} onPress={() => {}}>
            <Text style={FM.title}>Delete Folder</Text>
            <Text style={[FM.subtitle, { marginBottom: 24 }]}>
              Products in this folder won't be deleted — they'll just be unfoldered.
            </Text>
            <View style={FM.actions}>
              <TouchableOpacity style={FM.cancelBtn} onPress={() => setDeletingFolderId(null)} activeOpacity={0.75}>
                <Text style={FM.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[FM.createBtn, { backgroundColor: D.error }]}
                onPress={() => {
                  if (deletingFolderId) deleteFolderMutation.mutate(deletingFolderId);
                  setDeletingFolderId(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={FM.createTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <NoCreditsModal visible={showNoCredits} onClose={() => setShowNoCredits(false)} />
    </KeyboardAvoidingView>
    </TabFadeView>
  );
}

// ── Folder picker styles ───────────────────────────────────────────────────

const FP = StyleSheet.create({
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

const FM = StyleSheet.create({
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

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  pageTitle: { ...T.bold, fontSize: 30, color: D.textPrimary, letterSpacing: -0.8 },
  regionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: R.full, backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border, ...Shadow.soft,
  },
  regionTxt: { ...T.bold, fontSize: 13, color: D.textPrimary },

  heroWrap: { borderRadius: 26, overflow: 'hidden', ...Shadow.coral, marginBottom: 20 },
  heroWrapActive: { shadowOpacity: 0.15 },
  hero: { borderRadius: 26, padding: 22, overflow: 'hidden' },
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

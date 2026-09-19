import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { api, extractData } from '@/lib/api';
import { fromSaved, coverOf, parseProductParam } from '@/lib/product-handoff';
import { haptic } from '@/lib/haptics';
import { D, T, R, Shadow } from '@/constants/ds';
import { X, Mail, Copy, Check, Search, ShoppingBag, Sparkles } from 'lucide-react-native';
import type { ProductSearchResult, ProductSearchResponse, SavedProductItem } from '@/types/api';

interface Pitch { fit_reasons: string[]; fit_score: number; dm: string; email: string; talking_points: string[]; angle: string; used_stats: { followers: number | null; videos: number | null; gmv_30d: number | null } }

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <View style={S.block}>
      <View style={S.blockHdr}>
        <Text style={S.blockLabel}>{label}</Text>
        <TouchableOpacity style={S.copy} onPress={() => { Clipboard.setStringAsync(text); setOk(true); setTimeout(() => setOk(false), 1500); }} hitSlop={8}>
          {ok ? <Check size={13} color={D.limeDeep} strokeWidth={2.6} /> : <Copy size={13} color={D.textMuted} strokeWidth={2.2} />}
          <Text style={[S.copyText, ok && { color: D.limeDeep }]}>{ok ? 'Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={S.blockText} selectable>{text}</Text>
    </View>
  );
}

function ProductRow({ p, onPress }: { p: ProductSearchResult; onPress: () => void }) {
  return (
    <TouchableOpacity style={S.item} onPress={onPress} activeOpacity={0.8}>
      {coverOf(p) ? <Image source={{ uri: coverOf(p)! }} style={S.thumb} /> : <View style={[S.thumb, S.thumbPh]}><ShoppingBag size={14} color={D.textDisabled} strokeWidth={1.8} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={S.itemTitle} numberOfLines={2}>{p.title}</Text>
        <Text style={S.itemSub}>{[p.commission_rate != null ? `${Math.round(p.commission_rate)}% commission` : null, p.price != null ? `$${p.price}` : null, p.category].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={S.use}><Text style={S.useText}>Pitch</Text></View>
    </TouchableOpacity>
  );
}

// Pick a product from your shelf or TikTok Shop → why you're a fit → the pitch.
export default function SamplePitchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Handed a product from Saved, a script, or the product Learn panel.
  const params = useLocalSearchParams<{ productName?: string; product?: string }>();
  const handed = parseProductParam(params.product);
  const [q, setQ] = useState(handed ? '' : (params.productName ?? ''));
  const [query, setQuery] = useState(handed ? '' : (params.productName ?? ''));
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [picked, setPicked] = useState<ProductSearchResult | null>(handed);
  const [busy, setBusy] = useState(false);
  const [pitch, setPitch] = useState<Pitch | null>(null);

  const savedQ = useQuery({
    queryKey: ['saved-products-lite'],
    queryFn: async () => extractData<{ products?: SavedProductItem[] }>(await api.get('/creators/saved-products'))?.products ?? [],
    staleTime: 60_000,
  });
  const saved = (savedQ.data ?? []).map(fromSaved);
  const search = useQuery<ProductSearchResponse>({
    queryKey: ['product-search-pitch', query],
    queryFn: async () => {
      const body: Record<string, unknown> = { sort: 'trending', page: 1, pagesize: 20 };
      if (query.trim()) body.query = query.trim();
      return extractData<ProductSearchResponse>(await api.post('/creators/product-search', body)) as ProductSearchResponse;
    },
    staleTime: 120_000,
  });

  // Auto-run when a product arrived with the route (from a script or Saved).
  useEffect(() => { if (handed && !pitch && !busy) run(handed); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const run = async (p: ProductSearchResult) => {
    Keyboard.dismiss(); setPicked(p); setBusy(true); setPitch(null);
    try {
      const r = extractData<Pitch>(await api.post('/creators/tools/sample-pitch', { product: p.title, category: p.category ?? undefined, price: p.price ?? undefined, commission_rate: p.commission_rate ?? undefined }, { timeout: 60_000 }));
      setPitch(r as Pitch); haptic.success();
    } catch (e: any) { haptic.error(); Alert.alert('Couldn’t write it', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'); setPicked(null); }
    finally { setBusy(false); }
  };

  const stats = pitch?.used_stats;
  const fitColor = (n: number) => (n >= 75 ? D.limeDeep : n >= 50 ? '#F5A623' : D.coral);

  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={S.hdrIcon}><Mail size={18} color="#FFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}><Text style={S.title}>Sample pitch</Text><Text style={S.sub}>Pick a product. We'll say why you're the fit.</Text></View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!picked && (
          <FadeInView>
            <View style={S.searchBox}>
              <Search size={15} color={D.textDisabled} strokeWidth={2.2} />
              <TextInput style={S.searchInput} value={q} onChangeText={(t) => { setQ(t); if (deb.current) clearTimeout(deb.current); deb.current = setTimeout(() => setQuery(t), 450); }} placeholder="Search TikTok Shop…" placeholderTextColor={D.textDisabled} autoCapitalize="none" />
              {search.isFetching && <ActivityIndicator size="small" color={D.coral} />}
            </View>
            {!q && saved.length > 0 && (
              <View style={S.card}>
                <Text style={S.label}>YOUR SAVED PRODUCTS</Text>
                {saved.map((p, i) => <ProductRow key={'s' + p.external_id} p={p} onPress={() => run(p)} />)}
              </View>
            )}
            <View style={S.card}>
              <Text style={S.label}>{q ? 'RESULTS' : 'TRENDING ON TIKTOK SHOP'}</Text>
              {(search.data?.products ?? []).map((p) => <ProductRow key={p.external_id} p={p} onPress={() => run(p)} />)}
              {search.data && (search.data.products ?? []).length === 0 && !search.isFetching && <Text style={S.empty}>No products found.</Text>}
            </View>
          </FadeInView>
        )}

        {picked && busy && (
          <FadeInView style={[S.card, { alignItems: 'center', paddingVertical: 32 }]}>
            <ActivityIndicator color={D.coral} size="large" />
            <Text style={S.busyTitle}>Checking the fit…</Text>
            <Text style={S.busySub} numberOfLines={2}>{picked.title}</Text>
          </FadeInView>
        )}

        {picked && pitch && (
          <FadeInView>
            <View style={S.card}>
              <View style={S.pickedRow}>
                {coverOf(picked) ? <Image source={{ uri: coverOf(picked)! }} style={S.thumb} /> : <View style={[S.thumb, S.thumbPh]}><ShoppingBag size={14} color={D.textDisabled} strokeWidth={1.8} /></View>}
                <Text style={S.pickedTitle} numberOfLines={2}>{picked.title}</Text>
                <View style={[S.fitPill, { backgroundColor: fitColor(pitch.fit_score) }]}><Text style={S.fitPillText}>{Math.round(pitch.fit_score)}</Text><Text style={S.fitPillSub}>fit</Text></View>
              </View>
              <Text style={[S.label, { marginTop: 16 }]}>WHY YOU'RE A FIT</Text>
              {pitch.fit_reasons.map((r, i) => (
                <View key={i} style={S.reason}><View style={S.reasonDot}><Sparkles size={11} color={D.limeDeep} strokeWidth={2.4} /></View><Text style={S.reasonText}>{r}</Text></View>
              ))}
              <Text style={[S.label, { marginTop: 14 }]}>YOUR ANGLE</Text>
              <Text style={S.angle}>{pitch.angle}</Text>
              {stats && (stats.followers != null || stats.gmv_30d != null) && (
                <Text style={S.stats}>Using: {[stats.followers != null ? `${stats.followers.toLocaleString()} followers` : null, stats.videos != null ? `${stats.videos} videos` : null, stats.gmv_30d != null ? `$${Math.round(stats.gmv_30d).toLocaleString()} 30-day sales` : null].filter(Boolean).join(' · ')}</Text>
              )}
            </View>
            <CopyBlock label="DM / TIKTOK MESSAGE" text={pitch.dm} />
            <CopyBlock label="EMAIL" text={pitch.email} />
            <View style={S.block}>
              <Text style={S.blockLabel}>TALKING POINTS</Text>
              {pitch.talking_points.map((t, i) => <Text key={i} style={S.point}>• {t}</Text>)}
            </View>
            <AnimatedPressable style={S.ghost} haptic="light" onPress={() => { setPitch(null); setPicked(null); }}>
              <Text style={S.ghostText}>Pick another product</Text>
            </AnimatedPressable>
          </FadeInView>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: D.card, borderRadius: R.full, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 16, height: 50, marginBottom: 12 },
  searchInput: { ...T.medium, flex: 1, fontSize: 15, color: D.textPrimary },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, marginBottom: 12 },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: D.divider },
  thumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: D.inkHairline },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  itemTitle: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 19 },
  itemSub: { ...T.regular, fontSize: 12, color: D.textMuted, marginTop: 2 },
  use: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6 },
  useText: { ...T.bold, fontSize: 12, color: '#FFF' },
  empty: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', paddingVertical: 16 },
  busyTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, marginTop: 14, letterSpacing: -0.3 },
  busySub: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 12, paddingBottom: 10 },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickedTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, flex: 1, lineHeight: 20 },
  fitPill: { alignItems: 'center', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, minWidth: 48 },
  fitPillText: { ...T.bold, fontSize: 18, color: '#FFF', letterSpacing: -0.5 },
  fitPillSub: { ...T.bold, fontSize: 9.5, color: 'rgba(255,255,255,0.8)', letterSpacing: 0.6, marginTop: -2 },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  reasonDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: D.limeSubtle, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  reasonText: { ...T.medium, fontSize: 14.5, color: D.textPrimary, lineHeight: 21, flex: 1 },
  angle: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.3, lineHeight: 22 },
  stats: { ...T.medium, fontSize: 12, color: D.limeDeep, marginTop: 8, marginBottom: 10 },
  block: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 18, marginBottom: 12 },
  blockHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  blockLabel: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6 },
  blockText: { ...T.regular, fontSize: 15, color: D.textPrimary, lineHeight: 22 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1, borderColor: D.border, paddingHorizontal: 10, paddingVertical: 5 },
  copyText: { ...T.bold, fontSize: 12, color: D.textMuted },
  point: { ...T.regular, fontSize: 14.5, color: D.textSecondary, lineHeight: 21, marginTop: 6 },
  ghost: { alignItems: 'center', paddingVertical: 14 },
  ghostText: { ...T.bold, fontSize: 14, color: D.textMuted },
});

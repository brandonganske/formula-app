import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Modal, Pressable, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Search, X, ShoppingBag } from 'lucide-react-native';
import { coverOf } from '@/lib/product-handoff';
import type { ProductSearchResult, ProductSearchResponse } from '@/types/api';
import { useQuery } from '@tanstack/react-query';
import AnimatedPressable from '@/components/AnimatedPressable';
import { api, extractData } from '@/lib/api';
import { fromSaved } from '@/lib/product-handoff';
import { D, T, R } from '@/constants/ds';
import type { SavedProductItem } from '@/types/api';

// A product name field with the creator's saved products as one-tap chips.
export default function ProductPickField({ value, onChange, onPick, placeholder = 'Product name…' }: { value: string; onChange: (v: string) => void; onPick?: (p: ProductSearchResult) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = useQuery<ProductSearchResponse>({
    queryKey: ['product-search-pickfield', query],
    queryFn: async () => {
      const body: Record<string, unknown> = { sort: 'trending', page: 1, pagesize: 20 };
      if (query.trim()) body.query = query.trim();
      return extractData<ProductSearchResponse>(await api.post('/creators/product-search', body)) as ProductSearchResponse;
    },
    staleTime: 120_000,
    enabled: open,
  });
  const pick = (p: ProductSearchResult) => { onChange(p.title); onPick?.(p); setOpen(false); };
  const { data } = useQuery({
    queryKey: ['saved-products-lite'],
    queryFn: async () => extractData<{ products?: SavedProductItem[] }>(await api.get('/creators/saved-products'))?.products ?? [],
    staleTime: 60_000,
  });
  const saved = (data ?? []).map(fromSaved);
  return (
    <View>
      <View style={S.row}>
        <View style={[S.box, { flex: 1 }]}>
          <TextInput style={S.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={D.textDisabled} autoCapitalize="words" />
        </View>
        <AnimatedPressable style={S.searchBtn} haptic="light" onPress={() => setOpen(true)}>
          <Search size={17} color="#FFF" strokeWidth={2.4} />
        </AnimatedPressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={S.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={S.sheet} onPress={() => {}}>
            <View style={S.sheetHdr}>
              <Text style={S.sheetTitle}>Search TikTok Shop</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}><X size={20} color={D.textMuted} strokeWidth={2} /></TouchableOpacity>
            </View>
            <View style={S.searchBox}>
              <Search size={15} color={D.textDisabled} strokeWidth={2.2} />
              <TextInput
                style={S.searchInput}
                value={q}
                onChangeText={(t) => { setQ(t); if (deb.current) clearTimeout(deb.current); deb.current = setTimeout(() => setQuery(t), 450); }}
                placeholder="Search products…"
                placeholderTextColor={D.textDisabled}
                autoFocus
                autoCapitalize="none"
              />
              {search.isFetching && <ActivityIndicator size="small" color={D.coral} />}
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!q && <Text style={S.sectionLabel}>TRENDING</Text>}
              {(search.data?.products ?? []).map((p) => (
                <TouchableOpacity key={p.external_id} style={S.item} onPress={() => pick(p)} activeOpacity={0.8}>
                  {coverOf(p) ? <Image source={{ uri: coverOf(p)! }} style={S.thumb} /> : <View style={[S.thumb, S.thumbPh]}><ShoppingBag size={14} color={D.textDisabled} strokeWidth={1.8} /></View>}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={S.itemTitle} numberOfLines={2}>{p.title}</Text>
                    {p.commission_rate != null && <Text style={S.itemSub}>{Math.round(p.commission_rate)}% commission{p.category ? ` · ${p.category}` : ''}</Text>}
                  </View>
                  <View style={S.use}><Text style={S.useText}>Use</Text></View>
                </TouchableOpacity>
              ))}
              {search.data && (search.data.products ?? []).length === 0 && !search.isFetching && <Text style={S.emptyText}>No products found.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.chips} style={{ marginTop: 10 }}>
          {saved.slice(0, 12).map((p) => {
            const on = value === p.title;
            return (
              <AnimatedPressable key={p.external_id} style={[S.chip, on && S.chipOn]} haptic="light" onPress={() => onChange(on ? '' : p.title)}>
                <Text style={[S.chipText, on && S.chipTextOn]} numberOfLines={1}>{p.title}</Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: D.ink, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, borderWidth: 1, borderColor: D.cardBorder },
  sheetHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.3 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 14, height: 48, marginBottom: 10 },
  searchInput: { ...T.medium, flex: 1, fontSize: 15, color: D.textPrimary },
  sectionLabel: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 6, marginTop: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: D.divider },
  thumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: D.inkHairline },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  itemTitle: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 19 },
  itemSub: { ...T.regular, fontSize: 12, color: D.textMuted, marginTop: 2 },
  use: { backgroundColor: D.coral, borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 6 },
  useText: { ...T.bold, fontSize: 12, color: '#FFF' },
  emptyText: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', paddingVertical: 20 },
  box: { backgroundColor: D.surface, borderRadius: R.full, borderWidth: 1.5, borderColor: D.border, paddingHorizontal: 18, height: 52, justifyContent: 'center' },
  input: { ...T.medium, fontSize: 15, color: D.textPrimary },
  chips: { gap: 8, paddingRight: 4 },
  chip: { maxWidth: 200, borderRadius: R.full, borderWidth: 1, borderColor: D.border, backgroundColor: D.card, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  chipText: { ...T.medium, fontSize: 13, color: D.textSecondary },
  chipTextOn: { ...T.bold, color: D.coral },
});

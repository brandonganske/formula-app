import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ProductSearchResult, ProductSearchResponse, ProductSearchSort, ProductEngineResult, SavedProductItem } from '@/types/api';
import { D, T, R, Gradient } from '@/constants/ds';
import { Search, X, ChevronRight, AlertCircle } from 'lucide-react-native';
import NoCreditsModal from '@/components/NoCreditsModal';
import { Skeleton } from '@/components/Skeleton';
import {
  SORT_OPTIONS, ProductGlyph, GlobeIcon, PanelSource, fromEngineResult,
  LearnPanel, LP, LoadingPanel, ProductRow, S,
} from '@/components/products/shared';

// Products = the shelf. Search TikTok Shop, learn a product, save it, or write
// a script for it straight from the panel. Saved products live on the Saved
// tab (components/products/SavedProductsView).

const DS = StyleSheet.create({
  hint: { ...T.medium, fontSize: 12, color: D.textMuted },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, marginBottom: 14 },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cat: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.3 },
  catSub: { ...T.medium, fontSize: 12, color: D.textMuted },
  last: { borderBottomWidth: 0 },
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
  const [showNoCredits, setShowNoCredits] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const [activeProduct, setActiveProduct] = useState<ProductSearchResult | null>(null);
  const [learnResult, setLearnResult] = useState<ProductEngineResult | null>(null);
  const [learnLoading, setLearnLoading] = useState(false);
  const [learnError, setLearnError] = useState<string | null>(null);

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

  // Discover: the highest-commission products on TikTok Shop right now,
  // grouped by category so the shelf reads as "where the money is".
  const { data: discoverData, isLoading: discoverLoading } = useQuery<ProductSearchResponse>({
    queryKey: ['product-discover', 'commission'],
    queryFn: async () => {
      const res = await api.post('/creators/product-search', { sort: 'commission', page: 1, pagesize: 40 });
      return extractData<ProductSearchResponse>(res);
    },
    staleTime: 10 * 60_000,
    enabled: !searchActive,
  });
  const discoverGroups = React.useMemo(() => {
    const by: Record<string, ProductSearchResult[]> = {};
    for (const p of discoverData?.products ?? []) {
      const k = (p.category ?? '').trim() || 'More';
      (by[k] ||= []).push(p);
    }
    return Object.entries(by)
      .map(([category, items]) => ({ category, items: items.sort((a, b) => (b.commission_rate ?? 0) - (a.commission_rate ?? 0)).slice(0, 3) }))
      .sort((a, b) => b.items.length - a.items.length || (b.items[0]?.commission_rate ?? 0) - (a.items[0]?.commission_rate ?? 0))
      .slice(0, 5);
  }, [discoverData]);

  const savedMap = React.useMemo(() => {
    const m: Record<string, SavedProductItem> = {};
    (savedData ?? []).forEach((s) => { m[s.external_id] = s; });
    return m;
  }, [savedData]);

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
        folder_id: null,
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
    // Drop the keyboard so the product panel isn't hidden behind it.
    Keyboard.dismiss();
    inputRef.current?.blur();
    setActiveProduct(product);
    setLearnResult(null);
    setLearnError(null);
    setLearnLoading(true);
    engineMutation.mutate(product);
  }, [engineMutation]);

  const handleClosePanel = () => {
    setActiveProduct(null);
    setLearnResult(null);
    setLearnError(null);
    setLearnLoading(false);
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const searchResults = searchData?.products ?? [];
  const savedItems = savedData ?? [];

  const panelSource: PanelSource | null = learnResult
    ? { ...fromEngineResult(learnResult), savedId: savedMap[learnResult.product.external_id]?.id ?? null }
    : null;

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
            <View style={[S.resultsPad, DS.card]}>
              {searchResults.map((item, index) => (
                <ProductRow
                  key={item.external_id}
                  product={item}
                  onLearn={handleLearn}
                  isLoading={activeProduct?.external_id === item.external_id && learnLoading}
                  isSaved={!!savedMap[item.external_id]}
                  index={index}
                  last={index === searchResults.length - 1}
                />
              ))}
            </View>
          )
        ) : (
          <View style={S.resultsPad}>
            <View style={S.sectionHdr}>
              <View style={S.sectionHdrLeft}>
                <Text style={S.sectionLabel}>Top commission right now</Text>
              </View>
              <Text style={DS.hint}>by category</Text>
            </View>
            {discoverLoading && !discoverData ? (
              <View style={{ paddingTop: 4 }}>
                {[0, 1, 2, 3].map((k) => <Skeleton key={k} height={64} radius={R.xl} style={{ marginBottom: 10 }} />)}
              </View>
            ) : discoverGroups.length === 0 ? (
              <View style={S.emptyWrap}>
                <View style={S.emptyIcon}><Search size={24} color={D.textDisabled} strokeWidth={1.5} /></View>
                <Text style={S.emptyTitle}>Nothing to show yet</Text>
                <Text style={S.emptySub}>Search TikTok Shop above to find a product.</Text>
              </View>
            ) : (
              discoverGroups.map((g) => (
                <View key={g.category} style={DS.card}>
                  <View style={DS.catRow}>
                    <Text style={DS.cat}>{g.category}</Text>
                    <Text style={DS.catSub}>up to {Math.round(g.items[0]?.commission_rate ?? 0)}%</Text>
                  </View>
                  {g.items.map((item, index) => (
                    <ProductRow
                      key={item.external_id}
                      product={item}
                      onLearn={handleLearn}
                      isLoading={activeProduct?.external_id === item.external_id && learnLoading}
                      isSaved={!!savedMap[item.external_id]}
                      index={index}
                      last={index === g.items.length - 1}
                    />
                  ))}
                </View>
              ))
            )}
            <View style={{ height: 60 }} />
          </View>
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
                onPress={() => { setLearnError(null); setLearnLoading(true); engineMutation.mutate(activeProduct); }}
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

      <NoCreditsModal visible={showNoCredits} onClose={() => setShowNoCredits(false)} />
    </KeyboardAvoidingView>
    </TabFadeView>
  );
}

// ── Folder picker styles ───────────────────────────────────────────────────

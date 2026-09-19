import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { api, extractData } from '@/lib/api';
import { ShopDashboard, ShopVideo, Take } from '@/types/api';
import TakeSheet from '@/components/TakeSheet';
import { D, T } from '@/constants/ds';
import { Film, Clapperboard } from 'lucide-react-native';

const fmtNum = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
};

// The creator's own TikToks as assets: same screengrabs the Profile uses,
// each one a starting point for a rewrite.
export default function SavedVideosView() {
  const router = useRouter();
  const { data, isLoading } = useQuery<ShopDashboard>({
    queryKey: ['shop-dashboard'],
    queryFn: async () => {
      const res = await api.get('/creators/me/shop-dashboard');
      return extractData<ShopDashboard>(res) as ShopDashboard;
    },
    staleTime: 5 * 60_000,
  });
  const videos: ShopVideo[] = data?.top_videos ?? [];
  const takesQ = useQuery<Take[]>({
    queryKey: ['takes'],
    queryFn: async () => extractData<{ takes: Take[] }>(await api.get('/creators/takes'))?.takes ?? [],
    staleTime: 60_000,
  });
  const takes = takesQ.data ?? [];
  const [openTake, setOpenTake] = useState<Take | null>(null);

  const recreate = (v: ShopVideo) => {
    if (v.url) router.push({ pathname: '/(tabs)/rewrite', params: { url: v.url } });
    else router.push('/(tabs)/scriptiq');
  };

  return (
    <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
      {/* Takes filmed in the teleprompter — linked to their script/product */}
      <FadeInView style={[S.card, { marginBottom: 14 }]}>
        <View style={S.hdr}>
          <Text style={S.label}>Your takes</Text>
          <Text style={S.hint}>{takes.length === 0 ? 'from the teleprompter' : `${takes.length} filmed`}</Text>
        </View>
        {takes.length === 0 ? (
          <View style={S.takesEmpty}>
            <Clapperboard size={18} color={D.textDisabled} strokeWidth={1.8} />
            <Text style={S.takesEmptyText}>Film a script in the teleprompter and your takes land here, attached to the script.</Text>
          </View>
        ) : (
          <View style={S.grid}>
            {takes.map((t) => (
              <View key={t.id} style={S.col}>
                <AnimatedPressable style={S.thumbWrap} haptic="light" onPress={() => setOpenTake(t)}>
                  {t.thumb_url ? <Image source={{ uri: t.thumb_url }} style={S.thumb} resizeMode="cover" /> : <View style={[S.thumb, S.thumbPh]}><Film size={20} color={D.textDisabled} strokeWidth={1.8} /></View>}
                  {t.duration_sec != null && <View style={S.views}><Text style={S.viewsText}>{Math.floor(t.duration_sec / 60)}:{String(t.duration_sec % 60).padStart(2, '0')}</Text></View>}
                </AnimatedPressable>
                <Text style={S.takeTitle} numberOfLines={1}>{t.script?.title ?? t.title ?? 'Take'}</Text>
                {t.product_name ? <Text style={S.takeSub} numberOfLines={1}>{t.product_name}</Text> : <Text style={S.takeSub} numberOfLines={1}>{t.script_id ? 'Script' : 'Not attached'}</Text>}
              </View>
            ))}
          </View>
        )}
      </FadeInView>
      {openTake && <TakeSheet take={openTake} onClose={() => setOpenTake(null)} />}

      {isLoading ? (
        <View style={S.center}><ActivityIndicator color={D.coral} /></View>
      ) : videos.length === 0 ? (
        <View style={S.center}>
          <View style={S.emptyIcon}><Film size={26} color={D.textDisabled} strokeWidth={1.5} /></View>
          <Text style={S.emptyTitle}>No videos yet</Text>
          <Text style={S.emptySub}>Your top TikToks show up here once your profile has finished building.</Text>
        </View>
      ) : (
        <FadeInView style={S.card}>
          <View style={S.hdr}>
            <Text style={S.label}>Your top videos</Text>
            <Text style={S.hint}>{videos.length} by views</Text>
          </View>
          <View style={S.grid}>
            {videos.map((v) => (
              <View key={v.id} style={S.col}>
                <AnimatedPressable style={S.thumbWrap} haptic="light" onPress={() => recreate(v)}>
                  {v.thumbnail_url
                    ? <Image source={{ uri: v.thumbnail_url }} style={S.thumb} resizeMode="cover" />
                    : <View style={[S.thumb, S.thumbPh]}><Film size={20} color={D.textDisabled} strokeWidth={1.8} /></View>}
                  <View style={S.views}><Text style={S.viewsText}>{fmtNum(v.views)}</Text></View>
                </AnimatedPressable>
                <AnimatedPressable style={S.btn} haptic="light" onPress={() => recreate(v)}>
                  <Text style={S.btnText}>Recreate</Text>
                </AnimatedPressable>
              </View>
            ))}
          </View>
        </FadeInView>
      )}
      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const S = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 16 },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  label: { ...T.bold, fontSize: 12.5, color: D.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { ...T.medium, fontSize: 12, color: D.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  col: { width: '31.5%' },
  thumbWrap: { width: '100%', aspectRatio: 9 / 16, borderRadius: 14, overflow: 'hidden', backgroundColor: D.surface },
  thumb: { width: '100%', height: '100%' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  viewsText: { ...T.bold, fontSize: 10.5, color: '#FFF' },
  btn: { marginTop: 8, backgroundColor: D.coral, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  btnText: { ...T.bold, fontSize: 12, color: '#FFF' },
  takesEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  takesEmptyText: { ...T.regular, fontSize: 13, color: D.textMuted, flex: 1, lineHeight: 18 },
  takeTitle: { ...T.bold, fontSize: 12, color: D.textPrimary, marginTop: 6 },
  takeSub: { ...T.regular, fontSize: 11, color: D.textMuted, marginTop: 1 },
  center: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  emptySub: { ...T.regular, fontSize: 14, color: D.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
});

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Store, ShieldCheck } from 'lucide-react-native';
import { api, extractData } from '@/lib/api';
import { ShopDashboard } from '@/types/api';
import { D, T, R, Shadow, Gradient, SectionLabelStyle } from '@/constants/ds';
import FadeInView from '@/components/FadeInView';
import TabFadeView from '@/components/TabFadeView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Skeleton } from '@/components/Skeleton';
import ShopDashboardView, { SAMPLE_SHOP_DASHBOARD } from '@/components/ShopDashboardView';

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['shop-dashboard'],
    queryFn: async () => {
      const res = await api.get('/creators/me/shop-dashboard');
      return extractData<ShopDashboard>(res);
    },
    retry: false,
    staleTime: 60_000,
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['shop-dashboard'] });

  // Real data or nothing. On any error, fall through to the honest empty state —
  // never the sample dataset (that lives only on the /shop-preview design route).
  const data: ShopDashboard | undefined = query.data
    ?? (query.isError ? { connected: false, tier: 'none', top_videos: [] } : undefined);

  const handleGenerate = (productId?: string) => {
    if (productId) {
      router.push({ pathname: '/(tabs)/productscript', params: { productId } });
    } else {
      router.push('/(tabs)/scriptiq');
    }
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (query.isLoading) {
    return (
      <View style={S.root}>
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} scrollEnabled={false}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
            <Skeleton height={188} radius={R.xxl} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton height={78} radius={R.xl} style={{ flex: 1 }} />
              <Skeleton height={78} radius={R.xl} style={{ flex: 1 }} />
              <Skeleton height={78} radius={R.xl} style={{ flex: 1 }} />
            </View>
            <Skeleton height={92} radius={R.xxl} />
            <Skeleton height={92} radius={R.xxl} />
            <Skeleton height={92} radius={R.xxl} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── NOTHING TO SHOW YET ───────────────────────────────────────────────────
  // No brain-ingested videos and no real GMV on record. There is no "connect"
  // step any more — real numbers appear automatically once they exist.
  const hasVideos = (data?.top_videos?.length ?? 0) > 0;
  if (!data || (!hasVideos && !data.summary)) {
    return (
      <TabFadeView>
        <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          <FadeInView style={S.emptyWrap}>
            <LinearGradient
              colors={Gradient.hero}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={S.emptyHero}
            >
              <View style={S.emptyOrb1} pointerEvents="none" />
              <View style={S.emptyOrb2} pointerEvents="none" />

              <View style={S.emptyIcon}>
                <Store size={30} color="#FFF" strokeWidth={1.8} />
              </View>
              <Text style={S.emptyTitle}>Your performance lives here</Text>
              <Text style={S.emptyBody}>
                Once your profile is built, your top videos show up here — and your real
                sales numbers appear automatically when they’re on record.
              </Text>

              <AnimatedPressable
                style={S.emptyBtn}
                onPress={() => router.push('/(tabs)')}
                haptic="medium"
              >
                <Text style={S.emptyBtnText}>Go to your Profile</Text>
              </AnimatedPressable>
            </LinearGradient>
          </FadeInView>
        </ScrollView>
      </TabFadeView>
    );
  }

  // ── CONNECTED DASHBOARD ─────────────────────────────────────────────────────
  return (
    <TabFadeView>
      <ScrollView style={S.root} contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        <ShopDashboardView
          data={data}
          onGenerate={handleGenerate}
        />
      </ScrollView>
    </TabFadeView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  scroll: { paddingBottom: 40 },

  sectionLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 12, marginLeft: 4 },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: {
    marginHorizontal: 16, marginTop: 16,
    borderRadius: R.xxl, overflow: 'hidden',
    ...Shadow.coral,
  },
  emptyHero: { padding: 26, alignItems: 'center', overflow: 'hidden' },
  emptyOrb1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    top: -80, right: -60, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  emptyOrb2: {
    position: 'absolute', width: 150, height: 150, borderRadius: 75,
    bottom: -60, left: -40, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  emptyTitle: { ...T.bold, fontSize: 23, color: '#FFF', letterSpacing: -0.5, textAlign: 'center' },
  emptyBody: {
    ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.88)',
    lineHeight: 21, textAlign: 'center', marginTop: 12, paddingHorizontal: 4,
  },
  emptyBtn: {
    alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    backgroundColor: D.ink, borderRadius: R.full, paddingVertical: 16, marginTop: 22,
    shadowColor: '#780014', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 6,
  },
  emptyBtnText: { ...T.bold, fontSize: 15, color: '#FFF', letterSpacing: -0.2 },
  reassureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  reassureText: { ...T.medium, fontSize: 12, color: 'rgba(255,255,255,0.82)' },

  // Empty — what you'll see
  featureCard: {
    marginHorizontal: 0,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder,
    paddingHorizontal: 16, ...Shadow.soft,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: D.divider },
  featureDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.coral, flexShrink: 0 },
  featureTitle: { ...T.bold, fontSize: 14, color: D.textPrimary, letterSpacing: -0.2 },
  featureSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 2 },
});

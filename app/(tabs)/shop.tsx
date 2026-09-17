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
  const [connecting, setConnecting] = useState(false);

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

  // Degrade gracefully: on any error / 404, fall back to NOT CONNECTED. In dev,
  // render a realistic sample so the screen is viewable in the web preview.
  const data: ShopDashboard | undefined = query.data
    ?? (query.isError ? (__DEV__ ? SAMPLE_SHOP_DASHBOARD : { connected: false, tier: 'none' }) : undefined);

  const handleConnect = async () => {
    const url = data?.connect_url;
    if (!url) {
      Alert.alert('Coming soon', 'TikTok Shop connection is not available yet. Check back shortly.');
      return;
    }
    setConnecting(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(url, 'formula://tiktok-shop-connected');
      if (result.type === 'success') refetch();
    } catch {
      Alert.alert('Connection failed', 'Could not open TikTok Shop. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect TikTok Shop',
      'Your collaborations and earnings will stop syncing. You can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/creators/tiktok-shop/disconnect');
              refetch();
            } catch {
              Alert.alert('Couldn’t disconnect', 'Please try again in a moment.');
            }
          },
        },
      ],
    );
  };

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

  // ── NOT CONNECTED ─────────────────────────────────────────────────────────
  if (!data || !data.connected) {
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
              <Text style={S.emptyTitle}>Connect your TikTok Shop</Text>
              <Text style={S.emptyBody}>
                See your real collaborations, commissions, and which videos actually earn — pulled
                straight from your TikTok Shop account.
              </Text>

              <AnimatedPressable
                style={[S.emptyBtn, connecting && { opacity: 0.6 }]}
                onPress={handleConnect}
                disabled={connecting}
                haptic="medium"
              >
                {connecting
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={S.emptyBtnText}>Connect TikTok Shop</Text>}
              </AnimatedPressable>

              <View style={S.reassureRow}>
                <ShieldCheck size={13} color="rgba(255,255,255,0.82)" strokeWidth={2} />
                <Text style={S.reassureText}>Read-only. We never post or touch your account.</Text>
              </View>
            </LinearGradient>
          </FadeInView>

          {/* What you'll see */}
          <FadeInView delay={80} style={{ paddingHorizontal: 16, marginTop: 24 }}>
            <Text style={S.sectionLabel}>WHAT YOU’LL SEE</Text>
            <View style={S.featureCard}>
              {[
                { t: 'Commissions earned & pending', s: 'Every dollar, across all collaborations' },
                { t: 'Revenue per video', s: 'Which content actually drives sales' },
                { t: 'Smart moves', s: 'Where to double down — with scripts ready to film' },
              ].map((f, i, arr) => (
                <View key={f.t} style={[S.featureRow, i < arr.length - 1 && S.featureRowBorder]}>
                  <View style={S.featureDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.featureTitle}>{f.t}</Text>
                    <Text style={S.featureSub}>{f.s}</Text>
                  </View>
                </View>
              ))}
            </View>
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
          onDisconnect={handleDisconnect}
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

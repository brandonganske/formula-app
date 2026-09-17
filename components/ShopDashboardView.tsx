import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Store, TrendingUp, Check, ArrowRight } from 'lucide-react-native';
import { ShopDashboard } from '@/types/api';
import { D, T, R, Shadow, SectionLabelStyle } from '@/constants/ds';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';

// ─── Formatting helpers (shared) ────────────────────────────────────────────

export function currencySymbol(code?: string): string {
  switch ((code ?? 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    default: return '$';
  }
}

// Full money, e.g. $1,234
export function formatMoney(n: number | null | undefined, currency?: string): string {
  const sym = currencySymbol(currency);
  if (n == null || isNaN(n)) return `${sym}0`;
  try {
    return `${sym}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n))}`;
  } catch {
    return `${sym}${Math.round(n)}`;
  }
}

// Compact money for hero, e.g. $12.4K, $1.2M
export function formatMoneyCompact(n: number | null | undefined, currency?: string): string {
  const sym = currencySymbol(currency);
  if (n == null || isNaN(n)) return `${sym}0`;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}K`;
  return formatMoney(n, currency);
}

// Commission rate — may arrive as basis points (3500 → 35%), a >1 percent
// value (35 → 35%), or a fraction (0.35 → 35%).
export function formatPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  let pct: number;
  if (v > 100) pct = v / 100;      // basis points, e.g. 3500 → 35
  else if (v > 1) pct = v;         // already a percent, e.g. 35 → 35
  else pct = v * 100;              // fraction, e.g. 0.35 → 35
  return `${Math.round(pct)}%`;
}

export function timeAgo(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `Updated ${days}d ago`;
}

// ─── Realistic sample — shared by the dev fallback and the web design preview ─

export const SAMPLE_SHOP_DASHBOARD: ShopDashboard = {
  connected: true,
  tier: 'authorized',
  handle: 'brandonmakes',
  display_name: 'Brandon Makes',
  currency: 'USD',
  data_freshness: new Date(Date.now() - 2 * 3600_000).toISOString(),
  summary: {
    gmv_30d: 48230,
    commission_earned_30d: 6142,
    commission_pending: 1180,
    orders_30d: 1327,
    units_30d: 1583,
    gmv_trend: [
      { date: '2026-08-19', gmv: 820 },
      { date: '2026-08-24', gmv: 1140 },
      { date: '2026-08-29', gmv: 990 },
      { date: '2026-09-03', gmv: 1620 },
      { date: '2026-09-08', gmv: 1380 },
      { date: '2026-09-12', gmv: 2210 },
      { date: '2026-09-16', gmv: 2640 },
    ],
  },
  collaborations: [
    { id: 'c1', brand_name: 'GlowLab Skincare', status: 'active', gmv: 21400, commission: 2996, product_count: 4, video_count: 11 },
    { id: 'c2', brand_name: 'Peak Supplements', status: 'active', gmv: 15800, commission: 2054, product_count: 3, video_count: 8 },
    { id: 'c3', brand_name: 'Nook Home', status: 'ended', gmv: 11030, commission: 1092, product_count: 2, video_count: 5 },
  ],
  products: [
    { product_id: 'p1', name: 'GlowLab Vitamin C Brightening Serum 30ml', revenue: 14200, commission_earned: 1988, commission_rate: 1400, units: 512, video_count: 4, revenue_per_video: 3550 },
    { product_id: 'p2', name: 'Peak Creatine Gummies — Blue Raspberry', revenue: 9800, commission_earned: 1274, commission_rate: 0.13, units: 388, video_count: 5, revenue_per_video: 1960 },
    { product_id: 'p3', name: 'Nook Ceramic Diffuser', revenue: 6100, commission_earned: 610, commission_rate: 10, units: 176, video_count: 6, revenue_per_video: 1017 },
  ],
  insights: [
    { id: 'i1', title: 'Your serum videos convert 2x', body: 'The GlowLab serum earns $3,550 per video — double your average. Cut three more angles this week while it is hot.', product_id: 'p1', cta: 'generate_scripts' },
    { id: 'i2', title: 'Gummies are under-filmed', body: 'Peak gummies pull strong revenue per video but you have only posted 5. There is clear headroom to scale.', product_id: 'p2', cta: 'generate_scripts' },
  ],
};

// ─── Sparkline (react-native-svg Polyline, no lib) ──────────────────────────

function Sparkline({ data, color = D.lime }: { data: { gmv: number }[]; color?: string }) {
  const W = 120, H = 34, pad = 3;
  if (!data || data.length < 2) return <View style={{ width: W, height: H }} />;
  const vals = data.map((d) => d.gmv);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (data.length - 1);
  const points = vals
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (H - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={W} height={H}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Avatar / placeholder ───────────────────────────────────────────────────

function Initial({ name, size = 44, dark }: { name?: string; size?: number; dark?: boolean }) {
  const letter = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View style={[
      ph.circle,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? D.inkHairline : D.coralSubtle },
    ]}>
      <Text style={[ph.letter, { fontSize: size * 0.42, color: dark ? D.textPrimary : D.coral }]}>{letter}</Text>
    </View>
  );
}
const ph = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  letter: { ...T.bold },
});

// ─── Stat tile (mono) ───────────────────────────────────────────────────────

function MonoStat({ value, label, onDark }: { value: string; label: string; onDark?: boolean }) {
  return (
    <View style={ms.box}>
      <Text style={[ms.val, onDark && { color: '#FFF' }]}>{value}</Text>
      <Text style={[ms.label, onDark && { color: 'rgba(255,255,255,0.62)' }]}>{label}</Text>
    </View>
  );
}
const ms = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', gap: 4 },
  val: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3 },
  label: { ...T.medium, fontSize: 11, color: D.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
});

// ─── Connected dashboard (reusable) ─────────────────────────────────────────
// Renders the full "connected" state: money hero, collaborations, top products,
// insights, header, disconnect footer. Meant to be placed inside a parent
// ScrollView. `onGenerate` receives the tapped insight's product_id (if any);
// `onDisconnect` fires from the footer.

type Props = {
  data: ShopDashboard;
  onGenerate?: (productId?: string) => void;
  onDisconnect?: () => void | Promise<void>;
};

export default function ShopDashboardView({ data, onGenerate, onDisconnect }: Props) {
  const [disconnecting, setDisconnecting] = useState(false);
  const currency = data.currency;
  const sum = data.summary;
  const freshness = timeAgo(data.data_freshness);
  const products = [...(data.products ?? [])].sort((a, b) => b.revenue_per_video - a.revenue_per_video);

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────── */}
      <FadeInView style={S.header}>
        {data.avatar_url
          ? <Image source={{ uri: data.avatar_url }} style={S.headerAvatar} />
          : <Initial name={data.display_name ?? data.handle} size={48} dark />}
        <View style={{ flex: 1 }}>
          <Text style={S.headerName} numberOfLines={1}>
            {data.display_name ?? (data.handle ? `@${data.handle}` : 'Your Shop')}
          </Text>
          {data.handle && data.display_name
            ? <Text style={S.headerHandle}>@{data.handle}</Text>
            : null}
        </View>
        <View style={S.connectedPill}>
          <Check size={12} color={D.limeDeep} strokeWidth={3} />
          <Text style={S.connectedPillText}>TikTok Shop connected</Text>
        </View>
      </FadeInView>
      {freshness && <Text style={S.freshness}>{freshness}</Text>}

      {/* ── Money hero (dark ink card) ─────────────────────────── */}
      {sum && (
        <FadeInView delay={40} style={S.moneyHero}>
          <View style={S.moneyTop}>
            <View style={{ flex: 1 }}>
              <Text style={S.moneyValue}>{formatMoney(sum.commission_earned_30d, currency)}</Text>
              <Text style={S.moneyLabel}>Commissions earned · 30d</Text>
              {sum.commission_pending > 0 && (
                <Text style={S.moneyPending}>
                  {formatMoney(sum.commission_pending, currency)} pending
                </Text>
              )}
            </View>
            {sum.gmv_trend?.length > 1 && (
              <View style={S.sparkWrap}>
                <Sparkline data={sum.gmv_trend} />
                <Text style={S.sparkLabel}>GMV trend</Text>
              </View>
            )}
          </View>
          <View style={S.moneyDivider} />
          <View style={S.moneyStats}>
            <MonoStat value={formatMoneyCompact(sum.gmv_30d, currency)} label="GMV 30d" onDark />
            <View style={S.moneyStatDivider} />
            <MonoStat value={new Intl.NumberFormat('en-US').format(sum.orders_30d)} label="Orders" onDark />
            <View style={S.moneyStatDivider} />
            <MonoStat value={new Intl.NumberFormat('en-US').format(sum.units_30d)} label="Units" onDark />
          </View>
        </FadeInView>
      )}

      {/* ── Collaborations ─────────────────────────────────────── */}
      {(data.collaborations?.length ?? 0) > 0 && (
        <FadeInView delay={80} style={S.section}>
          <Text style={S.sectionLabel}>YOUR COLLABORATIONS</Text>
          <View style={{ gap: 10 }}>
            {data.collaborations!.map((c) => (
              <View key={c.id} style={S.collabCard}>
                {c.brand_logo
                  ? <Image source={{ uri: c.brand_logo }} style={S.collabLogo} />
                  : <Initial name={c.brand_name} size={44} />}
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={S.collabTitleRow}>
                    <Text style={S.collabName} numberOfLines={1}>{c.brand_name}</Text>
                    <View style={S.statusPill}>
                      <Text style={S.statusPillText}>{c.status}</Text>
                    </View>
                  </View>
                  <Text style={S.monoRow}>
                    {formatMoney(c.gmv, currency)} GMV · {formatMoney(c.commission, currency)} earned · {c.product_count} products · {c.video_count} videos
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </FadeInView>
      )}

      {/* ── Top products (by revenue per video) ────────────────── */}
      {products.length > 0 && (
        <FadeInView delay={120} style={S.section}>
          <Text style={S.sectionLabel}>BY REVENUE PER VIDEO</Text>
          <View style={{ gap: 10 }}>
            {products.map((p) => (
              <View key={p.product_id} style={S.prodCard}>
                <View style={S.prodHead}>
                  {p.image
                    ? <Image source={{ uri: p.image }} style={S.prodImg} />
                    : <View style={S.prodImgPh}><Store size={20} color={D.textDisabled} strokeWidth={1.8} /></View>}
                  <Text style={S.prodName} numberOfLines={2}>{p.name}</Text>
                </View>

                {/* Money metric — prominent */}
                <View style={S.rpvRow}>
                  <View style={S.rpvAccent} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.rpvLabel}>Revenue / video</Text>
                    <Text style={S.rpvValue}>{formatMoney(p.revenue_per_video, currency)}</Text>
                  </View>
                  <TrendingUp size={20} color={D.coral} strokeWidth={2} />
                </View>

                <View style={S.prodStats}>
                  <MonoStat value={formatMoneyCompact(p.revenue, currency)} label="Revenue" />
                  <View style={S.prodStatDivider} />
                  <MonoStat value={formatMoneyCompact(p.commission_earned, currency)} label="Earned" />
                  <View style={S.prodStatDivider} />
                  <MonoStat value={formatPct(p.commission_rate)} label="Rate" />
                  <View style={S.prodStatDivider} />
                  <MonoStat value={new Intl.NumberFormat('en-US').format(p.units)} label="Units" />
                  <View style={S.prodStatDivider} />
                  <MonoStat value={String(p.video_count)} label="Videos" />
                </View>
              </View>
            ))}
          </View>
        </FadeInView>
      )}

      {/* ── Insights (Smart moves) ─────────────────────────────── */}
      {(data.insights?.length ?? 0) > 0 && (
        <FadeInView delay={160} style={S.section}>
          <Text style={S.sectionLabel}>SMART MOVES</Text>
          <View style={{ gap: 10 }}>
            {data.insights!.map((ins) => (
              <View key={ins.id} style={S.insightCard}>
                <View style={S.insightAccent} />
                <Text style={S.insightTitle}>{ins.title}</Text>
                <Text style={S.insightBody}>{ins.body}</Text>
                <AnimatedPressable
                  style={S.insightBtn}
                  haptic="light"
                  onPress={() => onGenerate?.(ins.product_id)}
                >
                  <Text style={S.insightBtnText}>Generate scripts</Text>
                  <ArrowRight size={14} color={D.coral} strokeWidth={2.5} />
                </AnimatedPressable>
              </View>
            ))}
          </View>
        </FadeInView>
      )}

      {/* ── Footer ─────────────────────────────────────────────── */}
      <AnimatedPressable
        style={S.disconnectRow}
        onPress={handleDisconnect}
        disabled={disconnecting}
        haptic="light"
      >
        {disconnecting
          ? <ActivityIndicator size="small" color={D.textMuted} />
          : <Text style={S.disconnectText}>Disconnect TikTok Shop</Text>}
      </AnimatedPressable>

      <View style={{ height: 48 }} />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  sectionLabel: { ...T.bold, ...SectionLabelStyle, marginBottom: 12, marginLeft: 4 },
  section: { paddingHorizontal: 16, marginTop: 22 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
  },
  headerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: D.surface },
  headerName: { ...T.bold, fontSize: 20, color: D.textPrimary, letterSpacing: -0.4 },
  headerHandle: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  connectedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: D.limeSubtle, borderRadius: R.full,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(47,161,12,0.22)', flexShrink: 0, maxWidth: 130,
  },
  connectedPillText: { ...T.bold, fontSize: 10, color: D.limeDeep, letterSpacing: 0.1 },
  freshness: { ...T.medium, fontSize: 12, color: D.textMuted, paddingHorizontal: 20, marginTop: 8 },

  // Money hero
  moneyHero: {
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: D.inkCard, borderRadius: R.xxl,
    padding: 22, overflow: 'hidden',
    ...Shadow.card,
  },
  moneyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  moneyValue: { ...T.bold, fontSize: 34, color: D.lime, letterSpacing: -1 },
  moneyLabel: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.62)', marginTop: 4 },
  moneyPending: { ...T.medium, fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 6 },
  sparkWrap: { alignItems: 'flex-end', gap: 4 },
  sparkLabel: { ...T.medium, fontSize: 10, color: 'rgba(255,255,255,0.42)', letterSpacing: 0.4, textTransform: 'uppercase' },
  moneyDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 18 },
  moneyStats: { flexDirection: 'row', alignItems: 'center' },
  moneyStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.12)' },

  // Collaborations
  collabCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 14,
    ...Shadow.soft,
  },
  collabLogo: { width: 44, height: 44, borderRadius: 22, backgroundColor: D.surface },
  collabTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collabName: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2, flexShrink: 1 },
  statusPill: {
    backgroundColor: D.surface, borderRadius: R.full,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: D.border, flexShrink: 0,
  },
  statusPillText: { ...T.bold, fontSize: 10, color: D.textMuted, letterSpacing: 0.3, textTransform: 'capitalize' },
  monoRow: { ...T.medium, fontSize: 12, color: D.textMuted, letterSpacing: -0.1, lineHeight: 17 },

  // Products
  prodCard: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, gap: 14,
    ...Shadow.soft,
  },
  prodHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prodImg: { width: 52, height: 52, borderRadius: 12, backgroundColor: D.surface },
  prodImgPh: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: D.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: D.border,
  },
  prodName: { ...T.bold, fontSize: 14, color: D.textPrimary, letterSpacing: -0.2, flex: 1, lineHeight: 19 },

  rpvRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: D.coralSubtle, borderRadius: R.lg,
    borderWidth: 1, borderColor: D.coral + '25',
    paddingVertical: 12, paddingHorizontal: 14, overflow: 'hidden',
  },
  rpvAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: D.coral },
  rpvLabel: { ...T.bold, fontSize: 10, color: D.coral, letterSpacing: 0.8, textTransform: 'uppercase' },
  rpvValue: { ...T.bold, fontSize: 26, color: D.coral, letterSpacing: -0.6, marginTop: 2 },

  prodStats: { flexDirection: 'row', alignItems: 'center' },
  prodStatDivider: { width: 1, height: 26, backgroundColor: D.border },

  // Insights
  insightCard: {
    backgroundColor: D.coralFaint, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.coral + '22',
    padding: 18, gap: 8, overflow: 'hidden',
  },
  insightAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: D.coral },
  insightTitle: { ...T.bold, fontSize: 16, color: D.textPrimary, letterSpacing: -0.3 },
  insightBody: { ...T.regular, fontSize: 13.5, color: D.textSecondary, lineHeight: 20 },
  insightBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: D.card, borderRadius: R.full,
    paddingHorizontal: 15, paddingVertical: 10, marginTop: 4,
    borderWidth: 1, borderColor: D.coral + '30',
  },
  insightBtnText: { ...T.bold, fontSize: 13, color: D.coral, letterSpacing: -0.1 },

  // Footer
  disconnectRow: { alignItems: 'center', paddingVertical: 22, marginTop: 8 },
  disconnectText: { ...T.medium, fontSize: 13, color: D.textMuted },
});

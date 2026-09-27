import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, markNotificationsRead, type AppNotification } from '@/lib/notifications';
import { haptic } from '@/lib/haptics';
import { D, T, R } from '@/constants/ds';
import { X, Handshake, Megaphone, Wallet, Trophy, Brain, TrendingUp, Bell, Instagram, Zap } from 'lucide-react-native';

const ICON: Record<string, { Icon: any; bg: string }> = {
  offer_invited: { Icon: Handshake, bg: D.coral }, program_invited: { Icon: Handshake, bg: D.coral }, application_decided: { Icon: Handshake, bg: D.ink },
  submission_decided: { Icon: Megaphone, bg: '#3A86FF' }, payout_sent: { Icon: Wallet, bg: D.limeDeep }, payout_failed: { Icon: Wallet, bg: D.coral },
  challenge_ending: { Icon: Trophy, bg: '#F5A623' }, challenge_completed: { Icon: Trophy, bg: D.limeDeep }, discount_code_assigned: { Icon: Zap, bg: D.limeDeep },
  brain_ready: { Icon: Brain, bg: D.ink }, results_matched: { Icon: TrendingUp, bg: '#3A86FF' }, credits_low: { Icon: Zap, bg: D.coral }, instagram_relink_needed: { Icon: Instagram, bg: D.coral },
};

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => getNotifications(), staleTime: 15_000 });
  const items = q.data?.items ?? [];

  // Opening the list clears the badge; rows stay visually unread until tapped.
  useEffect(() => {
    if (!q.data?.unread) return;
    markNotificationsRead().then(() => qc.setQueryData(['notifications'], (old: any) => old ? { ...old, unread: 0 } : old)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.unread]);

  const open = (n: AppNotification) => {
    haptic.tap();
    qc.setQueryData(['notifications'], (old: any) => old ? { ...old, items: old.items.map((x: AppNotification) => x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x) } : old);
    if (n.deepLink) { router.back(); setTimeout(() => router.push(n.deepLink as any), 50); }
  };

  return (
    <View style={S.root}>
      <View style={[S.top, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textPrimary} strokeWidth={2.2} /></TouchableOpacity>
        <Text style={S.topTitle}>Notifications</Text>
        <View style={S.close} />
      </View>
      {q.isLoading ? <ActivityIndicator color={D.coral} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={D.coral} />}
          ListEmptyComponent={
            <View style={S.empty}>
              <View style={S.emptyIcon}><Bell size={22} color={D.textMuted} strokeWidth={2} /></View>
              <Text style={S.emptyTitle}>Nothing yet</Text>
              <Text style={S.emptyBody}>Brand offers, review decisions, payouts and results land here.</Text>
            </View>
          }
          renderItem={({ item: n }) => {
            const { Icon, bg } = ICON[n.kind] ?? { Icon: Bell, bg: D.ink };
            const unread = !n.readAt;
            return (
              <TouchableOpacity style={[S.row, unread && S.rowUnread]} onPress={() => open(n)} activeOpacity={0.85}>
                <View style={[S.icon, { backgroundColor: bg }]}><Icon size={16} color="#FFF" strokeWidth={2.2} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[S.title, unread && { color: D.textPrimary }]} numberOfLines={2}>{n.title}</Text>
                  {n.body ? <Text style={S.body} numberOfLines={3}>{n.body}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={S.time}>{ago(n.createdAt)}</Text>
                  {unread && <View style={S.dot} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  topTitle: { ...T.bold, fontSize: 17, color: D.textPrimary, letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: D.card, borderRadius: 18, borderWidth: 1, borderColor: D.border, padding: 14, marginBottom: 10 },
  rowUnread: { borderColor: D.coral + '55' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 14.5, color: D.textSecondary, letterSpacing: -0.2, lineHeight: 19 },
  body: { ...T.regular, fontSize: 13, color: D.textMuted, lineHeight: 18, marginTop: 3 },
  time: { ...T.medium, fontSize: 11.5, color: D.textMuted },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.coral },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: R.full, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  emptyBody: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});

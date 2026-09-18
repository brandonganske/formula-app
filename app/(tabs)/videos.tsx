import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import FadeInView from '@/components/FadeInView';
import { useQuery } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { Video } from '@/types/api';
import { D, T, R, Shadow } from '@/constants/ds';
import { Film, Eye, RefreshCw, Play, CheckCircle, Clock, AlertCircle } from 'lucide-react-native';

function statusIcon(status: string | null | undefined) {
  switch (status) {
    case 'analyzed':
    case 'complete':
      return <CheckCircle size={13} color={D.success} strokeWidth={2.5} />;
    case 'processing':
      return <Clock size={13} color={D.warning} strokeWidth={2} />;
    case 'failed':
      return <AlertCircle size={13} color={D.error} strokeWidth={2} />;
    default:
      return <Clock size={13} color={D.textDisabled} strokeWidth={2} />;
  }
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'analyzed':
    case 'complete':
      return D.success;
    case 'processing':
      return D.warning;
    case 'failed':
      return D.error;
    default:
      return D.textDisabled;
  }
}

function formatViews(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default function VideosScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<Video[]>({
    queryKey: ['videos'],
    queryFn: async () => {
      const res = await api.get('/creators/videos');
      const d = extractData<{ videos: Video[] }>(res);
      return d?.videos ?? [];
    },
    staleTime: 60_000,
  });

  const videos = data ?? [];

  return (
    <View style={S.root}>
      <View style={S.hdr}>
        <View>
          <Text style={S.hdrTitle}>Videos</Text>
          <Text style={S.hdrSub}>{videos.length > 0 ? `${videos.length} analyzed` : 'Your TikTok content'}</Text>
        </View>
        <TouchableOpacity
          style={S.refreshBtn}
          onPress={() => refetch()}
          disabled={isFetching}
          hitSlop={12}
          activeOpacity={0.75}
        >
          {isFetching
            ? <ActivityIndicator size="small" color={D.coral} />
            : <RefreshCw size={15} color={D.textMuted} strokeWidth={2} />
          }
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={S.centerWrap}>
          <ActivityIndicator color={D.coral} size="large" />
          <Text style={S.loadingText}>Loading videos...</Text>
        </View>
      )}

      {isError && !isLoading && (
        <View style={S.centerWrap}>
          <AlertCircle size={36} color={D.error} strokeWidth={1.5} />
          <Text style={S.errorTitle}>Couldn't load videos</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={S.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !isError && videos.length === 0 && (
        <View style={S.centerWrap}>
          <View style={S.emptyIcon}>
            <Film size={28} color={D.textDisabled} strokeWidth={1.5} />
          </View>
          <Text style={S.emptyTitle}>No videos yet</Text>
          <Text style={S.emptySub}>Refresh your profile to populate your videos.</Text>
        </View>
      )}

      {!isLoading && videos.length > 0 && (
        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
          {videos.map((v, i) => (
            <FadeInView key={v.id} delay={i * 40} style={{ width: '100%' }}>
              <View style={[S.videoRow, i === videos.length - 1 && S.videoRowLast]}>
                <View style={S.videoThumb}>
                  <Play size={16} color={D.coral} strokeWidth={2} fill={D.coralSubtle} />
                </View>
                <View style={S.videoBody}>
                  <Text style={S.videoTitle} numberOfLines={2}>
                    {v.title ?? v.video_id ?? 'Untitled video'}
                  </Text>
                  <View style={S.videoMeta}>
                    <Eye size={12} color={D.textDisabled} strokeWidth={2} />
                    <Text style={S.videoMetaText}>{formatViews(v.view_count)} views</Text>
                    {v.selection_reason && (
                      <>
                        <View style={S.metaDot} />
                        <Text style={S.videoMetaText}>{v.selection_reason}</Text>
                      </>
                    )}
                  </View>
                </View>
                <View style={[S.statusBadge, { borderColor: statusColor(v.analysis_status) + '40', backgroundColor: statusColor(v.analysis_status) + '10' }]}>
                  {statusIcon(v.analysis_status)}
                  <Text style={[S.statusText, { color: statusColor(v.analysis_status) }]}>
                    {v.analysis_status ?? 'pending'}
                  </Text>
                </View>
              </View>
            </FadeInView>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  hdr: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
  },
  hdrTitle: { ...T.bold, fontSize: 24, color: D.textPrimary, letterSpacing: -0.5 },
  hdrSub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 3 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: R.md,
    backgroundColor: D.card, borderWidth: 1, borderColor: D.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
    ...Shadow.soft,
  },

  scroll: { paddingHorizontal: 20 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  loadingText: { ...T.regular, fontSize: 14, color: D.textMuted },
  errorTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, textAlign: 'center', marginTop: 8 },
  retryBtn: {
    backgroundColor: D.coralSubtle, borderRadius: R.full,
    paddingHorizontal: 24, paddingVertical: 10,
    borderWidth: 1, borderColor: D.coral + '30',
  },
  retryText: { ...T.medium, fontSize: 14, color: D.coral },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { ...T.bold, fontSize: 18, color: D.textPrimary, textAlign: 'center' },
  emptySub: { ...T.regular, fontSize: 14, color: D.textSecondary, textAlign: 'center', lineHeight: 22 },

  videoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: D.divider,
  },
  videoRowLast: { borderBottomWidth: 0 },
  videoThumb: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: D.coralFaint,
    borderWidth: 1, borderColor: D.coral + '25',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  videoBody: { flex: 1, gap: 5 },
  videoTitle: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 20 },
  videoMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  videoMetaText: { ...T.regular, fontSize: 12, color: D.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: D.textDisabled },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, flexShrink: 0,
  },
  statusText: { ...T.medium, fontSize: 11 },
});

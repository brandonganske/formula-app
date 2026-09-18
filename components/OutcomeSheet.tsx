import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { D, T, R } from '@/constants/ds';
import { Check, X, Film, Eye, Link2Off } from 'lucide-react-native';
import type { OutcomeCandidate, ScriptOutcome } from '@/types/api';

const fmtNum = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
};
const relDate = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// "Did you post this?" — link a saved script to the TikTok that came from it.
// Candidates are the creator's videos posted after the script was saved,
// ranked by caption/timing similarity; the creator confirms.
export default function OutcomeSheet({ scriptId, current, onClose }: { scriptId: string; current: ScriptOutcome | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(current?.external_video_id ?? null);

  const { data, isLoading } = useQuery({
    queryKey: ['script-outcome-candidates', scriptId],
    queryFn: async () => {
      const res = await api.get(`/creators/scripts/${scriptId}/outcome`);
      return extractData<{ candidates: OutcomeCandidate[] }>(res)?.candidates ?? [];
    },
    staleTime: 60_000,
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ['saved-scripts'] });
    qc.invalidateQueries({ queryKey: ['results'] });
    onClose();
  };
  const link = useMutation({
    mutationFn: async (external_video_id: string) => { await api.post(`/creators/scripts/${scriptId}/outcome`, { external_video_id }); },
    onSuccess: done,
  });
  const unlink = useMutation({
    mutationFn: async () => { await api.delete(`/creators/scripts/${scriptId}/outcome`); },
    onSuccess: done,
  });
  const busy = link.isPending || unlink.isPending;
  const candidates = data ?? [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable style={S.sheet} onPress={() => {}}>
          <View style={S.hdr}>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>{current ? 'Linked video' : 'Did you post this?'}</Text>
              <Text style={S.sub}>{current ? 'Change or unlink the video this script became.' : 'Pick the TikTok you filmed from this script so results flow back.'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}><X size={20} color={D.textMuted} strokeWidth={2} /></TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={S.center}><ActivityIndicator color={D.coral} /></View>
          ) : candidates.length === 0 ? (
            <View style={S.center}>
              <View style={S.emptyIcon}><Film size={22} color={D.textDisabled} strokeWidth={1.6} /></View>
              <Text style={S.emptyTitle}>No new videos yet</Text>
              <Text style={S.emptySub}>We check your TikTok every few hours. Once you post, it'll show up here.</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {candidates.map((c) => {
                const on = picked === c.external_video_id;
                return (
                  <TouchableOpacity key={c.external_video_id} style={[S.row, on && S.rowOn]} onPress={() => setPicked(on ? null : c.external_video_id)} activeOpacity={0.8}>
                    <View style={[S.thumb, on && S.thumbOn]}><Film size={16} color={on ? '#FFF' : D.textMuted} strokeWidth={2} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[S.caption, on && S.captionOn]} numberOfLines={2}>{c.caption || 'Untitled video'}</Text>
                      <View style={S.metaRow}>
                        <Eye size={11} color={D.textMuted} strokeWidth={2.2} />
                        <Text style={S.meta}>{fmtNum(c.views)}</Text>
                        <Text style={S.meta}>· {relDate(c.posted_at)}</Text>
                        {c.score >= 0.4 && <Text style={S.likely}>· likely match</Text>}
                      </View>
                    </View>
                    <View style={[S.radio, on && S.radioOn]}>{on && <Check size={12} color="#FFF" strokeWidth={3} />}</View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[S.primary, (!picked || busy || picked === current?.external_video_id) && S.primaryOff]}
            disabled={!picked || busy || picked === current?.external_video_id}
            onPress={() => picked && link.mutate(picked)}
            activeOpacity={0.85}
          >
            {link.isPending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={S.primaryText}>{current ? 'Change link' : 'Link this video'}</Text>}
          </TouchableOpacity>
          {current && (
            <TouchableOpacity style={S.unlink} onPress={() => unlink.mutate()} disabled={busy} activeOpacity={0.8}>
              <Link2Off size={14} color={D.error} strokeWidth={2.2} />
              <Text style={S.unlinkText}>Unlink</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, borderWidth: 1, borderColor: D.cardBorder },
  hdr: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title: { ...T.bold, fontSize: 19, color: D.textPrimary, letterSpacing: -0.4 },
  sub: { ...T.regular, fontSize: 13.5, color: D.textMuted, marginTop: 4, lineHeight: 19 },
  center: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { ...T.bold, fontSize: 16, color: D.textPrimary },
  emptySub: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: D.border, backgroundColor: D.surface, marginBottom: 8 },
  rowOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  thumb: { width: 44, height: 56, borderRadius: 10, backgroundColor: D.inkHairline, alignItems: 'center', justifyContent: 'center' },
  thumbOn: { backgroundColor: D.coral },
  caption: { ...T.medium, fontSize: 14, color: D.textPrimary, lineHeight: 19 },
  captionOn: { ...T.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { ...T.medium, fontSize: 12, color: D.textMuted },
  likely: { ...T.bold, fontSize: 12, color: D.limeDeep },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: D.coral, borderColor: D.coral },
  primary: { backgroundColor: D.coral, borderRadius: R.full, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryOff: { opacity: 0.45 },
  primaryText: { ...T.bold, fontSize: 16, color: '#FFF' },
  unlink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  unlinkText: { ...T.bold, fontSize: 13.5, color: D.error },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { D, T, R } from '@/constants/ds';
import { X, RefreshCw, ShieldCheck } from 'lucide-react-native';
import ShopSafeReport from '@/components/ShopSafeReport';
import type { SavedScriptItem, ShopSafeResult, ShopSafeFinding } from '@/types/api';

// Shop Safe for a saved script: shows the stored report, re-checks on demand,
// and applies a fix by rewriting the quoted line inside the saved script.
export default function ShopSafeSheet({ item, onClose }: { item: SavedScriptItem; onClose: () => void }) {
  const qc = useQueryClient();
  const stored: ShopSafeResult | null = item.shop_safe_grade
    ? { grade: item.shop_safe_grade, score: item.shop_safe_score ?? 0, findings: item.shop_safe_findings ?? [], summary: item.shop_safe_summary ?? '', checked_at: item.shop_safe_checked_at ?? undefined }
    : null;
  const [result, setResult] = useState<ShopSafeResult | null>(stored);

  const check = useMutation({
    mutationFn: async () => extractData<ShopSafeResult>(await api.post(`/creators/scripts/${item.id}/shop-safe`)) as ShopSafeResult,
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ['saved-scripts'] }); },
    onError: (e: any) => Alert.alert('Couldn’t check', e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.'),
  });

  const useFix = useMutation({
    mutationFn: async (f: ShopSafeFinding) => {
      const current = item.full_script ?? [item.hook, ...(item.body ?? []), item.cta].filter(Boolean).join('\n');
      if (!current.includes(f.quote)) throw new Error('That line has already changed — re-check to refresh the report.');
      const next = current.replace(f.quote, f.fix);
      await api.patch(`/creators/scripts/${item.id}`, { full_script: next });
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-scripts'] });
      // Re-grade against the edited script so the badge reflects the fix.
      check.mutate();
    },
    onError: (e: any) => Alert.alert('Couldn’t apply', e?.message ?? 'Please try again.'),
  });

  const busy = check.isPending || useFix.isPending;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable style={S.sheet} onPress={() => {}}>
          <View style={S.hdr}>
            <View style={{ flex: 1 }}>
              <Text style={S.title}>Shop Safe</Text>
              <Text style={S.sub}>{result?.checked_at ? `Checked ${new Date(result.checked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'TikTok Shop policy check for this script.'}</Text>
            </View>
            <TouchableOpacity onPress={() => check.mutate()} disabled={busy} hitSlop={10} style={S.recheck}>
              {check.isPending ? <ActivityIndicator size="small" color={D.coral} /> : <RefreshCw size={16} color={D.coral} strokeWidth={2.4} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={12}><X size={20} color={D.textMuted} strokeWidth={2} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            {result ? (
              <ShopSafeReport r={result} onUseFix={busy ? undefined : (f) => useFix.mutate(f)} />
            ) : (
              <View style={S.empty}>
                <View style={S.emptyIcon}><ShieldCheck size={24} color={D.textDisabled} strokeWidth={1.6} /></View>
                <Text style={S.emptyTitle}>Not checked yet</Text>
                <Text style={S.emptySub}>We'll read every line against TikTok Shop's rules and rewrite anything risky in your voice.</Text>
                <TouchableOpacity style={S.primary} onPress={() => check.mutate()} disabled={busy} activeOpacity={0.85}>
                  {check.isPending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={S.primaryText}>Check this script</Text>}
                </TouchableOpacity>
              </View>
            )}
            {useFix.isPending && <Text style={S.applying}>Applying fix and re-checking…</Text>}
            <View style={{ height: 8 }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, borderWidth: 1, borderColor: D.cardBorder },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { ...T.bold, fontSize: 19, color: D.textPrimary, letterSpacing: -0.4 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 2 },
  recheck: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: D.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...T.bold, fontSize: 17, color: D.textPrimary },
  emptySub: { ...T.regular, fontSize: 13.5, color: D.textMuted, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  primary: { backgroundColor: D.coral, borderRadius: R.full, height: 50, minWidth: 200, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 24 },
  primaryText: { ...T.bold, fontSize: 15.5, color: '#FFF' },
  applying: { ...T.medium, fontSize: 12.5, color: D.textMuted, textAlign: 'center', marginTop: 8 },
});

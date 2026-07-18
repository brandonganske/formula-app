import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { SavedScriptItem, SavedScriptsResponse } from '@/types/api';
import { D, T, R, Shadow, Gradient } from '@/constants/ds';
import {
  ChevronLeft, Copy, Check, ShoppingBag, Film, Sparkles, AlertTriangle, TrendingUp, Zap,
} from 'lucide-react-native';

// ── Helpers (kept in sync with the Saved tab) ──────────────────────────────

function originLabel(origin: string | null | undefined): string {
  if (origin === 'product_script') return 'Shop';
  if (origin === 'organic_script') return 'Organic';
  if (origin === 'viral_topic') return 'Viral';
  return 'Rewrite';
}
function OriginIcon({ origin, size = 11 }: { origin: string | null | undefined; size?: number }) {
  if (origin === 'product_script') return <ShoppingBag size={size} color={D.coral} strokeWidth={2} />;
  if (origin === 'organic_script') return <Sparkles size={size} color={D.limeDeep} strokeWidth={2} />;
  if (origin === 'viral_topic') return <TrendingUp size={size} color={D.amber} strokeWidth={2} />;
  return <Film size={size} color={D.cyan} strokeWidth={2} />;
}

// Flatten a saved script into one editable blob. full_script wins; otherwise
// compose hook + body. The CTA is intentionally left out — it renders in its
// own read-only card below the editor.
function scriptToText(item: SavedScriptItem): string {
  if (item.full_script && item.full_script.trim()) return item.full_script;
  const parts: string[] = [];
  if (item.hook) parts.push(item.hook);
  if (item.body?.length) parts.push(item.body.join('\n'));
  return parts.join('\n\n');
}

export default function ScriptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Share the Saved-tab cache; only fetch if it isn't already loaded.
  const { data: scripts = [], isLoading } = useQuery<SavedScriptItem[]>({
    queryKey: ['saved-scripts'],
    queryFn: async () => {
      const res = await api.get('/creators/scripts');
      const d = extractData<SavedScriptsResponse>(res);
      return d?.scripts ?? (Array.isArray(d) ? d : []);
    },
    staleTime: 60_000,
  });

  const item = useMemo(() => scripts.find((s) => s.id === id) ?? null, [scripts, id]);

  const original = item ? scriptToText(item) : '';
  const [text, setText] = useState<string | null>(null); // null until item resolves
  const value = text ?? original;
  const dirty = item != null && value.trim() !== original.trim();

  // CTA + "why this works" are saved with the script but shown read-only — the
  // editable field is just the script body.
  const sd = (item?.script_data ?? {}) as any;
  const ctaText = item?.cta?.trim() || undefined;
  const showCta = !!ctaText && !value.includes(ctaText);
  const whyText: string | undefined =
    sd.why_this_works ?? sd.option?.why_this_works ?? sd.why ?? undefined;

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = item?.option_label ?? item?.product_name ?? 'Script';

  const handleCopy = () => {
    void Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!item || !dirty || saving) return;
    const next = value;
    const prevList = queryClient.getQueryData<SavedScriptItem[]>(['saved-scripts']);
    setSaving(true);
    // Optimistically patch the cache so the Saved tab reflects the edit too.
    queryClient.setQueryData<SavedScriptItem[]>(['saved-scripts'], (list) =>
      (list ?? []).map((s) => (s.id === item.id ? { ...s, full_script: next } : s)),
    );
    try {
      await api.patch(`/creators/scripts/${item.id}`, { full_script: next });
      queryClient.invalidateQueries({ queryKey: ['saved-scripts'] });
      router.back();
    } catch (err: any) {
      if (prevList) queryClient.setQueryData(['saved-scripts'], prevList);
      Alert.alert(
        'Couldn’t save',
        err?.response?.data?.error?.message ?? err?.message ?? 'Your edit didn’t save. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={S.root}>
      {/* Gradient header */}
      <LinearGradient
        colors={Gradient.hero}
        start={{ x: 0.13, y: 0 }} end={{ x: 0.87, y: 1 }}
        style={S.header}
      >
        <View style={S.headerRow}>
          <TouchableOpacity style={S.headerBtn} onPress={() => router.back()} hitSlop={10} activeOpacity={0.7}>
            <ChevronLeft size={20} color="#FFF" strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={S.headerTitle} numberOfLines={1}>{title}</Text>
            {item && (
              <View style={S.metaRow}>
                <View style={S.originPill}>
                  <OriginIcon origin={item.origin} size={10} />
                  <Text style={S.originText}>{originLabel(item.origin)}</Text>
                </View>
                {item.product_name ? <Text style={S.metaText} numberOfLines={1}>{item.product_name}</Text> : null}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[S.saveBtn, !dirty && S.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!dirty || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color={D.coral} />
              : <Text style={[S.saveText, !dirty && S.saveTextDisabled]}>Save</Text>}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {isLoading && !item ? (
        <View style={S.center}><ActivityIndicator size="large" color={D.coral} /></View>
      ) : !item ? (
        <View style={S.center}>
          <AlertTriangle size={26} color={D.warning} strokeWidth={1.5} />
          <Text style={S.missingTitle}>Script not found</Text>
          <TouchableOpacity style={S.backPill} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={S.backPillText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView contentContainerStyle={S.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={S.editorCard}>
              <View style={S.editorHead}>
                <Text style={S.editorLabel}>SCRIPT</Text>
                <TouchableOpacity style={S.copyBtn} onPress={handleCopy} activeOpacity={0.75}>
                  {copied
                    ? <><Check size={13} color={D.success} strokeWidth={2.5} /><Text style={[S.copyText, { color: D.success }]}>Copied</Text></>
                    : <><Copy size={13} color={D.textMuted} strokeWidth={2} /><Text style={S.copyText}>Copy</Text></>}
                </TouchableOpacity>
              </View>
              <TextInput
                style={S.editor}
                value={value}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                placeholder="Write your script…"
                placeholderTextColor={D.textDisabled}
                scrollEnabled={false}
              />
            </View>

            {/* Read-only CTA */}
            {showCta && (
              <View style={S.roCard}>
                <Text style={S.roLabel}>CALL TO ACTION</Text>
                <Text style={S.roText}>{ctaText}</Text>
              </View>
            )}

            {/* Read-only "why this works" (green) */}
            {whyText ? (
              <View style={S.whyCard}>
                <View style={S.whyHead}>
                  <Zap size={13} color={D.limeDeep} strokeWidth={2} />
                  <Text style={S.whyLabel}>WHY THIS WORKS</Text>
                </View>
                <Text style={S.whyText}>{whyText}</Text>
              </View>
            ) : null}

            <Text style={S.hint}>
              Your script is editable. The CTA and why-it-works are saved with it and stay as-is.
            </Text>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },

  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, ...Shadow.coral },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  headerTitle: { ...T.bold, fontSize: 18, color: '#FFF', letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  originPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.full,
  },
  originText: { ...T.bold, fontSize: 10, color: D.ink },
  metaText: { ...T.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
  saveBtn: {
    backgroundColor: '#FFF', borderRadius: R.full,
    paddingHorizontal: 16, paddingVertical: 9, minWidth: 64, alignItems: 'center', flexShrink: 0,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.25)' },
  saveText: { ...T.bold, fontSize: 14, color: D.coral },
  saveTextDisabled: { color: 'rgba(255,255,255,0.7)' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  missingTitle: { ...T.bold, fontSize: 18, color: D.textSecondary },
  backPill: { backgroundColor: D.coralSubtle, borderRadius: R.full, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: D.coral + '40' },
  backPillText: { ...T.bold, fontSize: 13, color: D.coral },

  scroll: { padding: 16 },
  editorCard: {
    backgroundColor: D.card, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.cardBorder, padding: 16, ...Shadow.soft,
  },
  editorHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  editorLabel: { ...T.bold, fontSize: 10, color: D.textDisabled, letterSpacing: 1.5 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 8, borderRadius: R.md, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border },
  copyText: { ...T.medium, fontSize: 12, color: D.textMuted },
  editor: { ...T.regular, fontSize: 15, color: D.textPrimary, lineHeight: 24, minHeight: 320, padding: 0 },
  hint: { ...T.regular, fontSize: 12, color: D.textMuted, marginTop: 14, textAlign: 'center', lineHeight: 18 },

  roCard: {
    marginTop: 14, backgroundColor: D.inkCard, borderRadius: R.xl, padding: 16,
  },
  roLabel: { ...T.bold, fontSize: 10, color: D.lime, letterSpacing: 1.4, marginBottom: 6 },
  roText: { ...T.medium, fontSize: 14, color: '#FFF', lineHeight: 21 },

  whyCard: {
    marginTop: 12, backgroundColor: D.limeSubtle, borderRadius: R.xl,
    borderWidth: 1, borderColor: D.lime + '40', padding: 16,
  },
  whyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  whyLabel: { ...T.bold, fontSize: 10, color: D.limeDeep, letterSpacing: 1.4 },
  whyText: { ...T.regular, fontSize: 13.5, color: D.limeDeep, lineHeight: 20 },
});

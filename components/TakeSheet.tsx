import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, ActivityIndicator, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api, extractData } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { D, T, R } from '@/constants/ds';
import { X, Trash2, Link2, Check, Share2, FileText, Mic, Download } from 'lucide-react-native';
import { isNativeTikTokAvailable, isTikTokAppInstalled, shareVideos } from '@/modules/tiktok-login';
import type { Take, SavedScriptItem, SavedScriptsResponse } from '@/types/api';

let VideoMod: any = null;
try { VideoMod = require('expo-video'); } catch {}
function Player({ uri }: { uri: string }) {
  const player = VideoMod.useVideoPlayer(uri, (p: any) => { p.loop = true; p.play(); });
  return <VideoMod.VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

// One take: watch it, attach it to a script, post it, or delete it.
export default function TakeSheet({ take, onClose }: { take: Take; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const [attaching, setAttaching] = useState(false);

  const { data: scripts } = useQuery<SavedScriptItem[]>({
    queryKey: ['saved-scripts'],
    queryFn: async () => { const d = extractData<SavedScriptsResponse>(await api.get('/creators/scripts')); return d?.scripts ?? (Array.isArray(d) ? d : []); },
    staleTime: 60_000,
    enabled: attaching,
  });

  const done = () => { qc.invalidateQueries({ queryKey: ['takes'] }); };
  const attach = useMutation({
    mutationFn: async (s: SavedScriptItem | null) => { await api.patch(`/creators/takes/${take.id}`, { script_id: s?.id ?? null, product_name: s?.product_name ?? null }); },
    onSuccess: () => { haptic.success(); done(); setAttaching(false); onClose(); },
    onError: (e: any) => { haptic.error(); Alert.alert('Couldn’t attach', e?.message ?? 'Please try again.'); },
  });
  const remove = useMutation({
    mutationFn: async () => { await api.delete(`/creators/takes/${take.id}`); },
    onSuccess: () => { done(); onClose(); },
  });

  // Pull the take from Formula into Photos (for takes filmed on another phone,
  // or saved before Photos access was granted), then remember the asset id so
  // "Edit in TikTok & post" works from here on.
  const [savingPhotos, setSavingPhotos] = useState(false);
  const saveToPhotos = async (): Promise<string | null> => {
    if (!take.video_url) { Alert.alert('No video', 'This take has no video file to save.'); return null; }
    let FS: any = null, ML: any = null;
    try { FS = require('expo-file-system/legacy'); ML = require('expo-media-library'); } catch {}
    if (!FS || !ML) { Alert.alert('Update needed', 'Saving to Photos needs the latest build.'); return null; }
    setSavingPhotos(true);
    try {
      let perm = await ML.requestPermissionsAsync?.(false);
      if (!perm?.granted && perm?.accessPrivileges !== 'limited') perm = await ML.requestPermissionsAsync?.(true);
      if (!perm?.granted) { Alert.alert('Photo access needed', 'Allow photo library access in Settings.'); return null; }
      const dest = `${FS.cacheDirectory}take-${take.id}.mp4`;
      const dl = await FS.downloadAsync(take.video_url, dest);
      if (!dl?.uri) throw new Error('Download failed');
      const asset = await ML.createAssetAsync(dl.uri);
      const assetId: string | null = asset?.id ?? null;
      if (assetId) { try { await api.patch(`/creators/takes/${take.id}`, { photos_asset_id: assetId }); done(); } catch {} }
      haptic.success();
      return assetId;
    } catch (e: any) { haptic.error(); Alert.alert('Couldn’t save', e?.message ?? 'Please try again.'); return null; }
    finally { setSavingPhotos(false); }
  };

  const post = async () => {
    if (!isNativeTikTokAvailable() || !isTikTokAppInstalled()) { Alert.alert('TikTok not found', 'Install TikTok to post from here. The take is in Saved → Videos and, once saved to Photos, in your camera roll.'); return; }
    let assetId = take.photos_asset_id;
    if (!assetId) assetId = await saveToPhotos(); // not on this phone yet — pull it into Photos first
    if (!assetId) return;
    try { const r = await shareVideos([assetId], 'https://iq.influenceish.com/tiktok/native'); if (!r.isSuccess) Alert.alert('Not posted', r.errorMsg); }
    catch (e: any) { Alert.alert('Not posted', e?.message ?? 'Please try again.'); }
  };

  const label = take.script?.title ?? take.title ?? 'Take';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable style={S.sheet} onPress={() => {}}>
          <View style={S.hdr}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={S.title} numberOfLines={1}>{label}</Text>
              <Text style={S.sub} numberOfLines={1}>{take.product_name ? `${take.product_name} · ` : ''}{new Date(take.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{take.duration_sec ? ` · ${Math.floor(take.duration_sec / 60)}:${String(take.duration_sec % 60).padStart(2, '0')}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}><X size={20} color={D.textMuted} strokeWidth={2} /></TouchableOpacity>
          </View>

          {attaching ? (
            <ScrollView style={{ maxHeight: height * 0.45 }} showsVerticalScrollIndicator={false}>
              <Text style={S.label}>ATTACH TO A SCRIPT</Text>
              {(scripts ?? []).map((s) => {
                const on = s.id === take.script_id;
                return (
                  <TouchableOpacity key={s.id} style={[S.row, on && S.rowOn]} onPress={() => attach.mutate(s)} activeOpacity={0.8}>
                    <FileText size={15} color={on ? D.coral : D.textMuted} strokeWidth={2} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[S.rowTitle, on && { color: D.coral }]} numberOfLines={1}>{s.option_label ?? s.product_name ?? 'Untitled script'}</Text>
                      {s.hook ? <Text style={S.rowSub} numberOfLines={1}>“{s.hook}”</Text> : null}
                    </View>
                    {on && <Check size={14} color={D.coral} strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
              {take.script_id && (
                <TouchableOpacity style={S.row} onPress={() => attach.mutate(null)} activeOpacity={0.8}>
                  <Link2 size={15} color={D.textMuted} strokeWidth={2} /><Text style={S.rowTitle}>Detach from script</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          ) : (
            <>
              <View style={[S.player, { height: Math.min(height * 0.42, 380) }]}>
                {take.video_url && VideoMod ? <Player uri={take.video_url} /> : <Text style={S.noPlayer}>Preview needs the latest build.</Text>}
              </View>
              <TouchableOpacity style={[S.btn, S.btnPrimary, S.btnWide]} onPress={() => { haptic.press(); post(); }} activeOpacity={0.85}><Share2 size={16} color="#FFF" strokeWidth={2.4} /><Text style={S.btnTextOn} numberOfLines={1}>Edit in TikTok & post</Text></TouchableOpacity>
              <View style={S.actions}>
                <TouchableOpacity style={S.btn} onPress={() => { haptic.tap(); void saveToPhotos().then((id) => { if (id) Alert.alert('Saved to Photos', 'The take is in your camera roll.'); }); }} activeOpacity={0.85} disabled={savingPhotos}>
                  {savingPhotos ? <ActivityIndicator size="small" color={D.textPrimary} /> : <><Download size={15} color={D.textPrimary} strokeWidth={2.2} /><Text style={S.btnText}>Photos</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={S.btn} onPress={() => { haptic.tap(); onClose(); router.push({ pathname: '/tools/coach', params: { takeId: take.id } }); }} activeOpacity={0.85}><Mic size={15} color={D.textPrimary} strokeWidth={2.2} /><Text style={S.btnText}>Coach</Text></TouchableOpacity>
                <TouchableOpacity style={S.btn} onPress={() => { haptic.tap(); if (take.script_id) { onClose(); router.push(`/script/${take.script_id}`); } else setAttaching(true); }} onLongPress={() => { haptic.select(); setAttaching(true); }} activeOpacity={0.85}><Link2 size={15} color={D.textPrimary} strokeWidth={2.2} /><Text style={S.btnText}>{take.script_id ? 'Script' : 'Attach'}</Text></TouchableOpacity>
                <TouchableOpacity style={[S.btn, S.btnDanger]} onPress={() => Alert.alert('Delete take?', 'This removes it from Formula (not from your Photos).', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate() }])} activeOpacity={0.85} disabled={remove.isPending}>
                  {remove.isPending ? <ActivityIndicator size="small" color={D.error} /> : <Trash2 size={15} color={D.error} strokeWidth={2.2} />}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: D.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, borderWidth: 1, borderColor: D.cardBorder },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { ...T.bold, fontSize: 18, color: D.textPrimary, letterSpacing: -0.3 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 2 },
  player: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  noPlayer: { ...T.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnWide: { marginTop: 14, height: 50 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: R.full, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border },
  btnPrimary: { backgroundColor: D.ink, borderColor: D.ink },
  btnDanger: { flex: 0, width: 46, backgroundColor: D.errorSubtle, borderColor: D.errorBorder },
  btnText: { ...T.bold, fontSize: 13.5, color: D.textPrimary },
  btnTextOn: { ...T.bold, fontSize: 15, color: '#FFF' },
  label: { ...T.bold, fontSize: 11, color: D.textMuted, letterSpacing: 0.6, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: D.border, backgroundColor: D.surface, marginBottom: 8 },
  rowOn: { borderColor: D.coral, backgroundColor: D.coralFaint },
  rowTitle: { ...T.bold, fontSize: 14, color: D.textPrimary },
  rowSub: { ...T.regular, fontSize: 12, color: D.textMuted, fontStyle: 'italic', marginTop: 2 },
});

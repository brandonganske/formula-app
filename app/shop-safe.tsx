import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FadeInView from '@/components/FadeInView';
import AnimatedPressable from '@/components/AnimatedPressable';
import ShopSafeReport from '@/components/ShopSafeReport';
import { api, extractData } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { TOOL_COST, isInsufficientCredits, isFairUse, creditLabel } from '@/lib/credits';
import { useAuth } from '@/context/AuthContext';
import NoCreditsModal from '@/components/NoCreditsModal';
import { useQuery } from '@tanstack/react-query';
import type { SavedScriptItem, SavedScriptsResponse } from '@/types/api';
import { D, T, R, Shadow } from '@/constants/ds';
import { ShieldCheck, Upload, X, Film, FileText } from 'lucide-react-native';
import type { ShopSafeResult } from '@/types/api';

type Phase = 'idle' | 'uploading' | 'checking' | 'done';

// "Already filmed it?" — pick a cut from the camera roll, upload it privately,
// and get a timestamped Shop Safe report before posting.
export default function ShopSafeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canAfford: afford, refreshMe } = useAuth();
  const [showNoCredits, setShowNoCredits] = useState(false);
  // Every check costs credits: gate locally first, then trust the server's 402.
  const canAfford = (cost: number) => { if (!afford(cost)) { haptic.warning(); setShowNoCredits(true); return false; } return true; };
  const fail = (e: any, title: string) => {
    haptic.error(); setPhase('idle');
    if (isInsufficientCredits(e)) { setShowNoCredits(true); return; }
    if (isFairUse(e)) { Alert.alert('Monthly limit reached', e?.response?.data?.error?.message ?? 'Video analysis resets on the 1st.'); return; }
    Alert.alert(title, e?.response?.data?.error?.message ?? e?.message ?? 'Please try again.');
  };
  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<ShopSafeResult | null>(null);
  const [name, setName] = useState<string | null>(null);
  const { mode: modeParam, url: urlParam, text: textParam, scriptId } = useLocalSearchParams<{ mode?: string; url?: string; text?: string; scriptId?: string }>();
  const [mode, setMode] = useState<'video' | 'script' | null>(modeParam === 'script' || modeParam === 'video' || textParam || scriptId ? (modeParam === 'video' ? 'video' : 'script') : null);
  const scriptMode = mode === 'script';
  const [script, setScript] = useState(textParam ?? '');
  const [fromTitle, setFromTitle] = useState<string | null>(null);

  // A saved script handed in by id: prefill its text and run the check.
  const { data: saved } = useQuery<SavedScriptItem[]>({
    queryKey: ['saved-scripts'],
    queryFn: async () => { const d = extractData<SavedScriptsResponse>(await api.get('/creators/scripts')); return d?.scripts ?? (Array.isArray(d) ? d : []); },
    staleTime: 60_000,
    enabled: !!scriptId,
  });
  useEffect(() => {
    if (!scriptId || !saved) return;
    const it = saved.find((x) => x.id === scriptId);
    if (!it) return;
    const t = it.full_script?.trim() || [it.hook, ...(it.body ?? []), it.cta].filter(Boolean).join('\n');
    setFromTitle(it.option_label ?? it.product_name ?? null);
    setScript(t);
  }, [scriptId, saved]);

  // A pass feels different from a fail in the hand.
  const gradeHaptic = (r: ShopSafeResult) => { if (r.grade === 'A' || r.grade === 'B') haptic.success(); else haptic.warning(); };

  // Links shared in from TikTok (or pasted): check the posted video by URL.
  const runUrl = async (u: string) => {
    if (!canAfford(TOOL_COST.shopSafeVideo)) return;
    try {
      setMode('video'); setPhase('checking'); setResult(null); setName(u);
      const r = extractData<ShopSafeResult>(await api.post('/creators/compliance/check', { video_url: u }, { timeout: 300_000 })) as ShopSafeResult;
      setResult(r); setPhase('done'); gradeHaptic(r); void refreshMe();
    } catch (e: any) { fail(e, 'Couldn’t check that video'); }
  };
  useEffect(() => { if (urlParam && /^https?:\/\//i.test(urlParam)) runUrl(urlParam); }, [urlParam]);

  const runScript = async () => {
    if (!script.trim()) return;
    Keyboard.dismiss();
    if (!canAfford(TOOL_COST.shopSafeScript)) return;
    try {
      setPhase('checking'); setResult(null);
      const r = extractData<ShopSafeResult>(await api.post('/creators/compliance/check', { script: script.trim() }, { timeout: 120_000 })) as ShopSafeResult;
      setResult(r); setPhase('done'); gradeHaptic(r); void refreshMe();
    } catch (e: any) { fail(e, 'Couldn’t check that script'); }
  };

  // The picker and uploader are native modules added after the first dev
  // builds shipped; load them lazily so older clients still run and just get
  // an "update the app" message here instead of crashing at startup.
  const loadNative = () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const FileSystem = require('expo-file-system/legacy');
      return { ImagePicker, FileSystem };
    } catch {
      return null;
    }
  };

  const pick = async () => {
    if (!canAfford(TOOL_COST.shopSafeVideo)) return;
    const native = loadNative();
    if (!native) { Alert.alert('Update needed', 'Video checks need the latest build of the app. Update from TestFlight and try again.'); return; }
    const { ImagePicker } = native;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Photo access needed', 'Allow photo library access in Settings to check a video.'); return; }
    // 720p export keeps uploads well under storage limits and is plenty for the check.
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: false, videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setName(a.fileName ?? 'video');
    await run(native.FileSystem, a.uri, a.fileName ?? 'video.mp4', a.mimeType ?? 'video/mp4');
  };

  const run = async (FileSystem: any, uri: string, filename: string, mime: string) => {
    try {
      setPhase('uploading'); setPct(0); setResult(null);
      const up = extractData<{ signed_url: string; storage_path: string }>(await api.post('/creators/compliance/upload-url', { filename, content_type: mime }));
      if (!up?.signed_url) throw new Error('Could not start the upload.');
      const task = FileSystem.createUploadTask(up.signed_url, uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'content-type': mime },
      }, (p: any) => setPct(p.totalBytesExpectedToSend ? p.totalBytesSent / p.totalBytesExpectedToSend : 0));
      const res = await task.uploadAsync();
      if (!res || res.status < 200 || res.status >= 300) {
        const tooBig = res && (res.status === 413 || /413|too large|EntityTooLarge/i.test(res.body ?? ''));
        throw new Error(tooBig ? 'That video is too large to upload. Try a shorter cut (under ~50MB).' : `Upload failed (${res?.status ?? 'network'})`);
      }
      setPhase('checking');
      const r = extractData<ShopSafeResult>(await api.post('/creators/compliance/check', { storage_path: up.storage_path }, { timeout: 300_000 })) as ShopSafeResult;
      setResult(r); setPhase('done'); gradeHaptic(r); void refreshMe();
    } catch (e: any) { fail(e, 'Couldn’t check that video'); }
  };

  return (
    <View style={[S.root, { paddingTop: insets.top + 8 }]}>
      <View style={S.hdr}>
        <View style={S.hdrIcon}><ShieldCheck size={18} color="#FFF" strokeWidth={2.4} /></View>
        <View style={{ flex: 1 }}>
          <Text style={S.title}>Shop Safe</Text>
          <Text style={S.sub}>{mode == null ? 'TikTok Shop policy check' : scriptMode ? 'Check a script before you film it.' : 'Check a video before you post it.'}</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color={D.textMuted} strokeWidth={2.2} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>
        {phase === 'idle' && mode == null && (
          <FadeInView style={S.card}>
            <Text style={S.dropTitle}>Catch it before TikTok does.</Text>
            <Text style={S.dropSub}>Health claims, guarantees, fake urgency, before/afters — the lines that get shoppable videos flagged or buried. We find them and tell you what to say instead, in your voice.</Text>
            <View style={{ gap: 8, marginTop: 18 }}>
              <AnimatedPressable style={S.choice} haptic="light" onPress={() => setMode('video')}>
                <View style={S.choiceIcon}><Film size={18} color={D.ink} strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}><Text style={S.choiceTitle}>Check a video</Text><Text style={S.choiceSub}>Upload a cut before posting · {creditLabel(TOOL_COST.shopSafeVideo)}</Text></View>
              </AnimatedPressable>
              <AnimatedPressable style={S.choice} haptic="light" onPress={() => setMode('script')}>
                <View style={S.choiceIcon}><FileText size={18} color={D.ink} strokeWidth={2.2} /></View>
                <View style={{ flex: 1 }}><Text style={S.choiceTitle}>Check a script</Text><Text style={S.choiceSub}>Paste anything before you film · {creditLabel(TOOL_COST.shopSafeScript)}</Text></View>
              </AnimatedPressable>
            </View>
            <Text style={S.hint}>Script checks are free. Every script you save is checked automatically — look for the grade on Saved.</Text>
          </FadeInView>
        )}

        {phase === 'idle' && scriptMode && (
          <FadeInView style={S.card}>
            <View style={S.dropIcon}><FileText size={26} color={D.coral} strokeWidth={2} /></View>
            <Text style={S.dropTitle}>{fromTitle ? fromTitle : 'Paste your script'}</Text>
            <Text style={S.dropSub}>{fromTitle ? 'Loaded from Saved. Edit anything, then check it.' : 'Spoken lines, captions, on-screen text — anything the viewer will see or hear.'}</Text>
            <View style={S.inputBox}>
              <TextInput
                style={S.input}
                value={script}
                onChangeText={setScript}
                placeholder={"Let's talk about the gummies that…\n[on screen: 20% OFF TODAY]"}
                placeholderTextColor={D.textDisabled}
                multiline
                textAlignVertical="top"
              />
            </View>
            <AnimatedPressable style={[S.cta, !script.trim() && { opacity: 0.45 }]} haptic="medium" onPress={runScript} disabled={!script.trim()}>
              <ShieldCheck size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={S.ctaText}>Check this script</Text><Text style={S.ctaCost}>{creditLabel(TOOL_COST.shopSafeScript)}</Text>
            </AnimatedPressable>
          </FadeInView>
        )}

        {phase === 'idle' && mode === 'video' && (
          <FadeInView style={S.card}>
            <View style={S.dropIcon}><Film size={26} color={D.coral} strokeWidth={2} /></View>
            <Text style={S.dropTitle}>Already filmed it?</Text>
            <Text style={S.dropSub}>We'll watch the cut, read the on-screen text, and flag anything TikTok Shop tends to reject — with what to say instead, in your voice.</Text>
            <AnimatedPressable style={S.cta} haptic="medium" onPress={pick}>
              <Upload size={16} color="#FFF" strokeWidth={2.4} />
              <Text style={S.ctaText}>Choose a video</Text><Text style={S.ctaCost}>{creditLabel(TOOL_COST.shopSafeVideo)}</Text>
            </AnimatedPressable>
            <Text style={S.hint}>Uploads are private and deleted after the check.</Text>
          </FadeInView>
        )}

        {(phase === 'uploading' || phase === 'checking') && (
          <FadeInView style={S.card}>
            <ActivityIndicator color={D.coral} size="large" />
            <Text style={S.dropTitle}>{phase === 'uploading' ? `Uploading… ${Math.round(pct * 100)}%` : scriptMode ? 'Reading your script…' : 'Watching your video…'}</Text>
            <Text style={S.dropSub}>{phase === 'uploading' ? (name ?? '') : scriptMode ? 'Checking every line against TikTok Shop’s rules. A few seconds.' : 'Transcribing, reading on-screen text, and checking every line. About a minute.'}</Text>
            {phase === 'uploading' && <View style={S.track}><View style={[S.fill, { width: `${Math.max(3, pct * 100)}%` }]} /></View>}
          </FadeInView>
        )}

        {phase === 'done' && result && (
          <FadeInView style={S.card}>
            <ShopSafeReport r={result} />
            {result.transcript ? (
              <View style={S.transcript}>
                <Text style={S.transcriptLabel}>Transcript</Text>
                <Text style={S.transcriptText}>{result.transcript}</Text>
              </View>
            ) : null}
            <AnimatedPressable style={[S.cta, { marginTop: 18 }]} haptic="light" onPress={() => { setPhase('idle'); setResult(null); }}>
              {scriptMode ? <FileText size={16} color="#FFF" strokeWidth={2.4} /> : <Upload size={16} color="#FFF" strokeWidth={2.4} />}
              <Text style={S.ctaText}>{scriptMode ? 'Check another script' : 'Check another video'}</Text>
            </AnimatedPressable>
          </FadeInView>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
      <NoCreditsModal visible={showNoCredits} onClose={() => setShowNoCredits(false)} />
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.limeDeep, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: D.textPrimary, letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: D.textMuted, marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: D.card, borderWidth: 1, borderColor: D.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  card: { backgroundColor: D.card, borderRadius: 22, borderWidth: 1, borderColor: D.border, padding: 20, alignItems: 'stretch' },
  dropIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: D.coralSubtle, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  dropTitle: { ...T.bold, fontSize: 20, color: D.textPrimary, letterSpacing: -0.4, textAlign: 'center', marginTop: 8 },
  dropSub: { ...T.regular, fontSize: 14, color: D.textMuted, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 15, marginTop: 18, ...Shadow.coral },
  ctaText: { ...T.bold, fontSize: 15.5, color: '#FFF' },
  ctaCost: { ...T.bold, fontSize: 11, color: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: R.full, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', marginLeft: 2 },
  hint: { ...T.regular, fontSize: 12, color: D.textDisabled, textAlign: 'center', marginTop: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: D.surface, borderRadius: 16, borderWidth: 1, borderColor: D.border, padding: 12 },
  choiceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: D.inkHairline, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { ...T.bold, fontSize: 15, color: D.textPrimary, letterSpacing: -0.2 },
  choiceSub: { ...T.regular, fontSize: 12.5, color: D.textMuted, marginTop: 1 },
  inputBox: { backgroundColor: D.surface, borderRadius: 16, borderWidth: 1.5, borderColor: D.border, padding: 14, minHeight: 160, marginTop: 16 },
  input: { ...T.medium, fontSize: 15, color: D.textPrimary, lineHeight: 22, minHeight: 130 },
  track: { height: 6, borderRadius: 3, backgroundColor: D.inkHairline, overflow: 'hidden', marginTop: 16 },
  fill: { height: '100%', backgroundColor: D.coral, borderRadius: 3 },
  transcript: { marginTop: 14, backgroundColor: D.surface, borderRadius: 14, padding: 12 },
  transcriptLabel: { ...T.bold, fontSize: 10.5, color: D.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  transcriptText: { ...T.regular, fontSize: 12.5, color: D.textSecondary, lineHeight: 18 },
});

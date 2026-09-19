import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, StatusBar, LayoutChangeEvent, TextInput, Alert, Keyboard, Modal, Pressable, useWindowDimensions, ActivityIndicator, PanResponder, KeyboardAvoidingView, Platform } from 'react-native';
import Svg, { Path, Ellipse, Line, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { storage } from '@/lib/storage';
import { isNativeTikTokAvailable, isTikTokAppInstalled, shareVideos } from '@/modules/tiktok-login';
import { uploadTake } from '@/lib/takes';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { D, T, R } from '@/constants/ds';
import { X, RotateCcw, Minus, Plus, FlipHorizontal, Type, Film, ChevronRight, Camera as CameraIcon, CameraOff, SwitchCamera, ClipboardPaste, Settings2, Eye, Check, Zap, ZapOff, Gauge, UserRound, Clapperboard, ChevronUp, ChevronDown } from 'lucide-react-native';
import type { SavedScriptItem, SavedScriptsResponse } from '@/types/api';
import AnimatedPressable from '@/components/AnimatedPressable';
import { haptic } from '@/lib/haptics';

// Teleprompter — scrolls the script at the creator's own talking speed
// (avg_wpm from their profile), so the pace on screen is the pace they
// actually talk. Tap to pause, ± to nudge speed, mirror for camera rigs.

const WORD = /\S+/g;
const countWords = (t: string) => (t.match(WORD) ?? []).length;

// expo-camera / expo-media-library are native; load lazily so builds without
// them still get the plain black prompter.
function loadCamera(): { CameraView: any; Camera: any } | null {
  try { const m = require('expo-camera'); return { CameraView: m.CameraView, Camera: m.Camera ?? m }; } catch { return null; }
}
function loadMediaLibrary(): any | null {
  try { return require('expo-media-library'); } catch { return null; }
}

// ── Framing guides ───────────────────────────────────────────────────────────
// Drawn over the camera so the creator lands in the same spot every take.
type Guide = 'none' | 'head' | 'face' | 'thirds';
type ReadPos = 'camera' | 'third' | 'center';
type Align = 'center' | 'left';
interface Prefs { guide: Guide; readPos: ReadPos; align: Align; width: 'wide' | 'narrow'; fontSize: number; mirror: boolean }
const DEFAULT_PREFS: Prefs = { guide: 'head', readPos: 'camera', align: 'center', width: 'narrow', fontSize: 34, mirror: false };
const PREFS_KEY = 'teleprompter.prefs.v1';
const READ_FRAC: Record<ReadPos, number> = { camera: 0.21, third: 0.36, center: 0.5 };

function Guides({ guide, w, h, readY }: { guide: Guide; w: number; h: number; readY: number }) {
  if (!w || !h) return null;
  const stroke = 'rgba(255,255,255,0.55)';
  const dash = '6 6';
  // Head & shoulders: head ellipse in the upper-middle, shoulders curve below.
  const cx = w / 2, headR = Math.min(w, h) * 0.17, headCy = h * 0.36;
  const shoulderY = headCy + headR * 1.55;
  const shoulders = `M ${cx - headR * 2.6} ${h * 0.98} C ${cx - headR * 2.6} ${shoulderY + headR * 0.6}, ${cx - headR * 1.2} ${shoulderY}, ${cx} ${shoulderY} C ${cx + headR * 1.2} ${shoulderY}, ${cx + headR * 2.6} ${shoulderY + headR * 0.6}, ${cx + headR * 2.6} ${h * 0.98}`;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={w} height={h}>
      {guide === 'head' && (
        <>
          <Ellipse cx={cx} cy={headCy} rx={headR * 0.82} ry={headR} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} fill="none" />
          <Path d={shoulders} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} fill="none" />
          <Line x1={cx - headR * 0.45} y1={headCy - headR * 0.12} x2={cx + headR * 0.45} y2={headCy - headR * 0.12} stroke={stroke} strokeWidth={1} strokeDasharray="3 4" />
        </>
      )}
      {guide === 'face' && (
        <>
          <Ellipse cx={cx} cy={h * 0.42} rx={w * 0.26} ry={h * 0.2} stroke={stroke} strokeWidth={1.5} strokeDasharray={dash} fill="none" />
          <Line x1={cx - w * 0.14} y1={h * 0.39} x2={cx + w * 0.14} y2={h * 0.39} stroke={stroke} strokeWidth={1} strokeDasharray="3 4" />
        </>
      )}
      {guide === 'thirds' && (
        <>
          <Line x1={w / 3} y1={0} x2={w / 3} y2={h} stroke={stroke} strokeWidth={1} />
          <Line x1={(2 * w) / 3} y1={0} x2={(2 * w) / 3} y2={h} stroke={stroke} strokeWidth={1} />
          <Line x1={0} y1={h / 3} x2={w} y2={h / 3} stroke={stroke} strokeWidth={1} />
          <Line x1={0} y1={(2 * h) / 3} x2={w} y2={(2 * h) / 3} stroke={stroke} strokeWidth={1} />
          <Circle cx={w / 3} cy={h / 3} r={4} fill={stroke} />
          <Circle cx={(2 * w) / 3} cy={h / 3} r={4} fill={stroke} />
        </>
      )}
      {/* Eye marker: where to look so the read line feels like eye contact */}
      <Circle cx={w - 22} cy={readY} r={5} fill={D.coral} />
    </Svg>
  );
}

// expo-video is native too — only used for the review step.
let VideoMod: any = null;
try { VideoMod = require('expo-video'); } catch {}
function TakePreview({ uri }: { uri: string }) {
  const player = VideoMod.useVideoPlayer(uri, (p: any) => { p.loop = true; p.play(); });
  return <VideoMod.VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls />;
}

function RailBtn({ label, active, dim, onPress, children }: { label: string; active?: boolean; dim?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity style={[S.railBtn, dim && { opacity: 0.45 }]} onPress={onPress} activeOpacity={0.8} hitSlop={6}>
      <Text style={S.railLabel} numberOfLines={1}>{label}</Text>
      <View style={[S.railIcon, active && S.railIconOn]}>{children}</View>
    </TouchableOpacity>
  );
}

function useKeepAwake(on: boolean) {
  useEffect(() => {
    if (!on) return;
    try {
      const ka = require('expo-keep-awake');
      Promise.resolve(ka.activateKeepAwakeAsync?.('teleprompter')).catch(() => {});
      return () => { try { Promise.resolve(ka.deactivateKeepAwake?.('teleprompter')).catch(() => {}); } catch {} };
    } catch { return; }
  }, [on]);
}

export default function TeleprompterScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { scriptId, text: textParam } = useLocalSearchParams<{ scriptId?: string; text?: string }>();
  const { meData } = useAuth();
  // avg_wpm can arrive as null, a string, or NaN from the profile; anything
  // non-finite must fall back, otherwise every duration below becomes NaN and
  // the animation "finishes" instantly (text jumps off screen).
  const rawWpm = Number(meData?.speech_template?.avg_wpm);
  const baseWpm = Number.isFinite(rawWpm) && rawWpm > 0 ? Math.max(90, Math.min(260, rawWpm)) : 150;

  const { data: scripts } = useQuery<SavedScriptItem[]>({
    queryKey: ['saved-scripts'],
    queryFn: async () => {
      const res = await api.get('/creators/scripts');
      const d = extractData<SavedScriptsResponse>(res);
      return d?.scripts ?? (Array.isArray(d) ? d : []);
    },
    staleTime: 60_000,
  });

  const [pickedId, setPickedId] = useState<string | null>(scriptId ?? null);
  const [pasted, setPasted] = useState('');
  const [draft, setDraft] = useState('');
  const cam = useMemo(() => loadCamera(), []);
  const [camOn, setCamOn] = useState(!!cam);
  const [camReady, setCamReady] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [recording, setRecording] = useState(false);
  const [torch, setTorch] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [reviewUri, setReviewUri] = useState<string | null>(null);
  const [showSpeed, setShowSpeed] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [takesThisSession, setTakesThisSession] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<string>('');
  useEffect(() => {
    if (!recording) { setRecSec(0); return; }
    const t = setInterval(() => setRecSec((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const camRef = useRef<any>(null);

  useEffect(() => {
    if (!cam || !camOn) return;
    (async () => {
      try {
        const c = await cam.Camera.requestCameraPermissionsAsync?.();
        const m = await cam.Camera.requestMicrophonePermissionsAsync?.();
        setCamReady(!!c?.granted && !!m?.granted);
        if (!c?.granted) setCamOn(false);
      } catch { setCamOn(false); }
    })();
  }, [cam, camOn]);
  const item = useMemo(() => scripts?.find((s) => s.id === pickedId) ?? null, [scripts, pickedId]);
  const text = useMemo(() => {
    if (pasted) return pasted;
    if (textParam) return textParam;
    if (!item) return '';
    return item.full_script?.trim() || [item.hook, ...(item.body ?? []), item.cta].filter(Boolean).join('\n\n');
  }, [item, textParam, pasted]);

  // ── Playback ─────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [speedMul, setSpeedMul] = useState(1);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => { storage.getItem(PREFS_KEY).then((v) => { if (v) { try { setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(v) }); } catch {} } }); }, []);
  const setPrefs = (patch: Partial<Prefs>) => setPrefsState((p) => { const n = { ...p, ...patch }; storage.setItem(PREFS_KEY, JSON.stringify(n)).catch(() => {}); return n; });
  const fontSize = prefs.fontSize, mirror = prefs.mirror;
  const setFontSize = (f: (n: number) => number) => setPrefs({ fontSize: f(prefs.fontSize) });
  const setMirror = (f: (m: boolean) => boolean) => setPrefs({ mirror: f(prefs.mirror) });
  const readFrac = READ_FRAC[prefs.readPos];
  const { width: winW } = useWindowDimensions();
  const [contentH, setContentH] = useState(0);
  const [viewH, setViewH] = useState(0);
  // The script is a plain translated view, not a ScrollView: we drive the
  // offset ourselves so playback doesn't depend on the platform honouring
  // programmatic scrollTo (Fabric/iOS doesn't while touches are disabled).
  const scrollY = useRef(new Animated.Value(0)).current;
  const curY = useRef(0);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  useKeepAwake(playing);

  const words = countWords(text);
  const wpm = Math.round(baseWpm * speedMul);
  const durationSec = words > 0 ? (words / wpm) * 60 : 0;
  const travel = Math.max(0, contentH - viewH * readFrac); // stop when the last line reaches the read line

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      curY.current = value;
      progress.setValue(travel > 0 ? value / travel : 0);
    });
    return () => scrollY.removeListener(id);
  }, [travel, readFrac]);

  const startFrom = (fromY: number) => {
    anim.current?.stop();
    const remaining = Math.max(0, travel - fromY);
    const ms = durationSec > 0 ? (remaining / Math.max(1, travel)) * durationSec * 1000 : 0;
    if (!Number.isFinite(ms) || ms <= 0) { setPlaying(false); return; }
    anim.current = Animated.timing(scrollY, { toValue: travel, duration: ms, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => { if (finished) setPlaying(false); });
    setPlaying(true);
  };

  const play = () => {
    if (!text || playing || countdown != null) return;
    setCountdown(3);
  };
  // When the red button is pressed the countdown runs first; the camera only
  // starts capturing on "Go", in the same tick the script starts scrolling.
  const armedRef = useRef(false);
  useEffect(() => {
    if (countdown == null) return;
    if (countdown === 0) {
      setCountdown(null);
      startFrom(curY.current);
      if (armedRef.current) { armedRef.current = false; void beginCapture(); }
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  const pause = () => { anim.current?.stop(); setPlaying(false); };

  const playingRef = useRef(false); playingRef.current = playing;
  const travelRef = useRef(0); travelRef.current = travel;
  const dragStart = useRef(0);
  // Finger on the screen stops the scroll instantly; dragging moves the script
  // up or down; a tap while paused starts the countdown again. Recording is
  // untouched by any of this — only the text moves.
  const wasPlayingAtTouch = useRef(false);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      wasPlayingAtTouch.current = playingRef.current;
      if (playingRef.current) { anim.current?.stop(); setPlaying(false); haptic.select(); }
      dragStart.current = curY.current;
    },
    onPanResponderMove: (_, g) => {
      const next = Math.max(0, Math.min(travelRef.current, dragStart.current - g.dy));
      curY.current = next; scrollY.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      const tap = Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6;
      if (tap && !wasPlayingAtTouch.current) play();
    },
  }), []);
  const reset = () => { anim.current?.stop(); setPlaying(false); curY.current = 0; scrollY.setValue(0); };
  const nudge = (d: number) => {
    const next = Math.max(0.5, Math.min(1.8, Math.round((speedMul + d) * 10) / 10));
    setSpeedMul(next);
  };
  // Re-time the animation when speed changes mid-play.
  useEffect(() => { if (playing) startFrom(curY.current); }, [speedMul]);

  // Vertical speed slider: top = faster, bottom = slower. Always on screen so
  // pace can be corrected mid-take without opening anything.
  const SLIDER_H = 190, MUL_MIN = 0.5, MUL_MAX = 1.5;
  const speedMulRef = useRef(1); speedMulRef.current = speedMul;
  const sliderStart = useRef(1);
  const sliderPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { sliderStart.current = speedMulRef.current; },
    onPanResponderMove: (_, g) => {
      const next = Math.max(MUL_MIN, Math.min(MUL_MAX, sliderStart.current - (g.dy / SLIDER_H) * (MUL_MAX - MUL_MIN)));
      const rounded = Math.round(next * 20) / 20;
      if (rounded !== speedMulRef.current) { setSpeedMul(rounded); haptic.select(); }
    },
    onPanResponderTerminationRequest: () => false,
  }), []);
  const sliderFrac = (speedMul - MUL_MIN) / (MUL_MAX - MUL_MIN);

  const beginCapture = async () => {
    if (!camRef.current || recording) return;
    try {
      haptic.heavy();
      setRecording(true);
      const rec = await camRef.current.recordAsync({ maxDuration: 300 });
      setRecording(false);
      pause();
      if (rec?.uri) setReviewUri(rec.uri);
    } catch (e: any) {
      haptic.error();
      setRecording(false);
      Alert.alert('Couldn’t record', e?.message ?? 'Please try again.');
    }
  };
  const startRecording = async () => {
    if (!camRef.current || recording || countdown != null) return;
    if (playing) { void beginCapture(); return; } // already scrolling: record now
    haptic.tap();
    armedRef.current = true;
    play(); // 3-2-1-Go, then beginCapture fires on Go
  };
  // Review → Save: only now does the take go to Photos (then optional TikTok).
  const saveTake = async () => {
    if (!reviewUri) return;
    const uri = reviewUri;
    setSaving(true);
    try {
      const ml = loadMediaLibrary();
      if (!ml) { Alert.alert('Take recorded', 'Update the app from TestFlight to save takes to Photos.'); return; }
      let perm = await ml.requestPermissionsAsync?.(false);
      if (!perm?.granted && perm?.accessPrivileges !== 'limited') perm = await ml.requestPermissionsAsync?.(true);
      if (!perm?.granted) { Alert.alert('Photo access needed', 'Allow photo library access in Settings so takes can be saved.'); return; }
      setSaveStep('Saving to Photos…');
      let assetId: string | null = null;
      try { const asset = await ml.createAssetAsync(uri); assetId = asset?.id ?? null; }
      catch { try { await ml.saveToLibraryAsync(uri); } catch (e2: any) { Alert.alert('Couldn’t save', e2?.message ?? 'Please try again.'); return; } }
      // Keep it in Formula too, linked to the script/product it came from.
      let inFormula = false;
      try {
        setSaveStep('Saving to Formula…');
        await uploadTake({ uri, scriptId: item?.id ?? null, productName: item?.product_name ?? null, photosAssetId: assetId, durationSec: recSec, title: item?.option_label ?? item?.product_name ?? null, onProgress: (f) => setSaveStep(`Saving to Formula… ${Math.round(f * 100)}%`) });
        inFormula = true;
        setTakesThisSession((n) => n + 1);
        qc.invalidateQueries({ queryKey: ['takes'] });
      } catch (e: any) {
        console.warn('[takes] upload failed', e?.message);
        Alert.alert('Saved to Photos only', e?.message ?? 'Couldn’t save the take to Formula.');
      }
      setReviewUri(null);
      const canShare = !!assetId && isNativeTikTokAvailable() && isTikTokAppInstalled();
      Alert.alert(
        inFormula ? 'Saved' : 'Saved to Photos',
        (inFormula ? `In your Photos and in Saved → Videos${item ? ', attached to this script' : ''}. ` : 'Your take is in your photo library. ') + (canShare ? 'Edit it in TikTok and post now?' : ''),
        canShare
          ? [
              { text: 'Later', style: 'cancel' },
              { text: 'Edit in TikTok & post', onPress: async () => {
                  try {
                    const r = await shareVideos([assetId!], 'https://iq.influenceish.com/tiktok/native');
                    if (!r.isSuccess) Alert.alert('Not posted', r.errorMsg);
                  } catch (e: any) { Alert.alert('Not posted', e?.message ?? 'Please try again.'); }
                } },
            ]
          : undefined,
      );
    } finally { setSaving(false); setSaveStep(''); }
  };
  const retake = () => { setReviewUri(null); reset(); };

  const stopRecording = () => { haptic.press(); try { camRef.current?.stopRecording?.(); } catch {} pause(); };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  // ── Picker (no script chosen) ────────────────────────────────────────────
  if (!text) {
    return (
      <View style={[S.root, { paddingTop: insets.top + 8 }]}>
        <StatusBar barStyle="light-content" />
        <View style={S.hdr}>
          <View style={S.hdrIcon}><Film size={18} color="#FFF" strokeWidth={2.4} /></View>
          <View style={{ flex: 1 }}><Text style={S.title}>Teleprompter</Text><Text style={S.sub}>Scrolls at your speed — {baseWpm} wpm.</Text></View>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={S.close}><X size={18} color="#FFF" strokeWidth={2.2} /></TouchableOpacity>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 8}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={S.pickLabel}>PASTE A SCRIPT</Text>
            {draft.trim().length > 0 && (
              <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={10}><Text style={[S.pickLabel, { color: '#FFF' }]}>DONE</Text></TouchableOpacity>
            )}
          </View>
          <View style={S.pasteBox}>
            <TextInput
              style={S.pasteInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Paste or type anything you want to read…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              textAlignVertical="top"
            />
            <AnimatedPressable style={[S.pasteBtn, !draft.trim() && { opacity: 0.4 }]} haptic="light" disabled={!draft.trim()} onPress={() => { Keyboard.dismiss(); setPasted(draft.trim()); }}>
              <ClipboardPaste size={14} color="#FFF" strokeWidth={2.4} />
              <Text style={S.pasteBtnText}>Read this</Text>
            </AnimatedPressable>
          </View>
          <Text style={[S.pickLabel, { marginTop: 22 }]}>OR PICK A SAVED SCRIPT</Text>
          {(scripts ?? []).length === 0 && <Text style={S.pickEmpty}>No saved scripts yet. Write one in ScriptIQ and save it.</Text>}
          {(scripts ?? []).map((s) => (
            <AnimatedPressable key={s.id} style={S.pickRow} haptic="light" onPress={() => setPickedId(s.id)}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={S.pickTitle} numberOfLines={1}>{s.option_label ?? s.product_name ?? 'Untitled script'}</Text>
                {s.hook ? <Text style={S.pickHook} numberOfLines={1}>“{s.hook}”</Text> : null}
              </View>
              <ChevronRight size={16} color="rgba(255,255,255,0.4)" strokeWidth={2.2} />
            </AnimatedPressable>
          ))}
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Prompter ─────────────────────────────────────────────────────────────
  const camLive = !!(cam && camOn && camReady);
  const closePrompter = () => { pause(); if (recording) stopRecording(); if (scriptId || textParam) router.back(); else { setPasted(''); setPickedId(null); reset(); } };
  const toggleTorch = () => {
    if (facing !== 'back') { Alert.alert('Flash', 'Flash works with the back camera. Flip the camera to use it.'); return; }
    setTorch((t) => !t);
  };

  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />

      {/* Camera fills the whole screen; everything else floats over it */}
      {camLive && <cam.CameraView key={`${facing}-${mirror ? 'm' : 'n'}`} ref={camRef} style={[StyleSheet.absoluteFill, mirror && { transform: [{ scaleX: -1 }] }]} facing={facing} mode="video" mute={false} enableTorch={torch && facing === 'back'} mirror={mirror} videoQuality="720p" />}
      {camLive && <View pointerEvents="none" style={S.scrim} />}

      {/* Text layer */}
      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setViewH(e.nativeEvent.layout.height)}>
        <View style={{ flex: 1, overflow: 'hidden' }} {...pan.panHandlers}>
          <Animated.View
            style={{ position: 'absolute', left: 0, right: 0, top: scrollY.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }), paddingTop: viewH * readFrac, paddingBottom: viewH * (1 - readFrac), paddingHorizontal: prefs.width === 'narrow' ? Math.max(24, winW * 0.12) : 24 }}
            onLayout={(e: LayoutChangeEvent) => setContentH(e.nativeEvent.layout.height)}
          >
            <Text style={[S.script, { fontSize, lineHeight: fontSize * 1.42, textAlign: prefs.align }]}>{text}</Text>
          </Animated.View>
        </View>
        {camLive && <Guides guide={prefs.guide} w={winW} h={viewH} readY={viewH * readFrac} />}
        <LinearGradient pointerEvents="none" colors={[camLive ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']} style={[S.fade, { top: 0, height: Math.max(0, viewH * readFrac - fontSize * 0.9) }]} />
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', camLive ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.9)']} style={[S.fade, { bottom: 0, height: Math.max(0, viewH * (1 - readFrac) - fontSize * 2.2) }]} />
        <View pointerEvents="none" style={[S.readLine, { top: viewH * readFrac - 1 }]} />
        {prefs.readPos === 'camera' && !playing && countdown == null && !recording && (
          <View pointerEvents="none" style={[S.eyeHint, { top: viewH * readFrac + 10 }]}><Eye size={12} color="rgba(255,255,255,0.7)" strokeWidth={2.2} /><Text style={S.eyeHintText}>Eyes here — closest to the lens</Text></View>
        )}
        {countdown != null && (
          <View pointerEvents="none" style={S.countWrap}><Text style={S.count}>{countdown === 0 ? 'Go' : countdown}</Text></View>
        )}
      </View>

      {/* Top: close · script pill / rec timer */}
      <View pointerEvents="box-none" style={[S.top, { paddingTop: insets.top + 6 }]}>
        <View style={S.topRow}>
          <TouchableOpacity onPress={closePrompter} hitSlop={12} style={S.glassBtn}><X size={17} color="#FFF" strokeWidth={2.2} /></TouchableOpacity>
          <View style={S.titleWrap}>
            {recording ? (
              <View style={S.recPill}><View style={S.recPillDot} /><Text style={S.recPillText}>{fmt(recSec)}</Text></View>
            ) : (
              <View style={S.titlePill}>
                <Text style={S.barTitle} numberOfLines={1}>{item?.option_label ?? item?.product_name ?? 'Script'}</Text>
                <Text style={S.barMeta}>{fmt(durationSec)} · {wpm} wpm</Text>
              </View>
            )}
          </View>
          <View style={{ width: 38 }} />
        </View>
        <View style={S.progressTrack}><Animated.View style={[S.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
      </View>

      {/* Right rail — labeled tools, CapCut-style but ours */}
      {!recording && (
        <View pointerEvents="box-none" style={[S.rail, { top: insets.top + 64 }]}>
          {!railOpen && (
            <TouchableOpacity style={S.railIcon} onPress={() => setRailOpen(true)} activeOpacity={0.8} hitSlop={8}><ChevronDown size={18} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
          )}
          {railOpen && cam && (
            <RailBtn label={camOn ? 'Camera' : 'Camera off'} onPress={() => setCamOn((v) => !v)} active={camOn}>
              {camOn ? <CameraIcon size={18} color="#FFF" strokeWidth={2.2} /> : <CameraOff size={18} color="#FFF" strokeWidth={2.2} />}
            </RailBtn>
          )}
          {railOpen && camLive && (
            <RailBtn label="Flip" onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}><SwitchCamera size={18} color="#FFF" strokeWidth={2.2} /></RailBtn>
          )}
          {railOpen && camLive && (
            <RailBtn
              label={prefs.guide === 'none' ? 'Outline' : prefs.guide === 'head' ? 'Head' : prefs.guide === 'face' ? 'Face' : 'Thirds'}
              active={prefs.guide !== 'none'}
              onPress={() => setPrefs({ guide: prefs.guide === 'none' ? 'head' : prefs.guide === 'head' ? 'face' : prefs.guide === 'face' ? 'thirds' : 'none' })}
            >
              <UserRound size={18} color="#FFF" strokeWidth={2.2} />
            </RailBtn>
          )}
          {railOpen && <RailBtn label={`${wpm} wpm`} active={showSpeed} onPress={() => setShowSpeed((v) => !v)}><Gauge size={18} color="#FFF" strokeWidth={2.2} /></RailBtn>}
          {railOpen && <RailBtn label="Text size" onPress={() => setFontSize((f) => (f >= 52 ? 26 : f + 6))}><Type size={18} color="#FFF" strokeWidth={2.2} /></RailBtn>}
          {railOpen && <RailBtn label={prefs.readPos === 'camera' ? 'Eyes: lens' : prefs.readPos === 'third' ? 'Eyes: third' : 'Eyes: center'} onPress={() => setPrefs({ readPos: prefs.readPos === 'camera' ? 'third' : prefs.readPos === 'third' ? 'center' : 'camera' })}><Eye size={18} color="#FFF" strokeWidth={2.2} /></RailBtn>}
          {railOpen && camLive && (
            <RailBtn label="Flash" active={torch && facing === 'back'} dim={facing !== 'back'} onPress={toggleTorch}>
              {torch && facing === 'back' ? <Zap size={18} color="#FFF" strokeWidth={2.2} fill="#FFF" /> : <ZapOff size={18} color="#FFF" strokeWidth={2.2} />}
            </RailBtn>
          )}
          {railOpen && <RailBtn label="Mirror" active={mirror} onPress={() => setMirror((m) => !m)}><FlipHorizontal size={18} color="#FFF" strokeWidth={2.2} /></RailBtn>}
          {railOpen && <RailBtn label="More" onPress={() => { pause(); setShowSettings(true); }}><Settings2 size={18} color="#FFF" strokeWidth={2.2} /></RailBtn>}
          {railOpen && (
            <TouchableOpacity style={[S.railIcon, { marginTop: 2 }]} onPress={() => setRailOpen(false)} activeOpacity={0.8} hitSlop={8}><ChevronUp size={18} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
          )}
        </View>
      )}

      {/* Live speed slider — left edge */}
      <View pointerEvents="box-none" style={S.sliderWrap}>
        <View style={S.slider} {...sliderPan.panHandlers}>
          <Text style={S.sliderCap}>Faster</Text>
          <View style={[S.sliderTrack, { height: SLIDER_H }]}>
            <View style={[S.sliderFill, { height: SLIDER_H * sliderFrac }]} />
            <View style={[S.sliderThumb, { bottom: SLIDER_H * sliderFrac - 11 }]} />
          </View>
          <Text style={S.sliderCap}>Slower</Text>
          <TouchableOpacity onPress={() => { setSpeedMul(1); haptic.tap(); }} hitSlop={8} style={S.sliderVal}>
            <Text style={S.sliderNum}>{wpm}</Text><Text style={S.sliderUnit}>wpm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Speed popover */}
      {showSpeed && !recording && (
        <View pointerEvents="box-none" style={[S.popWrap, { paddingBottom: Math.max(insets.bottom, 12) + 118 }]}>
          <View style={S.pop}>
            <TouchableOpacity style={S.smallBtn} onPress={() => nudge(-0.1)} hitSlop={6}><Minus size={15} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
            <View style={S.speedVal}><Text style={S.speedNum}>{wpm}</Text><Text style={S.speedSub}>words / min</Text></View>
            <TouchableOpacity style={S.smallBtn} onPress={() => nudge(0.1)} hitSlop={6}><Plus size={15} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
            <TouchableOpacity style={[S.smallBtn, { marginLeft: 6 }]} onPress={() => { setSpeedMul(1); }} hitSlop={6}><Text style={S.popReset}>{baseWpm}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom: restart · RECORD · takes */}
      <View pointerEvents="box-none" style={[S.bottom, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
        <View style={S.bottomRow}>
          <TouchableOpacity style={S.sideBtn} onPress={reset} activeOpacity={0.8} disabled={recording}>
            <View style={[S.sideIcon, recording && { opacity: 0.35 }]}><RotateCcw size={18} color="#FFF" strokeWidth={2.2} /></View>
            <Text style={S.sideLabel}>Restart</Text>
          </TouchableOpacity>

          {camLive ? (
            <TouchableOpacity style={S.recWrap} onPress={() => (recording ? stopRecording() : startRecording())} activeOpacity={0.85}>
              <View style={[S.recRing, recording && S.recRingOn]}><View style={[S.recCore, recording && S.recCoreOn]} /></View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={S.recWrap} onPress={() => (playing ? pause() : play())} activeOpacity={0.85}>
              <View style={[S.recRing, playing && S.recRingOn]}><View style={[S.recCore, { backgroundColor: '#FFF' }, playing && S.recCoreOn]} /></View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={S.sideBtn} onPress={() => { closePrompter(); router.push({ pathname: '/(tabs)/scripts', params: { seg: 'videos' } }); }} activeOpacity={0.8} disabled={recording}>
            <View style={[S.sideIcon, recording && { opacity: 0.35 }]}><Clapperboard size={18} color="#FFF" strokeWidth={2.2} />{takesThisSession > 0 && <View style={S.badge}><Text style={S.badgeText}>{takesThisSession}</Text></View>}</View>
            <Text style={S.sideLabel}>Takes</Text>
          </TouchableOpacity>
        </View>
        <Text style={S.bottomHint}>{camLive ? (recording ? 'Tap to stop · touch the text to hold or move it' : 'Tap to count down, scroll and record') : (playing ? 'Touch the text to hold or move it' : 'Tap to count down and scroll')}</Text>
      </View>

      {/* Review the take before committing it to Photos */}
      <Modal visible={!!reviewUri} animationType="slide" onRequestClose={retake}>
        <View style={S.review}>
          <StatusBar barStyle="light-content" />
          {reviewUri && (VideoMod ? <TakePreview uri={reviewUri} /> : (
            <View style={S.reviewNoPlayer}><Film size={28} color="rgba(255,255,255,0.5)" strokeWidth={1.8} /><Text style={S.reviewNoPlayerText}>Preview needs the latest build — you can still save or retake.</Text></View>
          ))}
          <View pointerEvents="box-none" style={[S.reviewTop, { paddingTop: insets.top + 8 }]}>
            <View style={S.titlePill}><Text style={S.barTitle}>Review take · {fmt(recSec)}</Text></View>
          </View>
          <View pointerEvents="box-none" style={[S.reviewBottom, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
            <View style={S.reviewPanel}>
              <TouchableOpacity style={S.reviewBtn} onPress={retake} activeOpacity={0.85} disabled={saving}>
                <RotateCcw size={16} color="#FFF" strokeWidth={2.4} /><Text style={S.reviewBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[S.reviewBtn, S.reviewBtnPrimary]} onPress={saveTake} activeOpacity={0.85} disabled={saving}>
                {saving ? <><ActivityIndicator size="small" color="#FFF" /><Text style={S.reviewBtnText}>{saveStep || 'Saving…'}</Text></> : <><Check size={16} color="#FFF" strokeWidth={2.6} /><Text style={S.reviewBtnText}>Save take</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings sheet */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <Pressable style={S.sheetBackdrop} onPress={() => setShowSettings(false)}>
          <Pressable style={S.sheet} onPress={() => {}}>
            <View style={S.sheetHdr}><Text style={S.sheetTitle}>Framing & text</Text><TouchableOpacity onPress={() => setShowSettings(false)} hitSlop={12}><X size={18} color="rgba(255,255,255,0.7)" strokeWidth={2.2} /></TouchableOpacity></View>
            {([
              { label: 'Guide', key: 'guide' as const, opts: [['none', 'None'], ['head', 'Head & shoulders'], ['face', 'Face'], ['thirds', 'Thirds']] },
              { label: 'Read line', key: 'readPos' as const, opts: [['camera', 'Near camera'], ['third', 'Third'], ['center', 'Center']] },
              { label: 'Text', key: 'align' as const, opts: [['center', 'Centered'], ['left', 'Left']] },
              { label: 'Width', key: 'width' as const, opts: [['narrow', 'Narrow'], ['wide', 'Wide']] },
            ]).map((row) => (
              <View key={row.key} style={S.optRow}>
                <Text style={S.optLabel}>{row.label}</Text>
                <View style={S.optChips}>
                  {row.opts.map(([v, l]) => {
                    const on = (prefs as any)[row.key] === v;
                    return (
                      <TouchableOpacity key={v} style={[S.optChip, on && S.optChipOn]} onPress={() => setPrefs({ [row.key]: v } as any)} activeOpacity={0.8}>
                        {on && <Check size={11} color="#FFF" strokeWidth={3} />}
                        <Text style={[S.optChipText, on && S.optChipTextOn]}>{l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
            <Text style={S.sheetNote}>Near camera keeps your eyes on the lens. Head & shoulders keeps you in the same frame every take. Mirror flips the camera so the recording matches what you see.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  hdrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center' },
  title: { ...T.bold, fontSize: 22, color: '#FFF', letterSpacing: -0.5 },
  sub: { ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  pickLabel: { ...T.bold, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 },
  pickEmpty: { ...T.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 20, marginLeft: 4 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 14, marginBottom: 8 },
  pickTitle: { ...T.bold, fontSize: 15, color: '#FFF' },
  pickHook: { ...T.regular, fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2, fontStyle: 'italic' },

  script: { ...T.bold, color: '#FFF', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.10)' },

  // Floating top layer
  top: { position: 'absolute', left: 0, right: 0, top: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  glassBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, alignItems: 'center', minWidth: 0 },
  titlePill: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 5, maxWidth: '100%' },
  barTitle: { ...T.bold, fontSize: 12.5, color: '#FFF' },
  barMeta: { ...T.medium, fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  recPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 7 },
  recPillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.coral },
  recPillText: { ...T.bold, fontSize: 13, color: '#FFF', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 2, marginHorizontal: 12, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: D.coral },

  // Review
  review: { flex: 1, backgroundColor: '#000' },
  reviewTop: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  reviewBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  reviewNoPlayer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  reviewNoPlayerText: { ...T.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 19 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: R.full, paddingHorizontal: 18, height: 46, backgroundColor: 'rgba(255,255,255,0.12)' },
  reviewBtnPrimary: { backgroundColor: D.coral },
  reviewPanel: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 32, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  reviewBtnText: { ...T.bold, fontSize: 14.5, color: '#FFF' },

  // Right rail
  rail: { position: 'absolute', right: 10, alignItems: 'flex-end', gap: 14 },
  sliderWrap: { position: 'absolute', left: 8, top: 0, bottom: 0, justifyContent: 'center' },
  slider: { alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.35)' },
  sliderCap: { ...T.bold, fontSize: 9.5, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 },
  sliderTrack: { width: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'flex-end', overflow: 'visible' },
  sliderFill: { width: 6, borderRadius: 3, backgroundColor: D.coral },
  sliderThumb: { position: 'absolute', left: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', borderWidth: 2, borderColor: D.coral },
  sliderVal: { alignItems: 'center', marginTop: 2 },
  sliderNum: { ...T.bold, fontSize: 13, color: '#FFF', fontVariant: ['tabular-nums'] },
  sliderUnit: { ...T.medium, fontSize: 8.5, color: 'rgba(255,255,255,0.55)', marginTop: -2 },
  railBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railLabel: { ...T.bold, fontSize: 12.5, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  railIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  railIconOn: { backgroundColor: D.coral, borderColor: D.coral },

  // Speed popover
  popWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  pop: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 28, padding: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  popReset: { ...T.bold, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  speedVal: { alignItems: 'center', minWidth: 74 },
  speedNum: { ...T.bold, fontSize: 18, color: '#FFF', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  speedSub: { ...T.medium, fontSize: 9.5, color: 'rgba(255,255,255,0.55)', marginTop: -1 },

  // Bottom bar
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 },
  sideBtn: { alignItems: 'center', gap: 5, width: 64 },
  sideIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  sideLabel: { ...T.bold, fontSize: 11.5, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: D.coral, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { ...T.bold, fontSize: 10, color: '#FFF' },
  recWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  recRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  recRingOn: { borderColor: 'rgba(255,255,255,0.6)' },
  recCore: { width: 62, height: 62, borderRadius: 31, backgroundColor: D.coral },
  recCoreOn: { width: 30, height: 30, borderRadius: 8, backgroundColor: D.coral },
  bottomHint: { ...T.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 8, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },

  // Floating bottom panel
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  smallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  readLine: { position: 'absolute', left: 12, right: 12, height: 2, backgroundColor: D.coral, opacity: 0.85, borderRadius: 1 },
  fade: { position: 'absolute', left: 0, right: 0 },
  eyeHint: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: R.full, paddingHorizontal: 10, paddingVertical: 5 },
  eyeHintText: { ...T.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.8)' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40 },
  sheetHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { ...T.bold, fontSize: 18, color: '#FFF', letterSpacing: -0.3 },
  optRow: { marginBottom: 14 },
  optLabel: { ...T.bold, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 },
  optChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 8 },
  optChipOn: { backgroundColor: D.coral, borderColor: D.coral },
  optChipText: { ...T.bold, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  optChipTextOn: { color: '#FFF' },
  sheetNote: { ...T.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 18, marginTop: 4 },
  countWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  count: { ...T.bold, fontSize: 96, color: '#FFF', letterSpacing: -3 },

  pasteBox: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 14 },
  pasteInput: { ...T.medium, fontSize: 15, color: '#FFF', lineHeight: 22, minHeight: 96 },
  pasteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: D.coral, borderRadius: R.full, paddingVertical: 11, marginTop: 10 },
  pasteBtnText: { ...T.bold, fontSize: 14, color: '#FFF' },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, StatusBar, LayoutChangeEvent } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api, extractData } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { D, T, R } from '@/constants/ds';
import { X, Play, Pause, RotateCcw, Minus, Plus, FlipHorizontal, Type, Film, ChevronRight } from 'lucide-react-native';
import type { SavedScriptItem, SavedScriptsResponse } from '@/types/api';
import AnimatedPressable from '@/components/AnimatedPressable';

// Teleprompter — scrolls the script at the creator's own talking speed
// (avg_wpm from their profile), so the pace on screen is the pace they
// actually talk. Tap to pause, ± to nudge speed, mirror for camera rigs.

const WORD = /\S+/g;
const countWords = (t: string) => (t.match(WORD) ?? []).length;

function useKeepAwake(on: boolean) {
  useEffect(() => {
    if (!on) return;
    try {
      const ka = require('expo-keep-awake');
      ka.activateKeepAwakeAsync?.('teleprompter');
      return () => { ka.deactivateKeepAwake?.('teleprompter'); };
    } catch { return; }
  }, [on]);
}

export default function TeleprompterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scriptId, text: textParam } = useLocalSearchParams<{ scriptId?: string; text?: string }>();
  const { meData } = useAuth();
  const baseWpm = Math.max(90, Math.min(260, meData?.speech_template?.avg_wpm ?? 150));

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
  const item = useMemo(() => scripts?.find((s) => s.id === pickedId) ?? null, [scripts, pickedId]);
  const text = useMemo(() => {
    if (textParam) return textParam;
    if (!item) return '';
    return item.full_script?.trim() || [item.hook, ...(item.body ?? []), item.cta].filter(Boolean).join('\n\n');
  }, [item, textParam]);

  // ── Playback ─────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [speedMul, setSpeedMul] = useState(1);
  const [fontSize, setFontSize] = useState(34);
  const [mirror, setMirror] = useState(false);
  const [contentH, setContentH] = useState(0);
  const [viewH, setViewH] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  useKeepAwake(playing);

  const words = countWords(text);
  const wpm = Math.round(baseWpm * speedMul);
  const durationSec = words > 0 ? (words / wpm) * 60 : 0;
  const travel = Math.max(0, contentH - viewH * 0.35); // stop when the last line reaches the read line

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      scrollRef.current?.scrollTo({ y: value, animated: false });
      progress.setValue(travel > 0 ? value / travel : 0);
    });
    return () => scrollY.removeListener(id);
  }, [travel]);

  const startFrom = (fromY: number) => {
    anim.current?.stop();
    const remaining = Math.max(0, travel - fromY);
    const ms = durationSec > 0 ? (remaining / Math.max(1, travel)) * durationSec * 1000 : 0;
    if (ms <= 0) { setPlaying(false); return; }
    anim.current = Animated.timing(scrollY, { toValue: travel, duration: ms, easing: Easing.linear, useNativeDriver: false });
    anim.current.start(({ finished }) => { if (finished) setPlaying(false); });
    setPlaying(true);
  };

  const play = () => {
    if (!text || playing || countdown != null) return;
    setCountdown(3);
  };
  useEffect(() => {
    if (countdown == null) return;
    if (countdown === 0) { setCountdown(null); startFrom((scrollY as any).__getValue?.() ?? 0); return; }
    const t = setTimeout(() => setCountdown(countdown - 1), 800);
    return () => clearTimeout(t);
  }, [countdown]);

  const pause = () => { anim.current?.stop(); setPlaying(false); };
  const reset = () => { anim.current?.stop(); setPlaying(false); scrollY.setValue(0); };
  const nudge = (d: number) => {
    const next = Math.max(0.5, Math.min(1.8, Math.round((speedMul + d) * 10) / 10));
    setSpeedMul(next);
  };
  // Re-time the animation when speed changes mid-play.
  useEffect(() => { if (playing) startFrom((scrollY as any).__getValue?.() ?? 0); }, [speedMul]);

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
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={S.pickLabel}>PICK A SCRIPT</Text>
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
      </View>
    );
  }

  // ── Prompter ─────────────────────────────────────────────────────────────
  return (
    <View style={S.root}>
      <StatusBar barStyle="light-content" />
      {/* Top bar */}
      <View style={[S.bar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => { pause(); router.back(); }} hitSlop={12} style={S.barBtn}><X size={18} color="#FFF" strokeWidth={2.2} /></TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={S.barTitle} numberOfLines={1}>{item?.option_label ?? item?.product_name ?? 'Script'}</Text>
          <Text style={S.barMeta}>{words} words · {fmt(durationSec)} at {wpm} wpm</Text>
        </View>
        <TouchableOpacity onPress={() => setMirror((m) => !m)} hitSlop={12} style={[S.barBtn, mirror && S.barBtnOn]}><FlipHorizontal size={16} color="#FFF" strokeWidth={2.2} /></TouchableOpacity>
      </View>
      <View style={S.progressTrack}><Animated.View style={[S.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>

      {/* Text */}
      <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setViewH(e.nativeEvent.layout.height)}>
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => (playing ? pause() : play())}>
          <ScrollView
            ref={scrollRef}
            scrollEnabled={!playing}
            showsVerticalScrollIndicator={false}
            onScrollEndDrag={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)}
            onMomentumScrollEnd={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)}
            contentContainerStyle={{ paddingTop: viewH * 0.35, paddingBottom: viewH * 0.65, paddingHorizontal: 24 }}
            style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}
            onContentSizeChange={(_, h) => setContentH(h)}
          >
            <Text style={[S.script, { fontSize, lineHeight: fontSize * 1.42 }]}>{text}</Text>
          </ScrollView>
        </TouchableOpacity>
        {/* Read line */}
        <View pointerEvents="none" style={[S.readLine, { top: viewH * 0.35 - 1 }]} />
        <View pointerEvents="none" style={[S.fadeTop]} />
        {countdown != null && (
          <View pointerEvents="none" style={S.countWrap}><Text style={S.count}>{countdown === 0 ? 'Go' : countdown}</Text></View>
        )}
      </View>

      {/* Controls */}
      <View style={[S.controls, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={S.ctlGroup}>
          <TouchableOpacity style={S.ctlBtn} onPress={() => nudge(-0.1)} hitSlop={8}><Minus size={16} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
          <View style={S.ctlVal}><Text style={S.ctlValText}>{wpm}</Text><Text style={S.ctlValSub}>wpm</Text></View>
          <TouchableOpacity style={S.ctlBtn} onPress={() => nudge(0.1)} hitSlop={8}><Plus size={16} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
        </View>
        <TouchableOpacity style={S.playBtn} onPress={() => (playing ? pause() : play())} activeOpacity={0.85}>
          {playing ? <Pause size={26} color={D.ink} strokeWidth={2.4} fill={D.ink} /> : <Play size={26} color={D.ink} strokeWidth={2.4} fill={D.ink} />}
        </TouchableOpacity>
        <View style={S.ctlGroup}>
          <TouchableOpacity style={S.ctlBtn} onPress={() => setFontSize((f) => Math.max(22, f - 4))} hitSlop={8}><Type size={14} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
          <TouchableOpacity style={S.ctlBtn} onPress={reset} hitSlop={8}><RotateCcw size={16} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
          <TouchableOpacity style={S.ctlBtn} onPress={() => setFontSize((f) => Math.min(52, f + 4))} hitSlop={8}><Type size={18} color="#FFF" strokeWidth={2.4} /></TouchableOpacity>
        </View>
      </View>
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

  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
  barBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  barBtnOn: { backgroundColor: D.coral },
  barTitle: { ...T.bold, fontSize: 14, color: '#FFF' },
  barMeta: { ...T.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  progressFill: { height: 2, backgroundColor: D.coral },
  script: { ...T.bold, color: '#FFF', letterSpacing: -0.3 },
  readLine: { position: 'absolute', left: 12, right: 12, height: 2, backgroundColor: D.coral, opacity: 0.85, borderRadius: 1 },
  fadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 0 },
  countWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  count: { ...T.bold, fontSize: 96, color: '#FFF', letterSpacing: -3 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#000' },
  ctlGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctlBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  ctlVal: { alignItems: 'center', minWidth: 46 },
  ctlValText: { ...T.bold, fontSize: 16, color: '#FFF', letterSpacing: -0.3 },
  ctlValSub: { ...T.medium, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
});

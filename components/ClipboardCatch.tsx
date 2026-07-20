import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, AppState, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Link2, X } from 'lucide-react-native';
import { D, T, R, Shadow, Ease, Gradient } from '@/constants/ds';
import AnimatedPressable from '@/components/AnimatedPressable';

// Matches vm.tiktok.com / vt.tiktok.com / www.tiktok.com short + full video links.
const TIKTOK_RE = /(vm|vt|www)\.tiktok\.com|tiktok\.com\/(@[\w.-]+\/video\/\d+|t\/)/i;

// Module-level so dismissal survives remounts (tab switches, fast refresh).
let lastDismissedAt = 0;
const DISMISS_COOLDOWN_MS = 5 * 60 * 1000;
const AUTO_DISMISS_MS = 12_000;

export default function ClipboardCatch() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);
  // True once we've offered/handled the current foreground's clipboard URL —
  // reset on each new foreground so a fresh copy re-triggers the banner.
  const handledOnce = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const clearAutoTimer = () => {
    if (autoTimer.current) { clearTimeout(autoTimer.current); autoTimer.current = null; }
  };

  const hide = useCallback((markDismissed: boolean) => {
    clearAutoTimer();
    if (markDismissed) lastDismissedAt = Date.now();
    if (reduceMotion.current) {
      if (mounted.current) { setVisible(false); setNotFound(false); }
      anim.setValue(0);
      return;
    }
    Animated.timing(anim, {
      toValue: 0, duration: 220, easing: Ease.inOut, useNativeDriver: true,
    }).start(() => {
      if (mounted.current) { setVisible(false); setNotFound(false); }
    });
  }, [anim]);

  const show = useCallback(() => {
    setNotFound(false);
    setVisible(true);
    clearAutoTimer();
    autoTimer.current = setTimeout(() => hide(true), AUTO_DISMISS_MS);
    if (reduceMotion.current) { anim.setValue(1); return; }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1, duration: 380, easing: Ease.out, useNativeDriver: true,
    }).start();
  }, [anim, hide]);

  const checkClipboard = useCallback(async () => {
    if (handledOnce.current) return;
    if (Date.now() - lastDismissedAt < DISMISS_COOLDOWN_MS) return;
    try {
      const hasUrl = await Clipboard.hasUrlAsync();
      if (hasUrl && mounted.current) {
        handledOnce.current = true;
        show();
      }
    } catch {
      // clipboard unavailable — ignore
    }
  }, [show]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    mounted.current = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { reduceMotion.current = !!enabled; })
      .catch(() => {});

    checkClipboard();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        handledOnce.current = false; // fresh foreground — a new copy may exist
        checkClipboard();
      }
    });
    return () => {
      mounted.current = false;
      clearAutoTimer();
      sub.remove();
    };
  }, [checkClipboard]);

  const handleUse = useCallback(async () => {
    let url = '';
    try {
      url = (await Clipboard.getUrlAsync()) ?? '';
      if (!url) url = (await Clipboard.getStringAsync()) ?? '';
    } catch {
      url = '';
    }
    url = url.trim();
    if (TIKTOK_RE.test(url)) {
      hide(true);
      router.push({ pathname: '/(tabs)/rewrite', params: { url } });
    } else {
      // Morph to a "not found" note, then fade out.
      setNotFound(true);
      clearAutoTimer();
      autoTimer.current = setTimeout(() => hide(true), 1500);
    }
  }, [hide, router]);

  if (Platform.OS === 'web' || !visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        S.wrap,
        { top: insets.top + 62, opacity: anim, transform: [{ translateY }] },
      ]}
    >
      {notFound ? (
        <View style={S.pill}>
          <Text style={S.mutedText}>No TikTok link found</Text>
        </View>
      ) : (
        <View style={S.pill}>
          <LinearGradient
            colors={Gradient.heroCompact}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={S.chip}
          >
            <Link2 size={13} color="#fff" strokeWidth={2.4} />
          </LinearGradient>
          <AnimatedPressable haptic="light" onPress={handleUse} style={S.useBtn}>
            <Text style={S.pillText}>
              Got a TikTok link?  <Text style={S.useText}>Use it</Text>
            </Text>
          </AnimatedPressable>
          <TouchableOpacity onPress={() => hide(true)} hitSlop={10} style={S.close}>
            <X size={14} color={D.textMuted} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const S = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: 8,
    zIndex: 50,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: D.card,
    borderRadius: R.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: D.border,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 12,
    gap: 8,
    ...Shadow.card,
  },
  chip: {
    width: 24,
    height: 24,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useBtn: {
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 13,
    color: D.ink,
    ...T.medium,
  },
  useText: {
    fontSize: 13,
    color: D.coral,
    ...T.bold,
  },
  mutedText: {
    fontSize: 13,
    color: D.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    ...T.medium,
  },
  close: {
    marginLeft: 2,
  },
});

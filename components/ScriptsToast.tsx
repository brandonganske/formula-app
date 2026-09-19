import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Zap, Infinity as InfinityIcon } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { onScriptUsed } from '@/lib/scripts-toast';
import { haptic } from '@/lib/haptics';
import { D, T, R, Ease, Shadow } from '@/constants/ds';

// Drops in from the top after every generation: what it used, what's left.
export default function ScriptsToast() {
  const insets = useSafeAreaInsets();
  const { credits, unlimited } = useAuth();
  const [msg, setMsg] = useState<{ cost: number } | null>(null);
  const y = useRef(new Animated.Value(-80)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onScriptUsed((cost) => {
    setMsg({ cost });
    haptic.select();
    if (timer.current) clearTimeout(timer.current);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    timer.current = setTimeout(() => {
      Animated.timing(y, { toValue: -80, duration: 220, easing: Ease.out, useNativeDriver: true }).start(() => setMsg(null));
    }, 2800);
  }), []);

  if (!msg) return null;
  const low = !unlimited && credits <= 1;
  return (
    <Animated.View pointerEvents="none" style={[S.wrap, { top: insets.top + 6, transform: [{ translateY: y }] }]}>
      <View style={[S.pill, low && S.pillLow]}>
        {unlimited ? <InfinityIcon size={14} color="#FFF" strokeWidth={2.6} /> : <Zap size={13} color="#FFF" strokeWidth={2.5} fill="#FFF" />}
        <Text style={S.text}>
          {unlimited
            ? 'Script written · Unlimited'
            : `${msg.cost} script used · ${credits} left`}
        </Text>
      </View>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 50 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: D.ink, borderRadius: R.full, paddingHorizontal: 16, paddingVertical: 10, ...Shadow.card },
  pillLow: { backgroundColor: D.coral },
  text: { ...T.bold, fontSize: 13.5, color: '#FFF', letterSpacing: -0.1 },
});

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Film, ShieldCheck, FolderOpen } from 'lucide-react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import { D, T, R, Ease } from '@/constants/ds';

// Shown under a script the moment it's saved: the three places it can go next.
// Same row in every generator so the loop (write → check → film) is one gesture.
export default function AfterSaveRow({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 260, easing: Ease.out, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[S.row, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <AnimatedPressable style={[S.btn, S.btnInk]} haptic="medium" onPress={() => router.push({ pathname: '/teleprompter', params: { scriptId } })}>
        <Film size={14} color="#FFF" strokeWidth={2.2} /><Text style={S.textOn}>Film it</Text>
      </AnimatedPressable>
      <AnimatedPressable style={S.btn} haptic="light" onPress={() => router.push({ pathname: '/shop-safe', params: { scriptId } })}>
        <ShieldCheck size={14} color={D.limeDeep} strokeWidth={2.2} /><Text style={S.text}>Shop Safe</Text>
      </AnimatedPressable>
      <AnimatedPressable style={S.btn} haptic="light" onPress={() => router.push(`/script/${scriptId}`)}>
        <FolderOpen size={14} color={D.textPrimary} strokeWidth={2.2} /><Text style={S.text}>Open</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: R.full, backgroundColor: D.surface, borderWidth: 1, borderColor: D.border },
  btnInk: { backgroundColor: D.ink, borderColor: D.ink },
  text: { ...T.bold, fontSize: 12.5, color: D.textPrimary },
  textOn: { ...T.bold, fontSize: 12.5, color: '#FFF' },
});

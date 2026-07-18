import React, { useRef, useCallback } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { Ease } from '@/constants/ds';
import { useFocusEffect } from 'expo-router';

// Opacity-only (no movement), so it's already reduced-motion-safe.

export default function TabFadeView({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Ease.out,
        useNativeDriver: true,
      }).start();
    }, [])
  );

  return (
    <Animated.View style={[{ flex: 1, opacity }, style]}>
      {children}
    </Animated.View>
  );
}

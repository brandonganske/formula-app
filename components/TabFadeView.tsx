import React, { useRef, useCallback } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';

// Strong ease-out so the tab content resolves fast on focus. Opacity-only
// (no movement), so it's already reduced-motion-safe.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export default function TabFadeView({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: EASE_OUT,
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

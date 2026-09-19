import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' | null;

export interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  /** Scale target while pressed. Default 0.97. */
  scaleTo?: number;
  /** Haptic feedback fired on press-in. Default null (none). */
  haptic?: HapticKind;
  /** Style for the outer Pressable — needed when the button participates in a
   *  flex row (e.g. `{ flex: 1 }`), since `style` lands on the inner view. */
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function fireHaptic(kind: HapticKind) {
  if (!kind || Platform.OS === 'web') return;
  try {
    switch (kind) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'selection':
        Haptics.selectionAsync();
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // haptics unavailable — ignore
  }
}

export default function AnimatedPressable({
  scaleTo = 0.97,
  haptic = null,
  containerStyle,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  // Layout props (flex, margins, alignSelf) must live on the outer Pressable —
  // on the inner Animated.View they'd collapse or double up. Split them out so
  // call sites can pass a TouchableOpacity-style `style` straight through.
  const flat = StyleSheet.flatten(style) ?? {};
  const {
    flex, flexGrow, flexShrink, flexBasis, alignSelf,
    margin, marginTop, marginBottom, marginLeft, marginRight,
    marginHorizontal, marginVertical, marginStart, marginEnd,
    ...innerStyle
  } = flat as ViewStyle;
  const outerLayout: ViewStyle = {};
  const layoutEntries: [string, unknown][] = [
    ['flex', flex], ['flexGrow', flexGrow], ['flexShrink', flexShrink],
    ['flexBasis', flexBasis], ['alignSelf', alignSelf],
    ['margin', margin], ['marginTop', marginTop], ['marginBottom', marginBottom],
    ['marginLeft', marginLeft], ['marginRight', marginRight],
    ['marginHorizontal', marginHorizontal], ['marginVertical', marginVertical],
    ['marginStart', marginStart], ['marginEnd', marginEnd],
  ];
  for (const [k, v] of layoutEntries) {
    if (v !== undefined) (outerLayout as Record<string, unknown>)[k] = v;
  }

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReduceMotion(!!enabled); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  return (
    <Pressable
      {...rest}
      style={[outerLayout, containerStyle]}
      onPressIn={(e) => {
        fireHaptic(haptic);
        if (!reduceMotion) {
          Animated.spring(scale, {
            toValue: scaleTo,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
          }).start();
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduceMotion) {
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 30,
            bounciness: 6,
          }).start();
        }
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
